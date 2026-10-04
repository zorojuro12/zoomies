import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: shared } },
  preload: { resolve: { alias: shared } },
  renderer: { resolve: { alias: shared } }
})
