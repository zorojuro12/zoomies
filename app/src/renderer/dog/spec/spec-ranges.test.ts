// pipeline/spec-ranges.json is the Python pipeline's copy of the spec's safe ranges, key lists and
// defaults. TypeScript (dog-spec.ts) is the source of truth, so this test fails the moment the two
// disagree — a Gemini-generated spec is clamped by the Python copy and must also pass here.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  COLOR_KEYS,
  DEFAULT_SPEC,
  EAR_TYPES,
  PROPORTION_KEYS,
  RANGES,
  TAIL_TYPES
} from './dog-spec'

const here = dirname(fileURLToPath(import.meta.url))
const shared = JSON.parse(
  readFileSync(join(here, '../../../../../pipeline/spec-ranges.json'), 'utf8')
) as {
  ranges: Record<string, [number, number]>
  proportionKeys: string[]
  earTypes: string[]
  tailTypes: string[]
  colorKeys: string[]
  default: unknown
}

describe('pipeline/spec-ranges.json matches dog-spec.ts', () => {
  it('has exactly the same ranges', () => {
    expect(shared.ranges).toEqual(
      Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, [...v]]))
    )
  })
  it('has the same proportion keys, colour keys, ear types and tail types', () => {
    expect(shared.proportionKeys).toEqual([...PROPORTION_KEYS])
    expect(shared.colorKeys).toEqual([...COLOR_KEYS])
    expect(shared.earTypes).toEqual([...EAR_TYPES])
    expect(shared.tailTypes).toEqual([...TAIL_TYPES])
  })
  it('has the same default spec', () => {
    expect(shared.default).toEqual(DEFAULT_SPEC)
  })
})
