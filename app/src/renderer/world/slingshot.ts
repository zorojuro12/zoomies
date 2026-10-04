// Mouse slingshot (Task 8 of a-p1-overlay.md): maps a drag away from the held ball into an aim
// (angle/power), and an aim into a launch velocity. Pure math — no allocation beyond the small
// `{angle, power}` result, which is only ever produced once per pointermove, not per frame.
import type { Ball } from './ball'

export const SLING = {
  maxPullPx: 200,
  minPullPx: 8,
  maxLaunchSpeed: 2600,
  grabRadiusPx: 12
}

export function aimFromDrag(
  ballX: number,
  ballY: number,
  cursorX: number,
  cursorY: number
): { angle: number; power: number } | null {
  const pullX = ballX - cursorX
  const pullY = ballY - cursorY
  const pull = Math.hypot(pullX, pullY)
  if (pull < SLING.minPullPx) return null

  return {
    angle: Math.atan2(pullY, pullX),
    power: Math.min(pull / SLING.maxPullPx, 1)
  }
}

export function launchVelocity(
  angle: number,
  power: number,
  out: { vx: number; vy: number }
): void {
  const speed = power * SLING.maxLaunchSpeed
  out.vx = speed * Math.cos(angle)
  out.vy = speed * Math.sin(angle)
}

export function ballHit(ball: Ball, x: number, y: number): boolean {
  const reach = ball.r + SLING.grabRadiusPx
  return Math.hypot(ball.x - x, ball.y - y) <= reach
}
