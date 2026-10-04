// Activity classifier (P2 Task 2): turns Ansh's raw activity events (typing rate, mouse speed, OS
// idle seconds) into the few plain labels the dog's brain uses. Time is passed in, never read, so
// a 50-minute break timer is tested in microseconds. Boundaries are tested exactly (59 s vs 60 s).
import { describe, expect, it } from 'vitest'
import { ActivityClassifier } from './activity'
import type { ActivityNote } from './activity'
import { BEHAVIOUR_TIMING, DEMO_TIMING } from './timing'
import type { Timing } from './timing'

function make(timing: Timing = BEHAVIOUR_TIMING): { c: ActivityClassifier; notes: ActivityNote[] } {
  const c = new ActivityClassifier(timing)
  const notes: ActivityNote[] = []
  c.onNote((n) => notes.push(n))
  return { c, notes }
}
/** Let `seconds` pass with no input, in 1 s steps. */
const wait = (c: ActivityClassifier, seconds: number, hour = 12): void => {
  for (let left = seconds * 1000; left > 0; left -= 1000) c.update(Math.min(1000, left), hour)
}
const mouse = (c: ActivityClassifier, speed = 100): void =>
  c.onEvent({ kind: 'mouse', x: 10, y: 10, speed })
const typing = (c: ActivityClassifier, keysPerSec: number, backspaceRatio = 0): void =>
  c.onEvent({ kind: 'typing', keysPerSec, backspaceRatio })
/** `seconds` of steady typing: a typing event every 500 ms, as Ansh's tracker sends them. */
const type = (c: ActivityClassifier, seconds: number, keysPerSec: number, ratio = 0): void => {
  for (let i = 0; i < seconds * 2; i++) {
    typing(c, keysPerSec, ratio)
    c.update(500, 12)
  }
}

describe('start', () => {
  it('starts active with every flag off', () => {
    const { c } = make()
    expect(c.state.user).toBe('active')
    expect(c.state.backspaceSpam).toBe(false)
    expect(c.state.breakDue).toBe(false)
    expect(c.state.lateNight).toBe(false)
  })
})

describe('idle and asleep (thresholds from the OS idle time)', () => {
  it('59 s of nothing is still active, 60 s is idle, and it says so once', () => {
    const { c, notes } = make()
    wait(c, 59)
    expect(c.state.user).toBe('active')
    wait(c, 1)
    expect(c.state.user).toBe('idle')
    expect(notes).toEqual(['wentIdle'])
  })
  it('299 s is idle, 300 s is asleep', () => {
    const { c, notes } = make()
    wait(c, 299)
    expect(c.state.user).toBe('idle')
    wait(c, 1)
    expect(c.state.user).toBe('asleep')
    expect(notes).toEqual(['wentIdle', 'fellAsleep'])
  })
  it("the OS's own idle seconds are the truth: an idle event of 100 s makes it idle at once", () => {
    const { c } = make()
    c.onEvent({ kind: 'idle', seconds: 100 })
    expect(c.state.user).toBe('idle')
  })
  it('one huge 10-minute step still goes through idle BEFORE asleep, in order', () => {
    const { c, notes } = make()
    c.update(600_000, 12)
    expect(c.state.user).toBe('asleep')
    expect(notes).toEqual(['wentIdle', 'fellAsleep'])
  })
  it('mouse movement or typing resets the idle clock at once (no waiting for the next 1 s idle event)', () => {
    const { c } = make()
    wait(c, 100)
    expect(c.state.user).toBe('idle')
    mouse(c)
    expect(c.state.user).toBe('active')
  })
  it('a typing event of 0 keys per second (the "stopped" event) is NOT activity', () => {
    const { c } = make()
    wait(c, 100)
    typing(c, 0)
    expect(c.state.user).toBe('idle')
  })
  it('a still mouse (speed 0) is not activity either', () => {
    const { c } = make()
    wait(c, 100)
    mouse(c, 0)
    expect(c.state.user).toBe('idle')
  })
})

describe('returned (waking the sleeping dog)', () => {
  it('fires once on the first input after sleeping, then the user is active', () => {
    const { c, notes } = make()
    wait(c, 301)
    notes.length = 0
    mouse(c)
    expect(c.state.user).toBe('active')
    expect(notes).toEqual(['returned'])
    mouse(c)
    typing(c, 5)
    expect(notes).toEqual(['returned'])
  })
  it('coming back from just idle (not asleep) is not "returned"', () => {
    const { c, notes } = make()
    wait(c, 100)
    notes.length = 0
    mouse(c)
    expect(notes).toEqual([])
  })
  it('the OS saying "idle 3 s" while asleep also counts as returned', () => {
    const { c, notes } = make()
    wait(c, 301)
    notes.length = 0
    c.onEvent({ kind: 'idle', seconds: 3 })
    expect(notes).toEqual(['returned'])
  })
})

