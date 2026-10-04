// Where to put the pet hand: on the dog's head. Our SDF dog knows exactly where its head bone is; any
// other dog (the placeholder) gets an estimate from its screen box.
import { describe, expect, it } from 'vitest'
import { headAnchor } from './head-anchor'

describe('headAnchor', () => {
  it("uses the dog's own head position and height when it knows them", () => {
    const dog = {
      headPosition: (out: { x: number; y: number }) => {
        out.x = 640
        out.y = 410
      },
      dogHeightPx: () => 120,
      getBounds: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      getState: () => ({ x: 1, y: 2, facing: 1 as const })
    }
    const out = { x: 0, y: 0 }
    expect(headAnchor(dog, out)).toBe(120)
    expect(out).toEqual({ x: 640, y: 410 })
  })

  it('without that, estimates from the screen box: the head is near the top, a little toward where it faces', () => {
    const bounds = { x: 400, y: 200, w: 270, h: 150 } // heightPx = h / 1.25 = 120
    const right = {
      getBounds: () => bounds,
      getState: () => ({ x: 500, y: 330, facing: 1 as const })
    }
    const left = {
      getBounds: () => bounds,
      getState: () => ({ x: 500, y: 330, facing: -1 as const })
    }
    const a = { x: 0, y: 0 }
    const b = { x: 0, y: 0 }
    expect(headAnchor(right, a)).toBeCloseTo(120, 6)
    expect(headAnchor(left, b)).toBeCloseTo(120, 6)
    expect(a.y).toBeCloseTo(330 - 0.9 * 120, 6) // near the top of the dog (y is down)
    expect(a.x).toBeGreaterThan(500)
    expect(b.x).toBeLessThan(500)
    expect(a.x - 500).toBeCloseTo(500 - b.x, 6) // mirror images
  })

  it('a dog that reports garbage gets a harmless answer, never NaN', () => {
    const dog = {
      headPosition: (out: { x: number; y: number }) => {
        out.x = Number.NaN
        out.y = 5
      },
      dogHeightPx: () => Number.NaN,
      getBounds: () => ({ x: 400, y: 200, w: 270, h: 150 }),
      getState: () => ({ x: 500, y: 330, facing: 1 as const })
    }
    const out = { x: 0, y: 0 }
    const h = headAnchor(dog, out)
    expect(Number.isFinite(h) && Number.isFinite(out.x) && Number.isFinite(out.y)).toBe(true)
    expect(h).toBeGreaterThan(0)
  })
})
