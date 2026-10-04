// solveLegToGround: put a paw at a chosen spot in the DOG frame (origin on the ground between the
// paws, x forward, y DOWN, so the ground is y = 0 and "above the ground" is negative y), whatever
// the body is doing. The leg bones live in the body's frame, so: take the target relative to the
// body, undo the body's pitch, subtract the hip, then run the two-bone IK. This is what keeps a
// planted paw glued to one spot while the body moves above it.
// Plain numbers, writes into `out` — no allocation per frame.
import { solveTwoBone } from './ik'

export interface LegGeometry {
  /** Hip position in the body frame (x forward, y down). */
  hipX: number
  hipY: number
  /** Lengths of the upper and lower leg bones; the lower one ends at the paw bottom. */
  upper: number
  lower: number
  /** +1: knee bends toward the front of the dog; -1: toward the back. */
  bend: number
}

/**
 * out[0] = upper-leg bone angle in the body frame (rad, about z), out[1] = lower bone angle
 * relative to the upper. Aims the paw bottom at (footX, -footLift) in the dog frame.
 */
export function solveLegToGround(
  g: LegGeometry,
  bodyX: number,
  bodyY: number,
  pitch: number,
  footX: number,
  footLift: number,
  out: [number, number]
): [number, number] {
  const dx = footX - bodyX
  const dy = -footLift - bodyY
  const c = Math.cos(pitch)
  const s = Math.sin(pitch)
  // rotate the world-ish offset by -pitch to land in the body frame
  const bx = dx * c + dy * s
  const by = -dx * s + dy * c
  return solveTwoBone(g.upper, g.lower, bx - g.hipX, by - g.hipY, g.bend, out)
}
