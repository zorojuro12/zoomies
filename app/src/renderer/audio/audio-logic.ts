// Pure helpers for the audio module — no Web Audio here, so they are unit-tested in Node.
import type { SoundName } from '@shared/audio'

/** Sounds that loop by default (contract §3.8). Everything else plays once. */
export const LOOPING_SOUNDS: ReadonlySet<SoundName> = new Set<SoundName>(['pant', 'snore'])

/** Variants are numbered 1..MAX_VARIANTS: assets/sounds/<name>_<n>.mp3. Missing ones are skipped. */
export const MAX_VARIANTS = 3

/** Asset paths (for assetUrl) of every possible variant of a sound. */
export function variantPaths(name: SoundName): string[] {
  const paths: string[] = []
  for (let n = 1; n <= MAX_VARIANTS; n++) paths.push(`sounds/${name}_${n}.mp3`)
  return paths
}

/** Stereo pan, -1 (left) .. 1 (right). Missing or NaN → centre. */
export function clampPan(pan: number | undefined): number {
  if (pan === undefined || Number.isNaN(pan)) return 0
  return Math.min(1, Math.max(-1, pan))
}

/** Volume, 0..1. Missing or NaN → full volume. */
export function clampGain(gain: number | undefined): number {
  if (gain === undefined || Number.isNaN(gain)) return 1
  return Math.min(1, Math.max(0, gain))
}

/**
 * Random variant index in [0, count) that differs from `last` whenever there is a choice,
 * so the dog never barks the exact same bark twice in a row. `last` = -1 means "none yet".
 */
export function pickVariant(count: number, last: number, rng: () => number = Math.random): number {
  if (count <= 1) return 0
  const hasLast = last >= 0 && last < count
  const pool = hasLast ? count - 1 : count
  let i = Math.min(pool - 1, Math.floor(rng() * pool))
  if (hasLast && i >= last) i++
  return i
}
