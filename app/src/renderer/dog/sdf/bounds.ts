// Bounding spheres for the shader's speed-up (see bounds.test.ts). Each shape gets a sphere that
// contains it, so (distance to the sphere surface) never over-estimates (distance to the shape):
// a pixel far from a shape can skip the exact distance function without changing the picture.
import type { ShapeKind } from '@shared/dog-file'

export interface Bound {
  /** Sphere centre on the shape's local x axis. */
  cx: number
  r: number
}

export interface Sphere {
  x: number
  y: number
  z: number
  r: number
}

/** The smallest sphere on the shape's x axis that contains it (shape params as in dog-file.ts). */
export function shapeBound(kind: ShapeKind, params: number[]): Bound {
  const [a = 0, b = 0, c = 0] = params
  switch (kind) {
    case 'sphere': // [r]
      return { cx: 0, r: a }
    case 'capsule': // [r, halfLength]
      return { cx: 0, r: b + a }
    case 'ellipsoid': // [rx, ry, rz]
      return { cx: 0, r: Math.max(a, b, c) }
    case 'roundCone': // [rA, rB, length]: spans x = -rA .. length + rB
      return { cx: (c + b - a) / 2, r: (c + a + b) / 2 }
  }
}

/**
 * One sphere around a set of spheres, written into `out` without allocating (used every frame).
 * Centre = the average of the centres; the radius reaches the farthest edge.
 */
export function unionSphereInto(
  out: Sphere,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  zs: ArrayLike<number>,
  rs: ArrayLike<number>,
  count: number
): Sphere {
  if (count === 0) {
    out.x = out.y = out.z = out.r = 0
    return out
  }
  let x = 0
  let y = 0
  let z = 0
  for (let i = 0; i < count; i++) {
    x += xs[i]!
    y += ys[i]!
    z += zs[i]!
  }
  x /= count
  y /= count
  z /= count
  let r = 0
  for (let i = 0; i < count; i++) {
    r = Math.max(r, Math.hypot(xs[i]! - x, ys[i]! - y, zs[i]! - z) + rs[i]!)
  }
  out.x = x
  out.y = y
  out.z = z
  out.r = r
  return out
}

/** One sphere around a list of spheres (allocates; the per-frame code uses unionSphereInto). */
export function unionSphere(spheres: readonly Sphere[]): Sphere {
  return unionSphereInto(
    { x: 0, y: 0, z: 0, r: 0 },
    spheres.map((s) => s.x),
    spheres.map((s) => s.y),
    spheres.map((s) => s.z),
    spheres.map((s) => s.r),
    spheres.length
  )
}
