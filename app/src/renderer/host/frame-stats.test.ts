import { describe, expect, it } from 'vitest'
import { FrameStats } from './frame-stats'

describe('FrameStats', () => {
  it('reports fps, frame avg and work avg from a steady 60fps run', () => {
    const stats = new FrameStats()
    for (let i = 0; i < 120; i++) stats.add(16.667, 1)
    expect(stats.fps()).toBeCloseTo(60.0, 1)
    expect(stats.frameAvg()).toBeCloseTo(16.667, 3)
    expect(stats.workAvg()).toBe(1)
  })

  it('workP95/workMax surface a tail of slow frames, and shift back when the tail is tiny', () => {
    const stats = new FrameStats()
    for (let i = 0; i < 114; i++) stats.add(16.7, 1)
    for (let i = 0; i < 6; i++) stats.add(16.7, 50)
    expect(stats.workP95()).toBe(50)
    expect(stats.workMax()).toBe(50)

    const stats2 = new FrameStats()
    for (let i = 0; i < 119; i++) stats2.add(16.7, 1)
    stats2.add(16.7, 50)
    expect(stats2.workP95()).toBe(1)
  })

  it('count and workAvg reflect the samples seen so far, not the full capacity', () => {
    const stats = new FrameStats()
    stats.add(16.7, 1)
    stats.add(16.7, 2)
    stats.add(16.7, 3)
    expect(stats.count()).toBe(3)
    expect(stats.workAvg()).toBe(2)
  })

  it('a ring buffer of 120 only keeps the most recent 120 samples', () => {
    const stats = new FrameStats(120)
    for (let i = 0; i < 80; i++) stats.add(16.7, 100)
    for (let i = 0; i < 120; i++) stats.add(16.7, 1)
    expect(stats.count()).toBe(120)
    expect(stats.workAvg()).toBe(1)
  })

  it('an empty FrameStats reports zero for every getter', () => {
    const stats = new FrameStats()
    expect(stats.fps()).toBe(0)
    expect(stats.frameAvg()).toBe(0)
    expect(stats.frameP95()).toBe(0)
    expect(stats.workAvg()).toBe(0)
    expect(stats.workP95()).toBe(0)
    expect(stats.workMax()).toBe(0)
    expect(stats.count()).toBe(0)
  })
})
