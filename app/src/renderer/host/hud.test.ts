import { describe, expect, it } from 'vitest'
import { controllerHudText } from './hud'

describe('controllerHudText', () => {
  it('shows the port when connected', () => {
    expect(controllerHudText({ connected: true, port: 'COM3' })).toBe('controller COM3')
  })
  it('says not found when not', () => {
    expect(controllerHudText({ connected: false, port: null })).toBe('controller: not found')
  })
})
