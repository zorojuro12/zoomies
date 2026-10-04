// Dog spec: the small data file that describes ONE dog (proportions, ear/tail type, colours).
// The spec is the only place a dog's identity lives; anything may be missing or wrong (it can come
// straight from an AI), so normalizeSpec fills defaults and clamps everything to safe ranges.
// Expected values are hand-worked literals.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, hexToLinear, normalizeSpec, RANGES } from './dog-spec'

describe('hexToLinear (sRGB hex -> linear RGB 0..1, the dog-file colour space)', () => {
  it('maps black and white to 0 and 1', () => {
    expect(hexToLinear('#000000')).toEqual([0, 0, 0])
    const white = hexToLinear('#ffffff')!
    expect(white[0]).toBeCloseTo(1)
    expect(white[1]).toBeCloseTo(1)
    expect(white[2]).toBeCloseTo(1)
  })
  it('keeps channels independent', () => {
    const red = hexToLinear('#ff0000')!
    expect(red[0]).toBeCloseTo(1)
    expect(red[1]).toBeCloseTo(0)
    expect(red[2]).toBeCloseTo(0)
  })
  it('applies the sRGB curve: mid-grey #808080 is about 0.2159 linear (hand-worked)', () => {
    // 128/255 = 0.50196; ((0.50196 + 0.055) / 1.055) ^ 2.4 = 0.2159
    expect(hexToLinear('#808080')![0]).toBeCloseTo(0.2159, 3)
  })
  it('accepts upper case and rejects junk', () => {
    expect(hexToLinear('#FF0000')![0]).toBeCloseTo(1)
    expect(hexToLinear('not a colour')).toBeNull()
    expect(hexToLinear('#12345')).toBeNull()
    expect(hexToLinear('#gggggg')).toBeNull()
  })
})

describe('normalizeSpec', () => {
  it('turns an empty object (or junk) into a complete default dog', () => {
    expect(normalizeSpec({})).toEqual(DEFAULT_SPEC)
    expect(normalizeSpec(null)).toEqual(DEFAULT_SPEC)
    expect(normalizeSpec('banana')).toEqual(DEFAULT_SPEC)
  })
  it('default dog is the neutral template: every multiplier is exactly 1', () => {
    expect(DEFAULT_SPEC.size).toBe(1)
    for (const v of Object.values(DEFAULT_SPEC.proportions)) expect(v).toBe(1)
  })
  it('keeps valid values', () => {
    const s = normalizeSpec({
      name: 'Rex',
      size: 1.2,
      proportions: { legLength: 0.8 },
      earType: 'floppy',
      tailType: 'stub'
    })
    expect(s.name).toBe('Rex')
    expect(s.size).toBe(1.2)
    expect(s.proportions.legLength).toBe(0.8)
    expect(s.proportions.bodyLength).toBe(1) // missing -> default
    expect(s.earType).toBe('floppy')
    expect(s.tailType).toBe('stub')
  })
  it('clamps numbers into their safe range', () => {
    const s = normalizeSpec({ size: 99, proportions: { legLength: -5, snoutLength: 99 } })
    expect(s.size).toBe(RANGES.size[1])
    expect(s.proportions.legLength).toBe(RANGES.legLength[0])
    expect(s.proportions.snoutLength).toBe(RANGES.snoutLength[1])
  })
  it('replaces non-numbers and NaN with the default', () => {
    const s = normalizeSpec({ size: 'big', proportions: { legLength: NaN, headSize: null } })
    expect(s.size).toBe(1)
    expect(s.proportions.legLength).toBe(1)
    expect(s.proportions.headSize).toBe(1)
  })
  it('falls back to the default for an unknown ear or tail type', () => {
    const s = normalizeSpec({ earType: 'antlers', tailType: 'wings' })
    expect(s.earType).toBe(DEFAULT_SPEC.earType)
    expect(s.tailType).toBe(DEFAULT_SPEC.tailType)
  })
  it('keeps valid colours and replaces bad ones with the default colour', () => {
    const s = normalizeSpec({ colors: { coat: '#112233', chest: 'purple-ish', nose: 42 } })
    expect(s.colors.coat).toBe('#112233')
    expect(s.colors.chest).toBe(DEFAULT_SPEC.colors.chest)
    expect(s.colors.nose).toBe(DEFAULT_SPEC.colors.nose)
  })
  it('ignores unknown keys and does not change its input', () => {
    const input = { size: 1.1, wings: true, colors: { coat: '#abcdef', sparkle: '#fff000' } }
    const copy = JSON.parse(JSON.stringify(input))
    const s = normalizeSpec(input)
    expect(input).toEqual(copy)
    expect(s).not.toHaveProperty('wings')
    expect(s.colors).not.toHaveProperty('sparkle')
  })
})
