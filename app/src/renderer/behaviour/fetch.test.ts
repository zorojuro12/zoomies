// Fetch (P2 Task 3): the hero move. You throw the ball; the dog watches it, runs to where it will
// come to rest, picks it up, carries it back and drops it where the dog was standing, then
// celebrates. The ball is the REAL physics; the dog is a fake that runs at the real gait speeds.
// Every path must end with the dog free and no ball stuck in its mouth.
import { describe, expect, it } from 'vitest'
import { createBall, stepBall } from '../world/ball'
import type { Ball } from '../world/ball'
import { World } from '../world/world-sdf'
import { FakeDog } from './fake-dog'
import { Fetch, FETCH } from './fetch'
import type { FetchNote, FetchState } from './fetch'

const FRAME = 16.667
const GROUND = 1032
type Solid = { x: number; y: number; w: number; h: number }

interface H {
  world: World
  dog: FakeDog
  ball: Ball
  fetch: Fetch
  notes: FetchNote[]
}

function setup(
  opts: {
    solids?: Solid[]
    dogX?: number
    ballX?: number
    dropSpot?: 'dogOrigin' | 'ballOrigin'
  } = {}
): H {
  const world = new World()
  world.setBounds({ x: 0, y: 0, w: 1920, h: GROUND })
  world.setSolids(opts.solids ?? [])
  const dog = new FakeDog(opts.dogX ?? 300, GROUND)
  const ball = createBall(opts.ballX ?? 900, GROUND - 10)
  ball.resting = true
  const fetch = new Fetch({ dog, ball, world, groundY: () => GROUND, dropSpot: opts.dropSpot })
  const notes: FetchNote[] = []
  fetch.onNote((n) => notes.push(n))
  return { world, dog, ball, fetch, notes }
}

/** One host frame, in the host's order: ball physics, fetch, dog. */
function frame(h: H, step = true): void {
  if (step) stepBall(h.ball, h.world, FRAME)
  h.fetch.update(FRAME)
  h.dog.update(FRAME)
}
function frames(h: H, n: number, step = true): void {
  for (let i = 0; i < n; i++) frame(h, step)
}
function runFor(h: H, seconds: number): void {
  frames(h, Math.ceil((seconds * 1000) / FRAME))
}
/** The user grabs the resting ball, pulls back and lets go. */
function throwBall(h: H, vx: number, vy: number): void {
  h.ball.resting = false
  h.ball.vx = vx
  h.ball.vy = vy
  h.fetch.launch()
}

describe('the happy path', () => {
  it('watch, run, pick up, carry back, drop, celebrate: the notes come in exactly that order', () => {
    const h = setup()
    throwBall(h, 700, -900)
    runFor(h, 40)
    expect(h.notes).toEqual(['launched', 'pickedUp', 'returning', 'dropped', 'done'])
    expect(h.fetch.state).toBe('idle')
  })

  it('ends with the dog free: nothing in its mouth, ball released, standing', () => {
    const h = setup()
    throwBall(h, 700, -900)
    runFor(h, 40)
    expect(h.dog.attached).toBe(false)
    expect(h.ball.held).toBe(false)
    expect(h.dog.pose).toBe('stand')
    expect(h.dog.log.filter((l) => l.startsWith('attach'))).toEqual(['attach true', 'attach false'])
  })

  it('runs (not walks) after the ball, and brings it back at a trot when the way is short', () => {
    const h = setup({ dogX: 300, ballX: 400 })
    throwBall(h, 150, -400)
    runFor(h, 40)
    expect(h.dog.moves[0]!.gait).toBe('run')
    expect(h.dog.moves[h.dog.moves.length - 1]!.gait).toBe('trot')
  })

  it('a long way home (over 500 px) is a run, so the demo is not 7 seconds of trotting', () => {
    const h = setup({ dogX: 300, ballX: 900 })
    throwBall(h, 700, -900)
    runFor(h, 40)
    expect(h.dog.moves[h.dog.moves.length - 1]!.gait).toBe('run')
  })

  it('brings the ball back to where the DOG was standing when you threw (the default)', () => {
    const h = setup({ dogX: 300 })
    throwBall(h, 700, -900)
    runFor(h, 40)
    expect(Math.abs(h.dog.x - 300)).toBeLessThan(5)
    expect(Math.abs(h.ball.x - 300)).toBeLessThan(120)
    expect(h.ball.held).toBe(false)
  })

  it('or to where the BALL was thrown from, when set to that', () => {
    const h = setup({ dogX: 300, ballX: 900, dropSpot: 'ballOrigin' })
    throwBall(h, -500, -900)
    runFor(h, 40)
    expect(Math.abs(h.dog.x - 900)).toBeLessThan(5)
  })

  it('looks at the ball while it flies, and stops looking when it is done', () => {
    const h = setup()
    throwBall(h, 700, -900)
    frames(h, 10)
    const looks = h.dog.looks.filter((l) => l !== null)
    expect(looks.length).toBeGreaterThan(3)
    runFor(h, 40)
    expect(h.dog.looks[h.dog.looks.length - 1]).toBeNull()
  })

  it('plays bow to celebrate', () => {
    const h = setup()
    throwBall(h, 700, -900)
    runFor(h, 40)
    expect(h.dog.log).toContain('pose playBow')
  })

  it('the ball is "carried" (host hides it) from pick-up until the drop', () => {
    const h = setup()
    throwBall(h, 700, -900)
    let sawCarrying = false
    for (let i = 0; i < 2400; i++) {
      frame(h)
      if (h.fetch.carrying) {
        sawCarrying = true
        expect(h.ball.held).toBe(true)
        expect(h.dog.attached).toBe(true)
      } else if (h.fetch.state === 'idle' || h.fetch.state === 'chasing') {
        expect(h.dog.attached).toBe(false)
      }
    }
    expect(sawCarrying).toBe(true)
  })
})

