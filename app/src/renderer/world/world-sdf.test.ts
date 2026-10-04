import { describe, expect, it } from 'vitest'
import type { Point, Rect } from '@shared/geometry'
import type { WindowRect } from '@shared/os'
import { sdBox, worldSolids, World } from './world-sdf'

function windowRect(
  overrides: Partial<WindowRect> & { x: number; y: number; w: number; h: number }
): WindowRect {
  return { id: 'w', title: 'W', z: 0, minimized: false, ...overrides }
}

describe('sdBox', () => {
  it('is negative inside the rect', () => {
    expect(sdBox(0, 0, { x: -5, y: -5, w: 10, h: 10 })).toBe(-5)
  })
})

describe('World.distance / World.normal', () => {
  const workArea: Rect = { x: 0, y: 0, w: 1000, h: 800 }

  function normalOf(world: World, px: number, py: number): Point {
    const out = { x: 0, y: 0 }
    world.normal(px, py, out)
    return out
  }

  it('with no solids, distance is distance to the work-area edge; normal points inward', () => {
    const world = new World()
    world.setBounds(workArea)
    world.setSolids([])

    expect(world.distance(500, 400)).toBeCloseTo(400, 3)
    expect(world.distance(500, 790)).toBeCloseTo(10, 3)
    const n = normalOf(world, 500, 790)
    expect(n.x).toBeCloseTo(0, 3)
    expect(n.y).toBeCloseTo(-1, 3)
  })

  it('reports distance/normal/inside against a solid window', () => {
    const world = new World()
    world.setBounds(workArea)
    world.setSolids([{ x: 100, y: 100, w: 200, h: 100 }])

    expect(world.distance(200, 90)).toBeCloseTo(10, 3)
    const n = normalOf(world, 200, 90)
    expect(n.x).toBeCloseTo(0, 3)
    expect(n.y).toBeCloseTo(-1, 3)

    expect(world.distance(150, 150)).toBeCloseTo(-50, 3)
    expect(world.distance(90, 90)).toBeCloseTo(14.142, 3)
  })

  it('keeps only the first 64 solids', () => {
    const world = new World()
    world.setBounds(workArea)

    const solids: Rect[] = []
    for (let i = 0; i < 64; i++) solids.push({ x: -10000 - i, y: -10000, w: 1, h: 1 })
    // The 65th solid sits right around the test point — it must be ignored (beyond MAX_SOLIDS).
    solids.push({ x: 490, y: 390, w: 20, h: 20 })
    for (let i = 0; i < 5; i++) solids.push({ x: -20000 - i, y: -20000, w: 1, h: 1 })

    expect(solids.length).toBe(70)
    world.setSolids(solids)

    expect(world.distance(500, 400)).toBeCloseTo(400, 3)
  })
})

describe('worldSolids', () => {
  const workArea: Rect = { x: 0, y: 0, w: 1920, h: 1032 }

  it('clips a window to the work area', () => {
    const windows = [windowRect({ x: -50, y: 100, w: 400, h: 300 })]
    expect(worldSolids(windows, workArea)).toEqual([{ x: 0, y: 100, w: 350, h: 300 }])
  })

  it('leaves out a maximized window but keeps one just under 90% of the work area', () => {
    const maximized = windowRect({ x: 0, y: 0, w: 1920, h: 1032 })
    const almostMaximized = windowRect({ x: 0, y: 0, w: 1800, h: 980 })
    expect(worldSolids([maximized], workArea)).toEqual([])
    expect(worldSolids([almostMaximized], workArea)).toEqual([{ x: 0, y: 0, w: 1800, h: 980 }])
  })

  it('leaves out a window fully below the work area', () => {
    const windows = [windowRect({ x: 0, y: 1040, w: 200, h: 200 })]
    expect(worldSolids(windows, workArea)).toEqual([])
  })

  it('keeps topmost-first order', () => {
    const top = windowRect({ id: 'top', x: 0, y: 0, w: 200, h: 200, z: 0 })
    const behind = windowRect({ id: 'behind', x: 300, y: 0, w: 200, h: 200, z: 1 })
    expect(worldSolids([top, behind], workArea)).toEqual([
      { x: 0, y: 0, w: 200, h: 200 },
      { x: 300, y: 0, w: 200, h: 200 }
    ])
  })
})
