// Dog-only extras (P2 Task 4): moods and idle tricks exist on our SDF dog but are not part of the
// DogController contract. Behaviour code reaches them through this one optional interface, so it
// works unchanged with the placeholder dog or a test fake (the missing ones are silent no-ops).
import type { DogController } from '@shared/dog-controller'
import type { IdleName } from '../dog/motion/idles'
import type { MoodName } from '../dog/motion/mood'

export interface DogExtras {
  setMood(name: MoodName, intensity?: number): void
  playIdle(name: IdleName): Promise<void>
}

export function asExtras(dog: DogController): DogExtras {
  const d = dog as Partial<DogExtras>
  return {
    setMood: (name, intensity) => d.setMood?.(name, intensity),
    playIdle: (name) => d.playIdle?.(name) ?? Promise.resolve()
  }
}
