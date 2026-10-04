// Pure window-list logic (Task 4 of a-p1-overlay.md): filtering, z-order, DIP conversion,
// diffing and the taskbar rect. The Win32/DWM glue that produces `RawWindow[]` lives in
// `win32-windows.ts`; this file has no native dependency so it's fully unit-testable.
import type { Rect } from '@shared/geometry'
import type { WindowRect } from '@shared/os'

export interface RawWindow {
  id: string
  title: string
  visible: boolean
  minimized: boolean
  cloaked: boolean
  toolWindow: boolean
  /** Physical px, DWM extended frame bounds. */
  rect: Rect
}

const MIN_SIZE_DIP = 50

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function toWindowRects(
  raw: readonly RawWindow[],
  opts: { selfIds: ReadonlySet<string>; display: Rect; toDip: (r: Rect) => Rect }
): WindowRect[] {
  const result: WindowRect[] = []
  for (const w of raw) {
    if (!w.visible || w.minimized || w.cloaked || w.toolWindow) continue
    if (w.title.trim() === '') continue
    if (w.title === 'Program Manager') continue
    if (opts.selfIds.has(w.id)) continue

    const dip = opts.toDip(w.rect)
    if (dip.w < MIN_SIZE_DIP || dip.h < MIN_SIZE_DIP) continue
    if (!intersects(dip, opts.display)) continue

    result.push({
      id: w.id,
      title: w.title,
      x: Math.round(dip.x),
      y: Math.round(dip.y),
      w: Math.round(dip.w),
      h: Math.round(dip.h),
      z: result.length,
      minimized: false
    })
  }
  return result
}

export function sameWindows(a: readonly WindowRect[], b: readonly WindowRect[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const wa = a[i]
    const wb = b[i]
    if (wa.id !== wb.id || wa.x !== wb.x || wa.y !== wb.y || wa.w !== wb.w || wa.h !== wb.h) {
      return false
    }
  }
  return true
}

export function taskbarRect(bounds: Rect, workArea: Rect): Rect | null {
  if (
    bounds.x === workArea.x &&
    bounds.y === workArea.y &&
    bounds.w === workArea.w &&
    bounds.h === workArea.h
  ) {
    return null
  }
  if (workArea.h < bounds.h) {
    // Taskbar on the bottom or top.
    if (workArea.y === bounds.y) {
      // Top-anchored work area -> taskbar is the bottom strip.
      return { x: bounds.x, y: workArea.y + workArea.h, w: bounds.w, h: bounds.h - workArea.h }
    }
    return { x: bounds.x, y: bounds.y, w: bounds.w, h: workArea.y - bounds.y }
  }
  // Taskbar on the left or right.
  if (workArea.x === bounds.x) {
    return { x: workArea.x + workArea.w, y: bounds.y, w: bounds.w - workArea.w, h: bounds.h }
  }
  return { x: bounds.x, y: bounds.y, w: workArea.x - bounds.x, h: bounds.h }
}
