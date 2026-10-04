// Behaviour (P2 Task 4): the personality. Needs + activity + fetch + the reactions table + the
// arbiter, put together. The ball is the real physics; the dog is a fake that runs at the real gait
// speeds and records what it was asked to do. Demo timing (idle 8 s, asleep 20 s, break due 90 s)
// keeps the scenarios short; the logic is the same as the real timing.
import { describe, expect, it } from 'vitest'
import type { ActivityEvent, WindowRect } from '@shared/os'
import { createBall, stepBall } from '../world/ball'
import type { Ball } from '../world/ball'
import { World } from '../world/world-sdf'
import { Behaviour } from './behaviour'
import { FakeDog } from './fake-dog'
import { BEHAVIOUR_TIMING, DEMO_TIMING } from './timing'

const FRAME = 16.667
const GROUND = 1032

interface H {
  b: Behaviour
  dog: FakeDog
  ball: Ball
  world: World
  hour: { value: number }
  /** Seconds the OS has said the user has been idle (the tests' own bookkeeping). */
  idleSec: number
}

function mk(opts: { dogX?: number; timing?: typeof DEMO_TIMING; hour?: number } = {}): H {
  const world = new World()
  world.setBounds({ x: 0, y: 0, w: 1920, h: GROUND })
  const dog = new FakeDog(opts.dogX ?? 1500, GROUND)
  const ball = createBall(900, GROUND - 10)
  ball.resting = true
  const hour = { value: opts.hour ?? 12 }
  const b = new Behaviour({
    dog,
    ball,
    world,
    groundY: () => GROUND,
    timing: opts.timing ?? DEMO_TIMING,
    hitTest: (x, y) => Math.abs(x - dog.x) < 60 && y > dog.y - 130 && y < dog.y,
    hour: () => hour.value
  })
  return { b, dog, ball, world, hour, idleSec: 0 }
}
function frame(h: H): void {
  stepBall(h.ball, h.world, FRAME)
  h.b.update(FRAME)
  h.dog.update(FRAME)
}
function run(h: H, seconds: number): void {
  for (let left = seconds * 1000; left > 0; left -= FRAME) frame(h)
}
const mouse = (h: H, x = 1000, speed = 100): void => {
  if (speed > 0) h.idleSec = 0
  h.b.handleActivity({ kind: 'mouse', x, y: 900, speed })
}
/** The user stays active (moves the mouse a little) for `seconds`. */
function activeFor(h: H, seconds: number, x = 1000): void {
  for (let s = 0; s < seconds; s++) {
    mouse(h, x, 50)
    run(h, 1)
  }
}
/** The user types for `seconds`, with a typing event every 0.5 s like the real tracker. */
function type(h: H, seconds: number, keysPerSec = 3, ratio = 0): void {
  h.idleSec = 0
  for (let i = 0; i < seconds * 2; i++) {
    h.b.handleActivity({ kind: 'typing', keysPerSec, backspaceRatio: ratio })
    run(h, 0.5)
  }
}
/** Time passes and the OS reports idle time, once a second, as the tracker does (cumulative). */
function idleFor(h: H, seconds: number): void {
  for (let s = 0; s < seconds; s++) {
    run(h, 1)
    h.idleSec += 1
    h.b.handleActivity({ kind: 'idle', seconds: h.idleSec })
  }
}
const win = (x: number, w: number, z = 0): WindowRect => ({
  id: `w${z}`,
  title: '',
  x,
  y: 200,
  w,
  h: 500,
  z,
  minimized: false
})
const poses = (d: FakeDog): string[] =>
  d.log.filter((l) => l.startsWith('pose ')).map((l) => l.slice(5))

describe('doing nothing', () => {
  it('a fresh dog with an active user just stands there: nobody owns it, nothing is ordered', () => {
    const h = mk()
    for (let s = 0; s < 6; s++) {
      mouse(h)
      run(h, 1)
    }
    expect(h.b.arbiter.owner).toBe('none')
    expect(h.dog.log).toEqual([])
  })
})

