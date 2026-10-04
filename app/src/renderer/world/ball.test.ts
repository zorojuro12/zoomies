import { describe, expect, it } from 'vitest'
import { World } from './world-sdf'
import { createBall, stepBall, BALL } from './ball'

const STEP_MS = 16.667

function freshWorld(): World {
  const world = new World()
  world.setBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return world
}

describe('stepBall', () => {
  it('falls and settles on the floor within 10 simulated seconds', () => {
    const world = freshWorld()
    const ball = createBall(500, 100)
    const totalSteps = Math.ceil(10000 / STEP_MS)
    for (let i = 0; i < totalSteps; i++) stepBall(ball, world, STEP_MS)
    expect(ball.resting).toBe(true)
    expect(ball.y).toBeCloseTo(790, 0)
  })

  it('bounces with the restitution ratio on vertical impact', () => {
    const world = freshWorld()
    const ball = createBall(500, 700)
    ball.vy = 1000

    let impactSpeed = 0
    let bounced = false
    for (let i = 0; i < 200 && !bounced; i++) {
      const vyBefore = ball.vy
      stepBall(ball, world, STEP_MS)
      if (ball.vy < 0) {
        impactSpeed = vyBefore
        bounced = true
      }
    }

    expect(bounced).toBe(true)
    expect(ball.vy).toBeLessThan(0)
    expect(Math.abs(ball.vy)).toBeGreaterThan(Math.abs(impactSpeed) * 0.55 * 0.9)
    expect(Math.abs(ball.vy)).toBeLessThan(Math.abs(impactSpeed) * 0.55 * 1.1)
  })

  it('loses more than 100px of apex height after the first bounce', () => {
    const world = freshWorld()
    const ball = createBall(500, 100)

    let minYAfterFirstBounce = Infinity
    let bounces = 0
    let wasFalling = true
    for (let i = 0; i < 200; i++) {
      stepBall(ball, world, STEP_MS)
      const fallingNow = ball.vy > 0
      if (wasFalling && !fallingNow && ball.vy < 0) bounces++
      wasFalling = fallingNow
      if (bounces === 1) minYAfterFirstBounce = Math.min(minYAfterFirstBounce, ball.y)
      if (bounces === 2) break
    }

    expect(bounces).toBeGreaterThanOrEqual(1)
    expect(minYAfterFirstBounce).toBeGreaterThan(100 + 100 - 1) // apex (smallest y) more than 100px below the drop point
  })

  it('reflects horizontal velocity off the right wall regardless of gravity', () => {
    const world = freshWorld()
    const ball = createBall(985, 400)
    ball.vx = 1000
    ball.vy = 0

    stepBall(ball, world, STEP_MS)

    expect(ball.vx).toBeLessThan(0)
    expect(ball.x).toBeLessThanOrEqual(990)
  })
})

describe('stepBall robustness', () => {
  it('wakes a resting ball when a window lands on it, without energy gain or exceeding maxSpeed', () => {
    const world = freshWorld()
    const ball = createBall(300, 790)
    ball.resting = true
    ball.vx = 0
    ball.vy = 0

    world.setSolids([{ x: 250, y: 700, w: 200, h: 150 }])
    stepBall(ball, world, STEP_MS)

    expect(world.distance(ball.x, ball.y) - ball.r).toBeGreaterThanOrEqual(-0.5)
    expect(Math.hypot(ball.vx, ball.vy)).toBeLessThanOrEqual(BALL.maxSpeed)
  })

  it('escapes upward, not stuck oscillating, when a window flush with the floor lands on it', () => {
    const world = freshWorld()
    const ball = createBall(500, 790)
    ball.resting = true
    ball.vx = 0
    ball.vy = 0

    // Window's bottom edge sits exactly on the floor, ball centered under it horizontally:
    // the nearest-edge gradient alone would point straight down, into the floor, forever.
    world.setSolids([{ x: 400, y: 650, w: 200, h: 150 }])
    for (let i = 0; i < 30; i++) stepBall(ball, world, STEP_MS)

    expect(ball.y).toBeLessThanOrEqual(650)
    expect(world.distance(ball.x, ball.y) - ball.r).toBeGreaterThanOrEqual(-0.5)
  })

  it('does not tunnel through the floor on a long dt (dt is clamped and substepped)', () => {
    const world = freshWorld()
    const ball = createBall(500, 700)
    ball.vy = 3000

    stepBall(ball, world, 1000)

    expect(ball.y).toBeLessThanOrEqual(790.5)
  })

  it('never gains height over 1000 steps at rest on the floor', () => {
    const world = freshWorld()
    const ball = createBall(500, 790)
    ball.resting = true
    ball.vx = 0
    ball.vy = 0

    for (let i = 0; i < 1000; i++) stepBall(ball, world, STEP_MS)

    expect(ball.y).toBeGreaterThanOrEqual(789)
  })
})

