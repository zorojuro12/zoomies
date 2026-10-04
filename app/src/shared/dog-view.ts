// §3.5 How the dog plugs into the render loop — Daniel implements; Ansh hosts.
import type * as THREE from 'three'
import type { Rect } from './geometry'
import type { DogFile } from './dog-file'

export interface DogRenderContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
}

export type DogDebugView = 'normal' | 'landmarks' | 'shapes' | 'coat'

export interface DogView {
  init(ctx: DogRenderContext, dog: DogFile): Promise<void>
  /** Animation + transforms of shapes/splats. No allocation per frame. */
  update(dtMs: number): void
  /** Screen rect — used for region rendering and the click hit-test. */
  getBounds(): Rect
  hitTest(x: number, y: number): boolean
  /** X-ray views. */
  setDebugView(mode: DogDebugView): void
}
