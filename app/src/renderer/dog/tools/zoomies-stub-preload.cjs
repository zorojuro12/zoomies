// Stand-in for the app's preload (Lane B dev tool, used by shot.mjs --stub): gives the host page a fake
// `window.zoomies` (empty window list, a work area, no real OS) and lets the harness inject activity events
// with `window.__stub.emit({ kind: 'idle', seconds: 25 })`, so the REAL index.html can be run on a Mac.
// Electron preload scripts run in CommonJS regardless of the project's module setting, hence require() here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge } = require('electron')

const activity = []
contextBridge.exposeInMainWorld('zoomies', {
  getWindows: () => Promise.resolve([]),
  getWorkArea: () =>
    Promise.resolve({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - 40 }),
  onWindows: () => () => {},
  onWorkArea: () => () => {},
  onActivity: (cb) => {
    activity.push(cb)
    return () => {}
  },
  setClickThrough: () => {}
})
contextBridge.exposeInMainWorld('__stub', {
  emit: (e) => {
    for (const cb of activity) cb(e)
  }
})
