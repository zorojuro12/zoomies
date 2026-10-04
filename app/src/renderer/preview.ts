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
import { Behaviour } from './behaviour/behaviour'
import { Fetch } from './behaviour/fetch'
import { FrameGovernor } from './behaviour/fps'
import type { FpsTier } from './behaviour/fps'
import { BEHAVIOUR_TIMING, DEMO_TIMING } from './behaviour/timing'
import { createBall, stepBall } from './world/ball'
import type { Ball } from './world/ball'
import { aimFromDrag, ballHit, launchVelocity } from './world/slingshot'
import { World } from './world/world-sdf'
import { WorldView } from './world/world-view'

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
  // ?size=1.6 overrides the spec's overall size (handy for benchmarking the dog at different sizes).
  const sizeOverride = Number(params.get('size'))
  if (rawSpec !== null && sizeOverride > 0 && typeof rawSpec === 'object') {
    ;(rawSpec as Record<string, unknown>).size = sizeOverride
  }
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
  // Moods (the dog's feeling) and the polish switch (?polish=0 starts with the plain motion).
  if (dog instanceof SdfDog) {
    dog.setPolish(params.get('polish') !== '0')
    let polishOn = params.get('polish') !== '0'
    for (const mood of ['happy', 'curious', 'sleepy', 'alert', 'neutral'] as const) {
      button(`mood: ${mood}`, () => dog.setMood(mood))
    }
    for (const trick of ['yawn', 'sniff', 'shake'] as const) {
      button(`idle: ${trick}`, () => void dog.playIdle(trick))
    }
    button('polish: on/off', () => {
      polishOn = !polishOn
      dog.setPolish(polishOn)
      status.textContent = `polish ${polishOn ? 'on' : 'off'}`
    })
  }
  let ball = false
  button('ball', () => dog.attachBall((ball = !ball)))
  // X-ray views of the SDF dog: the raw shapes, the skeleton, and back to normal.
  // Fur on/off (?fur=0 starts without it).
  let furOn = params.get('fur') !== '0'
  if (dog instanceof SdfDog) dog.setFur(furOn)
  button('fur: on/off', () => {
    furOn = !furOn
    if (dog instanceof SdfDog) dog.setFur(furOn)
  })
  button('x-ray: shapes', () => dog.setDebugView('shapes'))
  button('x-ray: skeleton', () => dog.setDebugView('landmarks'))
  button('x-ray: fur only', () => dog.setDebugView('coat'))
  button('x-ray: off', () => dog.setDebugView('normal'))
  button('background', () => document.body.classList.toggle('dark'))
  // ?behaviour=1 (the personality demo) looks after where the dog looks itself.
  const behaviourDemo = params.get('behaviour') === '1'
  if (!behaviourDemo) {
    window.addEventListener('mousemove', (e) => dog.lookAt({ x: e.clientX, y: e.clientY }))
  }

  // ?fetch=1: the fetch demo. A floor, a ball you can drag back and let go (the slingshot), and
  // the dog fetches it (P2 Task 3). Works here on a Mac, no overlay needed.
  let tickFetch: ((dtMs: number) => void) | null = null
  // In the personality demo the dog asks how often it needs drawing (full / resting / asleep).
  let tierOf: (() => FpsTier) | null = null
  // The fetch demo starts with the dog at the right side of the screen (its default spot).
  const DOG_HOME = 0.85
  const BALL_HOME = 0.6
  let fetchState = ''
  if (params.get('fetch') === '1' || behaviourDemo) {
    const world = new World()
    const workArea = { x: 0, y: 0, w: window.innerWidth, h: groundY() }
    world.setBounds(workArea)
    const worldView = new WorldView(ctx.scene)
    worldView.setDebug(true) // outlines of the floor and the shelf
    dog.placeAt(window.innerWidth * DOG_HOME, groundY())
    // placeAt leaves it facing right (toward the screen edge): a 3 px step left turns it to face the room
    void dog.moveTo(window.innerWidth * DOG_HOME - 3, groundY(), 'walk')
    const ball = createBall(window.innerWidth * BALL_HOME, groundY() - 10)
    ball.resting = true
    const hiddenBall: Ball = { ...ball, r: 0 }
    // The personality demo (?behaviour=1): needs, reactions and fetch together, on the demo timing
    // (idle 8 s, asleep 20 s, break 90 s; ?realtime=1 for the real minutes). Your real mouse and
    // keyboard drive it; the buttons fake the rest.
    let hourOverride = -1
    const behaviour = behaviourDemo
      ? new Behaviour({
          dog,
          ball,
          world,
          groundY,
          timing: params.get('realtime') === '1' ? BEHAVIOUR_TIMING : DEMO_TIMING,
          hitTest: (x, y) => dog.hitTest(x, y),
          hour: () => (hourOverride >= 0 ? hourOverride : new Date().getHours())
        })
      : null
    const fetch = behaviour ? behaviour.fetch : new Fetch({ dog, ball, world, groundY })
    fetch.onNote((n) => console.log('[fetch]', n))
    const shelf = {
      x: window.innerWidth * 0.2,
      y: groundY() - 170,
      w: window.innerWidth * 0.25,
      h: 24
    }
    let shelfOn = false
    const syncSolids = (): void => {
      const solids = shelfOn ? [shelf] : []
      world.setSolids(solids)
      worldView.setSolids(solids, workArea)
    }
    syncSolids()

    let dragging = false
    let aim: { angle: number; power: number } | null = null
    window.addEventListener('pointerdown', (e) => {
      if (fetch.carrying || !ballHit(ball, e.clientX, e.clientY)) return
      dragging = true
      ball.held = true
      ball.resting = false
      ball.vx = 0
      ball.vy = 0
    })
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return
      aim = aimFromDrag(ball.x, ball.y, e.clientX, e.clientY)
      worldView.setAim(ball, aim)
    })
    window.addEventListener('pointerup', () => {
      if (!dragging) return
      dragging = false
      ball.held = false
      if (aim !== null) {
        launchVelocity(aim.angle, aim.power, ball)
        if (behaviour) behaviour.handleInput({ kind: 'launch', angle: aim.angle, power: aim.power })
        else fetch.launch()
      }
      aim = null
      worldView.setAim(ball, null)
    })
    const throwAuto = (dir: 1 | -1): void => {
      if (fetch.carrying) return
      ball.held = false
      ball.resting = false
      ball.vx = dir * (700 + Math.random() * 500)
      ball.vy = -(900 + Math.random() * 600)
      if (behaviour) behaviour.handleInput({ kind: 'launch', angle: -1, power: 1 })
      else fetch.launch()
    }
    button('throw →', () => throwAuto(1))
    button('throw ←', () => throwAuto(-1))
    button('shelf on/off', () => {
      shelfOn = !shelfOn
      syncSolids()
    })
    button('cancel fetch', () => fetch.cancel())
    button('reset ball', () => {
      fetch.cancel()
      ball.x = window.innerWidth * BALL_HOME
      ball.y = groundY() - 10
      ball.vx = 0
      ball.vy = 0
      ball.held = false
      ball.resting = true
    })
    if (behaviour) {
      tierOf = () => behaviour.fpsTier()
      // a pretend "active window" so typing has somewhere to lie down beside
      const demoWindow = {
        id: 'demo',
        title: 'your window',
        x: window.innerWidth * 0.1,
        y: 90,
        w: window.innerWidth * 0.3,
        h: groundY() - 200,
        z: 0,
        minimized: false
      }
      behaviour.setWindows([demoWindow])
      const box = document.createElement('div')
      box.textContent = 'your window (typing makes the dog lie down below it)'
      box.style.cssText = `position:fixed;left:${demoWindow.x}px;top:${demoWindow.y}px;width:${demoWindow.w}px;height:${demoWindow.h}px;border:2px dashed rgba(255,255,255,.4);color:rgba(255,255,255,.6);font:12px monospace;padding:6px;pointer-events:none;box-sizing:border-box`
      document.body.appendChild(box)

      // your real mouse (with its speed) and keyboard (keys per second, backspace share)
      let lastMove = performance.now()
      let lastX = 0
      let lastY = 0
      window.addEventListener('mousemove', (e) => {
        const now = performance.now()
        const dt = Math.max(1, now - lastMove)
        const speed = (Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt) * 1000
        lastMove = now
        lastX = e.clientX
        lastY = e.clientY
        behaviour.handleActivity({ kind: 'mouse', x: e.clientX, y: e.clientY, speed })
      })
      const keys: { t: number; back: boolean }[] = []
      window.addEventListener('keydown', (e) =>
        keys.push({ t: performance.now(), back: e.key === 'Backspace' })
      )
      let wasTyping = false
      setInterval(() => {
        const cutoff = performance.now() - 2000
        while (keys.length > 0 && keys[0]!.t < cutoff) keys.shift()
        const backs = keys.filter((k) => k.back).length
        if (keys.length > 0 || wasTyping) {
          behaviour.handleActivity({
            kind: 'typing',
            keysPerSec: keys.length / 2,
            backspaceRatio: keys.length ? backs / keys.length : 0
          })
        }
        wasTyping = keys.length > 0
      }, 500)
      // buttons that fake typing for a while
      const fakeTyping = (seconds: number, keysPerSec: number, ratio: number): void => {
        let n = 0
        const id = setInterval(() => {
          behaviour.handleActivity({ kind: 'typing', keysPerSec, backspaceRatio: ratio })
          if (++n >= seconds * 2) clearInterval(id)
        }, 500)
      }
      button('type 5 s', () => fakeTyping(5, 4, 0))
      button('type 20 s (focus)', () => fakeTyping(20, 5, 0))
      button('backspace spam', () => fakeTyping(4, 5, 0.5))
      button('go idle', () => behaviour.handleActivity({ kind: 'idle', seconds: 9 }))
      button('fall asleep', () => behaviour.handleActivity({ kind: 'idle', seconds: 21 }))
      button('come back', () =>
        behaviour.handleActivity({ kind: 'mouse', x: lastX, y: lastY, speed: 300 })
      )
      button('break due', () => behaviour.activity.forceBreakDue())
      button('make bored', () => {
        behaviour.needs.boredom = 0.9
        behaviour.needs.energy = 1
      })
      button('tire out', () => {
        behaviour.needs.energy = 0.1
      })
      button('pet', () => behaviour.handleInput({ kind: 'pet', source: 'mouse' }))
      button('late night on/off', () => {
        hourOverride = hourOverride < 0 ? 23 : -1
      })
    }
    tickFetch = (dtMs) => {
      stepBall(ball, world, dtMs)
      if (behaviour) behaviour.update(dtMs)
      else fetch.update(dtMs)
      worldView.setBall(fetch.carrying ? hiddenBall : ball) // hidden while it is in the dog's mouth
      fetchState = behaviour ? behaviour.describe() : `fetch ${fetch.state}`
    }
  }

  // Deterministic mode for comparing renders: ?pose=sit starts in that pose, ?freeze=N steps a
  // fixed 1/60 s per frame and stops the dog after N frames, so two runs show the same instant.
  const startPose = params.get('pose')
  if (startPose) void dog.setPose(startPose as PoseName, { durationMs: 1 })
  const freezeAfter = Number(params.get('freeze') ?? 0)
  let frameCount = 0

  let last = performance.now()
  const governor = new FrameGovernor()
  let framesThisSecond = 0
  let actualFps = 0
  let fpsClock = performance.now()
  const frame = (now: number): void => {
    const tier = tierOf ? tierOf() : 'full'
    if (!governor.shouldRun(now, tier)) {
      requestAnimationFrame(frame) // asleep or resting: skip this screen refresh
      return
    }
    framesThisSecond++
    if (now - fpsClock >= 1000) {
      actualFps = framesThisSecond
      framesThisSecond = 0
      fpsClock = now
    }
    let dt = now - last
    last = now
    if (freezeAfter > 0) dt = frameCount++ < freezeAfter ? 1000 / 60 : 0
    tickFetch?.(dt)
    dog.update(dt)
    ctx.renderer.render(ctx.scene, ctx.camera)
    const s = dog.getState()
    const fpsText = tierOf ? ` · ${actualFps} fps (${tier})` : ''
    status.textContent = `${dt.toFixed(1)} ms · pose ${s.pose} · facing ${s.facing}${fpsText}${fetchState ? ` · ${fetchState}` : ''}`
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

start().catch((err: unknown) => {
  status.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`
  console.error(err)
})
