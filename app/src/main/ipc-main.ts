// Typed IPC bridge (Task 3 of a-p1-overlay.md). Channel names and payload shapes only ever come
// from `@shared/ipc` — nobody else touches raw channel strings.
import { ipcMain, type BrowserWindow } from 'electron'
import type { IpcChannel, IpcChannels, NewDogResult } from '@shared/ipc'
import type { OsLayer } from '@shared/os'
import type { BuzzerPreset } from '@shared/serial'
import type { SerialStatus } from './hardware/serial-reader'

export function sendTo<C extends IpcChannel>(
  win: BrowserWindow,
  channel: C,
  payload: IpcChannels[C]
): void {
  win.webContents.send(channel, payload)
}

export function registerIpc(
  os: OsLayer,
  onBuzz: (preset: BuzzerPreset) => void = () => {},
  getSerialStatus: () => SerialStatus = () => ({ connected: false, port: null }),
  interpret: (text: string) => Promise<string> = async () => 'error',
  transcribeAudio: (audio: Uint8Array, mime: string) => Promise<string> = async () => ''
): void {
  ipcMain.handle('speech:transcribe', (_e, v: unknown) => {
    const { audio, mime } = (v ?? {}) as { audio?: unknown; mime?: unknown }
    return audio instanceof Uint8Array && typeof mime === 'string'
      ? transcribeAudio(audio, mime)
      : ''
  })
  ipcMain.handle('command:interpret', (_e, v: unknown) =>
    typeof v === 'string' ? interpret(v) : 'error'
  )
  ipcMain.handle('serial:status', () => getSerialStatus())
  ipcMain.on('serial:buzzer', (_e, v: unknown) => {
    const p = (v as { preset?: unknown } | null)?.preset
    if (p === 'squeak' || p === 'chirp') onBuzz(p)
  })
  ipcMain.on('os:setClickThrough', (_e, v: unknown) => {
    if (typeof v === 'boolean') os.setClickThrough(v)
  })
  ipcMain.handle('os:windows', () => os.getWindows())
  ipcMain.handle('os:workArea', () => os.getWorkArea())
}

/** The right-click "Upload new dog…" actions (E2). */
export function registerDogIpc(flow: {
  run(): Promise<NewDogResult>
  saved(): Promise<unknown>
  reset(): Promise<void>
}): void {
  ipcMain.handle('dog:new', () => flow.run())
  ipcMain.handle('dog:saved', () => flow.saved())
  ipcMain.handle('dog:reset', () => flow.reset())
}
