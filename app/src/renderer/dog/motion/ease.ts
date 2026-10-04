// Small easing / interpolation helpers for pose changes. Pure numbers, no allocation.

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

const OVERSHOOT = 1.4

/**
 * Cartoon timing: 0 -> 0 and 1 -> 1, but it overshoots by ~7% (peak 1.0706 at t = 0.611) and
 * settles back, instead of sliding in at constant speed.
 */
export function cartoonEase(t: number): number {
  const u = clamp01(t) - 1
  return 1 + (OVERSHOOT + 1) * u * u * u + OVERSHOOT * u * u
}
