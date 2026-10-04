// Photo colours (new-dog flow, E1): the TypeScript twin of pipeline/zoomies_pipeline/colors.py.
// Gemini decides WHICH colour goes WHERE on the dog; the photo supplies the exact paint. Reference
// numbers below were computed with the Python formulas (CIE76 delta-E in Lab, D65).
import { describe, expect, it } from 'vitest'
import {
  bgraToRgb,
  deltaE,
  dominantColors,
  foregroundMask,
  hexToRgb,
  rgbToHex,
  rgbToLab,
  snapColor,
  snapColors,
  type RgbImage
} from './photo-colors'

describe('hex and rgb', () => {
  it('round trip', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
    expect(rgbToHex([255, 128, 0])).toBe('#ff8000')
    expect(hexToRgb('#ABCDEF')).toEqual([171, 205, 239])
  })
  it('rejects junk', () => {
    for (const bad of ['ff8000', '#12345', '#gggggg', 'red', 5, null, undefined, '#ff80000'])
      expect(hexToRgb(bad as never)).toBeNull()
  })
  it('rgbToHex clamps and rounds', () => {
    expect(rgbToHex([300, -5, 127.6])).toBe('#ff0080')
  })
})

describe('Lab and delta-E match the Python reference', () => {
  const lab: [[number, number, number], [number, number, number]][] = [
    [
      [255, 0, 0],
      [53.2408, 80.0925, 67.2032]
    ],
    [
      [128, 128, 128],
      [53.585, 0, 0]
    ],
    [
      [138, 90, 43],
      [42.599, 15.0398, 34.5152]
    ],
    [
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [255, 255, 255],
      [100, 0, 0]
    ]
  ]
  for (const [rgb, want] of lab) {
    it(`Lab of ${rgb}`, () => {
      const got = rgbToLab(rgb)
      for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], 3)
    })
  }
  const de: [string, string, number][] = [
    ['#000000', '#ffffff', 100],
    ['#ff0000', '#f01010', 8.961],
    ['#8a5a2b', '#9a6a3b', 6.403],
    ['#336699', '#3a6a90', 8.3159],
    ['#1a2b3c', '#d8b98a', 72.8101]
  ]
  for (const [a, b, want] of de) {
    it(`delta-E ${a} ${b} = ${want}`, () => expect(deltaE(a, b)).toBeCloseTo(want, 2))
  }
  it('identical colours are 0 apart and the order is symmetric', () => {
    expect(deltaE('#336699', '#336699')).toBeCloseTo(0, 6)
    expect(deltaE('#336699', '#8a5a2b')).toBeCloseTo(deltaE('#8a5a2b', '#336699'), 9)
  })
})

describe('snapping to the photo', () => {
  it('moves a colour to the nearest photo colour', () => {
    expect(snapColor('#e03030', ['#ff0000', '#0000ff'])).toBe('#ff0000')
    expect(snapColor('#3030e0', ['#ff0000', '#0000ff'])).toBe('#0000ff')
  })
  it('keeps the original (lower-cased) when nothing is close enough', () => {
    expect(snapColor('#00FF00', ['#ff0000', '#0000ff'], 35)).toBe('#00ff00')
  })
  it('an empty palette changes nothing', () => {
    expect(snapColor('#123456', [])).toBe('#123456')
  })
  it('reports what changed', () => {
    const { colors, changes } = snapColors({ coat: '#e03030', eyes: '#00ff00' }, ['#ff0000'])
    expect(colors).toEqual({ coat: '#ff0000', eyes: '#00ff00' })
    expect(changes).toEqual({ coat: ['#e03030', '#ff0000'] })
  })
  it('only tiny corrections with a small max delta (the pipeline uses 10)', () => {
    expect(snapColor('#8a5a2b', ['#9a6a3b'], 10)).toBe('#9a6a3b') // 6.4 apart: snaps
    expect(snapColor('#8a5a2b', ['#b08040'], 10)).toBe('#8a5a2b') // far apart: stays
  })
})

/** w x h: a grey studio backdrop with a red block (30x60) and a smaller blue block (20x40) inside it. */
function synthetic(w = 100, h = 100): RgbImage {
  const data = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      let c: [number, number, number] = [138, 143, 148]
      if (x >= w * 0.2 && x < w * 0.5 && y >= h * 0.2 && y < h * 0.8) c = [200, 0, 0]
      else if (x >= w * 0.55 && x < w * 0.75 && y >= h * 0.3 && y < h * 0.7) c = [0, 0, 200]
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
    }
  return { width: w, height: h, data }
}

describe('finding the dog in the photo', () => {
  it('the backdrop (median of the border ring) is background, the blocks are foreground', () => {
    const img = synthetic()
    const m = foregroundMask(img)
    expect(m[5 * 100 + 5]).toBe(false)
    expect(m[50 * 100 + 30]).toBe(true) // red
    expect(m[50 * 100 + 60]).toBe(true) // blue
  })
})

describe('dominant colours', () => {
  it('finds the red and the blue, most common first, and no backdrop grey', () => {
    const p = dominantColors(synthetic())
    expect(p.length).toBeGreaterThanOrEqual(2)
    const near = (a: string, b: string): boolean => deltaE(a, b) < 6
    expect(near(p[0], '#c80000')).toBe(true) // red block is bigger
    expect(p.some((c) => near(c, '#0000c8'))).toBe(true)
    expect(p.some((c) => near(c, '#8a8f94'))).toBe(false)
  })
  it('is deterministic', () => {
    expect(dominantColors(synthetic())).toEqual(dominantColors(synthetic()))
  })
  it('a big photo is shrunk first, and gives the same colours as a small one', () => {
    const big = dominantColors(synthetic(1600, 1200))
    expect(deltaE(big[0], '#c80000')).toBeLessThan(6)
  })
  it('a plain photo with no distinct subject still gives colours (falls back to all pixels)', () => {
    const w = 40
    const data = new Uint8Array(w * w * 3).fill(120)
    const p = dominantColors({ width: w, height: w, data })
    expect(p.length).toBeGreaterThan(0)
    expect(deltaE(p[0], '#787878')).toBeLessThan(2)
  })
  it('a 1x1 and a 2x2 photo do not crash', () => {
    expect(
      dominantColors({ width: 1, height: 1, data: Uint8Array.from([10, 20, 30]) }).length
    ).toBe(1)
    expect(
      dominantColors({ width: 2, height: 2, data: new Uint8Array(12) }).length
    ).toBeGreaterThan(0)
  })
  it('junk sizes return no colours instead of throwing', () => {
    expect(dominantColors({ width: 0, height: 0, data: new Uint8Array(0) })).toEqual([])
    expect(dominantColors({ width: 10, height: 10, data: new Uint8Array(5) })).toEqual([])
  })
})

describe('bgraToRgb (what Electron hands back)', () => {
  it('drops alpha and swaps blue/red', () => {
    const out = bgraToRgb(Uint8Array.from([10, 20, 30, 255, 1, 2, 3, 128]), 2, 1)
    expect([...out.data]).toEqual([30, 20, 10, 3, 2, 1])
    expect(out.width).toBe(2)
  })
})
