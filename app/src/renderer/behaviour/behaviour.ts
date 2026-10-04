// Behaviour (P2 Task 4 of docs/plans/a-p2-mvp-behaviour.md): the dog's personality. It puts the
// needs model, the activity classifier, fetch, the reactions table and the arbiter together:
//   host -> handleActivity / handleInput / setWindows / setCursor, then update(dtMs) once a frame
// (after stepBall, before dog.update). It knows nothing about Three.js or Electron: only a
// DogController, the ball and the world.
import type { DogController } from '@shared/dog-controller'
import type { InputEvent } from '@shared/input'
import type { ActivityEvent, WindowRect } from '@shared/os'
import type { Ball } from '../world/ball'
import type { World } from '../world/world-sdf'
import { ActivityClassifier } from './activity'
import type { ActivityNote } from './activity'
import { Arbiter, chooseLook } from './arbiter'
import { asExtras } from './dog-extras'
import type { DogExtras } from './dog-extras'
import type { FpsTier } from './fps'
import { Fetch } from './fetch'
import type { FetchNote } from './fetch'
import { applyNeedsEvent, createNeeds, stepNeeds, wants } from './needs'
import type { Doing, Needs } from './needs'
import { createReactions } from './reactions'
import type { Ctx, Env, Reaction } from './reactions'
import { BEHAVIOUR_TIMING } from './timing'
import type { Timing } from './timing'

export interface BehaviourOptions {
  dog: DogController
  ball: Ball
  world: World
  groundY: () => number
  timing?: Timing
  /** Is the cursor over the dog? (the host's `dog.hitTest`) */
  hitTest?: (x: number, y: number) => boolean
  /** The local hour of day, 0..23 (injectable so tests do not depend on the clock). */
  hour?: () => number
}

const SHAKE_SPEED = 2500
const PET_HOLD_MS = 2700
/** After a touch the dog is drawn at full speed for at least this long. */
const AWAKE_MS = 1000
/** A reaction is drawn at full speed for this long while it settles into its pose. */
const SETTLE_MS = 1500
/** One update counts as at most this long (a stall must not teleport the dog); longer is taken in 100 ms pieces. */
const MAX_UPDATE_MS = 1000
const STEP_MS = 100
/** A ball reversing direction faster than this (px/s) is a bounce (slower is just the top of a throw). */
const BOUNCE_MIN_SPEED = 150
/** The impact speed that counts as a full-strength bounce. */
const BOUNCE_FULL_SPEED = 2000
const BOUNCE_GAP_MS = 80
/** An aim (the joystick pulled back) lasts this long after the last aim message. */
const AIM_HOLD_MS = 500
/** A call keeps the dog for this long (it runs to the cursor, wags). */
const CALL_HOLD_MS = 4500
/** A push-to-talk with no stop message (a loose wire) gives up after this long. */
const TALK_MAX_MS = 10000

/** Things that happen, for the sounds (and anything else that wants to listen). */
export type BehaviourEvent =
  | { kind: 'fetch'; note: FetchNote }
  | { kind: 'activity'; note: ActivityNote }
  | { kind: 'reaction'; id: string; phase: 'start' | 'end' }
  | { kind: 'pet'; source: 'touch' | 'mouse' }
  | { kind: 'call' }
  | { kind: 'talk'; state: 'start' | 'stop' }
  /** The ball bounced at x; strength 0..1 follows how hard it hit. */
  | { kind: 'bounce'; x: number; strength: number }

export class Behaviour {
  readonly needs: Needs = createNeeds()
  readonly activity: ActivityClassifier
  readonly fetch: Fetch
  readonly arbiter = new Arbiter()

  private readonly dog: DogController
  private readonly ball: Ball
  private readonly extras: DogExtras
  private readonly world: World
  private readonly timing: Timing
  private readonly hitTest: (x: number, y: number) => boolean
  private readonly hour: () => number
  private readonly reactions = createReactions()
  private readonly env: Env
  private readonly cooldownUntil = new Map<string, number>()

  private clockMs = 0
  private windows: readonly WindowRect[] = []
  private current: Reaction | null = null
  private returnedPending = false
  private returnedAgeMs = 0
  private keysPerSec = 0
  private commandHoldMs = 0
  private petting = false
  private bringReason: 'none' | 'break' | 'bored' = 'none'
  private bringCooldownUntil = 0
  private lookingAtCursor = false
  private awakeMs = 0
  private aimUntilMs = 0
  private aimPower = 0
  private talking = false
  private talkDeadlineMs = 0
  private calling = false
  private overlayKey = ''
  private lookingAtBall = false
  private prevVx = 0
  private prevVy = 0
  private lastBounceMs = Number.NEGATIVE_INFINITY
  private readonly listeners = new Set<(e: BehaviourEvent) => void>()

