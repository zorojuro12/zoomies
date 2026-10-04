# Lane A P1 — Windows Overlay, OS Layer, Activity, World & Ball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `executing-plans` skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app host into the real desktop pet shell on Windows: a transparent, always-on-top, click-through overlay hosting Daniel's dog, fed by the live window list and typing/mouse activity, with a world SDF, a bouncing ball and a mouse slingshot — everything CP1 checks.

**Architecture:** The main process owns the overlay window, the Windows `OsLayer` (window list via `koffi` → Win32/DWM, activity via `uiohook-napi` + `powerMonitor`) and pushes data to the renderer over the typed channels in `@shared/ipc`. Every rule that can fail silently (window filtering, activity rates, frame stats, click-through gating, world SDF, ball physics, slingshot) is a pure module with Vitest tests; the native glue around it is thin and checked by hand on Windows. The renderer host keeps using Daniel's `createDog()`.

**Tech Stack:** Electron 39, electron-vite 5, TypeScript, Three.js 0.186, Vitest 5, new deps `koffi` (Win32 FFI) and `uiohook-napi` (global input hooks) — both N-API with Windows x64 prebuilds.

**Spec:** `docs/specs/2026-10-03-zoomies-prd.md` + the lane file
(`docs/plans/lane-a-ansh.md`, P1 section) + the contracts
(`docs/plans/00-shared.md` §3, code in `app/src/shared/`) — executors read all three

