// §3.8 Audio — Abel owns the module (renderer/audio/); Ansh calls playSound from behaviour.
// SoundName = file stem without the variant suffix: assets/sounds/<name>_<n>.mp3 (n = 1..3).

export const SOUND_NAMES = [
  'bark_happy',
  'bark_alert',
  'yip_excited',
  'whine',
  'pant',
  'yawn',
  'snore',
  'sneeze',
  'sigh',
  'paw_step',
  'ball_bounce',
  'ball_squeak'
] as const

export type SoundName = (typeof SOUND_NAMES)[number]

export interface PlaySoundOptions {
  /** -1 (left) .. 1 (right). */
  pan?: number
  /** 0..1. */
  gain?: number
  loop?: boolean
}

export interface AudioPlayer {
  preload(): Promise<void>
  playSound(name: SoundName, opts?: PlaySoundOptions): void
  stop(name: SoundName): void
}
