// DogMotion — the dog's own motion. Implements DogController (contracts §3.4) on top of the
// skeleton in a DogFile. It replaces the hidden-placeholder bridge SdfDog used before.
//
// Per frame, in the dog frame (x forward, y DOWN, ground = the dog's own y):
//   1. integrate position (moveTo / jumpTo) and the speed it implies;
//   2. blend the current pose parameters toward the target pose with cartoon timing;
//   3. turn toward the direction of travel (yaw);
//   4. place the body (height, pitch, breathing, walking bob), solve all four legs with IK so the
//      PAWS land on chosen ground points (planted while the body moves above them), then drive the
//      neck/head (look-at), jaw, tail (wag chain) and ears (spring).
// Lengths scale with the dog: poses are in units of T = hip-to-paw-bottom leg length, so every dog
// built from any spec gets paws on the ground.
import * as THREE from 'three'
import type { DogFile } from '@shared/dog-file'
import type { DogController, DogEvent, DogState, Gait, PoseName } from '@shared/dog-controller'
import type { Facing, Point, Rect } from '@shared/geometry'
import { restYaw, stepAngle, targetYaw } from '../sdf/yaw'
import { cartoonEase, clamp01 } from './ease'
import { footLift, footOffsetX, GAITS, legPhase, strideHz } from './gait'
import type { GaitDef, LegId } from './gait'
import { solveLegToGround } from './leg-solve'
import type { LegGeometry } from './leg-solve'
import { createIdleLife, noteActivity, stepIdleLife } from './idle-life'
import { IDLE_NAMES, IDLES, createOffsets, sampleIdle, scaleOffsets } from './idles'
import type { IdleName } from './idles'
import { createMood, setMoodTarget, stepMood } from './mood'
import type { MoodName } from './mood'
import { blendPose, copyPose, POSES } from './poses'
import type { PoseParams } from './poses'
import { DogRig } from './rig'
import { stepSpring } from './spring'
import type { SpringState } from './spring'

export type LegName = LegId

const DEG = Math.PI / 180
const LEGS: readonly LegId[] = ['fl', 'fr', 'rl', 'rr']
const GAIT_SPEED_PX_PER_S: Record<Gait, number> = { walk: 110, trot: 220, run: 420 }
const ACCEL = 900 // px/s²
const DECEL = 1400
const JUMP_GRAVITY = 1800 // px/s²
const MOVING_SPEED = 20 // px/s: below this the dog counts as standing still
/** A leg is never asked to stretch past this fraction of its full length (keeps a hint of bend). */
const REACH = 0.985
const TURN_RATE = 9
const DEFAULT_POSE_MS = 350
/** Seconds the dog crouches before a jump (anticipation). */
const JUMP_WINDUP = 0.13
/** Poses a caller may ask for by name (the rest are internal, e.g. jump poses). */
const PUBLIC_POSES: ReadonlySet<string> = new Set([
  'stand',
  'sit',
  'lie',
  'sleep',
  'playBow',
  'headTilt',
  'pant',
  'stretch'
])

type Motion =
  | { kind: 'none' }
  | { kind: 'move'; tx: number; ty: number; speed: number; gait: GaitDef; resolve: () => void }
  | {
      kind: 'jump'
      x0: number
      y0: number
      vx: number
      vy: number
      t: number
      windup: number // seconds of crouch still to go before the spring
      duration: number
      tx: number
      ty: number
      resolve: () => void
    }

// Scratch objects reused every frame — no per-frame allocation (CLAUDE.md "hot paths").
const legOut: [number, number] = [0, 0]
const tmpV = new THREE.Vector3()

interface Leg {
  id: LegId
  geo: LegGeometry
  legBone: string
  shinBone: string
}

export class DogMotion implements DogController {
  readonly root = new THREE.Group()
  readonly rig: DogRig
  /** Switches for the extra polish; set a flag to false to get the plain motion back. */
  readonly polish = { anticipation: true, mood: true, idle: true, idleTricks: true }

  // geometry taken from the dog file
  private readonly legs: Leg[]
  private readonly legTotal: number // T: hip to paw bottom
  private readonly scale: number // T / 50: how big this dog is vs the template
  private readonly bodyY0: number // body bone's standing (legs straight) height
  private readonly heightPx: number
  private readonly jawLen: number
  private readonly ball: THREE.Mesh

