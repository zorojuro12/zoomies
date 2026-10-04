// buildDog(spec) -> DogFile — the generic builder. There is NO dog-specific code here: breed,
// proportions and colours come entirely from the spec (dog-spec.ts). The template is a quadruped
// dog standing at the origin, facing +x, y DOWN, z toward the viewer (dog-file.ts frame).
//
// Skeleton (17 bones): body; neck > head > jaw, ears; a 3-part tail; and four 2-segment legs
// (leg_xx = upper, shin_xx = lower). Our own motion (dog/motion/) drives these by name. Shapes have
// no rotation field, so anything that must tilt (ears, tail) rides on a bone's rest rotation.
//
// Leg geometry: a leg bone is rotated 90° about z so its local +x axis points DOWN. T = the
// hip-to-paw-bottom distance = 2h (h = half length of the leg) + paw radius r. The leg is two equal
// bones of T/2, and the body hangs at  10*bodyDepth + T  above the ground — that is what puts the
// paws on y = 0, and the IK in dog/motion/ aims the paw bottoms at ground points.
import type { Bone, DogFile, SdfShape, ShapeKind } from '@shared/dog-file'
import type { Quat, Vec3 } from '@shared/geometry'
import { normalizeSpec, hexToLinear } from './dog-spec'
import type { ColorKey, DogSpec } from './dog-spec'

const DEG = Math.PI / 180

/** Rotation of `deg` degrees about z (the screen-plane axis). */
function qz(deg: number): Quat {
  return [0, 0, Math.sin((deg * DEG) / 2), Math.cos((deg * DEG) / 2)]
}

