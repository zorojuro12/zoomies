// Sound cues (P2 Task 6 of docs/plans/a-p2-mvp-behaviour.md): which noise at which moment. It listens
// to the Behaviour's events and asks the audio player (Abel's, contract §3.8) to play sounds, panned
// to where the dog (or the ball) is, a little quieter the farther it is from your cursor, never
// spammed (a cooldown per sound), with the loops (snore, pant) started and stopped. Quiet by default:
// nothing plays at random, and the only ambient sound is snoring while asleep. No allocation per
// event or per frame (a small fixed queue for sounds scheduled a moment ahead).
import type { AudioPlayer, SoundName } from '@shared/audio'
import type { BehaviourEvent } from './behaviour'

/** The dog's sounds play at 70% of full volume: it must never startle anyone. */
export const VOLUME = 0.7
/** Panning stays a little short of hard left/right. */
const PAN_RANGE = 0.8
/** Across the whole screen from your cursor a sound is this much quieter (a factor of 0.5). */
const DISTANCE_DROP = 0.5

/** The shortest time between two plays of the same sound, in ms. */
export const COOLDOWN_MS: Record<SoundName, number> = {
  bark_happy: 1500,
  bark_alert: 2000,
  yip_excited: 1500,
  whine: 3000,
  yawn: 4000,
  sigh: 4000,
  sneeze: 3000,
  ball_squeak: 300,
  ball_bounce: 100,
  paw_step: 200,
  pant: 0,
  snore: 0
}

const PANT_MS = 4000
const SNORE_DELAY_MS = 1500
const GREET_YAWN_MS = 1300
const GREET_YIP_MS = 2800
const QUEUE_SIZE = 16

export interface CuesOptions {
  /** Screen width in px (for panning). */
  screenW: () => number
  /** Where the dog is now. */
  dogX: () => number
  /** Where the cursor is, or null if it has not moved yet. */
  cursorX: () => number | null
  muted?: boolean
}

interface PlayOpts {
  x?: number
  gain?: number
  loop?: boolean
}

interface Slot {
  used: boolean
  at: number
  kind: 'play' | 'stop'
  name: SoundName
  gain: number
  loop: boolean
}

export class SoundCues {
  private clock = 0
  private isMuted: boolean
  private readonly lastPlayed = new Map<SoundName, number>()
  private readonly queue: Slot[] = Array.from({ length: QUEUE_SIZE }, () => ({
    used: false,
    at: 0,
    kind: 'play' as const,
    name: 'bark_happy' as SoundName,
    gain: 1,
    loop: false
  }))

  constructor(
    private readonly player: AudioPlayer,
    private readonly opts: CuesOptions
  ) {
    this.isMuted = opts.muted ?? false
  }

  get muted(): boolean {
    return this.isMuted
  }

  /** Mute (also silences any loop that is playing and drops anything scheduled) or unmute. */
  setMuted(on: boolean): void {
    this.isMuted = on
    if (on) {
      this.player.stop('snore')
      this.player.stop('pant')
      for (const s of this.queue) s.used = false
    }
  }

  /** One event from the Behaviour. */
  handle(e: BehaviourEvent): void {
    if (this.isMuted) return
    switch (e.kind) {
      case 'fetch':
        if (e.note === 'launched') this.play('bark_happy')
        else if (e.note === 'bringing') this.play('bark_alert', { gain: 0.8 })
        else if (e.note === 'pickedUp') this.play('ball_squeak')
        else if (e.note === 'gaveUp') this.play('whine')
        else if (e.note === 'done') this.startPant()
        break
      case 'activity':
        if (e.note === 'wentIdle') {
          this.play('sigh')
        } else if (e.note === 'fellAsleep') {
          this.play('sigh')
          this.cancel('snore')
          this.schedule('play', 'snore', SNORE_DELAY_MS, 1, true)
        } else if (e.note === 'returned') {
          this.stopSnore()
        }
        break
      case 'reaction':
        if (e.phase === 'start') {
          if (e.id === 'greet') {
            this.schedule('play', 'yawn', GREET_YAWN_MS, 0.8)
            this.schedule('play', 'yip_excited', GREET_YIP_MS, 0.9)
          } else if (e.id === 'backspace') {
            this.play('whine', { gain: 0.6 })
          } else if (e.id === 'shake') {
            this.play('yip_excited')
          }
        } else if (e.id === 'sleep') {
          this.stopSnore()
        }
        break
      case 'pet':
        this.play('yip_excited', { gain: 0.7 })
        break
      case 'call':
        this.play('yip_excited', { gain: 0.8 })
        break
      case 'bounce':
        this.play('ball_bounce', { x: e.x, gain: 0.25 + 0.75 * e.strength })
        break
    }
  }

  /** Let `dtMs` pass: fires whatever was scheduled and has come due, in order. */
  update(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return
    this.clock += dtMs
    for (;;) {
      let next: Slot | null = null
      for (const s of this.queue)
        if (s.used && s.at <= this.clock && (!next || s.at < next.at)) next = s
      if (!next) return
      next.used = false
      if (this.isMuted) continue
      if (next.kind === 'stop') this.player.stop(next.name)
      else this.play(next.name, { gain: next.gain, loop: next.loop })
    }
  }

  // ---- internals ---------------------------------------------------------------------------

  private play(name: SoundName, o: PlayOpts = {}): void {
    if (this.isMuted) return
    const cooldown = COOLDOWN_MS[name]
    const last = this.lastPlayed.get(name)
    if (cooldown > 0 && last !== undefined && this.clock - last < cooldown) return
    this.lastPlayed.set(name, this.clock)

    const w = Math.max(1, this.opts.screenW())
    const x = o.x ?? this.opts.dogX()
    const side = Math.min(1, Math.max(0, x / w)) * 2 - 1
    const cursor = this.opts.cursorX()
    const proximity =
      cursor === null ? 1 : 1 - DISTANCE_DROP * Math.min(1, Math.abs(x - cursor) / w)
    const gain = VOLUME * (o.gain ?? 1) * proximity
    if (o.loop) this.player.playSound(name, { pan: side * PAN_RANGE, gain, loop: true })
    else this.player.playSound(name, { pan: side * PAN_RANGE, gain })
  }

  private startPant(): void {
    this.play('pant', { loop: true })
    this.cancel('pant') // a second finished fetch restarts the 4 seconds
    this.schedule('stop', 'pant', PANT_MS, 1)
  }

  private stopSnore(): void {
    this.cancel('snore')
    this.player.stop('snore')
  }

  private schedule(
    kind: 'play' | 'stop',
    name: SoundName,
    delayMs: number,
    gain: number,
    loop = false
  ): void {
    for (const s of this.queue) {
      if (s.used) continue
      s.used = true
      s.at = this.clock + delayMs
      s.kind = kind
      s.name = name
      s.gain = gain
      s.loop = loop
      return
    }
    // queue full (cannot happen with the handful of cues above): drop it rather than grow
  }

  /** Forget anything scheduled for this sound. */
  private cancel(name: SoundName): void {
    for (const s of this.queue) if (s.used && s.name === name) s.used = false
  }
}
