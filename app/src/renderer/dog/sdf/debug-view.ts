// X-ray debug views (DogView.setDebugView), the pure parts. See debug-view.test.ts.
//   'shapes'    every SDF primitive drawn in its OWN flat colour, un-blended (the "clay balls" the
//               dog is made of);
//   'landmarks' the contract's slot for the fitted structure: here, the skeleton over the dog;
//   'coat'      no splat coat yet, so it shows the normal dog.
import type { DogDebugView } from '@shared/dog-view'

export interface DebugFlags {
  /** Draw each primitive in its own colour with a hard union instead of the smooth blend. */
  hardShapes: boolean
  /** Draw the skeleton (bones and joints) over the dog. */
  skeleton: boolean
}

export function debugFlags(mode: DogDebugView): DebugFlags {
  switch (mode) {
    case 'shapes':
      return { hardShapes: true, skeleton: false }
    case 'landmarks':
      return { hardShapes: false, skeleton: true }
    case 'normal':
    case 'coat':
      return { hardShapes: false, skeleton: false }
  }
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0:
      return [v, t, p]
    case 1:
      return [q, v, p]
    case 2:
      return [p, v, t]
    case 3:
      return [p, q, v]
    case 4:
      return [t, p, v]
    default:
      return [v, p, q]
  }
}

const GOLDEN_RATIO_CONJUGATE = 0.618033988749895
// Brightness cycles with period 3 and saturation with period 2, so neighbours on the hue wheel
// that land close together still differ in brightness or saturation.
const LIGHTNESS = [1.0, 0.68, 0.84]
const SATURATION = [0.85, 0.5]

/**
 * A flat colour for shape number `i`. The hue steps by the golden ratio so neighbours in the list
 * land far apart on the colour wheel (adjacent body parts never look alike), and the brightness
 * cycles so even a long list stays distinct. Never near-black or near-white.
 */
export function debugColor(i: number): [number, number, number] {
  const hue = (i * GOLDEN_RATIO_CONJUGATE) % 1
  return hsvToRgb(hue, SATURATION[i % SATURATION.length]!, LIGHTNESS[i % LIGHTNESS.length]!)
}
