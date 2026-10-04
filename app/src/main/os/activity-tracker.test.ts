import { describe, expect, it } from 'vitest'
import { ActivityTracker } from './activity-tracker'

describe('ActivityTracker.typing', () => {
  it('reports keysPerSec and backspaceRatio from keys within the typing window', () => {
    const tracker = new ActivityTracker()
    for (let i = 0; i < 10; i++) tracker.key(i * 100, false)
    expect(tracker.typing(1000)).toEqual({ keysPerSec: 5, backspaceRatio: 0 })
  })

  it('drops keys once they age out of the 2s typing window', () => {
    const tracker = new ActivityTracker()
    for (let i = 0; i < 10; i++) tracker.key(i * 100, false)
    expect(tracker.typing(3000)).toEqual({ keysPerSec: 0, backspaceRatio: 0 })
  })

  it('computes backspaceRatio from the backspace flags in the window', () => {
    const tracker = new ActivityTracker()
    for (let i = 0; i < 10; i++) tracker.key(i * 100, i < 2)
    expect(tracker.typing(1000)).toEqual({ keysPerSec: 5, backspaceRatio: 0.2 })
  })

  it('reports backspaceRatio 0 (not NaN) with no keys at all', () => {
    const tracker = new ActivityTracker()
    expect(tracker.typing(1000)).toEqual({ keysPerSec: 0, backspaceRatio: 0 })
  })

  it('keeps only the most recent 512 keys without throwing', () => {
    const tracker = new ActivityTracker()
    for (let i = 0; i < 600; i++) tracker.key((i / 600) * 1000, false)
    expect(tracker.typing(1000).keysPerSec).toBe(256)
  })
})

describe('ActivityTracker.mouseSpeed', () => {
  it('computes px/s from a straight two-sample move', () => {
    const tracker = new ActivityTracker()
    tracker.mouse(0, 0, 0)
    tracker.mouse(100, 100, 0)
    expect(tracker.mouseSpeed(100)).toBe(1000)
  })

  it('sums path length across multiple samples', () => {
    const tracker = new ActivityTracker()
    tracker.mouse(0, 0, 0)
    tracker.mouse(50, 30, 40)
    tracker.mouse(100, 30, 80)
    expect(tracker.mouseSpeed(100)).toBe(900)
  })

  it('returns 0 once the samples age out of the mouse window', () => {
    const tracker = new ActivityTracker()
    tracker.mouse(0, 0, 0)
    tracker.mouse(100, 10, 10)
    expect(tracker.mouseSpeed(600)).toBe(0)
  })

  it('returns 0 with a single sample', () => {
    const tracker = new ActivityTracker()
    tracker.mouse(0, 0, 0)
    expect(tracker.mouseSpeed(0)).toBe(0)
  })
})
