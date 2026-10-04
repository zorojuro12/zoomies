import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: shared } },
  preload: { resolve: { alias: shared } },
  renderer: {
    resolve: { alias: shared },
    // Contract §3.10: the repo-root assets/ folder is served as the renderer's public dir,
    // so assetUrl('dog/x.dog.json') works in dev and in the packaged build.
    publicDir: resolve('../assets'),
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          // Lane B's dog preview page (open /preview.html from the dev server).
          preview: resolve('src/renderer/preview.html')
        }
      }
    }
  }
})