describe('steady typing and focus', () => {
  it('3 keys/s: 7.5 s is not yet typing, 8 s is', () => {
    const { c } = make()
    type(c, 7.5, 3)
    expect(c.state.user).toBe('active')
    type(c, 0.5, 3)
    expect(c.state.user).toBe('typing')
  })
  it('2.9 keys/s never counts as steady typing', () => {
    const { c } = make()
    type(c, 30, 2.9)
    expect(c.state.user).toBe('active')
  })
  it('a pause longer than 2 s starts the count over', () => {
    const { c } = make()
    type(c, 6, 4)
    c.onEvent({ kind: 'typing', keysPerSec: 0, backspaceRatio: 0 })
    wait(c, 3)
    type(c, 6, 4)
    expect(c.state.user).toBe('active')
  })
  it('a short pause (1.5 s) does not: 5 s + 3.5 s of typing counts as 8.5 s', () => {
    const { c } = make()
    type(c, 5, 4)
    wait(c, 1.5)
    type(c, 3.5, 4)
    expect(c.state.user).toBe('typing')
  })
  it('4 keys/s for 45 s is focus, which beats typing', () => {
    const { c } = make()
    type(c, 44.5, 4)
    expect(c.state.user).toBe('typing')
    type(c, 0.5, 4)
    expect(c.state.user).toBe('focus')
  })
  it('3 keys/s for a long time is typing but never focus', () => {
    const { c } = make()
    type(c, 120, 3)
    expect(c.state.user).toBe('typing')
  })
  it('goes back to active a few seconds after the typing stops', () => {
    const { c } = make()
    type(c, 10, 4)
    expect(c.state.user).toBe('typing')
    typing(c, 0)
    wait(c, 5)
    expect(c.state.user).toBe('active')
  })
})

describe('backspace spam', () => {
  it('more than 30% backspaces while typing fast is spam; exactly 30% is not', () => {
    const { c } = make()
    typing(c, 5, 0.31)
    expect(c.state.backspaceSpam).toBe(true)
    typing(c, 5, 0.3)
    expect(c.state.backspaceSpam).toBe(false)
  })
  it('one stray backspace (1 key/s, 100% backspace) is not spam', () => {
    const { c } = make()
    typing(c, 1, 1)
    expect(c.state.backspaceSpam).toBe(false)
  })
  it('clears itself when the typing stops', () => {
    const { c } = make()
    typing(c, 5, 0.5)
    expect(c.state.backspaceSpam).toBe(true)
    wait(c, 2)
    expect(c.state.backspaceSpam).toBe(false)
  })
})

describe('break due (50 minutes of working)', () => {
  const workFor = (c: ActivityClassifier, seconds: number): void => {
    for (let s = 0; s < seconds; s++) {
      mouse(c)
      c.update(1000, 12)
    }
  }
  it('2999 s of work is not yet due, 3000 s is, and it says so once', () => {
    const { c, notes } = make()
    workFor(c, 2999)
    expect(c.state.breakDue).toBe(false)
    workFor(c, 1)
    expect(c.state.breakDue).toBe(true)
    workFor(c, 100)
    expect(notes.filter((n) => n === 'breakDue')).toHaveLength(1)
  })
  it('only active time counts: 2900 s working + 100 s away + 100 s working = 3000 s of work', () => {
    const { c } = make()
    workFor(c, 2900)
    wait(c, 100) // idle, but under 180 s: not a real break
    expect(c.state.breakDue).toBe(false)
    workFor(c, 100)
    expect(c.state.breakDue).toBe(true)
  })
  it('a real break (3 minutes away) restarts the timer', () => {
    const { c } = make()
    workFor(c, 2900)
    wait(c, 180)
    workFor(c, 200)
    expect(c.state.breakDue).toBe(false)
  })
  it('breakHandled() (the dog did its nudge) clears it and restarts the count', () => {
    const { c } = make()
    workFor(c, 3000)
    expect(c.state.breakDue).toBe(true)
    c.breakHandled()
    expect(c.state.breakDue).toBe(false)
    workFor(c, 2999)
    expect(c.state.breakDue).toBe(false)
    workFor(c, 1)
    expect(c.state.breakDue).toBe(true)
  })
  it('a huge step while the user is gone adds no work time', () => {
    const { c } = make()
    workFor(c, 100)
    c.update(3_600_000, 12)
    mouse(c)
    expect(c.state.breakDue).toBe(false)
  })
})

