// Two-bone inverse kinematics (2D): given the two bone lengths of a leg and where the foot should
// be relative to the hip, find the joint angles. "Forward kinematics" is joints -> foot position;
// IK is the reverse: foot position -> joints. This is how a foot stays planted on a spot while
// the body moves above it.
//
// Plane: the dog's side plane, x forward, y DOWN. An angle θ points along (cos θ, sin θ), so
// θ = 90° is straight down. Output: out[0] = upper bone angle, out[1] = lower bone angle
// RELATIVE to the upper. bend = +1 puts the knee on the forward (+x) side, -1 behind.
// Writes into `out` (no allocation) and returns it.

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function solveTwoBone(
  a: number,
  b: number,
  tx: number,
  ty: number,
  bend: number,
  out: [number, number]
): [number, number] {
  const base = Math.atan2(ty, tx) // direction from the hip to the target
  // Keep the distance reachable: not further than fully stretched, not closer than fully folded.
  const d = clamp(Math.sqrt(tx * tx + ty * ty), Math.abs(a - b) + 1e-4, a + b)
  // Law of cosines: angle between the upper bone and the hip->target line, and the knee's interior angle.
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1))
  const interior = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1))
  out[0] = base - bend * alpha
  out[1] = bend * (Math.PI - interior)
  return out
}
