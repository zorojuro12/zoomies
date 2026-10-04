// Global input hooks (Task 5 of a-p1-overlay.md) feeding an ActivityTracker. Privacy: only
// `e.keycode === UiohookKey.Backspace` is ever read from a key event — the key code itself is
// never logged, stored or forwarded anywhere.
import { screen, powerMonitor } from 'electron'
import type { ActivityEvent } from '@shared/os'
import type { ActivityTracker } from './activity-tracker'

const TICK_INTERVAL_MS = 100
const CURSOR_POLL_INTERVAL_MS = 50

export function startActivityHooks(
  tracker: ActivityTracker,
  emit: (e: ActivityEvent) => void
): () => void {
  let stop: () => void = () => {}

  const startTickLoop = (): (() => void) => {
    const timer = setInterval(() => {
      const now = Date.now()
      for (const e of tracker.tick(now, powerMonitor.getSystemIdleTime())) emit(e)
    }, TICK_INTERVAL_MS)
    return () => clearInterval(timer)
  }

  const startCursorPollingFallback = (): (() => void) => {
    const timer = setInterval(() => {
      const p = screen.screenToDipPoint(screen.getCursorScreenPoint())
      tracker.mouse(Date.now(), p.x, p.y)
    }, CURSOR_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }

  void (async (): Promise<void> => {
    try {
      const { uIOhook, UiohookKey } = await import('uiohook-napi')
      uIOhook.on('keydown', (e) => {
        tracker.key(Date.now(), e.keycode === UiohookKey.Backspace)
      })
      uIOhook.on('mousemove', (e) => {
        const p = screen.screenToDipPoint({ x: e.x, y: e.y })
        tracker.mouse(Date.now(), p.x, p.y)
      })
      uIOhook.start()
      const stopTick = startTickLoop()
      stop = () => {
        uIOhook.stop()
        stopTick()
      }
    } catch {
      console.log('[activity] uiohook unavailable, mouse via cursor polling, no typing')
      const stopPoll = startCursorPollingFallback()
      const stopTick = startTickLoop()
      stop = () => {
        stopPoll()
        stopTick()
      }
    }
  })()

  return () => stop()
}
