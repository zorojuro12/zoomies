import { describe, expect, it } from 'vitest'
import { sameWindows, taskbarRect, toWindowRects, type RawWindow } from './window-list'
import type { WindowRect } from '@shared/os'

const display = { x: 0, y: 0, w: 1920, h: 1080 }
const identity = (r: { x: number; y: number; w: number; h: number }): typeof r => r

function raw(overrides: Partial<RawWindow> & { id: string; title: string }): RawWindow {
  return {
    visible: true,
    minimized: false,
    cloaked: false,
    toolWindow: false,
    rect: { x: 100, y: 100, w: 200, h: 200 },
    ...overrides
  }
}

describe('toWindowRects', () => {
  it('filters out self, hidden, minimized, cloaked, tool, titleless, shell, tiny and off-screen windows, keeping z-order', () => {
    const input: RawWindow[] = [
      raw({ id: '1', title: 'Self' }),
      raw({ id: '2', title: 'Notepad', rect: { x: 10.4, y: 20.6, w: 300.2, h: 200.5 } }),
      raw({ id: '3', title: 'Hidden', visible: false }),
      raw({ id: '4', title: 'Min', minimized: true }),
      raw({ id: '5', title: 'Cloaked', cloaked: true }),
      raw({ id: '6', title: 'Tool', toolWindow: true }),
      raw({ id: '7', title: '' }),
      raw({ id: '8', title: 'Program Manager' }),
      raw({ id: '9', title: 'Tiny', rect: { x: 500, y: 500, w: 40, h: 40 } }),
      raw({ id: '10', title: 'OffScreen', rect: { x: 2000, y: 100, w: 300, h: 200 } }),
      raw({ id: '11', title: 'Chrome', rect: { x: 400, y: 300, w: 500, h: 400 } })
    ]

    const result = toWindowRects(input, { selfIds: new Set(['1']), display, toDip: identity })

    expect(result).toEqual([
      { id: '2', title: 'Notepad', x: 10, y: 21, w: 300, h: 201, z: 0, minimized: false },
      { id: '11', title: 'Chrome', x: 400, y: 300, w: 500, h: 400, z: 1, minimized: false }
    ])
  })

  it('applies toDip before the minimum-size filter, so a 125% scale drops the right windows', () => {
    const toDip125 = (r: { x: number; y: number; w: number; h: number }): typeof r => ({
      x: r.x / 1.25,
      y: r.y / 1.25,
      w: r.w / 1.25,
      h: r.h / 1.25
    })
    const kept = toWindowRects(
      [raw({ id: '1', title: 'Scaled', rect: { x: 125, y: 250, w: 1250, h: 625 } })],
      { selfIds: new Set(), display, toDip: toDip125 }
    )
    expect(kept).toEqual([
      { id: '1', title: 'Scaled', x: 100, y: 200, w: 1000, h: 500, z: 0, minimized: false }
    ])

    const dropped = toWindowRects(
      [raw({ id: '2', title: 'TooSmallAtDip', rect: { x: 100, y: 100, w: 60, h: 60 } })],
      { selfIds: new Set(), display, toDip: toDip125 }
    )
    expect(dropped).toEqual([])
  })
})

describe('sameWindows', () => {
  const a: WindowRect[] = [
    { id: '1', title: 'A', x: 0, y: 0, w: 100, h: 100, z: 0, minimized: false }
  ]

  it('is true for equal lists', () => {
    expect(sameWindows(a, [{ ...a[0] }])).toBe(true)
  })

  it('is false when one x differs by 1', () => {
    expect(sameWindows(a, [{ ...a[0], x: 1 }])).toBe(false)
  })

  it('is false for different lengths', () => {
    expect(sameWindows(a, [])).toBe(false)
  })
})

describe('taskbarRect', () => {
  const bounds = { x: 0, y: 0, w: 1920, h: 1080 }

  it('returns the bottom strip for a bottom taskbar', () => {
    expect(taskbarRect(bounds, { x: 0, y: 0, w: 1920, h: 1032 })).toEqual({
      x: 0,
      y: 1032,
      w: 1920,
      h: 48
    })
  })

  it('returns the top strip for a top taskbar', () => {
    expect(taskbarRect(bounds, { x: 0, y: 40, w: 1920, h: 1040 })).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 40
    })
  })

  it('returns the left strip for a left taskbar', () => {
    expect(taskbarRect(bounds, { x: 60, y: 0, w: 1860, h: 1080 })).toEqual({
      x: 0,
      y: 0,
      w: 60,
      h: 1080
    })
  })

  it('returns null when the work area equals the bounds (auto-hide)', () => {
    expect(taskbarRect(bounds, bounds)).toBeNull()
  })
})
