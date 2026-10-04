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

describe('ActivityTracker.tick', () => {
  function typingEvents(events: ReturnType<ActivityTracker['tick']>): number[] {
    return events
      .filter((e) => e.kind === 'typing')
      .map((e) => (e as { keysPerSec: number }).keysPerSec)
  }

  it('emits a typing event every 500ms while typing, then exactly one zero event when it stops', () => {
    const tracker = new ActivityTracker()
    tracker.key(0, false)

    const seen: Array<{ t: number; keysPerSec: number[] }> = []
    for (let t = 0; t <= 1000; t += 100) {
      seen.push({ t, keysPerSec: typingEvents(tracker.tick(t, 0)) })
    }
    const emittedAt = seen.filter((s) => s.keysPerSec.length > 0).map((s) => s.t)
    expect(emittedAt).toEqual([500, 1000])
    expect(seen.find((s) => s.t === 500)?.keysPerSec).toEqual([0.5])

    // The key ages out of the 2s window exactly at t=2000 (counts only while t > tMs - 2000).
    expect(typingEvents(tracker.tick(2000, 0))).toEqual([0])

    for (let t = 2100; t <= 3000; t += 100) {
      expect(typingEvents(tracker.tick(t, 0))).toEqual([])
    }
  })

  it('emits idle events every 1000ms carrying the idle seconds passed in', () => {
    const tracker = new ActivityTracker()
    const idleAt: number[] = []
    for (let t = 0; t <= 3000; t += 100) {
      const events = tracker.tick(t, t / 10)
      if (events.some((e) => e.kind === 'idle')) idleAt.push(t)
    }
    expect(idleAt).toEqual([1000, 2000, 3000])
  })

  it('emits mouse events at most every 100ms, with the last sample’s position', () => {
    const tracker = new ActivityTracker()
    for (let t = 0; t <= 300; t += 10) tracker.mouse(t, t, t * 2)

    const mouseAt: Array<{ t: number; x: number; y: number }> = []
    for (let t = 0; t <= 300; t += 100) {
      const events = tracker.tick(t, 0)
      const m = events.find((e) => e.kind === 'mouse')
      if (m && m.kind === 'mouse') mouseAt.push({ t, x: m.x, y: m.y })
    }
    expect(mouseAt.map((m) => m.t)).toEqual([100, 200, 300])
    expect(mouseAt[mouseAt.length - 1]).toEqual({ t: 300, x: 300, y: 600 })
  })

  it('emits no mouse event when there are no samples', () => {
    const tracker = new ActivityTracker()
    const events = tracker.tick(100, 0)
    expect(events.some((e) => e.kind === 'mouse')).toBe(false)
  })
})
