// buildDog(spec) -> DogFile: the generic builder. No dog-specific code lives here; any spec works.
// Expected numbers are hand-worked from the template (see build-dog.ts) or are properties that
// must hold for EVERY spec (feet on the ground, valid file, no broken geometry).
import { describe, expect, it } from 'vitest'
import { validateDogFile } from '@shared/dog-file'
import type { DogFile, SdfShape } from '@shared/dog-file'
import { buildDog } from './build-dog'
import { PROPORTION_KEYS, RANGES } from './dog-spec'

const bone = (d: DogFile, name: string): DogFile['bones'][number] => {
  const b = d.bones.find((x) => x.name === name)
  if (!b) throw new Error(`no bone ${name}`)
  return b
}
const shape = (d: DogFile, id: string): SdfShape => {
  const s = d.shapes.find((x) => x.id === id)
  if (!s) throw new Error(`no shape ${id}`)
  return s
}

/** Specs at the corners of every range: the nastiest dogs the builder must still handle. */
function cornerSpecs(): object[] {
  const lo = { size: RANGES.size[0], proportions: {} as Record<string, number> }
  const hi = { size: RANGES.size[1], proportions: {} as Record<string, number> }
  for (const k of PROPORTION_KEYS) {
    lo.proportions[k] = RANGES[k][0]
    hi.proportions[k] = RANGES[k][1]
  }
  return [lo, hi]
}

describe('buildDog: structure', () => {
  const dog = buildDog({})
  it('produces a valid dog file', () => {
    expect(validateDogFile(dog)).toEqual([])
    expect(dog.version).toBe(1)
  })
  it('has the 10-bone skeleton and 6 poses the motion bridge expects', () => {
    expect(dog.bones.map((b) => b.name).sort()).toEqual(
      [
        'body',
        'ear_l',
        'ear_r',
        'head',
        'leg_fl',
        'leg_fr',
        'leg_rl',
        'leg_rr',
        'neck',
        'tail'
      ].sort()
    )
    expect(Object.keys(dog.poses).sort()).toEqual(
      ['headTilt', 'lie', 'playBow', 'sit', 'sleep', 'stand'].sort()
    )
  })
  it('has unique shape ids and fits the shader limit of 32', () => {
    const ids = dog.shapes.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(dog.shapes.length).toBeLessThanOrEqual(32)
  })
  it('is deterministic', () => {
    expect(buildDog({ earType: 'floppy', size: 1.2 })).toEqual(
      buildDog({ earType: 'floppy', size: 1.2 })
    )
  })
  it('carries the spec name and source photo through', () => {
    const d = buildDog({ name: 'Rex', sourcePhoto: 'photo/rex.jpg' })
    expect(d.name).toBe('Rex')
    expect(d.sourcePhoto).toBe('photo/rex.jpg')
  })
})

describe('buildDog: the default dog matches the template, hand-worked', () => {
  const dog = buildDog({})
  it('body hangs 60 above the ground: 10 (leg attach) + 44 (leg) + 6 (paw radius)', () => {
    expect(bone(dog, 'body').restPos[1]).toBeCloseTo(-60)
  })
  it('standing height is about 108: 60 + 10 + 24*sin(60°) + 17', () => {
    expect(dog.heightPx).toBe(108)
  })
  it('tail points back and slightly down: 160° about z (placeholder literal)', () => {
    const q = bone(dog, 'tail').restRot
    expect(q[2]).toBeCloseTo(0.9848, 3)
    expect(q[3]).toBeCloseTo(0.1736, 3)
  })
})

