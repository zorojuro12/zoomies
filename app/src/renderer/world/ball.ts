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
  /** True while the player is dragging it (Task 8): physics pauses, position is set by the host. */
  held: boolean
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
  escapeStepPx: 8
}

export function createBall(x: number, y: number, r = 10): Ball {
  return { x, y, vx: 0, vy: 0, r, resting: false, contactMs: 0, held: false }
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

// Directions to try when the ball has to be pulled out of a solid: x, y, and a weight on the
// distance (a smaller weight = preferred). Up is preferred (a window landing on the ball pops it
// out of the top), then the other seven; everything outside the work area counts as solid, so
// the directions that run into a screen edge simply never find free space.
const ESCAPE_DIRS: readonly (readonly [number, number, number])[] = [
  [0, -1, 0.6],
  [0, 1, 1],
  [-1, 0, 1],
  [1, 0, 1],
  [Math.SQRT1_2, -Math.SQRT1_2, 1],
  [-Math.SQRT1_2, -Math.SQRT1_2, 1],
  [Math.SQRT1_2, Math.SQRT1_2, 1],
  [-Math.SQRT1_2, Math.SQRT1_2, 1]
]

/**
 * Moves `ball` by the SHORTEST straight line to free space (clear of every solid and inside the
 * work area), writing the direction it moved in to `scratchNormal`. Returns false if there is no
 * free space within reach in any direction (the screen is fully covered).
 */
function escapeToFreeSpace(ball: Ball, world: World): boolean {
  const wa = world.getBounds()
  const maxSteps = Math.ceil(Math.max(wa.w, wa.h) / BALL.escapeStepPx)
  let bestCost = Infinity
  let bestK = -1
  for (let d = 0; d < ESCAPE_DIRS.length; d++) {
    const dir = ESCAPE_DIRS[d]!
    for (let k = 1; k <= maxSteps; k++) {
      if (k * BALL.escapeStepPx * dir[2] >= bestCost) break // already worse than the best so far
      const px = ball.x + dir[0] * k * BALL.escapeStepPx
      const py = ball.y + dir[1] * k * BALL.escapeStepPx
      if (world.distance(px, py) - ball.r >= 0) {
        bestCost = k * BALL.escapeStepPx * dir[2]
        bestK = d * 100000 + k
        break
      }
    }
  }
  if (bestK < 0) return false
  const best = ESCAPE_DIRS[Math.floor(bestK / 100000)]!
  const k = bestK % 100000
  ball.x += best[0] * k * BALL.escapeStepPx
  ball.y += best[1] * k * BALL.escapeStepPx
  scratchNormal.x = best[0]
  scratchNormal.y = best[1]
  return true
}

/** Keeps the ball's centre inside the work area (the last resort when nothing is free). */
function clampInside(ball: Ball, world: World): void {
  const wa = world.getBounds()
  ball.x = Math.min(Math.max(ball.x, wa.x + ball.r), wa.x + wa.w - ball.r)
  ball.y = Math.min(Math.max(ball.y, wa.y + ball.r), wa.y + wa.h - ball.r)
}

/** Pushes `ball` out of a solid along `world`'s normal and reflects velocity if moving inward. */
function resolveCollision(ball: Ball, world: World): boolean {
  const d = world.distance(ball.x, ball.y) - ball.r
  if (d >= 0) return false

  world.normal(ball.x, ball.y, scratchNormal)
  let nx = scratchNormal.x
  let ny = scratchNormal.y
  const px = ball.x + nx * -d
  const py = ball.y + ny * -d
  if (world.distance(px, py) - ball.r >= -0.01) {
    // the normal push lands in free space: the common case
    ball.x = px
    ball.y = py
  } else if (escapeToFreeSpace(ball, world)) {
    // The nearest face leads into another solid or off the screen (a window flush with the floor,
    // a window almost as big as the screen): take the shortest straight way out instead.
    nx = scratchNormal.x
    ny = scratchNormal.y
  } else {
    // No free space anywhere (windows cover the whole screen): stay on screen and stop.
    clampInside(ball, world)
    ball.vx = 0
    ball.vy = 0
    return true
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
  if (ball.held) return

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
