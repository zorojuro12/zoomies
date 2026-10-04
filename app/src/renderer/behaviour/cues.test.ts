// Sound cues (P2 Task 6): which noise at which moment, panned to where the dog (or the ball) is,
// quieter when far from the cursor, never spammed, loops started and stopped. A fake player records
// every playSound / stop call, so the table is tested without any audio.
import { describe, expect, it } from 'vitest'
import type { AudioPlayer, PlaySoundOptions, SoundName } from '@shared/audio'
import type { BehaviourEvent } from './behaviour'
import { COOLDOWN_MS, SoundCues, VOLUME } from './cues'

class FakePlayer implements AudioPlayer {
  readonly plays: { name: SoundName; opts: PlaySoundOptions }[] = []
  readonly stops: SoundName[] = []
  preload(): Promise<void> {
    return Promise.resolve()
  }
  playSound(name: SoundName, opts: PlaySoundOptions = {}): void {
    this.plays.push({ name, opts })
  }
  stop(name: SoundName): void {
    this.stops.push(name)
  }
  names(): SoundName[] {
    return this.plays.map((p) => p.name)
  }
}

const W = 1000
function mk(o: { dogX?: number; cursorX?: number | null; muted?: boolean } = {}): {
  c: SoundCues
  p: FakePlayer
  state: { dogX: number; cursorX: number | null }
} {
  const p = new FakePlayer()
  const state = { dogX: o.dogX ?? 500, cursorX: o.cursorX === undefined ? null : o.cursorX }
  const c = new SoundCues(p, {
    screenW: () => W,
    dogX: () => state.dogX,
    cursorX: () => state.cursorX,
    muted: o.muted
  })
  return { c, p, state }
}
const fetch = (note: Extract<BehaviourEvent, { kind: 'fetch' }>['note']): BehaviourEvent => ({
  kind: 'fetch',
  note
})
const act = (note: Extract<BehaviourEvent, { kind: 'activity' }>['note']): BehaviourEvent => ({
  kind: 'activity',
  note
})
const react = (id: string, phase: 'start' | 'end' = 'start'): BehaviourEvent => ({
  kind: 'reaction',
  id,
  phase
})
/** Let `ms` pass in 50 ms steps. */
const wait = (c: SoundCues, ms: number): void => {
  for (let t = 0; t < ms; t += 50) c.update(50)
}

describe('the cue table', () => {
  const cases: [string, BehaviourEvent, SoundName][] = [
    ['you throw the ball', fetch('launched'), 'bark_happy'],
    ['it starts bringing you the ball', fetch('bringing'), 'bark_alert'],
    ['it picks up the ball', fetch('pickedUp'), 'ball_squeak'],
    ['it gives up on a ball it cannot reach', fetch('gaveUp'), 'whine'],
    ['it sits down idle', act('wentIdle'), 'sigh'],
    ['a backspace head tilt', react('backspace'), 'whine'],
    ['you shake the mouse', react('shake'), 'yip_excited'],
    ['you pet it', { kind: 'pet', source: 'mouse' }, 'yip_excited'],
    ['you call it (the controller button)', { kind: 'call' }, 'yip_excited']
  ]
  for (const [name, event, sound] of cases) {
    it(`${name}: ${sound}`, () => {
      const { c, p } = mk()
      c.handle(event)
      expect(p.names()).toEqual([sound])
    })
  }

  it('moments with no sound stay silent (dropping the ball, the break flag, hovering, walking to a window)', () => {
    const { c, p } = mk()
    for (const e of [
      fetch('dropped'),
      fetch('returning'),
      fetch('cancelled'),
      act('breakDue'),
      react('hover'),
      react('typing'),
      react('focus'),
      react('idle'),
      react('rest')
    ]) {
      c.handle(e)
    }
    expect(p.plays).toEqual([])
  })

  it('a finished fetch: panting, which loops and stops by itself after 4 seconds', () => {
    const { c, p } = mk()
    c.handle(fetch('done'))
    expect(p.plays).toHaveLength(1)
    expect(p.plays[0]!.name).toBe('pant')
    expect(p.plays[0]!.opts.loop).toBe(true)
    wait(c, 3900)
    expect(p.stops).toEqual([])
    wait(c, 200)
    expect(p.stops).toEqual(['pant'])
  })

  it('a second finished fetch restarts the 4 seconds instead of cutting the pant short', () => {
    const { c, p } = mk()
    c.handle(fetch('done'))
    wait(c, 3000)
    c.handle(fetch('done'))
    wait(c, 3000)
    expect(p.stops).toEqual([]) // 3 s into the second pant
    wait(c, 1200)
    expect(p.stops).toEqual(['pant'])
  })
})

