// §3.3 Dog asset — Daniel owns. The pipeline writes it, the renderer reads it.
// JSON Schema twin for the Python pipeline: dog-file.schema.json (keep in sync).
//
// Dog-local frame: units are pixels at scale 1; origin is the ground point between the paws;
// +x = forward (the dog faces right at rest); y DOWN like the world (so "up" is -y);
// +z toward the viewer. Bone rest transforms are relative to the parent bone.
import type { Quat, Vec3 } from './geometry'

export type ShapeKind = 'sphere' | 'capsule' | 'ellipsoid' | 'roundCone'

export interface Bone {
  name: string
  parent: string | null
  restPos: Vec3
  restRot: Quat
}

/**
 * params by kind (bone-local, pixels):
 * - sphere:    [radius]
 * - capsule:   [radius, halfLength]          — axis along local x
 * - ellipsoid: [rx, ry, rz]
 * - roundCone: [radiusA, radiusB, length]    — axis along local x, A at the origin
 */
export interface SdfShape {
  id: string
  kind: ShapeKind
  bone: string
  params: number[]
  offset: Vec3
  /** Smooth-min blend radius (k) with the rest of the body. */
  blend: number
  /** Base colour, linear RGB 0..1 (coat splats override visually). */
  color: Vec3
}

export interface CoatSplat {
  shape: string
  pos: Vec3
  scale: Vec3
  color: Vec3
  opacity: number
}

/** Bone name → local rotation. Bones not listed keep their rest rotation. */
export type Pose = Record<string, Quat>

export interface DogFile {
  version: 1
  name: string
  sourcePhoto: string
  heightPx: number
  bones: Bone[]
  shapes: SdfShape[]
  coat: CoatSplat[]
  poses: Record<string, Pose>
}

/** Structural checks that JSON Schema can't express (references between parts). */
export function validateDogFile(dog: DogFile): string[] {
  const errors: string[] = []
  const bones = new Set(dog.bones.map((b) => b.name))
  const shapes = new Set(dog.shapes.map((s) => s.id))
  if (dog.version !== 1) errors.push(`unsupported version ${dog.version}`)
  if (dog.bones.filter((b) => b.parent === null).length !== 1)
    errors.push('exactly one root bone required')
  for (const b of dog.bones) {
    if (b.parent !== null && !bones.has(b.parent))
      errors.push(`bone ${b.name}: unknown parent ${b.parent}`)
  }
  for (const s of dog.shapes) {
    if (!bones.has(s.bone)) errors.push(`shape ${s.id}: unknown bone ${s.bone}`)
  }
  for (const c of dog.coat) {
    if (!shapes.has(c.shape)) errors.push(`coat splat: unknown shape ${c.shape}`)
  }
  for (const [name, pose] of Object.entries(dog.poses)) {
    for (const bone of Object.keys(pose)) {
      if (!bones.has(bone)) errors.push(`pose ${name}: unknown bone ${bone}`)
    }
  }
  return errors
}
