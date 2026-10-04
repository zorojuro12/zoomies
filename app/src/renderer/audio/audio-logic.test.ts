import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SOUND_NAMES } from '@shared/audio'
import {
  LOOPING_SOUNDS,
  MAX_VARIANTS,
  clampGain,
  clampPan,
  pickVariant,
  variantPaths
} from './audio-logic'

describe('variantPaths', () => {
  it('lists every possible variant under sounds/', () => {
    expect(variantPaths('bark_happy')).toEqual([
      'sounds/bark_happy_1.mp3',
      'sounds/bark_happy_2.mp3',
      'sounds/bark_happy_3.mp3'
    ])
  })
})

describe('LOOPING_SOUNDS', () => {
  it('loops exactly pant and snore', () => {
    expect([...LOOPING_SOUNDS].sort()).toEqual(['pant', 'snore'])
  })
})

describe('clampPan', () => {
  it('keeps values in -1..1', () => {
    expect(clampPan(2)).toBe(1)
    expect(clampPan(-2)).toBe(-1)
    expect(clampPan(0.3)).toBe(0.3)
  })
  it('defaults to centre for missing or NaN', () => {
    expect(clampPan(undefined)).toBe(0)
    expect(clampPan(NaN)).toBe(0)
  })
})

describe('clampGain', () => {
  it('keeps values in 0..1', () => {
    expect(clampGain(2)).toBe(1)
    expect(clampGain(-1)).toBe(0)
    expect(clampGain(0.5)).toBe(0.5)
  })
  it('defaults to full volume for missing or NaN', () => {
    expect(clampGain(undefined)).toBe(1)
    expect(clampGain(NaN)).toBe(1)
  })
})

describe('pickVariant', () => {
  const sweep = (count: number, last: number): number[] => {
    const out: number[] = []
    for (let r = 0; r < 1; r += 0.01) out.push(pickVariant(count, last, () => r))
    return out
  }

  it('returns 0 when there is only one variant', () => {
    expect(pickVariant(1, 0)).toBe(0)
    expect(pickVariant(0, -1)).toBe(0)
  })

  it('never repeats the last variant when there is a choice', () => {
    for (const count of [2, 3]) {
      for (let last = 0; last < count; last++) {
        expect(sweep(count, last)).not.toContain(last)
      }
    }
  })

  it('stays in range, including when rng returns exactly 1', () => {
    expect(pickVariant(3, -1, () => 1)).toBe(2)
    for (const i of sweep(3, -1)) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(3)
    }
  })

  it('can reach every variant when there is no previous one', () => {
    expect(new Set(sweep(3, -1))).toEqual(new Set([0, 1, 2]))
  })
})

describe('assets/sounds', () => {
  const dir = resolve(__dirname, '../../../../assets/sounds')
  const files = readdirSync(dir).filter((f) => f.endsWith('.mp3'))

  it('only contains files the player can load (<SoundName>_<1..MAX>.mp3)', () => {
    const valid = new Set(
      SOUND_NAMES.flatMap((n) => variantPaths(n).map((p) => p.replace('sounds/', '')))
    )
    expect(files.filter((f) => !valid.has(f))).toEqual([])
    expect(MAX_VARIANTS).toBeGreaterThanOrEqual(3)
  })
})