describe('sleeping and waking', () => {
  it('falls asleep: a sigh, then (1.5 s later) a snore loop that runs until it wakes up', () => {
    const { c, p } = mk()
    c.handle(act('wentIdle'))
    c.handle(act('fellAsleep'))
    expect(p.names()).toEqual(['sigh']) // the second sigh is held back by its cooldown
    wait(c, 1400)
    expect(p.names()).toEqual(['sigh'])
    wait(c, 200)
    expect(p.names()).toEqual(['sigh', 'snore'])
    expect(p.plays[1]!.opts.loop).toBe(true)
  })

  it('the snore stops when the sleep reaction ends', () => {
    const { c, p } = mk()
    c.handle(act('fellAsleep'))
    wait(c, 1600)
    c.handle(react('sleep', 'end'))
    expect(p.stops).toContain('snore')
  })

  it('the snore stops the moment you come back', () => {
    const { c, p } = mk()
    c.handle(act('fellAsleep'))
    wait(c, 1600)
    c.handle(act('returned'))
    expect(p.stops).toContain('snore')
  })

  it('waking before the snore even started: it never starts', () => {
    const { c, p } = mk()
    c.handle(act('fellAsleep'))
    wait(c, 500)
    c.handle(act('returned'))
    wait(c, 3000)
    expect(p.names()).not.toContain('snore')
  })

  it('the welcome back: a yawn 1.3 s in, then a happy yip at 2.8 s as it trots over', () => {
    const { c, p } = mk()
    c.handle(react('greet'))
    wait(c, 1200)
    expect(p.names()).toEqual([])
    wait(c, 200)
    expect(p.names()).toEqual(['yawn'])
    wait(c, 1200)
    expect(p.names()).toEqual(['yawn'])
    wait(c, 500)
    expect(p.names()).toEqual(['yawn', 'yip_excited'])
  })
})

describe('where it sounds and how loud', () => {
  it('pans with the dog: left edge hard left, right edge hard right, middle centred (never fully 100%)', () => {
    const left = mk({ dogX: 0 })
    left.c.handle(fetch('launched'))
    const right = mk({ dogX: W })
    right.c.handle(fetch('launched'))
    const mid = mk({ dogX: W / 2 })
    mid.c.handle(fetch('launched'))
    expect(left.p.plays[0]!.opts.pan).toBeCloseTo(-0.8, 6)
    expect(right.p.plays[0]!.opts.pan).toBeCloseTo(0.8, 6)
    expect(mid.p.plays[0]!.opts.pan).toBeCloseTo(0, 6)
  })

  it('loops are panned and quietened the same way (the snore follows a dog on the right)', () => {
    const { c, p } = mk({ dogX: W, cursorX: 0 })
    c.handle(act('fellAsleep'))
    wait(c, 1600)
    const snore = p.plays.find((x) => x.name === 'snore')!
    expect(snore.opts.pan).toBeCloseTo(0.8, 6)
    expect(snore.opts.gain).toBeCloseTo(0.35, 6)
    expect(snore.opts.loop).toBe(true)
  })

  it('a dog off the screen edge is clamped, not out of range', () => {
    const { c, p } = mk({ dogX: -500 })
    c.handle(fetch('launched'))
    expect(p.plays[0]!.opts.pan).toBeCloseTo(-0.8, 6)
  })

  it('full volume is 70% (the dog never startles anyone), and the cursor being right there changes nothing', () => {
    const { c, p } = mk({ dogX: 500, cursorX: 500 })
    c.handle(fetch('launched'))
    expect(VOLUME).toBeCloseTo(0.7, 6)
    expect(p.plays[0]!.opts.gain).toBeCloseTo(0.7, 6)
  })

  it('the farther the dog is from your cursor, the quieter: across the whole screen it is half as loud', () => {
    const { c, p } = mk({ dogX: 1000, cursorX: 0 })
    c.handle(fetch('launched'))
    expect(p.plays[0]!.opts.gain).toBeCloseTo(0.35, 6)
  })

  it('no cursor known yet: just the normal volume', () => {
    const { c, p } = mk({ cursorX: null })
    c.handle(fetch('launched'))
    expect(p.plays[0]!.opts.gain).toBeCloseTo(0.7, 6)
  })

  it('soft cues are softer than the loud ones (a backspace whine versus a bark)', () => {
    const { c, p } = mk()
    c.handle(react('backspace'))
    c.handle(fetch('launched'))
    expect(p.plays[0]!.opts.gain!).toBeLessThan(p.plays[1]!.opts.gain!)
  })

  it('a ball bounce is panned to the BALL, not the dog, and louder the harder it hit', () => {
    const { c, p } = mk({ dogX: 900 })
    c.handle({ kind: 'bounce', x: 100, strength: 1 })
    wait(c, 200)
    c.handle({ kind: 'bounce', x: 100, strength: 0.1 })
    expect(p.plays[0]!.name).toBe('ball_bounce')
    expect(p.plays[0]!.opts.pan!).toBeLessThan(-0.5) // left side
    expect(p.plays[1]!.opts.gain!).toBeLessThan(p.plays[0]!.opts.gain!)
    expect(p.plays[1]!.opts.gain!).toBeGreaterThan(0)
  })
})

