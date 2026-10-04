// solveLegToGround: put a paw at a given spot in the DOG frame (origin on the ground between the
// paws, x forward, y DOWN, so the ground is y = 0 and "above the ground" is negative y), whatever
// the body is doing (height, pitch). It converts the target into the body's frame, then runs the
// two-bone IK. The check is independent: run the angles FORWARD (forward kinematics) and the paw
// must land exactly where it was aimed.
import { describe, expect, it } from 'vitest'
import { solveLegToGround } from './leg-solve'
import type { LegGeometry } from './leg-solve'

/** Forward kinematics of the whole chain: body -> hip -> upper -> lower -> paw bottom, in the dog frame. */
function pawInDogFrame(
  g: LegGeometry,
  bodyX: number,
  bodyY: number,
  pitch: number,
  t1: number,
  t2: number
): [number, number] {
  // paw bottom relative to the hip, in the body frame
  const px = g.upper * Math.cos(t1) + g.lower * Math.cos(t1 + t2)
  const py = g.upper * Math.sin(t1) + g.lower * Math.sin(t1 + t2)
  // hip + paw offset, rotate by the body pitch, then add the body position
  const bx = g.hipX + px
  const by = g.hipY + py
  const c = Math.cos(pitch)
  const s = Math.sin(pitch)
  return [bodyX + bx * c - by * s, bodyY + bx * s + by * c]
}

const front: LegGeometry = { hipX: 28, hipY: 10, upper: 25, lower: 25, bend: -1 } // elbow behind
const rear: LegGeometry = { hipX: -28, hipY: 10, upper: 25, lower: 25, bend: 1 } // knee in front

describe('solveLegToGround', () => {
  it('standing: a paw straight under the hip lands exactly there (hand-worked straight-down case)', () => {
    // body 50 above the ground, no pitch: hip at (28, -40); foot straight below at (28, 0).
    // Hip-to-foot distance is 40, the leg is 25+25, so it is reachable with a bent knee.
    const out: [number, number] = [0, 0]
    solveLegToGround(front, 0, -50, 0, 28, 0, out)
    const [x, y] = pawInDogFrame(front, 0, -50, 0, out[0], out[1])
    expect(x).toBeCloseTo(28, 5)
    expect(y).toBeCloseTo(0, 5)
  })

  it('a fully straight leg when the foot is exactly leg-length below the hip', () => {
    const out: [number, number] = [0, 0]
    // hip height above ground = 50 (= 25 + 25): body at -60 (hip y = -60 + 10 = -50)
    solveLegToGround(front, 0, -60, 0, 28, 0, out)
    expect((out[0] * 180) / Math.PI).toBeCloseTo(90, 4)
    expect((out[1] * 180) / Math.PI).toBeCloseTo(0, 4)
  })

  it('lands the paw on the target for many body heights, pitches, foot spots and lifts', () => {
    const out: [number, number] = [0, 0]
    let checked = 0
    for (const g of [front, rear]) {
      for (const bodyY of [-60, -52, -45, -35, -25]) {
        for (const pitchDeg of [-35, -15, 0, 15, 35]) {
          for (const dx of [-12, 0, 12]) {
            for (const lift of [0, 6, 14]) {
              const pitch = (pitchDeg * Math.PI) / 180
              const footX = g.hipX + dx
              solveLegToGround(g, 0, bodyY, pitch, footX, lift, out)
              const [x, y] = pawInDogFrame(g, 0, bodyY, pitch, out[0], out[1])
              // only check targets the leg can actually reach (within the two bones' range)
              const hx = g.hipX * Math.cos(pitch) - g.hipY * Math.sin(pitch)
              const hy = bodyY + g.hipX * Math.sin(pitch) + g.hipY * Math.cos(pitch)
              const dist = Math.hypot(footX - hx, -lift - hy)
              if (dist < g.upper + g.lower - 1e-6 && dist > 1) {
                expect(x).toBeCloseTo(footX, 4)
                expect(y).toBeCloseTo(-lift, 4)
                checked++
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100) // the grid really exercised reachable cases
  })

  it('moves with the body: shifting the body forward keeps a planted paw where it was', () => {
    const out: [number, number] = [0, 0]
    solveLegToGround(front, 0, -45, 0, 30, 0, out)
    const a = pawInDogFrame(front, 0, -45, 0, out[0], out[1])
    solveLegToGround(front, 8, -45, 0, 30, 0, out) // body 8 px further forward, paw target unchanged
    const b = pawInDogFrame(front, 8, -45, 0, out[0], out[1])
    expect(a[0]).toBeCloseTo(30, 5)
    expect(b[0]).toBeCloseTo(30, 5)
  })

  it('bend direction: the front elbow goes behind the hip, the rear knee goes in front', () => {
    const out: [number, number] = [0, 0]
    solveLegToGround(front, 0, -45, 0, 28, 0, out)
    expect(25 * Math.cos(out[0])).toBeLessThan(0) // elbow x relative to the hip, behind
    solveLegToGround(rear, 0, -45, 0, -28, 0, out)
    expect(25 * Math.cos(out[0])).toBeGreaterThan(0) // knee in front
  })

  it('never produces NaN, even for unreachable or degenerate targets', () => {
    const out: [number, number] = [0, 0]
    for (const [bx, by, p, fx, fl] of [
      [0, -200, 0, 28, 0],
      [0, 0, 0, 28, 0],
      [0, -45, 1.4, 500, 0],
      [0, -45, 0, 28, 500]
    ] as const) {
      solveLegToGround(front, bx, by, p, fx, fl, out)
      expect(Number.isFinite(out[0]) && Number.isFinite(out[1])).toBe(true)
    }
  })
})
