// Mood: a named feeling that nudges the dog's tail, ears, head and eyelids on top of whatever it
// is doing (a happy dog wags more, a sleepy one droops). It is a set of small numbers per mood
// plus a smoother that eases toward the chosen mood, so a change of feeling never pops. Pure
// numbers, no allocation per step.

export type MoodName = 'neutral' | 'happy' | 'curious' | 'sleepy' | 'alert'

export interface MoodValues {
  /** Added to the tail wag amount (-1..1). */
  tail: number
  /** Added to the ear perk amount (-1 droopy .. 1 pricked). */
  ears: number
  /** Degrees added to the neck and head angle (positive = down, negative = up). */
  neck: number
  head: number
  /** Head tilt in degrees. */
  roll: number
  /** How far the eyelids are held shut (0 open .. 0.6 heavy-lidded). */
  lid: number
  /** Breathing depth multiplier (1 = normal). */
  breath: number
}

export const MOODS: Record<MoodName, MoodValues> = {
  neutral: { tail: 0, ears: 0, neck: 0, head: 0, roll: 0, lid: 0, breath: 1 },
  happy: { tail: 0.55, ears: 0.35, neck: -3, head: -3, roll: 0, lid: 0, breath: 1.3 },
  curious: { tail: 0.1, ears: 0.6, neck: -2, head: 2, roll: 14, lid: 0, breath: 1 },
  sleepy: { tail: -0.4, ears: -0.55, neck: 12, head: 10, roll: 0, lid: 0.45, breath: 1.8 },
  alert: { tail: -0.2, ears: 0.9, neck: -7, head: -4, roll: 0, lid: 0, breath: 0.8 }
}

export function moodValues(v: MoodValues): MoodValues {
  return { ...v }
}

export interface MoodState {
  /** The current, smoothed values (the same object forever, mutated in place). */
  readonly values: MoodValues
  /** Where it is heading. */
  readonly target: MoodValues
}

export function createMood(): MoodState {
  return { values: moodValues(MOODS.neutral), target: moodValues(MOODS.neutral) }
}

const KEYS = ['tail', 'ears', 'neck', 'head', 'roll', 'lid', 'breath'] as const

/** Aim at `name` at `intensity` (0 = neutral .. 1 = full). Unknown names mean neutral. */
export function setMoodTarget(m: MoodState, name: MoodName, intensity: number): void {
  const mood = MOODS[name] ?? MOODS.neutral
  const k = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0
  for (const key of KEYS) {
    m.target[key] = MOODS.neutral[key] + (mood[key] - MOODS.neutral[key]) * k
  }
}

/** Ease the current values toward the target (time constant about a quarter of a second). */
export function stepMood(m: MoodState, dt: number): void {
  const k = 1 - Math.exp(-dt * 4)
  for (const key of KEYS) m.values[key] += (m.target[key] - m.values[key]) * k
}
