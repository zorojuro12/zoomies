// Fur splat sampling (build-time, in the dog's REST pose). Thousands of tiny soft strands are
// scattered over the dog's surface, each glued to the body shape it sits on so it moves with the
// bones. These tests check the properties that make the fur look right: the splats lie ON the
// blended surface, point OUT of it, carry the colour of their region (white chest, black body) and
// are spread over the whole dog — for every demo dog, and deterministically.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DogFile } from '@shared/dog-file'
import { buildDog } from '../spec/build-dog'
import { sampleFur, shapeRestMatrices, unionDistance } from './fur'
import type { FurData } from './fur'

const here = dirname(fileURLToPath(import.meta.url))
const spec = (n: string): unknown =>
  JSON.parse(readFileSync(join(here, `../../../../../assets/dog/${n}.spec.json`), 'utf8'))

const COUNT = 1500
const dogs: [string, DogFile][] = [
  ['default', buildDog({})],
  ['aussie', buildDog(spec('aussie'))],
  ['golden', buildDog(spec('golden'))],
  ['greyhound', buildDog(spec('greyhound'))]
]

const lum = (c: ArrayLike<number>, i: number): number =>
  0.2126 * c[i * 3]! + 0.7152 * c[i * 3 + 1]! + 0.0722 * c[i * 3 + 2]!

/** Rest-world position of splat i. */
function worldPos(fur: FurData, mats: THREE.Matrix4[], i: number): THREE.Vector3 {
  return new THREE.Vector3(
    fur.local[i * 3]!,
    fur.local[i * 3 + 1]!,
    fur.local[i * 3 + 2]!
  ).applyMatrix4(mats[fur.shape[i]!]!)
}

describe('sampleFur', () => {
  for (const [name, dog] of dogs) {
    describe(name, () => {
      const mats = shapeRestMatrices(dog)
      const fur = sampleFur(dog, COUNT, 1)

      it('returns the number of splats asked for', () => {
        expect(fur.count).toBe(COUNT)
        expect(fur.shape).toHaveLength(COUNT)
        expect(fur.local).toHaveLength(COUNT * 3)
        expect(fur.normal).toHaveLength(COUNT * 3)
        expect(fur.color).toHaveLength(COUNT * 3)
        expect(fur.size).toHaveLength(COUNT)
      })

      it('lies ON the blended surface (every splat within 0.6 px of it)', () => {
        for (let i = 0; i < COUNT; i++) {
          expect(Math.abs(unionDistance(dog, mats, worldPos(fur, mats, i)))).toBeLessThan(0.6)
        }
      })

      it('points OUT of the surface (moving along the normal gets farther from the dog)', () => {
        for (let i = 0; i < COUNT; i++) {
          const p = worldPos(fur, mats, i)
          const n = new THREE.Vector3(
            fur.normal[i * 3]!,
            fur.normal[i * 3 + 1]!,
            fur.normal[i * 3 + 2]!
          )
          expect(n.length()).toBeCloseTo(1, 4)
          n.transformDirection(mats[fur.shape[i]!]!) // the local normal, rotated into the rest world frame
          const out = p.clone().addScaledVector(n, 2)
          expect(unionDistance(dog, mats, out)).toBeGreaterThan(unionDistance(dog, mats, p) + 0.5)
        }
      })

      it('is glued to a valid shape', () => {
        for (let i = 0; i < COUNT; i++) {
          expect(fur.shape[i]!).toBeGreaterThanOrEqual(0)
          expect(fur.shape[i]!).toBeLessThan(dog.shapes.length)
        }
      })

      it('has colours in 0..1 and sizes in a sane range with variation', () => {
        for (let i = 0; i < COUNT * 3; i++) {
          expect(fur.color[i]!).toBeGreaterThanOrEqual(0)
          expect(fur.color[i]!).toBeLessThanOrEqual(1)
        }
        for (let i = 0; i < COUNT; i++) {
          expect(fur.size[i]!).toBeGreaterThan(0.5)
          expect(fur.size[i]!).toBeLessThan(1.6)
        }
        expect(new Set(Array.from(fur.size.slice(0, 200))).size).toBeGreaterThan(50)
      })

      it('covers the whole dog: the big parts each get a fair share', () => {
        const share = (id: string): number => {
          const k = dog.shapes.findIndex((s) => s.id === id)
          let n = 0
          for (let i = 0; i < COUNT; i++) if (fur.shape[i] === k) n++
          return n / COUNT
        }
        expect(share('body')).toBeGreaterThan(0.06)
        expect(share('head')).toBeGreaterThan(0.015)
        expect(share('tail1') + share('tail2') + share('tail3')).toBeGreaterThan(0.01)
        const legs = ['fl', 'fr', 'rl', 'rr'].reduce(
          (a, l) => a + share(`leg_${l}`) + share(`shin_${l}`),
          0
        )
        expect(legs).toBeGreaterThan(0.05)
      })

      it('never puts fur on the eyes, the nose or their highlights', () => {
        const skip = new Set(
          dog.shapes
            .map((s, i) => (/^(eye|nose|glint|shine)/.test(s.id) ? i : -1))
            .filter((i) => i >= 0)
        )
        for (let i = 0; i < COUNT; i++) expect(skip.has(fur.shape[i]!)).toBe(false)
      })
    })
  }

  it('is deterministic for a seed, and different seeds scatter differently', () => {
    const dog = dogs[1]![1]
    const a = sampleFur(dog, 400, 5)
    const b = sampleFur(dog, 400, 5)
    const c = sampleFur(dog, 400, 6)
    expect(Array.from(a.local)).toEqual(Array.from(b.local))
    expect(Array.from(a.local)).not.toEqual(Array.from(c.local))
  })

  it('carries each region colour: bright fur on the white chest, dark fur on the black body (Aussie)', () => {
    const dog = dogs[1]![1]
    const fur = sampleFur(dog, 3000, 2)
    const meanLum = (shapeId: string): number => {
      const k = dog.shapes.findIndex((s) => s.id === shapeId)
      let sum = 0
      let n = 0
      for (let i = 0; i < fur.count; i++) {
        if (fur.shape[i] === k) {
          sum += lum(fur.color, i)
          n++
        }
      }
      return n ? sum / n : NaN
    }
    expect(meanLum('chest')).toBeGreaterThan(0.45) // white chest
    expect(meanLum('body')).toBeLessThan(0.3) // black coat
    expect(meanLum('chest')).toBeGreaterThan(meanLum('body') + 0.25)
  })

  it('handles asking for zero splats', () => {
    expect(sampleFur(dogs[0]![1], 0, 1).count).toBe(0)
  })
})
