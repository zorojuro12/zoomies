# 2026-10-04 — daniel — P2 Task 7: the behaviour layer wired into the real host

**Status:** Wired into Ansh's `main.ts` on branch `a/p2-wiring` (off `dev`, which already has PR #22). Lint clean, 689/689 tests pass; typecheck and build fail ONLY on the Windows-only native modules (`koffi`, `uiohook-napi`) that a Mac does not have (same as before this change). Ran the REAL `index.html` on a Mac with a fake OS layer; **not run on Windows**.
**Decided:** The PR is how Ansh reviews his files (`main.ts`, `host/hud.ts`, `main/overlay-window.ts`): small, surgical edits. Kill switches: `ZOOMIES_BEHAVIOUR=0` gives P1 exactly; `ZOOMIES_DEMO=1` gives the short demo timers. The dog's default spot is now the right side of the screen facing the room (Daniel asked).
**Spec:** No contract change.
**Next:** Ansh (or Daniel with him) runs the CP2 demo path on Windows; Task 6 (sound cues) when Abel's sounds land.
**Blocked on:** Windows verification; Abel's sounds for Task 6.
**Touches:** `app/src/renderer/main.ts`, `app/src/renderer/host/hud.ts`, `app/src/main/overlay-window.ts`, `app/src/renderer/dog/tools/{shot.mjs,zoomies-stub-preload.cjs}`, `docs/plans/a-p2-mvp-behaviour.md`

---

## What changed in `main.ts`
- Creates `Behaviour` after the dog and ball exist (`behaviour` is a `let` declared early so the window/activity handlers can use it); `?behaviour=0` leaves it `null` and every call is `behaviour?.`.
- Feeds it: `handleActivity` for every OS activity event, `setWindows` on every window update, `handleInput({kind:'launch'})` right after the slingshot release (after `ball.held = false`).
- Look-at: with behaviour on, the old `mousemove -> dog.lookAt` and per-frame `dog.lookAt(ball)` are not installed (Behaviour decides where the dog looks). Cursor position and speed come from a DOM `mousemove` (overlay: `setCursor`; windowed Mac host: a full mouse activity event, so the user counts as active).
- A click on the dog is a pet (`handleInput({kind:'pet'})`); before, it set the sit pose. The windowed click-to-run is only kept when behaviour is off.
- While the dog carries the ball (`fetch.carrying`) the world draws a radius-0 ball, the user cannot grab it, and click-through ignores it.
- Frame loop: `FrameGovernor.shouldRun(now, behaviour.fpsTier())` skips refreshes (30 fps resting, 5 fps asleep); `HUD` shows `full speed` / `resting 30 fps` / `asleep 5 fps`.
- `debug` patrol is only used when behaviour is off (it would fight the personality). Default spot: `homeX = 85%` of the width, then a 3 px step left so it faces the room.

## What Worked
- New dev tool: `shot.mjs --stub 1` loads the REAL `index.html` with a fake `window.zoomies` (`zoomies-stub-preload.cjs`: empty window list, a work area, and `window.__stub.emit(event)` to inject activity). With it, on a Mac: the dog starts on the right facing left with `full speed`; a fake slingshot throw makes it run, carry the ball (green ball in its mouth, world ball hidden), bring it back to its spot and drop it; 8 s later it sits and the HUD says `resting 30 fps`; an injected idle of 25 s makes it sleep and the HUD says `asleep 5 fps` with a 200 ms frame.
- Everything else (689 tests) still passes, since the logic is unchanged.

## What Didn't Work (and why)
- My first fake throw did nothing, twice: (1) the fake pointer events fired before the host had finished loading (the dog takes over a second), fixed with a wait; (2) I aimed at the wrong height because the page viewport is shorter than the window. Test-tool mistakes, not host bugs.

## Test Coverage
- **Covered:** all the logic (689 tests) and the three scenarios above on the real host page.
- **Not covered / needs Windows:** the real overlay (click-through gate with the hidden ball, DPI), real activity events (the stub fakes them), real GPU saving asleep vs awake, frame pacing on a 144 Hz screen at the 30 and 5 fps tiers, the `ZOOMIES_DEMO=1` env path through `overlay-window.ts` (not run).
