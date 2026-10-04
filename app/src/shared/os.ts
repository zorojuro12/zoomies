// §3.2 OS layer — Ansh implements (Windows + stub); everyone consumes (via IPC in the renderer).
import type { Rect } from './geometry'

export interface WindowRect extends Rect {
  id: string
  title: string
  /** 0 = topmost. */
  z: number
  minimized: boolean
}

export type ActivityEvent =
  | { kind: 'typing'; keysPerSec: number; backspaceRatio: number }
  | { kind: 'mouse'; x: number; y: number; speed: number }
  | { kind: 'idle'; seconds: number }

export interface OsLayer {
  /** Visible, non-minimized windows, z-ordered (topmost first). */
  getWindows(): Promise<WindowRect[]>
  /** Primary display area excluding the taskbar. */
  getWorkArea(): Rect
  getTaskbarRect(): Rect | null
  /** Timing only — never key contents. Returns an unsubscribe function. */
  onActivity(cb: (e: ActivityEvent) => void): () => void
  setClickThrough(enabled: boolean): void
}
