// Dog spec — the one small data file that describes a single dog. A dog's identity (breed,
// proportions, colours) lives ONLY here; the builder (build-dog.ts) is generic. A spec may come
// from a person or from Gemini, so it can be incomplete or wrong: normalizeSpec fills defaults and
// clamps everything into safe ranges so the dog can never come out broken.
//
// Multipliers are relative to the neutral template dog (1 = template). Colours are sRGB hex.

export type EarType = 'pointy' | 'semi' | 'floppy'
export type TailType = 'long' | 'fluffy' | 'stub' | 'curled'

export const EAR_TYPES: readonly EarType[] = ['pointy', 'semi', 'floppy']
export const TAIL_TYPES: readonly TailType[] = ['long', 'fluffy', 'stub', 'curled']

export const COLOR_KEYS = [
  'coat',
  'chest',
  'blaze',
  'muzzle',
  'cheeks',
  'brows',
  'legs',
  'paws',
  'ears',
  'tail',
  'tailTip',
  'eyes',
  'nose'
] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

export const PROPORTION_KEYS = [
  'bodyLength',
  'bodyDepth',
  'bodyWidth',
  'legLength',
  'legThickness',
  'neckLength',
  'headSize',
  'snoutLength',
  'snoutWidth',
  'earSize',
  'tailLength',
  'tailThickness'
] as const
export type ProportionKey = (typeof PROPORTION_KEYS)[number]

export interface DogSpec {
  name: string
  sourcePhoto: string
  /** Overall scale of the whole dog. */
  size: number
  proportions: Record<ProportionKey, number>
  earType: EarType
  tailType: TailType
  colors: Record<ColorKey, string>
}

/** [min, max] allowed for each number. Wide enough for very different dogs, tight enough to never break. */
export const RANGES: Record<'size' | ProportionKey, readonly [number, number]> = {
  size: [0.5, 1.6],
  bodyLength: [0.6, 1.5],
  bodyDepth: [0.6, 1.5],
  bodyWidth: [0.6, 1.5],
  legLength: [0.4, 1.7],
  legThickness: [0.6, 1.6],
  neckLength: [0.5, 1.6],
  headSize: [0.7, 1.4],
  snoutLength: [0.5, 1.8],
  snoutWidth: [0.6, 1.5],
  earSize: [0.5, 1.8],
  tailLength: [0.2, 1.8],
  tailThickness: [0.6, 1.8]
}

export const DEFAULT_SPEC: DogSpec = {
  name: 'dog',
  sourcePhoto: 'photo/dog.jpeg',
  size: 1,
  proportions: {
    bodyLength: 1,
    bodyDepth: 1,
    bodyWidth: 1,
    legLength: 1,
    legThickness: 1,
    neckLength: 1,
    headSize: 1,
    snoutLength: 1,
    snoutWidth: 1,
    earSize: 1,
    tailLength: 1,
    tailThickness: 1
  },
  earType: 'semi',
  tailType: 'long',
  colors: {
    coat: '#8a5a2b',
    chest: '#d8b98a',
    blaze: '#d8b98a',
    muzzle: '#b98a5a',
    cheeks: '#8a5a2b',
    brows: '#8a5a2b',
    legs: '#8a5a2b',
    paws: '#d8b98a',
    ears: '#6b4220',
    tail: '#8a5a2b',
    tailTip: '#d8b98a',
    eyes: '#1a1208',
    nose: '#1a1a1a'
  }
}

const HEX = /^#[0-9a-f]{6}$/i

/** sRGB hex ("#rrggbb") -> linear RGB 0..1 (the dog-file colour space), or null if not valid hex. */
export function hexToLinear(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string' || !HEX.test(hex)) return null
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return [channel(0), channel(1), channel(2)]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clampNumber(v: unknown, range: readonly [number, number], fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(range[1], Math.max(range[0], v))
}

/** Turn anything (missing fields, junk, AI output) into a complete, safe DogSpec. Never mutates its input. */
export function normalizeSpec(input: unknown): DogSpec {
  const raw = isRecord(input) ? input : {}
  const rawProps = isRecord(raw.proportions) ? raw.proportions : {}
  const rawColors = isRecord(raw.colors) ? raw.colors : {}

  const proportions = {} as Record<ProportionKey, number>
  for (const key of PROPORTION_KEYS) {
    proportions[key] = clampNumber(rawProps[key], RANGES[key], DEFAULT_SPEC.proportions[key])
  }
  const colors = {} as Record<ColorKey, string>
  for (const key of COLOR_KEYS) {
    const v = rawColors[key]
    colors[key] = typeof v === 'string' && HEX.test(v) ? v : DEFAULT_SPEC.colors[key]
  }
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : DEFAULT_SPEC.name,
    sourcePhoto:
      typeof raw.sourcePhoto === 'string' && raw.sourcePhoto
        ? raw.sourcePhoto
        : DEFAULT_SPEC.sourcePhoto,
    size: clampNumber(raw.size, RANGES.size, DEFAULT_SPEC.size),
    proportions,
    earType: EAR_TYPES.includes(raw.earType as EarType)
      ? (raw.earType as EarType)
      : DEFAULT_SPEC.earType,
    tailType: TAIL_TYPES.includes(raw.tailType as TailType)
      ? (raw.tailType as TailType)
      : DEFAULT_SPEC.tailType,
    colors
  }
}
