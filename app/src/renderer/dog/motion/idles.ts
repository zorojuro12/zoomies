// Idle tricks: short bits of dog business (a yawn, a sniff, a shake-off). Each one is a function of
// time that writes small OFFSETS to the pose, so it works for any dog (offsets are in degrees and
// small fractions, never absolute bone angles). Every trick eases in from zero and out to zero, so
// it can never leave the dog stuck in a pose. Pure numbers, no allocation per sample.

export type IdleName = 'yawn' | 'sniff' | 'shake'
export const IDLE_NAMES: readonly IdleName[] = ['yawn', 'sniff', 'shake']

export interface IdleOffsets {
  /** Body lowered, in leg lengths (like PoseParams.drop). */
  drop: number
  /** Body pitch in degrees, positive = nose up. */
  pitch: number
  /** Degrees added to the neck / head angle (positive = down). */
  neck: number
  head: number
  /** Head tilt in degrees. */
  roll: number
  /** Jaw opening in degrees. */
  jaw: number
  /** How far the eyelids are shut (0..1). */
  lid: number
  /** Tail base angle in degrees. */
  tail: number
  /** Body roll in radians (a side-to-side rattle). */
  bodyRoll: number
  /** Ear sweep in radians. */
  ear: number
}

export function createOffsets(): IdleOffsets {
  return {
    drop: 0,
    pitch: 0,
    neck: 0,
    head: 0,
    roll: 0,
    jaw: 0,
    lid: 0,
    tail: 0,
    bodyRoll: 0,
    ear: 0
  }
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number): number => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
/** 0 at both ends, rising over `rise` seconds and falling over `fall` seconds, 1 in between. */
const env = (t: number, dur: number, rise: number, fall: number): number =>
  smooth(t / rise) * smooth((dur - t) / fall)

export interface IdleDef {
  /** Seconds. */
  duration: number
  sample: (t: number, out: IdleOffsets) => void
}

export const IDLES: Record<IdleName, IdleDef> = {
  // Head back, jaw wide, eyes squeezed shut.
  yawn: {
    duration: 2.6,
    sample(t, o) {
      const e = env(t, 2.6, 0.9, 0.8)
      o.jaw = 38 * e
      o.head = -12 * e
      o.neck = -6 * e
      o.pitch = 3 * e
      o.lid = 0.85 * env(t, 2.6, 0.6, 0.7)
    }
  },
  // Nose to the ground, bobbing quickly.
  sniff: {
    duration: 2.8,
    sample(t, o) {
      const e = env(t, 2.8, 0.5, 0.5)
      o.neck = 14 * e
      o.head = (8 + 3 * Math.sin(t * 20)) * e
      o.pitch = -3 * e
      o.tail = 6 * e
    }
  },
  // Shake off like a wet dog: the whole body and head rattle, the ears flap.
  shake: {
    duration: 1.5,
    sample(t, o) {
      const e = env(t, 1.5, 0.15, 0.35)
      const f = t * 34
      o.bodyRoll = 0.05 * Math.sin(f) * e
      o.roll = 16 * Math.sin(f + 0.8) * e
      o.head = 3 * Math.sin(f * 0.5) * e
      o.ear = 0.5 * Math.sin(f * 1.1) * e
    }
  }
}

/** Write the offsets of trick `name` at time `t` seconds into `out` (all zero outside the trick). */
export function sampleIdle(name: IdleName, t: number, out: IdleOffsets): void {
  out.drop = out.pitch = out.neck = out.head = out.roll = out.jaw = 0
  out.lid = out.tail = out.bodyRoll = out.ear = 0
  const def = IDLES[name]
  if (t <= 0 || t >= def.duration) return
  def.sample(t, out)
}

/** Multiply every offset by w (to fade a trick in or out) without allocating. */
export function scaleOffsets(o: IdleOffsets, w: number): void {
  o.drop *= w
  o.pitch *= w
  o.neck *= w
  o.head *= w
  o.roll *= w
  o.jaw *= w
  o.lid *= w
  o.tail *= w
  o.bodyRoll *= w
  o.ear *= w
}
