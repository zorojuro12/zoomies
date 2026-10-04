import { describe, expect, it, vi } from 'vitest'
import type { FrameStats } from './frame-stats'
import { controllerHudText, Hud, VOICE_TEXT_MS } from './hud'

describe('controllerHudText', () => {
  it('shows the port when connected', () => {
    expect(controllerHudText({ connected: true, port: 'COM3' }, true)).toBe('controller COM3')
  })
  it('says nothing when there never was a board (testing without hardware is normal)', () => {
    expect(controllerHudText({ connected: false, port: null }, false)).toBe('')
  })
  it('says so when a board that was connected goes away', () => {
    expect(controllerHudText({ connected: false, port: null }, true)).toBe(
      'controller: disconnected'
    )
  })
})

describe('what the dog heard stays on screen for a few seconds, then goes', () => {
  const stats = {
    fps: () => 60,
    frameP95: () => 16,
    workAvg: () => 1,
    workP95: () => 2
  } as unknown as FrameStats
  it('shown, then cleared after the time is up (other fields stay)', () => {
    const el = { textContent: '' } as HTMLElement
    const hud = new Hud(el)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    hud.set('voice', 'heard "sit"')
    hud.set('controller', 'controller: not found')
    hud.frame(stats, 1100)
    expect(el.textContent).toContain('heard "sit"')
    hud.frame(stats, 1000 + VOICE_TEXT_MS - 100)
    expect(el.textContent).toContain('heard "sit"')
    hud.frame(stats, 1000 + VOICE_TEXT_MS + 500)
    expect(el.textContent).not.toContain('heard')
    expect(el.textContent).toContain('controller: not found')
    now.mockRestore()
  })
  it('a newer message restarts the clock', () => {
    const el = { textContent: '' } as HTMLElement
    const hud = new Hud(el)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    hud.set('voice', 'first')
    now.mockReturnValue(5000)
    hud.set('voice', 'second')
    hud.frame(stats, 7000)
    expect(el.textContent).toContain('second')
    now.mockRestore()
  })
})
