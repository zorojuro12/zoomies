// Yaw = how far the dog is turned about its vertical axis (three.js rotation.y, radians).
//   0°   facing screen-right (side-on)        90°  facing up the screen (back to the viewer)
//   180° facing screen-left                  -90°  facing down the screen (face to the viewer)
// Sideways travel leans 25° toward the viewer; standing still turns further, 60°, so the dog faces
// us; vertical travel doesn't lean.
// Expected angles are hand-worked (see comments), not recomputed from the implementation.
import { describe, expect, it } from 'vitest'
import { restYaw, stepAngle, targetYaw } from './yaw'

const deg = (d: number): number => (d * Math.PI) / 180
/** Smallest signed difference between two angles, in degrees, in (-180, 180]. */
function diffDeg(a: number, b: number): number {
  let d = (((a - b) * 180) / Math.PI) % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

describe('targetYaw (screen velocity -> yaw)', () => {
  it('right: three-quarter view, leaning toward the viewer', () => {
    expect(diffDeg(targetYaw(100, 0), deg(-25))).toBeCloseTo(0, 1)
  })
  it('left: the mirror three-quarter view (205° = -155°)', () => {
    expect(diffDeg(targetYaw(-100, 0), deg(-155))).toBeCloseTo(0, 1)
  })
  it('up the screen: back to the viewer, no lean', () => {
    expect(diffDeg(targetYaw(0, -100), deg(90))).toBeCloseTo(0, 1)
  })
  it('down the screen: face to the viewer, no lean', () => {
    expect(diffDeg(targetYaw(0, 100), deg(-90))).toBeCloseTo(0, 1)
  })
  it('up-right: between right and up (hand-worked 28.1°)', () => {
    // direction (0.7071, -0.7071); lean adds 0.4663*0.7071 = 0.3297 toward the viewer;
    // forward = (0.7071, -0.3774) -> atan2(0.3774, 0.7071) = 28.1°
    expect(diffDeg(targetYaw(100, -100), deg(28.1))).toBeCloseTo(0, 0)
  })
  it('only the direction matters, not the speed', () => {
    expect(targetYaw(5, 0)).toBeCloseTo(targetYaw(500, 0))
  })
})

describe('restYaw (standing still)', () => {
  it('turns well toward the viewer: 60° from side-on, face and chest toward us, not in profile', () => {
    expect(diffDeg(restYaw(1), deg(-60))).toBeCloseTo(0, 1)
    expect(diffDeg(restYaw(-1), deg(-120))).toBeCloseTo(0, 1) // the mirror image
  })
  it('still favours the side it was last facing (right stays in the right half, left in the left)', () => {
    expect(Math.cos(restYaw(1))).toBeGreaterThan(0)
    expect(Math.cos(restYaw(-1))).toBeLessThan(0)
  })
  it('leans toward the viewer (never away): the forward vector points toward +z', () => {
    expect(-Math.sin(restYaw(1))).toBeGreaterThan(0.8)
    expect(-Math.sin(restYaw(-1))).toBeGreaterThan(0.8)
  })
  it('is turned further toward the viewer than the walking lean is', () => {
    expect(-Math.sin(restYaw(1))).toBeGreaterThan(-Math.sin(targetYaw(100, 0)))
  })
})

describe('stepAngle (smooth turn, shortest way round)', () => {
  it('does not move with zero time', () => {
    expect(stepAngle(deg(40), deg(100), 0, 10)).toBeCloseTo(deg(40))
  })
  it('moves a fraction of the way: 1 - e^(-rate*dt) = 0.3935 of 20° = 7.87°', () => {
    expect(diffDeg(stepAngle(deg(0), deg(20), 0.05, 10), deg(7.87))).toBeCloseTo(0, 1)
  })
  it('takes the short way across the ±180° seam (170° -> -170° is +20°, not -340°)', () => {
    const next = stepAngle(deg(170), deg(-170), 0.05, 10)
    expect(diffDeg(next, deg(177.87))).toBeCloseTo(0, 1)
  })
  it('converges on the target given enough time', () => {
    expect(diffDeg(stepAngle(deg(10), deg(-120), 5, 10), deg(-120))).toBeCloseTo(0, 3)
  })
})
