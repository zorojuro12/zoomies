// Gait: WHERE each foot should be at each moment of a stride. A leg cycles through
//   stance (foot on the ground, moving BACKWARD relative to the body at exactly the body's speed,
//   so it does not slide in the world) and swing (foot lifts, moves forward, plants again).
// phase runs 0..1 over one stride; the first `duty` of it is stance.
import { describe, expect, it } from 'vitest'
import { footLift, footOffsetX, GAITS, legPhase, stanceLength, strideHz } from './gait'

describe('stanceLength and strideHz', () => {
  it('stance length = distance the body travels during stance: speed*duty/hz = 100*0.6/2 = 30', () => {
    expect(stanceLength(100, 0.6, 2)).toBeCloseTo(30)
  })
  it('stride frequency = speed / stride length: 110 px/s with a 55 px stride = 2 strides/s', () => {
    expect(strideHz(110, 55)).toBeCloseTo(2)
  })
  it('stride frequency is 0 when the stride length is 0 (never divides by zero)', () => {
    expect(strideHz(100, 0)).toBe(0)
  })
})

describe('footOffsetX: horizontal foot position relative to its neutral spot (+ = forward)', () => {
  const S = 30 // stance length from the case above: 100 px/s, duty 0.6, 2 strides/s
  const duty = 0.6
  it('starts a stance at +S/2 (in front), ends it at -S/2 (behind), passes 0 in the middle', () => {
    expect(footOffsetX(0, duty, S)).toBeCloseTo(15)
    expect(footOffsetX(0.3, duty, S)).toBeCloseTo(0)
    expect(footOffsetX(0.6, duty, S)).toBeCloseTo(-15)
  })
  it('does not slide: during stance the foot moves back exactly as fast as the body moves forward', () => {
    // body speed 100 px/s, 2 strides/s: Δphase 0.1 = 0.05 s = 5 px of body travel
    const dx = footOffsetX(0.2, duty, S) - footOffsetX(0.1, duty, S)
    expect(dx).toBeCloseTo(-5)
    const dx2 = footOffsetX(0.5, duty, S) - footOffsetX(0.4, duty, S)
    expect(dx2).toBeCloseTo(-5)
  })
  it('swing brings the foot from -S/2 back to +S/2 and is continuous at both ends', () => {
    expect(footOffsetX(0.6 + 1e-9, duty, S)).toBeCloseTo(-15, 4)
    expect(footOffsetX(1 - 1e-9, duty, S)).toBeCloseTo(15, 4)
    expect(footOffsetX(0, duty, S)).toBeCloseTo(footOffsetX(1, duty, S))
  })
  it('swing moves forward only (never backward) and is monotonic', () => {
    let prev = footOffsetX(0.61, duty, S)
    for (let p = 0.62; p < 1; p += 0.01) {
      const v = footOffsetX(p, duty, S)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })
  it('wraps: phase 1.25 behaves like 0.25', () => {
    expect(footOffsetX(1.25, duty, S)).toBeCloseTo(footOffsetX(0.25, duty, S))
  })
})

describe('footLift: how high the foot is off the ground (>= 0)', () => {
  const H = 8
  const duty = 0.6
  it('is 0 for the whole stance (the foot is planted)', () => {
    for (const p of [0, 0.1, 0.3, 0.59]) expect(footLift(p, duty, H)).toBe(0)
  })
  it('peaks at the middle of the swing with exactly the lift height: p = 0.8 -> 8', () => {
    expect(footLift(0.8, duty, H)).toBeCloseTo(8)
  })
  it('is 0 again just before the foot lands, and never negative', () => {
    expect(footLift(0.999999, duty, H)).toBeCloseTo(0, 3)
    for (let p = 0; p < 1; p += 0.013) expect(footLift(p, duty, H)).toBeGreaterThanOrEqual(0)
  })
})

describe('legPhase and the gait table', () => {
  it('adds the leg offset and wraps into 0..1: 0.8 + 0.5 = 0.3', () => {
    expect(legPhase(0.8, 0.5)).toBeCloseTo(0.3)
    expect(legPhase(0.1, 0)).toBeCloseTo(0.1)
  })
  it('a trot moves diagonal pairs together: front-left with rear-right, half a stride from the other pair', () => {
    const t = GAITS.trot.offsets
    expect(t.fl).toBeCloseTo(t.rr)
    expect(t.fr).toBeCloseTo(t.rl)
    expect(Math.abs(t.fl - t.fr)).toBeCloseTo(0.5)
  })
  it('a walk puts the four feet a quarter stride apart (one foot lands at a time)', () => {
    const w = Object.values(GAITS.walk.offsets).sort((a, b) => a - b)
    expect(w).toEqual([0, 0.25, 0.5, 0.75].map((v) => expect.closeTo(v, 5)))
  })
  it('faster gaits plant their feet for a smaller part of the stride (duty falls)', () => {
    expect(GAITS.walk.duty).toBeGreaterThan(GAITS.trot.duty)
    expect(GAITS.trot.duty).toBeGreaterThan(GAITS.run.duty)
  })
  it('every gait has all four legs and a sane duty', () => {
    for (const g of Object.values(GAITS)) {
      expect(Object.keys(g.offsets).sort()).toEqual(['fl', 'fr', 'rl', 'rr'])
      expect(g.duty).toBeGreaterThan(0.2)
      expect(g.duty).toBeLessThan(0.9)
    }
  })
})
