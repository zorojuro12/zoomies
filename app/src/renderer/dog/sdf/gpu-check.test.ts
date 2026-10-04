// A guard against the silent black dog: on a GPU/driver with too few shader uniforms, or when the
// shader fails to compile, three.js only logs to the console and draws nothing. These checks turn
// that into an error the host can catch and answer with the placeholder dog.
import { describe, expect, it } from 'vitest'
import { MIN_FRAGMENT_UNIFORMS, MIN_VERTEX_UNIFORMS, gpuProblem, shaderProblem } from './gpu-check'

describe('gpuProblem', () => {
  it('is fine on a normal desktop GPU (1024 fragment, 4096 vertex vectors, as ANGLE/D3D11 reports)', () => {
    expect(gpuProblem({ maxFragmentUniforms: 1024, maxVertexUniforms: 4096 })).toBeNull()
  })
  it('accepts exactly the minimum', () => {
    expect(
      gpuProblem({
        maxFragmentUniforms: MIN_FRAGMENT_UNIFORMS,
        maxVertexUniforms: MIN_VERTEX_UNIFORMS
      })
    ).toBeNull()
  })
  it('names the fragment limit when it is too small', () => {
    const p = gpuProblem({
      maxFragmentUniforms: MIN_FRAGMENT_UNIFORMS - 1,
      maxVertexUniforms: 4096
    })
    expect(p).toMatch(/fragment/i)
  })
  it('names the vertex limit when it is too small', () => {
    const p = gpuProblem({ maxFragmentUniforms: 1024, maxVertexUniforms: MIN_VERTEX_UNIFORMS - 1 })
    expect(p).toMatch(/vertex/i)
  })
  it('the minimums cover what the shaders really use (40 shapes: 6 vec4 arrays + a mat4 array in the fragment shader; one mat4 array in the vertex shader)', () => {
    expect(MIN_FRAGMENT_UNIFORMS).toBeGreaterThanOrEqual(40 * 6 + 40 * 4)
    expect(MIN_VERTEX_UNIFORMS).toBeGreaterThanOrEqual(40 * 4)
  })
})

describe('shaderProblem', () => {
  type FakeRenderer = {
    debug: { onShaderError: ((...a: unknown[]) => void) | null }
    compile: () => void
  }
  const fake = (fails: boolean): FakeRenderer => {
    const r: FakeRenderer = {
      debug: { onShaderError: null },
      compile: () => {
        if (fails) r.debug.onShaderError?.({}, {}, {}, {})
      }
    }
    return r
  }
  const run = (r: FakeRenderer): string | null =>
    shaderProblem(r as never, {} as never, {} as never)

  it('returns null when everything compiles', () => {
    expect(run(fake(false))).toBeNull()
  })
  it('returns a message when a shader fails to compile', () => {
    expect(run(fake(true))).toMatch(/shader/i)
  })
  it("puts back the renderer's own error handler afterwards", () => {
    const r = fake(false)
    const mine = (): void => {}
    r.debug.onShaderError = mine
    run(r)
    expect(r.debug.onShaderError).toBe(mine)
  })
})
