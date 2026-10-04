// Damped spring: makes floppy parts (ears, tail) lag behind and overshoot as if they had weight.
// x chases `target`; stiffness pulls it there, damping resists velocity. Critical damping is
// 2*sqrt(stiffness): the fastest approach with no overshoot; less than that bounces.
// Mutates the state in place (no allocation) and substeps so a dropped frame cannot explode it.

export interface SpringState {
  x: number
  v: number
}

const MAX_SUBSTEP = 1 / 120
const MAX_SUBSTEPS = 60

export function stepSpring(
  s: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  dt: number
): void {
  const n = Math.min(Math.max(Math.ceil(dt / MAX_SUBSTEP), 1), MAX_SUBSTEPS)
  const h = dt / n
  for (let i = 0; i < n; i++) {
    const accel = stiffness * (target - s.x) - damping * s.v
    s.v += accel * h // semi-implicit Euler: update velocity first, then position
    s.x += s.v * h
  }
}
