// Spec editor logic (the pure part; the panel's DOM is in spec-editor.ts). Every edit returns a NEW
// spec and stays inside the safe ranges, so no slider position can produce a broken dog. Saving
// writes a stable, normalised spec file so git diffs stay small.
import {
  COLOR_KEYS,
  EAR_TYPES,
  hexToLinear,
  PROPORTION_KEYS,
  RANGES,
  TAIL_TYPES
} from '../../dog/spec/dog-spec'
import type { ColorKey, DogSpec, EarType, ProportionKey, TailType } from '../../dog/spec/dog-spec'

export type NumberKey = 'size' | ProportionKey

export interface SliderDef {
  key: NumberKey
  label: string
  min: number
  max: number
  step: number
}

const LABELS: Record<NumberKey, string> = {
  size: 'Overall size',
  bodyLength: 'Body length',
  bodyDepth: 'Chest depth',
  bodyWidth: 'Body width',
  legLength: 'Leg length',
  legThickness: 'Leg thickness',
  neckLength: 'Neck length',
  headSize: 'Head size',
  snoutLength: 'Snout length',
  snoutWidth: 'Snout width',
  earSize: 'Ear size',
  tailLength: 'Tail length',
  tailThickness: 'Tail thickness'
}

export const SLIDERS: SliderDef[] = (['size', ...PROPORTION_KEYS] as NumberKey[]).map((key) => ({
  key,
  label: LABELS[key],
  min: RANGES[key][0],
  max: RANGES[key][1],
  step: 0.01
}))

export const COLOR_LABELS: Record<ColorKey, string> = {
  coat: 'Coat',
  chest: 'Chest',
  blaze: 'Blaze',
  muzzle: 'Muzzle',
  cheeks: 'Cheeks',
  brows: 'Brows',
  legs: 'Legs',
  paws: 'Paws',
  ears: 'Ears',
  tail: 'Tail',
  tailTip: 'Tail tip',
  eyes: 'Eyes',
  nose: 'Nose'
}

export function withNumber(spec: DogSpec, key: NumberKey, value: number): DogSpec {
  if (!Number.isFinite(value)) return spec
  const [lo, hi] = RANGES[key]
  const v = Math.min(hi, Math.max(lo, value))
  if (key === 'size') return { ...spec, size: v }
  return { ...spec, proportions: { ...spec.proportions, [key]: v } }
}

export function withColor(spec: DogSpec, key: ColorKey, hex: string): DogSpec {
  if (hexToLinear(hex) === null) return spec
  return { ...spec, colors: { ...spec.colors, [key]: hex.toLowerCase() } }
}

export function withEarType(spec: DogSpec, type: string): DogSpec {
  return EAR_TYPES.includes(type as EarType) ? { ...spec, earType: type as EarType } : spec
}

export function withTailType(spec: DogSpec, type: string): DogSpec {
  return TAIL_TYPES.includes(type as TailType) ? { ...spec, tailType: type as TailType } : spec
}

export function withName(spec: DogSpec, name: string): DogSpec {
  const trimmed = name.trim()
  return trimmed ? { ...spec, name: trimmed } : spec
}

/** Pretty JSON in a fixed key order, ending with a newline. */
export function serializeSpec(spec: DogSpec): string {
  const ordered = {
    name: spec.name,
    sourcePhoto: spec.sourcePhoto,
    size: spec.size,
    proportions: Object.fromEntries(PROPORTION_KEYS.map((k) => [k, spec.proportions[k]])),
    earType: spec.earType,
    tailType: spec.tailType,
    colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, spec.colors[k]]))
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

/** A safe file name for a spec: "My Dog!" -> "my-dog.spec.json". */
export function specFileName(spec: DogSpec): string {
  const slug = spec.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'dog'}.spec.json`
}
