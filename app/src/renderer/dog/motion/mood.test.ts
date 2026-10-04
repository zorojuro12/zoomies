// Mood: a named feeling (happy, curious, sleepy, alert) that nudges the dog's tail, ears, head and
// eyelids on top of whatever it is doing. Pure numbers: the table, and a smoother that eases
// toward a mood instead of snapping, so a change of feeling never pops.
import { describe, expect, it } from 'vitest'
import { createMood, MOODS, moodValues, setMoodTarget, stepMood } from './mood'
import type { MoodName } from './mood'

const NAMES: MoodName[] = ['neutral', 'happy', 'curious', 'sleepy', 'alert']
const settle = (m: ReturnType<typeof createMood>, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) stepMood(m, 1 / 60)
}

describe('mood table', () => {
  it('neutral changes nothing', () => {
    expect(MOODS.neutral).toEqual({
      tail: 0,
      ears: 0,
      neck: 0,
      head: 0,
      roll: 0,
      lid: 0,
      breath: 1
    })
  })
  it('happy wags more and perks the ears; sleepy droops the ears, lowers the head and half-closes the eyes', () => {
    expect(MOODS.happy.tail).toBeGreaterThan(0.3)
    expect(MOODS.happy.ears).toBeGreaterThan(0)
    expect(MOODS.sleepy.ears).toBeLessThan(0)
    expect(MOODS.sleepy.neck).toBeGreaterThan(0) // positive = down
    expect(MOODS.sleepy.lid).toBeGreaterThan(0.3)
    expect(MOODS.sleepy.tail).toBeLessThan(0)
  })
  it('curious tilts the head; alert stands tall with ears up and eyes wide', () => {
    expect(MOODS.curious.roll).toBeGreaterThan(0)
    expect(MOODS.alert.ears).toBeGreaterThan(0.5)
    expect(MOODS.alert.neck).toBeLessThan(0) // up
    expect(MOODS.alert.lid).toBe(0)
  })
  it('keeps every value in a sane range', () => {
    for (const n of NAMES) {
      const v = MOODS[n]
      expect(Math.abs(v.tail)).toBeLessThanOrEqual(1)
      expect(Math.abs(v.ears)).toBeLessThanOrEqual(1)
      expect(Math.abs(v.neck)).toBeLessThanOrEqual(20)
      expect(Math.abs(v.head)).toBeLessThanOrEqual(20)
      expect(Math.abs(v.roll)).toBeLessThanOrEqual(30)
      expect(v.lid).toBeGreaterThanOrEqual(0)
      expect(v.lid).toBeLessThanOrEqual(0.6)
      expect(v.breath).toBeGreaterThan(0)
    }
  })
})

describe('mood smoothing', () => {
  it('starts neutral', () => {
    expect(createMood().values).toEqual(MOODS.neutral)
  })
  it('does not snap: one frame after switching to happy it is only part-way there', () => {
    const m = createMood()
    setMoodTarget(m, 'happy', 1)
    stepMood(m, 1 / 60)
    expect(m.values.tail).toBeGreaterThan(0)
    expect(m.values.tail).toBeLessThan(MOODS.happy.tail * 0.5)
  })
  it('settles on the mood after about a second', () => {
    const m = createMood()
    setMoodTarget(m, 'sleepy', 1)
    settle(m, 2)
    expect(m.values.lid).toBeCloseTo(MOODS.sleepy.lid, 2)
    expect(m.values.ears).toBeCloseTo(MOODS.sleepy.ears, 2)
  })
  it('intensity scales it: half intensity is half-way between neutral and the mood', () => {
    const m = createMood()
    setMoodTarget(m, 'happy', 0.5)
    settle(m, 2)
    expect(m.values.tail).toBeCloseTo(MOODS.happy.tail * 0.5, 2)
    expect(m.values.breath).toBeCloseTo(1 + (MOODS.happy.breath - 1) * 0.5, 2)
  })
  it('clamps intensity to 0..1 and returns to neutral at 0', () => {
    const m = createMood()
    setMoodTarget(m, 'alert', 5)
    settle(m, 2)
    expect(m.values.ears).toBeCloseTo(MOODS.alert.ears, 2)
    setMoodTarget(m, 'alert', 0)
    settle(m, 2)
    expect(m.values.ears).toBeCloseTo(0, 2)
  })
  it('moods can be switched mid-way without a jump bigger than a frame of easing', () => {
    const m = createMood()
    setMoodTarget(m, 'happy', 1)
    settle(m, 0.3)
    const before = m.values.tail
    setMoodTarget(m, 'sleepy', 1)
    stepMood(m, 1 / 60)
    expect(Math.abs(m.values.tail - before)).toBeLessThan(0.15)
  })
  it('an unknown mood name falls back to neutral instead of throwing', () => {
    const m = createMood()
    setMoodTarget(m, 'grumpy' as MoodName, 1)
    settle(m, 2)
    expect(m.values).toEqual(moodValues(MOODS.neutral))
  })
  it('does not allocate per step (values object identity is stable)', () => {
    const m = createMood()
    const v = m.values
    setMoodTarget(m, 'happy', 1)
    stepMood(m, 1 / 60)
    expect(m.values).toBe(v)
  })
})
