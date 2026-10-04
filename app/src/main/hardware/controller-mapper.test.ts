// Controller mapper (P3 serial, phase A): turns the Arduino's raw messages (joystick position,
// button, touch) into the app's InputEvents, the same events the mouse slingshot makes. The stick
// works like a slingshot: pull it back, the ball flies the opposite way; let go and it throws.
// Expected angles and powers are hand-worked, not recomputed from the implementation.
import { describe, expect, it } from 'vitest'
import type { InputEvent } from '@shared/input'
import type { ArduinoMessage } from '@shared/serial'
import { ControllerMapper, MAPPER } from './controller-mapper'

class Rig {
  readonly events: InputEvent[] = []
  t = 0
  constructor(readonly m = new ControllerMapper()) {}
  private emit = (e: InputEvent): void => {
    this.events.push(e)
  }
  feed(msg: ArduinoMessage, dtMs = 33): void {
    this.t += dtMs
    this.m.feed(msg, this.t, this.emit)
  }
  /** Joystick at (x, y) on the board's 0..1023 scale. */
  joy(x: number, y: number, dtMs = 33): void {
    this.feed({ kind: 'joystick', x, y }, dtMs)
  }
  button(down: boolean, dtMs = 33): void {
    this.feed({ kind: 'button', down }, dtMs)
  }
  touch(down: boolean, dtMs = 33): void {
    this.feed({ kind: 'touch', down }, dtMs)
  }
  /** Time passes with no messages (the reader ticks every ~50 ms). */
  wait(ms: number): void {
    for (let left = ms; left > 0; left -= 50) {
      this.t += Math.min(50, left)
      this.m.tick(this.t, this.emit)
    }
  }
  of(kind: InputEvent['kind']): InputEvent[] {
    return this.events.filter((e) => e.kind === kind)
  }
}
/** A rig whose stick has settled at the middle (the first message sets the centre). */
function ready(): Rig {
  const r = new Rig()
  r.joy(512, 512)
  return r
}

describe('the joystick, like a slingshot', () => {
  it('sits at the middle: nothing happens (the first reading is taken as the centre)', () => {
    const r = ready()
    r.joy(512, 512)
    r.joy(515, 510)
    expect(r.events).toEqual([])
  })

  it('pulled down 60%: aims straight UP with power 0.6 (the ball flies opposite to the pull)', () => {
    const r = ready()
    r.joy(512, 820) // (820 - 512) / 512 = 0.6016
    expect(r.events).toHaveLength(1)
    const e = r.events[0] as Extract<InputEvent, { kind: 'aim' }>
    expect(e.kind).toBe('aim')
    expect(e.angle).toBeCloseTo(-Math.PI / 2, 6) // up (y is down on screen)
    expect(e.power).toBeCloseTo(0.6016, 3)
  })

  it('pulled left: aims right; pulled right: aims left', () => {
    const left = ready()
    left.joy(100, 512) // dx = -0.8047
    expect((left.events[0] as { angle: number }).angle).toBeCloseTo(0, 6)
    const right = ready()
    right.joy(924, 512)
    expect(Math.abs((right.events[0] as { angle: number }).angle)).toBeCloseTo(Math.PI, 6)
  })

  it('pulled down-left: aims up-right, 45 degrees, power 0.707 x the pull', () => {
    const r = ready()
    r.joy(512 - 300, 512 + 300)
    const e = r.events[0] as { angle: number; power: number }
    expect(e.angle).toBeCloseTo(-Math.PI / 4, 6)
    expect(e.power).toBeCloseTo(Math.hypot(300, 300) / 512, 6)
  })

  it('power is capped at 1 however hard it is pushed', () => {
    const r = ready()
    r.joy(0, 1023)
    expect((r.events[0] as { power: number }).power).toBe(1)
  })

  it('a stick that does not rest exactly at 512 works: the first reading is the centre', () => {
    const r = new Rig()
    r.joy(540, 495)
    r.joy(540, 495)
    expect(r.events).toEqual([])
    r.joy(540, 800) // 305 / 512 = 0.5957
    expect((r.events[0] as { power: number }).power).toBeCloseTo(0.5957, 3)
  })

  it('but a first reading that is clearly NOT at rest (the stick was already pulled) falls back to 512', () => {
    const r = new Rig()
    r.joy(100, 900)
    expect(r.events).toHaveLength(1) // 512-based: this is a big pull, so it aims
    expect(r.of('aim')).toHaveLength(1)
  })

  it('aim starts at 25% of a pull and not below (a little wobble does nothing)', () => {
    const r = ready()
    r.joy(512, 512 + 120) // 0.2344
    expect(r.events).toEqual([])
    r.joy(512, 512 + 130) // 0.2539
    expect(r.of('aim')).toHaveLength(1)
  })

  it('keeps sending aim updates while pulled (the direction and power follow the stick)', () => {
    const r = ready()
    r.joy(512, 700)
    r.joy(512, 800)
    r.joy(400, 800)
    expect(r.of('aim')).toHaveLength(3)
    expect((r.events[2] as { angle: number }).angle).toBeGreaterThan(-Math.PI / 2) // swung to the right
  })
})