describe('idle and sleep', () => {
  it('idle: sits down and gets a little sleepy; moving the mouse stands it up again', () => {
    const h = mk()
    idleFor(h, 8)
    expect(h.b.reaction).toBe('idle')
    expect(h.dog.pose).toBe('sit')
    expect(h.dog.moods.some((m) => m.startsWith('sleepy'))).toBe(true)
    mouse(h)
    run(h, 0.5)
    expect(h.b.reaction).toBe('')
    expect(h.dog.pose).toBe('stand')
  })

  it('asleep: lies down asleep with a sleepy mood, and recovers energy and calms boredom while it sleeps', () => {
    const h = mk()
    h.b.needs.energy = 0.3
    h.b.needs.boredom = 0.5
    idleFor(h, 20)
    expect(h.b.reaction).toBe('sleep')
    expect(h.dog.pose).toBe('sleep')
    const e = h.b.needs.energy
    const bo = h.b.needs.boredom
    idleFor(h, 10)
    expect(h.b.needs.energy).toBeGreaterThan(e)
    expect(h.b.needs.boredom).toBeLessThan(bo)
  })

  it('late at night it is sleepier: a stronger sleepy mood when it sits idle', () => {
    const day = mk({ hour: 12 })
    const night = mk({ hour: 23 })
    idleFor(day, 9)
    idleFor(night, 9)
    const strength = (d: FakeDog): number =>
      Number(
        d.moods
          .filter((m) => m.startsWith('sleepy'))
          .pop()!
          .split(' ')[1]
      )
    expect(strength(night.dog)).toBeGreaterThan(strength(day.dog))
  })
})

describe('the welcome back', () => {
  it('stretches, yawns, trots to the cursor and is happy, then goes back to normal life', () => {
    const h = mk()
    idleFor(h, 21) // asleep
    mouse(h, 400, 300)
    run(h, 0.2)
    expect(h.b.reaction).toBe('greet')
    activeFor(h, 14, 400)
    expect(poses(h.dog)).toContain('stretch')
    expect(h.dog.idles).toContain('yawn')
    expect(h.dog.moves.some((m) => m.gait === 'trot' && Math.abs(m.x - 400) < 30)).toBe(true)
    expect(h.dog.moods.some((m) => m.startsWith('happy'))).toBe(true)
    expect(Math.abs(h.dog.x - 400)).toBeLessThan(30)
    activeFor(h, 3, 400)
    expect(h.b.reaction).toBe('')
  })

  it('only greets after real sleep, not after just sitting idle', () => {
    const h = mk()
    idleFor(h, 10)
    mouse(h)
    run(h, 2)
    expect(h.b.reaction).not.toBe('greet')
  })
})

describe('typing', () => {
  it('steady typing: walks to the floor below the active window and lies down; ears perk with the typing', () => {
    const h = mk()
    h.b.setWindows([win(700, 400), win(100, 300, 1)])
    type(h, 4, 3)
    expect(h.b.reaction).toBe('typing')
    expect(h.dog.moves.some((m) => m.gait === 'walk' && Math.abs(m.x - 900) < 5)).toBe(true) // centre of the topmost window
    type(h, 8, 3) // keeps typing while it walks over (about 5 s) and lies down
    expect(h.dog.pose).toBe('lie')
    expect(h.dog.layers.some((l) => (l.earPerk ?? 0) > 0)).toBe(true)
  })

  it('without any windows it lies down right where it is', () => {
    const h = mk({ dogX: 500 })
    type(h, 4, 3)
    run(h, 2)
    expect(h.dog.pose).toBe('lie')
    expect(h.dog.moves.every((m) => Math.abs(m.x - 500) < 5)).toBe(true)
  })

  it('stops typing: gets up again', () => {
    const h = mk()
    type(h, 4, 3)
    h.b.handleActivity({ kind: 'typing', keysPerSec: 0, backspaceRatio: 0 })
    mouse(h)
    run(h, 6)
    expect(h.b.reaction).not.toBe('typing')
    expect(h.dog.pose).toBe('stand')
  })

  it('long hard typing: dozes beside you (lies down, sleepy mood)', () => {
    const h = mk()
    type(h, 16, 4)
    expect(h.b.reaction).toBe('focus')
    type(h, 3, 4)
    expect(h.dog.pose).toBe('lie')
    expect(h.dog.moods.some((m) => m.startsWith('sleepy'))).toBe(true)
  })

  it('backspace spam: a confused head tilt, once, then not again for 20 s', () => {
    const h = mk()
    type(h, 4, 3)
    type(h, 3, 5, 0.5)
    const tilts = (): number => poses(h.dog).filter((p) => p === 'headTilt').length
    expect(tilts()).toBe(1)
    type(h, 8, 5, 0.5)
    expect(tilts()).toBe(1)
    type(h, 14, 5, 0.5) // past the 20 s cooldown
    expect(tilts()).toBe(2)
  })
})

