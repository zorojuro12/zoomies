// Pose library. A pose is a handful of numbers, NOT bone rotations, so it adapts to any dog:
//  - lengths are in units of T (the dog's hip-to-paw-bottom leg length), angles in degrees;
//  - the legs are solved with IK from where the PAWS should be, so every dog's paws land on the
//    ground whatever its leg length (see leg-solve.ts).
// Dog frame: x forward, y DOWN, so "nose up" is a negative rotation about z (we store pitch as
// nose-UP degrees) and bigger neck/head/jaw/tail degrees swing them DOWN.

export interface PoseParams {
  /** Body lowered below standing height, in units of T. */
  drop: number
  /** Body pitch in degrees, positive = nose up. */
  pitch: number
  /** Front paws: x offset from under the hip (T), and height above the ground (T). */
  ffx: number
  ffl: number
  /** Rear paws: same. */
  rfx: number
  rfl: number
  /** Degrees added to the neck / head rest angles (positive = down). */
  neck: number
  head: number
  /** Head roll in degrees (a head tilt). */
  headRoll: number
  /** Jaw opening in degrees. */
  jaw: number
  /** Tail base angle added (degrees, positive = down) and curl added per segment. */
  tailBase: number
  tailCurl: number
}

export const POSE_KEYS: readonly (keyof PoseParams)[] = [
  'drop',
  'pitch',
  'ffx',
  'ffl',
  'rfx',
  'rfl',
  'neck',
  'head',
  'headRoll',
  'jaw',
  'tailBase',
  'tailCurl'
]

const stand: PoseParams = {
  drop: 0.06,
  pitch: 0,
  ffx: 0,
  ffl: 0,
  rfx: 0,
  rfl: 0,
  neck: 0,
  head: 0,
  headRoll: 0,
  jaw: 0,
  tailBase: 0,
  tailCurl: 0
}

const pose = (over: Partial<PoseParams>): PoseParams => ({ ...stand, ...over })

/** Poses by name. Includes the contract's PoseName poses we implement plus internal jump poses. */
export const POSES: Record<string, PoseParams> = {
  stand,
  // Sit: rear down, torso pitched up, front legs straight, rear paws tucked forward of the haunches.
  sit: pose({ drop: 0.4, pitch: 35, rfx: 0.3, neck: 20, head: 15 }),
  // Lie: belly on the ground, front paws stretched forward, rear legs folded.
  lie: pose({ drop: 0.72, pitch: 0, ffx: 0.9, rfx: 0.1, neck: 30, head: 18, tailBase: 10 }),
  sleep: pose({ drop: 0.74, pitch: 0, ffx: 0.8, rfx: 0.1, neck: 52, head: 24, tailBase: 12 }),
  // Play bow: front down, rear up, tail high.
  playBow: pose({ drop: 0.05, pitch: -28, ffx: 0.45, neck: -6, head: -10, tailBase: -50 }),
  headTilt: pose({ neck: 4, head: 4, headRoll: 22 }),
  pant: pose({ drop: 0.08, jaw: 28, neck: -4 }),
  stretch: pose({ drop: 0.0, pitch: -38, ffx: 0.7, neck: -8, head: -14, tailBase: -60 }),
  // Internal jump poses (not part of the PoseName contract).
  jumpUp: pose({
    drop: -0.1,
    pitch: 25,
    ffx: 0.45,
    ffl: 0.5,
    rfx: -0.45,
    rfl: 0.35,
    neck: -6,
    tailBase: 20
  }),
  jumpDown: pose({ drop: -0.04, pitch: -8, ffx: 0.3, ffl: 0.35, rfx: -0.2, rfl: 0.25, neck: 6 }),
  land: pose({ drop: 0.24, pitch: 4, ffx: 0.08, rfx: -0.05, neck: 8 })
}

/** Copy `src` into `dst` without allocating. */
export function copyPose(dst: PoseParams, src: PoseParams): void {
  for (const k of POSE_KEYS) dst[k] = src[k]
}

/** dst = a + (b - a) * t, field by field, without allocating. t may exceed 1 (overshoot). */
export function blendPose(dst: PoseParams, a: PoseParams, b: PoseParams, t: number): void {
  for (const k of POSE_KEYS) dst[k] = a[k] + (b[k] - a[k]) * t
}
