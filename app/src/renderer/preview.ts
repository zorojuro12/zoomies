// Dog preview page (Lane B harness): the dog in a normal window, no overlay — works on a Mac.
// Open http://localhost:<port>/preview.html from `npm run dev` in a browser.
// Starts with the placeholder; Daniel swaps in his SDF dog here first.
import { ASSETS, assetUrl } from '@shared/assets'
import type { PoseName } from '@shared/dog-controller'
import type { DogFile } from '@shared/dog-file'
import { PlaceholderDog } from './dog/placeholder/placeholder-dog'
import { SdfDog } from './dog/sdf/SdfDog'
import { createRenderContext, loadJson } from './host/scene'

const POSES: PoseName[] = ['stand', 'sit', 'lie', 'sleep', 'playBow', 'headTilt']

const canvas = document.getElementById('stage') as HTMLCanvasElement
const panel = document.getElementById('panel') as HTMLDivElement
const status = document.getElementById('status') as HTMLDivElement

function button(label: string, onClick: () => void): void {
  const b = document.createElement('button')
  b.textContent = label
  b.addEventListener('click', onClick)
  panel.appendChild(b)
}

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)
  // ?dog=sdf shows the ray-marched SDF dog; without it, the placeholder stand-in.
  const useSdf = new URLSearchParams(window.location.search).get('dog') === 'sdf'
  const dog = useSdf ? new SdfDog() : new PlaceholderDog()
  await dog.init(ctx, await loadJson<DogFile>(assetUrl(ASSETS.placeholderDog)))
  const groundY = (): number => window.innerHeight * 0.7
  dog.placeAt(window.innerWidth / 2, groundY())

  for (const pose of POSES) button(pose, () => void dog.setPose(pose))
  button('walk ↔', () => {
    const s = dog.getState()
    void dog.moveTo(
      s.x > window.innerWidth / 2 ? window.innerWidth * 0.25 : window.innerWidth * 0.75,
      groundY(),
      'walk'
    )
  })
  button('run ↔', () => {
    const s = dog.getState()
    void dog.moveTo(
      s.x > window.innerWidth / 2 ? window.innerWidth * 0.2 : window.innerWidth * 0.8,
      groundY(),
      'run'
    )
  })
  // Vertical walks exercise the dog's turn toward/away from the viewer (T4): up the screen
  // shows its back, down shows its face. Slow on purpose so you can inspect the angle.
  button('walk ↑', () => {
    const s = dog.getState()
    void dog.moveTo(s.x, groundY() - 140, 'walk')
  })
  button('walk ↓', () => {
    const s = dog.getState()
    void dog.moveTo(s.x, groundY(), 'walk')
  })
  button('jump', () => {
    const s = dog.getState()
    void dog.jumpTo(s.x + 160 * s.facing, groundY(), { apexPx: 120 })
  })
  let ball = false
  button('ball', () => dog.attachBall((ball = !ball)))
  button('background', () => document.body.classList.toggle('dark'))
  window.addEventListener('mousemove', (e) => dog.lookAt({ x: e.clientX, y: e.clientY }))

  let last = performance.now()
  const frame = (now: number): void => {
    const dt = now - last
    last = now
    dog.update(dt)
    ctx.renderer.render(ctx.scene, ctx.camera)
    const s = dog.getState()
    status.textContent = `${dt.toFixed(1)} ms · pose ${s.pose} · facing ${s.facing}`
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start().catch((err: unknown) => {
  status.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`
  console.error(err)
})