  private readonly cursor = {
    x: 0,
    y: 0,
    speed: 0,
    known: false,
    ageMs: Number.POSITIVE_INFINITY,
    overMs: 0,
    overGraceMs: 0,
    fastMs: 0,
    slowMs: 0
  }
  private readonly lookPoint = { x: 0, y: 0 }
  private readonly ctx: Ctx = {
    clockMs: 0,
    user: 'active',
    backspaceSpam: false,
    lateNight: false,
    keysPerSec: 0,
    needs: this.needs,
    dogX: 0,
    windowX: Number.NaN,
    cursorX: 0,
    cursorOverMs: 0,
    cursorFastMs: 0,
    returnedPending: false,
    screenW: 1920
  }

  constructor(opts: BehaviourOptions) {
    this.dog = opts.dog
    this.ball = opts.ball
    this.extras = asExtras(opts.dog)
    this.world = opts.world
    this.timing = opts.timing ?? BEHAVIOUR_TIMING
    this.hitTest = opts.hitTest ?? (() => false)
    this.hour = opts.hour ?? ((): number => new Date().getHours())
    this.activity = new ActivityClassifier(this.timing)
    this.fetch = new Fetch({
      dog: opts.dog,
      ball: opts.ball,
      world: opts.world,
      groundY: opts.groundY
    })
    this.env = { dog: opts.dog, extras: this.extras, arrived: false }

    opts.dog.onEvent((e) => {
      if (e.kind === 'arrived') this.env.arrived = true
    })
    this.activity.onNote((n) => this.onActivityNote(n))
    this.fetch.onNote((n) => this.onFetchNote(n))
    // when something more important takes the dog, the previous owner tidies up
    this.arbiter.onPreempt((id) => {
      if (this.current && this.current.id === id) {
        const r = this.current
        r.stop(this.env)
        this.current = null
        this.emit({ kind: 'reaction', id: r.id, phase: 'end' })
      }
      if (id === 'pet') this.endPet()
      if (id === 'call') this.endCall()
    })
  }

