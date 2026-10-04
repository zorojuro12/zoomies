// SdfDog — the dog drawn as ray-marched, smoothly blended SDF shapes (see sdf-shader.ts).
// Implements DogView + DogController (contracts §3.4, §3.5).
//
// Motion comes from our own DogMotion (dog/motion/): it poses the skeleton every frame (poses,
// gait + leg IK, jumps, look-at, tail and ears) and turns the dog toward where it travels. SdfDog
// only reads each bone's world matrix and hands the matrices to the shader.
import * as THREE from 'three'
import type { DogFile, ShapeKind } from '@shared/dog-file'
import type { DogController, DogEvent, DogState, Gait, PoseName } from '@shared/dog-controller'
import type { DogDebugView, DogRenderContext, DogView } from '@shared/dog-view'
import type { Point, Rect } from '@shared/geometry'
import { DogMotion } from '../motion/dog-motion'
import { shapeBound, unionSphereInto } from './bounds'
import { debugColor, debugFlags } from './debug-view'
import type { Sphere } from './bounds'
import { MAX_SHAPES, SDF_FRAG, SDF_VERT } from './sdf-shader'

const KIND_INDEX: Record<ShapeKind, number> = { sphere: 0, capsule: 1, ellipsoid: 2, roundCone: 3 }

