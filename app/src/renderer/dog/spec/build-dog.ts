// buildDog(spec) -> DogFile — the generic builder. There is NO dog-specific code here: breed,
// proportions and colours come entirely from the spec (dog-spec.ts). The template is a quadruped
// dog standing at the origin, facing +x, y DOWN, z toward the viewer (dog-file.ts frame).
//
// Constraint (until we write our own motion): SdfDog still borrows the placeholder's motion, which
// drives these 10 bones and 6 poses by name — so the skeleton and poses below match the
// placeholder's. Extra detail (eyes, nose, brows, cheeks, paws...) is added as extra SHAPES on
// those bones. Shapes have no rotation field, so anything that must tilt (ears, tail) rides on a
// bone's rest rotation.
//
// Leg geometry: a leg bone is rotated 90° about z so its local +x axis points DOWN. The leg is a
// capsule from the bone origin down 2h (h = half length), plus the paw radius r at the end, so the
// body must hang at  10*bodyDepth + 2h + r  above the ground — that is what puts the paws on y = 0.
import type { Bone, DogFile, Pose, SdfShape, ShapeKind } from '@shared/dog-file'
import type { Quat, Vec3 } from '@shared/geometry'
import { normalizeSpec, hexToLinear } from './dog-spec'
import type { ColorKey, DogSpec } from './dog-spec'

const DEG = Math.PI / 180

/** Rotation of `deg` degrees about z (the screen-plane axis). */
function qz(deg: number): Quat {
  return [0, 0, Math.sin((deg * DEG) / 2), Math.cos((deg * DEG) / 2)]
}

/** The 6 poses the motion bridge understands, as bone rotations (z-rotations in degrees). */
function buildPoses(): Record<string, Pose> {
  return {
    stand: {},
    sit: {
      body: qz(-28),
      leg_fl: qz(118),
      leg_fr: qz(118),
      leg_rl: qz(10),
      leg_rr: qz(10),
      neck: qz(-40)
    },
    lie: {
      leg_fl: qz(5),
      leg_fr: qz(5),
      leg_rl: qz(175),
      leg_rr: qz(175),
      neck: qz(-25)
    },
    sleep: {
      leg_fl: qz(5),
      leg_fr: qz(5),
      leg_rl: qz(175),
      leg_rr: qz(175),
      neck: qz(15),
      head: qz(10),
      tail: qz(185)
    },
    playBow: {
      body: qz(20),
      leg_fl: qz(60),
      leg_fr: qz(60),
      neck: qz(-20),
      tail: qz(135)
    },
    // Head tilted: 60° about an axis between z and x.
    headTilt: { head: [0.2588, 0, 0.4226, 0.8682] }
  }
}