describe('bringing the ball', () => {
  it('break time (90 s of work in demo timing): fetches the ball, drops it by the cursor, and the break is handled', () => {
    const h = mk()
    for (let s = 0; s < 95; s++) {
      mouse(h, 1200)
      run(h, 1)
    }
    activeFor(h, 30, 1200) // the user stays at it, so a real pause cannot be what clears the flag
    expect(h.b.fetch.state).toBe('idle')
    expect(h.dog.log.filter((l) => l === 'attach true')).toHaveLength(1)
    expect(h.dog.log).toContain('attach false')
    expect(Math.abs(h.dog.x - 1200)).toBeLessThan(10)
    expect(h.b.activity.state.breakDue).toBe(false)
    expect(poses(h.dog)).toContain('playBow')
  })

  it('a bored dog with energy brings the ball once, and does not nag again for a while', () => {
    const h = mk()
    h.b.needs.boredom = 0.8
    h.b.needs.energy = 0.9
    mouse(h, 1200)
    run(h, 25)
    const attaches = (): number => h.dog.log.filter((l) => l === 'attach true').length
    expect(attaches()).toBe(1)
    h.b.needs.boredom = 0.8
    h.b.needs.energy = 0.9
    for (let s = 0; s < 15; s++) {
      mouse(h, 1200)
      run(h, 1)
    }
    expect(attaches()).toBe(1)
  })

  it('a bored dog that is TIRED does not bring the ball', () => {
    const h = mk()
    h.b.needs.boredom = 0.9
    h.b.needs.energy = 0.2
    mouse(h)
    run(h, 10)
    expect(h.dog.log).not.toContain('attach true')
  })

  it('cannot bring a ball that is up on a window: it just does not (and nothing breaks)', () => {
    const h = mk()
    h.world.setSolids([{ x: 800, y: 600, w: 300, h: 432 }])
    h.ball.x = 900
    h.ball.y = 590
    h.b.needs.boredom = 0.9
    h.b.needs.energy = 0.9
    mouse(h)
    run(h, 10)
    expect(h.dog.log).not.toContain('attach true')
    expect(h.b.fetch.state).toBe('idle')
  })
})

describe('resting when worn out', () => {
  it('lies down when energy is low, and stays down until it has recovered to 60%', () => {
    const h = mk()
    h.b.needs.energy = 0.2
    mouse(h)
    run(h, 1)
    expect(h.b.reaction).toBe('rest')
    expect(h.dog.pose).toBe('lie')
    for (let s = 0; s < 20; s++) {
      mouse(h)
      run(h, 1)
    }
    expect(h.b.needs.energy).toBeLessThan(0.6)
    expect(h.b.reaction).toBe('rest')
    for (let s = 0; s < 40; s++) {
      mouse(h)
      run(h, 1)
    }
    expect(h.b.needs.energy).toBeGreaterThanOrEqual(0.6)
    expect(h.b.reaction).not.toBe('rest')
  })
})

