# 2026-10-04 — daniel — P3 serial phase C: the controller is wired into the app

**Status:** The reader now runs inside the app: joystick/button/touch events reach the dog, the buzzer requests go back to the board, the HUD says whether a controller is found. Verified on the real host page with a fake `window.zoomies` (launch throws the ball, dog fetches, buzzer gets chirp/chirp/squeak, HUD shows `controller COM3`). Never run with the real board or on Windows. Branch `a/p3-serial-wiring`, stacked on `a/p3-serial-transport` (#32).
**Decided:** Controller status in the always-present HUD line; orientation flags via env vars (`ZOOMIES_INVERT_X/Y`, `ZOOMIES_SWAP_XY`), `ZOOMIES_SERIAL=0` disables; double-click = call (mouse twin of the button tap).
**Spec:** No change (uses contract channels `input:event`, `serial:status`, `serial:buzzer` as written).
**Next:** Windows run with Abel's breadboard (checklist in the PR); tune joystick orientation/thresholds there.
**Blocked on:** Windows + the breadboard; Ansh must `npm install` (serialport).
**Touches:** `app/src/main/{index.ts,ipc-main.ts}`, `app/src/main/hardware/serial-service.ts`, `app/src/preload/{index.ts,index.d.ts}`, `app/src/renderer/{main.ts,host/hud.ts}`, `app/src/renderer/dog/tools/zoomies-stub-preload.cjs`

---

## What Worked
- `serial-service.ts` (reader + mapper + env flags + callbacks) tested with fakes: 5 tests; mutation (ignore invert flag) caught by 2.
- Race fixed by design: the renderer registers `onSerialStatus`/`onInput` first thing and then asks `getSerialStatus()`, so a board that connects before the page loads still shows.
- Screenshot harness with the stub: `window.__stub.input/status/buzzed` added.

## What Didn't Work
- Pet visual check can't show the belly-lie here: that is PR #30 (hand), not in this stack. The pet event itself is the same path as launch, which did work.
- First harness runs: `await` inside `--eval` hangs the harness; wrap in `new Promise(...)` instead.

## Test Coverage
- **Covered:** service wiring, env flags, HUD text, plus Phase A/B tests. 862 tests, lint clean.
- **Not covered:** Electron IPC itself (`ipc-main`, preload: no logic, checked by eye through the stub only), real port, Windows.
