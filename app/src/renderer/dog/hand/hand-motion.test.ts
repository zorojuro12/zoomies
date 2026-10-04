// Pet hand motion: a cartoon hand slides down from above, strokes the dog's head back and forth
// three times (with a little press on each stroke), and slides away. A pure function of time,
// in units of the dog's height (1 = as tall as the dog), relative to the dog's head.
import { describe, expect, it } from 'vitest'
import { HAND, HAND_SPOTS, createHandPose, handPoseAt } from './hand-motion'
import type { HandPose } from './hand-motion'

const at = (t: number): HandPose => handPoseAt(t, createHandPose())
const samples = (n = 480): HandPose[] =>
  Array.from({ length: n + 1 }, (_, i) => at((i / n) * HAND.durationMs))

describe('the whole petting', () => {
  it('takes about 2.6 seconds (the dog stays happy about that long)', () => {
    expect(HAND.durationMs).toBe(2600)
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

  it('the strokes ease in and out: the sweep starts from nothing and ends at nothing (no sudden start or stop)', () => {
    const strokeStart = HAND.enterMs
    const strokeEnd = HAND.durationMs - HAND.exitMs
    expect(Math.abs(at(strokeStart + 5).x)).toBeLessThan(0.002)
    expect(Math.abs(at(strokeEnd - 5).x)).toBeLessThan(0.002)
    // and the sweep is fully there in the middle
    const mid = samples().filter((p) => p.alpha === 1)
    expect(Math.max(...mid.map((p) => Math.abs(p.x)))).toBeGreaterThan(0.9 * HAND.strokeWidth)
  })

  it('lands softly: it dips a hair past its resting height and settles back', () => {
    let lowest = -Infinity
    for (let t = 1; t <= HAND.enterMs; t += 5) lowest = Math.max(lowest, at(t).y) // y is down
    expect(lowest).toBeGreaterThan(HAND.hoverY) // went a little past
    expect(lowest).toBeLessThan(HAND.hoverY + 0.05) // but only a little
    expect(at(HAND.enterMs).y).toBeCloseTo(HAND.hoverY, 6) // and is exactly there at the end
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
  /** The poses during the strokes themselves (after the slide in, before the slide out), 4 ms apart. */
  const strokeSamples = (): HandPose[] => {
    const out: HandPose[] = []
    for (let ms = HAND.enterMs; ms <= HAND.durationMs - HAND.exitMs; ms += 4) out.push(at(ms))
    return out
  }

  it('goes back and forth twice across the head, gently, never wider than a head', () => {
    const s = strokeSamples()
    let turns = 0
    for (let i = 2; i < s.length; i++) {
      const d1 = s[i - 1]!.x - s[i - 2]!.x
      const d2 = s[i]!.x - s[i - 1]!.x
      if (d1 * d2 < 0) turns++
    }
    // 2 full strokes = 4 turning points (give or take the ends)
    expect(turns).toBeGreaterThanOrEqual(3)
    expect(turns).toBeLessThanOrEqual(5)
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
      expect(Math.abs(b.y - a.y)).toBeLessThan(0.006) // the slide in (with its soft landing) is the fastest part
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

describe('where it pets: the head or the body', () => {
  const bodyAt = (ms: number): HandPose => handPoseAt(ms, createHandPose(), 'body')
  const bodyStrokes = (): HandPose[] => {
    const out: HandPose[] = []
    for (let ms = HAND.enterMs; ms <= HAND.durationMs - HAND.exitMs; ms += 4) out.push(bodyAt(ms))
    return out
  }

  it('the head is the default, and its numbers have not changed', () => {
    expect(HAND_SPOTS.head.hoverY).toBe(HAND.hoverY)
    expect(HAND_SPOTS.head.strokeWidth).toBe(HAND.strokeWidth)
    expect(handPoseAt(1200, createHandPose(), 'head')).toEqual(at(1200))
  })

  it('on the body it strokes along the torso: longer sweeps than on the head', () => {
    expect(HAND_SPOTS.body.strokeWidth).toBeGreaterThan(HAND_SPOTS.head.strokeWidth * 1.4)
    const xs = bodyStrokes().map((p) => p.x)
    expect(Math.max(...xs)).toBeGreaterThan(0.9 * HAND_SPOTS.body.strokeWidth)
    expect(Math.max(...xs)).toBeLessThanOrEqual(HAND_SPOTS.body.strokeWidth + 1e-9)
    expect(Math.min(...xs)).toBeLessThan(-0.9 * HAND_SPOTS.body.strokeWidth)
  })

  it("on the body it comes to rest at the body's own height and still lands, strokes and leaves like before", () => {
    expect(bodyAt(HAND.enterMs).y).toBeCloseTo(HAND_SPOTS.body.hoverY, 6)
    expect(bodyAt(1).visible).toBe(true)
    expect(bodyAt(HAND.durationMs).visible).toBe(false)
    const turns = bodyStrokes().reduce((n, p, i, a) => {
      if (i < 2) return n
      return (a[i - 1]!.x - a[i - 2]!.x) * (p.x - a[i - 1]!.x) < 0 ? n + 1 : n
    }, 0)
    expect(turns).toBeGreaterThanOrEqual(3)
    expect(turns).toBeLessThanOrEqual(5)
  })

  it('an unknown spot is treated as the head', () => {
    expect(handPoseAt(1200, createHandPose(), 'tail' as never)).toEqual(at(1200))
  })
})
