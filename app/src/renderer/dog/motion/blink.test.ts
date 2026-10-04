// Blinking: every few seconds the eyes close for a fraction of a second. blink amount 0 = open,
// 1 = fully closed. The schedule is deterministic for a given seed (so it can be tested and so two
// runs of the app blink the same way), the first blink is at a fixed time, and later gaps vary
// like a real animal's (between 2.2 and 5.2 s).
import { describe, expect, it } from 'vitest'
import { BLINK_SECONDS, createBlink, FIRST_BLINK_AT, stepBlink } from './blink'

/** Run the blink for `seconds` in `dt` steps and return the amount at each step. */
function run(seed: number, seconds: number, dt: number): number[] {
  const s = createBlink(seed)
  const out: number[] = []
  for (let t = 0; t < seconds; t += dt) out.push(stepBlink(s, dt))
  return out
}

describe('blink', () => {
  it('is fully open before the first blink', () => {
    const a = run(1, FIRST_BLINK_AT - 0.01, 0.01)
    expect(Math.max(...a)).toBe(0)
  })

  it('closes fully at the middle of the first blink and is open again after it', () => {
    const dt = 0.001
    const a = run(1, FIRST_BLINK_AT + BLINK_SECONDS + 0.2, dt)
    const mid = Math.round((FIRST_BLINK_AT + BLINK_SECONDS / 2) / dt)
    expect(a[mid]!).toBeGreaterThan(0.99)
    const after = Math.round((FIRST_BLINK_AT + BLINK_SECONDS + 0.05) / dt)
    expect(a[after]!).toBe(0)
  })

  it('a blink is quick: closed for well under a quarter of a second', () => {
    const dt = 0.001
    const a = run(1, FIRST_BLINK_AT + 1, dt)
    const closedish = a.filter((v) => v > 0.05).length * dt
    expect(closedish).toBeLessThan(0.25)
    expect(closedish).toBeGreaterThan(0.1)
  })

  it('stays within 0..1 and eases in and out (no jumps between frames)', () => {
    const a = run(1, 20, 1 / 60)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    for (let i = 1; i < a.length; i++) expect(Math.abs(a[i]! - a[i - 1]!)).toBeLessThan(0.55)
  })

  it('blinks every 2.4 to 5.4 seconds on average: 60 s gives 11 to 25 blinks', () => {
    const a = run(7, 60, 1 / 60)
    let blinks = 0
    for (let i = 1; i < a.length; i++) if (a[i - 1]! < 0.5 && a[i]! >= 0.5) blinks++
    expect(blinks).toBeGreaterThanOrEqual(11)
    expect(blinks).toBeLessThanOrEqual(25)
  })

  it('is deterministic for a seed, and different seeds blink at different times', () => {
    expect(run(3, 15, 1 / 60)).toEqual(run(3, 15, 1 / 60))
    expect(run(3, 15, 1 / 60)).not.toEqual(run(4, 15, 1 / 60))
  })

  it('survives a dropped frame (a huge time step) without leaving 0..1', () => {
    const s = createBlink(1)
    for (const dt of [0.5, 2, 0.001, 10]) {
      const v = stepBlink(s, dt)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('does nothing with zero time', () => {
    const s = createBlink(1)
    expect(stepBlink(s, 0)).toBe(0)
  })
})
