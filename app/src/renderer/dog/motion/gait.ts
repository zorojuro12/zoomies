// Gait: where each foot should be at each moment of a stride.
// A stride has phase 0..1. The first `duty` of it is STANCE: the foot is on the ground and moves
// backward relative to the body at exactly the body's speed, so in the world it stays put (no
// foot sliding). The rest is SWING: the foot lifts, moves forward, and plants again.
// Pure number functions — no allocation, used every frame.

export type LegId = 'fl' | 'fr' | 'rl' | 'rr'

export interface GaitDef {
  /** Fraction of the stride a foot spends on the ground. Lower = more airborne = faster gait. */
  duty: number
  /** Where in the stride each leg starts (0..1). */
  offsets: Record<LegId, number>
  /** Distance the body travels per stride, in px for a standard-size dog. */
  strideLength: number
  /** How high the foot lifts, as a fraction of the leg's reach. */
  lift: number
}

export const GAITS = {
  // Walk: lateral sequence, one foot lands every quarter stride.
  walk: {
    duty: 0.65,
    offsets: { fl: 0, rr: 0.25, fr: 0.5, rl: 0.75 },
    strideLength: 56,
    lift: 0.16
  },
  // Trot: diagonal pairs move together.
  trot: {
    duty: 0.5,
    offsets: { fl: 0, rr: 0, fr: 0.5, rl: 0.5 },
    strideLength: 84,
    lift: 0.2
  },
  // Run: a bounding gallop — fronts nearly together, rears nearly together, long airborne phase.
  run: {
    duty: 0.35,
    offsets: { fl: 0, fr: 0.08, rr: 0.5, rl: 0.58 },
    strideLength: 130,
    lift: 0.3
  }
} satisfies Record<string, GaitDef>

/** Strides per second for a given body speed. */
export function strideHz(speed: number, strideLength: number): number {
  return strideLength > 0 ? speed / strideLength : 0
}

/** How far the body travels while one foot is planted: the foot's stance excursion. */
export function stanceLength(speed: number, duty: number, hz: number): number {
  return hz > 0 ? (speed * duty) / hz : 0
}

function wrap01(p: number): number {
  const w = p % 1
  return w < 0 ? w + 1 : w
}

/** A leg's own phase: the shared stride phase plus its offset, wrapped into 0..1. */
export function legPhase(phase: number, offset: number): number {
  return wrap01(phase + offset)
}

/**
 * Horizontal foot position relative to its neutral spot (+ = forward).
 * Stance: moves linearly from +S/2 to -S/2. Swing: eases back from -S/2 to +S/2.
 */
export function footOffsetX(phase: number, duty: number, stance: number): number {
  const p = wrap01(phase)
  if (p < duty) return stance * (0.5 - p / duty)
  const u = (p - duty) / (1 - duty)
  const eased = u * u * (3 - 2 * u) // smoothstep: gentle lift-off and landing
  return stance * (-0.5 + eased)
}

/** Height of the foot above the ground: 0 for the whole stance, a smooth arc during swing. */
export function footLift(phase: number, duty: number, height: number): number {
  const p = wrap01(phase)
  if (p < duty) return 0
  const u = (p - duty) / (1 - duty)
  return height * Math.sin(Math.PI * u)
}
