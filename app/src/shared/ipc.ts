// §3.8 IPC channels — main ↔ renderer. Nothing else uses raw channel strings.
import type { Rect } from './geometry'
import type { ActivityEvent, WindowRect } from './os'
import type { InputEvent } from './input'

export interface IpcChannels {
  'os:windows': WindowRect[]
  'os:workArea': Rect
  'os:activity': ActivityEvent
  'os:setClickThrough': boolean
  'input:event': InputEvent
  'serial:status': { connected: boolean; port: string | null }
  'serial:buzzer': { preset: 'squeak' | 'chirp' }
  /** invoke: renderer sends the text, main answers with a command name, 'none' or 'error' (D2, Gemini). */
  'command:interpret': string
  /** invoke: a push-to-talk recording in, the words heard out ('' = nothing heard or it failed) (D3, ElevenLabs). */
  'speech:transcribe': { audio: Uint8Array; mime: string }
  /** invoke (no payload): pick a photo and make a new dog from it -> NewDogResult (right-click menu). */
  'dog:new': undefined
  /** main -> renderer: where the new dog is up to. */
  'dog:progress': NewDogProgress
  /** invoke: the saved custom dog spec (or null). */
  'dog:saved': undefined
  /** invoke: forget the saved custom dog (back to the original). */
  'dog:reset': undefined
}

/** What the "Making your dog…" card shows. `steps` is the whole list, `current` the one being done (0-based). */
export interface NewDogProgress {
  steps: readonly string[]
  current: number
  detail: string
  percent: number
  state: 'running' | 'done' | 'error'
  /** On `done`: the dog's name. On `error`: what went wrong, in plain words. */
  message?: string
}

/** The answer to 'dog:new'. `spec` is a dog spec (validated by the renderer's buildDog). */
export type NewDogResult =
  { ok: true; spec: unknown; name: string } | { ok: false; cancelled?: boolean; message: string }

export type IpcChannel = keyof IpcChannels
