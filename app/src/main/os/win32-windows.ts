// Win32/DWM glue (Task 4 of a-p1-overlay.md): koffi FFI, loaded dynamically and only ever
// imported on win32. This file has no logic of its own to unit-test — it just turns Win32 calls
// into `RawWindow[]`; all the filtering/z-order logic that IS tested lives in `window-list.ts`.
import type { RawWindow } from './window-list'

const GWL_EXSTYLE = -20
const WS_EX_TOOLWINDOW = 0x80
const DWMWA_EXTENDED_FRAME_BOUNDS = 9
const DWMWA_CLOAKED = 14
const MAX_TITLE_CHARS = 512

// Minimal shape of what we use from koffi — avoids depending on its full type surface here.
interface Koffi {
  load(path: string): {
    func(definition: string): (...args: unknown[]) => unknown
  }
  proto(definition: string): unknown
  pointer(type: unknown): unknown
  struct(name: string, def: Record<string, string>): { size: number }
  register(fn: (...args: unknown[]) => unknown, type: unknown): bigint
  unregister(ptr: bigint): void
  decode(value: unknown, type: unknown, len?: number): unknown
}

async function loadKoffi(): Promise<Koffi> {
  const mod = (await import('koffi')) as unknown as { default?: Koffi }
  return (mod.default ?? (mod as unknown)) as Koffi
}

/** koffi's int64/intptr returns are `number` for small values, `bigint` for large ones. */
function toBigInt(v: unknown): bigint {
  return typeof v === 'bigint' ? v : BigInt(v as number)
}

type NativeFn = (...args: unknown[]) => unknown

interface Native {
  koffi: Koffi
  EnumWindows: NativeFn
  EnumWindowsProc: unknown
  IsWindowVisible: NativeFn
  IsIconic: NativeFn
  GetWindowTextW: NativeFn
  GetWindowLongPtrW: NativeFn
  DwmGetWindowAttribute: NativeFn
  RECT: { size: number }
}

// koffi's proto()/struct() register named types globally — defining them more than once throws
// "Duplicate type name". Build everything exactly once and reuse it on every poll.
let nativePromise: Promise<Native> | null = null

async function getNative(): Promise<Native> {
  nativePromise ??= (async (): Promise<Native> => {
    const koffi = await loadKoffi()
    const user32 = koffi.load('user32.dll')
    const dwmapi = koffi.load('dwmapi.dll')

    const EnumWindowsProc = koffi.proto(
      'bool __stdcall EnumWindowsProc(uintptr_t hwnd, intptr_t lParam)'
    )
    const EnumWindows = user32.func(
      'bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr_t lParam)'
    )
    const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(uintptr_t hWnd)')
    const IsIconic = user32.func('bool __stdcall IsIconic(uintptr_t hWnd)')
    const GetWindowTextW = user32.func(
      'int __stdcall GetWindowTextW(uintptr_t hWnd, char16_t *lpString, int nMaxCount)'
    )
    const GetWindowLongPtrW = user32.func(
      'intptr_t __stdcall GetWindowLongPtrW(uintptr_t hWnd, int nIndex)'
    )
    const DwmGetWindowAttribute = dwmapi.func(
      'long __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t dwAttribute, void *pvAttribute, uint32_t cbAttribute)'
    )
    const RECT = koffi.struct('RECT', {
      left: 'int32',
      top: 'int32',
      right: 'int32',
      bottom: 'int32'
    })

    return {
      koffi,
      EnumWindows,
      EnumWindowsProc,
      IsWindowVisible,
      IsIconic,
      GetWindowTextW,
      GetWindowLongPtrW,
      DwmGetWindowAttribute,
      RECT
    }
  })()
  return nativePromise
}

export async function listRawWindows(): Promise<RawWindow[]> {
  const n = await getNative()

  const windows: RawWindow[] = []
  const titleBuf = Buffer.alloc(MAX_TITLE_CHARS * 2)
  const rectBuf = Buffer.alloc(n.RECT.size)
  const cloakedBuf = Buffer.alloc(4)

  const onWindow = (hwndRaw: unknown): boolean => {
    const hwnd = toBigInt(hwndRaw)
    const titleLen = n.GetWindowTextW(hwnd, titleBuf, MAX_TITLE_CHARS) as number
    const title = titleLen > 0 ? String(n.koffi.decode(titleBuf, 'char16_t', titleLen)) : ''

    const visible = Boolean(n.IsWindowVisible(hwnd))
    const minimized = Boolean(n.IsIconic(hwnd))
    const exStyle = toBigInt(n.GetWindowLongPtrW(hwnd, GWL_EXSTYLE))
    const toolWindow = (exStyle & BigInt(WS_EX_TOOLWINDOW)) !== 0n

    const boundsHr = n.DwmGetWindowAttribute(
      hwnd,
      DWMWA_EXTENDED_FRAME_BOUNDS,
      rectBuf,
      n.RECT.size
    ) as number
    const rect =
      boundsHr === 0
        ? (n.koffi.decode(rectBuf, n.RECT) as {
            left: number
            top: number
            right: number
            bottom: number
          })
        : { left: 0, top: 0, right: 0, bottom: 0 }

    const cloakedHr = n.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakedBuf, 4) as number
    const cloaked = cloakedHr === 0 && cloakedBuf.readUInt32LE(0) !== 0

    windows.push({
      id: hwnd.toString(),
      title,
      visible,
      minimized,
      cloaked,
      toolWindow,
      rect: {
        x: rect.left,
        y: rect.top,
        w: rect.right - rect.left,
        h: rect.bottom - rect.top
      }
    })
    return true // keep enumerating
  }

  const callback = n.koffi.register(onWindow, n.koffi.pointer(n.EnumWindowsProc))
  try {
    n.EnumWindows(callback, 0n)
  } finally {
    n.koffi.unregister(callback)
  }

  return windows
}
