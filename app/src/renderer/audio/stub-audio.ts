// StubAudio — logs sound names until Abel's audio module lands (contract §3.8).
import type { AudioPlayer, PlaySoundOptions, SoundName } from '@shared/audio'

export class StubAudio implements AudioPlayer {
  preload(): Promise<void> {
    return Promise.resolve()
  }

  playSound(name: SoundName, opts?: PlaySoundOptions): void {
    console.debug(`[audio stub] ${name}`, opts ?? {})
  }

  stop(name: SoundName): void {
    console.debug(`[audio stub] stop ${name}`)
  }
}
