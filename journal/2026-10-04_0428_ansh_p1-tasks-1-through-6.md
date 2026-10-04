# 2026-10-04 — ansh — P1 overlay plan: Tasks 1–6 done (overlay, HUD, click-through, OS layer, activity, world SDF)

**Status:** `docs/plans/a-p1-overlay.md` Tasks 1–6 of 9 complete and pushed to `a/p1-overlay` (now at `94eed59`). All 502 tests pass, typecheck/lint clean throughout. Remaining: Task 7 (ball physics), Task 8 (mouse slingshot), Task 9 (CP1 wrap-up).
**Decided:** Dropped the small-window overlay fallback from P1 scope — measured 40% total GPU (30% Electron + ~20% DWM compositing) on the real overlay, no stutter, CPU negligible; building the fallback isn't worth it this close to the deadline given remaining P1 work still doesn't exist. Demoted to a P4 stretch item. Also: used a `fork` subagent for Task 6's pure-logic checkpoints (SDF math) — worked well, nothing to flag beyond a minor TDD-order deviation it already self-reported.
**Spec:** No contract changes. `docs/plans/lane-a-ansh.md`'s P1 risk table and P5 checklist updated with the hybrid-GPU/demo-build finding (see below).
**Next:** Task 7 (ball physics against the `World` SDF) — first two checkpoints are pure math, same shape as Task 6's, candidate for another fork.
**Blocked on:** Nothing.
**Touches:** `app/src/main/`, `app/src/main/os/`, `app/src/preload/`, `app/src/renderer/{main.ts,host/,world/}`, `docs/plans/a-p1-overlay.md`, `docs/plans/lane-a-ansh.md`

---

## What Worked

**Task 1 — Overlay window.** Transparent/frameless/always-on-top/click-through `BrowserWindow`, tray Quit, GPU logging. One correction needed: `app.getGPUInfo('basic')` doesn't include `gpuDevice` on this Electron/Chromium version — switched to `'complete'`.

**GPU-cost decision (Task 1 Checkpoint 2).** Idle overlay 30%, patrolling 30% (no stutter), windowed baseline 27%, DWM compositing separately ~20%. Decided to keep the full-screen overlay rather than build the small-window fallback — see Decided above.

**Task 2 — FPS/work HUD.** `FrameStats` (ring buffers, p95). One spec correction: the plan's Interfaces prose said the p95 index is `Math.floor(0.95 * (n-1))`, but the plan's own worked test example (114×1 + 6×50 → `workP95()` = 50) only holds with `Math.floor(0.95 * n)`. Used the test-spec-implied formula; both are documented as the Checkpoint 1 correction in the plan file.

**Task 3 — Click-through gate + typed IPC.** `ClickThroughGate` (hold-time state machine), `window.zoomies` preload API. Manual verify on Windows: clicking the dog sits it, clicks everywhere else pass through, head tracks cursor, no edge flicker. **Side fix:** narrowed the dog's `getBounds()` hitbox width from `heightPx * 2.2` to `1.6` (Daniel's file, `dog-motion.ts` — told him) after the left/right click-through margin felt much wider than top/bottom.

**Task 4 — Windows OS layer (`koffi`).** Real `EnumWindows`/DWM window enumeration, filtering, z-order, DIP conversion, diffing, taskbar detection. **Bug found and fixed live:** koffi's `proto()`/`struct()` register named types globally — calling `listRawWindows()` a second time (every 150ms poll) threw "Duplicate type name". Fixed with a lazily-initialized singleton for the native bindings, built once. Live-tested on the real desktop: real window titles/rects came back correctly, z-order updated correctly when Notepad opened on top. Display-scaling checkpoint: this laptop runs at **125%** scaling (not 100% as first assumed) — so the real DIP-conversion path got validated against a genuine non-1.0 scale factor on the first pass, which is the harder case and the one that matters for the actual demo.

**Task 5 — Activity tracking (`uiohook-napi`).** `ActivityTracker` (typing rate, backspace ratio, mouse speed, throttled event emission) + `activity-hooks.ts` with a cursor-polling fallback. One non-obvious design point needed to make the tick-emission tests pass: all three throttles (typing/mouse/idle) must baseline on the *first* `tick()` call's timestamp, not `-Infinity` — otherwise the very first qualifying tick fires immediately instead of waiting out its interval. Manual verify: kps/bs/mouse/idle all behaved correctly (bs correctly hit 1.0 when only Backspace was pressed); fallback simulation (renaming `uiohook-napi` away) worked — logged the unavailable message once, mouse speed kept working via cursor polling.

**Task 6 — World SDF v0.** `sdBox`/`World`/`worldSolids` done by a `fork` subagent (pure math, no live-app dependency) — 8 new tests, no spec ambiguity this time, allocation-free hot path confirmed. `WorldView` (debug outlines, replacing Task 4's temporary 2D canvas) done directly + manually verified: outlines on real non-minimized windows, gone on minimize, maximized windows correctly excluded (the white line seen around a full-screen window is the work-area boundary, not a per-window outline), nothing drawn without `ZOOMIES_DEBUG`.

## What Didn't Work

- **PowerShell + `nvm use` + `npm`:** switching node version via `nvm use` in the PowerShell tool didn't propagate `npm`'s PATH within the same session — `npm` came back "not recognized" even though `node -v` showed the switch worked. Bash (git bash) handled `nvm use 22.22.0 && npm run dev` reliably all session; stick to Bash for anything npm-related, reserve PowerShell for Windows-specific things (registry, process management, Chrome launches).
- **Scripting Chrome/window focus blind via PowerShell** (`SetForegroundWindow` etc.) to drive manual-check steps was unreliable earlier in the session (unrelated to this plan's work, but the same lesson applies here): don't try to automate what needs a human's eyes — ask directly instead.
- Several background `npm run dev` processes were left running simultaneously earlier in the session (before this batch of P1 work), causing port conflicts and GPU-cache lock errors. Always kill stray `electron`/`node` processes via PowerShell before restarting, especially after `ZOOMIES_DEBUG`/`ZOOMIES_WINDOWED` env toggles.

## Test Coverage

- **Covered:** every pure-logic module added this session has Vitest coverage (frame-stats, click-through, window-list, activity-tracker, world-sdf) — 502/502 passing.
- **Not covered by tests, verified by hand instead (per the hackathon testing policy):** the actual overlay window behavior, click-through gating end-to-end, live Win32 window enumeration, uiohook hooks + fallback, WorldView rendering. All checked on the real Windows demo laptop this session, results recorded in `docs/plans/a-p1-overlay.md`'s per-checkpoint "Result" notes.
- **Not covered at all yet:** ball physics, mouse slingshot, the actual full CP1 demo path end-to-end (Task 9).

## Relevant Commits

Full chain on `a/p1-overlay`, `f8acda4`..`94eed59` (22 commits) — see `docs/plans/a-p1-overlay.md` for the per-checkpoint commit SHAs; highlights:
- `f8acda4` — overlay window
- `a9b1a6e` — GPU-cost measurement + decision
- `025e8b2` / `65555cf` — FrameStats + HUD
- `eef0844` / `008d350` — click-through gate + IPC bridge
- `4502a15` — dog hitbox width fix (Daniel's file, told him)
- `a820adb` / `4d96910` / `61aa804` — Windows OS layer
- `541718b` / `8893233` / `ac18a77` / `bb2600e` — activity tracking
- `55414d8` / `634f778` / `8f6721a` — world SDF + debug view