  // world state
  private x = 0
  private y = 0
  private facing: Facing = 1
  private yaw = 0
  private hasYaw = false
  private speed = 0
  private heading = { x: 1, y: 0 }
  private motion: Motion = { kind: 'none' }
  private gait: GaitDef = GAITS.walk
  private phase = 0
  private moveW = 0 // 0..1: how much of the walking pattern is blended in
  private clock = 0
  private prevY = 0
  private prevBodyY = 0

  // pose blending
  private readonly poseFrom: PoseParams = { ...POSES.stand! }
  private readonly poseTo: PoseParams = { ...POSES.stand! }
  private readonly cur: PoseParams = { ...POSES.stand! }
  private poseT = 1
  private poseMs = DEFAULT_POSE_MS
  private publicPose: PoseName = 'stand'
  private poseResolve: (() => void) | null = null
  private poseAnnounce = false
  private standTimer = 0 // after landing: settle to stand when it runs out
  private jumpStage = 0 // 0 none, 1 airUp, 2 airDown

  // layers and look
  private tailWag = 0.5
  private earPerk = 0
  private breathing = 1
  private lookTarget: Point | null = null
  private lookYaw = 0
  private lookPitch = 0
  private neckYaw = 0 // the neck follows the head a beat later
  private neckPitch = 0
  private readonly mood = createMood()
  private readonly idle = createIdleLife(7)
  // the idle trick being played (a yawn, sniff or shake), and the pose with its offsets added
  private trickName: IdleName | null = null
  private trickT = 0
  private trickW = 0
  private trickEnding = false
  private trickResolve: (() => void) | null = null
  private readonly trick = createOffsets()
  private readonly eff: PoseParams = { ...POSES.stand! }
  private readonly earSpring: SpringState = { x: 0, v: 0 }
  // per-leg paw targets for the current frame (reused every frame)
  private readonly footX = new Float64Array(4)
  private readonly footLift = new Float64Array(4)

  private readonly listeners = new Set<(e: DogEvent) => void>()

