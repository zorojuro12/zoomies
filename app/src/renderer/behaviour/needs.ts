// Needs model (P2 Task 1 of docs/plans/a-p2-mvp-behaviour.md): energy / boredom / attention, three
// numbers in 0..1 that rise and fall so the dog's behaviour is chosen from them instead of from a
// fixed loop (PRD §4.5). Pure numbers, mutated in place, no clock of its own (time comes in as dt).

export interface Needs {
  energy: number
  boredom: number
  attention: number
}

/** What the dog is doing right now (the needs change differently for each). */
export type Doing = 'fetching' | 'active' | 'resting' | 'sleeping'

export type NeedsEvent = 'pet' | 'launch' | 'fetchDone' | 'ballBrought'

/** Rates are per second. */
export const NEEDS = {
  energy: { fetching: -0.01, active: 0.002, resting: 0.01, sleeping: 0.03 },
  boredomUserIdle: 0.002,
  boredomUserActive: 0.0006,
  boredomFetching: -0.02,
  boredomSleeping: -0.01,
  /** Seconds for attention to close 63% of the gap to its target. */
  attentionTimeConstant: 20,
  /** A single step counts as at most this long (a laptop wake must not drain the dog in one go). */
  maxStepMs: 5000,
  playBoredom: 0.6,
  playEnergy: 0.4,
  restEnergy: 0.25
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export function createNeeds(): Needs {
  return { energy: 1, boredom: 0, attention: 0.5 }
}

/** Advance the needs by `dtMs` while the dog is `doing` something and the user is (in)active. */
export function stepNeeds(n: Needs, dtMs: number, doing: Doing, userActive: boolean): void {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return
  const dt = Math.min(dtMs, NEEDS.maxStepMs) / 1000

  n.energy = clamp01(n.energy + NEEDS.energy[doing] * dt)

  let boredom: number
  if (doing === 'fetching') boredom = NEEDS.boredomFetching
  else if (doing === 'sleeping') boredom = NEEDS.boredomSleeping
  else boredom = userActive ? NEEDS.boredomUserActive : NEEDS.boredomUserIdle
  n.boredom = clamp01(n.boredom + boredom * dt)

  const target = userActive ? 1 : 0
  n.attention = clamp01(
    n.attention + (target - n.attention) * (1 - Math.exp(-dt / NEEDS.attentionTimeConstant))
  )
}

/** One-off effects of things that happen to the dog. */
export function applyNeedsEvent(n: Needs, e: NeedsEvent): void {
  switch (e) {
    case 'pet':
      n.boredom = clamp01(n.boredom - 0.3)
      n.attention = clamp01(n.attention + 0.3)
      break
    case 'launch':
      n.boredom = clamp01(n.boredom - 0.4)
      n.attention = 1
      break
    case 'fetchDone':
      n.energy = clamp01(n.energy - 0.05)
      n.boredom = clamp01(n.boredom - 0.2)
      break
    case 'ballBrought':
      n.boredom = clamp01(n.boredom - 0.3)
      break
  }
}

/** What the dog feels like doing. A tired dog rests even when it is bored. */
export function wants(n: Needs): { play: boolean; rest: boolean } {
  return {
    play: n.boredom > NEEDS.playBoredom && n.energy > NEEDS.playEnergy,
    rest: n.energy < NEEDS.restEnergy
  }
}