// Bug 3 (the "frozen ball"): a wide, nearly full-height window (under the 90% maximized cut-off)
// over the ball's spawn point. The nearest way out is down, into the floor, which is solid; the old
// "march straight up" fallback then carried the ball 600 px off the top of the screen, where
// everything counts as solid, and it stayed frozen there at y = -590 with its speed climbing.
describe('stepBall: spawned or landed inside a big window', () => {
  const WA = { x: 0, y: 0, w: 1920, h: 1032 }
  const worldWith = (solids: { x: number; y: number; w: number; h: number }[]): World => {
    const world = new World()
    world.setBounds(WA)
    world.setSolids(solids)
    return world
  }
  const inside = (b: { x: number; y: number; r: number }): boolean =>
    b.x >= -1 && b.x <= WA.w + 1 && b.y >= -1 && b.y <= WA.h + 1

  it('never leaves the screen, even for a moment, and ends up resting in free space', () => {
    // 1700 x 1032: 88% of the screen, so it still counts as a solid
    const world = worldWith([{ x: 0, y: 0, w: 1700, h: 1032 }])
    const ball = createBall(768, 624)
    for (let i = 0; i < 300; i++) {
      stepBall(ball, world, STEP_MS)
      expect(Number.isFinite(ball.x) && Number.isFinite(ball.y)).toBe(true)
      expect(inside(ball), `frame ${i}: ${ball.x}, ${ball.y}`).toBe(true)
    }
    expect(ball.resting).toBe(true)
    expect(world.distance(ball.x, ball.y) - ball.r).toBeGreaterThanOrEqual(-0.5)
  })

  it('finds the only way out even when it is far: sideways, 1600 px away', () => {
    const world = worldWith([{ x: 0, y: 0, w: 1700, h: 1032 }])
    const ball = createBall(100, 500) // 100 px from the left edge of the screen, inside the window
    stepBall(ball, world, STEP_MS)
    // no free space above or below (flush with the top and the floor) and the left edge of the
    // window IS the screen edge: the way out is to the right, 1600 px away; it must be found.
    expect(ball.x).toBeGreaterThan(1700)
  })

  it('does not freeze: a ball that was inside keeps being simulated (it falls to the floor)', () => {
    const world = worldWith([{ x: 0, y: 0, w: 1700, h: 1032 }])
    const ball = createBall(768, 624)
    for (let i = 0; i < 400; i++) stepBall(ball, world, STEP_MS)
    expect(ball.y).toBeCloseTo(WA.h - ball.r, 0) // on the floor, to the right of the window
    expect(ball.x).toBeGreaterThan(1700)
    expect(ball.vy).toBe(0)
  })

  it('still behaves when there is NO free space anywhere (two windows cover the whole screen): stays on screen and finite', () => {
    const world = worldWith([
      { x: 0, y: 0, w: 960, h: 1032 },
      { x: 960, y: 0, w: 960, h: 1032 }
    ])
    const ball = createBall(500, 500)
    for (let i = 0; i < 300; i++) {
      stepBall(ball, world, STEP_MS)
      expect(Number.isFinite(ball.x) && Number.isFinite(ball.y)).toBe(true)
      expect(inside(ball), `frame ${i}: ${ball.x}, ${ball.y}`).toBe(true)
    }
  })

  it('stays finite and on screen for 200 random window layouts and spawn points', () => {
    let seed = 12345
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let trial = 0; trial < 200; trial++) {
      const solids = []
      const n = 1 + Math.floor(rand() * 4)
      for (let k = 0; k < n; k++) {
        const w = 100 + rand() * 1700
        const h = 100 + rand() * 932
        solids.push({ x: rand() * (WA.w - w), y: rand() * (WA.h - h), w, h })
      }
      const world = worldWith(solids)
      const ball = createBall(10 + rand() * 1900, 10 + rand() * 1000)
      ball.vx = (rand() - 0.5) * 2000
      ball.vy = (rand() - 0.5) * 2000
      for (let i = 0; i < 240; i++) {
        stepBall(ball, world, STEP_MS)
        if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y) || !inside(ball)) {
          throw new Error(
            `trial ${trial} frame ${i}: ball at ${ball.x}, ${ball.y}; solids ${JSON.stringify(solids)}`
          )
        }
      }
    }
  })

  it('a window dropped on a resting ball still pops it out the nearest way (the earlier behaviour is kept)', () => {
    const world = worldWith([])
    const ball = createBall(960, 500)
    for (let i = 0; i < 400; i++) stepBall(ball, world, STEP_MS)
    expect(ball.resting).toBe(true)
    world.setSolids([{ x: 900, y: 900, w: 200, h: 132 }]) // lands on the ball, flush with the floor
    for (let i = 0; i < 60; i++) stepBall(ball, world, STEP_MS)
    expect(world.distance(ball.x, ball.y) - ball.r).toBeGreaterThanOrEqual(-0.5)
    expect(inside(ball)).toBe(true)
  })
})
