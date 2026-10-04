import { ElectronAPI } from '@electron-toolkit/preload'
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, WindowRect } from '@shared/os'

export interface ZoomiesApi {
  getWindows(): Promise<WindowRect[]>
  getWorkArea(): Promise<Rect>
  onWindows(cb: (w: WindowRect[]) => void): () => void
  onWorkArea(cb: (r: Rect) => void): () => void
  onActivity(cb: (e: ActivityEvent) => void): () => void
  setClickThrough(enabled: boolean): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    zoomies: ZoomiesApi
  }
}
