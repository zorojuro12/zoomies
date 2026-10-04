// §3.1 Coordinates — decided once, used everywhere.
// World units are desktop pixels (DIP), origin at the top-left of the primary display,
// x right, y DOWN (same space as window rects and the cursor). z points toward the viewer
// and is used only for depth inside the dog and for ordering.

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** -1 = facing left, 1 = facing right. */
export type Facing = -1 | 1

export type Vec3 = [number, number, number]
/** Quaternion [x, y, z, w]. */
export type Quat = [number, number, number, number]
