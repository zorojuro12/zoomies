// The real Windows OsLayer (Task 4 of a-p1-overlay.md): polls the live window list, work area and
// taskbar via Win32/DWM; owns the overlay's actual click-through toggle (replacing Task 3's
// temporary index.ts callback). Activity (Task 5) wires `uiohook-napi` via `activity-hooks.ts`.
import { screen, type BrowserWindow, type Rectangle } from 'electron'
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, OsLayer, WindowRect } from '@shared/os'
import { ActivityTracker } from './activity-tracker'
import { startActivityHooks } from './activity-hooks'
import { listRawWindows } from './win32-windows'
import { sameWindows, taskbarRect, toWindowRects } from './window-list'

const POLL_INTERVAL_MS = 150

function toRect(r: Rectangle): Rect {
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}

function toRectangle(r: Rect): Rectangle {
  return { x: r.x, y: r.y, width: r.w, height: r.h }
}

export class WindowsOsLayer implements OsLayer {
  private win: BrowserWindow | null = null
  private selfIds = new Set<string>()
  private latestWindows: WindowRect[] = []

  start(
    win: BrowserWindow,
    onWindows: (w: WindowRect[]) => void,
    onWorkArea: (r: Rect) => void
  ): void {
    this.win = win
    this.selfIds = new Set([hwndId(win)])

    const sendWorkArea = (): void => onWorkArea(this.getWorkArea())
    sendWorkArea()
    screen.on('display-metrics-changed', sendWorkArea)
    screen.on('display-added', sendWorkArea)
    screen.on('display-removed', sendWorkArea)

    const poll = (): void => {
      void this.computeWindows().then((next) => {
        if (!sameWindows(this.latestWindows, next)) {
          this.latestWindows = next
          onWindows(next)
        }
      })
    }
    poll()
    setInterval(poll, POLL_INTERVAL_MS)
  }

  private async computeWindows(): Promise<WindowRect[]> {
    const raw = await listRawWindows()
    const display = toRect(screen.getPrimaryDisplay().bounds)
    const toDip = (r: Rect): Rect => toRect(screen.screenToDipRect(null, toRectangle(r)))
    return toWindowRects(raw, { selfIds: this.selfIds, display, toDip })
  }

  async getWindows(): Promise<WindowRect[]> {
    return this.computeWindows()
  }

  getWorkArea(): Rect {
    return toRect(screen.getPrimaryDisplay().workArea)
  }

  getTaskbarRect(): Rect | null {
    const display = screen.getPrimaryDisplay()
    return taskbarRect(toRect(display.bounds), toRect(display.workArea))
  }

  onActivity(cb: (e: ActivityEvent) => void): () => void {
    return startActivityHooks(new ActivityTracker(), cb)
  }

  setClickThrough(enabled: boolean): void {
    if (!this.win) return
    if (enabled) this.win.setIgnoreMouseEvents(true, { forward: true })
    else this.win.setIgnoreMouseEvents(false)
  }
}

function hwndId(win: BrowserWindow): string {
  return win.getNativeWindowHandle().readBigUInt64LE(0).toString()
}