describe('rounding (many small steps add up to the right time)', () => {
  it('eighty steps of 100 ms are exactly 8 s: idle at the demo threshold, not a hair before', () => {
    const { c } = make(DEMO_TIMING)
    for (let i = 0; i < 79; i++) c.update(100, 12)
    expect(c.state.user).toBe('active')
    c.update(100, 12)
    expect(c.state.user).toBe('idle')
  })
  it('two hundred steps of 100 ms are 20 s: asleep at the demo threshold', () => {
    const { c } = make(DEMO_TIMING)
    for (let i = 0; i < 200; i++) c.update(100, 12)
    expect(c.state.user).toBe('asleep')
  })
})

describe('noteInput (the joystick, the button: input that is not mouse or keyboard)', () => {
  it('resets the idle clock like a mouse move would, and wakes a sleeping dog (once)', () => {
    const { c, notes } = make()
    wait(c, 301)
    expect(c.state.user).toBe('asleep')
    notes.length = 0
    c.noteInput()
    expect(c.state.user).toBe('active')
    expect(notes).toEqual(['returned'])
    c.noteInput()
    expect(notes).toEqual(['returned'])
  })
  it('keeps an active user from drifting to idle while they use only the controller', () => {
    const { c } = make()
    for (let s = 0; s < 200; s++) {
      c.noteInput()
      c.update(1000, 12)
    }
    expect(c.state.user).toBe('active')
  })
})

describe('forceBreakDue (demo button)', () => {
  it('makes the break due at once, and breakHandled still clears it', () => {
    const { c, notes } = make()
    c.forceBreakDue()
    expect(c.state.breakDue).toBe(true)
    expect(notes).toContain('breakDue')
    c.breakHandled()
    expect(c.state.breakDue).toBe(false)
  })
})

describe('late night', () => {
  it('is on from 23:00 to 04:59 and off otherwise', () => {
    const { c } = make()
    const at = (h: number): boolean => {
      c.update(1, h)
      return c.state.lateNight
    }
    expect([22, 23, 0, 3, 4, 5, 12].map(at)).toEqual([false, true, true, true, true, false, false])
  })
})

describe('demo timing (the same logic, short thresholds)', () => {
  it('idle at 8 s, asleep at 20 s', () => {
    const { c } = make(DEMO_TIMING)
    wait(c, 7)
    expect(c.state.user).toBe('active')
    wait(c, 1)
    expect(c.state.user).toBe('idle')
    wait(c, 11)
    expect(c.state.user).toBe('idle')
    wait(c, 1)
    expect(c.state.user).toBe('asleep')
  })
  it('steady typing after 3 s at 2 keys/s; break due after 90 s of work, a real break is 10 s', () => {
    const { c } = make(DEMO_TIMING)
    type(c, 3, 2)
    expect(c.state.user).toBe('typing')
    const d = make(DEMO_TIMING).c
    for (let s = 0; s < 90; s++) {
      mouse(d)
      d.update(1000, 12)
    }
    expect(d.state.breakDue).toBe(true)
    d.breakHandled()
    wait(d, 10)
    for (let s = 0; s < 50; s++) {
      mouse(d)
      d.update(1000, 12)
    }
    expect(d.state.breakDue).toBe(false)
  })
})

describe('robustness', () => {
  it('ignores a non-finite or non-positive dt, and garbage numbers in events', () => {
    const { c } = make()
    c.update(Number.NaN, 12)
    c.update(-5, 12)
    c.update(0, 12)
    c.onEvent({ kind: 'typing', keysPerSec: Number.NaN, backspaceRatio: Number.NaN })
    c.onEvent({ kind: 'mouse', x: 0, y: 0, speed: Number.NaN })
    c.onEvent({ kind: 'idle', seconds: Number.NaN })
    c.onEvent({ kind: 'idle', seconds: -4 })
    expect(c.state.user).toBe('active')
    expect(c.state.backspaceSpam).toBe(false)
  })
  it('stays sane through 20,000 random events and steps', () => {
    let seed = 99
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const { c } = make(DEMO_TIMING)
    const valid = ['active', 'typing', 'focus', 'idle', 'asleep']
    for (let i = 0; i < 20000; i++) {
      const r = rand()
      if (r < 0.3) typing(c, rand() * 8, rand())
      else if (r < 0.5) mouse(c, rand() * 500)
      else if (r < 0.6) c.onEvent({ kind: 'idle', seconds: rand() * 600 })
      else c.update(rand() * 4000, Math.floor(rand() * 24))
      expect(valid).toContain(c.state.user)
    }
  })
})
