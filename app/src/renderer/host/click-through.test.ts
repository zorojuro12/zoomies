import { describe, expect, it } from 'vitest'
import { ClickThroughGate } from './click-through'

describe('ClickThroughGate', () => {
  it('starts in click-through and stays there while not over anything interactive', () => {
    const gate = new ClickThroughGate()
    expect(gate.update(0, false)).toBeNull()
  })

  it('switches to interactive immediately, and stays silent while it remains interactive', () => {
    const gate = new ClickThroughGate()
    expect(gate.update(0, true)).toBe('interactive')
    expect(gate.update(16, true)).toBeNull()
  })

  it('returns to click-through only after the hold time elapses off interactive', () => {
    const gate = new ClickThroughGate()
    gate.update(0, true)
    expect(gate.update(32, false)).toBeNull()
    expect(gate.update(100, false)).toBeNull()
    expect(gate.update(183, false)).toBe('clickThrough')
  })

  it('restarts the hold timer if interactive becomes true again before the hold elapses', () => {
    const gate = new ClickThroughGate()
    gate.update(0, true)
    gate.update(32, false)
    gate.update(80, true)
    expect(gate.update(250, false)).toBeNull()
    expect(gate.update(400, false)).toBe('clickThrough')
  })
})
