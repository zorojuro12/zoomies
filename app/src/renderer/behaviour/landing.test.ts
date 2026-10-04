// Landing prediction (P2 Task 3): "if I let this ball play out, where does it end up?" It replays
// Ansh's real ball physics (stepBall) on a COPY of the ball, so the answer matches what the live
// ball will do and the live ball is never touched.
import { describe, expect, it } from 'vitest'
import { createBall, stepBall } from '../world/ball'
import type { Ball } from '../world/ball'
import { World } from '../world/world-sdf'
import { predictLanding } from './landing'
import type { Landing } from './landing'

const STEP = 16.667
const world = (solids: { x: number; y: number; w: number; h: number }[] = []): World => {
  const w = new World()
  w.setBounds({ x: 0, y: 0, w: 1000, h: 800 })
  w.setSolids(solids)
  return w
}
const out = (): Landing => ({ x: 0, y: 0, tMs: 0, settled: false })
/** Let the live ball play out for real, with the same step the prediction uses. */
function playOut(ball: Ball, w: World): void {
  for (let i = 0; i < 3000 && !ball.resting; i++) stepBall(ball, w, STEP)
}

describe('predictLanding', () => {
  it('a dropped ball ends on the floor right under where it was let go', () => {
    const b = createBall(500, 100)
    const l = predictLanding(b, world(), 20000, out())
    expect(l.settled).toBe(true)
    expect(l.x).toBeCloseTo(500, 0)
    expect(l.y).toBeCloseTo(790, 0) // floor 800 minus the radius 10
    expect(l.tMs).toBeGreaterThan(500)
  })

  it('a thrown ball ends up further along in the direction of the throw', () => {
    const b = createBall(200, 700)
    b.vx = 900
    b.vy = -800
    const l = predictLanding(b, world(), 20000, out())
    expect(l.settled).toBe(true)
    expect(l.x).toBeGreaterThan(200)
  })

  it('matches what the live ball really does (the whole point): same rest spot within 2 px', () => {
    for (const [x, y, vx, vy] of [
      [200, 700, 900, -800],
      [800, 300, -1200, -300],
      [500, 100, 0, 0],
      [100, 750, 2000, -2000]
    ] as const) {
      const w = world([{ x: 600, y: 600, w: 200, h: 200 }])
      const live = createBall(x, y)
      live.vx = vx
      live.vy = vy
      const l = predictLanding(live, w, 30000, out())
      playOut(live, w)
      expect(live.resting).toBe(true)
      expect(Math.abs(l.x - live.x), `case ${x},${y}`).toBeLessThan(2)
      expect(Math.abs(l.y - live.y), `case ${x},${y}`).toBeLessThan(2)
    }
  })

  it('knows about windows: a ball thrown at a window top ends up on top of it, not on the floor', () => {
    const w = world([{ x: 400, y: 500, w: 300, h: 300 }])
    const b = createBall(450, 100)
    const l = predictLanding(b, w, 20000, out())
    expect(l.y).toBeLessThan(500)
    expect(l.y).toBeCloseTo(490, 0)
  })

  it('never touches the live ball', () => {
    const b = createBall(200, 700)
    b.vx = 900
    b.vy = -800
    const before = { ...b }
    predictLanding(b, world(), 20000, out())
    expect(b).toEqual(before)
  })

  it('a ball already at rest is already there: now, settled', () => {
    const b = createBall(300, 790)
    b.resting = true
    const l = predictLanding(b, world(), 20000, out())
    expect(l.settled).toBe(true)
    expect(l.tMs).toBe(0)
    expect(l.x).toBe(300)
    expect(l.y).toBe(790)
  })

  it('a ball the player is holding is where it is', () => {
    const b = createBall(300, 400)
    b.held = true
    const l = predictLanding(b, world(), 20000, out())
    expect(l.settled).toBe(true)
    expect(l.x).toBe(300)
    expect(l.y).toBe(400)
  })

  it('gives up after maxMs and says it has not settled, reporting where the ball would be then', () => {
    const b = createBall(500, 100)
    const l = predictLanding(b, world(), 100, out())
    expect(l.settled).toBe(false)
    expect(l.tMs).toBeCloseTo(100, -1)
    expect(l.y).toBeGreaterThan(100)
  })

  it('writes into the object it is given and returns it (no allocation per call)', () => {
    const o = out()
    const l = predictLanding(createBall(500, 100), world(), 20000, o)
    expect(l).toBe(o)
  })

  it('survives garbage (NaN position or speed): reports the ball where it is, settled', () => {
    const b = createBall(Number.NaN, 100)
    const l = predictLanding(b, world(), 20000, out())
    expect(l.settled).toBe(true)
  })
})
