import { describe, expect, it } from 'vitest'
import { aimFromDrag, ballHit, launchVelocity, SLING } from './slingshot'

describe('aimFromDrag', () => {
  it('aims right with half power when pulled left', () => {
    const aim = aimFromDrag(500, 500, 450, 500)
    expect(aim).not.toBeNull()
    expect(aim!.angle).toBeCloseTo(0, 9)
    expect(aim!.power).toBeCloseTo(0.5, 9)
  })

  it('clamps power at 1 and aims up when pulled far down', () => {
    const aim = aimFromDrag(500, 500, 500, 700)
    expect(aim).not.toBeNull()
    expect(aim!.angle).toBeCloseTo(-Math.PI / 2, 9)
    expect(aim!.power).toBe(1)
  })

  it('returns null below the minimum pull distance', () => {
    expect(aimFromDrag(500, 500, 505, 500)).toBeNull()
  })
})

describe('launchVelocity', () => {
  it('maps angle 0 at half power to a rightward velocity', () => {
    const out = { vx: 0, vy: 0 }
    launchVelocity(0, 0.5, out)
    expect(out.vx).toBeCloseTo(1300, 9)
    expect(out.vy).toBeCloseTo(0, 9)
  })

  it('maps -pi/2 at full power to a purely upward velocity', () => {
    const out = { vx: 0, vy: 0 }
    launchVelocity(-Math.PI / 2, 1, out)
    expect(out.vx).toBeCloseTo(0, 9)
    expect(out.vy).toBeCloseTo(-2600, 9)
  })
})

describe('ballHit', () => {
  const ball = { x: 500, y: 500, vx: 0, vy: 0, r: 10, resting: true, contactMs: 0, held: false }

  it('is true within r + grabRadiusPx', () => {
    expect(ballHit(ball, 521, 500)).toBe(true)
  })

  it('is false just past r + grabRadiusPx', () => {
    expect(ballHit(ball, 523, 500)).toBe(false)
  })
})

describe('SLING constants', () => {
  it('matches the tuned values', () => {
    expect(SLING).toEqual({ maxPullPx: 100, minPullPx: 8, maxLaunchSpeed: 2600, grabRadiusPx: 12 })
  })
})
