// Cartoon timing: a pose change should overshoot its target a little and settle (anticipation's
// cousin) instead of sliding in at constant speed. cartoonEase(t): 0 -> 0, 1 -> 1, with ~7% overshoot.
import { describe, expect, it } from 'vitest'
import { cartoonEase, clamp01, lerp } from './ease'

describe('cartoonEase', () => {
  it('starts at 0 and ends at exactly 1', () => {
    expect(cartoonEase(0)).toBeCloseTo(0)
    expect(cartoonEase(1)).toBeCloseTo(1)
  })
  it('overshoots: the peak is 1.0706 at t = 0.6111 (hand-worked: u = -2c/(3(c+1)) with c = 1.4)', () => {
    // u = t - 1 = -0.3889; value = 1 + 2.4*u^3 + 1.4*u^2 = 1.0706
    expect(cartoonEase(0.6111)).toBeCloseTo(1.0706, 3)
    let peak = 0
    for (let t = 0; t <= 1; t += 0.001) peak = Math.max(peak, cartoonEase(t))
    expect(peak).toBeCloseTo(1.0706, 3)
  })
  it('then comes back down to 1 (settles)', () => {
    expect(cartoonEase(0.95)).toBeLessThan(cartoonEase(0.7))
    expect(cartoonEase(0.95)).toBeGreaterThan(1)
  })
  it('clamps its input: values outside 0..1 behave like the ends', () => {
    expect(cartoonEase(-3)).toBeCloseTo(0)
    expect(cartoonEase(7)).toBeCloseTo(1)
  })
})

describe('lerp and clamp01', () => {
  it('lerp blends linearly: 10 -> 20 at 0.25 = 12.5', () => {
    expect(lerp(10, 20, 0.25)).toBeCloseTo(12.5)
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(10, 20, 1)).toBe(20)
  })
  it('clamp01 limits to 0..1', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(9)).toBe(1)
  })
})
