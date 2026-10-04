# 2026-10-04 — ansh — Daniel's PRs merged; Lane A P1 overlay plan written

**Status:** `dev` has Daniel's PRs #9–#19 (perf, host-swap, x-ray, Gemini run, polish, fur, face, animation, idle life/tricks, fur tint); merged into `a/p1-overlay` (`2a782b9`), 463/463 tests, typecheck and lint green in WSL. P1 plan written and pushed: `docs/plans/a-p1-overlay.md` (`6eacf8b`). No Lane A code yet.
**Decided:** Execute P1 in a **native Windows Claude Code session**, not WSL — most checkpoints are hand-checks on the demo laptop, `koffi`/`uiohook-napi` install per OS, and one machine on the branch avoids the push collisions seen earlier. Typing activity + mouse hook stay in P1 (Ansh's call).
**Spec:** No change.
**Next:** On Windows: copy `.claude/` from the WSL repo into the Windows clone, `git pull` on `a/p1-overlay`, `cd app && npm install`, start `claude` → "resume from the journal, then execute `docs/plans/a-p1-overlay.md` with executing-plans". Then `wsl --shutdown`.
**Blocked on:** Nothing.
**Touches:** `docs/plans/a-p1-overlay.md`, `app/src/renderer/main.ts` (now uses Daniel's `createDog()`), `app/src/main/`, `app/src/preload/`, `app/src/renderer/{host,world}/` (planned)

---

## What the plan covers (9 tasks)
1. Transparent always-on-top (`'screen-saver'`) click-through overlay at the primary display's bounds, no taskbar button, unfocusable, tray **Quit**; then a hand-measured GPU-cost decision (idle overlay ≤ 10 % GPU → keep full-screen, else small-window fallback becomes P2's first task).
2. `FrameStats` (fps, avg, p95 of frame interval and **work time**) + HUD — replaces the vsync-locked 6.9 ms readout.
3. Typed `window.zoomies` preload API over the existing `@shared/ipc` channels + `ClickThroughGate` (150 ms hold) → clickable only on the dog/ball.
4. `WindowsOsLayer`: `koffi` → `EnumWindows` + DWM extended frame bounds/cloaked, pure `toWindowRects` filter (DIP via `screenToDipRect`), `sameWindows` diff, 150 ms poll, `taskbarRect`.
5. `ActivityTracker` (pure, timing only — the API takes no key codes) + `uiohook-napi` keydown/mousemove + `powerMonitor` idle; cursor-polling fallback if uiohook won't load.
6. World SDF v0 (`sdBox`, `World.distance/normal`, `worldSolids` skips maximized windows) + debug outlines.
7. Ball physics (substeps, dt clamp, wake when a window lands on it).
8. Mouse slingshot (`aimFromDrag`, `launchVelocity`, aim line).
9. CP1 demo path ×2 on Windows, lane plan ticks, journal.

Key choices: no contract change (taskbar handled by treating the work area as the world bounds); native modules loaded only on `win32`, Mac/WSL keep the windowed `StubOsLayer` app; `ZOOMIES_WINDOWED`, `ZOOMIES_DEBUG`, `ZOOMIES_DEVTOOLS` env switches (the unfocusable overlay can't open DevTools with F12).

## Open Questions / Blockers
- Whether `uiohook-napi` loads in Electron 39 on Windows — first seen in Task 5; fallback defined.
- `koffi` + `uiohook-napi` change `app/package.json` → tell the group chat to `npm install` after they reach `dev`.

## Relevant Commits
- `2a782b9` — merge `origin/dev` (Daniel's #9–#19) into `a/p1-overlay`
- `6eacf8b` — Lane A P1 overlay plan
