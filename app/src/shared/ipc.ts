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
}

export type IpcChannel = keyof IpcChannels
