// Damped spring: makes floppy parts (ears, tail) lag behind and overshoot like they have weight.
// x chases `target`; stiffness pulls, damping resists velocity. Critical damping is 2*sqrt(stiffness):
// the fastest approach with no overshoot.
import { describe, expect, it } from 'vitest'
import { stepSpring } from './spring'
import type { SpringState } from './spring'

function run(state: SpringState, target: number, k: number, c: number, seconds: number): number[] {
  const xs: number[] = []
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) {
    stepSpring(state, target, k, c, dt)
    xs.push(state.x)
  }
  return xs
}

describe('stepSpring', () => {
  it('settles on the target', () => {
    const s = { x: 0, v: 0 }
    run(s, 1, 100, 20, 3)
    expect(s.x).toBeCloseTo(1, 3)
    expect(s.v).toBeCloseTo(0, 3)
  })
  it('critically damped (k=100, c=2*sqrt(100)=20): approaches without overshooting', () => {
    const xs = run({ x: 0, v: 0 }, 1, 100, 20, 3)
    expect(Math.max(...xs)).toBeLessThanOrEqual(1 + 1e-6)
  })
  it('under-damped (c=4): overshoots the target, then settles', () => {
    const xs = run({ x: 0, v: 0 }, 1, 100, 4, 4)
    expect(Math.max(...xs)).toBeGreaterThan(1.2)
    expect(xs[xs.length - 1]).toBeCloseTo(1, 2)
  })
  it('a stiffer spring gets there sooner', () => {
    const soft = run({ x: 0, v: 0 }, 1, 20, 8, 0.4)
    const stiff = run({ x: 0, v: 0 }, 1, 200, 28, 0.4)
    expect(stiff[stiff.length - 1]!).toBeGreaterThan(soft[soft.length - 1]!)
  })
  it('stays stable with a huge time step (a dropped frame must not explode)', () => {
    const s = { x: 0, v: 0 }
    stepSpring(s, 1, 400, 10, 0.5)
    expect(Number.isFinite(s.x)).toBe(true)
    expect(Math.abs(s.x)).toBeLessThan(10)
  })
  it('does nothing when already at rest on the target', () => {
    const s = { x: 2, v: 0 }
    stepSpring(s, 2, 100, 20, 1 / 60)
    expect(s.x).toBe(2)
    expect(s.v).toBe(0)
  })
  it('updates the state in place (no allocation)', () => {
    const s = { x: 0, v: 0 }
    stepSpring(s, 1, 100, 20, 1 / 60)
    expect(s.x).toBeGreaterThan(0)
  })
})
