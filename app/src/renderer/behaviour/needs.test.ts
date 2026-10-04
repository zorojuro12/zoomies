// Needs model (P2 Task 1): energy / boredom / attention, three numbers in 0..1 that rise and fall
// so the dog's behaviour is chosen from them instead of a fixed loop. Expected numbers are
// hand-worked from the rates in the plan (docs/plans/a-p2-mvp-behaviour.md), not recomputed.
import { describe, expect, it } from 'vitest'
import { applyNeedsEvent, createNeeds, stepNeeds, wants } from './needs'
import type { Needs } from './needs'

const make = (energy: number, boredom: number, attention: number): Needs => ({
  energy,
  boredom,
  attention
})
/** Step `seconds` of game time in 1-second steps. */
const run = (
  n: Needs,
  seconds: number,
  doing: Parameters<typeof stepNeeds>[2],
  active: boolean
): void => {
  for (let s = 0; s < seconds; s++) stepNeeds(n, 1000, doing, active)
}

describe('createNeeds', () => {
  it('starts rested, not bored, middling attention', () => {
    expect(createNeeds()).toEqual({ energy: 1, boredom: 0, attention: 0.5 })
  })
})

describe('energy', () => {
  it('fetching drains 0.01 per second: 10 s from 1 -> 0.9', () => {
    const n = make(1, 0, 0.5)
    run(n, 10, 'fetching', true)
    expect(n.energy).toBeCloseTo(0.9, 6)
  })
  it('resting recovers 0.01 per second: 10 s from 0.5 -> 0.6', () => {
    const n = make(0.5, 0, 0.5)
    run(n, 10, 'resting', false)
    expect(n.energy).toBeCloseTo(0.6, 6)
  })
  it('sleeping recovers 0.03 per second and clamps at 1: 20 s from 0.5 -> 1', () => {
    const n = make(0.5, 0, 0.5)
    run(n, 20, 'sleeping', false)
    expect(n.energy).toBe(1)
  })
  it('just being up and about recovers a little: 0.002 per second, 10 s from 0.5 -> 0.52', () => {
    const n = make(0.5, 0, 0.5)
    run(n, 10, 'active', true)
    expect(n.energy).toBeCloseTo(0.52, 6)
  })
  it('never goes below 0', () => {
    const n = make(0.1, 0, 0.5)
    run(n, 60, 'fetching', true)
    expect(n.energy).toBe(0)
  })
})

describe('boredom', () => {
  it('rises 0.002 per second when the user is idle: 100 s from 0 -> 0.2', () => {
    const n = make(1, 0, 0.5)
    run(n, 100, 'active', false)
    expect(n.boredom).toBeCloseTo(0.2, 6)
  })
  it('rises only 0.0006 per second when the user is active: 100 s from 0 -> 0.06', () => {
    const n = make(1, 0, 0.5)
    run(n, 100, 'active', true)
    expect(n.boredom).toBeCloseTo(0.06, 6)
  })
  it('fetching soothes it, 0.02 per second: 10 s from 0.5 -> 0.3', () => {
    const n = make(1, 0.5, 0.5)
    run(n, 10, 'fetching', true)
    expect(n.boredom).toBeCloseTo(0.3, 6)
  })
  it('sleeping soothes it, 0.01 per second: 10 s from 0.5 -> 0.4', () => {
    const n = make(1, 0.5, 0.5)
    run(n, 10, 'sleeping', false)
    expect(n.boredom).toBeCloseTo(0.4, 6)
  })
  it('clamps at 1 and at 0', () => {
    const a = make(1, 0.99, 0.5)
    run(a, 60, 'active', false)
    expect(a.boredom).toBe(1)
    const b = make(1, 0.05, 0.5)
    run(b, 60, 'fetching', true)
    expect(b.boredom).toBe(0)
  })
})

describe('attention', () => {
  it('follows an active user with a 20 s time constant: 20 s from 0 -> 1 - e^-1 = 0.632', () => {
    const n = make(1, 0, 0)
    run(n, 20, 'active', true)
    expect(n.attention).toBeCloseTo(0.632, 2)
  })
  it('is above 0.99 after 100 s of an active user', () => {
    const n = make(1, 0, 0)
    run(n, 100, 'active', true)
    expect(n.attention).toBeGreaterThan(0.99)
  })
  it('decays toward 0 when the user is away, mirroring it: 20 s from 1 -> 0.368', () => {
    const n = make(1, 0, 1)
    run(n, 20, 'active', false)
    expect(n.attention).toBeCloseTo(0.368, 2)
  })
})

