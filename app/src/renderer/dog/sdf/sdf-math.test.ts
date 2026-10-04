// SDF maths reference tests. Expected values are hand-worked literals, not recomputed from the
// formulas (see the tdd skill: tautological tests pass by construction).
// An SDF returns the signed distance from a point to a surface: > 0 outside, 0 on it, < 0 inside.
import { describe, expect, it } from 'vitest'
import { sdCapsule, sdEllipsoid, sdRoundCone, sdSphere, smin } from './sdf-math'

describe('sdSphere', () => {
  it('is distance-to-centre minus radius outside', () => {
    expect(sdSphere(5, 0, 0, 2)).toBeCloseTo(3)
    expect(sdSphere(3, 4, 0, 2)).toBeCloseTo(3) // 3-4-5 triangle: distance 5
  })
  it('is 0 on the surface and negative inside', () => {
    expect(sdSphere(0, 2, 0, 2)).toBeCloseTo(0)
    expect(sdSphere(0, 0, 0, 2)).toBeCloseTo(-2)
  })
})

describe('sdCapsule (axis along local x, centred on the origin)', () => {
  // radius 1, half length 3: a segment from x=-3 to x=3, thickened by 1
  it('measures from the side of the tube', () => {
    expect(sdCapsule(0, 4, 0, 1, 3)).toBeCloseTo(3)
    expect(sdCapsule(2, 0, -4, 1, 3)).toBeCloseTo(3)
  })
  it('measures from the rounded end caps', () => {
    expect(sdCapsule(5, 0, 0, 1, 3)).toBeCloseTo(1) // 2 past the end, minus radius 1
    expect(sdCapsule(-6, 0, 0, 1, 3)).toBeCloseTo(2)
  })
  it('is negative inside the tube', () => {
    expect(sdCapsule(0, 0, 0, 1, 3)).toBeCloseTo(-1)
  })
})

describe('sdEllipsoid', () => {
  // radii x=4, y=2, z=3. Along an axis the distance is exact.
  it('is exact along each axis', () => {
    expect(sdEllipsoid(6, 0, 0, 4, 2, 3)).toBeCloseTo(2)
    expect(sdEllipsoid(0, 5, 0, 4, 2, 3)).toBeCloseTo(3)
    expect(sdEllipsoid(0, 0, -7, 4, 2, 3)).toBeCloseTo(4)
  })
  it('is 0 on the surface', () => {
    expect(sdEllipsoid(4, 0, 0, 4, 2, 3)).toBeCloseTo(0)
  })
  it('is negative at the centre without dividing by zero', () => {
    const d = sdEllipsoid(0, 0, 0, 4, 2, 3)
    expect(Number.isFinite(d)).toBe(true)
    expect(d).toBeLessThan(0)
    expect(d).toBeCloseTo(-2) // nearest surface is the smallest radius
  })
})

describe('sdRoundCone (axis along local x; sphere A radius 3 at the origin, sphere B radius 1 at x=10)', () => {
  const rA = 3
  const rB = 1
  const len = 10
  const sd = (x: number, y: number, z: number): number => sdRoundCone(x, y, z, rA, rB, len)

  it('measures from the end spheres', () => {
    expect(sd(14, 0, 0)).toBeCloseTo(3) // 4 past B's centre, minus 1
    expect(sd(-5, 0, 0)).toBeCloseTo(2) // 5 behind A's centre, minus 3
  })
  it('is negative inside', () => {
    expect(sd(0, 0, 0)).toBeCloseTo(-3)
    expect(sd(5, 0, 0)).toBeLessThan(0)
  })
  it('lies on the tangent line between the two spheres', () => {
    // Hand-derived: the tangent touches A at (x=0.6, r=2.9394) and B at (x=10.2, r=0.9798).
    // Linear interpolation at x=5 gives radius 2.0412.
    expect(sd(5, 2.0412, 0)).toBeCloseTo(0, 3)
  })
  it('is the same all the way around the axis', () => {
    const a = sd(5, 3, 0)
    expect(sd(5, 0, 3)).toBeCloseTo(a)
    expect(sd(5, 0, -3)).toBeCloseTo(a)
    expect(sd(5, -3, 0)).toBeCloseTo(a)
  })
  it('is fatter at the A end than at the B end', () => {
    expect(sd(1, 2.5, 0)).toBeLessThan(0) // inside near A
    expect(sd(9, 2.5, 0)).toBeGreaterThan(0) // outside near B
  })
})

describe('smin (smooth minimum — what makes shapes melt together)', () => {
  it('equals the plain minimum when the values are far apart', () => {
    expect(smin(1, 5, 2)).toBeCloseTo(1)
    expect(smin(5, 1, 2)).toBeCloseTo(1)
  })
  it('dips below the minimum when the values are close', () => {
    expect(smin(3, 3, 2)).toBeCloseTo(2.5) // blends in a 0.5 bulge
    expect(smin(1, 2, 2)).toBeCloseTo(0.875)
  })
  it('is symmetric', () => {
    expect(smin(1, 2, 2)).toBeCloseTo(smin(2, 1, 2))
  })
  it('falls back to the plain minimum when there is no blend radius', () => {
    expect(smin(1, 2, 0)).toBe(1)
  })
})
