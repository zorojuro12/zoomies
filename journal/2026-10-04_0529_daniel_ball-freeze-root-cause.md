# 2026-10-04 — daniel — Ball freeze (bug 3): root cause found and fixed

**Status:** Root cause found by reproducing with Ansh's real `World`/`stepBall`, fixed with tests. 516/516 tests pass (the 2 typecheck errors are the Windows-only native modules `koffi`/`uiohook-napi` missing on this Mac, not from this change). Branch `b/ball-freeze-fix`, off `a/p1-overlay`, PR into `a/p1-overlay`.
**Decided:** The NaN-substep theory in Ansh's journal was wrong; don't chase it. Cause: the "escape upward" march in `resolveCollision`. A window just under the 90% maximized cut-off (e.g. 1700 x 1032 on a 1920 screen) over the ball's spawn point leaves no free space above or below (flush with the top and the floor); the nearest face is the floor, which is solid, so the normal push fails; the up-march then carries the ball 600 px off the top of the screen, where everything counts as solid. Next substep the normal push brings it back, the march takes it off again: a fixed point at y = -590 with `resting` false and `vy` climbing to 4000. That is exactly Ansh's log (the two -600 jumps = 150 steps x 4 px; then frozen).
**Fix:** `resolveCollision` takes the normal push only if it lands in free space; otherwise it finds the SHORTEST straight way out in 8 directions (up preferred, weight 0.6, so his "window lands on the ball pops it up" behaviour is kept), up to the size of the work area; if nothing is free anywhere (the screen is fully covered) it clamps the ball inside the screen and stops it. New `World.getBounds()`. `BALL.escapeMaxSteps` removed, `escapeStepPx` now 8.
**Spec:** No change.
**Next:** Ansh re-runs the full Checkpoint 3 pass on Windows (fall/bounce/settle, drag under, drag over, and spawn with a big window docked over the spawn point), then ticks it off; the `[diag]` logs and the console-message forwarder are still in place, remove them once verified.
**Blocked on:** Windows re-verification by Ansh.
**Touches:** `app/src/renderer/world/{ball.ts,ball.test.ts,world-sdf.ts}`

---

## What Worked
- Reproducing in isolation with the real functions, as Ansh did for bug 2: window {0,0,1700,1032}, ball at (768,624) gave `y=-590.0` frozen, `vy` rising to 4000. A first repro with a 1000-wide window did NOT freeze (the nearest face was sideways), which showed what the log's window really looked like: wide, nearly full height.
- Tests first (5 red): never leaves the screen even for a frame and ends resting in free space; takes the only way out even when 1600 px away; keeps simulating (falls to the floor right of the window); fully covered screen stays finite and on screen; 200 random window layouts and spawn points stay finite and on screen. All green now, plus his earlier tests untouched.
- Worst-case cost (screen fully covered by 10 windows, search runs every substep): 0.17 ms per frame.

## What Didn't Work
- My own first assumption that sideways exit would always exist: a tall window flush with both the top and the floor, plus a full-width one, can leave no free space at all; handled by the clamp-and-stop fallback.

## Test Coverage
- **Covered:** the freeze scenario and its variants, the fully covered screen, 200 random layouts.
- **Not covered:** the live overlay (Windows); whether the ball visually pops out the side in a way that looks good (up is preferred when its cost is within 60% of the shortest).
