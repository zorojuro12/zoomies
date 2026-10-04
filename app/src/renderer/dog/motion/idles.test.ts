// Idle tricks: short, self-contained bits of dog business (a yawn, a sniff, a shake-off). Each is
// a function of time that returns small offsets to the pose, so it works for any dog. Every trick
// must start and end at exactly "no change" so it never leaves the dog stuck in a pose.
import { describe, expect, it } from 'vitest'
import { IDLE_NAMES, IDLES, createOffsets, sampleIdle } from './idles'
import type { IdleName } from './idles'

const KEYS = [
  'drop',
  'pitch',
  'neck',
  'head',
  'roll',
  'jaw',
  'lid',
  'tail',
  'bodyRoll',
  'ear'
] as const

function track(name: IdleName, n = 200): ReturnType<typeof createOffsets>[] {
  const out: ReturnType<typeof createOffsets>[] = []
  for (let i = 0; i <= n; i++) {
    const o = createOffsets()
    sampleIdle(name, (i / n) * IDLES[name].duration, o)
    out.push(o)
  }
  return out
}

describe('every trick', () => {
  for (const name of IDLE_NAMES) {
    describe(name, () => {
      it('takes between 1 and 4 seconds', () => {
        expect(IDLES[name].duration).toBeGreaterThanOrEqual(1)
        expect(IDLES[name].duration).toBeLessThanOrEqual(4)
      })
      it('starts and ends at exactly no change', () => {
        const t = track(name)
        for (const k of KEYS) {
          expect(t[0]![k], `${name} start ${k}`).toBeCloseTo(0, 6)
          expect(t[t.length - 1]![k], `${name} end ${k}`).toBeCloseTo(0, 6)
        }
      })
      it('stays within sane limits the whole way through', () => {
        for (const o of track(name)) {
          expect(Math.abs(o.drop)).toBeLessThanOrEqual(0.15)
          expect(Math.abs(o.pitch)).toBeLessThanOrEqual(10)
          expect(Math.abs(o.neck)).toBeLessThanOrEqual(25)
          expect(Math.abs(o.head)).toBeLessThanOrEqual(25)
          expect(Math.abs(o.roll)).toBeLessThanOrEqual(25)
          expect(o.jaw).toBeGreaterThanOrEqual(0)
          expect(o.jaw).toBeLessThanOrEqual(45)
          expect(o.lid).toBeGreaterThanOrEqual(0)
          expect(o.lid).toBeLessThanOrEqual(1)
          expect(Math.abs(o.bodyRoll)).toBeLessThanOrEqual(0.12)
        }
      })
      it('is a pure function of time (same time, same result)', () => {
        const a = createOffsets()
        const b = createOffsets()
        sampleIdle(name, 0.7, a)
        sampleIdle(name, 0.7, b)
        expect(a).toEqual(b)
      })
    })
  }
  it('sampling past the end gives no change (so a late frame cannot leave a pose behind)', () => {
    for (const name of IDLE_NAMES) {
      const o = createOffsets()
      sampleIdle(name, IDLES[name].duration + 5, o)
      for (const k of KEYS) expect(o[k]).toBe(0)
    }
  })
})

describe('yawn', () => {
  const t = track('yawn')
  it('opens the jaw wide in the middle and shuts the eyes while doing it', () => {
    expect(Math.max(...t.map((o) => o.jaw))).toBeGreaterThan(30)
    expect(Math.max(...t.map((o) => o.lid))).toBeGreaterThan(0.6)
  })
  it('lifts the nose (head and neck go up = negative) while the jaw is open', () => {
    const widest = t.reduce((a, b) => (b.jaw > a.jaw ? b : a))
    expect(widest.head).toBeLessThan(-5)
  })
})

describe('sniff', () => {
  const t = track('sniff')
  it('lowers the head toward the ground', () => {
    expect(Math.max(...t.map((o) => o.neck))).toBeGreaterThan(8)
  })
  it('bobs the nose: the head angle goes up and down several times', () => {
    let flips = 0
    for (let i = 2; i < t.length; i++) {
      const d1 = t[i - 1]!.head - t[i - 2]!.head
      const d2 = t[i]!.head - t[i - 1]!.head
      if (d1 * d2 < 0) flips++
    }
    expect(flips).toBeGreaterThanOrEqual(6)
  })
})

describe('shake', () => {
  const t = track('shake')
  it('rattles the body and head quickly from side to side', () => {
    expect(Math.max(...t.map((o) => o.bodyRoll))).toBeGreaterThan(0.03)
    expect(Math.min(...t.map((o) => o.bodyRoll))).toBeLessThan(-0.03)
    expect(Math.max(...t.map((o) => o.roll))).toBeGreaterThan(8)
    expect(Math.min(...t.map((o) => o.roll))).toBeLessThan(-8)
  })
  it('flaps the ears', () => {
    expect(Math.max(...t.map((o) => Math.abs(o.ear)))).toBeGreaterThan(0.1)
  })
})
