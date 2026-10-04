// A stand-in dog for testing behaviour code (no graphics): it "runs" at the real gait speeds,
// fires the same 'arrived' event, and records what it was asked to do. Used by the fetch and
// reaction tests; it implements the real DogController contract.
import type { DogController, DogEvent, DogState, Gait, PoseName } from '@shared/dog-controller'
import type { Point } from '@shared/geometry'

const SPEED: Record<Gait, number> = { walk: 110, trot: 220, run: 420 }

export class FakeDog implements DogController {
  x: number
  y: number
  facing: 1 | -1 = 1
  pose: PoseName = 'stand'
  attached = false
  /** Everything that was asked, in order: ['moveTo run 500', 'attach true', ...]. */
  readonly log: string[] = []
  /** Where it was told to look, each time (copied, so later changes do not rewrite history). */
  readonly looks: (Point | null)[] = []
  readonly moves: { x: number; gait: Gait }[] = []
  /** Dog-only extras (moods and idle tricks), recorded like the rest. */
  readonly moods: string[] = []
  readonly idles: string[] = []
  readonly layers: { tailWag?: number; earPerk?: number; breathing?: number }[] = []
  private target: { x: number; y: number; speed: number } | null = null
  private resolve: (() => void) | null = null
  private readonly listeners = new Set<(e: DogEvent) => void>()

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  setPose(pose: PoseName): Promise<void> {
    this.pose = pose
    this.log.push(`pose ${pose}`)
    return Promise.resolve()
  }

  moveTo(x: number, y: number, gait: Gait): Promise<void> {
    this.resolve?.() // a new order supersedes the old one (like the real dog)
    this.log.push(`moveTo ${gait} ${Math.round(x)}`)
    this.moves.push({ x, gait })
    this.target = { x, y, speed: SPEED[gait] }
    return new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void> {
    this.log.push(`jumpTo ${Math.round(x)} ${Math.round(y)} ${opts?.apexPx ?? ''}`.trim())
    return Promise.resolve()
  }

  lookAt(target: Point | null): void {
    this.looks.push(target ? { x: target.x, y: target.y } : null)
  }

  setLayer(params: { tailWag?: number; earPerk?: number; breathing?: number }): void {
    this.layers.push({ ...params })
  }

  setMood(name: string, intensity = 1): void {
    this.moods.push(`${name} ${intensity}`)
  }

  playIdle(name: string): Promise<void> {
    this.idles.push(name)
    return Promise.resolve()
  }

  attachBall(attached: boolean): void {
    this.attached = attached
    this.log.push(`attach ${attached}`)
  }

  getState(): DogState {
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      pose: this.target ? 'moving' : this.pose,
      busy: this.target !== null
    }
  }

  onEvent(cb: (e: DogEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  update(dtMs: number): void {
    const t = this.target
    if (!t) return
    const dx = t.x - this.x
    const step = (t.speed * dtMs) / 1000
    if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1
    if (Math.abs(dx) <= step) {
      this.x = t.x
      this.y = t.y
      this.target = null
      const r = this.resolve
      this.resolve = null
      r?.()
      for (const cb of this.listeners) cb({ kind: 'arrived' })
    } else {
      this.x += Math.sign(dx) * step
    }
  }
}
