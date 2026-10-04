// World SDF v0 (Task 6 of a-p1-overlay.md): signed distance to the work-area bounds and window
// solids. Free space is positive. Hot path (`distance`/`normal`, called every physics substep)
// allocates nothing — solids live in a preallocated Float64Array, `normal` writes into the
// caller's `out` Point.
import type { Point, Rect } from '@shared/geometry'
import type { WindowRect } from '@shared/os'

function sdBoxRaw(px: number, py: number, rx: number, ry: number, rw: number, rh: number): number {
  const cx = rx + rw / 2
  const cy = ry + rh / 2
  const hx = rw / 2
  const hy = rh / 2
  const dx = Math.abs(px - cx) - hx
  const dy = Math.abs(py - cy) - hy
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(dx, dy), 0)
}

/** Signed distance to `r` — negative inside. */
export function sdBox(px: number, py: number, r: Rect): number {
  return sdBoxRaw(px, py, r.x, r.y, r.w, r.h)
}

const NORMAL_EPS = 0.5

export class World {
  static readonly MAX_SOLIDS = 64

  private workArea: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private readonly solidData = new Float64Array(World.MAX_SOLIDS * 4)
  private solidCount = 0

  setBounds(workArea: Rect): void {
    this.workArea = workArea
  }

  /** The work area (the free region's outer edge; everything outside it counts as solid). */
  getBounds(): Rect {
    return this.workArea
  }

  /** Copies the first `MAX_SOLIDS` into a Float64Array; the rest are ignored. */
  setSolids(solids: readonly Rect[]): void {
    const n = Math.min(solids.length, World.MAX_SOLIDS)
    for (let i = 0; i < n; i++) {
      const s = solids[i]
      const base = i * 4
      this.solidData[base] = s.x
      this.solidData[base + 1] = s.y
      this.solidData[base + 2] = s.w
      this.solidData[base + 3] = s.h
    }
    this.solidCount = n
  }

  distance(px: number, py: number): number {
    const wa = this.workArea
    let d = -sdBoxRaw(px, py, wa.x, wa.y, wa.w, wa.h)
    for (let i = 0; i < this.solidCount; i++) {
      const base = i * 4
      const s = sdBoxRaw(
        px,
        py,
        this.solidData[base],
        this.solidData[base + 1],
        this.solidData[base + 2],
        this.solidData[base + 3]
      )
      if (s < d) d = s
    }
    return d
  }

  normal(px: number, py: number, out: Point): Point {
    const dx = this.distance(px + NORMAL_EPS, py) - this.distance(px - NORMAL_EPS, py)
    const dy = this.distance(px, py + NORMAL_EPS) - this.distance(px, py - NORMAL_EPS)
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len > 0) {
      out.x = dx / len
      out.y = dy / len
    } else {
      out.x = 0
      out.y = 0
    }
    return out
  }
}

/**
 * Windows clipped to `workArea`, with maximized/full-screen ones (≥90% of the work area's area)
 * left out. Topmost-first order is preserved. Added in Checkpoint 2.
 */
export function worldSolids(windows: readonly WindowRect[], workArea: Rect): Rect[] {
  const result: Rect[] = []
  const waLeft = workArea.x
  const waTop = workArea.y
  const waRight = workArea.x + workArea.w
  const waBottom = workArea.y + workArea.h
  const waArea = workArea.w * workArea.h

  for (const w of windows) {
    const left = Math.max(w.x, waLeft)
    const top = Math.max(w.y, waTop)
    const right = Math.min(w.x + w.w, waRight)
    const bottom = Math.min(w.y + w.h, waBottom)
    const clippedW = right - left
    const clippedH = bottom - top
    if (clippedW <= 0 || clippedH <= 0) continue

    const clippedArea = clippedW * clippedH
    if (waArea > 0 && clippedArea / waArea >= 0.9) continue

    result.push({ x: left, y: top, w: clippedW, h: clippedH })
  }

  return result
}
