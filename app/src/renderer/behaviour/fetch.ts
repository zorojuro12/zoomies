// Fetch (P2 Task 3 of docs/plans/a-p2-mvp-behaviour.md): the hero move. The user throws the ball;
// the dog watches it, runs to where it will come to rest, picks it up, carries it back and drops
// it where the dog was standing, then celebrates. Every path ends with the dog free and the ball
// released: never a dog stuck holding a ball or running at nothing.
//
// States: idle -> chasing -> grabbing -> returning -> celebrating -> idle
//                    \-> gaveUp -> idle        (a ball it cannot reach)
// The ball is the host's real Ball (physics runs in the host); the dog is any DogController. The
// host calls, once per frame in this order: stepBall, fetch.update, dog.update.
import type { DogController } from '@shared/dog-controller'
import type { Point } from '@shared/geometry'
import type { Ball } from '../world/ball'
import type { World } from '../world/world-sdf'
import { predictLanding } from './landing'
import type { Landing } from './landing'

export type FetchState = 'idle' | 'chasing' | 'grabbing' | 'returning' | 'celebrating' | 'gaveUp'

/** One-off things that happen, for sounds and moods (Tasks 4 and 6). */
export type FetchNote =
  'launched' | 'bringing' | 'pickedUp' | 'returning' | 'dropped' | 'done' | 'gaveUp' | 'cancelled'

export const FETCH = {
  /** How often the dog re-guesses where a moving ball will land. */
  retargetMs: 250,
  /** A new guess further than this from the old one sends the dog somewhere new. */
  retargetDeadbandPx: 30,
  /** Close enough to the resting ball to pick it up. */
  grabReachPx: 30,
  /** A resting ball higher than this above the floor is out of reach (it is on a window). */
  reachHeightPx: 40,
  /** Carrying the ball back: a trot, but a long way home is a run. */
  farReturnPx: 500,
  grabMs: 250,
  celebrateMs: 1200,
  gaveUpMs: 1500,
  chaseTimeoutMs: 20000,
  returnTimeoutMs: 20000,
  /** The dog stays this far inside the screen edges. */
  edgeMarginPx: 20,
  /** How far ahead to look when guessing where the ball will land. */
  predictMaxMs: 15000
}

export interface FetchOptions {
  dog: DogController
  ball: Ball
  world: World
  groundY: () => number
  /** Where to bring the ball: where the dog was standing when thrown (default) or where it was thrown from. */
  dropSpot?: 'dogOrigin' | 'ballOrigin'
}

export class Fetch {
  state: FetchState = 'idle'

  private readonly dog: DogController
  private readonly ball: Ball
  private readonly world: World
  private readonly groundY: () => number
  private readonly dropSpot: 'dogOrigin' | 'ballOrigin'

  private timer = 0
  private retargetT = 0
  private targetX = Number.NaN
  private arrived = false
  private originDogX = 0
  private originBallX = 0
  private readonly landing: Landing = { x: 0, y: 0, tMs: 0, settled: false }
  private readonly look: Point = { x: 0, y: 0 }
  private readonly listeners = new Set<(n: FetchNote) => void>()

  constructor(opts: FetchOptions) {
    this.dog = opts.dog
    this.ball = opts.ball
    this.world = opts.world
    this.groundY = opts.groundY
    this.dropSpot = opts.dropSpot ?? 'dogOrigin'
    // 'arrived' (not the moveTo promise) tells us the dog really got there: a superseded order
    // resolves its promise too, which would look like arriving when it had not.
    this.dog.onEvent((e) => {
      if (e.kind === 'arrived') this.arrived = true
    })
  }

