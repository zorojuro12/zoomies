// Fur splats, the build-time half. We scatter a few thousand tiny soft strands over the dog's
// SURFACE in its rest pose and glue each one to the body shape it sits on, so at runtime a splat is
// just "this shape's current matrix × a fixed local position" and it follows the bones for free.
//
// How a splat is placed:
//   1. pick a shape (weighted by its size) and a random point near it, then slide that point onto
//      the shape's own surface (follow the distance gradient);
//   2. slide it onto the BLENDED surface of the whole dog (the smooth union), because where shapes
//      overlap the visible surface is not any single shape's surface; keep it only if it lands on it;
//   3. its normal is the direction the distance grows (straight out of the skin);
//   4. glue it to the NEAREST shape, store its position/normal in that shape's local frame;
//   5. colour it exactly like the dog's surface at that spot (the shader's colour weights).
// Everything is deterministic for a seed. See fur.test.ts for the properties this guarantees.
import * as THREE from 'three'
import type { DogFile, ShapeKind } from '@shared/dog-file'
import { shapeBound } from '../sdf/bounds'
import { sdCapsule, sdEllipsoid, sdRoundCone, sdSphere, smin } from '../sdf/sdf-math'

export interface FurData {
  count: number
  /** Which shape each splat is glued to. */
  shape: Uint16Array
  /** Position in that shape's local frame (3 numbers per splat). */
  local: Float32Array
  /** Outward normal in that shape's local frame (3 per splat, unit length). */
  normal: Float32Array
  /** Linear RGB 0..1 (3 per splat). */
  color: Float32Array
  /** Size multiplier, ~0.7..1.3. */
  size: Float32Array
}

/** Shapes that must stay bare: the eyes, the nose and their white highlights. */
const BARE = /^(eye|nose|glint|shine)/

/** The world matrix of each shape in the dog's REST pose: bone chain × the shape's offset. */
export function shapeRestMatrices(dog: DogFile): THREE.Matrix4[] {
  const boneByName = new Map(dog.bones.map((b) => [b.name, b]))
  const worldOf = new Map<string, THREE.Matrix4>()
  const boneWorld = (name: string): THREE.Matrix4 => {
    const cached = worldOf.get(name)
    if (cached) return cached
    const bone = boneByName.get(name)
    if (!bone) throw new Error(`fur: no bone ${name}`)
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...bone.restPos),
      new THREE.Quaternion(...bone.restRot),
      new THREE.Vector3(1, 1, 1)
    )
    const world = bone.parent ? boneWorld(bone.parent).clone().multiply(local) : local
    worldOf.set(name, world)
    return world
  }
  return dog.shapes.map((s) =>
    boneWorld(s.bone)
      .clone()
      .multiply(new THREE.Matrix4().makeTranslation(...s.offset))
  )
}

/** Fast distance queries against a dog's shapes (plain numbers, no allocation in the loop). */
class UnionSdf {
  readonly n: number
  private readonly inv: Float64Array
  private readonly kind: ShapeKind[]
  private readonly p: number[][]
  private readonly blend: Float64Array
  private readonly color: Float64Array

  constructor(dog: DogFile, mats: THREE.Matrix4[]) {
    this.n = dog.shapes.length
    this.inv = new Float64Array(this.n * 16)
    mats.forEach((m, i) => this.inv.set(m.clone().invert().elements, i * 16))
    this.kind = dog.shapes.map((s) => s.kind)
    this.p = dog.shapes.map((s) => s.params)
    this.blend = Float64Array.from(dog.shapes.map((s) => s.blend))
    this.color = Float64Array.from(dog.shapes.flatMap((s) => s.color))
  }

  /** Distance to shape i from a point already in the shape's LOCAL frame. */
  local(i: number, x: number, y: number, z: number): number {
    const [a = 0, b = 0, c = 0] = this.p[i]!
    switch (this.kind[i]!) {
      case 'sphere':
        return sdSphere(x, y, z, a)
      case 'capsule':
        return sdCapsule(x, y, z, a, b)
      case 'ellipsoid':
        return sdEllipsoid(x, y, z, a, b, c)
      case 'roundCone':
        return sdRoundCone(x, y, z, a, b, c)
    }
  }

