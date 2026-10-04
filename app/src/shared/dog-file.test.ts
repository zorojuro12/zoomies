import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import type { DogFile } from '@shared/dog-file'
import { validateDogFile } from '@shared/dog-file'

const placeholder = JSON.parse(
  readFileSync(resolve(__dirname, '../../../assets/dog/placeholder.dog.json'), 'utf8')
) as DogFile

describe('validateDogFile', () => {
  it('accepts the placeholder dog', () => {
    expect(validateDogFile(placeholder)).toEqual([])
  })

  it('has the poses the PlaceholderDog and behaviour rely on', () => {
    expect(Object.keys(placeholder.poses)).toEqual(
      expect.arrayContaining(['stand', 'sit', 'lie', 'sleep'])
    )
  })

  it('reports broken references', () => {
    const broken: DogFile = {
      ...placeholder,
      shapes: [{ ...placeholder.shapes[0]!, bone: 'no_such_bone' }],
      coat: [
        { shape: 'no_such_shape', pos: [0, 0, 0], scale: [1, 1, 1], color: [0, 0, 0], opacity: 1 }
      ]
    }
    const errors = validateDogFile(broken)
    expect(errors).toContain(`shape ${placeholder.shapes[0]!.id}: unknown bone no_such_bone`)
    expect(errors).toContain('coat splat: unknown shape no_such_shape')
  })
})
