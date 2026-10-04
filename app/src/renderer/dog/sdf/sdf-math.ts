// SDF maths — CPU reference for the shader (sdf.frag.glsl mirrors these formulas).
// Every function returns the signed distance from point (px, py, pz) to the shape's surface:
// > 0 outside, 0 on the surface, < 0 inside. Shapes are in their bone-local frame and follow the
// dog-file contract (dog-file.ts): capsule/roundCone axes run along local +x.
// Plain numbers in and out (no vectors) so nothing is allocated per call — CLAUDE.md "hot paths".

export function sdSphere(px: number, py: number, pz: number, radius: number): number {
  return Math.sqrt(px * px + py * py + pz * pz) - radius
}

/** Segment from x=-halfLength to x=+halfLength on the x axis, thickened by `radius`. */
export function sdCapsule(
  px: number,
  py: number,
  pz: number,
  radius: number,
  halfLength: number
): number {
  const x = px < -halfLength ? -halfLength : px > halfLength ? halfLength : px // nearest point on the segment
  const dx = px - x
  return Math.sqrt(dx * dx + py * py + pz * pz) - radius
}

/** Inigo Quilez's ellipsoid approximation: exact along the axes, close elsewhere. */
export function sdEllipsoid(
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number
): number {
  const ax = px / rx
  const ay = py / ry
  const az = pz / rz
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az)
  const bx = px / (rx * rx)
  const by = py / (ry * ry)
  const bz = pz / (rz * rz)
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz)
  if (k1 === 0) return -Math.min(rx, ry, rz) // exactly at the centre: 0/0 below, so answer directly
  return (k0 * (k0 - 1)) / k1
}

/**
 * Sphere A (radius rA) at the origin joined to sphere B (radius rB) at x = length by tangent
 * lines — a tapered, rounded cone. Requires |rA - rB| < length.
 */
export function sdRoundCone(
  px: number,
  py: number,
  pz: number,
  rA: number,
  rB: number,
  length: number
): number {
  const b = (rA - rB) / length // sine of the taper angle
  const a = Math.sqrt(1 - b * b)
  const rho = Math.sqrt(py * py + pz * pz) // distance from the axis
  const k = -rho * b + px * a // which part of the shape is nearest: A cap, side, or B cap
  if (k < 0) return Math.sqrt(rho * rho + px * px) - rA
  if (k > a * length) {
    const dx = px - length
    return Math.sqrt(rho * rho + dx * dx) - rB
  }
  return rho * a + px * b - rA
}

/** Polynomial smooth minimum: like min(a, b) but blended over a radius k. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
