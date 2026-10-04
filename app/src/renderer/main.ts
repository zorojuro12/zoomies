// App host (CP0): renders our dog (the Aussie, via createDog) in a normal window. Click to make it run there;
// it watches the cursor. Lane A turns this into the transparent overlay in P1.
import { APP_NAME, FRAME_BUDGET_MS } from '@shared/app-info'
import { createDog } from './dog/create-dog'
import { createRenderContext } from './host/scene'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLDivElement

// ?overlay=1 (set by the main process) means we're the real transparent desktop overlay on
// Windows: no click-to-call (clicks pass through), and the ground sits a bit higher to clear
// the taskbar. Without it, this is the windowed host (Mac/WSL dev, or ZOOMIES_WINDOWED=1).
const searchParams = new URLSearchParams(window.location.search)
const overlay = searchParams.get('overlay') === '1'
// ?debug=1 (ZOOMIES_DEBUG=1): patrol back and forth so the overlay's GPU cost reflects constant
// motion, not an idle stand — see Task 1 Checkpoint 2 in docs/plans/a-p1-overlay.md.
const debug = searchParams.get('debug') === '1'
document.body.style.background = overlay ? 'transparent' : '#1d2a33'

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)
  // createDog never leaves the host without a dog: bad spec file -> default dog; SDF dog fails to
  // start -> the placeholder (see dog/create-dog.ts).
  const dog = await createDog(ctx)
  const groundY = (): number => window.innerHeight - (overlay ? 48 : 40)
  dog.placeAt(window.innerWidth / 2, groundY())

  window.addEventListener('mousemove', (e) => dog.lookAt({ x: e.clientX, y: e.clientY }))
  if (!overlay) {
    window.addEventListener('click', (e) => {
      void dog.moveTo(e.clientX, groundY(), 'run').then(() => dog.setPose('sit'))
    })
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

  let last = performance.now()
  const frame = (now: number): void => {
    const dt = now - last
    last = now
    dog.update(dt)
    ctx.renderer.render(ctx.scene, ctx.camera)
    status.textContent = overlay
      ? `${APP_NAME} · ${dt.toFixed(1)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)} ms)`
      : `${APP_NAME} · ${dt.toFixed(1)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)} ms) · click to call the dog`
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start().catch((err: unknown) => {
  status.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`
  console.error(err)
})
