// Buzzer cues (P3 serial, phase A): when the dog should make the controller's little buzzer go.
// A squeak when it picks up the ball (the catch comes with the mid-air catch), a chirp on each real
// bounce, at most 4 a second. This only decides WHEN: the serial writer turns a preset into the
// `S:squeak` / `S:chirp` line the Arduino understands (contract §3.7). No allocation per event.
import type { BuzzerPreset } from '@shared/serial'
import type { BehaviourEvent } from './behaviour'

export const BUZZER = {
  /** Bounces softer than this (the ball settling) stay silent. */
  minBounceStrength: 0.2,
  /** At most one chirp this often (4 a second). */
  chirpGapMs: 250,
  /** A squeak lasts about a tenth of a second on the board; do not stack them. */
  squeakGapMs: 150
}

export class BuzzerCues {
  private clock = 0
  private enabled = true
  private lastChirp = Number.NEGATIVE_INFINITY
  private lastSqueak = Number.NEGATIVE_INFINITY

  constructor(private readonly send: (preset: BuzzerPreset) => void) {}

  /** Off when no controller is connected (or muted): nothing is sent. */
  setEnabled(on: boolean): void {
    this.enabled = on
  }

  handle(e: BehaviourEvent): void {
    if (!this.enabled) return
    if (e.kind === 'fetch' && e.note === 'pickedUp') {
      if (this.clock - this.lastSqueak < BUZZER.squeakGapMs) return
      this.lastSqueak = this.clock
      this.send('squeak')
    } else if (e.kind === 'bounce' && e.strength >= BUZZER.minBounceStrength) {
      if (this.clock - this.lastChirp < BUZZER.chirpGapMs) return
      this.lastChirp = this.clock
      this.send('chirp')
    }
  }

  update(dtMs: number): void {
    if (Number.isFinite(dtMs) && dtMs > 0) this.clock += dtMs
  }
}