describe('letting go throws', () => {
  it('pull to 80%, let go back to the middle: launch with the strongest pull, once', () => {
    const r = ready()
    r.joy(512, 700)
    r.joy(512, 922) // 0.8008: the peak
    r.joy(512, 700)
    r.joy(512, 520) // released
    const launch = r.of('launch') as Extract<InputEvent, { kind: 'launch' }>[]
    expect(launch).toHaveLength(1)
    expect(launch[0]!.power).toBeCloseTo(0.8008, 3)
    expect(launch[0]!.angle).toBeCloseTo(-Math.PI / 2, 6)
    r.joy(512, 512)
    r.joy(512, 515)
    expect(r.of('launch')).toHaveLength(1)
  })

  it('the launch keeps the direction of the PEAK pull, not where the stick wobbled on the way back', () => {
    const r = ready()
    r.joy(512 - 300, 512 + 300) // peak: down-left
    r.joy(512 - 100, 512 + 250) // returning, direction drifts
    r.joy(512, 512)
    const l = r.of('launch')[0] as { angle: number; power: number }
    expect(l.angle).toBeCloseTo(-Math.PI / 4, 6)
    expect(l.power).toBeCloseTo(Math.hypot(300, 300) / 512, 6)
  })

  it('a weak pull (peak under 35%) that is let go is NOT a throw: just nothing', () => {
    const r = ready()
    r.joy(512, 512 + 170) // 0.332
    r.joy(512, 512)
    expect(r.of('launch')).toEqual([])
  })

  it('exactly at the 35% line throws', () => {
    const r = ready()
    r.joy(512, 512 + Math.ceil(0.35 * 512))
    r.joy(512, 512)
    expect(r.of('launch')).toHaveLength(1)
  })

  it('the stick has to get back near the middle (under 15%) before it counts as let go', () => {
    const r = ready()
    r.joy(512, 900)
    r.joy(512, 512 + 100) // 0.195: still held
    expect(r.of('launch')).toEqual([])
    r.joy(512, 512 + 60) // 0.117: let go
    expect(r.of('launch')).toHaveLength(1)
  })

  it('two throws in a row each launch', () => {
    const r = ready()
    for (let i = 0; i < 2; i++) {
      r.joy(512, 900)
      r.joy(512, 512)
    }
    expect(r.of('launch')).toHaveLength(2)
  })

  it('pressing the button while aiming throws AT ONCE, and is not also a "call"', () => {
    const r = ready()
    r.joy(512, 850) // 0.66
    r.button(true)
    expect(r.of('launch')).toHaveLength(1)
    expect((r.of('launch')[0] as { power: number }).power).toBeCloseTo(0.6602, 3)
    r.button(false)
    r.wait(1000)
    expect(r.of('call')).toEqual([])
    expect(r.of('pushToTalk')).toEqual([])
    // the stick is still pulled: that must not start a brand-new aim, and letting go must not throw again
    const aims = r.of('aim').length
    r.joy(512, 850)
    r.joy(512, 880)
    expect(r.of('aim')).toHaveLength(aims)
    r.joy(512, 512)
    expect(r.of('launch')).toHaveLength(1)
  })

  it('the button only throws if the stick is really pulled (25%+): with the stick drifting back near the middle it is just a tap', () => {
    const r = ready()
    r.joy(512, 900) // aiming
    r.joy(512, 512 + 100) // drifts back to 0.195: still "aiming" (so it does not flicker), but barely pulled
    r.button(true)
    r.button(false, 100)
    expect(r.of('launch')).toEqual([])
    expect(r.of('call')).toHaveLength(1)
  })

  it('a stick held pulled for 8 seconds is given up on: no throw, and it needs a real release to start again', () => {
    const r = ready()
    r.joy(512, 900)
    r.wait(8100)
    r.joy(512, 900)
    r.joy(512, 512)
    expect(r.of('launch')).toEqual([])
    const before = r.of('aim').length
    r.joy(512, 900) // a fresh pull after the release works again
    expect(r.of('aim').length).toBe(before + 1)
  })
})