  /** Listen to what happens (a fetch step, falling asleep, a reaction starting...). Returns a way to stop. */
  onEvent(cb: (e: BehaviourEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Where the cursor is (null until it has moved). */
  cursorX(): number | null {
    return this.cursor.known ? this.cursor.x : null
  }

  private emit(e: BehaviourEvent): void {
    for (const cb of this.listeners) cb(e) // events are rare (a few a second at most), so a small object each is fine
  }

  // ---- inputs from the host ----------------------------------------------------------------

  handleActivity(e: ActivityEvent): void {
    // Real input wakes a dog that was sitting idle or asleep AT ONCE: full speed before the next,
    // possibly slow, update runs. (Input while it is already up and about changes nothing.)
    const u = this.activity.state.user
    const input = (e.kind === 'mouse' && e.speed > 0) || (e.kind === 'typing' && e.keysPerSec > 0)
    if (input && (u === 'idle' || u === 'asleep')) this.awakeMs = AWAKE_MS
    this.activity.onEvent(e)
    if (e.kind === 'mouse') this.setCursor(e.x, e.y, e.speed)
    else if (e.kind === 'typing' && Number.isFinite(e.keysPerSec)) this.keysPerSec = e.keysPerSec
  }

  handleInput(e: InputEvent): void {
    this.awakeMs = AWAKE_MS
    // the joystick and the button are the user being here, though the OS activity hooks never see them
    this.activity.noteInput()
    if (e.kind === 'launch') {
      this.fetch.launch()
    } else if (e.kind === 'aim') {
      this.aimUntilMs = this.clockMs + AIM_HOLD_MS
      this.aimPower = e.power
    } else if (e.kind === 'call') {
      this.call()
    } else if (e.kind === 'pushToTalk') {
      this.talking = e.state === 'start'
      this.talkDeadlineMs = this.clockMs + TALK_MAX_MS
      this.emit({ kind: 'talk', state: e.state })
    } else if (e.kind === 'pet') {
      applyNeedsEvent(this.needs, 'pet')
      if (this.arbiter.request('command', 'pet', 1, PET_HOLD_MS)) {
        this.emit({ kind: 'pet', source: e.source })
        this.commandHoldMs = PET_HOLD_MS
        this.petting = true
        // Lie down on its tummy to be petted (stopping first if it was on the move).
        const at = this.dog.getState()
        if (at.pose === 'moving') void this.dog.moveTo(at.x, at.y, 'walk')
        void this.dog.setPose('lie')
        this.extras.setMood('happy', 1)
        this.dog.setLayer({ tailWag: 1 })
      }
    }
  }

  setWindows(windows: readonly WindowRect[]): void {
    this.windows = windows
  }

  /** The cursor is at (x, y) moving at `speed` px/s (mouse activity events call this too). */
  setCursor(x: number, y: number, speed: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const c = this.cursor
    c.x = x
    c.y = y
    c.speed = Number.isFinite(speed) ? Math.max(0, speed) : 0
    c.known = true
    if (c.speed > 0) c.ageMs = 0
  }

  /** The user did something to the dog directly (clicked it...): reactions wait for a moment. */
  userCommand(holdMs = 5000): void {
    this.awakeMs = AWAKE_MS
    if (this.arbiter.request('command', 'user', 0, holdMs)) this.commandHoldMs = holdMs
  }

  // ---- what it is up to (for the demo readout and tests) ----------------------------------

  /** The id of the running reaction, or '' (fetch and commands are not reactions). */
  get reaction(): string {
    return this.current?.id ?? ''
  }

  describe(): string {
    const n = this.needs
    return (
      `${this.arbiter.owner}${this.arbiter.id ? `:${this.arbiter.id}` : ''} · user ${this.activity.state.user}` +
      ` · fetch ${this.fetch.state} · energy ${n.energy.toFixed(2)} boredom ${n.boredom.toFixed(2)} attention ${n.attention.toFixed(2)}`
    )
  }

  // ---- once a frame -------------------------------------------------------------------------

  /**
   * How often the host needs to draw right now (see fps.ts): full speed when anything is going on,
   * resting speed when it has settled sitting or lying down, sleep speed when it is asleep.
   */
  fpsTier(): FpsTier {
    if (this.awakeMs > 0 || this.fetch.active || this.aimActive() || this.talking) return 'full'
    const o = this.arbiter.owner
    if (o === 'reaction' && this.current) {
      const r = this.current
      const settled = this.arbiter.heldMs >= SETTLE_MS && (r.settled?.() ?? true)
      return settled ? r.fps : 'full'
    }
    return 'full'
  }

  /** Once a frame. A long frame (the slow rates) is taken in 100 ms pieces so time passes at the right speed. */
  update(dtMs: number): void {
    this.detectBounce()
    let left = Number.isFinite(dtMs) && dtMs > 0 ? Math.min(dtMs, MAX_UPDATE_MS) : 0
    if (left <= 0) {
      this.step(0)
      return
    }
    while (left > 1e-9) {
      const chunk = Math.min(left, STEP_MS)
      this.step(chunk)
      left -= chunk
    }
  }

  /** A ball that reverses direction fast is a bounce (looked at once per frame, before the time steps). */
  private detectBounce(): void {
    const b = this.ball
    if (b.held || this.fetch.carrying) {
      this.prevVx = 0
      this.prevVy = 0
      return
    }
    const flipY = this.prevVy * b.vy < 0 && Math.abs(this.prevVy) > BOUNCE_MIN_SPEED
    const flipX = this.prevVx * b.vx < 0 && Math.abs(this.prevVx) > BOUNCE_MIN_SPEED
    if ((flipX || flipY) && this.clockMs - this.lastBounceMs > BOUNCE_GAP_MS) {
      this.lastBounceMs = this.clockMs
      const impact = Math.max(flipY ? Math.abs(this.prevVy) : 0, flipX ? Math.abs(this.prevVx) : 0)
      this.emit({ kind: 'bounce', x: b.x, strength: Math.min(1, impact / BOUNCE_FULL_SPEED) })
    }
    this.prevVx = b.vx
    this.prevVy = b.vy
  }

  private step(dt: number): void {
    this.awakeMs = Math.max(0, this.awakeMs - dt)
    this.clockMs += dt
    this.tickCursor(dt)
    this.activity.update(dt, this.hour())
    if (this.returnedPending) {
      this.returnedAgeMs += dt
      if (this.returnedAgeMs > 4000) this.returnedPending = false
    }
    this.fetch.update(dt)
    if (this.arbiter.owner === 'fetch' && !this.fetch.active) this.arbiter.release('fetch')
    this.arbiter.update(dt)

    this.runOwner(dt)
    this.chooseReaction()
    this.maybeBringBall()
    this.updateOverlay()
    this.look()

    const user = this.activity.state.user
    stepNeeds(
      this.needs,
      dt,
      this.doing(),
      user === 'active' || user === 'typing' || user === 'focus'
    )
  }

  // ---- internals ---------------------------------------------------------------------------

  private doing(): Doing {
    if (this.fetch.active) return 'fetching'
    return this.current?.doing ?? 'active'
  }

  private tickCursor(dt: number): void {
    const c = this.cursor
    c.ageMs += dt
    const speed = c.ageMs > 300 ? 0 : c.speed
    if (c.known && this.hitTest(c.x, c.y)) {
      c.overMs += dt
      c.overGraceMs = 0
    } else {
      c.overGraceMs += dt
      if (c.overGraceMs > 800) c.overMs = 0
    }
    if (speed > SHAKE_SPEED) {
      c.fastMs += dt
      c.slowMs = 0
    } else {
      c.slowMs += dt
      if (c.slowMs > 300) c.fastMs = 0
    }
  }

  private context(): Ctx {
    const c = this.ctx
    const s = this.activity.state
    c.clockMs = this.clockMs
    c.user = s.user
    c.backspaceSpam = s.backspaceSpam
    c.lateNight = s.lateNight
    c.keysPerSec = this.keysPerSec
    c.dogX = this.dog.getState().x
    c.screenW = this.world.getBounds().w
    c.windowX = this.activeWindowX(c.screenW)
    c.cursorX = this.cursor.x
    c.cursorOverMs = this.cursor.overMs
    c.cursorFastMs = this.cursor.fastMs
    c.returnedPending = this.returnedPending
    return c
  }

  private activeWindowX(screenW: number): number {
    for (const w of this.windows) {
      if (!w.minimized) return Math.min(Math.max(w.x + w.w / 2, 60), screenW - 60)
    }
    return Number.NaN
  }

  private runOwner(dt: number): void {
    const owner = this.arbiter.owner
    if (owner === 'reaction' || owner === 'greet') {
      const r = this.current
      if (!r) {
        this.arbiter.release(this.arbiter.id)
        return
      }
      const alive = r.update(dt, this.context(), this.env)
      if (!alive && this.arbiter.heldMs >= r.minHoldMs) {
        r.stop(this.env)
        this.current = null
        this.arbiter.release(r.id)
        this.emit({ kind: 'reaction', id: r.id, phase: 'end' })
      }
    } else if (owner === 'command') {
      if (this.arbiter.heldMs >= this.commandHoldMs) {
        if (this.petting) this.endPet()
        if (this.calling) this.endCall()
        this.arbiter.release(this.arbiter.id)
      }
    }
  }

  /** The dog is called (button tap): it runs to the cursor, wags and is happy for a moment. */
  private call(): void {
    applyNeedsEvent(this.needs, 'pet') // you paid it attention
    if (!this.arbiter.request('command', 'call', 2, CALL_HOLD_MS)) return // a fetch is more important
    this.commandHoldMs = CALL_HOLD_MS
    this.calling = true
    this.returnedPending = false // answering the call IS its greeting
    this.emit({ kind: 'call' })
    if (this.cursor.known) {
      const wa = this.world.getBounds()
      const x = Math.min(Math.max(this.cursor.x, wa.x + 20), wa.x + wa.w - 20)
      void this.dog.moveTo(x, this.dog.getState().y, 'run')
    }
    this.extras.setMood('happy', 1)
    this.dog.setLayer({ tailWag: 1 })
  }

  private endCall(): void {
    this.calling = false
    this.dog.setLayer({ tailWag: 0.5 })
    this.extras.setMood('neutral', 0)
    void this.dog.setPose('stand')
  }

  /**
   * The joystick aim and push-to-talk are overlays, not owners of the dog: ears up and alert while they
   * last (more when the stick is pulled harder), relaxed again when they end. Only changes are sent.
   */
  private updateOverlay(): void {
    if (this.talking) this.activity.noteInput() // holding the button down: the user is plainly here
    if (this.talking && this.clockMs >= this.talkDeadlineMs) {
      this.talking = false
      this.emit({ kind: 'talk', state: 'stop' })
    }
    const aiming = this.aimActive()
    const key = aiming ? `a${Math.round(this.aimPower * 10)}` : this.talking ? 't' : ''
    if (key === this.overlayKey) return
    this.overlayKey = key
    if (key === '') {
      this.dog.setLayer({ earPerk: 0 })
      if (this.arbiter.owner === 'none') this.extras.setMood('neutral', 0)
    } else if (aiming) {
      this.extras.setMood('alert', 0.4 + 0.5 * this.aimPower)
      this.dog.setLayer({ earPerk: Math.min(1, 0.4 + 0.8 * this.aimPower) })
    } else {
      this.extras.setMood('alert', 0.6)
      this.dog.setLayer({ earPerk: 1 })
    }
  }

  private aimActive(): boolean {
    return this.clockMs < this.aimUntilMs && !this.fetch.active
  }

  private endPet(): void {
    this.petting = false
    this.dog.setLayer({ tailWag: 0.5 })
    this.extras.setMood('neutral', 0)
    void this.dog.setPose('stand')
  }

  private chooseReaction(): void {
    const o = this.arbiter.owner
    if (o === 'command' || o === 'fetch') return
    const ctx = this.context()
    for (const r of this.reactions) {
      if (this.arbiter.owner !== 'none' && this.arbiter.id === r.id) continue
      if (!r.eligible(ctx)) continue
      if (this.clockMs < (this.cooldownUntil.get(r.id) ?? 0)) continue
      if (!this.arbiter.request(r.rank, r.id, r.priority, r.minHoldMs)) continue
      this.current = r
      this.cooldownUntil.set(r.id, this.clockMs + r.cooldownMs)
      if (r.id === 'greet') this.returnedPending = false
      r.start(ctx, this.env)
      this.emit({ kind: 'reaction', id: r.id, phase: 'start' })
      return
    }
  }

  /** Break time, or bored and not tired: the dog fetches the ball by itself and brings it to the cursor. */
  private maybeBringBall(): void {
    if (this.fetch.active || this.clockMs < this.bringCooldownUntil) return
    const o = this.arbiter.owner
    if (o !== 'none' && o !== 'reaction') return
    const u = this.activity.state.user
    if (u !== 'active' && u !== 'typing' && u !== 'focus') return
    const breakDue = this.activity.state.breakDue && this.needs.energy > 0.25
    const bored = wants(this.needs).play
    if (!breakDue && !bored) return
    if (!this.fetch.canBring()) return
    const wa = this.world.getBounds()
    const x = this.cursor.known ? this.cursor.x : this.dog.getState().x
    if (this.fetch.bringBall(Math.min(Math.max(x, wa.x + 60), wa.x + wa.w - 60))) {
      this.bringReason = breakDue ? 'break' : 'bored'
      // a bored dog does not nag again for a while: four "real breaks" long (12 min; 40 s in the demo)
      this.bringCooldownUntil = this.clockMs + this.timing.realBreakSec * 4000
    }
  }

  private look(): void {
    if (this.fetch.active) {
      this.lookingAtCursor = false // fetch does its own looking
      this.lookingAtBall = false
      return
    }
    if (this.aimActive()) {
      // the joystick is pulled back: eyes on the ball
      this.lookPoint.x = this.ball.x
      this.lookPoint.y = this.ball.y
      this.dog.lookAt(this.lookPoint)
      this.lookingAtBall = true
      this.lookingAtCursor = false
      return
    }
    if (this.lookingAtBall) {
      this.dog.lookAt(null)
      this.lookingAtBall = false
    }
    const choice = chooseLook({ ballWatched: false, cursorAgeMs: this.cursor.ageMs })
    if (choice === 'cursor') {
      this.lookPoint.x = this.cursor.x
      this.lookPoint.y = this.cursor.y
      this.dog.lookAt(this.lookPoint)
      this.lookingAtCursor = true
    } else if (this.lookingAtCursor) {
      this.dog.lookAt(null)
      this.lookingAtCursor = false
    }
  }

  private onActivityNote(n: ActivityNote): void {
    this.emit({ kind: 'activity', note: n })
    if (n === 'returned') {
      this.returnedPending = true
      this.returnedAgeMs = 0
    }
  }

  private onFetchNote(n: FetchNote): void {
    this.emit({ kind: 'fetch', note: n })
    if (n === 'launched' || n === 'bringing') {
      if (n === 'launched') {
        applyNeedsEvent(this.needs, 'launch')
        this.bringReason = 'none'
      }
      this.arbiter.request('fetch', 'fetch', 0, 0)
    } else if (n === 'dropped') {
      if (this.bringReason !== 'none') applyNeedsEvent(this.needs, 'ballBrought')
    } else if (n === 'done') {
      applyNeedsEvent(this.needs, 'fetchDone')
      if (this.bringReason === 'break') this.activity.breakHandled()
      this.bringReason = 'none'
      this.arbiter.release('fetch')
    } else if (n === 'gaveUp' || n === 'cancelled') {
      this.bringReason = 'none'
      this.arbiter.release('fetch')
    }
  }
}