describe('the cursor', () => {
  it('hovering over the dog: looks at the cursor, wags, is happy; moving away ends it', () => {
    const h = mk()
    h.b.setCursor(h.dog.x, h.dog.y - 50, 50)
    run(h, 0.6)
    expect(h.b.reaction).toBe('hover')
    expect(h.dog.moods.some((m) => m.startsWith('happy'))).toBe(true)
    expect(h.dog.layers.some((l) => (l.tailWag ?? 0) >= 0.9)).toBe(true)
    const look = h.dog.looks[h.dog.looks.length - 1]
    expect(look && Math.abs(look.x - h.dog.x) < 5).toBe(true)
    h.b.setCursor(100, 300, 50)
    run(h, 1.5)
    expect(h.b.reaction).not.toBe('hover')
  })

  it('a cursor that only brushes past the dog does not count as hovering', () => {
    const h = mk()
    h.b.setCursor(h.dog.x, h.dog.y - 50, 50)
    run(h, 0.2)
    h.b.setCursor(100, 300, 50)
    run(h, 2)
    expect(h.dog.moods.some((m) => m.startsWith('happy'))).toBe(false)
    expect(h.dog.layers.some((l) => (l.tailWag ?? 0) >= 0.9)).toBe(false)
  })

  it('looks at a cursor that has moved recently and loses interest after 3 s', () => {
    const h = mk()
    h.b.setCursor(300, 300, 80)
    run(h, 0.2)
    const look = h.dog.looks[h.dog.looks.length - 1]
    expect(look && Math.abs(look.x - 300) < 5).toBe(true)
    run(h, 3.5)
    expect(h.dog.looks[h.dog.looks.length - 1]).toBeNull()
  })

  it('a cursor shaken fast, far away: excited play-bow, then runs to it; then a 15 s cooldown', () => {
    const h = mk()
    for (let i = 0; i < 8; i++) {
      h.b.setCursor(300, 400, 3000)
      run(h, 0.1)
    }
    expect(h.b.reaction).toBe('shake')
    run(h, 5)
    expect(poses(h.dog)).toContain('playBow')
    expect(h.dog.moves.some((m) => m.gait === 'run' && Math.abs(m.x - 300) < 30)).toBe(true)
    const bows = (): number => poses(h.dog).filter((p) => p === 'playBow').length
    const n = bows()
    for (let i = 0; i < 8; i++) {
      h.b.setCursor(1700, 400, 3000)
      run(h, 0.1)
    }
    run(h, 3)
    expect(bows()).toBe(n)
  })
})

describe('petting', () => {
  it('a pet: happy, leans in (head tilt), boredom drops, and nothing interrupts it for a moment', () => {
    const h = mk()
    h.b.needs.boredom = 0.5
    h.b.handleInput({ kind: 'pet', source: 'mouse' })
    run(h, 0.2)
    expect(h.b.arbiter.owner).toBe('command')
    expect(h.dog.moods.some((m) => m.startsWith('happy'))).toBe(true)
    expect(poses(h.dog)).toContain('headTilt')
    expect(h.b.needs.boredom).toBeCloseTo(0.2, 1)
    run(h, 3)
    expect(h.b.arbiter.owner).toBe('none')
  })
})

describe('who is in charge (the arbiter at work)', () => {
  it('a throw while it is lying beside you: it gets up and fetches, then goes back to lying down', () => {
    const h = mk()
    type(h, 4, 3)
    type(h, 6, 3)
    expect(h.dog.pose).toBe('lie')
    h.ball.resting = false
    h.ball.vx = 700
    h.ball.vy = -900
    h.b.handleInput({ kind: 'launch', angle: -1, power: 1 })
    run(h, 2)
    expect(h.b.arbiter.owner).toBe('fetch')
    expect(h.b.reaction).toBe('')
    // the lying-down reaction was told to tidy up when the fetch took the dog (ears back to normal)
    expect(h.dog.layers[h.dog.layers.length - 1]).toEqual({ earPerk: 0, breathing: 1 })
    for (let i = 0; i < 80; i++) {
      type(h, 0.5, 3)
    }
    expect(h.b.fetch.state).toBe('idle')
    expect(h.dog.log).toContain('attach true')
  })

  it('falling asleep in the middle of a fetch must not drop the ball: the sleep waits', () => {
    const h = mk()
    h.ball.resting = false
    h.ball.vx = 700
    h.ball.vy = -900
    h.b.handleInput({ kind: 'launch', angle: -1, power: 1 })
    let slept = false
    for (let s = 1; s <= 40; s++) {
      h.b.handleActivity({ kind: 'idle', seconds: 20 + s })
      run(h, 1)
      if (h.b.fetch.carrying && h.dog.pose === 'sleep') slept = true
    }
    expect(slept).toBe(false)
    expect(h.dog.attached).toBe(h.b.fetch.carrying)
  })

  it('while fetching, the dog watches the ball, not the cursor', () => {
    const h = mk()
    h.ball.resting = false
    h.ball.vx = 700
    h.ball.vy = -900
    h.b.handleInput({ kind: 'launch', angle: -1, power: 1 })
    for (let i = 0; i < 20; i++) {
      h.b.setCursor(50, 50, 400)
      run(h, 0.05)
    }
    const looks = h.dog.looks.filter((l) => l !== null).slice(-5)
    expect(looks.every((l) => l!.x > 200 || l!.y > 200)).toBe(true) // never the (50, 50) cursor
  })

  it('a click-style command holds the dog: no reaction starts during it', () => {
    const h = mk()
    h.b.userCommand(10000)
    idleFor(h, 8)
    expect(h.b.reaction).toBe('')
    expect(h.b.arbiter.owner).toBe('command')
    idleFor(h, 4) // 12 s in: the command has run out
    expect(h.b.reaction).toBe('idle')
  })
})

