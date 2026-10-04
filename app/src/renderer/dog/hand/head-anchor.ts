// Where to put the pet hand: on the dog's head. Our SDF dog knows exactly where its head bone is
// (`headPosition`) and how tall it is (`dogHeightPx`); any other dog (the placeholder) gets an
// estimate from its screen box. Writes into `out` (no allocation) and returns the dog's height in px.
import type { Rect } from '@shared/geometry'

export interface HeadAnchorDog {
  headPosition?: (out: { x: number; y: number }) => void
  bodyPosition?: (out: { x: number; y: number }) => void
  dogHeightPx?: () => number
  getBounds: () => Rect
  getState: () => { x: number; y: number; facing: 1 | -1 }
}

export function headAnchor(dog: HeadAnchorDog, out: { x: number; y: number }): number {
  const bounds = dog.getBounds()
  const s = dog.getState()
  // getBounds is heightPx * 1.25 tall (see DogMotion.getBounds)
  const estimate = bounds.h / 1.25
  const height = dog.dogHeightPx ? dog.dogHeightPx() : estimate
  const h = Number.isFinite(height) && height > 0 ? height : estimate > 0 ? estimate : 100
  if (dog.headPosition) {
    dog.headPosition(out)
    if (Number.isFinite(out.x) && Number.isFinite(out.y)) return h
  }
  out.x = s.x + s.facing * 0.3 * h
  out.y = s.y - 0.9 * h
  return h
}

/** The middle of the dog's body (its stomach and back, where a dog lying down is petted). Returns the dog's height in px. */
/** The hand rests this far (in dog heights) toward the dog's back end: seen from the front, the body's middle is right behind the face. */
const BODY_BACK = 0.2

export function bodyAnchor(dog: HeadAnchorDog, out: { x: number; y: number }): number {
  const bounds = dog.getBounds()
  const s = dog.getState()
  const estimate = bounds.h / 1.25
  const height = dog.dogHeightPx ? dog.dogHeightPx() : estimate
  const h = Number.isFinite(height) && height > 0 ? height : estimate > 0 ? estimate : 100
  if (dog.bodyPosition) {
    dog.bodyPosition(out)
    if (Number.isFinite(out.x) && Number.isFinite(out.y)) {
      out.x -= s.facing * BODY_BACK * h // toward the back end, clear of the face
      return h
    }
  }
  out.x = s.x - s.facing * BODY_BACK * h
  out.y = s.y - 0.35 * h
  return h
}

/** Where to put the hand for a petting on the head or the body. */
export function handAnchor(
  dog: HeadAnchorDog,
  spot: 'head' | 'body',
  out: { x: number; y: number }
): number {
  return spot === 'body' ? bodyAnchor(dog, out) : headAnchor(dog, out)
}
