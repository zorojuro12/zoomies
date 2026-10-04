// New-dog flow (E2): the real Electron parts, kept thin so the flow itself stays testable with fakes.
// File picker (dialog), reading and shrinking the photo (nativeImage, no extra libraries), saving the
// dog under the app's user-data folder, and the Gemini call with the key from the environment.
import { app, dialog, nativeImage } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import { NewDogFlow } from './new-dog-flow'
import type { FlowDeps } from './new-dog-flow'
import { askGemini } from './dog-from-photo'
import { bgraToRgb } from './photo-colors'
import { sendTo } from '../ipc-main'

/** The longest side of the photo we send to Gemini (px): plenty to see a dog, small and quick to upload. */
const SEND_PX = 1024
/** The longest side used for matching colours (px). */
const COLOUR_PX = 160

function resized(img: Electron.NativeImage, longest: number): Electron.NativeImage {
  const { width, height } = img.getSize()
  const scale = Math.max(width, height) / longest
  if (scale <= 1) return img
  return img.resize({
    width: Math.round(width / scale),
    height: Math.round(height / scale),
    quality: 'good'
  })
}

/** Where the custom dog is remembered between launches. */
export function customDogPath(): string {
  return join(app.getPath('userData'), 'custom-dog.spec.json')
}

export function createNewDogFlow(
  win: BrowserWindow,
  log: (m: string) => void = console.log
): NewDogFlow {
  const file = customDogPath()
  const deps: FlowDeps = {
    pick: async () => {
      // ZOOMIES_NEWDOG_PHOTO=/path/to/photo.jpg skips the file picker (testing, and a demo safety net)
      if (process.env.ZOOMIES_NEWDOG_PHOTO) return process.env.ZOOMIES_NEWDOG_PHOTO
      const r = await dialog.showOpenDialog({
        title: 'Pick a photo of your dog',
        properties: ['openFile'],
        filters: [{ name: 'Photos', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }]
      })
      return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
    },
    readFile: async (p) => new Uint8Array(await readFile(p)),
    prepare: (bytes) => {
      const img = nativeImage.createFromBuffer(Buffer.from(bytes))
      if (img.isEmpty()) return null
      const send = resized(img, SEND_PX)
      const small = resized(img, COLOUR_PX)
      const { width, height } = small.getSize()
      return {
        jpeg: new Uint8Array(send.toJPEG(88)),
        pixels: bgraToRgb(new Uint8Array(small.toBitmap()), width, height)
      }
    },
    ask: (image, mime, signal) =>
      askGemini(image, mime, {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || undefined,
        signal
      }),
    save: async (spec) => {
      await mkdir(join(file, '..'), { recursive: true })
      await writeFile(file, JSON.stringify(spec, null, 2), 'utf8')
    },
    load: async () => {
      try {
        return JSON.parse(await readFile(file, 'utf8')) as unknown
      } catch {
        return null // nothing saved yet
      }
    },
    clear: async () => {
      await rm(file, { force: true })
    },
    progress: (p) => {
      if (!win.isDestroyed()) sendTo(win, 'dog:progress', p)
    },
    log,
    now: () => Date.now()
  }
  return new NewDogFlow(deps)
}
