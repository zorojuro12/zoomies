// §3.10 Asset loading — the repo-root assets/ folder is served to the renderer as its public
// directory (electron.vite.config.ts). Always build URLs with assetUrl() so the same path works
// in `npm run dev` (dev server) and in the packaged build (file://).
//   assetUrl('dog/placeholder.dog.json') → './dog/placeholder.dog.json'

export function assetUrl(path: string): string {
  return `./${path.replace(/^\/+/, '')}`
}

export const ASSETS = {
  photo: 'photo/dog.jpeg',
  placeholderDog: 'dog/placeholder.dog.json',
  dog: 'dog/aussie.dog.json',
  landmarks: 'views/landmarks.json'
} as const
