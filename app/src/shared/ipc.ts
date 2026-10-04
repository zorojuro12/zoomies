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
}

export type IpcChannel = keyof IpcChannels
