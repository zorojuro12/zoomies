// Dog from a photo (new-dog flow, E1): the TypeScript twin of pipeline/zoomies_pipeline/{aggregate,
// photo_to_spec}.py, so the app can make a dog from any photo at any moment without Python.
//
//   photo ─► Gemini (3 calls in parallel, each with a timeout) ─► median of the answers ─► snap colours to
//   the photo ─► spec        (if every call fails: the default template dog; it never throws)
//
// Runs in the main process (the key never reaches the page). Progress is reported step by step through
// `onProgress`, so the screen and the terminal can show what is happening.
import {
  COLOR_KEYS,
  DEFAULT_SPEC,
  PROPORTION_KEYS,
  normalizeSpec
} from '../../renderer/dog/spec/dog-spec'
import type { DogSpec } from '../../renderer/dog/spec/dog-spec'
import { dominantColors, hexToRgb, rgbToHex, snapColors } from './photo-colors'
import type { RgbImage } from './photo-colors'

export type SpecAnswer = Record<string, unknown>

export type FetchLike = (
  url: string,
  init: RequestInit
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export const DEFAULT_MODEL = 'gemini-3.8-flash'

// ---- the question we ask Gemini (same words as the Python pipeline) ------------------------------

const PROPORTION_HELP: Record<(typeof PROPORTION_KEYS)[number], string> = {
  bodyLength: 'Torso length. 1.0 = typical; 0.7 = short and compact; 1.4 = long (dachshund-like).',
  bodyDepth:
    'Chest depth, top to bottom. 1.0 = typical; 0.8 = lean (greyhound); 1.3 = deep chested.',
  bodyWidth:
    'Body width / fluffiness of the torso. 1.0 = typical; 0.7 = slim; 1.3 = stocky or very fluffy.',
  legLength:
    'Leg length. 1.0 = typical; 0.55 = very short legs (corgi, basset); 1.6 = very long (greyhound).',
  legThickness: 'Leg thickness. 1.0 = typical; 0.75 = slender; 1.4 = sturdy.',
  neckLength: 'Neck length. 1.0 = typical; 0.8 = short, thick neck; 1.4 = long, elegant neck.',
  headSize: 'Head size relative to the body. 1.0 = typical; 0.85 = small head; 1.25 = large head.',
  snoutLength:
    'Muzzle length. 1.0 = typical; 0.6 = flat-faced (pug, bulldog); 1.6 = long (collie, greyhound).',
  snoutWidth: 'Muzzle width. 1.0 = typical; 0.7 = narrow; 1.3 = broad.',
  earSize: 'Ear size. 1.0 = typical; 0.7 = small; 1.5 = large.',
  tailLength: 'Tail length. 1.0 = typical; 0.3 = bobbed or very short; 1.5 = long.',
  tailThickness: 'Tail thickness / fluffiness. 1.0 = typical; 0.7 = thin; 1.5 = very bushy.'
}

const COLOR_HELP: Record<(typeof COLOR_KEYS)[number], string> = {
  coat: 'main body colour',
  chest: 'chest / front of the body',
  blaze: 'stripe down the forehead (use the coat colour if there is none)',
  muzzle: 'snout / muzzle',
  cheeks: 'cheeks (use the coat colour if no markings)',
  brows: 'eyebrow spots (use the coat colour if none)',
  legs: 'legs above the paws',
  paws: 'paws',
  ears: 'ears',
  tail: 'tail',
  tailTip: 'tip of the tail',
  eyes: 'iris colour',
  nose: 'nose'
}

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    size: {
      type: 'number',
      description:
        'Overall size of the dog. 1.0 = a typical medium dog; 0.6 = toy dog; 1.5 = giant breed.'
    },
    proportions: {
      type: 'object',
      properties: Object.fromEntries(
        PROPORTION_KEYS.map((k) => [k, { type: 'number', description: PROPORTION_HELP[k] }])
      ) as Record<(typeof PROPORTION_KEYS)[number], { type: string; description: string }>,
      required: [...PROPORTION_KEYS]
    },
    earType: {
      type: 'string',
      enum: ['pointy', 'semi', 'floppy'],
      description:
        'pointy = stand straight up; semi = stand up with tips folding forward; floppy = hang down.'
    },
    tailType: {
      type: 'string',
      enum: ['long', 'fluffy', 'stub', 'curled'],
      description:
        'long = ordinary; fluffy = long and bushy; stub = bobbed or very short; curled = carried curled up over the back.'
    },
    colors: {
      type: 'object',
      properties: Object.fromEntries(
        COLOR_KEYS.map((k) => [
          k,
          { type: 'string', description: `sRGB hex like #1a2b3c: ${COLOR_HELP[k]}` }
        ])
      ),
      required: [...COLOR_KEYS]
    }
  },
  required: ['size', 'proportions', 'earType', 'tailType', 'colors']
}

