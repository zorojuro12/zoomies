import { describe, expect, it } from 'vitest'
import { assetUrl } from '@shared/assets'

describe('assetUrl', () => {
  it('builds relative URLs that work in dev and packaged builds', () => {
    expect(assetUrl('dog/placeholder.dog.json')).toBe('./dog/placeholder.dog.json')
    expect(assetUrl('/sounds/bark_happy_1.mp3')).toBe('./sounds/bark_happy_1.mp3')
  })
})