describe('how often it needs to be drawn (the frame-rate tier)', () => {
  it('an active user, nothing going on: full speed', () => {
    const h = mk()
    activeFor(h, 3)
    expect(h.b.fpsTier()).toBe('full')
  })

  it('sitting idle: full speed while it settles into the pose, then resting speed', () => {
    const h = mk()
    idleFor(h, 8)
    expect(h.b.reaction).toBe('idle')
    expect(h.b.fpsTier()).toBe('full')
    idleFor(h, 2)
    expect(h.b.fpsTier()).toBe('rest')
  })

  it('asleep: sleep speed (once it has settled)', () => {
    const h = mk()
    idleFor(h, 20)
    expect(h.b.fpsTier()).toBe('full')
    idleFor(h, 2)
    expect(h.b.fpsTier()).toBe('sleep')
  })

  it('touching the mouse or keyboard wakes it AT ONCE: full speed before the next (slow) update even runs', () => {
    const h = mk()
    idleFor(h, 25)
    expect(h.b.fpsTier()).toBe('sleep')
    mouse(h, 400, 300) // no frame has run since
    expect(h.b.fpsTier()).toBe('full')

    const g = mk()
    idleFor(g, 25)
    g.b.handleActivity({ kind: 'typing', keysPerSec: 3, backspaceRatio: 0 })
    expect(g.b.fpsTier()).toBe('full')
  })

  it('a mouse event with speed 0 (the cursor is just sitting there) does not wake it', () => {
    const h = mk()
    idleFor(h, 25)
    h.b.handleActivity({ kind: 'mouse', x: 5, y: 5, speed: 0 })
    h.b.handleActivity({ kind: 'typing', keysPerSec: 0, backspaceRatio: 0 })
    expect(h.b.fpsTier()).toBe('sleep')
  })

  it('stays awake for a second after the touch, then the usual rules apply again', () => {
    const h = mk()
    idleFor(h, 25)
    mouse(h, 400, 300)
    expect(h.b.fpsTier()).toBe('full')
    activeFor(h, 3, 400) // the greeting plays, the user stays active: nothing slow
    expect(h.b.fpsTier()).toBe('full')
  })

  it('fetching: full speed, even if the user has gone idle or to sleep', () => {
    const h = mk()
    idleFor(h, 25)
    h.ball.resting = false
    h.ball.vx = 700
    h.ball.vy = -900
    h.b.handleInput({ kind: 'launch', angle: -1, power: 1 })
    for (let i = 0; i < 60; i++) {
      run(h, 0.25)
      expect(h.b.fpsTier()).toBe('full')
      if (!h.b.fetch.active) break
    }
  })

  it('lying beside you while you type: full speed while it walks over, resting speed once it is down', () => {
    const h = mk()
    h.b.setWindows([win(100, 300)]) // the floor spot is far from the dog at x = 1500
    type(h, 4, 3)
    expect(h.b.reaction).toBe('typing')
    expect(h.b.fpsTier()).toBe('full') // still walking over
    type(h, 12, 3) // arrives (about 8 s of walking) and settles
    expect(h.dog.pose).toBe('lie')
    type(h, 3, 3)
    expect(h.b.fpsTier()).toBe('rest')
  })

  it('a pet, a greeting or a cursor-shake: full speed', () => {
    const h = mk()
    h.b.handleInput({ kind: 'pet', source: 'mouse' })
    run(h, 0.5)
    expect(h.b.fpsTier()).toBe('full')

    const g = mk()
    for (let i = 0; i < 8; i++) {
      g.b.setCursor(300, 400, 3000)
      run(g, 0.1)
    }
    expect(g.b.reaction).toBe('shake')
    expect(g.b.fpsTier()).toBe('full')
  })
})

