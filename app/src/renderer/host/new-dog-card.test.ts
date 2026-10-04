// The "Making your dog…" card and the right-click menu: the small pure rules behind them.
import { describe, expect, it } from 'vitest'
import type { NewDogProgress } from '@shared/ipc'
import { clampMenuPosition, stepStates } from './new-dog-card'

const STEPS = ['a', 'b', 'c', 'd', 'e'] as const
const p = (over: Partial<NewDogProgress>): NewDogProgress => ({
  steps: STEPS,
  current: 0,
  detail: '',
  percent: 0,
  state: 'running',
  ...over
})

describe('stepStates', () => {
  it('running: steps before the current are done, the current is spinning, the rest wait', () => {
    expect(stepStates(p({ current: 2 }))).toEqual(['done', 'done', 'current', 'pending', 'pending'])
    expect(stepStates(p({ current: 0 }))).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending'
    ])
  })
  it('done: every step is ticked', () => {
    expect(stepStates(p({ current: 4, state: 'done' }))).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done'
    ])
  })
  it('error: the step that failed is marked, the earlier ones stay ticked', () => {
    expect(stepStates(p({ current: 1, state: 'error' }))).toEqual([
      'done',
      'error',
      'pending',
      'pending',
      'pending'
    ])
  })
  it('a current index outside the list never crashes', () => {
    expect(stepStates(p({ current: 99 }))).toEqual(['done', 'done', 'done', 'done', 'current'])
    expect(stepStates(p({ current: -3 }))[0]).toBe('current')
  })
})

describe('clampMenuPosition (the menu never hangs off the screen)', () => {
  it('stays where it was clicked when there is room', () => {
    expect(clampMenuPosition(100, 100, 200, 90, 1000, 800)).toEqual({ x: 100, y: 100 })
  })
  it('opens to the left / up when it would run off the right / bottom edge', () => {
    expect(clampMenuPosition(950, 780, 200, 90, 1000, 800)).toEqual({ x: 800, y: 710 })
  })
  it('never goes negative, even in a tiny window', () => {
    expect(clampMenuPosition(5, 5, 500, 500, 100, 100)).toEqual({ x: 0, y: 0 })
  })
})
