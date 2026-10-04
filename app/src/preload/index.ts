import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, WindowRect } from '@shared/os'
import type { InputEvent } from '@shared/input'
import type { BuzzerPreset } from '@shared/serial'

// Custom APIs for renderer
const api = {}

// Typed bridge over `@shared/ipc` channels (Task 3 of a-p1-overlay.md). The renderer never sees
// raw `ipcRenderer` — only this shaped API.
const zoomies = {
  getWindows: (): Promise<WindowRect[]> => ipcRenderer.invoke('os:windows'),
  getWorkArea: (): Promise<Rect> => ipcRenderer.invoke('os:workArea'),
  onWindows: (cb: (w: WindowRect[]) => void): (() => void) => {
    const listener = (_e: unknown, w: WindowRect[]): void => cb(w)
    ipcRenderer.on('os:windows', listener)
    return () => ipcRenderer.removeListener('os:windows', listener)
  },
  onWorkArea: (cb: (r: Rect) => void): (() => void) => {
    const listener = (_e: unknown, r: Rect): void => cb(r)
    ipcRenderer.on('os:workArea', listener)
    return () => ipcRenderer.removeListener('os:workArea', listener)
  },
  onActivity: (cb: (e: ActivityEvent) => void): (() => void) => {
    const listener = (_e: unknown, ev: ActivityEvent): void => cb(ev)
    ipcRenderer.on('os:activity', listener)
    return () => ipcRenderer.removeListener('os:activity', listener)
  },
  onInput: (cb: (e: InputEvent) => void): (() => void) => {
    const listener = (_e: unknown, ev: InputEvent): void => cb(ev)
    ipcRenderer.on('input:event', listener)
    return () => ipcRenderer.removeListener('input:event', listener)
  },
  onSerialStatus: (cb: (s: { connected: boolean; port: string | null }) => void): (() => void) => {
    const listener = (_e: unknown, s: { connected: boolean; port: string | null }): void => cb(s)
    ipcRenderer.on('serial:status', listener)
    return () => ipcRenderer.removeListener('serial:status', listener)
  },
  getSerialStatus: (): Promise<{ connected: boolean; port: string | null }> =>
    ipcRenderer.invoke('serial:status'),
  transcribe: (audio: Uint8Array, mime: string): Promise<string> =>
    ipcRenderer.invoke('speech:transcribe', { audio, mime }),
  interpret: (text: string): Promise<string> => ipcRenderer.invoke('command:interpret', text),
  buzz: (preset: BuzzerPreset): void => {
    ipcRenderer.send('serial:buzzer', { preset })
  },
  setClickThrough: (enabled: boolean): void => {
    ipcRenderer.send('os:setClickThrough', enabled)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('zoomies', zoomies)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.zoomies = zoomies
}
