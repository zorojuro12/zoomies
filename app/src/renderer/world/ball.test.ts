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
