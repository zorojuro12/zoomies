// Activity classifier (P2 Task 2 of docs/plans/a-p2-mvp-behaviour.md): turns Ansh's raw activity
// events (typing rate, mouse speed, OS idle seconds) into the few plain labels the dog's brain
// uses. Time is passed in (`update(dtMs, hour)`), never read, so every threshold is testable
// instantly. Idle comes from the OS's own idle seconds, so a stalled app cannot get it wrong.
// Pure numbers, preallocated state, no allocation per event or per frame.
import type { ActivityEvent } from '@shared/os'
import type { Timing } from './timing'

export type UserState = 'active' | 'typing' | 'focus' | 'idle' | 'asleep'

/** One-off things that happen, delivered to `onNote` listeners in order. */
export type ActivityNote = 'wentIdle' | 'fellAsleep' | 'returned' | 'breakDue'

export interface ActivityState {
  user: UserState
  backspaceSpam: boolean
  breakDue: boolean
  lateNight: boolean
  /** Seconds since the user last did anything. */
  idleSec: number
}

/** A typing report older than this no longer says what the user is doing now. */
const RATE_FRESH_MS = 1500
/** A gap in typing longer than this starts the steady-typing count over. */
const TYPING_GAP_MS = 2000
/** Time with no input still counts as working for this long (a short think). */
const WORKING_GRACE_SEC = 5

export class ActivityClassifier {
  readonly state: ActivityState = {
    user: 'active',
    backspaceSpam: false,
    breakDue: false,
    lateNight: false,
    idleSec: 0
  }

  private workedSec = 0
  private rateKeys = 0
  private rateRatio = 0
  private rateAgeMs = Number.POSITIVE_INFINITY
  private fastMs = 0
  private fastQuietMs = 0
  private focusMs = 0
  private focusQuietMs = 0
  private readonly listeners = new Set<(n: ActivityNote) => void>()

  constructor(private readonly timing: Timing) {}

  onNote(cb: (n: ActivityNote) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** The dog has done its break nudge: clear the flag and start counting work again. */
  breakHandled(): void {
    this.workedSec = 0
    this.state.breakDue = false
  }

  /** Input that is not the mouse or keyboard (the joystick, a button): the user is here, reset the idle clock. */
  noteInput(): void {
    this.state.idleSec = 0
    this.recompute()
  }

  /** Pretend the user has just worked the whole break interval (for demos and tests). */
  forceBreakDue(): void {
    this.workedSec = this.timing.breakAfterSec
    this.recompute()
  }

  /** Feed one event from the activity tracker. */
  onEvent(e: ActivityEvent): void {
    if (e.kind === 'typing') {
      if (!Number.isFinite(e.keysPerSec)) return
      this.rateKeys = Math.max(0, e.keysPerSec)
      this.rateRatio = Number.isFinite(e.backspaceRatio)
        ? Math.min(1, Math.max(0, e.backspaceRatio))
        : 0
      this.rateAgeMs = 0
      if (this.rateKeys > 0) this.state.idleSec = 0
    } else if (e.kind === 'mouse') {
      if (!Number.isFinite(e.speed)) return
      if (e.speed > 0) this.state.idleSec = 0
    } else {
      if (!Number.isFinite(e.seconds)) return
      this.state.idleSec = Math.max(0, e.seconds)
    }
    this.recompute()
  }

  /** Let `dtMs` of time pass. `hour` is the local hour of day, 0..23. */
  update(dtMs: number, hour: number): void {
    const t = this.timing
    this.state.lateNight = hour >= t.lateNightFromHour || hour < t.lateNightUntilHour
    if (!Number.isFinite(dtMs) || dtMs <= 0) return

    const dtSec = dtMs / 1000
    const prevIdle = this.state.idleSec
    this.state.idleSec += dtSec

    // work time: only the part of this step while the user was (nearly) still at it
    this.workedSec += Math.min(dtSec, Math.max(0, WORKING_GRACE_SEC - prevIdle))
    if (this.state.idleSec >= t.realBreakSec) {
      this.workedSec = 0
      this.state.breakDue = false
    }

    // steady typing / focus: time spent typing fast, restarted by a long enough gap
    this.rateAgeMs += dtMs
    const fresh = this.rateAgeMs < RATE_FRESH_MS
    if (fresh && this.rateKeys >= t.typingKeysPerSec) {
      this.fastMs += dtMs
      this.fastQuietMs = 0
    } else {
      this.fastQuietMs += dtMs
      if (this.fastQuietMs > TYPING_GAP_MS) this.fastMs = 0
    }
    if (fresh && this.rateKeys >= t.focusKeysPerSec) {
      this.focusMs += dtMs
      this.focusQuietMs = 0
    } else {
      this.focusQuietMs += dtMs
      if (this.focusQuietMs > TYPING_GAP_MS) this.focusMs = 0
    }

    this.recompute()
  }

  private recompute(): void {
    const t = this.timing
    const s = this.state

    s.backspaceSpam =
      this.rateAgeMs < RATE_FRESH_MS &&
      this.rateKeys >= t.backspaceMinKeysPerSec &&
      this.rateRatio > t.backspaceRatio

    // many small steps add up with rounding error (80 x 0.1 s is 7.999999999999993): allow a hair
    const idle = s.idleSec + 1e-6
    let user: UserState
    if (idle >= t.asleepSec) user = 'asleep'
    else if (idle >= t.idleSec) user = 'idle'
    else if (this.focusMs >= t.focusHoldSec * 1000) user = 'focus'
    else if (this.fastMs >= t.typingHoldSec * 1000) user = 'typing'
    else user = 'active'

    const prev = s.user
    s.user = user
    const rank = (u: UserState): number => (u === 'asleep' ? 2 : u === 'idle' ? 1 : 0)
    if (rank(user) > rank(prev)) {
      if (rank(prev) === 0) this.emit('wentIdle')
      if (rank(user) === 2) this.emit('fellAsleep')
    } else if (rank(prev) === 2 && rank(user) < 2) {
      this.emit('returned')
    }

    if (!s.breakDue && this.workedSec >= t.breakAfterSec) {
      s.breakDue = true
      this.emit('breakDue')
    }
  }

  private emit(n: ActivityNote): void {
    for (const cb of this.listeners) cb(n)
  }
}
