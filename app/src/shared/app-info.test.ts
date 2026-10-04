import { describe, expect, it } from 'vitest'
import { APP_NAME, FRAME_BUDGET_MS } from '@shared/app-info'

describe('app-info', () => {
  it('names the app', () => {
    expect(APP_NAME).toBe('Zoomies')
  })

  it('budgets a 60 FPS frame', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(16.667, 2)
  })
})
