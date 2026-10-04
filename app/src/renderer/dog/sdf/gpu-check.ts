// A guard against the silent black dog. On a GPU or driver with too few shader uniforms, or when a
// shader fails to compile, three.js only logs to the console and draws nothing. These checks turn
// that into an error message the host can catch (and answer with the placeholder dog).
import type * as THREE from 'three'

/** vec4 slots the dog's fragment shader uses (6 vec4 arrays + a mat4 array, 40 shapes, plus extras). */
export const MIN_FRAGMENT_UNIFORMS = 420
/** vec4 slots the fur vertex shader uses (a mat4 array of 40, plus extras). */
export const MIN_VERTEX_UNIFORMS = 170

export interface GpuLimits {
  maxFragmentUniforms: number
  maxVertexUniforms: number
}

/** A message if this GPU cannot run the dog shaders, else null. */
export function gpuProblem(limits: GpuLimits): string | null {
  if (limits.maxFragmentUniforms < MIN_FRAGMENT_UNIFORMS) {
    return `GPU allows only ${limits.maxFragmentUniforms} fragment uniform vectors, the dog needs ${MIN_FRAGMENT_UNIFORMS}`
  }
  if (limits.maxVertexUniforms < MIN_VERTEX_UNIFORMS) {
    return `GPU allows only ${limits.maxVertexUniforms} vertex uniform vectors, the fur needs ${MIN_VERTEX_UNIFORMS}`
  }
  return null
}

/** Compile everything in the scene now; a message if any shader failed, else null. */
export function shaderProblem(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): string | null {
  const previous = renderer.debug.onShaderError
  let failed = false
  renderer.debug.onShaderError = (...args) => {
    failed = true
    previous?.(...args)
  }
  try {
    renderer.compile(scene, camera)
  } finally {
    renderer.debug.onShaderError = previous
  }
  return failed ? 'a dog shader failed to compile on this GPU' : null
}