export const PROMPT =
  'You are describing the dog in this photo so a 3D model of it can be built.\n' +
  'Return ONLY JSON matching the schema. Every number is relative to a TYPICAL medium dog, where ' +
  "1.0 means 'typical'; use the guidance in each field description and be decisive (do not answer " +
  "1.0 for everything — judge this dog's real breed and build).\n" +
  'If the photo is front-facing, estimate side proportions (body length, leg length) from the ' +
  'breed and what you can see. If the tail is hidden, infer it from the breed.\n' +
  'Colours must be sRGB hex values (#rrggbb) of what you actually SEE on each part, as seen in ' +
  'this photo (not generic breed colours).'

/** One real Gemini call with the photo. Throws on any problem; the caller counts that as a failed call. */
export async function askGemini(
  image: Uint8Array,
  mime: string,
  opts: { apiKey: string | undefined; model?: string; fetch?: FetchLike; signal?: AbortSignal }
): Promise<SpecAnswer> {
  if (!opts.apiKey) throw new Error('no Gemini key (set GEMINI_API_KEY in .env)')
  const doFetch = opts.fetch ?? ((url, init) => fetch(url, init))
  const res = await doFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model ?? DEFAULT_MODEL}:generateContent`,
    {
      method: 'POST',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mime, data: Buffer.from(image).toString('base64') } },
              { text: PROMPT }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0.2
        }
      })
    }
  )
  if (!res.ok) throw new Error(`Gemini answered HTTP ${res.status}`)
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  } | null
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') throw new Error('Gemini sent no text')
  return JSON.parse(text) as SpecAnswer
}

// ---- merging several answers ---------------------------------------------------------------------

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of no values')
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Most common value; ties go to the first answer among the leaders. */
function vote<T>(values: T[]): T {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const best = Math.max(...counts.values())
  return values.find((v) => counts.get(v) === best) as T
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000

/** Numbers: median. Ear/tail type: vote. Colours: per-channel median. Always a valid, normalised spec. */
export function aggregateSpecs(answers: readonly unknown[]): DogSpec {
  if (answers.length === 0) throw new Error('no specs to aggregate')
  const specs = answers.map((a) => normalizeSpec(a))
  const colors = {} as DogSpec['colors']
  for (const k of COLOR_KEYS) {
    const rgbs = specs.map((s) => hexToRgb(s.colors[k]) ?? [0, 0, 0])
    colors[k] = rgbToHex([0, 1, 2].map((i) => Math.round(median(rgbs.map((c) => c[i])))))
  }
  const proportions = {} as DogSpec['proportions']
  for (const k of PROPORTION_KEYS)
    proportions[k] = round4(median(specs.map((s) => s.proportions[k])))
  return normalizeSpec({
    name: specs[0].name,
    sourcePhoto: specs[0].sourcePhoto,
    size: round4(median(specs.map((s) => s.size))),
    proportions,
    earType: vote(specs.map((s) => s.earType)),
    tailType: vote(specs.map((s) => s.tailType)),
    colors
  })
}

// ---- the whole thing -----------------------------------------------------------------------------

/** What is happening, for the screen and the log. */
export type Progress =
  | { stage: 'asking'; calls: number }
  | { stage: 'call'; done: number; total: number; ok: boolean; error?: string }
  | { stage: 'merging'; answers: number }
  | { stage: 'colors'; palette: number; snapped: number }
  | { stage: 'fallback'; reason: string }
  | { stage: 'done' }

export interface PhotoToSpecOptions {
  image: Uint8Array
  mime: string
  name: string
  /** The model call (injectable). Gets an AbortSignal that fires at the timeout. */
  ask: (image: Uint8Array, mime: string, signal: AbortSignal) => Promise<SpecAnswer>
  /** Decoded pixels, for matching colours to the photo (skipped without them). */
  pixels?: RgbImage
  calls?: number
  timeoutMs?: number
  /** Largest colour change (CIE delta-E) the photo may make; 0 = never snap. */
  snapDelta?: number
  sourcePhoto?: string
  onProgress?: (p: Progress) => void
}

export interface SpecResult {
  spec: DogSpec
  report: {
    callsOk: number
    callsFailed: number
    errors: string[]
    fallback: boolean
    snapped: Record<string, [string, string]>
    palette: string[]
  }
}

function once<T>(
  ask: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      resolve({ ok: false, error: `timeout after ${timeoutMs / 1000}s` })
    }, timeoutMs)
    ask(controller.signal).then(
      (value) => {
        clearTimeout(timer)
        resolve({ ok: true, value })
      },
      (e: unknown) => {
        clearTimeout(timer)
        resolve({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    )
  })
}

/** Photo -> robust spec. Never throws: if nothing works you get the default dog. */
export async function photoToSpec(opts: PhotoToSpecOptions): Promise<SpecResult> {
  const calls = opts.calls ?? 3
  const timeoutMs = opts.timeoutMs ?? 20000
  const say = (p: Progress): void => {
    try {
      opts.onProgress?.(p)
    } catch {
      // a broken listener must never break making the dog
    }
  }
  say({ stage: 'asking', calls })

  let done = 0
  const outcomes = await Promise.all(
    Array.from({ length: calls }, () =>
      once((signal) => opts.ask(opts.image, opts.mime, signal), timeoutMs).then((o) => {
        const ok = o.ok && typeof o.value === 'object' && o.value !== null
        done++
        say({
          stage: 'call',
          done,
          total: calls,
          ok,
          error: ok ? undefined : o.ok ? 'invalid answer' : o.error
        })
        return o.ok && !ok ? ({ ok: false, error: 'invalid answer' } as const) : o
      })
    )
  )
  const answers: SpecAnswer[] = []
  const errors: string[] = []
  for (const o of outcomes) {
    if (o.ok) answers.push(o.value)
    else errors.push(o.error)
  }
  const report: SpecResult['report'] = {
    callsOk: answers.length,
    callsFailed: calls - answers.length,
    errors,
    fallback: answers.length === 0,
    snapped: {},
    palette: []
  }

  let spec: DogSpec
  if (answers.length === 0) {
    say({ stage: 'fallback', reason: errors[0] ?? 'no answers' })
    spec = normalizeSpec(DEFAULT_SPEC)
  } else {
    say({ stage: 'merging', answers: answers.length })
    spec = aggregateSpecs(answers)
    if (opts.pixels) {
      try {
        const palette = dominantColors(opts.pixels)
        const { colors, changes } = snapColors(spec.colors, palette, opts.snapDelta ?? 10)
        spec = { ...spec, colors: colors as DogSpec['colors'] }
        report.snapped = changes
        report.palette = palette
        say({ stage: 'colors', palette: palette.length, snapped: Object.keys(changes).length })
      } catch (e) {
        report.errors.push(`colour snap skipped: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  spec = normalizeSpec({
    ...spec,
    name: opts.name,
    ...(opts.sourcePhoto ? { sourcePhoto: opts.sourcePhoto } : {})
  })
  say({ stage: 'done' })
  return { spec, report }
}
