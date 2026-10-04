import { app, shell, BrowserWindow, Tray, Menu } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { sendTo, registerIpc, registerDogIpc } from './ipc-main'
import { createNewDogFlow } from './services/new-dog-main'
import { loadDotenvFiles } from './services/dotenv'
import { transcribe } from './services/elevenlabs-stt'
import { interpretCommand } from './services/gemini-command'
import { createSerialDriver } from './hardware/serial-driver'
import { startSerialService } from './hardware/serial-service'
import { createOsLayer } from './os/create-os-layer'
import { WindowsOsLayer } from './os/windows-os-layer'
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

// Dev: pick up the API keys from the gitignored .env (never overrides real environment variables).
loadDotenvFiles(process.env)

function createTray(): void {
  tray = new Tray(icon)
  tray.setToolTip('Zoomies')
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Quit Zoomies', click: () => app.quit() }]))
}

function createMainWindow(): void {
  const overlay = isOverlayMode()
  const win = createAppWindow({ overlay, debug: process.env.ZOOMIES_DEBUG === '1' })

  // ZOOMIES_LOG_RENDERER=1: print the page's console in this terminal (dev debugging).
  if (process.env.ZOOMIES_LOG_RENDERER === '1')
    win.webContents.on('console-message', (e) => console.log(`[page] ${e.message}`))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // The microphone is the only permission the window may ask for (push-to-talk, held-button only).
  win.webContents.session.setPermissionRequestHandler((_wc, permission, done) =>
    done(permission === 'media')
  )
  const os = createOsLayer(overlay)
  // The controller (Arduino): its input and connection status go to the window; the dog's buzzer
  // requests come back. Does nothing, quietly, when no board or no serialport module is there.
  const serial = startSerialService({
    driver: createSerialDriver((m) => console.log(`[serial] ${m}`)),
    env: process.env,
    sendInput: (e) => sendTo(win, 'input:event', e),
    sendStatus: (s) => sendTo(win, 'serial:status', s)
  })
  app.on('will-quit', () => serial.stop())
  // "Upload new dog…": pick a photo, make a dog from it, remember it (progress goes to the screen and this terminal).
  registerDogIpc(createNewDogFlow(win))
  registerIpc(
    os,
    serial.buzz,
    () => serial.reader?.status ?? { connected: false, port: null },
    // free text -> one of the dog's commands (Gemini function calling; 'error' = use the word list)
    (text) =>
      interpretCommand(text, {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || undefined
      }),
    // a push-to-talk recording -> the words (ElevenLabs); '' = nothing heard or it failed
    async (audio, mime) =>
      (await transcribe(audio, mime, { apiKey: process.env.ELEVENLABS_API_KEY })) ?? ''
  )
  if (os instanceof WindowsOsLayer) {
    os.start(
      win,
      (windows) => sendTo(win, 'os:windows', windows),
      (workArea) => sendTo(win, 'os:workArea', workArea)
    )
  }

  const stopActivity = os.onActivity((activity) => sendTo(win, 'os:activity', activity))
  app.on('will-quit', stopActivity)
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
