// Every long threshold the behaviour layer uses, in one place (P2 Task 2 of
// docs/plans/a-p2-mvp-behaviour.md). `?demo=1` swaps in DEMO_TIMING so judges can see idle, sleep,
// wake and the break nudge inside a 3-minute demo.

export interface Timing {
  /** Seconds without input until the user counts as idle (the dog sits). */
  idleSec: number
  /** Seconds without input until the dog goes to sleep. */
  asleepSec: number
  /** Steady typing: at least this many keys per second... */
  typingKeysPerSec: number
  /** ...held for this many seconds. */
  typingHoldSec: number
  /** Long, intense typing ("focus buddy"): keys per second and how long. */
  focusKeysPerSec: number
  focusHoldSec: number
  /** Backspace spam: more than this share of keys are backspaces... */
  backspaceRatio: number
  /** ...but only while typing at least this fast (one stray backspace means nothing). */
  backspaceMinKeysPerSec: number
  /** Seconds of working without a real break until the break nudge is due. */
  breakAfterSec: number
  /** An absence this long counts as a real break and restarts the break timer. */
  realBreakSec: number
  /** Late night is from this local hour up to (not including) the next. */
  lateNightFromHour: number
  lateNightUntilHour: number
}

export const BEHAVIOUR_TIMING: Timing = {
  idleSec: 60,
  asleepSec: 300,
  typingKeysPerSec: 3,
  typingHoldSec: 8,
  focusKeysPerSec: 4,
  focusHoldSec: 45,
  backspaceRatio: 0.3,
  backspaceMinKeysPerSec: 2,
  breakAfterSec: 50 * 60,
  realBreakSec: 180,
  lateNightFromHour: 23,
  lateNightUntilHour: 5
}

export const DEMO_TIMING: Timing = {
  ...BEHAVIOUR_TIMING,
  idleSec: 8,
  asleepSec: 20,
  typingKeysPerSec: 2,
  typingHoldSec: 3,
  focusHoldSec: 15,
  breakAfterSec: 90,
  realBreakSec: 10
}

export function timingFor(demo: boolean): Timing {
  return demo ? DEMO_TIMING : BEHAVIOUR_TIMING
}