describe('chasing', () => {
  it('re-guesses when the ball bounces off a window and still ends up carrying it', () => {
    const h = setup({ solids: [{ x: 1000, y: 700, w: 60, h: 332 }] })
    throwBall(h, 900, -600)
    runFor(h, 40)
    expect(h.notes).toContain('pickedUp')
    expect(h.notes[h.notes.length - 1]).toBe('done')
  })

  it('runs to where the ball WILL come to rest, long before it stops (the prediction, not the ball itself)', () => {
    const h = setup({ dogX: 200, ballX: 900 })
    throwBall(h, 1100, -1500) // a long, bouncy throw
    let restedAtFrame = -1
    let dogMovesWhileInTheAir = 0
    for (let i = 0; i < 2400 && restedAtFrame < 0; i++) {
      frame(h)
      if (h.ball.resting) restedAtFrame = i
      else dogMovesWhileInTheAir = h.dog.moves.length // orders given while the ball was still moving
    }
    expect(restedAtFrame).toBeGreaterThan(60) // it really was in the air for a while
    expect(dogMovesWhileInTheAir).toBeGreaterThan(0) // the dog was already sent somewhere
    // and that first order pointed at the real resting spot, within a body length
    expect(Math.abs(h.dog.moves[0]!.x - h.ball.x)).toBeLessThan(40)
  })

  it('a ball thrown again while the dog is still chasing: one pick-up, brought back to the FIRST spot', () => {
    const h = setup({ dogX: 300 })
    throwBall(h, 600, -900)
    runFor(h, 0.6)
    h.ball.resting = false
    h.ball.vx = -400
    h.ball.vy = -700
    h.fetch.launch()
    runFor(h, 40)
    expect(h.notes.filter((n) => n === 'pickedUp')).toHaveLength(1)
    expect(h.notes.filter((n) => n === 'launched')).toHaveLength(1)
    expect(Math.abs(h.dog.x - 300)).toBeLessThan(5)
  })

  it("a ball that lands right at the dog's feet is picked up straight away", () => {
    const h = setup({ dogX: 300, ballX: 320 })
    throwBall(h, 10, -300)
    runFor(h, 3)
    expect(h.notes).toContain('pickedUp')
  })

  it('throwing while the player is still holding the ball does nothing', () => {
    const h = setup()
    h.ball.held = true
    h.fetch.launch()
    runFor(h, 2)
    expect(h.notes).toEqual([])
    expect(h.fetch.state).toBe('idle')
  })

  it('the player grabbing the ball back mid-chase calls the dog off cleanly', () => {
    const h = setup()
    throwBall(h, 700, -900)
    runFor(h, 0.8)
    h.ball.held = true // the user's hand
    frames(h, 3, false)
    expect(h.fetch.state).toBe('idle')
    expect(h.notes).toContain('cancelled')
    expect(h.dog.attached).toBe(false)
    expect(h.ball.held).toBe(true) // still the user's: the dog never touches it
  })

  it('gives up if the ball never settles (20 s) and is free again', () => {
    const h = setup()
    throwBall(h, 700, -900)
    h.ball.held = false
    // never step the ball: it hangs "in flight" forever
    for (let i = 0; i < Math.ceil(23000 / FRAME); i++) frame(h, false)
    expect(h.notes).toContain('gaveUp')
    expect(h.fetch.state).toBe('idle')
    expect(h.dog.attached).toBe(false)
  })
})

