// Typed IPC bridge (Task 3 of a-p1-overlay.md). Channel names and payload shapes only ever come
// from `@shared/ipc` — nobody else touches raw channel strings.
import { ipcMain, type BrowserWindow } from 'electron'
import type { IpcChannel, IpcChannels } from '@shared/ipc'
import type { OsLayer } from '@shared/os'

export function sendTo<C extends IpcChannel>(
  win: BrowserWindow,
  channel: C,
  payload: IpcChannels[C]
): void {
  win.webContents.send(channel, payload)
}

export function registerIpc(os: OsLayer): void {
  ipcMain.on('os:setClickThrough', (_e, v: unknown) => {
    if (typeof v === 'boolean') os.setClickThrough(v)
  })
  ipcMain.handle('os:windows', () => os.getWindows())
  ipcMain.handle('os:workArea', () => os.getWorkArea())
}
