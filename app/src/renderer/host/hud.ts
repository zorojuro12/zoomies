// FPS / frame-time readout (Task 2 of a-p1-overlay.md). Throttled to 4x/s so the DOM write
// itself never costs anything inside the frame loop.
import type { FrameStats } from './frame-stats'

/** How long what the dog heard stays on screen. */
export const VOICE_TEXT_MS = 5000

export class Hud {
  private worldText = ''
  private activityText = ''
  private powerText = ''
  private controllerText = ''
  private voiceText = ''
  private voiceAt = 0
  private lastUpdateMs = -Infinity

  constructor(private readonly el: HTMLElement) {}

  set(field: 'world' | 'activity' | 'power' | 'controller' | 'voice', text: string): void {
    if (field === 'voice') {
      this.voiceText = text
      this.voiceAt = performance.now()
    } else if (field === 'controller') this.controllerText = text
    else if (field === 'world') this.worldText = text
    else if (field === 'power') this.powerText = text
    else this.activityText = text
  }

  frame(stats: FrameStats, nowMs: number): void {
    if (nowMs - this.lastUpdateMs < 250) return
    this.lastUpdateMs = nowMs
    if (this.voiceText && nowMs - this.voiceAt > VOICE_TEXT_MS) this.voiceText = '' // old news: clear it
    this.el.textContent =
      `fps ${stats.fps().toFixed(0)} · frame p95 ${stats.frameP95().toFixed(1)} ms · ` +
      `work ${stats.workAvg().toFixed(1)} / p95 ${stats.workP95().toFixed(1)} ms · ` +
      `${this.worldText} · ${this.activityText}${this.powerText ? ` · ${this.powerText}` : ''}${this.controllerText ? ` · ${this.controllerText}` : ''}${this.voiceText ? ` · ${this.voiceText}` : ''}`
  }
}

/** What the HUD says about the controller. */
export function controllerHudText(s: { connected: boolean; port: string | null }): string {
  return s.connected ? `controller ${s.port ?? 'connected'}` : 'controller: not found'
}
