// New-dog flow (E2): "Upload new dog…" end to end in the main process.
//   pick a photo ─► read + shrink it ─► make the dog (parallel Gemini calls, median, colours) ─► save it
// Every step is reported twice: to the screen (`progress`, the "Making your dog…" card) and to the terminal
// (`log`, lines starting with "[new-dog]"). A failure NEVER replaces the current dog: it comes back as
// { ok: false, message } and nothing is saved. Everything real (dialog, files, image decoding, Gemini) is
// injected, so the flow itself is tested with fakes.
import type { NewDogProgress, NewDogResult } from '../../shared/ipc'
import { normalizeSpec } from '../../renderer/dog/spec/dog-spec'
import type { DogSpec } from '../../renderer/dog/spec/dog-spec'
import { photoToSpec } from './dog-from-photo'
import type { SpecAnswer } from './dog-from-photo'
import type { RgbImage } from './photo-colors'

export const STEPS = [
  'Reading your photo',
  'Asking Gemini what your dog looks like',
  'Combining the answers',
  'Matching colours to your photo',
  'Building your dog'
] as const

/** Photos bigger than this are refused before anything is sent anywhere. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
const CALLS = 3

export interface FlowDeps {
  /** The file picker: a path, or null if the user cancelled. */
  pick(): Promise<string | null>
  readFile(path: string): Promise<Uint8Array>
  /** Decode and shrink the photo: a small JPEG for Gemini plus pixels for matching colours. null = not an image. */
  prepare(bytes: Uint8Array): { jpeg: Uint8Array; pixels: RgbImage } | null
  ask(image: Uint8Array, mime: string, signal: AbortSignal): Promise<SpecAnswer>
  save(spec: DogSpec): Promise<void>
  load(): Promise<unknown | null>
  clear(): Promise<void>
  progress(p: NewDogProgress): void
  log(message: string): void
  now(): number
}

/** A safe dog name from the photo's file name. */
export function dogNameFrom(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? ''
  const base = file.replace(/\.[^.]*$/, '')
  const name = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return name || 'dog'
}

const mb = (n: number): string => `${(n / 1048576).toFixed(1)} MB`
const kb = (n: number): string => `${Math.round(n / 1024)} KB`

export class NewDogFlow {
  private running = false

  constructor(private readonly d: FlowDeps) {}

  get busy(): boolean {
    return this.running
  }

  private say(
    current: number,
    detail: string,
    percent: number,
    extra: Partial<NewDogProgress> = {}
  ): void {
    try {
      this.d.progress({ steps: STEPS, current, detail, percent, state: 'running', ...extra })
    } catch {
      // a broken screen must not break making the dog
    }
  }

  private log(message: string): void {
    try {
      this.d.log(`[new-dog] ${message}`)
    } catch {
      // logging must never break it either
    }
  }

  private fail(current: number, percent: number, message: string): NewDogResult {
    this.log(`FAILED: ${message}`)
    this.say(current, message, percent, { state: 'error', message })
    return { ok: false, message }
  }

  async run(): Promise<NewDogResult> {
    if (this.running) return { ok: false, message: 'Already making a dog: wait for it to finish.' }
    this.running = true
    const t0 = this.d.now()
    try {
      const path = await this.d.pick()
      if (!path) {
        this.log('cancelled (no photo picked)')
        return { ok: false, cancelled: true, message: 'cancelled' }
      }
      const fileName = path.split(/[\\/]/).pop() ?? path
      const name = dogNameFrom(path)
      this.log(`1/5 photo picked: ${fileName}`)
      this.say(0, `Opening ${fileName}…`, 5)

      let bytes: Uint8Array
      try {
        bytes = await this.d.readFile(path)
      } catch (e) {
        return this.fail(
          0,
          5,
          `I couldn't open that file (${e instanceof Error ? e.message : String(e)}).`
        )
      }
      if (bytes.length > MAX_PHOTO_BYTES) {
        return this.fail(
          0,
          5,
          `That photo is too big (${mb(bytes.length)}). Try one under ${mb(MAX_PHOTO_BYTES)}.`
        )
      }
      const prepared = this.d.prepare(bytes)
      if (!prepared) {
        return this.fail(
          0,
          8,
          "I couldn't read that file as a picture. Try a JPG or PNG photo of a dog."
        )
      }
      this.log(`photo prepared: ${mb(bytes.length)} -> ${kb(prepared.jpeg.length)} JPEG for Gemini`)
      this.say(0, `Photo ready (${kb(prepared.jpeg.length)})`, 10)

      let askedAt = this.d.now()
      const result = await photoToSpec({
        image: prepared.jpeg,
        mime: 'image/jpeg',
        name,
        pixels: prepared.pixels,
        calls: CALLS,
        ask: this.d.ask,
        onProgress: (p) => {
          if (p.stage === 'asking') {
            askedAt = this.d.now()
            this.log(`2/5 asking Gemini (${p.calls} opinions at once)…`)
            this.say(1, 'Sending your photo to Gemini…', 15)
          } else if (p.stage === 'call') {
            const secs = ((this.d.now() - askedAt) / 1000).toFixed(1)
            this.log(
              p.ok
                ? `call ${p.done}/${p.total} ok (${secs} s)`
                : `call ${p.done}/${p.total} FAILED (${secs} s): ${p.error ?? 'unknown'}`
            )
            this.say(
              1,
              `${p.done} of ${p.total} opinions in`,
              15 + Math.round((55 * p.done) / p.total)
            )
          } else if (p.stage === 'merging') {
            this.log(`3/5 combining ${p.answers} answers (taking the middle one)`)
            this.say(2, `Taking the middle of ${p.answers} answers`, 75)
          } else if (p.stage === 'colors') {
            this.log(
              `4/5 colours: photo palette of ${p.palette}, ${p.snapped} colours nudged to match`
            )
            this.say(3, `Matched ${p.snapped} colours to your photo`, 85)
          }
        }
      })
      this.log(`${result.report.callsOk} of ${CALLS} calls worked`)

      if (result.report.fallback) {
        const first = result.report.errors[0] ?? 'no answer'
        if (/GEMINI_API_KEY/.test(first)) {
          return this.fail(
            1,
            15,
            'No Gemini key found. Put GEMINI_API_KEY in the .env file and restart Zoomies.'
          )
        }
        return this.fail(
          1,
          15,
          `Gemini couldn't look at the photo (${first}). Check your internet and try again.`
        )
      }

      const spec = normalizeSpec(result.spec)
      this.say(4, 'Putting the new dog together…', 92)
      try {
        await this.d.save(spec)
        this.log(`5/5 saved as "${name}" (it will be here next time too)`)
      } catch (e) {
        this.log(
          `could not save the dog (${e instanceof Error ? e.message : String(e)}): it will not be remembered`
        )
      }
      const secs = ((this.d.now() - t0) / 1000).toFixed(1)
      this.log(`done in ${secs} s: "${name}"`)
      this.say(4, `Meet ${name}!`, 100, { state: 'done', message: name })
      return { ok: true, spec, name }
    } finally {
      this.running = false
    }
  }

  /** The saved custom dog, repaired to be safe, or null. */
  async saved(): Promise<DogSpec | null> {
    try {
      const raw = await this.d.load()
      return raw ? normalizeSpec(raw) : null
    } catch {
      return null
    }
  }

  /** Forget the custom dog: back to the original. */
  async reset(): Promise<void> {
    await this.d.clear()
    this.log('back to the original dog (custom dog forgotten)')
  }
}
