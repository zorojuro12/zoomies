// How the app host gets its dog (Lane A calls createDog; everything dog-specific stays in Lane B).
//
//   const dog = await createDog(ctx)            // the demo dog (the Aussie)
//   const dog = await createDog(ctx, 'golden')  // any assets/dog/<name>.spec.json
//
// The host must NEVER end up without a dog, so there are two fallbacks:
//   1. the spec file cannot be loaded -> build the default template dog instead;
//   2. the SDF dog fails to start (e.g. a GPU that cannot compile the shader) -> use the
//      placeholder dog, so the window still shows something that moves.
// Both report why through `onFallback`, so the host can log it or show it.
import { assetUrl } from '@shared/assets'
import type { DogController } from '@shared/dog-controller'
import type { DogFile } from '@shared/dog-file'
import { validateDogFile } from '@shared/dog-file'
import type { DogRenderContext, DogView } from '@shared/dog-view'
import { loadJson } from '../host/scene'
import { PlaceholderDog } from './placeholder/placeholder-dog'
import { SdfDog } from './sdf/SdfDog'
import { buildDog } from './spec/build-dog'

/** The demo dog: the spec in assets/dog/ that the app shows by default. */
export const DEFAULT_DOG_SPEC = 'aussie'

/** What the host needs from a dog: render it, drive it, and drop it at a spot. */
export type HostDog = DogView & DogController & { placeAt(x: number, y: number): void }

/**
 * Load assets/dog/<name>.spec.json and build the dog file from it. Never throws: a missing or
 * broken file gives the default template dog, and `onFallback` is told what went wrong.
 */
export async function loadDogFile(
  specName: string,
  load: (url: string) => Promise<unknown> = loadJson,
  onFallback: (reason: unknown) => void = () => {}
): Promise<DogFile> {
  let raw: unknown
  try {
    raw = await load(assetUrl(`dog/${specName}.spec.json`))
  } catch (err) {
    onFallback(err)
    raw = {} // the builder turns this into the default template dog
  }
  const dog = buildDog(raw)
  const problems = validateDogFile(dog)
  if (problems.length > 0) {
    onFallback(new Error(`built an invalid dog: ${problems.join('; ')}`))
    return buildDog({})
  }
  return dog
}

/** Create, initialise and return the dog for the app host. */
export async function createDog(
  ctx: DogRenderContext,
  specName: string = DEFAULT_DOG_SPEC,
  onFallback: (reason: unknown) => void = (reason) => console.error('[dog] fallback:', reason)
): Promise<HostDog> {
  const file = await loadDogFile(specName, loadJson, onFallback)
  try {
    const dog = new SdfDog()
    await dog.init(ctx, file)
    return dog
  } catch (err) {
    onFallback(err)
    const placeholder = new PlaceholderDog()
    await placeholder.init(ctx, await loadJson<DogFile>(assetUrl('dog/placeholder.dog.json')))
    return placeholder
  }
}