function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export class SdfDog implements DogView, DogController {
  private motion: DogMotion | null = null
  private camera: THREE.OrthographicCamera | null = null
  private scene: THREE.Scene | null = null
  private quad: THREE.Mesh | null = null
  private shadow: THREE.Mesh | null = null
  private boneNodes: THREE.Object3D[] = []
  private offsets: THREE.Matrix4[] = []
  // x-ray 'landmarks' view: the skeleton (bones as lines, joints as dots) drawn over the dog
  private skeleton: THREE.Group | null = null
  private skelLines: THREE.LineSegments | null = null
  private skelPoints: THREE.Points | null = null
  private boneNames: string[] = []
  private boneParent: number[] = []
  private showSkeleton = false
  private readonly skelPos = new THREE.Vector3()
  // bounding sphere of each shape: centre on its local x axis (cx) and radius, set once per dog
  private boundCx: number[] = []
  private boundR: number[] = []
  // scratch for the per-frame bounds (reused: no allocation in the frame loop)
  private readonly shapeWorld = new THREE.Matrix4()
  private readonly centre = new THREE.Vector3()
  private readonly bx = new Float64Array(MAX_SHAPES)
  private readonly by = new Float64Array(MAX_SHAPES)
  private readonly bz = new Float64Array(MAX_SHAPES)
  private readonly br = new Float64Array(MAX_SHAPES)
  private readonly dogSphere: Sphere = { x: 0, y: 0, z: 0, r: 0 }
  private shadowW = 150
  private readonly uniforms = {
    uCount: { value: 0 },
    uKind: { value: new Array<number>(MAX_SHAPES).fill(0) },
    uParams: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector3()) },
    uBlend: { value: new Array<number>(MAX_SHAPES).fill(0) },
    uColor: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector3()) },
    uInv: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Matrix4()) },
    uBound: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector4()) },
    uDog: { value: new THREE.Vector4() },
    uHard: { value: 0 },
    uDebug: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector3()) },
    uViewProj: { value: new THREE.Matrix4() },
    uPixel: { value: 1 }
  }

  private get m(): DogMotion {
    if (!this.motion) throw new Error('SdfDog used before init()')
    return this.motion
  }

  // ---- DogView -------------------------------------------------------------------------

  async init(ctx: DogRenderContext, dog: DogFile): Promise<void> {
    if (dog.shapes.length > MAX_SHAPES) {
      throw new Error(`SdfDog supports at most ${MAX_SHAPES} shapes, got ${dog.shapes.length}`)
    }
    this.camera = ctx.camera
    this.scene = ctx.scene
    this.uniforms.uPixel.value = 1 / ctx.renderer.getPixelRatio()
    this.populate(dog)

    // Soft contact shadow on the ground (drawn behind the dog).
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: makeShadowTexture(),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide // the camera's y-down mirror flips plane winding
      })
    )
    this.shadow.renderOrder = 0
    this.shadow.frustumCulled = false
    ctx.scene.add(this.shadow)

    // The ray-march quad: a flat sheet that follows the dog; the shader paints the dog on it.
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: SDF_VERT,
        fragmentShader: SDF_FRAG,
        uniforms: this.uniforms,
        transparent: true,
        side: THREE.DoubleSide // the camera's y-down mirror flips plane winding
      })
    )
    this.quad.renderOrder = 1
    this.quad.frustumCulled = false
    ctx.scene.add(this.quad)
    this.update(0)
  }

  /** Build the motion + per-shape shader data for a dog file (used by init and rebuild). */
  private populate(dog: DogFile): void {
    if (dog.shapes.length > MAX_SHAPES) {
      throw new Error(`SdfDog supports at most ${MAX_SHAPES} shapes, got ${dog.shapes.length}`)
    }
    const motion = new DogMotion(dog)
    this.motion = motion
    this.scene!.add(motion.root) // holds only bones and the fetch ball; the dog itself is the shader
    this.boneNodes = []
    this.offsets = []
    this.boundCx = []
    this.boundR = []
    // Per-shape constants: which bone it rides on, its offset, kind, sizes, blend, colour.
    dog.shapes.forEach((s, i) => {
      this.boneNodes.push(motion.boneNode(s.bone))
      this.offsets.push(new THREE.Matrix4().makeTranslation(s.offset[0], s.offset[1], s.offset[2]))
      this.uniforms.uKind.value[i] = KIND_INDEX[s.kind]
      this.uniforms.uParams.value[i]!.set(s.params[0] ?? 0, s.params[1] ?? 0, s.params[2] ?? 0)
      this.uniforms.uBlend.value[i] = s.blend
      this.uniforms.uColor.value[i]!.fromArray(s.color)
      this.uniforms.uDebug.value[i]!.fromArray(debugColor(i))
      const bound = shapeBound(s.kind, s.params)
      this.boundCx.push(bound.cx)
      this.boundR.push(bound.r)
    })
    this.uniforms.uCount.value = dog.shapes.length
    this.shadowW = dog.heightPx * 1.4
    this.buildSkeleton(dog)
  }

  /** Bones as lines and joints as dots, hidden until the 'landmarks' x-ray view is chosen. */
  private buildSkeleton(dog: DogFile): void {
    if (this.skeleton && this.scene) {
      this.scene.remove(this.skeleton)
      this.skelLines?.geometry.dispose()
      this.skelPoints?.geometry.dispose()
    }
    this.boneNames = dog.bones.map((b) => b.name)
    this.boneParent = dog.bones.map((b) => (b.parent ? this.boneNames.indexOf(b.parent) : -1))
    const n = this.boneNames.length
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3))
    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    this.skelLines = new THREE.LineSegments(
      lineGeo,
      // transparent = drawn in the same pass as the dog's transparent quad, and renderOrder 5 puts them on top
      new THREE.LineBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    )
    this.skelPoints = new THREE.Points(
      pointGeo,
      new THREE.PointsMaterial({
        color: 0xff2d95,
        size: 4,
        sizeAttenuation: false,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    )
    for (const o of [this.skelLines, this.skelPoints]) {
      o.frustumCulled = false
      o.renderOrder = 5
    }
    this.skeleton = new THREE.Group()
    this.skeleton.add(this.skelLines, this.skelPoints)
    this.skeleton.visible = this.showSkeleton
    this.scene!.add(this.skeleton)
  }

  private updateSkeleton(): void {
    if (!this.showSkeleton || !this.motion || !this.skelLines || !this.skelPoints) return
    const lines = this.skelLines.geometry.getAttribute('position') as THREE.BufferAttribute
    const points = this.skelPoints.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.boneNames.length; i++) {
      this.skelPos.setFromMatrixPosition(this.motion.boneNode(this.boneNames[i]!).matrixWorld)
      points.setXYZ(i, this.skelPos.x, this.skelPos.y, 150)
      const parent = this.boneParent[i]!
      if (parent >= 0) {
        lines.setXYZ(i * 2, points.getX(parent), points.getY(parent), 150)
        lines.setXYZ(i * 2 + 1, this.skelPos.x, this.skelPos.y, 150)
      } else {
        lines.setXYZ(i * 2, this.skelPos.x, this.skelPos.y, 150)
        lines.setXYZ(i * 2 + 1, this.skelPos.x, this.skelPos.y, 150)
      }
    }
    lines.needsUpdate = true
    points.needsUpdate = true
  }

  /**
   * Swap in a different dog file live (the editor uses this). Keeps the dog where it is and in
   * the same pose; the ball and any move in progress are dropped.
   */
  rebuild(dog: DogFile): void {
    if (!this.motion || !this.scene) throw new Error('SdfDog used before init()')
    const prev = this.motion.getState()
    this.scene.remove(this.motion.root)
    this.populate(dog)
    this.motion.placeAt(prev.x, prev.y)
    if (prev.pose !== 'moving' && prev.pose !== 'airborne') {
      void this.motion.setPose(prev.pose, { durationMs: 1 })
    }
    this.update(0)
  }

  update(dtMs: number): void {
    if (!this.motion || !this.camera || !this.quad || !this.shadow) return
    this.motion.update(dtMs) // poses the skeleton and refreshes world matrices

    // Per shape: the world -> shape-local matrix, and the world position of its bounding sphere.
    const inv = this.uniforms.uInv.value
    const bounds = this.uniforms.uBound.value
    const n = this.boneNodes.length
    for (let i = 0; i < n; i++) {
      this.shapeWorld.copy(this.boneNodes[i]!.matrixWorld).multiply(this.offsets[i]!)
      this.centre.set(this.boundCx[i]!, 0, 0).applyMatrix4(this.shapeWorld)
      this.bx[i] = this.centre.x
      this.by[i] = this.centre.y
      this.bz[i] = this.centre.z
      this.br[i] = this.boundR[i]!
      bounds[i]!.set(this.centre.x, this.centre.y, this.centre.z, this.boundR[i]!)
      inv[i]!.copy(this.shapeWorld).invert()
    }
    // One sphere around the whole dog: the shader rejects every ray outside it, and the quad is
    // sized to it (instead of a big square), so far fewer pixels are shaded at all.
    const dog = unionSphereInto(this.dogSphere, this.bx, this.by, this.bz, this.br, n)
    this.uniforms.uDog.value.set(dog.x, dog.y, dog.z, dog.r)
    this.camera.updateMatrixWorld()
    this.uniforms.uViewProj.value.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    )
    const size = dog.r * 2 + 8
    this.quad.position.set(dog.x, dog.y, 0)
    this.quad.scale.set(size, size, 1)

    this.updateSkeleton()

    // Shadow sits under the paws.
    const s = this.motion.getState()
    this.shadow.position.set(s.x, s.y + 2, -80)
    this.shadow.scale.set(this.shadowW, this.shadowW * 0.2, 1)
  }

  getBounds(): Rect {
    return this.m.getBounds()
  }

  hitTest(x: number, y: number): boolean {
    return this.m.hitTest(x, y)
  }

  setDebugView(mode: DogDebugView): void {
    const flags = debugFlags(mode)
    this.uniforms.uHard.value = flags.hardShapes ? 1 : 0
    this.showSkeleton = flags.skeleton
    if (this.skeleton) this.skeleton.visible = flags.skeleton
  }

  // ---- DogController: delegated to DogMotion --------------------------------------------

  setPose(pose: PoseName, opts?: { durationMs?: number }): Promise<void> {
    return this.m.setPose(pose, opts)
  }
  moveTo(x: number, y: number, gait: Gait): Promise<void> {
    return this.m.moveTo(x, y, gait)
  }
  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void> {
    return this.m.jumpTo(x, y, opts)
  }
  lookAt(target: Point | null): void {
    this.m.lookAt(target)
  }
  setLayer(params: { tailWag?: number; earPerk?: number; breathing?: number }): void {
    this.m.setLayer(params)
  }
  attachBall(attached: boolean): void {
    this.m.attachBall(attached)
  }
  getState(): DogState {
    return this.m.getState()
  }
  onEvent(cb: (e: DogEvent) => void): () => void {
    return this.m.onEvent(cb)
  }

  /** Not part of the contract: place the dog without animating (initial spawn). */
  placeAt(x: number, y: number): void {
    this.m.placeAt(x, y)
  }
}
