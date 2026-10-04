/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS preload script (Electron loads it with require) */
// Stand-in for the app's preload (Lane B dev tool, used by shot.mjs --stub): gives the host page a fake
// `window.zoomies` (empty window list, a work area, no real OS) and lets the harness inject activity events
// with `window.__stub.emit({ kind: 'idle', seconds: 25 })`, so the REAL index.html can be run on a Mac.
const { contextBridge } = require('electron')

const activity = []
const inputs = []
const statuses = []
const buzzed = []
let interpretAnswer = 'error'
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
  onInput: (cb) => {
    inputs.push(cb)
    return () => {}
  },
  onSerialStatus: (cb) => {
    statuses.push(cb)
    return () => {}
  },
  getSerialStatus: () => Promise.resolve({ connected: false, port: null }),
  interpret: () => Promise.resolve(interpretAnswer),
  buzz: (p) => {
    buzzed.push(p)
  },
  setClickThrough: () => {}
})
contextBridge.exposeInMainWorld('__stub', {
  buzzed: () => buzzed,
  answer: (a) => {
    interpretAnswer = a
  },
  input: (e) => {
    for (const cb of inputs) cb(e)
  },
  status: (s) => {
    for (const cb of statuses) cb(s)
  },
  emit: (e) => {
    for (const cb of activity) cb(e)
  }
})
