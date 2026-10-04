// Adaptive frame rate (P2 Task 5 of docs/plans/a-p2-mvp-behaviour.md): when nothing is happening the
// app redraws less, so the dog costs almost nothing while it sleeps or lies beside you. The host
// asks `shouldRun(nowMs, tier)` on every screen refresh and skips the frame when it says no.
//   full  = every refresh (never slower than the screen: "at least 60 FPS when active")
//   rest  = 30 frames a second (sitting idle, lying beside you while you type)
//   sleep = 5 frames a second (asleep)
// No allocation, no clock of its own (the host passes the time in).

export type FpsTier = 'full' | 'rest' | 'sleep'

export const TIER_FPS: Record<FpsTier, number> = {
  full: Number.POSITIVE_INFINITY,
  rest: 30,
  sleep: 5
}

/** Screen refreshes land a little before or after the ideal moment; allow this much. */
const SLACK_MS = 1

export class FrameGovernor {
  private last = Number.NEGATIVE_INFINITY

  /** True if this screen refresh should do a real frame. */
  shouldRun(nowMs: number, tier: FpsTier): boolean {
    if (!Number.isFinite(nowMs)) return true // a broken clock must never freeze the dog
    const fps = TIER_FPS[tier]
    if (fps === Number.POSITIVE_INFINITY) {
      this.last = nowMs
      return true
    }
    const interval = 1000 / fps
    const elapsed = nowMs - this.last
    if (!(elapsed >= 0)) {
      this.last = nowMs // the clock went backwards: start over
      return true
    }
    if (elapsed < interval - SLACK_MS) return false
    // Keep to the beat (so the average is exactly the target), but after a long pause just start over
    // (one frame, not a flood to catch up).
    this.last = elapsed < interval * 2 ? this.last + interval : nowMs
    return true
  }
}
