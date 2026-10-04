// Blinking: every few seconds the eyes close for a fraction of a second.
// amount 0 = open, 1 = fully closed; the closure follows sin(pi * u) over BLINK_SECONDS, so it eases
// shut and open (no sudden jump). The schedule is deterministic for a seed: the first blink is at a
// fixed time and later gaps are pseudo-random between 2.2 and 5.2 s, like a real animal's.
// Plain numbers in a small state object that is updated in place (no allocation per frame).

export const BLINK_SECONDS = 0.16
export const FIRST_BLINK_AT = 1.0
const MIN_GAP = 2.2
const MAX_GAP = 5.2

export interface BlinkState {
  /** Seconds since the start. */
  time: number
  /** When the current/next blink starts. */
  start: number
  seed: number
}

export function createBlink(seed = 1): BlinkState {
  return { time: 0, start: FIRST_BLINK_AT, seed: seed >>> 0 || 1 }
}

function random01(s: BlinkState): number {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
  return s.seed / 4294967296
}

/** Advance by dt seconds; returns how closed the eyes are (0..1). */
export function stepBlink(s: BlinkState, dtSec: number): number {
  s.time += Math.max(0, dtSec)
  // A long pause (a dropped frame) may skip whole blinks: move on to the next one still ahead.
  while (s.time >= s.start + BLINK_SECONDS) {
    s.start += BLINK_SECONDS + MIN_GAP + (MAX_GAP - MIN_GAP) * random01(s)
  }
  const u = (s.time - s.start) / BLINK_SECONDS
  return u >= 0 && u <= 1 ? Math.sin(Math.PI * u) : 0
}
