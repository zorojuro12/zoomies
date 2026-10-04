// Lane A — the overlay BrowserWindow (Windows) and its windowed fallback (Mac/WSL, or ZOOMIES_WINDOWED=1).
import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

export function isOverlayMode(): boolean {
  return process.platform === 'win32' && process.env.ZOOMIES_WINDOWED !== '1'
}

function buildQuery(opts: { overlay: boolean; debug: boolean }): string {
  const params = new URLSearchParams()
  if (opts.overlay) params.set('overlay', '1')
  if (opts.debug) params.set('debug', '1')
  // ZOOMIES_BEHAVIOUR=0 turns the dog's personality off (the host acts exactly like P1);
  // ZOOMIES_DEMO=1 uses short timers (idle 8 s, asleep 20 s, break 90 s) so a demo can show sleep and wake.
  if (process.env.ZOOMIES_BEHAVIOUR === '0') params.set('behaviour', '0')
  if (process.env.ZOOMIES_DEMO === '1') params.set('demo', '1')
  // ZOOMIES_MUTE=1 starts with the dog's sounds off.
  if (process.env.ZOOMIES_MUTE === '1') params.set('mute', '1')
  return params.toString()
}

function createOverlayWindow(): BrowserWindow {
  const bounds = screen.getPrimaryDisplay().bounds
  const win = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setIgnoreMouseEvents(true, { forward: true })
    win.showInactive()
  })

  const followDisplay = (): void => {
    if (win.isDestroyed()) return
    win.setBounds(screen.getPrimaryDisplay().bounds)
  }
  screen.on('display-metrics-changed', followDisplay)
  screen.on('display-added', followDisplay)
  screen.on('display-removed', followDisplay)
  win.once('closed', () => {
    screen.removeListener('display-metrics-changed', followDisplay)
    screen.removeListener('display-added', followDisplay)
    screen.removeListener('display-removed', followDisplay)
  })

  return win
}

function createWindowedWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'Zoomies',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  return win
}

export function createAppWindow(opts: { overlay: boolean; debug: boolean }): BrowserWindow {
  const win = opts.overlay ? createOverlayWindow() : createWindowedWindow()

  if (process.env.ZOOMIES_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  const query = buildQuery(opts)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    win.loadURL(query ? `${base}/?${query}` : base)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), query ? { search: query } : undefined)
  }

  return win
}
