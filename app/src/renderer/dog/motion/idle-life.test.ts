// Standing life: what a dog does when nothing is happening. It shifts its weight side to side, now
// and then flicks an ear, and its head slowly droops the longer it has had nothing to do. Pure
// numbers; the schedule is deterministic for a seed so tests (and the demo) are repeatable.
import { describe, expect, it } from 'vitest'
import { createIdleLife, noteActivity, SWAY_MAX, DROOP_AFTER, stepIdleLife } from './idle-life'

const run = (s: ReturnType<typeof createIdleLife>, seconds: number, standing: boolean): number => {
  let kicks = 0
  for (let t = 0; t < seconds; t += 1 / 60) {
    stepIdleLife(s, 1 / 60, standing)
    if (s.earKick !== 0) kicks++
  }
  return kicks
}

describe('weight shift (sway)', () => {
  it('swings both ways, never beyond its limit, while standing', () => {
    const s = createIdleLife(1)
    let lo = Infinity
    let hi = -Infinity
    for (let t = 0; t < 30; t += 1 / 60) {
      stepIdleLife(s, 1 / 60, true)
      lo = Math.min(lo, s.sway)
      hi = Math.max(hi, s.sway)
    }
    expect(lo).toBeLessThan(-SWAY_MAX * 0.8)
    expect(hi).toBeGreaterThan(SWAY_MAX * 0.8)
    expect(lo).toBeGreaterThanOrEqual(-SWAY_MAX - 1e-9)
    expect(hi).toBeLessThanOrEqual(SWAY_MAX + 1e-9)
  })
  it('fades out (no jump) when the dog starts doing something, and is zero once it has', () => {
    const s = createIdleLife(1)
    run(s, 3, true)
    const before = s.sway
    stepIdleLife(s, 1 / 60, false)
    expect(Math.abs(s.sway - before)).toBeLessThan(SWAY_MAX * 0.2)
    run(s, 2, false)
    expect(Math.abs(s.sway)).toBeLessThan(1e-3)
  })
  it('does nothing at all before it has been standing: starts at zero', () => {
    expect(createIdleLife(1).sway).toBe(0)
  })
})

describe('ear twitch', () => {
  it('happens every 3 to 8 seconds while standing, and never while busy', () => {
    const s = createIdleLife(7)
    const standingKicks = run(s, 60, true)
    expect(standingKicks).toBeGreaterThanOrEqual(60 / 8 - 1)
    expect(standingKicks).toBeLessThanOrEqual(60 / 3 + 1)
    expect(run(createIdleLife(7), 60, false)).toBe(0)
  })
  it('is deterministic for a seed and differs between seeds', () => {
    const times = (seed: number): number[] => {
      const s = createIdleLife(seed)
      const out: number[] = []
      for (let f = 0; f < 60 * 40; f++) {
        stepIdleLife(s, 1 / 60, true)
        if (s.earKick !== 0) out.push(f)
      }
      return out
    }
    expect(times(3)).toEqual(times(3))
    expect(times(3)).not.toEqual(times(4))
  })
})

describe('boredom droop', () => {
  it('starts at zero, grows with time standing with nothing to do, and caps at 1', () => {
    const s = createIdleLife(1)
    run(s, 2, true)
    expect(s.droop).toBeLessThan(0.1)
    run(s, DROOP_AFTER, true)
    expect(s.droop).toBeGreaterThan(0.9)
    run(s, 60, true)
    expect(s.droop).toBeLessThanOrEqual(1)
  })
  it('lifts again after activity (any command resets the timer)', () => {
    const s = createIdleLife(1)
    run(s, DROOP_AFTER * 2, true)
    expect(s.droop).toBeGreaterThan(0.9)
    noteActivity(s)
    run(s, 3, true)
    expect(s.droop).toBeLessThan(0.5)
  })
  it('does not accumulate while the dog is busy', () => {
    const s = createIdleLife(1)
    run(s, DROOP_AFTER * 3, false)
    expect(s.droop).toBeLessThan(0.05)
  })
})