export function buildDog(input: unknown): DogFile {
  const spec: DogSpec = normalizeSpec(input)
  const p = spec.proportions
  const size = spec.size
  const color = (key: ColorKey): Vec3 => hexToLinear(spec.colors[key]) ?? [0.5, 0.5, 0.5]

  // Template numbers (see the table in the plan): everything below is in template units, then
  // scaled by `size` at the end.
  const legHalf = 22 * p.legLength // half length of a leg capsule
  const pawR = 6 * p.legThickness // leg / paw radius
  const attachY = 10 * p.bodyDepth // leg attach point below the body centre
  const bodyY = -(attachY + 2 * legHalf + pawR) // body hangs this far above the ground
  const hs = p.headSize

  // ---- bones -----------------------------------------------------------------------------
  const earBase: Vec3 =
    spec.earType === 'floppy' ? [-2 * hs, -9 * hs, 12 * hs] : [-3 * hs, -14 * hs, 7 * hs]
  const earRot: Quat = spec.earType === 'semi' ? qz(25) : [0, 0, 0, 1]
  const tailAngle = spec.tailType === 'curled' ? 235 : 160
  const legX = 28 * p.bodyLength
  const legZ = 9 * p.bodyWidth

  const bones: Bone[] = [
    { name: 'body', parent: null, restPos: [0, bodyY, 0], restRot: [0, 0, 0, 1] },
    {
      name: 'neck',
      parent: 'body',
      restPos: [34 * p.bodyLength, -10 * p.bodyDepth, 0],
      restRot: qz(-60)
    },
    { name: 'head', parent: 'neck', restPos: [24 * p.neckLength, 0, 0], restRot: qz(60) },
    { name: 'ear_l', parent: 'head', restPos: earBase, restRot: earRot },
    {
      name: 'ear_r',
      parent: 'head',
      restPos: [earBase[0], earBase[1], -earBase[2]],
      restRot: earRot
    },
    {
      name: 'tail',
      parent: 'body',
      restPos: [-40 * p.bodyLength, -6 * p.bodyDepth, 0],
      restRot: qz(tailAngle)
    },
    { name: 'leg_fl', parent: 'body', restPos: [legX, attachY, legZ], restRot: qz(90) },
    { name: 'leg_fr', parent: 'body', restPos: [legX, attachY, -legZ], restRot: qz(90) },
    { name: 'leg_rl', parent: 'body', restPos: [-legX, attachY, legZ], restRot: qz(90) },
    { name: 'leg_rr', parent: 'body', restPos: [-legX, attachY, -legZ], restRot: qz(90) }
  ]

  // ---- shapes ----------------------------------------------------------------------------
  const shapes: SdfShape[] = []
  const add = (
    id: string,
    kind: ShapeKind,
    bone: string,
    params: number[],
    offset: Vec3,
    blend: number,
    key: ColorKey
  ): void => {
    shapes.push({ id, kind, bone, params, offset, blend, color: color(key) })
  }

  // Body, chest, neck, head, snout
  add(
    'body',
    'ellipsoid',
    'body',
    [46 * p.bodyLength, 22 * p.bodyDepth, 20 * p.bodyWidth],
    [0, 0, 0],
    6,
    'coat'
  )
  add(
    'chest',
    'sphere',
    'body',
    [19 * Math.min(p.bodyDepth, p.bodyWidth)],
    [26 * p.bodyLength, 6 * p.bodyDepth, 0],
    6,
    'chest'
  )
  add(
    'neck',
    'capsule',
    'neck',
    [11 * p.bodyWidth, 10 * p.neckLength],
    [10 * p.neckLength, 0, 0],
    6,
    'coat'
  )
  add('head', 'sphere', 'head', [17 * hs], [0, 0, 0], 6, 'coat')
  const snoutLen = 17 * hs * p.snoutLength
  add(
    'snout',
    'roundCone',
    'head',
    [10 * hs * p.snoutWidth, 6 * hs * p.snoutWidth, snoutLen],
    [8 * hs, 5 * hs, 0],
    6,
    'muzzle'
  )
  add(
    'nose',
    'sphere',
    'head',
    [3.4 * hs * p.snoutWidth],
    [8 * hs + snoutLen - 1.5 * hs, 4.2 * hs, 0],
    1,
    'nose'
  )

  // Face detail (mirrored left/right)
  for (const [side, z] of [
    ['l', 1],
    ['r', -1]
  ] as const) {
    add(
      `eye_${side}`,
      'sphere',
      'head',
      [2.8 * hs],
      [8.8 * hs, -4 * hs, z * 12.8 * hs],
      0.5,
      'eyes'
    )
    add(
      `cheek_${side}`,
      'ellipsoid',
      'head',
      [7 * hs, 5 * hs, 5 * hs],
      [6 * hs, 3 * hs, z * 13.5 * hs],
      3,
      'cheeks'
    )
    add(
      `brow_${side}`,
      'ellipsoid',
      'head',
      [3.2 * hs, 2.2 * hs, 2.6 * hs],
      [9 * hs, -9 * hs, z * 11.4 * hs],
      2,
      'brows'
    )
  }
  add(
    'blaze',
    'ellipsoid',
    'head',
    [10 * hs, 3 * hs, 3.2 * hs],
    [6 * hs, -15.8 * hs, 0],
    3,
    'blaze'
  )

  // Ears: pointy and semi stand up (semi's bone leans forward); floppy ones hang down.
  const e = p.earSize * hs
  for (const side of ['l', 'r'] as const) {
    if (spec.earType === 'floppy') {
      add(
        `ear_${side}`,
        'ellipsoid',
        `ear_${side}`,
        [4.5 * e, 10 * e, 2.4 * e],
        [0, 7 * e, 0],
        3,
        'ears'
      )
    } else if (spec.earType === 'semi') {
      add(
        `ear_${side}`,
        'ellipsoid',
        `ear_${side}`,
        [5 * e, 8.5 * e, 2.6 * e],
        [0, -4.5 * e, 0],
        3,
        'ears'
      )
    } else {
      add(
        `ear_${side}`,
        'ellipsoid',
        `ear_${side}`,
        [4.5 * e, 9 * e, 2.6 * e],
        [0, -4 * e, 0],
        3,
        'ears'
      )
    }
  }

  // Tail: a capsule along the bone's x axis plus a coloured tip.
  const tailLen = p.tailLength * (spec.tailType === 'stub' ? 0.35 : 1)
  const tailHalf = 15 * tailLen
  const tailR = (spec.tailType === 'fluffy' ? 11 : 8) * p.tailThickness
  add('tail', 'capsule', 'tail', [tailR, tailHalf], [tailHalf, 0, 0], 4, 'tail')
  add('tail_tip', 'sphere', 'tail', [tailR * 0.95], [2 * tailHalf, 0, 0], 3, 'tailTip')

  // Legs and paws. A paw is a flattened ball at the leg's end; local +x is down, local -y is forward.
  for (const leg of ['fl', 'fr', 'rl', 'rr'] as const) {
    add(`leg_${leg}`, 'capsule', `leg_${leg}`, [pawR, legHalf], [legHalf, 0, 0], 4, 'legs')
    add(
      `paw_${leg}`,
      'ellipsoid',
      `leg_${leg}`,
      [0.9 * pawR, 1.4 * pawR, 1.15 * pawR],
      [2 * legHalf + 0.1 * pawR, -0.35 * pawR, 0],
      3,
      'paws'
    )
  }

  // ---- overall size ----------------------------------------------------------------------
  const scaledBones = bones.map((b) => ({
    ...b,
    restPos: b.restPos.map((v) => v * size) as Vec3
  }))
  const scaledShapes = shapes.map((s) => ({
    ...s,
    params: s.params.map((v) => v * size),
    offset: s.offset.map((v) => v * size) as Vec3,
    blend: s.blend * size
  }))

  const standingHeight = -bodyY + attachY + 24 * p.neckLength * Math.sin(60 * DEG) + 17 * hs
  return {
    version: 1,
    name: spec.name,
    sourcePhoto: spec.sourcePhoto,
    heightPx: Math.round(standingHeight * size),
    bones: scaledBones,
    shapes: scaledShapes,
    coat: [],
    poses: buildPoses()
  }
}
