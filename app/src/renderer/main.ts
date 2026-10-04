// App host (CP0): renders our dog (the Aussie, via createDog) in a normal window. Click to make it run there;
// it watches the cursor. Lane A turns this into the transparent overlay in P1.
import { APP_NAME, FRAME_BUDGET_MS } from '@shared/app-info'
import { createDog } from './dog/create-dog'
import { createRenderContext } from './host/scene'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLDivElement

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)
  // createDog never leaves the host without a dog: bad spec file -> default dog; SDF dog fails to
  // start -> the placeholder (see dog/create-dog.ts).
  const dog = await createDog(ctx)
  const groundY = (): number => window.innerHeight - 40
  dog.placeAt(window.innerWidth / 2, groundY())

  window.addEventListener('mousemove', (e) => dog.lookAt({ x: e.clientX, y: e.clientY }))
  window.addEventListener('click', (e) => {
    void dog.moveTo(e.clientX, groundY(), 'run').then(() => dog.setPose('sit'))
  })

  let last = performance.now()
  const frame = (now: number): void => {
    const dt = now - last
    last = now
    dog.update(dt)
    ctx.renderer.render(ctx.scene, ctx.camera)
    status.textContent = `${APP_NAME} · ${dt.toFixed(1)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)} ms) · click to call the dog`
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start().catch((err: unknown) => {
  status.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`
  console.error(err)
})
