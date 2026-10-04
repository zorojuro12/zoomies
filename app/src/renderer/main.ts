// App host (CP0): renders the placeholder dog in a normal window. Click to make it run there;
// it watches the cursor. Lane A turns this into the transparent overlay in P1.
import { APP_NAME, FRAME_BUDGET_MS } from '@shared/app-info'
import { ASSETS, assetUrl } from '@shared/assets'
import type { DogFile } from '@shared/dog-file'
import { validateDogFile } from '@shared/dog-file'
import { PlaceholderDog } from './dog/placeholder/placeholder-dog'
import { createRenderContext, loadJson } from './host/scene'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLDivElement

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)
  const dogFile = await loadJson<DogFile>(assetUrl(ASSETS.placeholderDog))
  const errors = validateDogFile(dogFile)
  if (errors.length > 0) throw new Error(`Invalid dog file: ${errors.join('; ')}`)

  const dog = new PlaceholderDog()
  await dog.init(ctx, dogFile)
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