**Branch:** `a/p1-overlay` (exists; `origin/dev` with Daniel's PRs #9–#19 merged in, 463 tests green).

## Global Constraints

- **Node 22+** (`vitest` needs `^22.12 || ^24`); on Windows `nvm use 22.22.0`. All commands run from `app/`.
- **Coordinates:** world units are desktop pixels (DIP), origin top-left of the primary display, x right, **y down**. The overlay window covers the primary display's full `bounds`, so `clientX/clientY` = world coordinates.
- **Hot paths don't allocate:** render loop, `FrameStats`, `World.distance/normal`, `stepBall` reuse preallocated objects/typed arrays and mutate in place.
- **Nothing slow in the frame loop:** IPC is push-based (main → renderer); the renderer never awaits IPC inside a frame.
- **Privacy:** activity is **timing only**. The `uiohook` keydown handler reduces each event to one boolean (`isBackspace`) and drops the event; key codes are never stored, logged or sent. Window titles are never logged.
- **Electron security:** `contextIsolation` stays on; the renderer only gets the typed `window.zoomies` API from the preload; main validates every payload it receives (`typeof === 'boolean'`).
- **No contract change:** use only the channels already in `app/src/shared/ipc.ts` (`os:windows`, `os:workArea`, `os:activity`, `os:setClickThrough`). If a task seems to need a new channel, stop and ask Ansh — contracts change only in a small separate PR.
- **Lane folders:** edit only `app/src/main/`, `app/src/preload/`, `app/src/renderer/{main.ts,index.html,host/,world/}`. `app/src/renderer/dog/` is Daniel's — call `createDog()` / `HostDog`, never edit them.
- **`app/package.json` is a shared hot file:** adding `koffi` and `uiohook-napi` is fine, but tell the group chat ("run `npm install` after pulling `dev`").
- **Windows is the demo target:** every manual checkpoint runs on the Windows demo laptop (Electron on the RTX 2060 — GPU preference is already set for `node_modules/electron/dist/electron.exe`). A pass in WSL or on a Mac doesn't count.
- **Mac/WSL must keep working:** on non-Windows, or with `ZOOMIES_WINDOWED=1`, the app opens the old normal window with `StubOsLayer`; native modules are only loaded on `win32`.
- Commits: `type: description`, `git add` exact paths, each commit chained behind its test.

## Review Focus

1. **Display scaling at 125% / 150%** — DWM returns physical pixels; window outlines must still line up with real windows. → Task 4 test (converter applied) + manual check at 125%.
2. **A maximized or full-screen window** covers the whole work area — the ball must not be trapped inside a solid. → Task 6 `worldSolids` test.
3. **A window moved on top of a resting ball** — the ball is pushed out to the nearest free space, not stuck or launched. → Task 7 test.
4. **A long frame hitch** (DevTools pause, laptop wake: `dt` ≥ 1000 ms) — the ball doesn't tunnel through the floor or gain energy. → Task 7 test.
5. **`uiohook-napi` fails to load on this Electron** — the app still starts; mouse speed comes from cursor polling and typing reports nothing, logged once. → Task 5 fallback + manual check.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/main/index.ts` (modify) | App lifecycle: choose overlay vs windowed, create OS layer, wire IPC, tray Quit |
| `app/src/main/overlay-window.ts` (create) | Build the overlay `BrowserWindow` (or the windowed fallback); follow display changes |
| `app/src/main/ipc-main.ts` (create) | Typed `sendTo(win, channel, payload)` + handlers for `os:setClickThrough`, `os:windows`, `os:workArea` |
| `app/src/main/os/window-list.ts` (+ `.test.ts`) | Pure: raw Win32 window records → filtered, DIP-converted, z-ordered `WindowRect[]`; `sameWindows` diff |
| `app/src/main/os/win32-windows.ts` | `koffi` glue: `EnumWindows` + `DwmGetWindowAttribute` → raw records (Windows only) |
| `app/src/main/os/activity-tracker.ts` (+ `.test.ts`) | Pure: key/mouse timestamps → `ActivityEvent`s on a tick |
| `app/src/main/os/activity-hooks.ts` | `uiohook-napi` + `powerMonitor` glue feeding `ActivityTracker`; cursor-poll fallback |
| `app/src/main/os/windows-os-layer.ts` | `WindowsOsLayer implements OsLayer` (window poll, work area, taskbar, activity, click-through) |
| `app/src/main/os/create-os-layer.ts` | `win32` + not windowed → `WindowsOsLayer`, else `StubOsLayer` |
| `app/src/preload/index.ts`, `index.d.ts` (modify) | Expose typed `window.zoomies` |
| `app/src/renderer/host/frame-stats.ts` (+ `.test.ts`) | Pure: rolling frame interval / work time → fps, avg, p95 |
| `app/src/renderer/host/hud.ts` | FPS / frame-time / world / activity readout in `#status` |
| `app/src/renderer/host/click-through.ts` (+ `.test.ts`) | Pure: cursor-over-interactive → when to toggle click-through (with hold time) |
| `app/src/renderer/world/world-sdf.ts` (+ `.test.ts`) | Pure: `sdBox`, `worldSolids`, `World.distance/normal` |
| `app/src/renderer/world/ball.ts` (+ `.test.ts`) | Pure: `Ball` state + `stepBall` integrator |
| `app/src/renderer/world/slingshot.ts` (+ `.test.ts`) | Pure: drag → `{angle, power}` → launch velocity |
| `app/src/renderer/world/world-view.ts` | Three.js ball mesh, aim line, debug outlines of solids |
| `app/src/renderer/main.ts`, `index.html` (modify) | Host: overlay mode, loop with stats, world, ball, slingshot, IPC |

---

### Task 1: The overlay window (+ measure its cost)

**Files:**
- Create: `app/src/main/overlay-window.ts`
- Modify: `app/src/main/index.ts`, `app/src/renderer/index.html`, `app/src/renderer/main.ts`

**Interfaces:**
- Produces: `createAppWindow(opts: { overlay: boolean; debug: boolean }): BrowserWindow`; `isOverlayMode(): boolean` (= `process.platform === 'win32' && process.env.ZOOMIES_WINDOWED !== '1'`). The renderer URL gets `?overlay=1` in overlay mode and `&debug=1` when `ZOOMIES_DEBUG=1`.

**Checkpoint 1 (manual): transparent, always-on-top, click-through overlay with the dog on the taskbar**

- [ ] **Step 1: Implement** — Contract:
  - Overlay: `BrowserWindow` at `screen.getPrimaryDisplay().bounds` with `transparent: true, frame: false, resizable: false, movable: false, skipTaskbar: true, hasShadow: false, focusable: false, fullscreenable: false, backgroundColor: '#00000000', show: false`, preload as today, `contextIsolation: true`. On `ready-to-show`: `setAlwaysOnTop(true, 'screen-saver')`, `setIgnoreMouseEvents(true, { forward: true })`, `showInactive()`. On `screen` `display-metrics-changed`/`display-added`/`display-removed`: `setBounds(primary.bounds)`.
  - Windowed (non-win32 or `ZOOMIES_WINDOWED=1`): today's 900×670 window, unchanged.
  - The window can't take focus, so F12 won't open DevTools: with `ZOOMIES_DEVTOOLS=1` call `webContents.openDevTools({ mode: 'detach' })`.
  - No taskbar icon → add a `Tray` (`resources/icon.png`) with one menu item **Quit Zoomies** → `app.quit()`.
  - Log the active GPU once at startup: `app.getGPUInfo('basic')` → print the `gpuDevice` entry with `active: true` (vendor/device id only).
  - Renderer: with `?overlay=1`, set `document.body.style.background = 'transparent'`; the dog's ground is `window.innerHeight - 48` for now (Task 4 replaces it with the real work area). The old "click to call the dog" handler stays only in windowed mode (clicks pass through in the overlay).
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop.
  Steps: `git pull`, `cd app && npm run dev`. Open Notepad and a browser.
  Expected: no Zoomies window frame and no taskbar button; the Aussie stands near the bottom of the screen **over** other apps; clicking/typing in Notepad and the browser works everywhere (all clicks pass through, even on the dog — click-through gating comes in Task 3); clicking the taskbar doesn't hide the dog; a tray icon's **Quit Zoomies** closes the app; the terminal prints the NVIDIA GPU as active.
- [ ] **Step 3: Commit** — `git add app/src/main/overlay-window.ts app/src/main/index.ts app/src/renderer/index.html app/src/renderer/main.ts && git commit -m "feat: transparent always-on-top click-through overlay window"`

**Checkpoint 2 (manual): measure the full-screen overlay's cost and decide**

- [ ] **Step 1: Implement** — Contract: with `ZOOMIES_DEBUG=1`, the host makes the dog patrol (`moveTo` 25% ↔ 75% of the width, `'trot'`, repeat) so there is constant motion. No other change.
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop, plugged in, few apps open.
  Steps: (a) `npm run dev` (dog standing idle) — Task Manager → Processes → GPU % of the Zoomies/Electron processes for 20 s; (b) `$env:ZOOMIES_DEBUG=1; npm run dev` (patrolling) — same; (c) `$env:ZOOMIES_WINDOWED=1; npm run dev` — same, for comparison.
  Expected: three GPU % numbers written down. **Decision rule:** idle overlay ≤ 10 % GPU and no visible stutter while patrolling → keep the full-screen overlay. Otherwise → record "fallback: dog-following small window" as the first P2 task (don't build it in P1).
- [ ] **Step 3: Commit** — record the numbers and the decision in `docs/plans/lane-a-ansh.md` (P1 "Measure the full-screen transparent overlay cost" bullet → `[x]` + numbers): `git add app/src/renderer/main.ts docs/plans/lane-a-ansh.md && git commit -m "perf: measure full-screen overlay cost on Windows; debug patrol"`

---

### Task 2: Real frame-time readout (FPS overlay)

**Files:**
- Create: `app/src/renderer/host/frame-stats.ts`, `app/src/renderer/host/frame-stats.test.ts`, `app/src/renderer/host/hud.ts`
- Modify: `app/src/renderer/main.ts`

**Interfaces:**
- Produces: `class FrameStats { constructor(capacity = 120); add(frameMs: number, workMs: number): void; fps(): number; frameAvg(): number; frameP95(): number; workAvg(): number; workP95(): number; workMax(): number; count(): number }` — ring buffers of `Float64Array(capacity)`, one preallocated scratch `Float64Array` for p95 (copy → `sort()` → index `Math.floor(0.95 * (n - 1))`). Empty → every getter returns `0`.
- Produces: `class Hud { constructor(el: HTMLElement); set(field: 'world' | 'activity', text: string): void; frame(stats: FrameStats, nowMs: number): void }` — rewrites `el.textContent` at most every 250 ms: `fps 144 · frame p95 7.0 ms · work 0.8 / p95 1.1 ms · <world> · <activity>`.
- "Work" = `performance.now()` around `dog.update` + world step + `renderer.render` (CPU submit time). GPU cost shows as fps falling below the refresh rate, plus Task Manager.

**Checkpoint 1: rolling averages and p95**

- [ ] **Step 1: Write failing tests** — Spec: (a) 120 × `add(16.667, 1)` → `fps()` = 60.0 ± 0.1, `frameAvg()` = 16.667 ± 0.001, `workAvg()` = 1; (b) capacity 120, 114 × `add(16.7, 1)` + 6 × `add(16.7, 50)` → `workP95()` = 50, `workMax()` = 50; 119 × work 1 + 1 × work 50 → `workP95()` = 1; (c) 3 samples (work 1, 2, 3) → `count()` = 3, `workAvg()` = 2 (not divided by 120); (d) 200 samples into capacity 120 → `count()` = 120 and only the last 120 count (first 80 work = 100, last 120 work = 1 → `workAvg()` = 1); (e) empty → `fps()` = 0, `workP95()` = 0.
- [ ] **Step 2: Run** — `cd app && npx vitest run src/renderer/host/frame-stats.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `FrameStats` per Interfaces.
- [ ] **Step 4: Run** — same command → PASS, 5 tests listed in the count.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/host/frame-stats.test.ts && git add app/src/renderer/host/frame-stats.ts app/src/renderer/host/frame-stats.test.ts && git commit -m "feat: rolling frame stats (fps, avg, p95) for the FPS overlay"`

**Checkpoint 2 (manual): HUD in the overlay**

- [ ] **Step 1: Implement** — `Hud` per Interfaces; host loop measures frame interval + work and calls `stats.add` / `hud.frame` every frame (no allocation in the loop: no template strings except inside the 250 ms throttle).
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop. Steps: `npm run dev`. Expected: bottom-left readout shows fps at the monitor's refresh rate (~144) and a **work** time well under the frame time (≈ 1 ms), updating ~4×/s — the old single "6.9 ms" number is gone.
- [ ] **Step 3: Commit** — `git add app/src/renderer/host/hud.ts app/src/renderer/main.ts && git commit -m "feat: FPS / frame-time overlay with real work time"`

---

### Task 3: Typed IPC bridge + click-through only off the dog

**Files:**
- Create: `app/src/main/ipc-main.ts`, `app/src/renderer/host/click-through.ts`, `app/src/renderer/host/click-through.test.ts`
- Modify: `app/src/preload/index.ts`, `app/src/preload/index.d.ts`, `app/src/main/index.ts`, `app/src/renderer/main.ts`

**Interfaces:**
- Produces (main): `sendTo<C extends IpcChannel>(win: BrowserWindow, channel: C, payload: IpcChannels[C]): void`; `registerIpc(os: OsLayer): void` — `ipcMain.on('os:setClickThrough', (_e, v) => typeof v === 'boolean' && os.setClickThrough(v))`, `ipcMain.handle('os:windows', () => os.getWindows())`, `ipcMain.handle('os:workArea', () => os.getWorkArea())`.
- Produces (preload, `window.zoomies`): `{ getWindows(): Promise<WindowRect[]>; getWorkArea(): Promise<Rect>; onWindows(cb: (w: WindowRect[]) => void): () => void; onWorkArea(cb: (r: Rect) => void): () => void; onActivity(cb: (e: ActivityEvent) => void): () => void; setClickThrough(enabled: boolean): void }` — typed in `index.d.ts`; channel names only from `IpcChannel`.
- Produces (renderer): `class ClickThroughGate { constructor(holdMs = 150); update(nowMs: number, overInteractive: boolean): 'interactive' | 'clickThrough' | null }` — starts in click-through; returns a value only when the state changes. Becomes `'interactive'` immediately when `overInteractive`; returns to `'clickThrough'` only after `overInteractive` has been false continuously for ≥ `holdMs`.
- `overInteractive` (host) = `dog.hitTest(x, y) || ballHit(x, y) || dragging` (ball parts arrive in Task 8; until then just the dog).
- Main side for the overlay: `setClickThrough(true)` → `win.setIgnoreMouseEvents(true, { forward: true })`; `false` → `win.setIgnoreMouseEvents(false)`.

**Checkpoint 1: the gate**

- [ ] **Step 1: Write failing tests** — Spec: (a) new gate, `update(0, false)` → `null`; (b) `update(0, true)` → `'interactive'`, then `update(16, true)` → `null`; (c) after interactive: `update(32, false)` → `null`, `update(100, false)` → `null`, `update(183, false)` → `'clickThrough'` (≥ 150 ms after 32); (d) interactive, `update(32, false)`, `update(80, true)`, `update(250, false)` → `null` (hold restarts at 250), `update(400, false)` → `'clickThrough'`.
- [ ] **Step 2: Run** — `npx vitest run src/renderer/host/click-through.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `ClickThroughGate` per Interfaces.
- [ ] **Step 4: Run** → PASS, 4 tests.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/host/click-through.test.ts && git add app/src/renderer/host/click-through.ts app/src/renderer/host/click-through.test.ts && git commit -m "feat: click-through gate with hold time"`

**Checkpoint 2 (manual): clicks pass through except on the dog**

- [ ] **Step 1: Implement** — `ipc-main.ts`, preload API, `registerIpc(StubOsLayer)` for now (the Windows layer arrives in Task 4; `StubOsLayer.setClickThrough` is a no-op, so in this checkpoint the overlay window's `setIgnoreMouseEvents` is called from an `onClickThrough` callback passed by `index.ts`). Host: on every `mousemove` (forwarded while click-through) feed the gate and `dog.lookAt`; when it returns a state, call `window.zoomies.setClickThrough(state === 'clickThrough')`. Overlay mode: clicking the dog → `dog.setPose('sit')` (proves the click arrived).
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop. Steps: `npm run dev`; click on the desktop/Notepad right next to the dog, then on the dog.
  Expected: clicks next to the dog reach the app underneath; clicking the dog makes it sit; the dog's head follows the cursor across the whole screen even over other apps; no flicker of the cursor when moving across the dog's edge.
- [ ] **Step 3: Commit** — `git add app/src/main/ipc-main.ts app/src/main/index.ts app/src/preload/index.ts app/src/preload/index.d.ts app/src/renderer/main.ts && git commit -m "feat: typed IPC bridge; overlay is clickable only on the dog"`

---

### Task 4: Windows OS layer — live window list, work area, taskbar

**Files:**
- Create: `app/src/main/os/window-list.ts`, `app/src/main/os/window-list.test.ts`, `app/src/main/os/win32-windows.ts`, `app/src/main/os/windows-os-layer.ts`, `app/src/main/os/create-os-layer.ts`
- Modify: `app/package.json` (+ `koffi`), `app/src/main/index.ts`, `app/src/renderer/main.ts`

**Interfaces:**
- Produces: `interface RawWindow { id: string; title: string; visible: boolean; minimized: boolean; cloaked: boolean; toolWindow: boolean; rect: Rect /* physical px, DWM extended frame bounds */ }` (array order = EnumWindows order = topmost first).
- Produces: `toWindowRects(raw: readonly RawWindow[], opts: { selfIds: ReadonlySet<string>; display: Rect /* DIP */; toDip: (r: Rect) => Rect }): WindowRect[]` — keep a window only if `visible && !minimized && !cloaked && !toolWindow && title.trim() !== '' && !selfIds.has(id) && title !== 'Program Manager'`; convert with `toDip`; drop if `w < 50 || h < 50` (DIP) or it doesn't intersect `display`; `z` = index among the kept windows (0 = topmost); `minimized: false`; coordinates rounded to integers.
- Produces: `sameWindows(a: readonly WindowRect[], b: readonly WindowRect[]): boolean` — equal length and, per index, equal `id, x, y, w, h`.
- Produces: `taskbarRect(bounds: Rect, workArea: Rect): Rect | null` — the strip of `bounds` outside `workArea` (bottom, top, left or right); `null` when they're equal (auto-hide).
- Produces: `class WindowsOsLayer implements OsLayer` — `start(win: BrowserWindow, onWindows: (w: WindowRect[]) => void, onWorkArea: (r: Rect) => void): void` polls `listRawWindows()` every **150 ms**, sends only when `!sameWindows(prev, next)`; sends the work area at start and on display changes. `selfIds` = the overlay's HWND (`win.getNativeWindowHandle()` read as an unsigned 64-bit little-endian integer → decimal string, the same format `win32-windows.ts` uses for ids). `toDip` = `r => screen.screenToDipRect(null, r)`.
- Produces: `listRawWindows(): RawWindow[]` (`win32-windows.ts`, `koffi`): `user32` `EnumWindows`, `IsWindowVisible`, `IsIconic`, `GetWindowTextW`, `GetWindowLongPtrW(hwnd, GWL_EXSTYLE = -20)` (`WS_EX_TOOLWINDOW = 0x80`); `dwmapi` `DwmGetWindowAttribute` with `DWMWA_EXTENDED_FRAME_BOUNDS = 9` (RECT) and `DWMWA_CLOAKED = 14` (DWORD ≠ 0 → cloaked). Loaded with a dynamic `import('koffi')` only on `win32`.
- Produces: `createOsLayer(overlay: boolean): OsLayer` — `WindowsOsLayer` when overlay, else `StubOsLayer` (its two fake windows still flow through `os:windows` so Mac/WSL get a world too).
- Renderer: ground = work area bottom (`workArea.y + workArea.h`) instead of `innerHeight - 48`; HUD `world` field = `<n> windows`.

**Checkpoint 1: filtering and z-order**

- [ ] **Step 1: Write failing tests** — Spec, with `display = {0,0,1920,1080}`, `toDip = identity`, `selfIds = {'1'}`: input (topmost first) `[self '1', 'Notepad' visible, 'Hidden' !visible, 'Min' minimized, 'Cloaked' cloaked, 'Tool' toolWindow, '' empty title, 'Program Manager', 'Tiny' 40×40, 'OffScreen' at x 2000, 'Chrome' visible]` → exactly `[Notepad z 0, Chrome z 1]`, both `minimized: false`; rect `{x: 10.4, y: 20.6, w: 300.2, h: 200.5}` → `{10, 21, 300, 201}`.
- [ ] **Step 2: Run** — `npx vitest run src/main/os/window-list.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `toWindowRects`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/main/os/window-list.test.ts && git add app/src/main/os/window-list.ts app/src/main/os/window-list.test.ts && git commit -m "feat: window list filter and z-order (pure)"`

**Checkpoint 2: display scaling, diffing, taskbar**

- [ ] **Step 1: Write failing tests** — Spec: (a) `toDip = r => ({x: r.x/1.25, y: r.y/1.25, w: r.w/1.25, h: r.h/1.25})`, raw rect `{125, 250, 1250, 625}` → `{100, 200, 1000, 500}`; a raw 60×60 window → dropped (48×48 DIP < 50); (b) `sameWindows` true for equal lists, false when one `x` differs by 1, false for different lengths; (c) `taskbarRect({0,0,1920,1080}, {0,0,1920,1032})` → `{0,1032,1920,48}`; top taskbar `{0,40,1920,1040}` → `{0,0,1920,40}`; left `{60,0,1860,1080}` → `{0,0,60,1080}`; equal → `null`.
- [ ] **Step 2: Run** → FAIL (`sameWindows`/`taskbarRect` not exported; scaling case fails if `toDip` is applied after the size filter).
- [ ] **Step 3: Implement** `sameWindows`, `taskbarRect`; make sure the size filter runs on DIP values.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/main/os/window-list.test.ts && git add app/src/main/os/window-list.ts app/src/main/os/window-list.test.ts && git commit -m "feat: DIP conversion, window diffing and taskbar rect"`

**Checkpoint 3 (manual): live window list on Windows**

- [ ] **Step 1: Implement** — `npm install koffi` (in `app/`), `win32-windows.ts`, `windows-os-layer.ts`, `create-os-layer.ts`; `index.ts` uses `createOsLayer(isOverlayMode())`, `registerIpc(os)`, `os.start(...)` with `sendTo(win, 'os:windows', …)` / `sendTo(win, 'os:workArea', …)`; `WindowsOsLayer.setClickThrough` does what Task 3's callback did (remove the callback). Renderer subscribes via `window.zoomies.onWindows/onWorkArea` (+ initial `getWindows/getWorkArea`). With `?debug=1`, draw a 1 px outline of each window rect (temporary 2D canvas over the WebGL canvas, replaced by `world-view.ts` in Task 6).
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop, at 100 % and then 125 % display scaling (Settings → Display → Scale; restart the app after changing).
  Steps: `$env:ZOOMIES_DEBUG=1; npm run dev`; open Notepad and a browser, drag them around, minimize one, open the Start menu.
  Expected: outlines sit exactly on the real windows' edges at both scales and follow drags within ~0.2 s; minimized windows and the Start menu/taskbar/overlay itself have no outline; HUD shows the window count; the dog stands on the taskbar's top edge. Also: on WSL/Mac `npm run dev` still opens the normal window with 2 stub outlines in debug mode.
- [ ] **Step 3: Commit** — `git add app/package.json app/package-lock.json app/src/main/os/win32-windows.ts app/src/main/os/windows-os-layer.ts app/src/main/os/create-os-layer.ts app/src/main/index.ts app/src/main/ipc-main.ts app/src/renderer/main.ts && git commit -m "feat: Windows OS layer - live window list, work area, taskbar"` — then tell the group chat: "`koffi` added, run `npm install` after pulling `dev`".

---

### Task 5: Activity — typing rate, backspace ratio, mouse speed, idle

**Files:**
- Create: `app/src/main/os/activity-tracker.ts`, `app/src/main/os/activity-tracker.test.ts`, `app/src/main/os/activity-hooks.ts`
- Modify: `app/package.json` (+ `uiohook-napi`), `app/src/main/os/windows-os-layer.ts`, `app/src/main/index.ts`, `app/src/renderer/main.ts`

**Interfaces:**
- Produces: `class ActivityTracker { constructor(opts?: { typingWindowMs?: number /* 2000 */; mouseWindowMs?: number /* 250 */ }); key(tMs: number, isBackspace: boolean): void; mouse(tMs: number, x: number, y: number): void; typing(tMs: number): { keysPerSec: number; backspaceRatio: number }; mouseSpeed(tMs: number): number /* px/s */; tick(tMs: number, idleSeconds: number): ActivityEvent[] }` — preallocated ring buffers (keys: 512 timestamps + backspace flags; mouse: 64 samples). **The API takes no key codes** — only the boolean.
  - `keysPerSec` = keys with `t > tMs - typingWindowMs` ÷ (`typingWindowMs` / 1000); `backspaceRatio` = backspaces ÷ keys in that window, `0` when there are none.
  - `mouseSpeed` = path length of samples with `t > tMs - mouseWindowMs` ÷ (their time span / 1000); `0` with fewer than 2 samples.
  - `tick` (called every 100 ms by the hooks): a `typing` event every 500 ms while `keysPerSec > 0`, plus exactly one `typing` event with `keysPerSec: 0` when it drops to 0; a `mouse` event (last x, y, speed) when `mouseSpeed > 0`, at most every 100 ms; an `idle` event `{ seconds: idleSeconds }` every 1000 ms.
- Produces: `startActivityHooks(tracker: ActivityTracker, emit: (e: ActivityEvent) => void): () => void` (`activity-hooks.ts`) — dynamic `import('uiohook-napi')`; `keydown` → `tracker.key(now, e.keycode === UiohookKey.Backspace)` (nothing else read from the event); `mousemove` → `tracker.mouse(now, …)` with the point converted by `screen.screenToDipPoint`; a 100 ms `setInterval` → `tracker.tick(now, powerMonitor.getSystemIdleTime())` → `emit` each event. If the import or `uIOhook.start()` throws: log `[activity] uiohook unavailable, mouse via cursor polling, no typing` once, and instead poll `screen.getCursorScreenPoint()` every 50 ms into `tracker.mouse`. Returns a stop function (`uIOhook.stop()` / `clearInterval`), called on `app` `will-quit`.
- `WindowsOsLayer.onActivity(cb)` wires `startActivityHooks`; main forwards each event with `sendTo(win, 'os:activity', e)`. Renderer HUD `activity` field = `<keysPerSec> kps · bs <ratio> · mouse <speed> px/s · idle <s>s`.

**Checkpoint 1: typing rate and backspace ratio**

- [ ] **Step 1: Write failing tests** — Spec: (a) 10 keys at t = 0, 100, …, 900, none backspace → `typing(1000)` = `{keysPerSec: 5, backspaceRatio: 0}`; (b) same keys, `typing(3000)` → `{0, 0}` (all older than 2 s); (c) 10 keys of which 2 backspace → `backspaceRatio` 0.2; (d) no keys → `backspaceRatio` 0 (not `NaN`); (e) 600 keys within 1 s (beyond the 512 buffer) → no throw, `keysPerSec` = 256 (512 kept ÷ 2 s).
- [ ] **Step 2: Run** — `npx vitest run src/main/os/activity-tracker.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `key` and `typing`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/main/os/activity-tracker.test.ts && git add app/src/main/os/activity-tracker.ts app/src/main/os/activity-tracker.test.ts && git commit -m "feat: activity tracker - typing rate and backspace ratio (timing only)"`

**Checkpoint 2: mouse speed**

- [ ] **Step 1: Write failing tests** — Spec: (a) `mouse(0, 0, 0)`, `mouse(100, 100, 0)` → `mouseSpeed(100)` = 1000; (b) `mouse(0,0,0)`, `mouse(50,30,40)`, `mouse(100,30,80)` → path 50 + 40 = 90 px over 0.1 s → 900; (c) samples at t 0 and 100, `mouseSpeed(600)` → 0 (outside the 250 ms window); (d) a single sample → 0.
- [ ] **Step 2: Run** → FAIL (`mouse`/`mouseSpeed` missing).
- [ ] **Step 3: Implement** `mouse`, `mouseSpeed`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/main/os/activity-tracker.test.ts && git add app/src/main/os/activity-tracker.ts app/src/main/os/activity-tracker.test.ts && git commit -m "feat: activity tracker - mouse speed"`

**Checkpoint 3: event emission on tick**

- [ ] **Step 1: Write failing tests** — Spec (ticks every 100 ms from t = 0): (a) a key at t = 0; ticks 100…1000 → `typing` events at t = 500 and t = 1000 only (`keysPerSec` 0.5); at t = 2000 the key falls out of the window (it counts only while `t > tMs − 2000`), so the tick at t = 2000 emits one `typing` with `keysPerSec: 0`, and ticks 2100…3000 emit no `typing` event; (b) `idle` events at t = 1000, 2000, 3000 carrying the `idleSeconds` passed in; (c) mouse samples every 10 ms from t = 0 to 300 → `mouse` events at ≤ every 100 ms, the last one has the last x, y; no mouse samples → no `mouse` events.
- [ ] **Step 2: Run** → FAIL (`tick` missing).
- [ ] **Step 3: Implement** `tick`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/main/os/activity-tracker.test.ts && git add app/src/main/os/activity-tracker.ts app/src/main/os/activity-tracker.test.ts && git commit -m "feat: activity tracker - throttled typing, mouse and idle events"`

**Checkpoint 4 (manual): hooks on Windows**

- [ ] **Step 1: Implement** — `npm install uiohook-napi`, `activity-hooks.ts`, wiring per Interfaces; HUD `activity` field.
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop. Steps: `npm run dev`; type steadily in Notepad (another app has focus), mash Backspace, move the mouse fast, then leave the PC for 10 s.
  Expected: HUD kps rises while typing in **another app** and returns to 0 ~2 s after you stop; `bs` rises when mashing Backspace; mouse px/s rises with fast moves; idle counts up while untouched and resets on input; the terminal never prints any key or key code. Then simulate the fallback once: temporarily rename `node_modules/uiohook-napi` → app still starts, logs the "uiohook unavailable" line once, mouse speed still works; rename it back.
- [ ] **Step 3: Commit** — `git add app/package.json app/package-lock.json app/src/main/os/activity-hooks.ts app/src/main/os/windows-os-layer.ts app/src/main/index.ts app/src/renderer/main.ts && git commit -m "feat: global typing/mouse/idle activity via uiohook (timing only)"` — tell the group chat: "`uiohook-napi` added, run `npm install`".

---

### Task 6: World SDF v0

**Files:**
- Create: `app/src/renderer/world/world-sdf.ts`, `app/src/renderer/world/world-sdf.test.ts`, `app/src/renderer/world/world-view.ts`
- Modify: `app/src/renderer/main.ts`

**Interfaces:**
- Produces: `sdBox(px: number, py: number, r: Rect): number` — signed distance to the rect (negative inside).
- Produces: `worldSolids(windows: readonly WindowRect[], workArea: Rect): Rect[]` — windows clipped to `workArea`; windows covering ≥ 90 % of the work area (maximized/full-screen) are left out; result topmost first.
- Produces: `class World { static readonly MAX_SOLIDS = 64; setBounds(workArea: Rect): void; setSolids(solids: readonly Rect[]): void /* copies the first 64 into a Float64Array */; distance(px: number, py: number): number; normal(px: number, py: number, out: Point): Point }` — free space is positive: `distance = min(−sdBox(p, workArea), min over solids of sdBox(p, solid))`. `normal` = central differences with ε = 0.5, normalized, written into `out` (no allocation); returns `out`.
- Produces (`world-view.ts`): `class WorldView { constructor(scene: THREE.Scene); setDebug(on: boolean): void; setSolids(solids: readonly Rect[], workArea: Rect): void }` — thin outlines of the work area and solids (debug only); ball and aim line are added in Tasks 7–8.

**Checkpoint 1: distances and normals**

- [ ] **Step 1: Write failing tests** — Spec, `workArea = {0,0,1000,800}`: (a) no solids, `distance(500,400)` = 400, `distance(500,790)` = 10, `normal(500,790)` ≈ (0, −1) ±1e-3; (b) solid `{100,100,200,100}`: `distance(200,90)` = 10, `normal(200,90)` ≈ (0, −1); `distance(150,150)` = −50 (inside); corner `distance(90,90)` = 14.142 ± 1e-3; (c) `sdBox(0,0,{x:-5,y:-5,w:10,h:10})` = −5; (d) 70 solids passed → only the first 64 affect `distance` (a 65th solid around the test point has no effect).
- [ ] **Step 2: Run** — `npx vitest run src/renderer/world/world-sdf.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `sdBox`, `World`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/world/world-sdf.test.ts && git add app/src/renderer/world/world-sdf.ts app/src/renderer/world/world-sdf.test.ts && git commit -m "feat: world SDF - work area bounds and window solids"`

**Checkpoint 2: which windows become solids**

- [ ] **Step 1: Write failing tests** — Spec, `workArea = {0,0,1920,1032}`: (a) a window `{-50, 100, 400, 300}` → solid `{0, 100, 350, 300}` (clipped); (b) a maximized window `{0,0,1920,1032}` → left out; a 1800×980 window (≈ 89 %) → kept; (c) a window fully below the work area (`y` 1040) → left out; order stays topmost first.
- [ ] **Step 2: Run** → FAIL (`worldSolids` not exported).
- [ ] **Step 3: Implement** `worldSolids`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/world/world-sdf.test.ts && git add app/src/renderer/world/world-sdf.ts app/src/renderer/world/world-sdf.test.ts && git commit -m "feat: world solids from windows (clip, skip maximized)"`

**Checkpoint 3 (manual): debug draw**

- [ ] **Step 1: Implement** — `WorldView` (replaces Task 4's temporary 2D outlines); host updates `World` + `WorldView` on every `onWindows/onWorkArea`.
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop. Steps: `$env:ZOOMIES_DEBUG=1; npm run dev`; open two windows, maximize one, restore it. Expected: outlines on non-maximized windows and the work area edge just above the taskbar; the maximized window gets no outline; outlines are gone without `ZOOMIES_DEBUG`.
- [ ] **Step 3: Commit** — `git add app/src/renderer/world/world-view.ts app/src/renderer/main.ts && git commit -m "feat: world debug view"`

---

### Task 7: Ball physics

**Files:**
- Create: `app/src/renderer/world/ball.ts`, `app/src/renderer/world/ball.test.ts`
- Modify: `app/src/renderer/world/world-view.ts`, `app/src/renderer/main.ts`

**Interfaces:**
- Consumes: `World` (Task 6).
- Produces: `interface Ball { x: number; y: number; vx: number; vy: number; r: number; resting: boolean; contactMs: number }`, `createBall(x: number, y: number, r = 10): Ball`.
- Produces: `BALL = { gravity: 2400, restitution: 0.55, friction: 0.85, maxSpeed: 4000, restSpeed: 30, restHoldMs: 300, maxDtMs: 50, substepMs: 4 }` (px/s², px/s, ms).
- Produces: `stepBall(ball: Ball, world: World, dtMs: number): void` — mutates `ball`. `dt = min(dtMs, maxDtMs)`, split into substeps of ≤ `substepMs`. Each substep: if not resting, `vy += gravity·dt`; clamp speed to `maxSpeed`; move; `d = world.distance(x, y) − r`; if `d < 0`: push out along `world.normal` by `−d`; if `vn = v·n < 0`: `v −= (1 + restitution)·vn·n`, tangential part `*= friction`. In contact with speed < `restSpeed` for ≥ `restHoldMs` → `resting = true`, `vx = vy = 0`. A resting ball stays put unless `distance − r < 0` (something moved onto it) → push out and wake (`resting = false`). No allocation (module-level scratch `Point`).

**Checkpoint 1: falls, bounces, settles**

- [ ] **Step 1: Write failing tests** — Spec, `World` with `workArea {0,0,1000,800}`, no solids, steps of 16.667 ms: (a) `createBall(500,100)` → within 10 s simulated: `resting` true, `y` = 790 ± 1; (b) ball at (500, 700) with `vy` 1000 → right after the first contact `vy` < 0 and |`vy`| ≈ 0.55 × impact speed (± 10 %); (c) drop from y = 100: the apex after the first bounce is lower than 100 (more than 100 px of height lost); (d) gravity irrelevant: ball at (985, 400), `vx` 1000 → after one step `vx` < 0 and `x` ≤ 990.
- [ ] **Step 2: Run** — `npx vitest run src/renderer/world/ball.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `createBall`, `stepBall`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/world/ball.test.ts && git add app/src/renderer/world/ball.ts app/src/renderer/world/ball.test.ts && git commit -m "feat: ball physics against the world SDF"`

**Checkpoint 2: robustness (Review Focus 3, 4)**

- [ ] **Step 1: Write failing tests** — Spec: (a) ball resting on the floor at (300, 790); `setSolids([{250, 700, 200, 150}])` (a window dropped on it) → after one 16 ms step, `world.distance(x,y) − r` ≥ −0.5 and |v| ≤ `maxSpeed`; (b) ball falling at `vy` 3000 at y = 700, one `stepBall(…, 1000)` → `y` ≤ 790.5 (no tunnelling; only 50 ms simulated); (c) 1000 steps of 16.667 ms from rest at the floor → it never rises above y = 789 (no energy gain).
- [ ] **Step 2: Run** → FAIL (expected for (a) if the resting branch skips collision; if all three pass straight away, merge these cases into Checkpoint 1's commit instead of committing separately — don't break the code to make them fail).
- [ ] **Step 3: Implement** the resting-wake rule / dt clamp as needed.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/world/ball.test.ts && git add app/src/renderer/world/ball.ts app/src/renderer/world/ball.test.ts && git commit -m "fix: ball wakes when a window lands on it; dt clamp prevents tunnelling"`

**Checkpoint 3 (manual): ball in the overlay**

- [ ] **Step 1: Implement** — `WorldView` gets a ball mesh (`CircleGeometry`, `DoubleSide` because of the y-down camera, bright colour, `renderOrder` above the dog); host spawns the ball above the dog, steps it each frame, the dog `lookAt`s the ball while it's not resting.
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop. Steps: `npm run dev`. Expected: the ball drops, bounces on the taskbar edge a few times and settles; drag a window under it before it lands → it bounces on the window's top edge; drag a window over the resting ball → it pops out to the side or top, never stuck inside.
- [ ] **Step 3: Commit** — `git add app/src/renderer/world/world-view.ts app/src/renderer/main.ts && git commit -m "feat: ball rendered in the overlay, dog watches it"`

---

### Task 8: Mouse slingshot

**Files:**
- Create: `app/src/renderer/world/slingshot.ts`, `app/src/renderer/world/slingshot.test.ts`
- Modify: `app/src/renderer/world/world-view.ts`, `app/src/renderer/main.ts`

**Interfaces:**
- Produces: `SLING = { maxPullPx: 200, minPullPx: 8, maxLaunchSpeed: 2600, grabRadiusPx: 12 }`.
- Produces: `aimFromDrag(ballX: number, ballY: number, cursorX: number, cursorY: number): { angle: number; power: number } | null` — pull = ball − cursor; `null` if |pull| < `minPullPx`; `power = min(|pull| / maxPullPx, 1)`; `angle = atan2(pullY, pullX)` (y down, so negative = up).
- Produces: `launchVelocity(angle: number, power: number, out: { vx: number; vy: number }): void` — speed = `power · maxLaunchSpeed`.
- Produces: `ballHit(ball: Ball, x: number, y: number): boolean` — within `r + grabRadiusPx`.
- Host emits contract `InputEvent`s internally: `{kind: 'aim', angle, power}` while dragging, `{kind: 'launch', angle, power}` on release (P2's behaviour consumes them).

**Checkpoint 1: drag → aim → launch**

- [ ] **Step 1: Write failing tests** — Spec: (a) ball (500,500), cursor (400,500) → `{angle: 0, power: 0.5}`; (b) cursor (500, 900) → `angle` = −π/2 ± 1e-9, `power` 1 (clamped); (c) cursor (505, 500) → `null`; (d) `launchVelocity(0, 0.5)` → `vx` 1300, `vy` 0; `launchVelocity(−π/2, 1)` → `vx` ≈ 0, `vy` −2600; (e) `ballHit(ball r 10 at (500,500), 521, 500)` true, `(523, 500)` false.
- [ ] **Step 2: Run** — `npx vitest run src/renderer/world/slingshot.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `npx vitest run src/renderer/world/slingshot.test.ts && git add app/src/renderer/world/slingshot.ts app/src/renderer/world/slingshot.test.ts && git commit -m "feat: slingshot aim and launch mapping"`

**Checkpoint 2 (manual): fling the ball across the desktop (CP1 demo)**

- [ ] **Step 1: Implement** — `overInteractive` now includes `ballHit` and `dragging`; `pointerdown` on the ball → dragging (ball held, `resting = false`, gravity paused while held); `pointermove` → `aimFromDrag` → draw an aim line from the ball opposite the pull (length ∝ power) in `WorldView`; `pointerup` → if aim not `null`, `launchVelocity` into the ball, else drop it in place.
- [ ] **Step 2: Verify by hand** — Where: Windows demo laptop. Steps: `npm run dev`; with Notepad and a browser open, grab the resting ball, pull back, release; repeat towards a window; then grab the ball and release without pulling.
  Expected: the aim line grows as you pull; on release the ball flies opposite the pull, bounces off screen edges, window tops/sides and the taskbar edge, loses energy and settles; the dog's head tracks it; clicking anywhere else still reaches the apps underneath, including while the ball is flying; a no-pull release just drops the ball; HUD fps stays at the refresh rate.
- [ ] **Step 3: Commit** — `git add app/src/renderer/world/world-view.ts app/src/renderer/main.ts && git commit -m "feat: mouse slingshot - drag the ball, aim line, launch"`

---

### Task 9: CP1 wrap-up

**Files:**
- Modify: `docs/plans/lane-a-ansh.md` (P1 checkboxes + notes), `CLAUDE.md` only if a verified command changed (it shouldn't)
- Create: `journal/<YYYY-MM-DD_HHMM>_ansh_p1-overlay.md`

- [ ] **Step 1: Full checks** — `cd app && npm test && npm run typecheck && npm run lint` → all green; confirm the new test files appear in the count (frame-stats, click-through, window-list, activity-tracker, world-sdf, ball, slingshot).
- [ ] **Step 2: Verify by hand (CP1 demo path)** — Where: Windows demo laptop. Steps: `npm run dev` from a fresh `git pull`; run lane-a CP1: overlay + click-through, live window list feeding the world, the dog hosted, ball flung off real windows, FPS overlay. Run it twice.
  Expected: all five hold both times without restarting.
- [ ] **Step 3: Update `lane-a-ansh.md`** — tick the P1 bullets done (overlay, above taskbar, cost measured with numbers, click-through, OS layer, activity, render host, world SDF, ball + slingshot); note what moved to P2 (region rendering/scissor if Task 1's numbers didn't need it; small-window fallback if they did).
- [ ] **Step 4: Journal** — use the `journal` skill: status, the overlay-cost numbers, anything that failed on Windows (native modules, DPI), what P2 starts with (fetch sequence on `aim`/`launch` events).
- [ ] **Step 5: Commit** — `git add docs/plans/lane-a-ansh.md journal/<file> && git commit -m "docs: P1 overlay done - lane plan and journal"`. The branch is green and verified; `finishing-a-development-branch` takes it from here.

---

## Out of scope for this plan (P2+)

Fetch sequence and needs model (P2), sound cues (P2, Abel's `playSound`), adaptive FPS (P2), aim-preview trajectory and bounce prediction (P3), window terrain/walking on windows (P3), serial (P3), region rendering via scissor (only if Task 1 Checkpoint 2 says the overlay is too costly — then P2).
