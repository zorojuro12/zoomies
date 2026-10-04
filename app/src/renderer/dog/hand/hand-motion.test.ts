// Pet hand motion: a cartoon hand slides down from above, strokes the dog's head back and forth
// three times (with a little press on each stroke), and slides away. A pure function of time,
// in units of the dog's height (1 = as tall as the dog), relative to the dog's head.
import { describe, expect, it } from 'vitest'
import { HAND, createHandPose, handPoseAt } from './hand-motion'
import type { HandPose } from './hand-motion'

const at = (t: number): HandPose => handPoseAt(t, createHandPose())
const samples = (n = 480): HandPose[] =>
  Array.from({ length: n + 1 }, (_, i) => at((i / n) * HAND.durationMs))

describe('the whole petting', () => {
  it("takes about 2.4 seconds (as long as the dog's happy reaction)", () => {
    expect(HAND.durationMs).toBe(2400)
  })

  it('is not there before it starts or after it ends', () => {
    for (const t of [-100, 0, HAND.durationMs, HAND.durationMs + 500]) {
      const p = at(t)
      expect(p.alpha).toBe(0)
      expect(p.visible).toBe(false)
    }
  })

  it('is fully there while it strokes (the middle of the petting)', () => {
    const p = at(HAND.durationMs / 2)
    expect(p.visible).toBe(true)
    expect(p.alpha).toBe(1)
  })

  it('fades in while it slides down and out while it slides away', () => {
    expect(at(HAND.enterMs * 0.5).alpha).toBeGreaterThan(0)
    expect(at(HAND.enterMs * 0.5).alpha).toBeLessThan(1)
    expect(at(HAND.enterMs + 10).alpha).toBe(1)
    const tail = HAND.durationMs - HAND.exitMs * 0.5
    expect(at(tail).alpha).toBeGreaterThan(0)
    expect(at(tail).alpha).toBeLessThan(1)
  })
})

describe('the slide in and out', () => {
  it('starts high and to the side (off the head) and arrives above the head', () => {
    const start = at(1)
    const arrived = at(HAND.enterMs)
    expect(start.y).toBeLessThan(arrived.y - 0.3) // y is down: smaller = higher
    expect(Math.abs(start.x)).toBeGreaterThan(Math.abs(arrived.x))
    expect(arrived.y).toBeCloseTo(HAND.hoverY, 1)
  })

  it('leaves the way it came: high and to the side again', () => {
    const leaving = at(HAND.durationMs - 1)
    expect(leaving.y).toBeLessThan(HAND.hoverY - 0.3)
    expect(Math.abs(leaving.x)).toBeGreaterThan(0.3)
  })
})

describe('the strokes', () => {
  const strokeSamples = (): HandPose[] =>
    samples()
      .filter((p) => p.alpha === 1 && p.visible)
      .filter((_, i, a) => i > 2 && i < a.length - 2)

  it('goes back and forth three times across the head, never wider than a head', () => {
    const s = strokeSamples()
    let turns = 0
    for (let i = 2; i < s.length; i++) {
      const d1 = s[i - 1]!.x - s[i - 2]!.x
      const d2 = s[i]!.x - s[i - 1]!.x
      if (d1 * d2 < 0) turns++
    }
    // 3 full strokes = 6 turning points (give or take the ends)
    expect(turns).toBeGreaterThanOrEqual(5)
    expect(turns).toBeLessThanOrEqual(7)
    for (const p of s) expect(Math.abs(p.x)).toBeLessThanOrEqual(HAND.strokeWidth + 1e-9)
  })

  it('actually sweeps a good way across (at least 70% of the stroke width each side)', () => {
    const s = strokeSamples()
    expect(Math.max(...s.map((p) => p.x))).toBeGreaterThan(0.7 * HAND.strokeWidth)
    expect(Math.min(...s.map((p) => p.x))).toBeLessThan(-0.7 * HAND.strokeWidth)
  })

  it('presses down a little on each stroke (the height dips and comes back)', () => {
    const ys = strokeSamples().map((p) => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.01)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.1)
  })

  it('tilts with the stroke, a few degrees only', () => {
    const rots = strokeSamples().map((p) => p.rot)
    expect(Math.max(...rots)).toBeGreaterThan(0.03)
    expect(Math.min(...rots)).toBeLessThan(-0.03)
    expect(Math.max(...rots.map(Math.abs))).toBeLessThan(0.3)
  })
})

describe('smooth', () => {
  it('no jumps: between two samples a millisecond apart nothing moves more than a hair', () => {
    for (let t = 0; t < HAND.durationMs; t += 1) {
      const a = at(t)
      const b = at(t + 1)
      if (!a.visible && !b.visible) continue
      expect(Math.abs(b.x - a.x)).toBeLessThan(0.004)
      expect(Math.abs(b.y - a.y)).toBeLessThan(0.004)
      expect(Math.abs(b.rot - a.rot)).toBeLessThan(0.004)
    }
  })

  it('every number is finite, always', () => {
    for (const p of samples(200)) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.rot)).toBe(true)
      expect(p.alpha).toBeGreaterThanOrEqual(0)
      expect(p.alpha).toBeLessThanOrEqual(1)
    }
  })

  it('writes into the object it is given and returns it (no allocation per frame)', () => {
    const out = createHandPose()
    expect(handPoseAt(1000, out)).toBe(out)
  })

  it('garbage time (NaN) means "not there"', () => {
    expect(at(Number.NaN).visible).toBe(false)
  })
})
