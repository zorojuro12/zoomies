// App host (CP0): renders our dog (the Aussie, via createDog) in a normal window. Click to make it run there;
// it watches the cursor. Lane A turns this into the transparent overlay in P1.
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, WindowRect } from '@shared/os'
import { createDog } from './dog/create-dog'
import { ClickThroughGate } from './host/click-through'
import { FrameStats } from './host/frame-stats'
import { Hud } from './host/hud'
import { createRenderContext } from './host/scene'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLDivElement

// ?overlay=1 (set by the main process) means we're the real transparent desktop overlay on
// Windows: no click-to-call (clicks pass through), and the ground sits on the real work area's
// bottom edge. Without it, this is the windowed host (Mac/WSL dev, or ZOOMIES_WINDOWED=1), where
// the window is a small fixed-size preview box, not the real desktop.
const searchParams = new URLSearchParams(window.location.search)
const overlay = searchParams.get('overlay') === '1'
// ?debug=1 (ZOOMIES_DEBUG=1): patrol back and forth (Task 1 Checkpoint 2) and draw a 1px outline
// of every window rect from the OS layer (Task 4 Checkpoint 3) — proves the real/stub window list
// is wired up; replaced by `world-view.ts` in Task 6.
const debug = searchParams.get('debug') === '1'
document.body.style.background = overlay ? 'transparent' : '#1d2a33'

function createDebugCanvas(): CanvasRenderingContext2D | null {
  if (!debug) return null
  const el = document.createElement('canvas')
  el.width = window.innerWidth
  el.height = window.innerHeight
  el.style.position = 'fixed'
  el.style.inset = '0'
  el.style.pointerEvents = 'none'
  document.body.appendChild(el)
  return el.getContext('2d')
}

function drawWindowOutlines(
  ctx: CanvasRenderingContext2D | null,
  windows: readonly WindowRect[]
): void {
  if (!ctx) return
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 1
  for (const w of windows) {
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1)
  }
}

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)

  let workArea: Rect | null = await window.zoomies.getWorkArea()
  const groundY = (): number =>
    overlay && workArea ? workArea.y + workArea.h : window.innerHeight - (overlay ? 48 : 40)

  const debugCtx = createDebugCanvas()
  const hud = new Hud(status)

  const onWindowsUpdate = (windows: readonly WindowRect[]): void => {
    hud.set('world', `${windows.length} windows`)
    drawWindowOutlines(debugCtx, windows)
  }
  onWindowsUpdate(await window.zoomies.getWindows())
  window.zoomies.onWindows(onWindowsUpdate)
  window.zoomies.onWorkArea((wa) => {
    workArea = wa
  })

  let kps = 0
  let backspaceRatio = 0
  let mouseSpeed = 0
  let idleSeconds = 0
  const updateActivityHud = (): void => {
    hud.set(
      'activity',
      `${kps.toFixed(1)} kps · bs ${backspaceRatio.toFixed(2)} · mouse ${mouseSpeed.toFixed(0)} px/s · idle ${idleSeconds.toFixed(0)}s`
    )
  }
  window.zoomies.onActivity((e: ActivityEvent) => {
    if (e.kind === 'typing') {
      kps = e.keysPerSec
      backspaceRatio = e.backspaceRatio
    } else if (e.kind === 'mouse') {
      mouseSpeed = e.speed
    } else {
      idleSeconds = e.seconds
    }
    updateActivityHud()
  })
  updateActivityHud()

  // createDog never leaves the host without a dog: bad spec file -> default dog; SDF dog fails to
  // start -> the placeholder (see dog/create-dog.ts).
  const dog = await createDog(ctx)
  dog.placeAt(window.innerWidth / 2, groundY())

  window.addEventListener('mousemove', (e) => dog.lookAt({ x: e.clientX, y: e.clientY }))
  if (!overlay) {
    window.addEventListener('click', (e) => {
      void dog.moveTo(e.clientX, groundY(), 'run').then(() => dog.setPose('sit'))
    })
  } else {
    // The overlay starts click-through (main process ignores mouse events, forwarding them
    // through); this gate flips it off only while the cursor is over the dog, with a hold so
    // crossing the dog's edge doesn't flicker click-through state every frame.
    const gate = new ClickThroughGate()
    window.addEventListener('mousemove', (e) => {
      const overInteractive = dog.hitTest(e.clientX, e.clientY)
      const next = gate.update(performance.now(), overInteractive)
      if (next !== null) window.zoomies.setClickThrough(next === 'clickThrough')
    })
    window.addEventListener('click', () => dog.setPose('sit'))
  }

  if (debug) {
    const leftX = window.innerWidth * 0.25
    const rightX = window.innerWidth * 0.75
    void (async function patrol(): Promise<void> {
      for (;;) {
        await dog.moveTo(rightX, groundY(), 'trot')
        await dog.moveTo(leftX, groundY(), 'trot')
      }
    })()
  }

  const stats = new FrameStats()

  let last = performance.now()
  const frame = (now: number): void => {
    const frameMs = now - last
    last = now
    const workStart = performance.now()
    dog.update(frameMs)
    ctx.renderer.render(ctx.scene, ctx.camera)
    const workMs = performance.now() - workStart
    stats.add(frameMs, workMs)
    hud.frame(stats, now)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start().catch((err: unknown) => {
  status.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`
  console.error(err)
})
