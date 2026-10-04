// FPS / frame-time readout (Task 2 of a-p1-overlay.md). Throttled to 4x/s so the DOM write
// itself never costs anything inside the frame loop.
import type { FrameStats } from './frame-stats'

export class Hud {
  private worldText = ''
  private activityText = ''
  private lastUpdateMs = -Infinity

  constructor(private readonly el: HTMLElement) {}

  set(field: 'world' | 'activity', text: string): void {
    if (field === 'world') this.worldText = text
    else this.activityText = text
  }

  frame(stats: FrameStats, nowMs: number): void {
    if (nowMs - this.lastUpdateMs < 250) return
    this.lastUpdateMs = nowMs
    this.el.textContent =
      `fps ${stats.fps().toFixed(0)} · frame p95 ${stats.frameP95().toFixed(1)} ms · ` +
      `work ${stats.workAvg().toFixed(1)} / p95 ${stats.workP95().toFixed(1)} ms · ` +
      `${this.worldText} · ${this.activityText}`
  }
}
