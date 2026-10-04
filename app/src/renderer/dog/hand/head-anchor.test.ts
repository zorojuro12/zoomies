// Where to put the pet hand: on the dog's head. Our SDF dog knows exactly where its head bone is; any
// other dog (the placeholder) gets an estimate from its screen box.
import { describe, expect, it } from 'vitest'
import { bodyAnchor, handAnchor, headAnchor } from './head-anchor'
import type { HeadAnchorDog } from './head-anchor'

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

describe('bodyAnchor (the stomach and back of a dog lying down)', () => {
  it("uses the dog's own body position when it knows it", () => {
    const dog = {
      bodyPosition: (out: { x: number; y: number }) => {
        out.x = 700
        out.y = 520
      },
      dogHeightPx: () => 110,
      getBounds: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      getState: () => ({ x: 1, y: 2, facing: 1 as const })
    }
    const out = { x: 0, y: 0 }
    expect(bodyAnchor(dog, out)).toBe(110)
    // the hand rests a little toward the dog's back end (away from its face), at the body's height
    expect(out.x).toBeCloseTo(700 - 0.2 * 110, 6)
    expect(out.y).toBe(520)
  })

  it('without that, estimates from the screen box: the middle of the dog, about a third of its height up', () => {
    const dog = {
      getBounds: () => ({ x: 400, y: 200, w: 270, h: 150 }),
      getState: () => ({ x: 500, y: 330, facing: 1 as const })
    }
    const out = { x: 0, y: 0 }
    expect(bodyAnchor(dog, out)).toBeCloseTo(120, 6)
    expect(out.x).toBeCloseTo(500 - 0.2 * 120, 6) // toward the back end of a dog facing right
    expect(out.y).toBeCloseTo(330 - 0.35 * 120, 6)
  })

  it('the back end is on the opposite side to where the dog faces (mirror images)', () => {
    const mk = (facing: 1 | -1): HeadAnchorDog => ({
      getBounds: () => ({ x: 400, y: 200, w: 270, h: 150 }),
      getState: () => ({ x: 500, y: 330, facing })
    })
    const r = { x: 0, y: 0 }
    const l = { x: 0, y: 0 }
    bodyAnchor(mk(1), r)
    bodyAnchor(mk(-1), l)
    expect(r.x).toBeLessThan(500)
    expect(l.x).toBeGreaterThan(500)
    expect(500 - r.x).toBeCloseTo(l.x - 500, 6)
  })

  it('handAnchor picks the head or the body', () => {
    const dog = {
      headPosition: (o: { x: number; y: number }) => {
        o.x = 1
        o.y = 2
      },
      bodyPosition: (o: { x: number; y: number }) => {
        o.x = 3
        o.y = 4
      },
      dogHeightPx: () => 100,
      getBounds: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      getState: () => ({ x: 0, y: 0, facing: 1 as const })
    }
    const out = { x: 0, y: 0 }
    handAnchor(dog, 'head', out)
    expect(out).toEqual({ x: 1, y: 2 })
    handAnchor(dog, 'body', out)
    expect(out.x).toBeCloseTo(3 - 0.2 * 100, 6)
    expect(out.y).toBe(4)
  })

  it('garbage from the body position gives a harmless estimate, never NaN', () => {
    const dog = {
      bodyPosition: (o: { x: number; y: number }) => {
        o.x = Number.NaN
        o.y = Number.NaN
      },
      getBounds: () => ({ x: 400, y: 200, w: 270, h: 150 }),
      getState: () => ({ x: 500, y: 330, facing: -1 as const })
    }
    const out = { x: 0, y: 0 }
    const h = bodyAnchor(dog, out)
    expect(Number.isFinite(h) && Number.isFinite(out.x) && Number.isFinite(out.y)).toBe(true)
  })
})
