// Pet hand motion: a cartoon hand slides down from above, strokes the dog's head back and forth three
// times (pressing a little in the middle of each stroke, lifting at the ends) and slides away. A pure
// function of time, in units of the dog's height (1 = as tall as the dog) relative to the dog's head
// (x right, y DOWN, like the screen), so it works for any dog at any size.

export const HAND = {
  /** The whole petting: as long as the dog's happy "being petted" reaction. */
  durationMs: 2400,
  enterMs: 450,
  exitMs: 450,
  /** Back-and-forth strokes while it pets. */
  strokes: 3,
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

const smooth = (u: number): number => {
  const t = u < 0 ? 0 : u > 1 ? 1 : u
  return t * t * (3 - 2 * t)
}

/** Where the hand is `tMs` milliseconds after the petting started. Outside the petting: not there. */
export function handPoseAt(tMs: number, out: HandPose): HandPose {
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
    const e = smooth(u)
    out.x = HAND.offX * (1 - e)
    out.y = HAND.offY + (HAND.hoverY - HAND.offY) * e
    out.rot = 0
    out.alpha = u
  } else if (tMs <= strokeEnd) {
    const phase = (2 * Math.PI * HAND.strokes * (tMs - HAND.enterMs)) / (strokeEnd - HAND.enterMs)
    out.x = HAND.strokeWidth * Math.sin(phase)
    out.y = HAND.hoverY - HAND.liftDepth * Math.sin(phase) * Math.sin(phase)
    out.rot = HAND.tilt * Math.sin(phase)
    out.alpha = 1
  } else {
    const u = (tMs - strokeEnd) / HAND.exitMs
    const e = smooth(u)
    out.x = HAND.offX * e
    out.y = HAND.hoverY + (HAND.offY - HAND.hoverY) * e
    out.rot = 0
    out.alpha = 1 - u
  }
  return out
}
