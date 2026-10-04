// Photo colours (new-dog flow, E1): the TypeScript twin of pipeline/zoomies_pipeline/colors.py.
// The model decides WHICH colour goes WHERE on the dog; the photo supplies the exact paint: find the
// photo's dominant colours (k-means in Lab space, backdrop removed) and snap each of the model's colours
// to the nearest real one, so we never use a colour that is not on the dog. Distances are CIE76 delta-E
// in Lab (0 = same, 100 = black vs white). Pure functions, no Electron: the caller decodes the image.
export type Rgb = [number, number, number]
export type Lab = [number, number, number]

/** Pixels as r,g,b triplets, row by row. */
export interface RgbImage {
  width: number
  height: number
  data: Uint8Array
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function hexToRgb(value: unknown): Rgb | null {
  if (typeof value !== 'string' || !HEX.test(value)) return null
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16)
  ]
}

export function rgbToHex(rgb: readonly number[]): string {
  const c = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`
}

const M = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041]
]
const WHITE = [0.95047, 1.0, 1.08883]

/** sRGB 0..255 -> CIE Lab (D65). */
export function rgbToLab(rgb: readonly number[]): Lab {
  const lin = rgb.map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const f = [0, 1, 2].map((i) => {
    const xyz = (M[i][0] * lin[0] + M[i][1] * lin[1] + M[i][2] * lin[2]) / WHITE[i]
    return xyz > 216 / 24389 ? Math.cbrt(xyz) : ((24389 / 27) * xyz + 16) / 116
  })
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
}

function dist(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function deltaE(a: string, b: string): number {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return Number.POSITIVE_INFINITY
  return dist(rgbToLab(ra), rgbToLab(rb))
}

/** Electron's bitmap is B,G,R,A per pixel; make it r,g,b. */
export function bgraToRgb(bgra: Uint8Array, width: number, height: number): RgbImage {
  const n = width * height
  const data = new Uint8Array(n * 3)
  for (let i = 0; i < n; i++) {
    data[i * 3] = bgra[i * 4 + 2]
    data[i * 3 + 1] = bgra[i * 4 + 1]
    data[i * 3 + 2] = bgra[i * 4]
  }
  return { width, height, data }
}

const THUMB = 160

/** Shrink so the longer side is at most `max` (box average: cheap and good enough for colours). */
function shrink(img: RgbImage, max: number): RgbImage {
  const scale = Math.max(img.width, img.height) / max
  if (scale <= 1) return img
  const w = Math.max(1, Math.round(img.width / scale))
  const h = Math.max(1, Math.round(img.height / scale))
  const data = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 3
          r += img.data[i]
          g += img.data[i + 1]
          b += img.data[i + 2]
          n++
        }
      const o = (y * w + x) * 3
      data[o] = r / n
      data[o + 1] = g / n
      data[o + 2] = b / n
    }
  }
  return { width: w, height: h, data }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** True where a pixel is NOT the backdrop. The backdrop colour is the median of the border ring. */
export function foregroundMask(img: RgbImage, threshold = 12): boolean[] {
  const { width: w, height: h, data } = img
  const t = Math.max(2, Math.min(w, h) >> 4)
  const ring: number[][] = [[], [], []]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (y < t || y >= h - t || x < t || x >= w - t) {
        const i = (y * w + x) * 3
        for (let c = 0; c < 3; c++) ring[c].push(data[i + c])
      }
    }
  const bg = rgbToLab([median(ring[0]), median(ring[1]), median(ring[2])])
  const out: boolean[] = new Array(w * h)
  for (let p = 0; p < w * h; p++) {
    out[p] = dist(rgbToLab([data[p * 3], data[p * 3 + 1], data[p * 3 + 2]]), bg) > threshold
  }
  return out
}

/** A small seeded random generator (mulberry32), so the same photo always gives the same palette. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Lloyd's k-means with k-means++ seeding on Lab points. Returns each point's cluster. */
function kmeans(points: Lab[], kWanted: number, seed: number, iters = 25): number[] {
  const rand = rng(seed)
  const n = points.length
  const k = Math.min(kWanted, n)
  const centers: Lab[] = [points[Math.floor(rand() * n)]]
  for (let c = 1; c < k; c++) {
    const d2 = points.map((p) => Math.min(...centers.map((q) => dist(p, q) ** 2)))
    const total = d2.reduce((s, v) => s + v, 0)
    if (total <= 0) {
      centers.push(points[Math.floor(rand() * n)])
      continue
    }
    let r = rand() * total
    let pick = n - 1
    for (let i = 0; i < n; i++) {
      r -= d2[i]
      if (r <= 0) {
        pick = i
        break
      }
    }
    centers.push(points[pick])
  }
  const cs = centers.map((c) => [...c] as Lab)
  const labels = new Array<number>(n).fill(0)
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let best = 0
      let bd = Infinity
      for (let c = 0; c < k; c++) {
        const d = dist(points[i], cs[c])
        if (d < bd) {
          bd = d
          best = c
        }
      }
      labels[i] = best
    }
    for (let c = 0; c < k; c++) {
      let l = 0
      let a = 0
      let b = 0
      let cnt = 0
      for (let i = 0; i < n; i++)
        if (labels[i] === c) {
          l += points[i][0]
          a += points[i][1]
          b += points[i][2]
          cnt++
        }
      if (cnt > 0) cs[c] = [l / cnt, a / cnt, b / cnt]
    }
  }
  return labels
}

/** The photo's main colours, most common first, with the backdrop removed. [] if the image is unusable. */
export function dominantColors(image: RgbImage, k = 8, seed = 0): string[] {
  if (image.width < 1 || image.height < 1 || image.data.length < image.width * image.height * 3)
    return []
  const img = shrink(image, THUMB)
  const mask = foregroundMask(img)
  const all: Rgb[] = []
  const fg: Rgb[] = []
  for (let p = 0; p < img.width * img.height; p++) {
    const px: Rgb = [img.data[p * 3], img.data[p * 3 + 1], img.data[p * 3 + 2]]
    all.push(px)
    if (mask[p]) fg.push(px)
  }
  const pixels = fg.length >= 50 ? fg : all
  const labels = kmeans(pixels.map(rgbToLab), k, seed)
  const groups = new Map<number, Rgb[]>()
  labels.forEach((l, i) => groups.set(l, [...(groups.get(l) ?? []), pixels[i]]))
  return [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .map((g) =>
      rgbToHex([
        g.reduce((s, p) => s + p[0], 0) / g.length,
        g.reduce((s, p) => s + p[1], 0) / g.length,
        g.reduce((s, p) => s + p[2], 0) / g.length
      ])
    )
}

/** The nearest palette colour, or the original (lower-cased) if nothing is close enough. */
export function snapColor(value: string, palette: string[], maxDelta = 35): string {
  const original = value.toLowerCase()
  if (palette.length === 0) return original
  let best = palette[0]
  let bd = deltaE(original, best)
  for (const p of palette) {
    const d = deltaE(original, p)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return bd <= maxDelta ? best.toLowerCase() : original
}

export function snapColors(
  colors: Record<string, string>,
  palette: string[],
  maxDelta = 35
): { colors: Record<string, string>; changes: Record<string, [string, string]> } {
  const out: Record<string, string> = {}
  const changes: Record<string, [string, string]> = {}
  for (const [key, value] of Object.entries(colors)) {
    const next = snapColor(value, palette, maxDelta)
    out[key] = next
    if (next !== value.toLowerCase()) changes[key] = [value, next]
  }
  return { colors: out, changes }
}
