import { app, shell, BrowserWindow, Tray, Menu } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createAppWindow, isOverlayMode } from './overlay-window'

let tray: Tray | null = null

async function logActiveGpu(): Promise<void> {
  const info = (await app.getGPUInfo('complete')) as {
    gpuDevice?: Array<{ active?: boolean; vendorId?: number; deviceId?: number }>
  }
  const active = info.gpuDevice?.find((d) => d.active)
  if (active) {
    const vendor = active.vendorId?.toString(16) ?? '?'
    const device = active.deviceId?.toString(16) ?? '?'
    console.log(`[gpu] active device vendor=0x${vendor} device=0x${device}`)
  } else {
    console.log('[gpu] no active device reported')
  }
}

function createTray(): void {
  tray = new Tray(icon)
  tray.setToolTip('Zoomies')
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Quit Zoomies', click: () => app.quit() }]))
}

function createMainWindow(): void {
  const overlay = isOverlayMode()
  const win = createAppWindow({ overlay, debug: process.env.ZOOMIES_DEBUG === '1' })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.zoomies.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  void logActiveGpu()
  if (isOverlayMode()) createTray()
  createMainWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