describe('the button: a tap calls, a hold talks', () => {
  it('a quick tap (under 0.4 s) is a call, sent on release', () => {
    const r = ready()
    r.button(true)
    r.wait(300)
    expect(r.events).toEqual([])
    r.button(false)
    expect(r.events).toEqual([{ kind: 'call' }])
  })

  it('held for 0.4 s: push-to-talk starts (without waiting for a release), and stops on release; no call', () => {
    const r = ready()
    r.button(true)
    r.wait(350)
    expect(r.of('pushToTalk')).toEqual([])
    r.wait(100)
    expect(r.events).toEqual([{ kind: 'pushToTalk', state: 'start' }])
    r.wait(2000)
    r.button(false)
    expect(r.events).toEqual([
      { kind: 'pushToTalk', state: 'start' },
      { kind: 'pushToTalk', state: 'stop' }
    ])
  })

  it('the 0.4 s line itself: a tap of 399 ms calls, 401 ms talks', () => {
    const tap = ready()
    tap.button(true)
    tap.t += 399
    tap.button(false, 0)
    expect(tap.of('call')).toHaveLength(1)
    const hold = ready()
    hold.button(true)
    hold.t += 401
    hold.button(false, 0)
    expect(hold.of('call')).toEqual([])
  })

  it('a button already down when the board says hello does not start talking by itself in the first tick', () => {
    const r = ready()
    r.wait(2000)
    expect(r.events).toEqual([])
  })

  it('a stuck button (held 30 s) talks once and stops once, not repeatedly', () => {
    const r = ready()
    r.button(true)
    r.wait(30_000)
    expect(r.of('pushToTalk')).toHaveLength(1)
  })
})

describe('the touch sensor pets', () => {
  it('touching sends a pet from the touch sensor, once per touch', () => {
    const r = ready()
    r.touch(true)
    r.touch(false)
    expect(r.events).toEqual([{ kind: 'pet', source: 'touch' }])
  })

  it('a flicker of touches within a second is one pet; a second touch later is another', () => {
    const r = ready()
    r.touch(true, 100)
    r.touch(false, 100)
    r.touch(true, 100)
    expect(r.of('pet')).toHaveLength(1)
    r.touch(false, 100)
    r.touch(true, 1000)
    expect(r.of('pet')).toHaveLength(2)
  })

  it('letting go of the touch sensor sends nothing', () => {
    const r = ready()
    r.touch(false)
    expect(r.events).toEqual([])
  })
})

