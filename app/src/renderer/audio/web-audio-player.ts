// The real audio player (contract §3.8): preloads assets/sounds/<name>_<n>.mp3, picks a random
// variant per play, pans/attenuates each sound, and loops snore/pant. Replaces StubAudio.
//
// Never throws or blocks the frame loop: loading is async, and a sound that has no files (yet) or
// hasn't finished loading is a silent no-op, so behaviour code can call playSound freely.
import { SOUND_NAMES, type AudioPlayer, type PlaySoundOptions, type SoundName } from '@shared/audio'
import { assetUrl } from '@shared/assets'
import { LOOPING_SOUNDS, clampGain, clampPan, pickVariant, variantPaths } from './audio-logic'

const FADE_OUT_S = 0.04 // short ramp on stop() so cutting a loop doesn't click

export interface WebAudioPlayerOptions {
  /** Create the AudioContext lazily (default: `new AudioContext()`). */
  createContext?: () => AudioContext
  /** Fetch a sound file's bytes; null if it doesn't exist. Default: fetch(urlFor(path)). */
  loadBytes?: (path: string) => Promise<ArrayBuffer | null>
  /** Map an asset path to a URL. Default: assetUrl (relative to the page). */
  urlFor?: (path: string) => string
  /** Random source for variant picking (tests inject a fixed one). */
  random?: () => number
}

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  pan: StereoPannerNode
  looping: boolean
}

export class WebAudioPlayer implements AudioPlayer {
  private ctx: AudioContext | null = null
  private preloading: Promise<void> | null = null
  private readonly buffers = new Map<SoundName, AudioBuffer[]>()
  private readonly lastVariant = new Map<SoundName, number>()
  private readonly voices = new Map<SoundName, Set<Voice>>()
  private readonly createContext: () => AudioContext
  private readonly loadBytes: (path: string) => Promise<ArrayBuffer | null>
  private readonly random: () => number

  constructor(options: WebAudioPlayerOptions = {}) {
    this.createContext = options.createContext ?? (() => new AudioContext())
    const urlFor = options.urlFor ?? assetUrl
    this.loadBytes = options.loadBytes ?? ((path) => fetchBytes(urlFor(path)))
    this.random = options.random ?? Math.random
  }

  /** Load and decode every variant that exists. Safe to call more than once. */
  preload(): Promise<void> {
    this.preloading ??= this.loadAll()
    return this.preloading
  }

  /** How many variants of a sound loaded (0 = none; playSound will be silent). */
  variantCount(name: SoundName): number {
    return this.buffers.get(name)?.length ?? 0
  }

  playSound(name: SoundName, opts?: PlaySoundOptions): void {
    if (!this.preloading) void this.preload() // first call before preload(): start loading
    const buffers = this.buffers.get(name)
    if (!buffers || buffers.length === 0) return

    const ctx = this.context()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)

    const looping = opts?.loop ?? LOOPING_SOUNDS.has(name)
    const pan = clampPan(opts?.pan)
    const gain = clampGain(opts?.gain)

    if (looping) {
      // One loop per sound: a repeated call just updates its pan/volume.
      for (const voice of this.voices.get(name) ?? []) {
        if (voice.looping) {
          voice.pan.pan.value = pan
          voice.gain.gain.value = gain
          return
        }
      }
    }

    const variant = pickVariant(buffers.length, this.lastVariant.get(name) ?? -1, this.random)
    this.lastVariant.set(name, variant)

    const source = ctx.createBufferSource()
    const gainNode = ctx.createGain()
    const panNode = ctx.createStereoPanner()
    source.buffer = buffers[variant] ?? null
    source.loop = looping
    gainNode.gain.value = gain
    panNode.pan.value = pan
    source.connect(gainNode)
    gainNode.connect(panNode)
    panNode.connect(ctx.destination)

    const voice: Voice = { source, gain: gainNode, pan: panNode, looping }
    let set = this.voices.get(name)
    if (!set) this.voices.set(name, (set = new Set()))
    set.add(voice)
    source.onended = () => {
      set.delete(voice)
      source.disconnect()
      gainNode.disconnect()
      panNode.disconnect()
    }
    source.start()
  }

  /** Stop every playing instance of a sound (fades out over ~40 ms). */
  stop(name: SoundName): void {
    const set = this.voices.get(name)
    if (!set || set.size === 0 || !this.ctx) return
    const now = this.ctx.currentTime
    for (const voice of [...set]) {
      set.delete(voice) // a play right after stop() must start a fresh voice, not this fading one
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
      voice.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S)
      voice.source.stop(now + FADE_OUT_S)
    }
  }

  private context(): AudioContext {
    this.ctx ??= this.createContext()
    return this.ctx
  }

  private async loadAll(): Promise<void> {
    const ctx = this.context()
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        const decoded = await Promise.all(
          variantPaths(name).map(async (path) => {
            const bytes = await this.loadBytes(path)
            if (!bytes) return null
            try {
              return await ctx.decodeAudioData(bytes)
            } catch {
              return null // not a real audio file (e.g. a dev-server HTML fallback) → skip
            }
          })
        )
        const loaded = decoded.filter((b): b is AudioBuffer => b !== null)
        if (loaded.length > 0) this.buffers.set(name, loaded)
        else console.debug(`[audio] no sound files found for ${name}`)
      })
    )
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}