describe('not spammed (cooldowns)', () => {
  it('the same bark twice within its cooldown plays once; after the cooldown it plays again', () => {
    const { c, p } = mk()
    c.handle(fetch('launched'))
    wait(c, 500)
    c.handle(fetch('launched'))
    expect(p.names()).toEqual(['bark_happy'])
    wait(c, COOLDOWN_MS.bark_happy)
    c.handle(fetch('launched'))
    expect(p.names()).toEqual(['bark_happy', 'bark_happy'])
  })

  it('different sounds do not block each other', () => {
    const { c, p } = mk()
    c.handle(fetch('launched'))
    c.handle(fetch('pickedUp'))
    expect(p.names()).toEqual(['bark_happy', 'ball_squeak'])
  })

  it('a ball bouncing quickly is capped (not a machine gun)', () => {
    const { c, p } = mk()
    for (let i = 0; i < 20; i++) {
      c.handle({ kind: 'bounce', x: 500, strength: 0.5 })
      c.update(10)
    }
    expect(p.plays.length).toBeLessThanOrEqual(3)
  })
})

describe('mute', () => {
  it('muted: nothing plays', () => {
    const { c, p } = mk({ muted: true })
    c.handle(fetch('launched'))
    c.handle(fetch('done'))
    wait(c, 3000)
    expect(p.plays).toEqual([])
  })

  it('muting while a loop is playing stops it, and nothing scheduled sneaks out afterwards', () => {
    const { c, p } = mk()
    c.handle(act('fellAsleep'))
    c.handle(react('greet'))
    c.setMuted(true)
    expect(p.stops).toEqual(expect.arrayContaining(['snore', 'pant']))
    wait(c, 5000)
    expect(p.names()).toEqual(['sigh'])
  })

  it('muting and unmuting again quickly: what was scheduled before the mute never comes out late', () => {
    const { c, p } = mk()
    c.handle(act('fellAsleep'))
    c.setMuted(true)
    c.setMuted(false)
    wait(c, 5000)
    expect(p.names()).toEqual(['sigh'])
  })

  it('unmuting makes it talk again', () => {
    const { c, p } = mk({ muted: true })
    c.setMuted(false)
    c.handle(fetch('launched'))
    expect(p.names()).toEqual(['bark_happy'])
    expect(c.muted).toBe(false)
  })
})

describe('odd situations', () => {
  it('a long stall fires scheduled sounds in the order of their TIMES, not the order they were queued', () => {
    const { c, p } = mk()
    c.handle(act('fellAsleep')) // snore at +1500
    c.update(100)
    c.handle(react('greet')) // yawn at +1400 from now, i.e. before the snore; yip at +2800
    c.update(10_000)
    expect(p.names()).toEqual(['sigh', 'yawn', 'snore', 'yip_excited'])
  })

  it('a long stall fires everything that was due, once each, in order', () => {
    const { c, p } = mk()
    c.handle(react('greet'))
    c.update(10_000)
    expect(p.names()).toEqual(['yawn', 'yip_excited'])
    c.update(10_000)
    expect(p.names()).toEqual(['yawn', 'yip_excited'])
  })

  it('stays sane through 5,000 random events and steps: no crash, nothing piles up', () => {
    let seed = 8
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const { c, p } = mk()
    const events: BehaviourEvent[] = [
      fetch('launched'),
      fetch('done'),
      fetch('gaveUp'),
      act('fellAsleep'),
      act('returned'),
      react('greet'),
      react('sleep', 'end'),
      { kind: 'pet', source: 'mouse' },
      { kind: 'bounce', x: 300, strength: 0.4 }
    ]
    for (let i = 0; i < 5000; i++) {
      if (rand() < 0.3) c.handle(events[Math.floor(rand() * events.length)]!)
      if (rand() < 0.01) c.setMuted(rand() < 0.5)
      c.update(rand() * 400)
    }
    wait(c, 10_000)
    const before = p.plays.length
    wait(c, 10_000)
    expect(p.plays.length).toBe(before) // nothing left scheduled
  })
})
