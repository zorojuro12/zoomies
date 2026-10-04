// Pet hand motion: a cartoon hand slides down from above, strokes the dog's head back and forth three
// times (pressing a little in the middle of each stroke, lifting at the ends) and slides away. A pure
// function of time, in units of the dog's height (1 = as tall as the dog) relative to the dog's head
// (x right, y DOWN, like the screen), so it works for any dog at any size.

export const HAND = {
  /** The whole petting (the dog stays happy for about this long). */
  durationMs: 2600,
  enterMs: 500,
  exitMs: 500,
  /** Slow, calm back-and-forth strokes while it pets. */
  strokes: 2,
  /** The strokes start and end gently: this much of the stroke time is spent easing in / out. */
  strokeEase: 0.18,
  /** How far each stroke sweeps to either side of the head's middle. */
  strokeWidth: 0.1,
  /** Where the hand's centre rests above the head's middle (negative = above), when pressing. */
  hoverY: -0.34,
  /** It lifts this much at the ends of each stroke. */
  liftDepth: 0.04,
  /** Tilt with the stroke, in radians (about 7 degrees). */
  tilt: 0.12,
  /** Where it comes from and goes back to: up and to the right. */
  offX: 0.55,
  offY: -0.95
}

export type HandSpot = 'head' | 'body'

/** Where on the dog it pets: how high above that spot the hand rests, and how far each stroke sweeps. */
export const HAND_SPOTS: Record<HandSpot, { hoverY: number; strokeWidth: number }> = {
  head: { hoverY: HAND.hoverY, strokeWidth: HAND.strokeWidth },
  // stroking the torso of a dog lying down: a little lower and a lot longer strokes along the body
  body: { hoverY: -0.2, strokeWidth: 0.16 }
}

export interface HandPose {
  x: number
  y: number
  /** Radians. */
  rot: number
  /** 0..1 */
  alpha: number
  visible: boolean
}

export function createHandPose(): HandPose {
  return { x: 0, y: 0, rot: 0, alpha: 0, visible: false }
}

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u)
/** Slow-fast-slow, 0 -> 1. */
const smooth = (u: number): number => {
  const t = clamp01(u)
  return t * t * (3 - 2 * t)
}
/** Arrives with a tiny overshoot and settles (a soft landing), 0 -> 1. */
const landing = (u: number): number => {
  const t = clamp01(u) - 1
  const c = 1.1
  return 1 + (c + 1) * t * t * t + c * t * t
}

/** Where the hand is `tMs` milliseconds after the petting started. Outside the petting: not there. */
export function handPoseAt(tMs: number, out: HandPose, spot: HandSpot = 'head'): HandPose {
  const { hoverY, strokeWidth } = HAND_SPOTS[spot] ?? HAND_SPOTS.head
  if (!Number.isFinite(tMs) || tMs <= 0 || tMs >= HAND.durationMs) {
    out.x = HAND.offX
    out.y = HAND.offY
    out.rot = 0
    out.alpha = 0
    out.visible = false
    return out
  }
  out.visible = true
  const strokeEnd = HAND.durationMs - HAND.exitMs
  if (tMs < HAND.enterMs) {
    const u = tMs / HAND.enterMs
    out.x = HAND.offX * (1 - smooth(u))
    out.y = HAND.offY + (hoverY - HAND.offY) * landing(u)
    out.rot = 0
    out.alpha = smooth(u * 1.6)
  } else if (tMs <= strokeEnd) {
    const span = strokeEnd - HAND.enterMs
    const w = (tMs - HAND.enterMs) / span
    const phase = 2 * Math.PI * HAND.strokes * w
    // the sweep eases in at the start and out at the end, so the strokes never begin or stop abruptly
    const env = smooth(w / HAND.strokeEase) * smooth((1 - w) / HAND.strokeEase)
    out.x = strokeWidth * env * Math.sin(phase)
    out.y = hoverY - HAND.liftDepth * env * Math.sin(phase) * Math.sin(phase)
    out.rot = HAND.tilt * env * Math.sin(phase)
    out.alpha = 1
  } else {
    const u = (tMs - strokeEnd) / HAND.exitMs
    const e = smooth(u)
    out.x = HAND.offX * e
    out.y = hoverY + (HAND.offY - hoverY) * e
    out.rot = 0
    out.alpha = 1 - smooth(u * 1.4 - 0.4)
  }
  return out
}
