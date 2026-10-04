// X-ray debug views (DogView.setDebugView). 'shapes' draws every SDF primitive in its OWN flat
// colour with no blending; 'landmarks' (the contract's slot for it) shows the skeleton. The pure
// parts are tested here; the drawing itself is checked by eye.
import { describe, expect, it } from 'vitest'
import { debugColor, debugFlags } from './debug-view'

const dist = (a: number[], b: number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

describe('debugColor: one distinct colour per shape', () => {
  it('is a valid RGB colour in 0..1, and the same every time', () => {
    for (let i = 0; i < 40; i++) {
      const c = debugColor(i)
      expect(c).toHaveLength(3)
      for (const v of c) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      expect(debugColor(i)).toEqual(c)
    }
  })

  it('gives all 40 shapes colours that are clearly different from each other', () => {
    const colours = Array.from({ length: 40 }, (_, i) => debugColor(i))
    let min = Infinity
    for (let i = 0; i < colours.length; i++) {
      for (let j = i + 1; j < colours.length; j++)
        min = Math.min(min, dist(colours[i]!, colours[j]!))
    }
    expect(min).toBeGreaterThan(0.1)
  })

  it('makes neighbours in the list very different (adjacent body parts must not look alike)', () => {
    for (let i = 0; i < 39; i++) expect(dist(debugColor(i), debugColor(i + 1))).toBeGreaterThan(0.3)
  })

  it('never goes near-black or near-white, so every shape stays visible on any background', () => {
    for (let i = 0; i < 40; i++) {
      const lum =
        0.2126 * debugColor(i)[0]! + 0.7152 * debugColor(i)[1]! + 0.0722 * debugColor(i)[2]!
      expect(lum).toBeGreaterThan(0.12)
      expect(lum).toBeLessThan(0.92)
    }
  })
})

describe('debugFlags: what each view turns on', () => {
  it('normal shows neither the raw shapes nor the skeleton', () => {
    expect(debugFlags('normal')).toEqual({ hardShapes: false, skeleton: false })
  })
  it('shapes switches the shader to un-blended, per-shape colours', () => {
    expect(debugFlags('shapes')).toEqual({ hardShapes: true, skeleton: false })
  })
  it('landmarks shows the skeleton over the normal dog', () => {
    expect(debugFlags('landmarks')).toEqual({ hardShapes: false, skeleton: true })
  })
  it('coat (no splat coat yet) falls back to the normal view', () => {
    expect(debugFlags('coat')).toEqual({ hardShapes: false, skeleton: false })
  })
})
