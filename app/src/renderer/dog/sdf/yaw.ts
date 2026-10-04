// Yaw maths for turning the dog toward where it travels (three.js rotation.y, radians).
//   0 = facing screen-right, π = left, +π/2 = up the screen (back to the viewer),
//   -π/2 = down the screen (face to the viewer).
// Why these signs: the dog's forward vector after rotation.y = θ is (cos θ, 0, -sin θ) in
// (x, y, z), z pointing toward the viewer. Moving DOWN the screen (+y) is toward the viewer (+z).
// Plain numbers in and out, no allocation — CLAUDE.md "hot paths".

/** Sideways travel leans this far toward the viewer (the three-quarter view). */
export const VIEW_TILT = (25 * Math.PI) / 180
const TILT_SLOPE = Math.tan(VIEW_TILT)

/**
 * Yaw that points the dog along screen velocity (vx right, vy down, px/s). Only the direction
 * matters. Sideways movement gets the three-quarter lean; purely vertical movement does not.
 * Call only with a non-zero velocity.
 */
export function targetYaw(vx: number, vy: number): number {
  const len = Math.sqrt(vx * vx + vy * vy)
  const ux = vx / len
  const uz = vy / len // down the screen = toward the viewer
  const fx = ux
  const fz = uz + TILT_SLOPE * Math.abs(ux)
  return Math.atan2(-fz, fx)
}

/**
 * Standing still, the dog turns further toward the viewer than when walking: 60° from side-on, so
 * its face and chest are toward us (you see a front three-quarter, not a profile). It still leans
 * toward the side it last faced.
 */
export const REST_TILT = (60 * Math.PI) / 180

/** Yaw while standing still: front three-quarter view, on the side of the last horizontal direction. */
export function restYaw(facing: 1 | -1): number {
  return Math.atan2(-Math.tan(REST_TILT), facing)
}

/**
 * Move `current` toward `target` by an exponential ease (fraction 1 - e^(-rate*dt)), taking the
 * SHORT way round the circle (170° -> -170° is a 20° swing, not 340°).
 */
export function stepAngle(current: number, target: number, dtSec: number, rate: number): number {
  const twoPi = Math.PI * 2
  let diff = (target - current) % twoPi
  if (diff > Math.PI) diff -= twoPi
  else if (diff < -Math.PI) diff += twoPi
  return current + diff * (1 - Math.exp(-rate * dtSec))
}
