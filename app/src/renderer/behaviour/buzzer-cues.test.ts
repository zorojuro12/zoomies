// Buzzer cues (P3 serial, phase A): when the dog should make the controller's little buzzer go.
// A squeak when it picks up the ball, a chirp on each real bounce (at most 4 a second). This only
// decides WHEN; the serial writer turns a preset into `S:squeak` / `S:chirp` for the Arduino.
import { describe, expect, it } from 'vitest'
import type { BuzzerPreset } from '@shared/serial'
import type { BehaviourEvent } from './behaviour'
import { BUZZER, BuzzerCues } from './buzzer-cues'

function mk(enabled = true): { b: BuzzerCues; sent: BuzzerPreset[] } {
  const sent: BuzzerPreset[] = []
  const b = new BuzzerCues((p) => sent.push(p))
  b.setEnabled(enabled)
  return { b, sent }
}
const bounce = (strength: number): BehaviourEvent => ({ kind: 'bounce', x: 500, strength })
const fetch = (note: 'launched' | 'pickedUp' | 'done' | 'gaveUp'): BehaviourEvent => ({
  kind: 'fetch',
  note
})

describe('what makes the buzzer go', () => {
  it('picking up the ball: a squeak', () => {
    const { b, sent } = mk()
    b.handle(fetch('pickedUp'))
    expect(sent).toEqual(['squeak'])
  })

  it('a real bounce: a chirp; a tiny one (the ball settling) is silent', () => {
    const { b, sent } = mk()
    b.handle(bounce(0.5))
    expect(sent).toEqual(['chirp'])
    b.update(1000)
    b.handle(bounce(BUZZER.minBounceStrength - 0.01))
    expect(sent).toEqual(['chirp'])
    b.handle(bounce(BUZZER.minBounceStrength))
    expect(sent).toEqual(['chirp', 'chirp'])
  })

  it('nothing else makes noise on the buzzer (a throw, finishing, giving up, a pet, falling asleep)', () => {
    const { b, sent } = mk()
    for (const e of [
      fetch('launched'),
      fetch('done'),
      fetch('gaveUp'),
      { kind: 'pet', source: 'mouse' } as BehaviourEvent,
      { kind: 'activity', note: 'fellAsleep' } as BehaviourEvent,
      { kind: 'reaction', id: 'greet', phase: 'start' } as BehaviourEvent
    ]) {
      b.handle(e)
    }
    expect(sent).toEqual([])
  })
})

describe('not a machine gun', () => {
  it('chirps at most 4 times a second: a ball bouncing fast is capped', () => {
    const { b, sent } = mk()
    for (let i = 0; i < 100; i++) {
      b.handle(bounce(0.6))
      b.update(10) // 1 second in total
    }
    expect(sent.length).toBeGreaterThanOrEqual(3)
    expect(sent.length).toBeLessThanOrEqual(4)
  })

  it('a squeak is not held back by the chirp limit (it replaces it, like the board does)', () => {
    const { b, sent } = mk()
    b.handle(bounce(0.6))
    b.handle(fetch('pickedUp'))
    expect(sent).toEqual(['chirp', 'squeak'])
  })

  it('two pick-ups right after each other: one squeak (a squeak lasts about a tenth of a second)', () => {
    const { b, sent } = mk()
    b.handle(fetch('pickedUp'))
    b.handle(fetch('pickedUp'))
    expect(sent).toEqual(['squeak'])
    b.update(BUZZER.squeakGapMs)
    b.handle(fetch('pickedUp'))
    expect(sent).toEqual(['squeak', 'squeak'])
  })
})

describe('off switch', () => {
  it('disabled (no controller plugged in, or muted): nothing is sent', () => {
    const { b, sent } = mk(false)
    b.handle(fetch('pickedUp'))
    b.handle(bounce(1))
    expect(sent).toEqual([])
  })

  it('switching it on works, and it can be off again', () => {
    const { b, sent } = mk(false)
    b.setEnabled(true)
    b.handle(fetch('pickedUp'))
    b.setEnabled(false)
    b.update(1000)
    b.handle(fetch('pickedUp'))
    expect(sent).toEqual(['squeak'])
  })

  it('ignores bad time and survives a random mix of 5,000 events', () => {
    const { b, sent } = mk()
    b.update(Number.NaN)
    b.update(-5)
    let seed = 3
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < 5000; i++) {
      const r = rand()
      if (r < 0.2) b.handle(bounce(rand()))
      else if (r < 0.3) b.handle(fetch('pickedUp'))
      b.update(rand() * 200)
    }
    for (const p of sent) expect(['squeak', 'chirp']).toContain(p)
  })
})