  /** Distance to shape i from a WORLD point. */
  shape(i: number, x: number, y: number, z: number): number {
    const e = this.inv
    const o = i * 16
    return this.local(
      i,
      e[o]! * x + e[o + 4]! * y + e[o + 8]! * z + e[o + 12]!,
      e[o + 1]! * x + e[o + 5]! * y + e[o + 9]! * z + e[o + 13]!,
      e[o + 2]! * x + e[o + 6]! * y + e[o + 10]! * z + e[o + 14]!
    )
  }

  /** The smooth union of all shapes (what the shader draws). */
  distance(x: number, y: number, z: number): number {
    let d = 0
    for (let i = 0; i < this.n; i++) {
      const di = this.shape(i, x, y, z)
      d = i === 0 ? di : smin(d, di, this.blend[i]!)
    }
    return d
  }

  /** The surface colour at a world point: shapes vote by closeness, exactly like the shader. */
  colorAt(x: number, y: number, z: number, out: Float64Array): void {
    let r = 0
    let g = 0
    let b = 0
    let w = 0
    for (let i = 0; i < this.n; i++) {
      const wi = Math.exp(-Math.max(this.shape(i, x, y, z), 0) / (0.5 + 0.2 * this.blend[i]!))
      r += this.color[i * 3]! * wi
      g += this.color[i * 3 + 1]! * wi
      b += this.color[i * 3 + 2]! * wi
      w += wi
    }
    const s = 1 / Math.max(w, 1e-4)
    out[0] = r * s
    out[1] = g * s
    out[2] = b * s
  }
}

const cache = new WeakMap<THREE.Matrix4[], UnionSdf>()
function sdfFor(dog: DogFile, mats: THREE.Matrix4[]): UnionSdf {
  let s = cache.get(mats)
  if (!s) {
    s = new UnionSdf(dog, mats)
    cache.set(mats, s)
  }
  return s
}

/** Distance from a rest-world point to the dog's blended surface (negative inside). */
export function unionDistance(dog: DogFile, mats: THREE.Matrix4[], p: THREE.Vector3): number {
  return sdfFor(dog, mats).distance(p.x, p.y, p.z)
}

/** Deterministic random numbers in [0, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Unit gradient of f at a point by the tetrahedron trick (4 evaluations). */
function gradient(
  f: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  out: number[]
): void {
  const h = 0.35
  const a = f(x + h, y - h, z - h)
  const b = f(x - h, y - h, z + h)
  const c = f(x - h, y + h, z - h)
  const d = f(x + h, y + h, z + h)
  const gx = a - b - c + d
  const gy = -a - b + c + d
  const gz = -a + b - c + d
  const len = Math.hypot(gx, gy, gz) || 1
  out[0] = gx / len
  out[1] = gy / len
  out[2] = gz / len
}

