// The pet hand (P3, phase A2): a white cartoon glove with a dark outline, built from capsules and
// ellipsoids (no model files), that strokes the dog's head when it is petted (the touch sensor or a
// mouse click). The motion is hand-motion.ts; this places the shapes at the dog's head, scales them
// with the dog (1 unit = the dog's height) and fades them. Drawn on top of everything.
import * as THREE from 'three'
import { HAND, createHandPose, handPoseAt } from './hand-motion'
import type { HandSpot } from './hand-motion'

const FILL = 0xfdfdff
const EDGE = 0x2f3b4d
/** The outline is the same shape a little bigger, drawn from the back. */
const OUTLINE = 1.14
const Z = 80
/** How dark the soft shadow on the dog's head is at its darkest. */
const SHADOW_OPACITY = 0.3
/** The hand is this much bigger than the shapes below are drawn (a hand the size of the dog's head). */
const HAND_SIZE = 1.5

/** A soft round blob (white in the middle, fading to nothing) used as the shadow's alpha. Needs a canvas, so it is skipped without one (tests). */
function softBlob(): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export class PetHand {
  readonly group = new THREE.Group()
  private readonly fillMat = new THREE.MeshBasicMaterial({
    color: FILL,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide // the camera's y-down mirror flips winding
  })
  private readonly edgeMat = new THREE.MeshBasicMaterial({
    color: EDGE,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide
  })
  private readonly shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    map: softBlob(),
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly pose = createHandPose()
  private t = 0
  private active = false
  private spot: HandSpot = 'head'

  constructor(private readonly scene: THREE.Scene) {
    this.build()
    this.group.visible = false
    this.group.position.z = Z
    scene.add(this.group)
  }

  get playing(): boolean {
    return this.active
  }

  /** Start (or restart) a petting, on the dog's head or its body. */
  play(spot: HandSpot = 'head'): void {
    this.spot = spot
    this.t = 0
    this.active = true
  }

  /** `anchor` = the dog's head on screen, `dogHeightPx` = how tall the dog is. */
  update(dtMs: number, anchor: { x: number; y: number }, dogHeightPx: number): void {
    if (!this.active) {
      this.group.visible = false
      return
    }
    if (Number.isFinite(dtMs) && dtMs > 0) this.t += dtMs
    handPoseAt(this.t, this.pose, this.spot)
    if (this.t >= HAND.durationMs) this.active = false
    const ok = Number.isFinite(anchor.x) && Number.isFinite(anchor.y) && dogHeightPx > 0
    this.group.visible = this.pose.visible && ok
    if (!this.group.visible) return
    this.group.position.x = anchor.x + this.pose.x * dogHeightPx
    this.group.position.y = anchor.y + this.pose.y * dogHeightPx
    this.group.rotation.z = this.pose.rot
    this.group.scale.setScalar(dogHeightPx)
    this.fillMat.opacity = this.pose.alpha
    this.edgeMat.opacity = this.pose.alpha
    this.shadowMat.opacity = SHADOW_OPACITY * this.pose.alpha
  }

  dispose(): void {
    this.scene.remove(this.group)
    this.group.clear()
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    this.fillMat.dispose()
    this.edgeMat.dispose()
    this.shadowMat.map?.dispose()
    this.shadowMat.dispose()
  }

  // ---- the shapes (the hand points DOWN: +y is toward the dog's head) -----------------------

  private build(): void {
    const k = HAND_SIZE
    // a soft shadow where the fingers fall on the dog's head
    this.shadow()
    // palm: a rounded oval
    this.part(new THREE.SphereGeometry(1, 32, 20), [0, 0, 0], [0.066 * k, 0.07 * k, 0.03 * k])
    // four fingers: tapered, slightly splayed (the outer ones lean outward), each a smooth capsule
    // [x of the base, length, radius, lean in radians]
    const fingers: [number, number, number, number][] = [
      [-0.044, 0.058, 0.0155, 0.2],
      [-0.0145, 0.075, 0.0168, 0.07],
      [0.0145, 0.072, 0.0168, -0.07],
      [0.044, 0.056, 0.015, -0.2]
    ]
    for (const [x, len, r, lean] of fingers) {
      const baseY = 0.05
      this.limb(x * k, baseY * k, len * k, r * k, lean)
    }
    // thumb: up at the side of the palm, angled out and down
    this.limb(-0.056 * k, 0.0 * k, 0.05 * k, 0.019 * k, 0.95)
  }

  /** A smooth finger: a capsule whose BASE is at (x, y) and that points along `lean` from straight down. */
  private limb(x: number, y: number, length: number, radius: number, lean: number): void {
    const total = length + 2 * radius
    const cx = x - Math.sin(lean) * (total / 2 - radius)
    const cy = y + Math.cos(lean) * (total / 2 - radius)
    this.part(new THREE.CapsuleGeometry(radius, length, 10, 20), [cx, cy, 0.002], undefined, lean)
  }

  private shadow(): void {
    const k = HAND_SIZE
    const g = new THREE.CircleGeometry(1, 32)
    this.geometries.push(g)
    const m = new THREE.Mesh(g, this.shadowMat)
    m.position.set(0.01 * k, 0.17 * k, -0.01)
    m.scale.set(0.11 * k, 0.05 * k, 1)
    m.renderOrder = 7
    m.frustumCulled = false
    this.group.add(m)
  }

  private part(
    g: THREE.BufferGeometry,
    pos: [number, number, number],
    scale?: [number, number, number],
    rotZ = 0,
    edgeScale: [number, number, number] = [OUTLINE, OUTLINE, OUTLINE]
  ): void {
    this.geometries.push(g)
    const edge = new THREE.Mesh(g, this.edgeMat)
    const fill = new THREE.Mesh(g, this.fillMat)
    for (const m of [edge, fill]) {
      m.position.set(...pos)
      m.rotation.z = rotZ
      m.frustumCulled = false
      if (scale) m.scale.set(...scale)
      this.group.add(m)
    }
    edge.scale.multiply(new THREE.Vector3(...edgeScale))
    edge.renderOrder = 7
    fill.renderOrder = 8
  }
}
