// App host (CP0): renders our dog (the Aussie, via createDog) in a normal window. Click to make it run there;
// it watches the cursor. Lane A turns this into the transparent overlay in P1.
import type { Rect } from '@shared/geometry'
import type { ActivityEvent, WindowRect } from '@shared/os'
import { createAudioPlayer } from './audio'
import { Behaviour } from './behaviour/behaviour'
import { BuzzerCues } from './behaviour/buzzer-cues'
import { SoundCues } from './behaviour/cues'
import { FrameGovernor } from './behaviour/fps'
import type { FpsTier } from './behaviour/fps'
import { timingFor } from './behaviour/timing'
import { createDog } from './dog/create-dog'
import { ClickThroughGate } from './host/click-through'
import { CommandBar } from './host/command-bar'
import { routeCommand } from './host/command-router'
import { createBrowserVoiceInput } from './host/voice-input'
import { handleClip } from './host/voice-flow'
import type { InputEvent } from '@shared/input'
import { FrameStats } from './host/frame-stats'
import { Hud, controllerHudText } from './host/hud'
import { createRenderContext } from './host/scene'
import { createBall, stepBall } from './world/ball'
import type { Ball } from './world/ball'
import { aimFromDrag, ballHit, launchVelocity } from './world/slingshot'
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
// ?behaviour=0 (ZOOMIES_BEHAVIOUR=0) switches the dog's whole personality off: the host then acts exactly
// like P1. ?demo=1 (ZOOMIES_DEMO=1) uses short timers (idle 8 s, asleep 20 s, break due 90 s) so a short
// demo can show sleep, waking and the break nudge.
const behaviourOn = searchParams.get('behaviour') !== '0'
const demo = searchParams.get('demo') === '1'
// ?mute=1 (ZOOMIES_MUTE=1): the dog's sounds start off.
const muted = searchParams.get('mute') === '1'
document.body.style.background = overlay ? 'transparent' : '#1d2a33'

