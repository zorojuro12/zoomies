# 2026-10-04 — ansh — Lane A P1 overlay: CP1 complete

**Status:** CP1 is done. Overlay + click-through, live window list feeding the world SDF, dog hosted and tracking the cursor, ball flung off real windows via the mouse slingshot, FPS overlay — all confirmed on Windows, twice in a row from a fresh `git pull`, no restart needed between. Full checks green: 524/524 tests, typecheck and lint clean. `docs/plans/a-p1-overlay.md` (Tasks 1-9) and `docs/plans/lane-a-ansh.md` (P1 section) both updated to reflect this.
**Decided:** Region rendering/scissor (originally listed under the P1 render-host bullet) stays cut — Task 1's measured overlay cost (40% GPU system-wide, no stutter, CPU 2.7%) didn't need it. Left as a P4 perf-pass item only if it's ever actually needed, not attempted speculatively.
**Spec:** No change.
**Next:** P2 (MVP) per `lane-a-ansh.md` — fetch sequence, needs model, desktop reactions, adaptive FPS, sound cue hookup, integrating Daniel's real `DogView`/`DogController`. Daniel has started a Lane A P2 plan on `a/p2-mvp-behaviour`, branched off `a/p1-overlay`, while I was finishing CP1 — read that plan before starting new P2 work to avoid duplicating or conflicting with it.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/{main.ts,world/,dog/motion/dog-motion.ts}`, `app/src/main/index.ts`, `docs/plans/{a-p1-overlay.md,lane-a-ansh.md}`

---

## What Worked

- Task 8 (slingshot) went smoothly: TDD on the pure math first (`aimFromDrag`/`launchVelocity`/`ballHit`, 8/8 tests), then the manual wiring (drag → aim line → launch, `Ball` gained a `held` flag so `stepBall` pauses while dragging). No real bugs this time — just a feel tweak (`maxPullPx` 200→100) caught immediately by trying it live on Windows rather than guessing a value from the spec and moving on.
- Found and fixed a genuine (if minor) click-through hitbox issue while re-running the CP1 demo path twice for Task 9: the dog's click-through box, mathematically centered on its anchor, read as lopsided because a standing quadruped isn't symmetric front-to-back around its spine (the snout reaches further than the tail). Fixed with a small facing-direction bias in `dog-motion.ts`'s `getBounds()`. This is Lane B's file; flagged in the commit and code comment the same way an earlier pass today already had (narrowing the box's width ratio) — a now-established pattern for touching that one function when needed, rather than routing every tiny hitbox tweak through a cross-lane conversation.
- My first hypothesis for the hitbox asymmetry (the idle "weight shift" body roll) turned out to be geometrically wrong on inspection — it's a roll about the *forward* axis, which wouldn't produce a left-right shift in a side view at all. Caught this by reading `idle-life.ts`'s actual comment ("roll about the forward axis") before writing any fix, not after. Don't re-chase the sway as a cause if this resurfaces.
- The two-runs-in-a-row demo-path check (Task 9 Step 2) is worth keeping as a habit beyond just this checkpoint — it's exactly what surfaced the hitbox issue, which a single run might have shrugged off as a one-off.

## Test Coverage

- **Covered:** everything through Task 8 — ball physics (incl. the freeze/oscillation fixes and 200-random-layout fuzzing), slingshot math, world SDF, OS layer, activity tracker, click-through gate, frame stats, dog motion (unaffected by the hitbox bias — existing `hitTest` assertions still pass since the bias is small relative to the box).
- **Not covered:** the hitbox facing-bias fix has no dedicated test (it's a `getBounds()` tweak verified by eye, same as the width-narrowing fix before it — both are feel/visual, not logic, so this matches the project's testing policy rather than a gap).

## Relevant Commits

- `197e9c6` — feat: slingshot aim and launch mapping (Checkpoint 1)
- `7da129f` — feat: mouse slingshot - drag the ball, aim line, launch (Checkpoint 2, incl. the maxPullPx tuning)
- `8d1ae1b` — fix: bias the dog's click-through hitbox toward its facing direction