export function sampleFur(dog: DogFile, count: number, seed = 1): FurData {
  const out: FurData = {
    count: 0,
    shape: new Uint16Array(count),
    local: new Float32Array(count * 3),
    normal: new Float32Array(count * 3),
    color: new Float32Array(count * 3),
    size: new Float32Array(count)
  }
  if (count === 0) return out

  const mats = shapeRestMatrices(dog)
  const sdf = sdfFor(dog, mats)
  const rand = rng(seed)

  // Shapes that may carry fur, weighted by (bound radius)² as a stand-in for surface area.
  const candidates: number[] = []
  const weights: number[] = []
  dog.shapes.forEach((s, i) => {
    if (BARE.test(s.id)) return
    candidates.push(i)
    const r = shapeBound(s.kind, s.params).r
    weights.push(r * r)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  const pick = (): number => {
    let t = rand() * total
    for (let k = 0; k < candidates.length; k++) {
      t -= weights[k]!
      if (t <= 0) return candidates[k]!
    }
    return candidates[candidates.length - 1]!
  }

  const g: number[] = [0, 0, 0]
  const col = new Float64Array(3)
  const worldV = new THREE.Vector3()
  const dirV = new THREE.Vector3()
  const worldDist = (x: number, y: number, z: number): number => sdf.distance(x, y, z)
  let tries = 0
  while (out.count < count && tries < count * 80) {
    tries++
    const i = pick()
    const shape = dog.shapes[i]!
    const bound = shapeBound(shape.kind, shape.params)

    // 1. a random point near the shape, slid onto the shape's own surface (local frame).
    let theta = rand() * Math.PI * 2
    let phi = Math.acos(2 * rand() - 1)
    let lx = bound.cx + Math.sin(phi) * Math.cos(theta) * bound.r * (0.4 + 0.6 * rand())
    let ly = Math.sin(phi) * Math.sin(theta) * bound.r * (0.4 + 0.6 * rand())
    let lz = Math.cos(phi) * bound.r * (0.4 + 0.6 * rand())
    const own = (x: number, y: number, z: number): number => sdf.local(i, x, y, z)
    for (let it = 0; it < 6; it++) {
      const d = own(lx, ly, lz)
      gradient(own, lx, ly, lz, g)
      lx -= g[0]! * d
      ly -= g[1]! * d
      lz -= g[2]! * d
    }
    theta = phi = 0 // (unused further; keeps the linter quiet about reassigned-but-unused)

    // 2. slide it onto the blended surface of the whole dog (world frame); keep it only if it lands.
    worldV.set(lx, ly, lz).applyMatrix4(mats[i]!)
    let wx = worldV.x
    let wy = worldV.y
    let wz = worldV.z
    for (let it = 0; it < 5; it++) {
      const d = worldDist(wx, wy, wz)
      gradient(worldDist, wx, wy, wz, g)
      wx -= g[0]! * d
      wy -= g[1]! * d
      wz -= g[2]! * d
    }
    if (Math.abs(worldDist(wx, wy, wz)) > 0.3) continue

    // 3. the normal (straight out of the skin).
    gradient(worldDist, wx, wy, wz, g)

    // Self-check: stepping 2 px along the normal must really lead away from the dog. In the tight
    // creases where a leg meets the body the blended surface is so curved that "straight out" is
    // ambiguous; such splats are skipped rather than left pointing sideways.
    if (worldDist(wx + g[0]! * 2, wy + g[1]! * 2, wz + g[2]! * 2) < worldDist(wx, wy, wz) + 0.6)
      continue

    // 4. glue it to the nearest shape; bare shapes (eyes, nose) get no fur.
    let nearest = 0
    let best = Infinity
    for (let s = 0; s < sdf.n; s++) {
      const d = sdf.shape(s, wx, wy, wz)
      if (d < best) {
        best = d
        nearest = s
      }
    }
    if (BARE.test(dog.shapes[nearest]!.id)) continue

    const k = out.count
    const inv = new THREE.Matrix4().copy(mats[nearest]!).invert()
    worldV.set(wx, wy, wz).applyMatrix4(inv)
    dirV.set(g[0]!, g[1]!, g[2]!).transformDirection(inv)
    out.shape[k] = nearest
    out.local.set([worldV.x, worldV.y, worldV.z], k * 3)
    out.normal.set([dirV.x, dirV.y, dirV.z], k * 3)

    // 5. the surface colour here, with a little brightness variation so the coat is not flat.
    sdf.colorAt(wx, wy, wz, col)
    // Each strand is a little lighter or darker AND a little warmer or cooler than its neighbours
    // (up to 6%), so the coat reads as many hairs instead of one flat colour.
    const tint = 0.9 + 0.2 * rand()
    const warm = (rand() - 0.5) * 0.12
    out.color[k * 3] = Math.min(1, col[0]! * tint * (1 + warm))
    out.color[k * 3 + 1] = Math.min(1, col[1]! * tint * (1 + warm * 0.25))
    out.color[k * 3 + 2] = Math.min(1, col[2]! * tint * (1 - warm))
    out.size[k] = 0.7 + 0.6 * rand()
    out.count++
  }
  return out
}
