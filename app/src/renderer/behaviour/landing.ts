// Landing prediction (P2 Task 3 of docs/plans/a-p2-mvp-behaviour.md): "if I let this ball play out,
// where does it end up?" It replays the real ball physics (stepBall) on a scratch COPY of the ball,
// so the answer matches what the live ball will do, and the live ball is never touched. The result
// is written into the caller's object (no allocation per call).
import { createBall, stepBall } from '../world/ball'
import type { Ball } from '../world/ball'
import type { World } from '../world/world-sdf'

export interface Landing {
  x: number
  y: number
  /** Milliseconds until it comes to rest (or until we gave up looking). */
  tMs: number
  /** False if it was still moving when we stopped looking. */
  settled: boolean
}

const STEP_MS = 16.667
const scratch: Ball = createBall(0, 0)

export function predictLanding(ball: Ball, world: World, maxMs: number, out: Landing): Landing {
  const bad = !Number.isFinite(ball.x) || !Number.isFinite(ball.y)
  if (ball.held || ball.resting || bad) {
    out.x = ball.x
    out.y = ball.y
    out.tMs = 0
    out.settled = true
    return out
  }
  scratch.x = ball.x
  scratch.y = ball.y
  scratch.vx = Number.isFinite(ball.vx) ? ball.vx : 0
  scratch.vy = Number.isFinite(ball.vy) ? ball.vy : 0
  scratch.r = ball.r
  scratch.resting = false
  scratch.held = false
  scratch.contactMs = ball.contactMs

  let t = 0
  while (t < maxMs && !scratch.resting) {
    stepBall(scratch, world, STEP_MS)
    t += STEP_MS
  }
  out.x = scratch.x
  out.y = scratch.y
  out.tMs = Math.min(t, maxMs)
  out.settled = scratch.resting
  return out
}
