// Dog preview page (Lane B harness): the dog in a normal window, no overlay — works on a Mac.
// Open http://localhost:<port>/preview.html from `npm run dev` in a browser.
// Starts with the placeholder; Daniel swaps in his SDF dog here first.
import { ASSETS, assetUrl } from '@shared/assets'
import type { PoseName } from '@shared/dog-controller'
import { validateDogFile } from '@shared/dog-file'
import type { DogFile } from '@shared/dog-file'
import { PlaceholderDog } from './dog/placeholder/placeholder-dog'
import { SdfDog } from './dog/sdf/SdfDog'
import { buildDog } from './dog/spec/build-dog'
import { normalizeSpec } from './dog/spec/dog-spec'
import { mountSpecEditor } from './ui/editor/spec-editor'
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
  // No params: Ansh's placeholder stand-in. ?spec=<name> (or ?dog=sdf, = the default spec) shows
  // the SDF dog built from assets/dog/<name>.spec.json with our own motion.
  const params = new URLSearchParams(window.location.search)
  const specName = params.get('spec') ?? (params.get('dog') === 'sdf' ? 'default' : null)
  const dog = specName !== null ? new SdfDog() : new PlaceholderDog()
  const rawSpec =
    specName !== null ? await loadJson<unknown>(assetUrl(`dog/${specName}.spec.json`)) : null
  const dogFile =
    rawSpec !== null ? buildDog(rawSpec) : await loadJson<DogFile>(assetUrl(ASSETS.placeholderDog))
  const errors = validateDogFile(dogFile)
  if (errors.length > 0) throw new Error(`Invalid dog file: ${errors.join('; ')}`)
  await dog.init(ctx, dogFile)
  // ?spec=<name>&edit=1 opens the dog editor: drag a slider, the dog rebuilds live; Save downloads the spec.
  if (rawSpec !== null && params.get('edit') === '1' && dog instanceof SdfDog) {
    mountSpecEditor(document.body, {
      spec: normalizeSpec(rawSpec),
      onChange: (spec) => {
        const next = buildDog(spec)
        const problems = validateDogFile(next)
        if (problems.length > 0) console.error('Editor produced an invalid dog:', problems)
        else dog.rebuild(next)
      }
    })
  }
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
