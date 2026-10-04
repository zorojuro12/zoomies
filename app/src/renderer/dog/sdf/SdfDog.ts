// SdfDog — the dog drawn as ray-marched, smoothly blended SDF shapes (see sdf-shader.ts).
// Implements DogView + DogController (contracts §3.4, §3.5).
//
// TEMPORARY BRIDGE: motion (poses, walk, jump, look-at) still comes from the PlaceholderDog,
// which we keep alive but hide; each frame we read its bone transforms and hand them to the
// shader. A later phase replaces this with our own skeleton + gait.
import * as THREE from 'three'
import type { DogFile, ShapeKind } from '@shared/dog-file'
import type { DogController, DogEvent, DogState, Gait, PoseName } from '@shared/dog-controller'
import type { DogDebugView, DogRenderContext, DogView } from '@shared/dog-view'
import type { Point, Rect } from '@shared/geometry'
import { PlaceholderDog } from '../placeholder/placeholder-dog'
import { MAX_SHAPES, SDF_FRAG, SDF_VERT } from './sdf-shader'

const KIND_INDEX: Record<ShapeKind, number> = { sphere: 0, capsule: 1, ellipsoid: 2, roundCone: 3 }
/** Three-quarter view: how far the dog is turned toward the viewer (radians, ~25°). */
const VIEW_YAW = (25 * Math.PI) / 180
/** Extra room around the dog's bounds for the ray-march quad. */
const QUAD_MARGIN = 80

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
  private readonly motion = new PlaceholderDog()
  private root: THREE.Object3D | null = null
  private camera: THREE.OrthographicCamera | null = null
  private quad: THREE.Mesh | null = null
  private shadow: THREE.Mesh | null = null
  private boneNodes: THREE.Object3D[] = []
  private offsets: THREE.Matrix4[] = []
  private readonly uniforms = {
    uCount: { value: 0 },
    uKind: { value: new Array<number>(MAX_SHAPES).fill(0) },
    uParams: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector3()) },
    uBlend: { value: new Array<number>(MAX_SHAPES).fill(0) },
    uColor: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector3()) },
    uInv: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Matrix4()) },
    uViewProj: { value: new THREE.Matrix4() },
    uPixel: { value: 1 }
  }

  // ---- DogView -------------------------------------------------------------------------

  async init(ctx: DogRenderContext, dog: DogFile): Promise<void> {
    if (dog.shapes.length > MAX_SHAPES) {
      throw new Error(`SdfDog supports at most ${MAX_SHAPES} shapes, got ${dog.shapes.length}`)
    }
    const before = new Set(ctx.scene.children)
    await this.motion.init(ctx, dog)
    this.root = ctx.scene.children.find((c) => !before.has(c)) ?? null
    if (!this.root) throw new Error('SdfDog: could not find the placeholder dog in the scene')
    this.camera = ctx.camera

    // Hide the placeholder's balls and sticks (keep its ball, radius 7, for the fetch toy).
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const g = o.geometry
      const isBall = g instanceof THREE.SphereGeometry && g.parameters.radius === 7
      if (!isBall) o.visible = false
    })

    // Per-shape constants: which bone it rides on, its offset, kind, sizes, blend, colour.
    dog.shapes.forEach((s, i) => {
      const bone = this.root!.getObjectByName(s.bone)
      if (!bone) throw new Error(`SdfDog: bone ${s.bone} not found`)
      this.boneNodes.push(bone)
      this.offsets.push(new THREE.Matrix4().makeTranslation(s.offset[0], s.offset[1], s.offset[2]))
      this.uniforms.uKind.value[i] = KIND_INDEX[s.kind]
      this.uniforms.uParams.value[i]!.set(s.params[0] ?? 0, s.params[1] ?? 0, s.params[2] ?? 0)
      this.uniforms.uBlend.value[i] = s.blend
      this.uniforms.uColor.value[i]!.fromArray(s.color)
    })
    this.uniforms.uCount.value = dog.shapes.length
    this.uniforms.uPixel.value = 1 / ctx.renderer.getPixelRatio()

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

  update(dtMs: number): void {
    if (!this.root || !this.camera || !this.quad || !this.shadow) return
    this.motion.update(dtMs)

    // Three-quarter view: turn the dog a little toward the viewer instead of a flat profile.
    // (The placeholder sets rotation.y to 0 or π for facing right/left; we add the tilt.)
    this.root.rotation.y = this.motion.getState().facing === 1 ? -VIEW_YAW : Math.PI + VIEW_YAW
    this.root.updateMatrixWorld(true)

    // Shader needs world -> shape-local matrices.
    const inv = this.uniforms.uInv.value
    for (let i = 0; i < this.boneNodes.length; i++) {
      inv[i]!.copy(this.boneNodes[i]!.matrixWorld).multiply(this.offsets[i]!).invert()
    }
    this.camera.updateMatrixWorld()
    this.uniforms.uViewProj.value.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    )

    // Keep the quad centred on the dog, big enough to hold it.
    const b = this.motion.getBounds()
    const size = Math.max(b.w, b.h) + QUAD_MARGIN * 2
    this.quad.position.set(b.x + b.w / 2, b.y + b.h / 2, 0)
    this.quad.scale.set(size, size, 1)

    // Shadow sits under the paws.
    const s = this.motion.getState()
    this.shadow.position.set(s.x, s.y + 2, -80)
    this.shadow.scale.set(150, 30, 1)
  }

  getBounds(): Rect {
    return this.motion.getBounds()
  }

  hitTest(x: number, y: number): boolean {
    return this.motion.hitTest(x, y)
  }

  setDebugView(_mode: DogDebugView): void {
    // X-ray views come later (plan P3).
  }

  // ---- DogController: delegated to the motion bridge ------------------------------------

  setPose(pose: PoseName, opts?: { durationMs?: number }): Promise<void> {
    return this.motion.setPose(pose, opts)
  }
  moveTo(x: number, y: number, gait: Gait): Promise<void> {
    return this.motion.moveTo(x, y, gait)
  }
  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void> {
    return this.motion.jumpTo(x, y, opts)
  }
  lookAt(target: Point | null): void {
    this.motion.lookAt(target)
  }
  setLayer(params: { tailWag?: number; earPerk?: number; breathing?: number }): void {
    this.motion.setLayer(params)
  }
  attachBall(attached: boolean): void {
    this.motion.attachBall(attached)
  }
  getState(): DogState {
    return this.motion.getState()
  }
  onEvent(cb: (e: DogEvent) => void): () => void {
    return this.motion.onEvent(cb)
  }

  /** Not part of the contract: place the dog without animating (initial spawn). */
  placeAt(x: number, y: number): void {
    this.motion.placeAt(x, y)
  }
}
