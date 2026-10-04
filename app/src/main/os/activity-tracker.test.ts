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
