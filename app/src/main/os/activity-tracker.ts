// Pure activity logic (Task 5 of a-p1-overlay.md): typing rate, backspace ratio, mouse speed and
// throttled event emission. Preallocated ring buffers — no allocation on `key`/`mouse`. Privacy:
// this class never sees a key code, only the caller's `isBackspace` boolean (§ "Privacy" rule).
import type { ActivityEvent } from '@shared/os'

const KEY_CAPACITY = 512
const MOUSE_CAPACITY = 64

export class ActivityTracker {
  private readonly typingWindowMs: number
  private readonly mouseWindowMs: number

  private readonly keyTimes = new Float64Array(KEY_CAPACITY)
  private readonly keyBackspace = new Uint8Array(KEY_CAPACITY)
  private keyWrite = 0
  private keyCount = 0

  private readonly mouseT = new Float64Array(MOUSE_CAPACITY)
  private readonly mouseX = new Float64Array(MOUSE_CAPACITY)
  private readonly mouseY = new Float64Array(MOUSE_CAPACITY)
  private mouseWrite = 0
  private mouseCount = 0

  private lastTypingEmitMs = -Infinity
  private lastKeysPerSec = 0
  private lastMouseEmitMs = -Infinity
  private lastIdleEmitMs = -Infinity

  constructor(opts?: { typingWindowMs?: number; mouseWindowMs?: number }) {
    this.typingWindowMs = opts?.typingWindowMs ?? 2000
    this.mouseWindowMs = opts?.mouseWindowMs ?? 250
  }

  key(tMs: number, isBackspace: boolean): void {
    this.keyTimes[this.keyWrite] = tMs
    this.keyBackspace[this.keyWrite] = isBackspace ? 1 : 0
    this.keyWrite = (this.keyWrite + 1) % KEY_CAPACITY
    this.keyCount = Math.min(this.keyCount + 1, KEY_CAPACITY)
  }

  typing(tMs: number): { keysPerSec: number; backspaceRatio: number } {
    const cutoff = tMs - this.typingWindowMs
    let count = 0
    let backspaces = 0
    for (let i = 0; i < this.keyCount; i++) {
      if (this.keyTimes[i] > cutoff) {
        count++
        if (this.keyBackspace[i]) backspaces++
      }
    }
    const keysPerSec = count / (this.typingWindowMs / 1000)
    const backspaceRatio = count === 0 ? 0 : backspaces / count
    return { keysPerSec, backspaceRatio }
  }

  mouse(tMs: number, x: number, y: number): void {
    this.mouseT[this.mouseWrite] = tMs
    this.mouseX[this.mouseWrite] = x
    this.mouseY[this.mouseWrite] = y
    this.mouseWrite = (this.mouseWrite + 1) % MOUSE_CAPACITY
    this.mouseCount = Math.min(this.mouseCount + 1, MOUSE_CAPACITY)
  }

  mouseSpeed(tMs: number): number {
    const n = this.mouseCount
    if (n < 2) return 0
    const cutoff = tMs - this.mouseWindowMs
    const startIdx = n === MOUSE_CAPACITY ? this.mouseWrite : 0

    let started = false
    let firstT = 0
    let lastT = 0
    let prevX = 0
    let prevY = 0
    let path = 0
    let inWindow = 0

    for (let k = 0; k < n; k++) {
      const idx = (startIdx + k) % MOUSE_CAPACITY
      const t = this.mouseT[idx]
      if (t <= cutoff) continue
      const x = this.mouseX[idx]
      const y = this.mouseY[idx]
      if (started) {
        const dx = x - prevX
        const dy = y - prevY
        path += Math.sqrt(dx * dx + dy * dy)
      } else {
        firstT = t
        started = true
      }
      prevX = x
      prevY = y
      lastT = t
      inWindow++
    }

    if (inWindow < 2) return 0
    const spanSec = (lastT - firstT) / 1000
    return spanSec > 0 ? path / spanSec : 0
  }

  tick(tMs: number, idleSeconds: number): ActivityEvent[] {
    const events: ActivityEvent[] = []

    const { keysPerSec, backspaceRatio } = this.typing(tMs)
    if (keysPerSec > 0) {
      if (tMs - this.lastTypingEmitMs >= 500) {
        events.push({ kind: 'typing', keysPerSec, backspaceRatio })
        this.lastTypingEmitMs = tMs
      }
    } else if (this.lastKeysPerSec > 0) {
      events.push({ kind: 'typing', keysPerSec: 0, backspaceRatio })
      this.lastTypingEmitMs = tMs
    }
    this.lastKeysPerSec = keysPerSec

    const speed = this.mouseSpeed(tMs)
    if (speed > 0 && tMs - this.lastMouseEmitMs >= 100 && this.mouseCount > 0) {
      const idx = (this.mouseWrite - 1 + MOUSE_CAPACITY) % MOUSE_CAPACITY
      events.push({ kind: 'mouse', x: this.mouseX[idx], y: this.mouseY[idx], speed })
      this.lastMouseEmitMs = tMs
    }

    if (tMs - this.lastIdleEmitMs >= 1000) {
      events.push({ kind: 'idle', seconds: idleSeconds })
      this.lastIdleEmitMs = tMs
    }

    return events
  }
}
