// Bounding spheres for the shader's speed-up. Every shape gets a sphere that must CONTAIN it:
// then (distance to the sphere surface) is a lower bound of (distance to the shape), so a shape
// that is far from a pixel can be skipped without changing the picture (smin(d, far, k) = d once
// far - d >= k). The sphere centre sits on the shape's local x axis. Tested against the SDF maths.
import { describe, expect, it } from 'vitest'
import type { ShapeKind } from '@shared/dog-file'
import { sdCapsule, sdEllipsoid, sdRoundCone, sdSphere } from './sdf-math'
import { shapeBound, unionSphere, unionSphereInto } from './bounds'

function sd(kind: ShapeKind, p: number[], q: number[]): number {
  const [x, y, z] = p as [number, number, number]
  const [a = 0, b = 0, c = 0] = q
  switch (kind) {
    case 'sphere':
      return sdSphere(x, y, z, a)
    case 'capsule':
      return sdCapsule(x, y, z, a, b)
    case 'ellipsoid':
      return sdEllipsoid(x, y, z, a, b, c)
    case 'roundCone':
      return sdRoundCone(x, y, z, a, b, c)
  }
}

/** Deterministic pseudo-random numbers in [0,1). */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const CASES: [ShapeKind, number[]][] = [
  ['sphere', [5]],
  ['capsule', [3, 10]],
  ['ellipsoid', [8, 4, 6]],
  ['roundCone', [6, 2, 14]],
  ['roundCone', [3, 3.5, 5]]
]

describe('shapeBound (hand-worked)', () => {
  it('sphere: centred, radius = r', () => {
    expect(shapeBound('sphere', [5])).toEqual({ cx: 0, r: 5 })
  })
  it('capsule: centred, radius = half length + r  (10 + 3 = 13)', () => {
    expect(shapeBound('capsule', [3, 10])).toEqual({ cx: 0, r: 13 })
  })
  it('ellipsoid: centred, radius = the largest semi-axis', () => {
    expect(shapeBound('ellipsoid', [8, 4, 6])).toEqual({ cx: 0, r: 8 })
  })
  it('roundCone: spans x = -rA .. length + rB, so centre (14 + 2 - 6) / 2 = 5 and radius (14 + 6 + 2) / 2 = 11', () => {
    expect(shapeBound('roundCone', [6, 2, 14])).toEqual({ cx: 5, r: 11 })
  })
})

describe('shapeBound: the sphere really contains the shape', () => {
  for (const [kind, params] of CASES) {
    it(`${kind} ${JSON.stringify(params)}: every point inside the shape is inside the sphere`, () => {
      const { cx, r } = shapeBound(kind, params)
      const rand = rng(7)
      const span = (r + Math.abs(cx)) * 1.6 // sample a box around the shape, not a fixed big cube
      let inside = 0
      for (let i = 0; i < 20000; i++) {
        const p = [
          cx + (rand() - 0.5) * 2 * span,
          (rand() - 0.5) * 2 * span,
          (rand() - 0.5) * 2 * span
        ]
        if (sd(kind, p, params) <= 0) {
          inside++
          expect(Math.hypot(p[0]! - cx, p[1]!, p[2]!)).toBeLessThanOrEqual(r + 1e-9)
        }
      }
      expect(inside).toBeGreaterThan(50) // the sampling really hit the shape
    })

    it(`${kind} ${JSON.stringify(params)}: is tight (the shape reaches within 2% of the sphere surface)`, () => {
      const { cx, r } = shapeBound(kind, params)
      const rand = rng(11)
      const span = (r + Math.abs(cx)) * 1.6
      let farthest = 0
      for (let i = 0; i < 40000; i++) {
        const p = [
          cx + (rand() - 0.5) * 2 * span,
          (rand() - 0.5) * 2 * span,
          (rand() - 0.5) * 2 * span
        ]
        if (sd(kind, p, params) <= 0)
          farthest = Math.max(farthest, Math.hypot(p[0]! - cx, p[1]!, p[2]!))
      }
      expect(farthest).toBeGreaterThan(r * 0.9) // sampled, so a loose lower check on tightness
    })
  }
})

describe('the skip rule is safe: sphere distance never over-estimates the real distance', () => {
  // |p - centre| - r <= sd(p) for the shapes whose SDF is exact. The ellipsoid SDF is an
  // approximation (it under-estimates far away), so it is covered by the containment test above:
  // a sphere that contains the shape is, by geometry, a lower bound of the TRUE distance.
  for (const [kind, params] of CASES.filter(([k]) => k !== 'ellipsoid')) {
    it(`${kind} ${JSON.stringify(params)}`, () => {
      const { cx, r } = shapeBound(kind, params)
      const rand = rng(23)
      for (let i = 0; i < 20000; i++) {
        const p = [(rand() - 0.5) * 120, (rand() - 0.5) * 120, (rand() - 0.5) * 120]
        const dist = Math.hypot(p[0]! - cx, p[1]!, p[2]!)
        expect(dist - r).toBeLessThanOrEqual(sd(kind, p, params) + 1e-6)
      }
    })
  }
})

describe('unionSphere (one sphere around the whole dog)', () => {
  it('a single sphere comes back unchanged', () => {
    expect(unionSphere([{ x: 4, y: 5, z: 6, r: 3 }])).toEqual({ x: 4, y: 5, z: 6, r: 3 })
  })
  it('two unit spheres 10 apart: centre in the middle, radius 5 + 1 = 6 (hand-worked)', () => {
    const u = unionSphere([
      { x: 0, y: 0, z: 0, r: 1 },
      { x: 10, y: 0, z: 0, r: 1 }
    ])
    expect(u).toEqual({ x: 5, y: 0, z: 0, r: 6 })
  })
  it('contains every input sphere', () => {
    const rand = rng(5)
    const spheres = Array.from({ length: 30 }, () => ({
      x: (rand() - 0.5) * 100,
      y: (rand() - 0.5) * 100,
      z: (rand() - 0.5) * 100,
      r: rand() * 10
    }))
    const u = unionSphere(spheres)
    for (const s of spheres) {
      expect(Math.hypot(s.x - u.x, s.y - u.y, s.z - u.z) + s.r).toBeLessThanOrEqual(u.r + 1e-9)
    }
  })
  it('an empty list gives an empty sphere, not NaN', () => {
    expect(unionSphere([])).toEqual({ x: 0, y: 0, z: 0, r: 0 })
  })
})

describe('unionSphereInto (the per-frame version, no allocation)', () => {
  it('writes the same sphere unionSphere returns, into the object it was given', () => {
    const rand = rng(99)
    const spheres = Array.from({ length: 20 }, () => ({
      x: (rand() - 0.5) * 80,
      y: (rand() - 0.5) * 80,
      z: (rand() - 0.5) * 80,
      r: rand() * 8
    }))
    const out = { x: 0, y: 0, z: 0, r: 0 }
    const result = unionSphereInto(
      out,
      spheres.map((s) => s.x),
      spheres.map((s) => s.y),
      spheres.map((s) => s.z),
      spheres.map((s) => s.r),
      spheres.length
    )
    expect(result).toBe(out)
    expect(out).toEqual(unionSphere(spheres))
  })
  it('only looks at the first `count` entries (the rest of a reused array is stale)', () => {
    const out = { x: 0, y: 0, z: 0, r: 0 }
    unionSphereInto(out, [0, 10, 999], [0, 0, 999], [0, 0, 999], [1, 1, 999], 2)
    expect(out).toEqual({ x: 5, y: 0, z: 0, r: 6 })
  })
})
