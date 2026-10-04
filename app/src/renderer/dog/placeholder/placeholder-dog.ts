// PlaceholderDog — a stand-in implementing DogView + DogController (contracts §3.4, §3.5).
// Draws the dog file's shapes as plain Three.js meshes so Lane A can build fetch and behaviour
// from day one. Daniel's SDF + splat dog replaces this behind the same interfaces.
import * as THREE from 'three'
import type { DogFile, SdfShape } from '@shared/dog-file'
import type { DogController, DogEvent, DogState, Gait, PoseName } from '@shared/dog-controller'
import type { DogDebugView, DogRenderContext, DogView } from '@shared/dog-view'
import type { Facing, Point, Rect } from '@shared/geometry'

const GAIT_SPEED_PX_PER_S: Record<Gait, number> = { walk: 110, trot: 220, run: 420 }
const DEFAULT_POSE_MS = 350
const JUMP_GRAVITY = 1800 // px/s²
/** Placeholder-only: how far the body drops in poses (the real dog solves this with IK). */
const POSE_BODY_DROP: Partial<Record<PoseName, number>> = {
  sit: 14,
  lie: 34,
  sleep: 38,
  playBow: 10
}

// Scratch objects reused every frame — no per-frame allocation (CLAUDE.md "hot paths").
const tmpQuat = new THREE.Quaternion()
const tmpBox = new THREE.Box3()
const tmpVec = new THREE.Vector3()

interface BoneState {
  node: THREE.Object3D
  rest: THREE.Quaternion
  from: THREE.Quaternion
  to: THREE.Quaternion
}

type Motion =
  | { kind: 'none' }
  | { kind: 'move'; tx: number; ty: number; speed: number; resolve: () => void }
  | {
      kind: 'jump'
      x0: number
      y0: number
      vx: number
      vy: number
      t: number
      duration: number
      tx: number
      ty: number
      resolve: () => void
    }

function shapeGeometry(shape: SdfShape): THREE.BufferGeometry {
  const [a = 1, b = 1, c = 1] = shape.params
  switch (shape.kind) {
    case 'sphere':
      return new THREE.SphereGeometry(a, 16, 12)
    case 'ellipsoid':
      return new THREE.SphereGeometry(1, 16, 12).scale(a, b, c)
    case 'capsule':
      // CapsuleGeometry runs along +y; contracts put the axis along local +x.
      return new THREE.CapsuleGeometry(a, b * 2, 6, 12).rotateZ(-Math.PI / 2)
    case 'roundCone':
      return new THREE.CylinderGeometry(b, a, c, 12).rotateZ(-Math.PI / 2).translate(c / 2, 0, 0)
  }
}

export class PlaceholderDog implements DogView, DogController {
  private readonly root = new THREE.Group()
  private readonly bones = new Map<string, BoneState>()
  private readonly listeners = new Set<(e: DogEvent) => void>()
  private readonly ball: THREE.Mesh
  private bodyBaseY = 0

  private x = 0
  private y = 0
  private facing: Facing = 1
  private pose: PoseName = 'stand'
  private poseT = 1
  private poseMs = DEFAULT_POSE_MS
  private poseResolve: (() => void) | null = null
  private bodyDropFrom = 0
  private bodyDropTo = 0
  private motion: Motion = { kind: 'none' }
  private lookTarget: Point | null = null
  private tailWag = 0.6
  private clock = 0
  private bounds: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private readonly poseTable = new Map<PoseName, Record<string, [number, number, number, number]>>()

