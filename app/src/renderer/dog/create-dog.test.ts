// loadDogFile: how the app host gets the dog's file. It reads assets/dog/<name>.spec.json and builds
// the dog from it, and it must NEVER leave the host without a dog: if the file cannot be loaded (or
// is junk), the default template dog is built instead and the host is told why.
import { describe, expect, it, vi } from 'vitest'
import { validateDogFile } from '@shared/dog-file'
import { DEFAULT_DOG_SPEC, loadDogFile } from './create-dog'

describe('loadDogFile', () => {
  it('asks for the spec file by name under the assets folder', async () => {
    const loader = vi.fn().mockResolvedValue({ name: 'rex' })
    await loadDogFile('aussie', loader)
    expect(loader).toHaveBeenCalledWith('./dog/aussie.spec.json')
  })

  it('builds the dog from the spec it loaded (name and size come through)', async () => {
    const loader = async (): Promise<unknown> => ({ name: 'rex', size: 1.5 })
    const dog = await loadDogFile('rex', loader)
    expect(dog.name).toBe('rex')
    expect(dog.heightPx).toBe(162) // round(1.5 * 107.78): the same figure the builder tests derive by hand
  })

  it('always returns a valid dog file', async () => {
    const dog = await loadDogFile('rex', async () => ({
      name: 'rex',
      proportions: { legLength: 0.5 }
    }))
    expect(validateDogFile(dog)).toEqual([])
  })

  it('falls back to the default dog when the file cannot be loaded, and says why', async () => {
    const onFallback = vi.fn()
    const dog = await loadDogFile(
      'missing',
      async () => Promise.reject(new Error('404')),
      onFallback
    )
    expect(dog.name).toBe('dog')
    expect(validateDogFile(dog)).toEqual([])
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(String(onFallback.mock.calls[0]![0])).toContain('404')
  })

  it('does not throw when the loader gives back junk (the builder normalises it)', async () => {
    for (const junk of [null, 'banana', 42, [1, 2]]) {
      const dog = await loadDogFile('x', async () => junk)
      expect(validateDogFile(dog)).toEqual([])
    }
  })

  it('does not call the fallback when loading works', async () => {
    const onFallback = vi.fn()
    await loadDogFile('aussie', async () => ({ name: 'aussie' }), onFallback)
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('the default dog is the Aussie, our demo dog', () => {
    expect(DEFAULT_DOG_SPEC).toBe('aussie')
  })
})