describe('long frames (the slow rate): time still passes at the right speed', () => {
  it('one 200 ms update counts as 200 ms, not 100: eight idle seconds at 5 frames a second are eight seconds', () => {
    const h = mk()
    for (let i = 0; i < 40; i++) {
      h.b.update(200)
      h.dog.update(200)
    }
    expect(h.b.activity.state.user).toBe('idle') // demo idle = 8 s
    expect(h.b.reaction).toBe('idle')
  })

  it('a single huge update (a long stall) counts as at most a second', () => {
    const h = mk()
    h.b.update(600_000)
    expect(h.b.activity.state.idleSec).toBeLessThan(1.1)
  })

  it('one 200 ms update does the same as two 100 ms ones (the needs too)', () => {
    const a = mk()
    const b = mk()
    a.b.needs.energy = 0.5
    b.b.needs.energy = 0.5
    for (let i = 0; i < 25; i++) {
      a.b.update(200)
      b.b.update(100)
      b.b.update(100)
    }
    expect(a.b.needs.boredom).toBeCloseTo(b.b.needs.boredom, 6)
    expect(a.b.needs.attention).toBeCloseTo(b.b.needs.attention, 6)
    expect(a.b.activity.state.idleSec).toBeCloseTo(b.b.activity.state.idleSec, 6)
  })
})

describe('real timing', () => {
  it('with the real thresholds, 59 s idle does nothing and 60 s sits', () => {
    const h = mk({ timing: BEHAVIOUR_TIMING })
    idleFor(h, 59)
    expect(h.b.reaction).toBe('')
    idleFor(h, 1)
    expect(h.b.reaction).toBe('idle')
  })
})

describe('whatever happens, it stays sane (fuzz)', () => {
  // 20 games x 4000 frames of behaviour logic is genuinely heavy (~4s alone); the default 5000ms
  // testTimeout occasionally trips under full-suite parallel load even though the seed is fixed
  // and the test itself isn't flaky (2026-10-04, Ansh — flagged to Daniel).
  it('survives 20 random games of activity, input, cursor and windows', () => {
    let seed = 4242
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let game = 0; game < 20; game++) {
      const h = mk({ dogX: 200 + rand() * 1500 })
      for (let f = 0; f < 4000; f++) {
        const r = rand()
        let e: ActivityEvent | null = null
        if (r < 0.02) e = { kind: 'typing', keysPerSec: rand() * 7, backspaceRatio: rand() }
        else if (r < 0.04)
          e = { kind: 'mouse', x: rand() * 1900, y: rand() * 1000, speed: rand() * 4000 }
        else if (r < 0.05) e = { kind: 'idle', seconds: rand() * 40 }
        if (e) h.b.handleActivity(e)
        else if (r < 0.055) {
          h.ball.resting = false
          h.ball.vx = (rand() - 0.5) * 3000
          h.ball.vy = -rand() * 2500
          h.b.handleInput({ kind: 'launch', angle: 0, power: 1 })
        } else if (r < 0.057) h.b.handleInput({ kind: 'pet', source: 'mouse' })
        else if (r < 0.059) h.b.userCommand(2000)
        else if (r < 0.061)
          h.b.setWindows(rand() < 0.5 ? [] : [win(rand() * 1500, 100 + rand() * 400)])
        else if (r < 0.063) h.hour.value = Math.floor(rand() * 24)
        else if (r < 0.065) {
          h.b.needs.energy = rand()
          h.b.needs.boredom = rand()
        }
        frame(h)
        expect(h.dog.attached, `game ${game} frame ${f}`).toBe(h.b.fetch.carrying)
        for (const v of [h.b.needs.energy, h.b.needs.boredom, h.b.needs.attention]) {
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
        expect(Number.isFinite(h.dog.x)).toBe(true)
      }
      // a quiet minute: nothing may be stuck
      h.ball.held = false
      run(h, 90)
      expect(h.dog.attached).toBe(false)
      expect(h.ball.held).toBe(false)
      expect(h.b.fetch.state).toBe('idle')
    }
  }, 20000)
})
