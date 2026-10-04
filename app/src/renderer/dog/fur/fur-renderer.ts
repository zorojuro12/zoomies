// FurCoat — draws the fur splats (see fur.ts). Each splat is one instanced quad: a soft strand rooted
// on the dog's surface, pointing along its normal as seen on screen, lit like the body, and drawn
// AFTER the dog so strands can stick out past the outline (that is what makes it look furry).
//
// The splat moves with the bones for free: its position is "its shape's current matrix × a fixed
// local position", and the vertex shader reads that matrix from the uFwd uniform array, which
// SdfDog refreshes every frame. The depth buffer (written by the SDF dog) hides strands that are on
// the far side of the body. No sorting: strands are tiny and alike, so order errors are invisible.
import * as THREE from 'three'
import type { FurData } from './fur'
import { MAX_SHAPES } from '../sdf/sdf-shader'

const VERT = /* glsl */ `
#define MAX_SHAPES ${MAX_SHAPES}
uniform mat4 uFwd[MAX_SHAPES];   // each shape's current world matrix
uniform float uLength;           // strand length in px
uniform float uWidth;            // strand half-width in px
uniform vec2 uFlow;              // which way the fur lies on screen (the dog's backward direction)
attribute float aShape;
attribute vec3 aLocal;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aSize;
varying vec2 vUv;
varying vec3 vColor;
varying float vLight;
void main() {
  mat4 m = uFwd[int(aShape + 0.5)];
  vec3 root = (m * vec4(aLocal, 1.0)).xyz;
  vec3 n = normalize(mat3(m) * aNormal);

  // The strand lies along the normal as it appears on screen. A normal pointing almost straight at
  // (or away from) the viewer has no screen direction: use a short strand hanging down (y is down).
  vec2 dir = n.xy;
  float facing = length(dir);
  vec2 out2 = facing > 0.2 ? dir / facing : vec2(0.0, 1.0);
  // Groomed fur lies back along the body instead of standing straight out: blend the outward
  // direction with the flow direction, with a little per-strand wobble so it does not look combed.
  float wobble = (aSize - 1.0) * 0.9;
  vec2 flow = vec2(uFlow.x * cos(wobble) - uFlow.y * sin(wobble), uFlow.x * sin(wobble) + uFlow.y * cos(wobble));
  dir = normalize(out2 * 0.55 + flow);
  float len = uLength * aSize * mix(0.5, 1.0, clamp(facing * 1.6, 0.0, 1.0));
  vec2 side = vec2(-dir.y, dir.x);

  // position.x is -1..1 across the strand, position.y is 0 (root) .. 1 (tip)
  vec2 xy = root.xy + dir * (position.y * len) + side * (position.x * uWidth * aSize);
  // Nudge toward the viewer so a strand on the visible side is not buried by the body's own depth.
  vec3 world = vec3(xy, root.z + 2.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);

  vUv = position.xy;
  vColor = aColor;
  // The same key light as the body shader (world y is down, so "up" is -y).
  vec3 L = normalize(vec3(-0.5, -0.8, 0.7));
  float wrap = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
  vLight = 0.5 + 0.7 * wrap * wrap * (3.0 - 2.0 * wrap);
}
`

/** Strands are darker where they leave the skin and lighter at the tip (hair catches the light). */
export const FUR_ROOT_SHADE = 0.82
export const FUR_TIP_SHADE = 1.12

const FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vColor;
varying float vLight;
void main() {
  // A soft strand: Gaussian across, strongest at the root and fading toward the tip.
  float across = vUv.x;
  float along = vUv.y;
  float a = exp(-across * across * 2.6) * (1.0 - along * along * 0.85) * uOpacity;
  if (a < 0.01) discard;
  float shade = mix(${FUR_ROOT_SHADE.toFixed(3)}, ${FUR_TIP_SHADE.toFixed(3)}, along);
  gl_FragColor = vec4(vColor * vLight * shade, a);
  #include <colorspace_fragment>
}
`

export interface FurLook {
  /** Strand length in px (for a dog about 108 px tall). */
  length: number
  /** Strand half-width in px. */
  width: number
  opacity: number
}

export const DEFAULT_FUR_LOOK: FurLook = { length: 3.4, width: 1.1, opacity: 0.8 }

export class FurCoat {
  readonly mesh: THREE.Mesh
  private readonly uniforms = {
    uFwd: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Matrix4()) },
    uLength: { value: 5 },
    uWidth: { value: 1.5 },
    uFlow: { value: new THREE.Vector2(-1, 0) },
    uOpacity: { value: 0.85 }
  }

  /** `scale` is dog height / 108, so the strands keep their proportion on bigger or smaller dogs. */
  constructor(fur: FurData, scale: number, look: FurLook = DEFAULT_FUR_LOOK) {
    const geo = new THREE.InstancedBufferGeometry()
    // one quad: x in [-1, 1] across, y in [0, 1] from root to tip
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3)
    )
    geo.setIndex([0, 1, 2, 0, 2, 3])
    const n = fur.count
    geo.setAttribute(
      'aShape',
      new THREE.InstancedBufferAttribute(Float32Array.from(fur.shape.subarray(0, n)), 1)
    )
    geo.setAttribute('aLocal', new THREE.InstancedBufferAttribute(fur.local.slice(0, n * 3), 3))
    geo.setAttribute('aNormal', new THREE.InstancedBufferAttribute(fur.normal.slice(0, n * 3), 3))
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(fur.color.slice(0, n * 3), 3))
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(fur.size.slice(0, n), 1))
    geo.instanceCount = n

    this.uniforms.uLength.value = look.length * scale
    this.uniforms.uWidth.value = look.width * scale
    this.uniforms.uOpacity.value = look.opacity
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.uniforms,
        transparent: true,
        depthTest: true, // hidden behind the SDF body where the body is in front
        depthWrite: false,
        side: THREE.DoubleSide // the camera's y-down mirror flips winding
      })
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2 // after the SDF quad (1), before the debug overlay (5)
  }

  /** Per-shape world matrices for this frame (same order as the dog file's shapes). */
  get shapeMatrices(): THREE.Matrix4[] {
    return this.uniforms.uFwd.value
  }

  /** Which way the fur lies on screen (a unit vector: the dog's backward direction). */
  setFlow(x: number, y: number): void {
    const len = Math.hypot(x, y)
    // facing straight toward/away from the viewer has no screen direction: let it hang down
    if (len < 0.15) this.uniforms.uFlow.value.set(0, 1)
    else this.uniforms.uFlow.value.set(x / len, y / len)
  }

  set visible(v: boolean) {
    this.mesh.visible = v
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