async function start(): Promise<void> {
  const ctx = createRenderContext(canvas)

  let workArea: Rect = await window.zoomies.getWorkArea()
  const groundY = (): number =>
    overlay ? workArea.y + workArea.h : window.innerHeight - (overlay ? 48 : 40)

  const hud = new Hud(status)
  // The dog's personality (needs, reactions, fetch, adaptive frame rate): created once the dog exists.
  let behaviour: Behaviour | null = null
  // The controller (Arduino, via the main process): its events drive the dog like the mouse does,
  // and the buzzer only gets requests while a board is actually connected.
  let buzzer: BuzzerCues | null = null
  let controllerConnected = false
  const onSerialStatus = (s: { connected: boolean; port: string | null }): void => {
    controllerConnected = s.connected
    buzzer?.setEnabled(s.connected)
    hud.set('controller', controllerHudText(s))
  }
  window.zoomies.onSerialStatus(onSerialStatus)
  // Push-to-talk: the mic is open ONLY while the button is held (controller, the on-screen button, or space).
  const sendCommand = (text: string): void => behaviour?.handleInput({ kind: 'command', text })
  const voice = createBrowserVoiceInput(
    (bytes, mime) =>
      void handleClip(
        bytes,
        mime,
        async (b, m) => window.zoomies.transcribe(b, m),
        (text) => void routeCommand(text, (t) => window.zoomies.interpret(t), sendCommand),
        sendCommand
      ),
    (message) => console.warn(`[voice] ${message}`)
  )
  const input = (e: InputEvent): void => {
    behaviour?.handleInput(e)
    if (e.kind === 'pushToTalk') {
      if (e.state === 'start') voice.start()
      else voice.stop()
    }
  }
  window.zoomies.onInput(input)
  let spaceDown = false
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || spaceDown || e.target instanceof HTMLInputElement) return
    spaceDown = true
    input({ kind: 'pushToTalk', state: 'start' })
  })
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' || !spaceDown) return
    spaceDown = false
    input({ kind: 'pushToTalk', state: 'stop' })
  })
  // Clickable commands (and a text box in the windowed host): shown with ?commands=1 or the C key.
  const send = sendCommand
  const commandBar = new CommandBar(
    document.body,
    send,
    overlay ? null : (text) => void routeCommand(text, (t) => window.zoomies.interpret(t), send),
    (state) => input({ kind: 'pushToTalk', state })
  )
  commandBar.setVisible(searchParams.get('commands') === '1')
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') commandBar.toggle()
  })
  void window.zoomies.getSerialStatus().then(onSerialStatus)
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
    behaviour?.setWindows(windows)
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
    behaviour?.handleActivity(e)
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
  // The dog's default spot: the right side of the screen, turned to face the room (placeAt leaves it
  // facing right, so a 3 px step left turns it).
  const homeX = window.innerWidth * 0.85
  dog.placeAt(homeX, groundY())
  void dog.moveTo(homeX - 3, groundY(), 'walk')

  const ball = createBall(window.innerWidth / 2, groundY() - 200)
  if (behaviourOn) {
    behaviour = new Behaviour({
      dog,
      ball,
      world,
      groundY,
      timing: timingFor(demo),
      hitTest: (x, y) => dog.hitTest(x, y)
    })
    behaviour.setWindows(latestWindows)
  }
  // The dog's voice: the behaviour's events (a throw, a pick-up, falling asleep, a bounce...) become
  // sounds, panned to the dog and a little quieter the farther it is from the cursor.
  let cues: SoundCues | null = null
  if (behaviour) {
    const brain = behaviour
    const audio = createAudioPlayer()
    void audio.preload()
    cues = new SoundCues(audio, {
      screenW: () => window.innerWidth,
      dogX: () => dog.getState().x,
      cursorX: () => brain.cursorX(),
      muted
    })
    brain.onEvent((e) => cues?.handle(e))
    buzzer = new BuzzerCues((p) => window.zoomies.buzz(p))
    buzzer.setEnabled(controllerConnected)
    brain.onEvent((e) => buzzer?.handle(e))
  }
  const governor = new FrameGovernor()
  // What the world draws while the dog has the ball in its mouth (nothing: radius 0).
  const hiddenBall: Ball = { ...ball, r: 0 }

  // Slingshot (Task 8): grab the ball, drag away from it to aim (the ball itself stays put, like
  // a slingshot pouch — only the aim line reacts), release to launch opposite the pull.
  let dragging = false
  let currentAim: { angle: number; power: number } | null = null
  window.addEventListener('pointerdown', (e) => {
    if (behaviour?.fetch.carrying || !ballHit(ball, e.clientX, e.clientY)) return // not out of the dog's mouth
    dragging = true
    ball.held = true
    ball.resting = false
    ball.vx = 0
    ball.vy = 0
  })
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return
    currentAim = aimFromDrag(ball.x, ball.y, e.clientX, e.clientY)
    worldView.setAim(ball, currentAim)
  })
  window.addEventListener('pointerup', () => {
    if (!dragging) return
    dragging = false
    if (currentAim !== null) launchVelocity(currentAim.angle, currentAim.power, ball)
    ball.held = false
    // Tell the dog a throw happened (after `held` is cleared: fetch ignores a ball still in the hand).
    if (currentAim !== null) {
      behaviour?.handleInput({ kind: 'launch', angle: currentAim.angle, power: currentAim.power })
    }
    currentAim = null
    worldView.setAim(ball, null)
  })

  if (behaviour) {
    // The brain decides where the dog looks (the ball while fetching, a moving cursor for a few seconds).
    // Cursor position and speed come from here; on Windows the activity events from the OS layer feed
    // the same numbers, and in the windowed Mac host (no real activity) this keeps the user "active".
    let lastX = 0
    let lastY = 0
    let lastT = performance.now()
    window.addEventListener('mousemove', (e) => {
      const now = performance.now()
      const speed =
        (Math.hypot(e.clientX - lastX, e.clientY - lastY) / Math.max(1, now - lastT)) * 1000
      lastX = e.clientX
      lastY = e.clientY
      lastT = now
      if (overlay) behaviour?.setCursor(e.clientX, e.clientY, speed)
      else behaviour?.handleActivity({ kind: 'mouse', x: e.clientX, y: e.clientY, speed })
    })
    // Clicking the dog pets it (happy, leans in).
    window.addEventListener('click', (e) => {
      if (dog.hitTest(e.clientX, e.clientY))
        behaviour?.handleInput({ kind: 'pet', source: 'mouse' })
    })
    // Double-click = call (the mouse twin of the controller's button tap).
    window.addEventListener('dblclick', () => behaviour?.handleInput({ kind: 'call' }))
  } else {
    window.addEventListener('mousemove', (e) => dog.lookAt({ x: e.clientX, y: e.clientY }))
    if (!overlay) {
      window.addEventListener('click', (e) => {
        void dog.moveTo(e.clientX, groundY(), 'run').then(() => dog.setPose('sit'))
      })
    } else {
      window.addEventListener('click', () => dog.setPose('sit'))
    }
  }
  if (overlay) {
    // The overlay starts click-through (main process ignores mouse events, forwarding them
    // through); this gate flips it off while the cursor is over the dog or the ball, or while
    // dragging (so a drag that moves the cursor away from the ball's fixed position doesn't lose
    // the pointerup that ends it).
    const gate = new ClickThroughGate()
    window.addEventListener('mousemove', (e) => {
      const overInteractive =
        dog.hitTest(e.clientX, e.clientY) ||
        (!behaviour?.fetch.carrying && ballHit(ball, e.clientX, e.clientY)) ||
        dragging ||
        commandBar.hit(e.clientX, e.clientY)
      const next = gate.update(performance.now(), overInteractive)
      if (next !== null) window.zoomies.setClickThrough(next === 'clickThrough')
    })
  }

  if (debug && !behaviour) {
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
  let lastTier: FpsTier | '' = ''
  const frame = (now: number): void => {
    // Resting or asleep: skip most screen refreshes (30 or 5 frames a second); anything going on: all.
    const tier = behaviour ? behaviour.fpsTier() : 'full'
    if (!governor.shouldRun(now, tier)) {
      requestAnimationFrame(frame)
      return
    }
    if (tier !== lastTier) {
      lastTier = tier
      hud.set(
        'power',
        tier === 'full' ? 'full speed' : tier === 'rest' ? 'resting 30 fps' : 'asleep 5 fps'
      )
    }
    const frameMs = now - last
    last = now
    const workStart = performance.now()
    stepBall(ball, world, frameMs)
    behaviour?.update(frameMs)
    buzzer?.update(frameMs)
    cues?.update(frameMs)
    worldView.setBall(behaviour?.fetch.carrying ? hiddenBall : ball)
    if (!behaviour && !ball.resting) dog.lookAt({ x: ball.x, y: ball.y })
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
