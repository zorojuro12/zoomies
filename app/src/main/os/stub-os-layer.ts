// StubOsLayer — the OS layer for Macs and for development (contract §3.2).
// Two fake windows, a bottom taskbar, and synthetic typing/idle activity on a timer.
// Ansh's Windows implementation replaces this on the demo laptop.
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, OsLayer, WindowRect } from '@shared/os'

const TASKBAR_HEIGHT = 48
const ACTIVITY_INTERVAL_MS = 2000

export class StubOsLayer implements OsLayer {
  constructor(private readonly screen: { w: number; h: number } = { w: 1920, h: 1080 }) {}

  async getWindows(): Promise<WindowRect[]> {
    return [
      {
        id: 'stub-editor',
        title: 'Code editor',
        x: 160,
        y: 140,
        w: 900,
        h: 560,
        z: 0,
        minimized: false
      },
      {
        id: 'stub-browser',
        title: 'Browser',
        x: 820,
        y: 320,
        w: 760,
        h: 480,
        z: 1,
        minimized: false
      }
    ]
  }

  getWorkArea(): Rect {
    return { x: 0, y: 0, w: this.screen.w, h: this.screen.h - TASKBAR_HEIGHT }
  }

  getTaskbarRect(): Rect | null {
    return { x: 0, y: this.screen.h - TASKBAR_HEIGHT, w: this.screen.w, h: TASKBAR_HEIGHT }
  }

  onActivity(cb: (e: ActivityEvent) => void): () => void {
    let tick = 0
    const timer = setInterval(() => {
      tick += 1
      // Alternate a typing burst and idle time so behaviour has something to react to.
      if (tick % 6 < 3) cb({ kind: 'typing', keysPerSec: 4 + (tick % 3), backspaceRatio: 0.05 })
      else cb({ kind: 'idle', seconds: (tick % 6) * (ACTIVITY_INTERVAL_MS / 1000) })
    }, ACTIVITY_INTERVAL_MS)
    return () => clearInterval(timer)
  }

  setClickThrough(_enabled: boolean): void {
    // No-op on the stub: the real overlay is Windows-only.
  }
}
