import type { OsLayer } from '@shared/os'
import { StubOsLayer } from './stub-os-layer'
import { WindowsOsLayer } from './windows-os-layer'

export function createOsLayer(overlay: boolean): OsLayer {
  return overlay && process.platform === 'win32' ? new WindowsOsLayer() : new StubOsLayer()
}
