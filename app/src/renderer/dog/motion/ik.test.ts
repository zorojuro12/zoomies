// Two-bone IK: given a leg's two bone lengths and where the foot should be (relative to the hip),
// find the two joint angles. 2D, in the dog's side plane: angle θ points along (cos θ, sin θ),
// x forward, y DOWN (so θ = 90° points straight down). Output: θ1 = upper bone angle, θ2 = lower
// bone angle RELATIVE to the upper. `bend` = +1 puts the knee on the forward (+x) side, -1 behind.
// Expected values are checked by forward kinematics (an independent calculation) and by
// hand-worked cases.
import { describe, expect, it } from 'vitest'
import { solveTwoBone } from './ik'

const deg = (r: number): number => (r * 180) / Math.PI
/** Forward kinematics: where the foot ends up for given angles. */
function foot(a: number, b: number, t1: number, t2: number): [number, number] {
  return [a * Math.cos(t1) + b * Math.cos(t1 + t2), a * Math.sin(t1) + b * Math.sin(t1 + t2)]
}
function knee(a: number, t1: number): [number, number] {
  return [a * Math.cos(t1), a * Math.sin(t1)]
}

describe('solveTwoBone', () => {
  it('straight down at full reach: leg fully straight (θ1 = 90°, θ2 = 0°)', () => {
    const out: [number, number] = [0, 0]
    solveTwoBone(10, 10, 0, 20, 1, out)
    expect(deg(out[0])).toBeCloseTo(90, 5)
    expect(deg(out[1])).toBeCloseTo(0, 5)
  })

  it('hand-worked: a=b=10, target (10, 10), knee forward -> θ1 = 0°, θ2 = 90°', () => {
    // distance 14.142; hip angle 45°, interior hip angle acos(200/282.8) = 45°.
    // knee forward: upper bone points along +x (0°), lower bone bends 90° down: foot (10, 10).
    const out: [number, number] = [0, 0]
    solveTwoBone(10, 10, 10, 10, 1, out)
    expect(deg(out[0])).toBeCloseTo(0, 4)
    expect(deg(out[1])).toBeCloseTo(90, 4)
  })

  it('hand-worked: same target, knee behind -> θ1 = 90°, θ2 = -90°', () => {
    const out: [number, number] = [0, 0]
    solveTwoBone(10, 10, 10, 10, -1, out)
    expect(deg(out[0])).toBeCloseTo(90, 4)
    expect(deg(out[1])).toBeCloseTo(-90, 4)
  })

  it('puts the foot exactly on any reachable target (checked by forward kinematics)', () => {
    const targets: [number, number][] = [
      [0, 14.142],
      [5, 12],
      [-6, 9],
      [8, 15],
      [-3, 18],
      [12, 4]
    ]
    for (const bend of [1, -1]) {
      for (const [tx, ty] of targets) {
        const out: [number, number] = [0, 0]
        solveTwoBone(10, 10, tx, ty, bend, out)
        const [fx, fy] = foot(10, 10, out[0], out[1])
        expect(fx).toBeCloseTo(tx, 5)
        expect(fy).toBeCloseTo(ty, 5)
      }
    }
  })

  it('works with different bone lengths', () => {
    const out: [number, number] = [0, 0]
    solveTwoBone(8, 14, 6, 12, 1, out)
    const [fx, fy] = foot(8, 14, out[0], out[1])
    expect(fx).toBeCloseTo(6, 5)
    expect(fy).toBeCloseTo(12, 5)
  })

  it('bend direction puts the knee on the requested side', () => {
    const fwd: [number, number] = [0, 0]
    const back: [number, number] = [0, 0]
    solveTwoBone(10, 10, 0, 14, 1, fwd)
    solveTwoBone(10, 10, 0, 14, -1, back)
    expect(knee(10, fwd[0])[0]).toBeGreaterThan(1)
    expect(knee(10, back[0])[0]).toBeLessThan(-1)
  })

  it('too far to reach: the leg stretches straight toward the target and never breaks', () => {
    const out: [number, number] = [0, 0]
    solveTwoBone(10, 10, 0, 50, 1, out)
    expect(deg(out[0])).toBeCloseTo(90, 5)
    expect(deg(out[1])).toBeCloseTo(0, 5)
    solveTwoBone(10, 10, 30, 30, 1, out)
    expect(deg(out[0])).toBeCloseTo(45, 5)
    expect(deg(out[1])).toBeCloseTo(0, 5)
  })

  it('target too close (folded leg) or exactly at the hip returns finite angles', () => {
    const out: [number, number] = [0, 0]
    for (const [tx, ty] of [
      [0, 0],
      [0.1, 0.1],
      [0, 1]
    ] as [number, number][]) {
      solveTwoBone(10, 10, tx, ty, 1, out)
      expect(Number.isFinite(out[0])).toBe(true)
      expect(Number.isFinite(out[1])).toBe(true)
    }
  })

  it('writes into the output array and returns it (no allocation)', () => {
    const out: [number, number] = [0, 0]
    expect(solveTwoBone(10, 10, 0, 15, 1, out)).toBe(out)
  })
})
