// FurCoat: the pure, GPU-free behaviour (the picture itself is checked by eye).
import { describe, expect, it } from 'vitest'
import { buildDog } from '../spec/build-dog'
import { sampleFur } from './fur'
import { FurCoat } from './fur-renderer'

const dog = buildDog({})
const fur = sampleFur(dog, 300, 1)

describe('FurCoat', () => {
  it('draws one instance per splat', () => {
    const coat = new FurCoat(fur, 1)
    expect((coat.mesh.geometry as unknown as { instanceCount: number }).instanceCount).toBe(300)
  })

  it('gives the shader one matrix slot per possible shape', () => {
    expect(new FurCoat(fur, 1).shapeMatrices.length).toBeGreaterThanOrEqual(dog.shapes.length)
  })

  it('normalises the flow direction: any non-zero vector becomes a unit vector', () => {
    const coat = new FurCoat(fur, 1)
    coat.setFlow(3, 4)
    const flow = (
      coat.mesh.material as unknown as { uniforms: { uFlow: { value: { x: number; y: number } } } }
    ).uniforms.uFlow.value
    expect(flow.x).toBeCloseTo(0.6)
    expect(flow.y).toBeCloseTo(0.8)
  })

  it('lets the fur hang down when the dog faces straight toward or away from the viewer (no screen direction)', () => {
    const coat = new FurCoat(fur, 1)
    coat.setFlow(0.01, 0)
    const flow = (
      coat.mesh.material as unknown as { uniforms: { uFlow: { value: { x: number; y: number } } } }
    ).uniforms.uFlow.value
    expect(flow.x).toBe(0)
    expect(flow.y).toBe(1)
  })

  it('scales the strand size with the dog (a dog twice as tall has twice as long fur)', () => {
    const uniforms = (c: FurCoat): { uLength: { value: number } } =>
      (c.mesh.material as unknown as { uniforms: { uLength: { value: number } } }).uniforms
    expect(uniforms(new FurCoat(fur, 2)).uLength.value).toBeCloseTo(
      2 * uniforms(new FurCoat(fur, 1)).uLength.value
    )
  })

  it('can be hidden and shown, and disposed without throwing', () => {
    const coat = new FurCoat(fur, 1)
    coat.visible = false
    expect(coat.mesh.visible).toBe(false)
    coat.visible = true
    expect(coat.mesh.visible).toBe(true)
    expect(() => coat.dispose()).not.toThrow()
  })
})
