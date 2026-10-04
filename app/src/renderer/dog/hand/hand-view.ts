// The pet hand (P3, phase A2): a white cartoon glove with a dark outline, built from capsules and
// ellipsoids (no model files), that strokes the dog's head when it is petted (the touch sensor or a
// mouse click). The motion is hand-motion.ts; this places the shapes at the dog's head, scales them
// with the dog (1 unit = the dog's height) and fades them. Drawn on top of everything.
import * as THREE from 'three'
import { HAND, createHandPose, handPoseAt } from './hand-motion'

const FILL = 0xffffff
const EDGE = 0x273142
/** The outline is the same shape a little bigger, drawn from the back. */
const OUTLINE = 1.16
const Z = 80
/** The hand is this much bigger than the shapes below are drawn (a hand the size of the dog's head). */
const HAND_SIZE = 1.5
/** The sleeve is long enough to leave the picture at the top, so its end is never seen. */
const SLEEVE = 6

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
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly pose = createHandPose()
  private t = 0
  private active = false

  constructor(private readonly scene: THREE.Scene) {
    this.build()
    this.group.visible = false
    this.group.position.z = Z
    scene.add(this.group)
  }

  get playing(): boolean {
    return this.active
  }

  /** Start (or restart) a petting. */
  play(): void {
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
    handPoseAt(this.t, this.pose)
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
  }

  dispose(): void {
    this.scene.remove(this.group)
    this.group.clear()
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    this.fillMat.dispose()
    this.edgeMat.dispose()
  }

  // ---- the shapes (the hand points DOWN: +y is toward the dog's head) -----------------------

  private build(): void {
    const k = HAND_SIZE
    // palm
    this.part(new THREE.SphereGeometry(1, 20, 14), [0, 0, 0], [0.058 * k, 0.062 * k, 0.03 * k])
    // four fingers (the middle two longer), pointing down
    const fingers: [number, number][] = [
      [-0.04, 0.062],
      [-0.0135, 0.075],
      [0.0135, 0.075],
      [0.04, 0.064]
    ]
    for (const [x, len] of fingers) {
      this.part(new THREE.CapsuleGeometry(0.0165 * k, len * k, 6, 12), [
        x * k,
        (0.045 + len / 2 + 0.01) * k,
        0.002
      ])
    }
    // thumb, off to one side and angled
    this.part(
      new THREE.CapsuleGeometry(0.019 * k, 0.05 * k, 6, 12),
      [-0.062 * k, 0.025 * k, 0.004],
      undefined,
      0.75
    )
    // the cuff, then the sleeve going up and out of the top of the picture
    // (long parts get an outline that is wider but NOT longer, or it would stick out past the cuff)
    const cuff = new THREE.CylinderGeometry(0.066 * k, 0.07 * k, 0.04 * k, 20)
    this.part(cuff, [0, -0.075 * k, -0.002], undefined, 0, [1.1, 1.5, 1.1])
    const sleeve = new THREE.CylinderGeometry(0.058 * k, 0.062 * k, SLEEVE, 20)
    this.part(sleeve, [0, -0.095 * k - SLEEVE / 2, -0.003], undefined, 0, [1.12, 1, 1.12])
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