  constructor() {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0x9fd43c })
    )
    this.ball.visible = false
  }

  // ---- DogView -------------------------------------------------------------------------

  async init(ctx: DogRenderContext, dog: DogFile): Promise<void> {
    this.loadPoses(dog)
    const nodes = new Map<string, THREE.Object3D>()
    for (const bone of dog.bones) {
      const node = new THREE.Object3D()
      node.name = bone.name
      node.position.fromArray(bone.restPos)
      node.quaternion.fromArray(bone.restRot)
      nodes.set(bone.name, node)
      const rest = node.quaternion.clone()
      this.bones.set(bone.name, { node, rest, from: rest.clone(), to: rest.clone() })
    }
    for (const bone of dog.bones) {
      const node = nodes.get(bone.name)!
      const parent = bone.parent ? nodes.get(bone.parent) : this.root
      parent?.add(node)
    }
    for (const shape of dog.shapes) {
      const mesh = new THREE.Mesh(
        shapeGeometry(shape),
        new THREE.MeshLambertMaterial({ color: new THREE.Color().fromArray(shape.color) })
      )
      mesh.position.fromArray(shape.offset)
      nodes.get(shape.bone)?.add(mesh)
    }
    const head = nodes.get('head')
    this.ball.position.set(26, 8, 0)
    head?.add(this.ball)
    this.bodyBaseY = nodes.get('body')?.position.y ?? 0
    ctx.scene.add(this.root)
    this.applyTransform()
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000
    this.clock += dt
    this.updateMotion(dt)
    this.updatePose(dtMs)
    this.updateSecondary()
    this.applyTransform()
    this.updateBounds()
  }

  getBounds(): Rect {
    return this.bounds
  }

  hitTest(x: number, y: number): boolean {
    const b = this.bounds
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  }

  setDebugView(_mode: DogDebugView): void {
    // The placeholder has no x-ray views; Daniel's dog implements them.
  }

  // ---- DogController -------------------------------------------------------------------

  setPose(pose: PoseName, opts?: { durationMs?: number }): Promise<void> {
    const target = this.poseTable.get(pose)
    if (!target) return Promise.resolve()
    this.pose = pose
    this.poseT = 0
    this.poseMs = opts?.durationMs ?? DEFAULT_POSE_MS
    this.bodyDropFrom = this.currentBodyDrop()
    this.bodyDropTo = POSE_BODY_DROP[pose] ?? 0
    for (const [name, b] of this.bones) {
      b.from.copy(b.node.quaternion)
      const q = target[name]
      if (q) b.to.fromArray(q)
      else b.to.copy(b.rest)
    }
    this.poseResolve?.()
    return new Promise((resolve) => {
      this.poseResolve = resolve
    })
  }

  moveTo(x: number, y: number, gait: Gait): Promise<void> {
    this.finishMotion()
    if (this.pose !== 'stand') void this.setPose('stand', { durationMs: 150 })
    return new Promise((resolve) => {
      this.motion = { kind: 'move', tx: x, ty: y, speed: GAIT_SPEED_PX_PER_S[gait], resolve }
    })
  }

  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void> {
    this.finishMotion()
    const apex = opts?.apexPx ?? 80
    const peakY = Math.min(this.y, y) - apex
    const up = Math.sqrt(2 * JUMP_GRAVITY * Math.max(1, this.y - peakY))
    const down = Math.sqrt(2 * JUMP_GRAVITY * Math.max(1, y - peakY))
    const duration = up / JUMP_GRAVITY + down / JUMP_GRAVITY
    return new Promise((resolve) => {
      this.motion = {
        kind: 'jump',
        x0: this.x,
        y0: this.y,
        vx: (x - this.x) / duration,
        vy: -up,
        t: 0,
        duration,
        tx: x,
        ty: y,
        resolve
      }
    })
  }

  lookAt(target: Point | null): void {
    this.lookTarget = target
  }

  setLayer(params: { tailWag?: number; earPerk?: number; breathing?: number }): void {
    if (params.tailWag !== undefined) this.tailWag = params.tailWag
  }

  attachBall(attached: boolean): void {
    this.ball.visible = attached
  }

  getState(): DogState {
    const pose =
      this.motion.kind === 'move' ? 'moving' : this.motion.kind === 'jump' ? 'airborne' : this.pose
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      pose,
      busy: this.motion.kind !== 'none' || this.poseT < 1
    }
  }

  onEvent(cb: (e: DogEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Not part of the contract: place the dog without animating (initial spawn). */
  placeAt(x: number, y: number): void {
    this.x = x
    this.y = y
    this.applyTransform()
  }

  // ---- internals -------------------------------------------------------------------------

  private loadPoses(dog: DogFile): void {
    for (const [name, pose] of Object.entries(dog.poses)) {
      this.poseTable.set(name as PoseName, pose)
    }
  }

  private emit(kind: DogEvent['kind']): void {
    for (const cb of this.listeners) cb({ kind })
  }

  private finishMotion(): void {
    if (this.motion.kind !== 'none') this.motion.resolve()
    this.motion = { kind: 'none' }
  }

  private currentBodyDrop(): number {
    const t = this.ease(this.poseT)
    return this.bodyDropFrom + (this.bodyDropTo - this.bodyDropFrom) * t
  }

  private ease(t: number): number {
    // Cartoon-ish: slight overshoot then settle.
    const c = 1.4
    const u = t - 1
    return 1 + (c + 1) * u * u * u + c * u * u
  }

  private updateMotion(dt: number): void {
    const m = this.motion
    if (m.kind === 'move') {
      const dx = m.tx - this.x
      const dy = m.ty - this.y
      const dist = Math.hypot(dx, dy)
      if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1
      const step = m.speed * dt
      if (dist <= step) {
        this.x = m.tx
        this.y = m.ty
        this.motion = { kind: 'none' }
        m.resolve()
        this.emit('arrived')
      } else {
        this.x += (dx / dist) * step
        this.y += (dy / dist) * step
      }
    } else if (m.kind === 'jump') {
      m.t += dt
      if (Math.abs(m.vx) > 1) this.facing = m.vx > 0 ? 1 : -1
      if (m.t >= m.duration) {
        this.x = m.tx
        this.y = m.ty
        this.motion = { kind: 'none' }
        m.resolve()
        this.emit('landed')
      } else {
        this.x = m.x0 + m.vx * m.t
        this.y = m.y0 + m.vy * m.t + 0.5 * JUMP_GRAVITY * m.t * m.t
      }
    }
  }

  private updatePose(dtMs: number): void {
    if (this.poseT >= 1) return
    this.poseT = Math.min(1, this.poseT + dtMs / this.poseMs)
    const t = this.ease(this.poseT)
    for (const b of this.bones.values()) {
      b.node.quaternion.slerpQuaternions(b.from, b.to, t)
    }
    if (this.poseT >= 1) {
      const resolve = this.poseResolve
      this.poseResolve = null
      resolve?.()
      this.emit('poseDone')
    }
  }

  private updateSecondary(): void {
    const tail = this.bones.get('tail')
    if (tail && this.poseT >= 1) {
      tmpQuat.setFromAxisAngle(tmpVec.set(0, 0, 1), Math.sin(this.clock * 14) * 0.35 * this.tailWag)
      tail.node.quaternion.copy(tail.to).multiply(tmpQuat)
    }
    const moving = this.motion.kind === 'move'
    for (const name of ['leg_fl', 'leg_rr', 'leg_fr', 'leg_rl']) {
      const leg = this.bones.get(name)
      if (!leg || this.poseT < 1) continue
      const phase = name === 'leg_fl' || name === 'leg_rr' ? 0 : Math.PI
      const swing = moving ? Math.sin(this.clock * 16 + phase) * 0.45 : 0
      tmpQuat.setFromAxisAngle(tmpVec.set(0, 0, 1), swing)
      leg.node.quaternion.copy(leg.to).multiply(tmpQuat)
    }
    const head = this.bones.get('head')
    if (head && this.lookTarget && this.poseT >= 1) {
      const headY = this.y + this.bodyBaseY - 30
      const dx = (this.lookTarget.x - this.x) * this.facing
      const angle = Math.max(
        -0.6,
        Math.min(0.6, Math.atan2(this.lookTarget.y - headY, Math.max(20, dx)))
      )
      tmpQuat.setFromAxisAngle(tmpVec.set(0, 0, 1), angle)
      head.node.quaternion.copy(head.to).multiply(tmpQuat)
    }
  }

  private applyTransform(): void {
    const breathe = Math.sin(this.clock * 3) * 1.2
    this.root.position.set(this.x, this.y, 0)
    this.root.rotation.y = this.facing === 1 ? 0 : Math.PI
    const body = this.bones.get('body')
    if (body) body.node.position.y = this.bodyBaseY + this.currentBodyDrop() + breathe
  }

  private updateBounds(): void {
    tmpBox.setFromObject(this.root)
    this.bounds.x = tmpBox.min.x
    this.bounds.y = tmpBox.min.y
    this.bounds.w = tmpBox.max.x - tmpBox.min.x
    this.bounds.h = tmpBox.max.y - tmpBox.min.y
  }
}