describe('events', () => {
  it('pet: boredom -0.3, attention +0.3', () => {
    const n = make(1, 0.5, 0.4)
    applyNeedsEvent(n, 'pet')
    expect(n.boredom).toBeCloseTo(0.2, 6)
    expect(n.attention).toBeCloseTo(0.7, 6)
  })
  it('launch: boredom -0.4, attention jumps to 1', () => {
    const n = make(1, 0.5, 0.1)
    applyNeedsEvent(n, 'launch')
    expect(n.boredom).toBeCloseTo(0.1, 6)
    expect(n.attention).toBe(1)
  })
  it('fetchDone: energy -0.05, boredom -0.2', () => {
    const n = make(0.5, 0.5, 0.5)
    applyNeedsEvent(n, 'fetchDone')
    expect(n.energy).toBeCloseTo(0.45, 6)
    expect(n.boredom).toBeCloseTo(0.3, 6)
  })
  it('ballBrought: boredom -0.3', () => {
    const n = make(1, 0.9, 0.5)
    applyNeedsEvent(n, 'ballBrought')
    expect(n.boredom).toBeCloseTo(0.6, 6)
  })
  it('events clamp too', () => {
    const n = make(0.02, 0.1, 0.9)
    applyNeedsEvent(n, 'fetchDone')
    applyNeedsEvent(n, 'pet')
    expect(n.energy).toBe(0)
    expect(n.boredom).toBe(0)
    expect(n.attention).toBe(1)
  })
})

describe('wants', () => {
  it('wants to play when bored (> 0.6) and has energy (> 0.4)', () => {
    expect(wants(make(0.5, 0.61, 0.5)).play).toBe(true)
    expect(wants(make(0.5, 0.6, 0.5)).play).toBe(false) // boundary: not strictly above
    expect(wants(make(0.4, 0.9, 0.5)).play).toBe(false) // too tired
  })
  it('wants to rest when energy is low (< 0.25)', () => {
    expect(wants(make(0.24, 0, 0.5)).rest).toBe(true)
    expect(wants(make(0.25, 0, 0.5)).rest).toBe(false)
  })
  it('a tired, bored dog rests rather than plays', () => {
    const w = wants(make(0.2, 0.9, 0.5))
    expect(w.rest).toBe(true)
    expect(w.play).toBe(false)
  })
})

describe('robustness', () => {
  it('dt = 0 changes nothing', () => {
    const n = make(0.5, 0.5, 0.5)
    stepNeeds(n, 0, 'fetching', true)
    expect(n).toEqual(make(0.5, 0.5, 0.5))
  })
  it('a non-finite dt changes nothing', () => {
    const n = make(0.5, 0.5, 0.5)
    stepNeeds(n, Number.NaN, 'fetching', true)
    stepNeeds(n, Number.POSITIVE_INFINITY, 'fetching', true)
    expect(n).toEqual(make(0.5, 0.5, 0.5))
  })
  it('one enormous dt counts as at most 5 s (a laptop wake must not drain the dog in one step)', () => {
    const n = make(1, 0, 0.5)
    stepNeeds(n, 1e9, 'fetching', true)
    expect(n.energy).toBeCloseTo(0.95, 6) // 5 s * 0.01
  })
  it('stays inside 0..1 and finite through 20,000 random steps and events', () => {
    let seed = 7
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const n = createNeeds()
    const doings = ['fetching', 'active', 'resting', 'sleeping'] as const
    const events = ['pet', 'launch', 'fetchDone', 'ballBrought'] as const
    for (let i = 0; i < 20000; i++) {
      stepNeeds(n, rand() * 3000, doings[Math.floor(rand() * 4)]!, rand() < 0.5)
      if (rand() < 0.1) applyNeedsEvent(n, events[Math.floor(rand() * 4)]!)
      for (const v of [n.energy, n.boredom, n.attention]) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
})

// "Does it feel right" checks. The arithmetic tests above pass for ANY rates; these pin the rates
// to what a 3-minute demo needs (found by simulating the dog: the first rates tired it out after a
// single 25-second fetch).
describe('feel (demo-scale)', () => {
  it('five throws of about 12 s each (a minute of fetching) leave the dog still willing to play', () => {
    const n = createNeeds()
    applyNeedsEvent(n, 'launch')
    run(n, 60, 'fetching', true)
    expect(n.energy).toBeGreaterThan(0.3)
    expect(wants(n).rest).toBe(false)
  })
  it('a long, long session of fetching (3 minutes) does tire it out', () => {
    const n = createNeeds()
    run(n, 180, 'fetching', true)
    expect(wants(n).rest).toBe(true)
  })
  it('a tired dog is back to full energy after about 2 minutes lying down', () => {
    const n = make(0, 0, 0.5)
    run(n, 120, 'resting', true)
    expect(n.energy).toBe(1)
  })
  it('three minutes with the user away makes it bored, but not yet pestering', () => {
    const n = createNeeds()
    run(n, 180, 'active', false)
    expect(n.boredom).toBeGreaterThan(0.3)
    expect(n.boredom).toBeLessThan(0.45)
  })
})
