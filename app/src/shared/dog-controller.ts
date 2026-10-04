// §3.4 What behaviour can ask the dog to do — Daniel implements; Ansh calls.
import type { Facing, Point } from './geometry'

export type PoseName =
  'stand' | 'sit' | 'lie' | 'sleep' | 'playBow' | 'headTilt' | 'scratch' | 'stretch' | 'pant'

export type Gait = 'walk' | 'trot' | 'run'

export interface DogState {
  x: number
  y: number
  facing: Facing
  pose: PoseName | 'moving' | 'airborne'
  busy: boolean
}

export type DogEvent = { kind: 'landed' | 'arrived' | 'poseDone' }

export interface DogController {
  setPose(pose: PoseName, opts?: { durationMs?: number }): Promise<void>
  /** Along the current support surface. */
  moveTo(x: number, y: number, gait: Gait): Promise<void>
  /** Physics arc that lands on the target. */
  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void>
  /** null = idle look-around. */
  lookAt(target: Point | null): void
  setLayer(params: { tailWag?: number; earPerk?: number; breathing?: number }): void
  /** Ball in mouth. */
  attachBall(attached: boolean): void
  getState(): DogState
  onEvent(cb: (e: DogEvent) => void): () => void
}
