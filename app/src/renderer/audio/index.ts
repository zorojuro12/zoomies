// Audio module entry (contract §3.8). Behaviour code asks for a player once and calls
// preload() at startup, then playSound(name, { pan, gain }) from events.
import type { AudioPlayer } from '@shared/audio'
import { StubAudio } from './stub-audio'
import { WebAudioPlayer } from './web-audio-player'

export { StubAudio, WebAudioPlayer }

/** The real player where Web Audio exists, otherwise the logging stub. */
export function createAudioPlayer(): AudioPlayer {
  return typeof AudioContext === 'undefined' ? new StubAudio() : new WebAudioPlayer()
}
