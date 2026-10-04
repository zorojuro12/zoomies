// Every dog spec checked into assets/dog/ must build a valid dog. This is the safety net for
// hand-edited specs now and for Gemini-generated specs later: a bad file fails here, not on stage.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateDogFile } from '@shared/dog-file'
import { buildDog } from './build-dog'
import { normalizeSpec, PROPORTION_KEYS, RANGES } from './dog-spec'

const here = dirname(fileURLToPath(import.meta.url))
const dogDir = join(here, '../../../../../assets/dog') // app/src/renderer/dog/spec -> repo root
const files = readdirSync(dogDir).filter((f) => f.endsWith('.spec.json'))

describe('spec files in assets/dog', () => {
  it('include the demo dog and a few very different ones', () => {
    for (const name of ['aussie', 'default', 'golden', 'greyhound']) {
      expect(files).toContain(`${name}.spec.json`)
    }
  })

  for (const file of files) {
    describe(file, () => {
      const raw = JSON.parse(readFileSync(join(dogDir, file), 'utf8')) as Record<string, unknown>

      it('builds a valid dog file with the paws on the ground', () => {
        const dog = buildDog(raw)
        expect(validateDogFile(dog)).toEqual([])
        const body = dog.bones.find((b) => b.name === 'body')!
        const leg = dog.bones.find((b) => b.name === 'leg_fl')!
        const shin = dog.bones.find((b) => b.name === 'shin_fl')!
        const paw = dog.shapes.find((s) => s.id === 'paw_fl')!
        const bottom =
          body.restPos[1] + leg.restPos[1] + shin.restPos[0] + paw.offset[0] + paw.params[0]!
        expect(bottom).toBeCloseTo(0, 5)
      })

      it('has no number that had to be clamped (it was written inside the allowed ranges)', () => {
        const spec = normalizeSpec(raw)
        const props = (raw.proportions ?? {}) as Record<string, number>
        for (const key of PROPORTION_KEYS) {
          if (props[key] !== undefined) expect(spec.proportions[key], key).toBe(props[key])
        }
        if (raw.size !== undefined) expect(spec.size).toBe(raw.size)
        expect(RANGES.size[0]).toBeLessThanOrEqual(spec.size)
      })

      it('has no colour that was replaced by a default (every written colour is valid hex)', () => {
        const spec = normalizeSpec(raw)
        const colors = (raw.colors ?? {}) as Record<string, string>
        for (const [key, value] of Object.entries(colors)) {
          expect(spec.colors[key as keyof typeof spec.colors], key).toBe(value)
        }
      })
    })
  }
})