describe('the board saying hello, and unplugging', () => {
  it('a hello (even repeated every 2 s forever) changes nothing', () => {
    const r = ready()
    for (let i = 0; i < 10; i++) {
      r.feed({ kind: 'hello', version: 1 }, 2000)
      r.m.tick(r.t, (e) => r.events.push(e))
    }
    expect(r.events).toEqual([])
  })

  it('unplugging while talking ends the push-to-talk; unplugging while aiming just stops (no throw)', () => {
    const r = ready()
    r.button(true)
    r.wait(500)
    r.m.reset((e) => r.events.push(e))
    expect(r.of('pushToTalk').map((e) => (e as { state: string }).state)).toEqual(['start', 'stop'])

    const a = ready()
    a.joy(512, 900)
    a.m.reset((e) => a.events.push(e))
    expect(a.of('launch')).toEqual([])
  })

  it('after a reset the centre is measured again: a stick whose rest point moved does not look pulled', () => {
    const r = new Rig()
    r.joy(572, 452) // the old rest point (within the rest window)
    r.m.reset(() => undefined)
    r.joy(452, 572) // the new rest point: 0.33 away from the old one
    r.joy(452, 572)
    expect(r.events).toEqual([])
  })

  it('after a reset the centre is measured again (a different stick or a replug)', () => {
    const r = ready()
    r.m.reset(() => undefined)
    r.joy(600, 600)
    r.joy(600, 600)
    expect(r.events).toEqual([])
  })
})

describe('orientation (set once on the real hardware)', () => {
  it('flipping the Y direction swaps up and down', () => {
    const r = new Rig(new ControllerMapper({ invertY: true }))
    r.joy(512, 512)
    r.joy(512, 820)
    expect((r.events[0] as { angle: number }).angle).toBeCloseTo(Math.PI / 2, 6)
  })

  it('flipping X swaps left and right', () => {
    const r = new Rig(new ControllerMapper({ invertX: true }))
    r.joy(512, 512)
    r.joy(100, 512)
    expect(Math.abs((r.events[0] as { angle: number }).angle)).toBeCloseTo(Math.PI, 6)
  })

  it('swapping the axes (the stick mounted sideways) makes X act as Y', () => {
    const r = new Rig(new ControllerMapper({ swapXY: true }))
    r.joy(512, 512)
    r.joy(820, 512) // now "pulled down"
    expect((r.events[0] as { angle: number }).angle).toBeCloseTo(-Math.PI / 2, 6)
  })

  it('the numbers are what the plan promised', () => {
    expect(MAPPER.aimStart).toBe(0.25)
    expect(MAPPER.launchMin).toBe(0.35)
    expect(MAPPER.releaseBelow).toBe(0.15)
    expect(MAPPER.tapMaxMs).toBe(400)
    expect(MAPPER.aimTimeoutMs).toBe(8000)
  })
})

describe('whatever the board sends (fuzz)', () => {
  it('20,000 random messages and ticks: powers stay in 0..1, angles finite, and a throw only follows a real pull', () => {
    let seed = 31
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const r = ready()
    let aims = 0
    let launches = 0
    for (let i = 0; i < 20000; i++) {
      const p = rand()
      if (p < 0.5) r.joy(Math.floor(rand() * 1024), Math.floor(rand() * 1024), rand() * 60)
      else if (p < 0.65) r.button(rand() < 0.5, rand() * 300)
      else if (p < 0.8) r.touch(rand() < 0.5, rand() * 400)
      else if (p < 0.82) r.feed({ kind: 'hello', version: 1 }, 100)
      else if (p < 0.83) r.m.reset((e) => r.events.push(e))
      else r.wait(rand() * 600)
    }
    for (const e of r.events) {
      if (e.kind === 'aim' || e.kind === 'launch') {
        expect(Number.isFinite(e.angle)).toBe(true)
        expect(e.power).toBeGreaterThanOrEqual(0)
        expect(e.power).toBeLessThanOrEqual(1)
        if (e.kind === 'aim') aims++
        else {
          launches++
          expect(e.power).toBeGreaterThanOrEqual(MAPPER.aimStart)
        }
      }
    }
    expect(launches).toBeLessThanOrEqual(aims)
  })
})
