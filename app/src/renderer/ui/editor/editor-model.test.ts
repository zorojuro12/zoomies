// The spec editor's logic (the panel's DOM is checked by eye). Every edit returns a NEW spec and
// stays inside the safe ranges, so no slider position can produce a broken dog; saving writes a
// stable, normalised spec file.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, normalizeSpec, PROPORTION_KEYS, RANGES } from '../../dog/spec/dog-spec'
import {
  serializeSpec,
  SLIDERS,
  specFileName,
  withColor,
  withEarType,
  withName,
  withNumber,
  withTailType
} from './editor-model'

describe('SLIDERS', () => {
  it('has one slider for the overall size and one for each of the 12 proportions', () => {
    expect(SLIDERS.map((s) => s.key).sort()).toEqual(['size', ...PROPORTION_KEYS].sort())
  })
  it('uses the same safe ranges as the spec, with a sensible step and a label', () => {
    for (const s of SLIDERS) {
      expect([s.min, s.max]).toEqual([...RANGES[s.key]])
      expect(s.min).toBeLessThan(s.max)
      expect(s.step).toBeGreaterThan(0)
      expect(s.label.length).toBeGreaterThan(0)
    }
  })
})

describe('withNumber', () => {
  it('changes one proportion and keeps everything else', () => {
    const next = withNumber(DEFAULT_SPEC, 'legLength', 0.8)
    expect(next.proportions.legLength).toBe(0.8)
    expect(next.proportions.headSize).toBe(1)
    expect(next.colors).toEqual(DEFAULT_SPEC.colors)
  })
  it('changes the overall size', () => {
    expect(withNumber(DEFAULT_SPEC, 'size', 1.3).size).toBe(1.3)
  })
  it('clamps to the safe range instead of trusting the value', () => {
    expect(withNumber(DEFAULT_SPEC, 'legLength', 99).proportions.legLength).toBe(
      RANGES.legLength[1]
    )
    expect(withNumber(DEFAULT_SPEC, 'size', -3).size).toBe(RANGES.size[0])
  })
  it('ignores NaN and leaves the spec unchanged', () => {
    expect(withNumber(DEFAULT_SPEC, 'legLength', NaN)).toEqual(DEFAULT_SPEC)
  })
  it('never mutates the spec it was given', () => {
    const before = JSON.stringify(DEFAULT_SPEC)
    withNumber(DEFAULT_SPEC, 'legLength', 0.5)
    expect(JSON.stringify(DEFAULT_SPEC)).toBe(before)
  })
})

describe('withColor', () => {
  it('sets a valid colour, lower-cased', () => {
    expect(withColor(DEFAULT_SPEC, 'coat', '#AABBCC').colors.coat).toBe('#aabbcc')
  })
  it('ignores an invalid colour', () => {
    expect(withColor(DEFAULT_SPEC, 'coat', 'goldish')).toEqual(DEFAULT_SPEC)
    expect(withColor(DEFAULT_SPEC, 'coat', '#12345')).toEqual(DEFAULT_SPEC)
  })
})

describe('withEarType / withTailType / withName', () => {
  it('sets a valid ear and tail type and ignores unknown ones', () => {
    expect(withEarType(DEFAULT_SPEC, 'floppy').earType).toBe('floppy')
    expect(withEarType(DEFAULT_SPEC, 'antlers')).toEqual(DEFAULT_SPEC)
    expect(withTailType(DEFAULT_SPEC, 'curled').tailType).toBe('curled')
    expect(withTailType(DEFAULT_SPEC, 'wings')).toEqual(DEFAULT_SPEC)
  })
  it('sets the name, trimmed, and keeps the old one if it would be empty', () => {
    expect(withName(DEFAULT_SPEC, '  Rex ').name).toBe('Rex')
    expect(withName({ ...DEFAULT_SPEC, name: 'Rex' }, '   ').name).toBe('Rex')
  })
})

describe('serializeSpec', () => {
  it('writes pretty JSON ending in a newline', () => {
    const text = serializeSpec(DEFAULT_SPEC)
    expect(text.endsWith('}\n')).toBe(true)
    expect(text).toContain('\n  "proportions": {')
  })
  it('round-trips: reading it back gives the same spec', () => {
    const edited = withColor(withNumber(DEFAULT_SPEC, 'snoutLength', 1.4), 'nose', '#101010')
    expect(normalizeSpec(JSON.parse(serializeSpec(edited)))).toEqual(edited)
  })
  it('has a stable key order so diffs in git stay small', () => {
    const keys = Object.keys(JSON.parse(serializeSpec(DEFAULT_SPEC)))
    expect(keys).toEqual([
      'name',
      'sourcePhoto',
      'size',
      'proportions',
      'earType',
      'tailType',
      'colors'
    ])
  })
})

describe('specFileName', () => {
  it('makes a safe file name from the dog name', () => {
    expect(specFileName({ ...DEFAULT_SPEC, name: 'My Dog!' })).toBe('my-dog.spec.json')
    expect(specFileName({ ...DEFAULT_SPEC, name: 'aussie' })).toBe('aussie.spec.json')
  })
  it('falls back to "dog" when nothing usable is left', () => {
    expect(specFileName({ ...DEFAULT_SPEC, name: '???' })).toBe('dog.spec.json')
  })
})