  constructor(dog: DogFile) {
    this.rig = new DogRig(dog)
    this.root.add(this.rig.root)
    const bone = (name: string): DogFile['bones'][number] => {
      const b = dog.bones.find((x) => x.name === name)
      if (!b) throw new Error(`DogMotion: dog file has no bone ${name}`)
      return b
    }
    const upper = bone('shin_fl').restPos[0]
    this.legTotal = upper * 2
    this.scale = this.legTotal / 50
    this.bodyY0 = bone('body').restPos[1]
    this.heightPx = dog.heightPx
    this.legs = LEGS.map((id) => {
      const b = bone(`leg_${id}`)
      return {
        id,
        legBone: `leg_${id}`,
        shinBone: `shin_${id}`,
        // front legs bend the elbow backward (-1), rear legs bend the knee forward (+1)
        geo: {
          hipX: b.restPos[0],
          hipY: b.restPos[1],
          upper,
          lower: upper,
          bend: id[0] === 'f' ? -1 : 1
        }
      }
    })
    const jaw = dog.shapes.find((s) => s.id === 'jaw')
    this.jawLen = jaw ? (jaw.params[2] ?? 10) + jaw.offset[0] : 12

    // The fetch ball, carried at the tip of the snout.
    const nose = dog.shapes.find((s) => s.id === 'nose')
    const r = 7 * this.scale
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(r, 14, 10),
      new THREE.MeshLambertMaterial({ color: 0x9fd43c })
    )
    this.ball.position.set((nose?.offset[0] ?? 30) + r * 0.6, (nose?.offset[1] ?? 5) + r * 0.8, 0)
    this.ball.visible = false
    this.rig.node('head').add(this.ball)
    this.applyFrame(0)
  }

  // ---- extra API used by SdfDog and the tests (not part of the contract) --------------------

  /** Place the dog without animating (initial spawn). */
  placeAt(x: number, y: number): void {
    this.x = x
    this.y = y
    this.prevY = y
    this.applyFrame(0)
  }

  getYaw(): number {
    return this.yaw
  }

  boneNode(name: string): THREE.Object3D {
    return this.rig.node(name)
  }

  /** World position of a bone's origin. */
  boneWorld(name: string, out: THREE.Vector3): THREE.Vector3 {
    return out.setFromMatrixPosition(this.rig.node(name).matrixWorld)
  }

  /** World position of a paw's bottom (the point that should touch the ground). */
  pawWorld(leg: LegId, out: THREE.Vector3): THREE.Vector3 {
    const shin = this.rig.node(`shin_${leg}`)
    return out.set(this.legs[0]!.geo.upper, 0, 0).applyMatrix4(shin.matrixWorld)
  }

  jawTipWorldY(): number {
    return tmpV.set(this.jawLen, 0, 0).applyMatrix4(this.rig.node('jaw').matrixWorld).y
  }

  /** Where the jaw tip would be with the mouth closed (for tests / debugging). */
  jawTipRestWorldY(): number {
    const jaw = this.rig.node('jaw')
    return tmpV
      .set(this.jawLen, 0, 0)
      .applyMatrix4(new THREE.Matrix4().compose(jaw.position, new THREE.Quaternion(), jaw.scale))
      .applyMatrix4(this.rig.node('head').matrixWorld).y
  }

  ballVisible(): boolean {
    return this.ball.visible
  }

  // ---- DogController ------------------------------------------------------------------------

  setPose(pose: PoseName, opts?: { durationMs?: number }): Promise<void> {
    if (!PUBLIC_POSES.has(pose)) return Promise.resolve()
    noteActivity(this.idle)
    this.cancelTrick()
    this.finishPendingPose()
    this.standTimer = 0
    this.publicPose = pose
    this.blendTo(POSES[pose]!, opts?.durationMs ?? DEFAULT_POSE_MS)
    this.poseAnnounce = true
    return new Promise((resolve) => {
      this.poseResolve = resolve
    })
  }

  moveTo(x: number, y: number, gait: Gait): Promise<void> {
    noteActivity(this.idle)
    this.cancelTrick()
    this.finishMotion()
    this.gait = GAITS[gait]
    if (this.publicPose !== 'stand') void this.setPose('stand', { durationMs: 150 })
    return new Promise((resolve) => {
      this.motion = {
        kind: 'move',
        tx: x,
        ty: y,
        speed: GAIT_SPEED_PX_PER_S[gait],
        gait: GAITS[gait],
        resolve
      }
    })
  }

  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void> {
    noteActivity(this.idle)
    this.cancelTrick()
    this.finishMotion()
    const apex = opts?.apexPx ?? 80
    const peakY = Math.min(this.y, y) - apex
    const up = Math.sqrt(2 * JUMP_GRAVITY * Math.max(1, this.y - peakY))
    const down = Math.sqrt(2 * JUMP_GRAVITY * Math.max(1, y - peakY))
    const duration = up / JUMP_GRAVITY + down / JUMP_GRAVITY
    this.publicPose = 'stand'
    this.standTimer = 0
    this.jumpStage = 1
    const windup = this.polish.anticipation ? JUMP_WINDUP : 0
    this.blendTo(windup > 0 ? POSES.crouch! : POSES.jumpUp!, windup > 0 ? 110 : 140)
    return new Promise((resolve) => {
      this.motion = {
        kind: 'jump',
        x0: this.x,
        y0: this.y,
        vx: (x - this.x) / duration,
        vy: -up,
        t: 0,
        windup,
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
    if (params.tailWag !== undefined) this.tailWag = clamp01(params.tailWag)
    if (params.earPerk !== undefined) this.earPerk = clamp01(params.earPerk)
    if (params.breathing !== undefined) this.breathing = Math.max(0, params.breathing)
  }

  /** Set the dog's feeling (happy, curious, sleepy, alert, neutral) at an intensity 0..1. */
  setMood(name: MoodName, intensity = 1): void {
    noteActivity(this.idle)
    setMoodTarget(this.mood, this.polish.mood ? name : 'neutral', intensity)
  }

  /**
   * Play a short idle trick (yawn, sniff, shake) on the spot. Resolves when it is done or a command
   * cancels it. Does nothing (resolves at once) unless the dog is standing with nothing to do.
   */
  playIdle(name: IdleName): Promise<void> {
    if (!this.polish.idle || !this.isStanding() || this.trickName) return Promise.resolve()
    this.trickName = name
    this.trickT = 0
    this.trickW = 1
    this.trickEnding = false
    return new Promise((resolve) => {
      this.trickResolve = resolve
    })
  }

  /** The idle trick being played right now, or null. */
  getIdle(): IdleName | null {
    return this.trickEnding ? null : this.trickName
  }

  /** How far the mood holds the eyelids shut (0..0.6); SdfDog adds it to the blink. */
  getLidDroop(): number {
    return Math.max(this.mood.values.lid, this.trick.lid)
  }

  attachBall(attached: boolean): void {
    this.ball.visible = attached
  }

  /**
   * The y of the ground under the dog. It stays put while the dog is in the air (the lower of the
   * take-off and landing levels), so the shadow stays on the ground instead of rising with a jump.
   */
  getGroundY(): number {
    const m = this.motion
    return m.kind === 'jump' ? Math.max(m.y0, m.ty) : this.y
  }

  getState(): DogState {
    const pose =
      this.motion.kind === 'move'
        ? 'moving'
        : this.motion.kind === 'jump'
          ? 'airborne'
          : this.publicPose
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

  /** Screen rect around the dog: used for click tests and for region rendering. */
  getBounds(): Rect {
    // Width narrowed from 2.2x to 1.6x height (2026-10-04, Ansh — flagged to Daniel): the old
    // value made the left/right click-through margin noticeably wider than the vertical one,
    // which doesn't track a standing dog's silhouette. Not pose-aware (heightPx is fixed per
    // dog) — revisit if a running/fetching pose needs a wider box.
    const w = this.heightPx * 1.6
    const h = this.heightPx * 1.25
    // A standing quadruped isn't symmetric front-to-back around its spine anchor — the snout
    // reaches further forward than the tail reaches back — so a box centered exactly on `this.x`
    // reads as extra padding on the tail side (2026-10-04, Ansh — flagged to Daniel: this is a
    // hitbox-only nudge, not a real silhouette measurement; tune or replace with an actual bounds
    // sample if it still looks off for a given pose).
    const FACING_BIAS = 0.12
    const offsetX = this.facing * (w / 2) * FACING_BIAS
    return { x: this.x - w / 2 + offsetX, y: this.y - h + 12, w, h }
  }

  hitTest(x: number, y: number): boolean {
    const b = this.getBounds()
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  }

  // ---- per frame ----------------------------------------------------------------------------

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000 // a stalled frame must not teleport the dog
    this.clock += dt
    if (!this.polish.mood) setMoodTarget(this.mood, 'neutral', 0)
    stepMood(this.mood, dt)
    stepIdleLife(this.idle, dt, this.polish.idle && this.isStanding(), this.trickName !== null)
    this.updateTrick(dt)
    this.integrateMotion(dt)
    this.updatePoseBlend(dt)
    this.updateYaw(dt)
    this.applyFrame(dt)
  }

  /** Standing with nothing to do (no move, jump, pose change or settle). */
  private isStanding(): boolean {
    return (
      this.motion.kind === 'none' &&
      this.publicPose === 'stand' &&
      this.standTimer === 0 &&
      this.poseT >= 1
    )
  }

  private cancelTrick(): void {
    if (!this.trickName) return
    this.trickEnding = true
    const r = this.trickResolve
    this.trickResolve = null
    r?.()
  }

  private updateTrick(dt: number): void {
    // a bored dog asks for a trick now and then (the request is always taken, even if unused)
    if (this.idle.trickReq >= 0) {
      const name = IDLE_NAMES[this.idle.trickReq]!
      this.idle.trickReq = -1
      if (this.polish.idleTricks) void this.playIdle(name)
    }
    if (!this.trickName) {
      sampleIdle('yawn', 0, this.trick) // all zero
      return
    }
    if (!this.trickEnding) this.trickT += dt
    this.trickW += ((this.trickEnding ? 0 : 1) - this.trickW) * (1 - Math.exp(-dt * 14))
    const done = this.trickT >= IDLES[this.trickName].duration
    if (done || (this.trickEnding && this.trickW < 0.02)) {
      this.trickName = null
      this.trickEnding = false
      const r = this.trickResolve
      this.trickResolve = null
      r?.()
      sampleIdle('yawn', 0, this.trick)
      return
    }
    sampleIdle(this.trickName, this.trickT, this.trick)
    scaleOffsets(this.trick, this.trickW)
  }

  private emit(kind: DogEvent['kind']): void {
    for (const cb of this.listeners) cb({ kind })
  }

  private finishMotion(): void {
    // interrupted in mid-jump (or mid-crouch): ease back to standing instead of freezing in the pose
    if (this.motion.kind === 'jump') this.blendTo(POSES.stand!, 150)
    if (this.motion.kind !== 'none') this.motion.resolve()
    this.motion = { kind: 'none' }
    this.jumpStage = 0
  }

  private finishPendingPose(): void {
    const r = this.poseResolve
    this.poseResolve = null
    r?.()
  }

  private blendTo(target: PoseParams, ms: number): void {
    copyPose(this.poseFrom, this.cur)
    copyPose(this.poseTo, target)
    this.poseT = 0
    this.poseMs = Math.max(1, ms)
  }

  private integrateMotion(dt: number): void {
    const m = this.motion
    if (m.kind === 'move') {
      const dx = m.tx - this.x
      const dy = m.ty - this.y
      const dist = Math.hypot(dx, dy)
      if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1
      // Slow down smoothly as the target nears so it does not overshoot.
      const want = Math.min(m.speed, Math.sqrt(2 * DECEL * dist) + 15)
      const dv = want - this.speed
      this.speed += Math.max(-DECEL * dt, Math.min(ACCEL * dt, dv))
      const step = this.speed * dt
      if (dist <= step || dist < 0.5) {
        this.x = m.tx
        this.y = m.ty
        this.speed = 0
        this.motion = { kind: 'none' }
        m.resolve()
        this.emit('arrived')
      } else {
        this.heading.x = dx / dist
        this.heading.y = dy / dist
        this.x += this.heading.x * step
        this.y += this.heading.y * step
      }
    } else if (m.kind === 'jump' && m.windup > 0) {
      // crouching before the spring: stay put on the ground
      m.windup -= dt
      this.speed = 0
      if (Math.abs(m.vx) > 1) this.facing = m.vx > 0 ? 1 : -1
      if (m.windup <= 0) this.blendTo(POSES.jumpUp!, 140)
    } else if (m.kind === 'jump') {
      m.t += dt
      this.speed = 0
      if (Math.abs(m.vx) > 1) this.facing = m.vx > 0 ? 1 : -1
      const progress = clamp01(m.t / m.duration)
      if (this.jumpStage === 1 && progress >= 0.5) {
        this.jumpStage = 2
        this.blendTo(POSES.jumpDown!, 160)
      }
      if (m.t >= m.duration) {
        this.x = m.tx
        this.y = m.ty
        this.motion = { kind: 'none' }
        this.jumpStage = 0
        this.blendTo(POSES.land!, 90) // landing squash, then settle
        this.standTimer = 0.16
        m.resolve()
        this.emit('landed')
      } else {
        this.x = m.x0 + m.vx * m.t
        this.y = m.y0 + m.vy * m.t + 0.5 * JUMP_GRAVITY * m.t * m.t
      }
    } else {
      this.speed = Math.max(0, this.speed - DECEL * dt)
    }
    // How much of the walking pattern is blended in, and the stride phase.
    const target = this.motion.kind === 'move' && this.speed > MOVING_SPEED ? 1 : 0
    this.moveW += (target - this.moveW) * Math.min(1, dt * 12)
    // The dog is drawn turned toward the viewer (three-quarter view), so its own forward axis is
    // longer than the on-screen travel: along its axis it covers screen-speed / cos(yaw). Cycle the
    // legs at THAT speed so planted paws stay planted on screen. (Depth movement is invisible in an
    // orthographic view; for vertical travel the legs simply cycle at the screen speed.)
    const cosYaw = Math.max(0.35, Math.abs(Math.cos(this.yaw)))
    const axisSpeed = Math.hypot(
      (Math.abs(this.heading.x) * this.speed) / cosYaw,
      Math.abs(this.heading.y) * this.speed
    )
    const hz = strideHz(axisSpeed, this.gait.strideLength * this.scale)
    this.phase = (this.phase + hz * dt) % 1
  }

  private updatePoseBlend(dt: number): void {
    if (this.standTimer > 0) {
      this.standTimer -= dt
      if (this.standTimer <= 0) {
        this.standTimer = 0
        this.blendTo(POSES.stand!, 240)
      }
    }
    if (this.poseT >= 1) {
      copyPose(this.cur, this.poseTo)
      return
    }
    this.poseT = Math.min(1, this.poseT + dt / (this.poseMs / 1000))
    blendPose(this.cur, this.poseFrom, this.poseTo, cartoonEase(this.poseT))
    if (this.poseT >= 1) {
      copyPose(this.cur, this.poseTo)
      if (this.poseAnnounce) {
        this.poseAnnounce = false
        this.finishPendingPose()
        this.emit('poseDone')
      }
    }
  }

  private updateYaw(dt: number): void {
    // Turn toward where the dog is travelling; settle to the three-quarter view at rest.
    let target = restYaw(this.facing)
    if (this.motion.kind === 'move' && this.speed > MOVING_SPEED) {
      target = targetYaw(this.heading.x * this.speed, this.heading.y * this.speed)
    } else if (this.motion.kind === 'jump') {
      target = restYaw(this.facing) // a jump arc is not "running up"
    }
    if (!this.hasYaw) {
      this.yaw = target
      this.hasYaw = true
    } else {
      this.yaw = stepAngle(this.yaw, target, dt, TURN_RATE)
    }
  }

  /** Pose the whole skeleton for this frame and update world matrices. */
  private applyFrame(dt: number): void {
    const rig = this.rig
    // the pose with any idle trick's offsets added (no allocation: a reused scratch pose)
    const cur = this.eff
    copyPose(cur, this.cur)
    cur.drop += this.trick.drop
    cur.pitch += this.trick.pitch
    cur.neck += this.trick.neck
    cur.head += this.trick.head
    cur.headRoll += this.trick.roll
    cur.jaw += this.trick.jaw
    cur.tailBase += this.trick.tail
    const T = this.legTotal
    const s = this.scale
    const moving = this.moveW

    // --- where each paw should be (dog frame): a pose spot plus the walking pattern --------------
    const pitch = -(cur.pitch + moving * 2 * Math.sin(4 * Math.PI * this.phase)) * DEG
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    const cpPose = Math.cos(-cur.pitch * DEG)
    const spPose = Math.sin(-cur.pitch * DEG)
    const stance = this.gait.duty * this.gait.strideLength * s
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i]!
      const front = leg.id[0] === 'f'
      const lp = legPhase(this.phase, this.gait.offsets[leg.id])
      const gx = moving * footOffsetX(lp, this.gait.duty, stance)
      const gl = moving * footLift(lp, this.gait.duty, this.gait.lift * T)
      // Anchor the paw to the hip at the POSE's pitch (not the walking wobble): a planted paw is
      // glued to the ground, so the body rocking above it must not drag it along.
      const hipRefX = leg.geo.hipX * cpPose - leg.geo.hipY * spPose
      this.footX[i] = hipRefX + (front ? cur.ffx : cur.rfx) * T + gx
      this.footLift[i] = Math.max(0, (front ? cur.ffl : cur.rfl) * T) + gl
    }

    // --- body height: the pose's drop + breathing, then AUTO-GROUNDING ---------------------------
    // Lower the body just enough that every paw can still reach its ground point (a pitched body
    // lifts the hips on one side; a long stride stretches the leg). Works for any dog.
    const mv = this.mood.values
    const breathing = this.breathing * mv.breath
    const breath = Math.sin(this.clock * 2.4) * 0.35 * s * breathing
    let bodyY = this.bodyY0 + cur.drop * T + breath
    let excess = 0
    for (let i = 0; i < this.legs.length; i++) {
      const g = this.legs[i]!.geo
      const hipDogX = g.hipX * cp - g.hipY * sp
      const hipRelY = g.hipX * sp + g.hipY * cp
      const dx = this.footX[i]! - hipDogX
      const reach = REACH * T
      const allowed = this.footLift[i]! + Math.sqrt(Math.max(0, reach * reach - dx * dx))
      excess = Math.max(excess, -(bodyY + hipRelY) - allowed)
    }
    bodyY += excess
    rig.node('body').position.y = bodyY
    rig.setBone('body', pitch, 0, this.idle.sway + this.trick.bodyRoll) // sway = the weight shift (a roll about the forward axis)

    // --- legs: IK aims each paw at its ground point ----------------------------------------------
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i]!
      solveLegToGround(leg.geo, 0, bodyY, pitch, this.footX[i]!, this.footLift[i]!, legOut)
      rig.setBone(leg.legBone, legOut[0])
      rig.setBone(leg.shinBone, legOut[1])
    }

    // --- look-at: head/neck follow the target, within limits ------------------------------------
    this.updateLook(dt)
    const breathNeck = Math.sin(this.clock * 2.4) * 0.6 * DEG * breathing
    rig.setBone(
      'neck',
      this.rest('neck') +
        ((cur.neck + mv.neck + this.idle.droop * 4) * DEG + this.neckPitch * 0.4 + breathNeck),
      this.neckYaw * 0.4
    )
    const jawWiggle = this.cur.jaw > 10 ? Math.sin(this.clock * 14) * 3 : 0
    rig.setBone(
      'head',
      this.rest('head') + (cur.head + mv.head + this.idle.droop * 7) * DEG + this.lookPitch * 0.6,
      this.lookYaw * 0.6,
      (cur.headRoll + mv.roll) * DEG
    )
    rig.setBone('jaw', (cur.jaw + jawWiggle) * DEG)

    // --- tail: a wag that travels down the chain with a lag --------------------------------------
    const wag = clamp01(this.tailWag + mv.tail)
    const f = 5 + 9 * wag
    const amp = (8 + 28 * wag) * DEG
    rig.setBone('tail1', this.rest('tail1') + cur.tailBase * DEG + Math.sin(this.clock * f) * amp)
    rig.setBone('tail2', cur.tailCurl * DEG + Math.sin(this.clock * f - 0.7) * amp * 0.8)
    rig.setBone('tail3', cur.tailCurl * DEG + Math.sin(this.clock * f - 1.4) * amp * 0.9)

    // --- ears: sweep back with speed, flick with vertical motion (a spring gives them weight) ----
    if (dt > 0) {
      const vy = (bodyY - this.prevBodyY + (this.y - this.prevY)) / dt
      const target =
        this.trick.ear -
        (this.speed * 0.03 + vy * 0.02) * DEG -
        Math.max(-0.6, Math.min(1, this.earPerk + mv.ears)) * 12 * DEG
      if (this.idle.earKick !== 0) this.earSpring.v -= 5 // a quick flick of the ears
      stepSpring(this.earSpring, Math.max(-0.6, Math.min(0.6, target)), 160, 11, dt)
    }
    this.prevBodyY = bodyY
    this.prevY = this.y
    rig.setBone('ear_l', this.rest('ear_l') + this.earSpring.x)
    rig.setBone('ear_r', this.rest('ear_r') + this.earSpring.x)

    // --- place in the world and refresh matrices ------------------------------------------------
    this.root.position.set(this.x, this.y, 0)
    this.root.rotation.y = this.yaw
    this.root.updateMatrixWorld(true)
  }

  private rest(name: string): number {
    return this.rig.restAngleZ.get(name) ?? 0
  }

  private updateLook(dt: number): void {
    let wantYaw = Math.sin(this.clock * 0.35) * 0.22 // idle look-around
    let wantPitch = Math.sin(this.clock * 0.27) * 0.06
    if (this.lookTarget) {
      this.boneWorld('head', tmpV)
      const dx = this.lookTarget.x - tmpV.x
      const dy = this.lookTarget.y - tmpV.y
      // the dog's own axes in the world: x axis = (cos yaw, 0, -sin yaw), z axis = (sin yaw, 0, cos yaw)
      const lx = dx * Math.cos(this.yaw)
      const lz = dx * Math.sin(this.yaw)
      wantYaw = Math.max(-0.9, Math.min(0.9, Math.atan2(-lz, lx)))
      wantPitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, Math.hypot(lx, lz) + 1)))
    }
    const k = Math.min(1, dt * 8)
    this.lookYaw += (wantYaw - this.lookYaw) * k
    this.lookPitch += (wantPitch - this.lookPitch) * k
    // the neck lags the head by a beat, so the head leads and the neck follows
    const kNeck = Math.min(1, dt * 4)
    this.neckYaw += (wantYaw - this.neckYaw) * kNeck
    this.neckPitch += (wantPitch - this.neckPitch) * kNeck
  }
}
