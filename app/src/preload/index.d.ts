import { ElectronAPI } from '@electron-toolkit/preload'
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, WindowRect } from '@shared/os'
import type { InputEvent } from '@shared/input'
import type { BuzzerPreset } from '@shared/serial'

export interface ZoomiesApi {
  getWindows(): Promise<WindowRect[]>
  getWorkArea(): Promise<Rect>
  onWindows(cb: (w: WindowRect[]) => void): () => void
  onWorkArea(cb: (r: Rect) => void): () => void
  onActivity(cb: (e: ActivityEvent) => void): () => void
  onInput(cb: (e: InputEvent) => void): () => void
  onSerialStatus(cb: (s: { connected: boolean; port: string | null }) => void): () => void
  getSerialStatus(): Promise<{ connected: boolean; port: string | null }>
  buzz(preset: BuzzerPreset): void
  setClickThrough(enabled: boolean): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    zoomies: ZoomiesApi
  }
}