describe('buildDog: proportions move the dog the right way', () => {
  it('longer legs lift the body: legLength 1.5 -> 10 + 66 + 6 = 82', () => {
    expect(bone(buildDog({ proportions: { legLength: 1.5 } }), 'body').restPos[1]).toBeCloseTo(-82)
  })
  it('thicker legs lift the body: legThickness 1.5 -> paw radius 9 -> 10 + 44 + 9 = 63', () => {
    const d = buildDog({ proportions: { legThickness: 1.5 } })
    expect(bone(d, 'body').restPos[1]).toBeCloseTo(-63)
  })
  it('a deeper chest drops the leg attach point: bodyDepth 1.2 -> 12 + 44 + 6 = 62', () => {
    expect(bone(buildDog({ proportions: { bodyDepth: 1.2 } }), 'body').restPos[1]).toBeCloseTo(-62)
  })
  it('size scales the whole dog: size 1.5 -> body at -90 (1.5 * -60) and 1.5x as tall', () => {
    const big = buildDog({ size: 1.5 })
    expect(bone(big, 'body').restPos[1]).toBeCloseTo(-90)
    expect(big.heightPx).toBe(162) // round(1.5 * 107.78)
  })
  it('a size above the allowed maximum is clamped, never trusted', () => {
    expect(bone(buildDog({ size: 2 }), 'body').restPos[1]).toBeCloseTo(-96) // clamped to 1.6
  })
  it('a longer snout makes a longer snout shape', () => {
    const short = shape(buildDog({ proportions: { snoutLength: 0.6 } }), 'snout').params[2]!
    const long = shape(buildDog({ proportions: { snoutLength: 1.5 } }), 'snout').params[2]!
    expect(long).toBeGreaterThan(short)
  })
})

describe('buildDog: ear and tail types', () => {
  it('pointy ears rise above the attach point, floppy ears hang below it', () => {
    const pointy = shape(buildDog({ earType: 'pointy' }), 'ear_l')
    const floppy = shape(buildDog({ earType: 'floppy' }), 'ear_l')
    expect(pointy.offset[1]).toBeLessThan(0) // y is down, so negative = up
    expect(floppy.offset[1]).toBeGreaterThan(0)
  })
  it('semi-pricked ears lean forward (bone rotated about z); pointy ears do not', () => {
    expect(bone(buildDog({ earType: 'semi' }), 'ear_l').restRot[2]).toBeGreaterThan(0.1)
    expect(bone(buildDog({ earType: 'pointy' }), 'ear_l').restRot[2]).toBeCloseTo(0)
  })
  it('the two ears mirror each other across the body', () => {
    const d = buildDog({ earType: 'floppy' })
    expect(bone(d, 'ear_l').restPos[2]).toBeCloseTo(-bone(d, 'ear_r').restPos[2])
  })
  it('a stub tail is 35% as long as a long one (15 * 0.35 = 5.25 half length)', () => {
    expect(shape(buildDog({ tailType: 'stub' }), 'tail').params[1]).toBeCloseTo(5.25)
    expect(shape(buildDog({ tailType: 'long' }), 'tail').params[1]).toBeCloseTo(15)
  })
  it('a fluffy tail is thicker than a long one', () => {
    const fluffy = shape(buildDog({ tailType: 'fluffy' }), 'tail').params[0]!
    const long = shape(buildDog({ tailType: 'long' }), 'tail').params[0]!
    expect(fluffy).toBeGreaterThan(long)
  })
  it('a curled tail is held higher than a long one', () => {
    // rotation about z by angle a points the tail along (cos a, sin a); y is down, so
    // a smaller sin(a) (more negative) means higher.
    const angle = (q: number[]): number => 2 * Math.atan2(q[2]!, q[3]!)
    const curled = angle(bone(buildDog({ tailType: 'curled' }), 'tail').restRot)
    const long = angle(bone(buildDog({ tailType: 'long' }), 'tail').restRot)
    expect(Math.sin(curled)).toBeLessThan(Math.sin(long))
  })
})

describe('buildDog: face and colours', () => {
  const dog = buildDog({ colors: { coat: '#ffffff', paws: '#ff0000', eyes: '#00ff00' } })
  it('has two eyes, one on each side, at the same height and distance forward', () => {
    const l = shape(dog, 'eye_l')
    const r = shape(dog, 'eye_r')
    expect(l.offset[0]).toBeCloseTo(r.offset[0])
    expect(l.offset[1]).toBeCloseTo(r.offset[1])
    expect(l.offset[2]).toBeCloseTo(-r.offset[2])
  })
  it('has a nose, brows, cheeks and a blaze', () => {
    for (const id of ['nose', 'brow_l', 'brow_r', 'cheek_l', 'cheek_r', 'blaze']) {
      expect(dog.shapes.some((s) => s.id === id)).toBe(true)
    }
  })
  it('converts spec colours to linear RGB on the right shapes', () => {
    const body = shape(dog, 'body').color
    expect(body[0]).toBeCloseTo(1)
    expect(body[2]).toBeCloseTo(1)
    expect(shape(dog, 'paw_fl').color).toEqual([1, 0, 0])
    expect(shape(dog, 'eye_l').color).toEqual([0, 1, 0])
  })
})