const WHITE: Vec3 = [1, 1, 1]
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]

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
  const legTotal = 2 * legHalf + pawR // hip to paw bottom
  const legUpper = legTotal / 2 // upper and lower bones are equal
  const tailLen = p.tailLength * (spec.tailType === 'stub' ? 0.35 : 1)
  const tailSeg = (30 * tailLen) / 3 // 3 equal segments of a 30-long tail

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
    // The jaw hinges just behind the snout; rotating it about z (positive) opens the mouth.
    { name: 'jaw', parent: 'head', restPos: [6 * hs, 8 * hs, 0], restRot: [0, 0, 0, 1] },
    { name: 'ear_l', parent: 'head', restPos: earBase, restRot: earRot },
    {
      name: 'ear_r',
      parent: 'head',
      restPos: [earBase[0], earBase[1], -earBase[2]],
      restRot: earRot
    },
    {
      name: 'tail1',
      parent: 'body',
      restPos: [-40 * p.bodyLength, -6 * p.bodyDepth, 0],
      restRot: qz(tailAngle)
    },
    { name: 'tail2', parent: 'tail1', restPos: [tailSeg, 0, 0], restRot: [0, 0, 0, 1] },
    { name: 'tail3', parent: 'tail2', restPos: [tailSeg, 0, 0], restRot: [0, 0, 0, 1] },
    ...(
      [
        ['fl', legX, legZ],
        ['fr', legX, -legZ],
        ['rl', -legX, legZ],
        ['rr', -legX, -legZ]
      ] as const
    ).flatMap(([leg, x, z]): Bone[] => [
      { name: `leg_${leg}`, parent: 'body', restPos: [x, attachY, z], restRot: qz(90) },
      {
        name: `shin_${leg}`,
        parent: `leg_${leg}`,
        restPos: [legUpper, 0, 0],
        restRot: [0, 0, 0, 1]
      }
    ])
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
    key: ColorKey,
    rgb?: Vec3 // an explicit linear colour instead of a spec colour (shine, inner ear)
  ): void => {
    shapes.push({ id, kind, bone, params, offset, blend, color: rgb ?? color(key) })
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
  // Nose: a ball at the very tip of the snout, poking ~60% of its radius past the rounded end.
  const noseR = 3.4 * hs * p.snoutWidth
  const snoutTipX = 8 * hs + snoutLen + 6 * hs * p.snoutWidth
  const noseAt: Vec3 = [snoutTipX - 0.4 * noseR, 4.2 * hs, 0]
  add('nose', 'sphere', 'head', [noseR], noseAt, 1, 'nose')
  // Wet-nose shine: a tiny white dot toward the key light (up, a little forward, toward the viewer).
  add(
    'shine',
    'sphere',
    'head',
    [0.3 * noseR],
    [noseAt[0] + 0.1 * noseR, noseAt[1] - 0.6 * noseR, noseAt[2] + 0.5 * noseR],
    0.3,
    'nose',
    WHITE
  )

  // Jaw: hidden inside the snout while the mouth is closed; when the jaw bone rotates down it
  // swings out below the snout and the mouth reads as open.
  add(
    'jaw',
    'roundCone',
    'jaw',
    [4.5 * hs * p.snoutWidth, 3 * hs * p.snoutWidth, snoutLen * 0.9],
    [2 * hs, 0, 0],
    3,
    'muzzle'
  )

  // Face detail (mirrored left/right)
  for (const [side, z] of [
    ['l', 1],
    ['r', -1]
  ] as const) {
    add(
      `eye_${side}`,
      'ellipsoid', // a ball, but an ellipsoid so its height can squash for a blink (see SdfDog)
      'head',
      [2.8 * hs, 2.8 * hs, 2.8 * hs],
      [12.1 * hs, -3.2 * hs, z * 10 * hs], // on the front of the head surface, facing forward
      0.5,
      'eyes'
    )
    // Catchlight: a small white ellipsoid on the eye, up toward the key light. It is an ellipsoid
    // so the blink can squash it with the eye (see SdfDog).
    add(
      `glint_${side}`,
      'ellipsoid',
      'head',
      [1.0 * hs, 1.0 * hs, 1.0 * hs],
      [12.1 * hs + 1.4 * hs, -3.2 * hs - 1.6 * hs, z * (10 * hs) + z * 0.7 * hs],
      0.3,
      'eyes',
      WHITE
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
  // Blaze: a thin plate on the midline of the forehead. It is a COLOUR marking, so it sits almost
  // flush with the head (centre 13 from the head centre + ~5.5 reach ≈ 18.5 vs a 17 head radius).
  add(
    'blaze',
    'ellipsoid',
    'head',
    [5 * hs, 5.5 * hs, 2.8 * hs],
    [8.3 * hs, -10 * hs, 0],
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
    // Inner ear: a smaller, warmer patch on the front face of the ear (the face you see head-on),
    // coloured halfway between the ear and cheek colours so no new spec key is needed.
    const outer = shapes[shapes.length - 1]!
    add(
      `earin_${side}`,
      'ellipsoid',
      `ear_${side}`,
      [0.55 * outer.params[0]!, 0.7 * outer.params[1]!, 0.8 * outer.params[2]!],
      [outer.offset[0] + 0.45 * outer.params[0]!, outer.offset[1], outer.offset[2]],
      1,
      'ears',
      mix3(color('ears'), color('cheeks'), 0.55)
    )
  }

  // Tail: three capsules along the chain (slightly tapering) plus a coloured tip.
  const tailR = (spec.tailType === 'fluffy' ? 11 : 8) * p.tailThickness
  for (const [i, taper] of [1, 0.95, 0.9].entries()) {
    add(
      `tail${i + 1}`,
      'capsule',
      `tail${i + 1}`,
      [tailR * taper, tailSeg / 2],
      [tailSeg / 2, 0, 0],
      4,
      'tail'
    )
  }
  add('tail_tip', 'sphere', 'tail3', [tailR * 0.88], [tailSeg, 0, 0], 3, 'tailTip')

  // Legs: an upper capsule, a slimmer shin capsule and a flattened-ball paw at the end of the shin.
  // Local +x is down; local -y is forward.
  const shinHalf = (legUpper - 0.7 * pawR) / 2
  for (const leg of ['fl', 'fr', 'rl', 'rr'] as const) {
    add(
      `leg_${leg}`,
      'capsule',
      `leg_${leg}`,
      [pawR * 1.05, legUpper / 2],
      [legUpper / 2, 0, 0],
      4,
      'legs'
    )
    add(
      `shin_${leg}`,
      'capsule',
      `shin_${leg}`,
      [pawR * 0.85, shinHalf],
      [shinHalf, 0, 0],
      4,
      'legs'
    )
    add(
      `paw_${leg}`,
      'ellipsoid',
      `shin_${leg}`,
      [0.9 * pawR, 1.4 * pawR, 1.15 * pawR],
      [legUpper - 0.9 * pawR, -0.35 * pawR, 0],
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
    poses: { stand: {} }
  }
}