  onNote(cb: (n: FetchNote) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** True while the dog is doing anything fetch-related. */
  get active(): boolean {
    return this.state !== 'idle'
  }

  /** True while the ball is in the dog's mouth (the host hides the world's ball then). */
  get carrying(): boolean {
    return this.state === 'grabbing' || this.state === 'returning'
  }

  /** The user has just thrown the ball (call right after setting its velocity). */
  launch(): void {
    if (this.ball.held && !this.carrying) return // the player still has it
    if (this.carrying) return // it is in the dog's mouth: nothing to throw
    if (this.state === 'chasing') {
      // thrown again while chasing: keep the first return spot, just re-guess
      this.timer = 0
      this.retargetT = FETCH.retargetMs
      return
    }
    this.originDogX = this.dog.getState().x
    this.originBallX = this.ball.x
    this.state = 'chasing'
    this.timer = 0
    this.retargetT = FETCH.retargetMs
    this.targetX = Number.NaN
    this.arrived = false
    this.emit('launched')
  }

  /** Could the dog go and fetch the ball by itself right now (it is resting on the floor, free)? */
  canBring(): boolean {
    const b = this.ball
    const onFloor = b.y + b.r >= this.groundY() - FETCH.reachHeightPx
    return this.state === 'idle' && !b.held && b.resting && onFloor
  }

  /** The dog fetches the resting ball by itself and brings it to `dropX` (break nudge, "play with me"). */
  bringBall(dropX: number): boolean {
    if (!this.canBring()) return false
    this.originDogX = dropX
    this.originBallX = dropX
    this.state = 'chasing'
    this.timer = 0
    this.retargetT = FETCH.retargetMs
    this.targetX = Number.NaN
    this.arrived = false
    this.emit('bringing')
    return true
  }

  /** The user took over (clicked the dog, grabbed the ball...): stop cleanly, whatever was going on. */
  cancel(): void {
    if (this.state === 'idle') return
    const s = this.dog.getState()
    if (this.carrying) {
      this.dog.attachBall(false)
      this.ball.held = false
      this.ball.x = this.clampX(s.x + s.facing * 30)
      this.ball.y = this.groundY() - this.ball.r
      this.ball.vx = 0
      this.ball.vy = 0
      this.ball.resting = false
      this.ball.contactMs = 0
    }
    void this.dog.moveTo(s.x, s.y, 'walk') // an order to stay where it is
    void this.dog.setPose('stand')
    this.dog.lookAt(null)
    this.state = 'idle'
    this.emit('cancelled')
  }

  update(dtMs: number): void {
    if (this.state === 'idle') return
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? Math.min(dtMs, 100) : 0
    // the player grabbing the ball back (not us carrying it) calls the dog off
    if (this.ball.held && !this.carrying) {
      this.cancel()
      return
    }
    this.timer += dt
    switch (this.state) {
      case 'chasing':
        this.updateChasing(dt)
        break
      case 'grabbing':
        this.follow()
        if (this.timer >= FETCH.grabMs) this.beginReturn()
        break
      case 'returning':
        this.follow()
        if (this.arrived || this.timer > FETCH.returnTimeoutMs) this.drop()
        break
      case 'celebrating':
        if (this.timer >= FETCH.celebrateMs) this.finish()
        break
      case 'gaveUp':
        this.watchBall()
        if (this.timer >= FETCH.gaveUpMs) {
          void this.dog.setPose('stand')
          this.dog.lookAt(null)
          this.state = 'idle'
        }
        break
    }
  }

  // ---- states ------------------------------------------------------------------------------

  private updateChasing(dt: number): void {
    const b = this.ball
    if (this.timer > FETCH.chaseTimeoutMs) {
      this.giveUp()
      return
    }
    this.watchBall()
    const dogX = this.dog.getState().x // one small object per frame, only while a fetch is on
    if (b.resting) {
      const onFloor = b.y + b.r >= this.groundY() - FETCH.reachHeightPx
      if (Math.abs(dogX - b.x) <= FETCH.grabReachPx) {
        if (onFloor) this.startGrab()
        else this.giveUp() // it is up on a window: the dog is under it and cannot reach
        return
      }
      this.goTo(b.x, 'run', 1)
      return
    }
    this.retargetT += dt
    if (this.retargetT >= FETCH.retargetMs) {
      this.retargetT = 0
      predictLanding(b, this.world, FETCH.predictMaxMs, this.landing)
      this.goTo(this.landing.x, 'run', FETCH.retargetDeadbandPx)
    }
  }

  private startGrab(): void {
    this.dog.attachBall(true)
    this.ball.held = true
    this.ball.vx = 0
    this.ball.vy = 0
    this.state = 'grabbing'
    this.timer = 0
    this.targetX = Number.NaN
    this.emit('pickedUp')
  }

  private beginReturn(): void {
    const x = this.clampX(this.dropSpot === 'ballOrigin' ? this.originBallX : this.originDogX)
    this.state = 'returning'
    this.timer = 0
    this.arrived = false
    this.targetX = x
    const far = Math.abs(x - this.dog.getState().x) > FETCH.farReturnPx
    void this.dog.moveTo(x, this.groundY(), far ? 'run' : 'trot')
    this.emit('returning')
  }

  private drop(): void {
    const s = this.dog.getState()
    this.dog.attachBall(false)
    const b = this.ball
    b.x = this.clampX(s.x + s.facing * 45)
    b.y = this.groundY() - b.r
    b.vx = 0
    b.vy = 0
    b.held = false
    b.resting = false
    b.contactMs = 0
    this.state = 'celebrating'
    this.timer = 0
    void this.dog.setPose('playBow')
    this.emit('dropped')
  }

  private finish(): void {
    void this.dog.setPose('stand')
    this.dog.lookAt(null)
    this.state = 'idle'
    this.emit('done')
  }

  private giveUp(): void {
    this.state = 'gaveUp'
    this.timer = 0
    void this.dog.setPose('headTilt')
    this.emit('gaveUp')
  }

  // ---- helpers -----------------------------------------------------------------------------

  /** Send the dog to x (unless it is already heading within `deadband` of there). */
  private goTo(x: number, gait: 'run' | 'trot', deadband: number): void {
    const tx = this.clampX(x)
    if (Number.isFinite(this.targetX) && Math.abs(tx - this.targetX) <= deadband) return
    this.targetX = tx
    this.arrived = false
    void this.dog.moveTo(tx, this.groundY(), gait)
  }

  private watchBall(): void {
    this.look.x = this.ball.x
    this.look.y = this.ball.y
    this.dog.lookAt(this.look)
  }

  /** While carried, the ball just tags along with the dog (the host hides the world's ball). */
  private follow(): void {
    const s = this.dog.getState()
    this.ball.x = s.x
    this.ball.y = s.y - 30
  }

  private clampX(x: number): number {
    const wa = this.world.getBounds()
    const lo = wa.x + FETCH.edgeMarginPx
    const hi = wa.x + wa.w - FETCH.edgeMarginPx
    return Math.min(Math.max(Number.isFinite(x) ? x : lo, lo), hi)
  }

  private emit(n: FetchNote): void {
    for (const cb of this.listeners) cb(n)
  }
}
