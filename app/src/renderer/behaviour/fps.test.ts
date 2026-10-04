// Adaptive frame rate (P2 Task 5): when nothing is happening the app redraws less. The governor
// decides, on every screen refresh ("tick"), whether to do a real frame. Active = every tick,
// resting = 30 a second, asleep = 5 a second. Tested on a fake 144 Hz screen.
import { describe, expect, it } from 'vitest'
import { FrameGovernor, TIER_FPS } from './fps'
import type { FpsTier } from './fps'

/** Count the real frames in `seconds` on a screen refreshing `hz` times a second. */
function runs(g: FrameGovernor, tier: FpsTier, seconds: number, hz = 144, startMs = 0): number {
  let n = 0
  const ticks = Math.round(seconds * hz)
  for (let i = 0; i < ticks; i++) if (g.shouldRun(startMs + (i * 1000) / hz, tier)) n++
  return n
}

describe('the three speeds', () => {
  it('active: a real frame on every screen refresh, never slower', () => {
    expect(runs(new FrameGovernor(), 'full', 2)).toBe(288)
  })
  it('resting: about 30 frames a second on a 144 Hz screen', () => {
    const n = runs(new FrameGovernor(), 'rest', 10)
    expect(n).toBeGreaterThan(297)
    expect(n).toBeLessThan(303)
  })
  it('asleep: about 5 frames a second on a 144 Hz screen', () => {
    const n = runs(new FrameGovernor(), 'sleep', 10)
    expect(n).toBeGreaterThanOrEqual(49)
    expect(n).toBeLessThanOrEqual(51)
  })
  it('the table says 30 and 5 (and unlimited for active)', () => {
    expect(TIER_FPS.rest).toBe(30)
    expect(TIER_FPS.sleep).toBe(5)
    expect(TIER_FPS.full).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('behaves on any screen', () => {
  it('a 60 Hz screen asleep still gives about 5 a second', () => {
    const n = runs(new FrameGovernor(), 'sleep', 10, 60)
    expect(n).toBeGreaterThanOrEqual(49)
    expect(n).toBeLessThanOrEqual(51)
  })
  it('a screen no faster than the target is never slowed down (30 Hz screen, resting)', () => {
    expect(runs(new FrameGovernor(), 'rest', 4, 30)).toBeGreaterThanOrEqual(119)
  })
  it('the very first tick is a real frame', () => {
    expect(new FrameGovernor().shouldRun(5000, 'sleep')).toBe(true)
  })
  it('uneven refreshes (jitter) still average out to the target', () => {
    const g = new FrameGovernor()
    let t = 0
    let n = 0
    let seed = 5
    while (t < 20000) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      t += 5 + (seed / 4294967296) * 6 // 5..11 ms between refreshes
      if (g.shouldRun(t, 'sleep')) n++
    }
    expect(n).toBeGreaterThanOrEqual(97)
    expect(n).toBeLessThanOrEqual(101)
  })
})

describe('changing speed', () => {
  it('going from asleep to active is immediate: the very next tick is a real frame', () => {
    const g = new FrameGovernor()
    runs(g, 'sleep', 3)
    expect(g.shouldRun(3000.5, 'full')).toBe(true)
    expect(g.shouldRun(3007.5, 'full')).toBe(true)
  })
  it('going back to sleep waits for the next 5-per-second slot, not another instant frame', () => {
    const g = new FrameGovernor()
    g.shouldRun(1000, 'full')
    expect(g.shouldRun(1007, 'sleep')).toBe(false)
    expect(g.shouldRun(1100, 'sleep')).toBe(false)
    expect(g.shouldRun(1201, 'sleep')).toBe(true)
  })
})

describe('odd clocks', () => {
  it('after a long pause (laptop asleep, window hidden) it does ONE frame, not a flood to catch up', () => {
    const g = new FrameGovernor()
    g.shouldRun(0, 'sleep')
    expect(g.shouldRun(600_000, 'sleep')).toBe(true)
    expect(g.shouldRun(600_007, 'sleep')).toBe(false)
    expect(g.shouldRun(600_014, 'sleep')).toBe(false)
  })
  it('a clock that goes backwards or is NaN just runs the frame (never freezes the dog)', () => {
    const g = new FrameGovernor()
    g.shouldRun(10_000, 'sleep')
    expect(g.shouldRun(5_000, 'sleep')).toBe(true)
    expect(g.shouldRun(Number.NaN, 'sleep')).toBe(true)
  })
})
