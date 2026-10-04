// Ball physics against the World SDF (Task 7 of a-p1-overlay.md). Hot path (`stepBall`, called
// every frame) allocates nothing — the collision normal is written into a single module-level
// scratch Point reused across calls.
import type { Point } from '@shared/geometry'
import type { World } from './world-sdf'

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  resting: boolean
  contactMs: number
}

export const BALL = {
  gravity: 2400,
  restitution: 0.55,
  friction: 0.85,
  maxSpeed: 4000,
  restSpeed: 30,
  restHoldMs: 300,
  maxDtMs: 50,
  substepMs: 4,
  escapeStepPx: 4,
  escapeMaxSteps: 150
}

export function createBall(x: number, y: number, r = 10): Ball {
  return { x, y, vx: 0, vy: 0, r, resting: false, contactMs: 0 }
}

const scratchNormal: Point = { x: 0, y: 0 }

function clampSpeed(ball: Ball): void {
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > BALL.maxSpeed) {
    const scale = BALL.maxSpeed / speed
    ball.vx *= scale
    ball.vy *= scale
  }
}

/** Pushes `ball` out of a solid along `world`'s normal and reflects velocity if moving inward. */
function resolveCollision(ball: Ball, world: World): boolean {
  const d = world.distance(ball.x, ball.y) - ball.r
  if (d >= 0) return false

  world.normal(ball.x, ball.y, scratchNormal)
  const nx = scratchNormal.x
  const ny = scratchNormal.y
  ball.x += nx * -d
  ball.y += ny * -d

  // A window dragged flush against the floor (or another solid) makes the nearest-edge gradient
  // point straight into the floor, which pushes back into the window next substep, forever: the
  // two surfaces share a boundary with no free space between them locally. Escape by marching
  // straight up in small fixed steps (never resampling the same zero-crossing) until free.
  for (
    let i = 0;
    i < BALL.escapeMaxSteps && world.distance(ball.x, ball.y) - ball.r < 0;
    i++
  ) {
    ball.y -= BALL.escapeStepPx
  }

  const vn = ball.vx * nx + ball.vy * ny
  if (vn < 0) {
    const tx = ball.vx - vn * nx
    const ty = ball.vy - vn * ny
    const newVn = -BALL.restitution * vn
    ball.vx = nx * newVn + tx * BALL.friction
    ball.vy = ny * newVn + ty * BALL.friction
  }
  return true
}

export function stepBall(ball: Ball, world: World, dtMs: number): void {
  const dt = Math.min(dtMs, BALL.maxDtMs)
  const numSubsteps = Math.max(1, Math.ceil(dt / BALL.substepMs))
  const substepMs = dt / numSubsteps
  const substepSec = substepMs / 1000

  for (let i = 0; i < numSubsteps; i++) {
    if (ball.resting) {
      // A resting ball stays put unless something (e.g. a dragged window) now overlaps it.
      if (resolveCollision(ball, world)) {
        ball.resting = false
        ball.contactMs = 0
      }
      continue
    }

    ball.vy += BALL.gravity * substepSec
    clampSpeed(ball)
    ball.x += ball.vx * substepSec
    ball.y += ball.vy * substepSec

    const inContact = resolveCollision(ball, world)
    const speed = Math.hypot(ball.vx, ball.vy)

    if (inContact && speed < BALL.restSpeed) {
      ball.contactMs += substepMs
      if (ball.contactMs >= BALL.restHoldMs) {
        ball.resting = true
        ball.vx = 0
        ball.vy = 0
      }
    } else {
      ball.contactMs = 0
    }
  }
}
