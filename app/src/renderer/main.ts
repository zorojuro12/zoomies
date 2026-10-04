// App host (CP0): renders our dog (the Aussie, via createDog) in a normal window. Click to make it run there;
// it watches the cursor. Lane A turns this into the transparent overlay in P1.
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, WindowRect } from '@shared/os'
import { createDog } from './dog/create-dog'
import { ClickThroughGate } from './host/click-through'
import { FrameStats } from './host/frame-stats'
import { Hud } from './host/hud'
import { createRenderContext } from './host/scene'
import { createBall, stepBall } from './world/ball'
import { World, worldSolids } from './world/world-sdf'
import { WorldView } from './world/world-view'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLDivElement

// ?overlay=1 (set by the main process) means we're the real transparent desktop overlay on
// Windows: no click-to-call (clicks pass through), and the ground sits on the real work area's
// bottom edge. Without it, this is the windowed host (Mac/WSL dev, or ZOOMIES_WINDOWED=1), where
// the window is a small fixed-size preview box, not the real desktop.
const searchParams = new URLSearchParams(window.location.search)
const overlay = searchParams.get('overlay') === '1'
// ?debug=1 (ZOOMIES_DEBUG=1): patrol back and forth (Task 1 Checkpoint 2) and draw outlines of
// the work area + world solids via `WorldView` (Task 6) — proves the real/stub window list feeds
// the world correctly.
const debug = searchParams.get('debug') === '1'
document.body.style.background = overlay ? 'transparent' : '#1d2a33'

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)

  let workArea: Rect = await window.zoomies.getWorkArea()
  const groundY = (): number =>
    overlay ? workArea.y + workArea.h : window.innerHeight - (overlay ? 48 : 40)

  const hud = new Hud(status)
  const world = new World()
  const worldView = new WorldView(ctx.scene)
  worldView.setDebug(debug)

  let latestWindows: readonly WindowRect[] = []
  const syncWorld = (): void => {
    world.setBounds(workArea)
    const solids = worldSolids(latestWindows, workArea)
    world.setSolids(solids)
    worldView.setSolids(solids, workArea)
  }

  const onWindowsUpdate = (windows: readonly WindowRect[]): void => {
    latestWindows = windows
    hud.set('world', `${windows.length} windows`)
    syncWorld()
  }
  onWindowsUpdate(await window.zoomies.getWindows())
  window.zoomies.onWindows(onWindowsUpdate)
  window.zoomies.onWorkArea((wa) => {
    workArea = wa
    syncWorld()
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

  const ball = createBall(window.innerWidth / 2, groundY() - 200)

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
    stepBall(ball, world, frameMs)
    worldView.setBall(ball)
    if (!ball.resting) dog.lookAt({ x: ball.x, y: ball.y })
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