describe('a ball the dog cannot reach (on top of a window: terrain is a later phase)', () => {
  it('runs under it, looks up, gives up; never picks up; the ball stays', () => {
    const h = setup({ solids: [{ x: 1200, y: 600, w: 400, h: 432 }] })
    h.ball.x = 1300
    h.ball.y = 300
    throwBall(h, 0, 0)
    runFor(h, 15)
    expect(h.notes).toEqual(['launched', 'gaveUp'])
    expect(h.ball.y).toBeLessThan(600)
    expect(h.dog.attached).toBe(false)
    expect(h.ball.held).toBe(false)
    expect(h.fetch.state).toBe('idle')
    expect(Math.abs(h.dog.x - h.ball.x)).toBeLessThan(40) // it did go and stand under it
  })
})

describe('cancel', () => {
  it('during the chase: the dog stops where it is and nothing is ever picked up', () => {
    const h = setup()
    throwBall(h, 700, -900)
    runFor(h, 0.5)
    const x = h.dog.x
    h.fetch.cancel()
    runFor(h, 3)
    expect(h.fetch.state).toBe('idle')
    expect(h.notes).toEqual(['launched', 'cancelled'])
    expect(Math.abs(h.dog.x - x)).toBeLessThan(15)
    expect(h.dog.attached).toBe(false)
  })

  it('while carrying: the ball is put down at the dog and released', () => {
    const h = setup()
    throwBall(h, 700, -900)
    for (let i = 0; i < 2400 && h.fetch.state !== 'returning'; i++) frame(h)
    expect(h.fetch.state).toBe('returning')
    h.fetch.cancel()
    expect(h.dog.attached).toBe(false)
    expect(h.ball.held).toBe(false)
    expect(h.fetch.state).toBe('idle')
    runFor(h, 3)
    expect(Math.abs(h.ball.x - h.dog.x)).toBeLessThan(80)
  })

  it('when nothing is going on it does nothing', () => {
    const h = setup()
    h.fetch.cancel()
    expect(h.notes).toEqual([])
  })
})

describe('a second fetch', () => {
  it('works just as well after the first one finished', () => {
    const h = setup()
    throwBall(h, 700, -900)
    runFor(h, 40)
    expect(h.notes[h.notes.length - 1]).toBe('done')
    h.notes.length = 0
    h.ball.resting = false
    h.ball.vx = 500
    h.ball.vy = -800
    h.fetch.launch()
    runFor(h, 40)
    expect(h.notes).toEqual(['launched', 'pickedUp', 'returning', 'dropped', 'done'])
  })
})

describe('whatever happens, it ends free (fuzz)', () => {
  it('survives 30 random games of throws, cancels, grabs, teleports and moving windows', () => {
    let seed = 2026
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const valid: FetchState[] = [
      'idle',
      'chasing',
      'grabbing',
      'returning',
      'celebrating',
      'gaveUp'
    ]
    for (let game = 0; game < 30; game++) {
      const h = setup({ dogX: 100 + rand() * 1700, ballX: 100 + rand() * 1700 })
      let userHolds = 0
      for (let f = 0; f < 3000; f++) {
        const r = rand()
        if (r < 0.004) {
          h.ball.resting = false
          h.ball.vx = (rand() - 0.5) * 3000
          h.ball.vy = -rand() * 2500
          h.fetch.launch()
        } else if (r < 0.006) h.fetch.cancel()
        else if (r < 0.008 && !h.fetch.carrying && userHolds === 0) userHolds = 20
        else if (r < 0.01 && !h.fetch.carrying) {
          h.ball.x = 20 + rand() * 1880
          h.ball.y = 20 + rand() * 950
          h.ball.vx = 0
          h.ball.vy = 0
          h.ball.resting = false
        } else if (r < 0.012 && f % 100 === 0) {
          h.world.setSolids([
            {
              x: rand() * 1200,
              y: 300 + rand() * 600,
              w: 100 + rand() * 600,
              h: 200 + rand() * 400
            }
          ])
        }
        if (userHolds > 0 && !h.fetch.carrying) {
          h.ball.held = true
          userHolds--
          if (userHolds === 0) h.ball.held = false
        }
        frame(h)
        expect(valid).toContain(h.fetch.state)
        expect(Number.isFinite(h.ball.x) && Number.isFinite(h.ball.y)).toBe(true)
        expect(h.dog.attached, `game ${game} frame ${f}`).toBe(h.fetch.carrying)
      }
      // let everything play out with no more interference
      h.ball.held = false
      for (let f = 0; f < Math.ceil(60000 / FRAME); f++) frame(h)
      expect(h.fetch.state, `game ${game}`).toBe('idle')
      expect(h.dog.attached).toBe(false)
      expect(h.ball.held).toBe(false)
    }
  })
})

describe('tuning', () => {
  it('keeps the numbers the plan promised', () => {
    expect(FETCH.chaseTimeoutMs).toBe(20000)
    expect(FETCH.reachHeightPx).toBe(40)
  })
})