describe('buildDog: nose and eyes are actually visible on the face', () => {
  const specs = [{}, { proportions: { headSize: 1.25, snoutLength: 0.9, snoutWidth: 1.2 } }]
  for (const [i, spec] of specs.entries()) {
    describe(`face #${i}`, () => {
      const d = buildDog(spec)
      const head = shape(d, 'head').params[0]!
      it('the nose sticks out past the tip of the snout', () => {
        const snout = shape(d, 'snout')
        const [, rB, length] = snout.params
        const snoutTip = snout.offset[0] + length! + rB! // far end of the snout's rounded tip
        const nose = shape(d, 'nose')
        expect(nose.offset[0] + nose.params[0]!).toBeGreaterThan(snoutTip)
      })
      it('the eyes poke out of the head surface (not buried, not floating)', () => {
        const eye = shape(d, 'eye_l')
        const centre = Math.hypot(...eye.offset)
        const outerEdge = centre + eye.params[0]!
        expect(outerEdge).toBeGreaterThan(head) // visible
        expect(outerEdge).toBeLessThan(head + 0.2 * head) // still attached
      })
      it('the eyes face forward, not out to the extreme sides', () => {
        const eye = shape(d, 'eye_l')
        expect(Math.abs(eye.offset[2])).toBeLessThanOrEqual(0.62 * head) // z within ~62% of the head radius
        expect(eye.offset[0]).toBeGreaterThan(0.6 * head) // well forward of the head centre
      })
    })
  }
})

describe('buildDog: the blaze is a flat marking, not a bump', () => {
  for (const headSize of [1, 1.3]) {
    it(`stays within 2px of the head surface (headSize ${headSize})`, () => {
      const d = buildDog({ proportions: { headSize } })
      const head = shape(d, 'head').params[0]! // head sphere radius
      const blaze = shape(d, 'blaze')
      const centre = Math.hypot(...blaze.offset)
      const reach = centre + Math.max(...blaze.params) // furthest the blaze can stick out
      expect(reach).toBeLessThanOrEqual(head + 2 * headSize)
    })
  }
})

describe('buildDog: properties that must hold for EVERY spec', () => {
  const specs: object[] = [
    {},
    { proportions: { legLength: 1.6, legThickness: 1.4 } },
    { size: 1.4, proportions: { bodyDepth: 1.3 } },
    { earType: 'floppy', tailType: 'curled' },
    ...cornerSpecs()
  ]
  for (const [i, spec] of specs.entries()) {
    describe(`spec #${i}`, () => {
      const dog = buildDog(spec)
      it('is a valid dog file', () => {
        expect(validateDogFile(dog)).toEqual([])
      })
      it('keeps the paws on the ground (y = 0)', () => {
        // leg bones point their local x axis straight down, so going down = adding to y.
        const leg = bone(dog, 'leg_fl')
        const paw = shape(dog, 'paw_fl')
        const bottom =
          bone(dog, 'body').restPos[1] + leg.restPos[1] + paw.offset[0] + paw.params[0]!
        expect(bottom).toBeCloseTo(0, 5)
      })
      it('has only finite numbers and positive sizes', () => {
        for (const s of dog.shapes) {
          expect(s.params.every((p) => Number.isFinite(p) && p > 0)).toBe(true)
          expect(s.offset.every(Number.isFinite)).toBe(true)
          expect(s.blend).toBeGreaterThanOrEqual(0)
          expect(s.color.every((c) => c >= 0 && c <= 1)).toBe(true)
        }
        for (const b of dog.bones) expect(b.restPos.every(Number.isFinite)).toBe(true)
      })
      it('keeps every round cone valid (the radii differ by less than its length)', () => {
        for (const s of dog.shapes.filter((x) => x.kind === 'roundCone')) {
          const [rA, rB, len] = s.params
          expect(Math.abs(rA! - rB!)).toBeLessThan(len!)
        }
      })
      it('has unit-length bone rotations', () => {
        for (const b of dog.bones) {
          expect(Math.hypot(...b.restRot)).toBeCloseTo(1, 5)
        }
      })
    })
  }
})
