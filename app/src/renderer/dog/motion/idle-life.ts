// Standing life: what a dog does when nothing is happening. It shifts its weight side to side,
// now and then flicks an ear, and its head slowly droops the longer it has had nothing to do.
// Pure numbers, no allocation per step; the ear-flick schedule is deterministic for a seed.

/** Biggest body roll of the weight shift, in radians (about 2 degrees). */
export const SWAY_MAX = (2 * Math.PI) / 180
/** Seconds of standing with nothing to do until the head has fully drooped. */
export const DROOP_AFTER = 25
const SWAY_PERIOD = 6.5 // seconds for one full side to side

export interface IdleLife {
  /** Body roll in radians (positive leans one way, negative the other). */
  sway: number
  /** 1 on the single step when an ear flick fires, else 0. */
  earKick: number
  /** 0..1: how far the head has drooped from boredom. */
  droop: number
  /** 0..1: how much of the standing life is blended in (eases in and out). */
  weight: number
  phase: number
  sinceActive: number
  nextKick: number
  /** Seconds of standing until the next idle trick is asked for. */
  nextTrick: number
  /** Which trick (0 yawn, 1 sniff, 2 shake) the dog should do, or -1; the dog sets it back to -1 when it takes it. */
  trickReq: number
  seed: number
}

function nextRand(s: IdleLife): number {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
  return s.seed / 4294967296
}

export function createIdleLife(seed = 1): IdleLife {
  const s: IdleLife = {
    sway: 0,
    earKick: 0,
    droop: 0,
    weight: 0,
    phase: 0,
    sinceActive: 0,
    nextKick: 0,
    nextTrick: 0,
    trickReq: -1,
    seed: seed >>> 0 || 1
  }
  s.nextKick = 3 + 5 * nextRand(s)
  s.nextTrick = 10 + 10 * nextRand(s)
  return s
}

/** The dog was given something to do (a command or a mood): the boredom timer starts over. */
export function noteActivity(s: IdleLife): void {
  s.sinceActive = 0
}

/**
 * Advance by dt seconds. `standing` = nothing going on (no move, jump or pose change). `quiet` =
 * an idle trick is playing: the weight shift steps aside, but the dog is still bored (the boredom
 * timer and the trick schedule keep running).
 */
export function stepIdleLife(s: IdleLife, dt: number, standing: boolean, quiet = false): void {
  s.earKick = 0
  s.weight += ((standing && !quiet ? 1 : 0) - s.weight) * (1 - Math.exp(-dt * 3))
  if (!standing) {
    s.sinceActive = 0
    s.nextKick = Math.max(s.nextKick, 3)
  } else {
    s.phase += dt / SWAY_PERIOD
    s.sinceActive += dt
    s.nextKick -= dt
    s.nextTrick -= dt
    if (s.nextTrick <= 0 && s.trickReq < 0) {
      s.trickReq = Math.min(2, Math.floor(nextRand(s) * 3))
      s.nextTrick = 10 + 10 * nextRand(s)
    } else if (s.nextTrick <= 0) {
      s.nextTrick = 0 // still waiting for the last request to be taken
    }
    if (s.nextKick <= 0) {
      s.earKick = 1
      s.nextKick = 3 + 5 * nextRand(s)
    }
  }
  s.sway = Math.sin(s.phase * Math.PI * 2) * SWAY_MAX * s.weight
  // droop eases toward its goal (0 until it has been idle a while, then up to 1 by DROOP_AFTER)
  const goal = standing ? Math.min(1, s.sinceActive / DROOP_AFTER) : 0
  s.droop += (goal - s.droop) * (1 - Math.exp(-dt * (goal > s.droop ? 1 : 3)))
}
