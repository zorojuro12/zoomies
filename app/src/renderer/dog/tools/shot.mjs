/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain JS dev tool, no TS types */
// Screenshot harness (Lane B dev tool, not part of the app bundle).
// Opens the dog preview page in a hidden Electron window, clicks buttons by label, waits,
// and saves a PNG — so Claude can look at the dog without a human describing it.
//
// Run from app/ while `npm run dev` is running:
//   node_modules/.bin/electron src/renderer/dog/tools/shot.mjs --out /tmp/stand.png
//   node_modules/.bin/electron src/renderer/dog/tools/shot.mjs --click sit --wait 900 --out sit.png
//   node_modules/.bin/electron src/renderer/dog/tools/shot.mjs --click "run ↔" --wait 700 --zoom 2 --out run.png
//
// Flags:
//   --url    page to load (default http://localhost:5174/preview.html — check the dev log for the port)
//   --click  button label(s) to click in order, comma separated (e.g. "sit" or "ball,run ↔");
//            "wait:1500" pauses 1500 ms between clicks (e.g. "walk ↑,wait:1600,walk ↓")
//   --eval   JavaScript to run in the page after the clicks (e.g. drive an editor slider), then 300 ms
//   --bench  N: instead of a screenshot, time N frames with the 60 FPS lock OFF and print ms/frame
//            (so a 4 ms dog and a 15 ms dog stop looking identical). Use --zoom to change the dog's size.
//   --wait   ms to wait after the last click before the shot (default 800)
//   --zoom   page zoom factor, makes the small dog bigger (default 1)
//   --stub   1 = run the real app host (index.html) with a fake window.zoomies; inject activity with
//            --eval "window.__stub.emit({kind:'idle',seconds:25})"
//   --size   WxH of the window in CSS px (default 900x600)
//   --out    where to write the PNG (required)
import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const url = arg('url', 'http://localhost:5174/preview.html')
const clicks = arg('click', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const evalJs = arg('eval', '')
const bench = Number(arg('bench', '0'))
// --stub 1: run the real app host (index.html) with a fake `window.zoomies` (no OS layer needed)
const stub = arg('stub', '') === '1'
const waitMs = Number(arg('wait', '800'))
const zoom = Number(arg('zoom', '1'))
const [width, height] = arg('size', '900x600').split('x').map(Number)
const out = arg('out', '')
if (!out && !bench) {
  console.error('missing --out <file.png>')
  app.exit(2)
}

if (bench) {
  app.commandLine.appendSwitch('disable-gpu-vsync')
  app.commandLine.appendSwitch('disable-frame-rate-limit')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  // show:false keeps it out of the way; the page still renders and we can capture it.
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      ...(stub ? { preload: fileURLToPath(new URL('./zoomies-stub-preload.cjs', import.meta.url)) } : {})
    }
  })
  win.webContents.on('console-message', (event) => {
    // Show page errors/warnings only (level: 'warning' | 'error').
    if (event.level === 'warning' || event.level === 'error') console.error('[page]', event.message)
  })
  await win.loadURL(url)
  win.webContents.setZoomFactor(zoom)
  await sleep(600) // let the dog file load and the first frames draw

  for (const label of clicks) {
    if (label.startsWith('wait:')) {
      await sleep(Number(label.slice(5)))
      continue
    }
    const found = await win.webContents.executeJavaScript(
      `(() => {
        const b = [...document.querySelectorAll('#panel button')].find((x) => x.textContent === ${JSON.stringify(label)})
        if (!b) return false
        b.click()
        return true
      })()`
    )
    if (!found) console.error(`button not found: ${label}`)
    await sleep(120)
  }
  if (evalJs) {
    await win.webContents.executeJavaScript(evalJs)
    await sleep(300)
  }
  await sleep(waitMs)

  if (bench) {
    const frames = await win.webContents.executeJavaScript(`new Promise((resolve) => {
      const dts = []
      let last = performance.now()
      const tick = (now) => {
        dts.push(now - last)
        last = now
        if (dts.length < ${bench} + 20) requestAnimationFrame(tick)
        else resolve(dts.slice(20)) // drop warm-up frames
      }
      requestAnimationFrame(tick)
    })`)
    frames.sort((a, b) => a - b)
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length
    const p95 = frames[Math.floor(frames.length * 0.95)]
    console.log(
      JSON.stringify({
        frames: frames.length,
        avgMs: +avg.toFixed(2),
        p95Ms: +p95.toFixed(2),
        fps: +(1000 / avg).toFixed(0)
      })
    )
    app.exit(0)
    return
  }

  const image = await win.webContents.capturePage()
  await writeFile(out, image.toPNG())
  const { width: w, height: h } = image.getSize()
  console.log(`saved ${out} (${w}x${h})`)
  app.exit(0)
})
