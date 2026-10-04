# 2026-10-03 — daniel — T4 done: the dog turns toward where it travels

**Status:** T4 of `docs/plans/b-p1-sdf-spike.md` complete. The SDF dog now swings round to face its direction of travel: sideways = three-quarter view (25° lean toward the viewer), up the screen = back to the viewer, down = face to the viewer; it settles to the three-quarter view when it stops. Verified with screenshots of walk-up (back view), walk-down (front view) and run-right. 46/46 tests, lint, Prettier, typecheck green. Committed on `b/sdf-spike`, not pushed.
**Decided:** Pure yaw maths in `sdf/yaw.ts` (tested), used by `SdfDog` from the dog's per-frame velocity; jump arcs ignore vertical velocity so a hop isn't read as "running up"; no scale-by-height.
**Spec:** No change.
**Next:** T5 — look check: side-by-side stand / sit / run / run-up / front shots next to `assets/photo/dog.jpeg`, then go/no-go on this approach.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/sdf/{yaw.ts,yaw.test.ts,SdfDog.ts}`, `app/src/renderer/preview.ts` (new "walk ↑" / "walk ↓" buttons), `app/src/renderer/dog/tools/shot.mjs` (new `wait:<ms>` click step)

---

## How it works
`targetYaw(vx, vy)` turns screen velocity into a yaw: forward = (cos θ, 0, −sin θ) in x/z with z toward the viewer, so moving down the screen faces the viewer. Sideways travel adds a lean of tan(25°) toward the viewer; vertical travel gets none. `stepAngle` eases the current yaw toward the target (rate 9/s) taking the short way across ±180°. Standing still (< 20 px/s) → `restYaw(facing)`.

## What Worked
- Tests first (red: module missing), then green; **mutation check:** swapping up/down made 6 tests fail, removing the short-way logic made 1 fail; file restored identical.
- Screenshots: back view (back of head, two ears, tail toward viewer, rear legs), front view (white muzzle and chest, front legs), mid-run three-quarter view with legs swinging.
- Frame time stayed 16–17 ms.

## What Didn't Work
- First walk-up shot used a 600 px-tall window at zoom 2: the dog walked under the button panel and out of frame. Use ~900 px-tall windows at zoom 1.5 for vertical moves.
- First "walk down" shot was taken after the dog had arrived and settled, so it showed nothing new. Fixed by adding a `wait:<ms>` step to the harness (e.g. `--click "walk ↑,wait:1700,walk ↓" --wait 650`).

## Test Coverage
- **Covered:** `targetYaw` (right, left, up, down, up-right hand-worked 28.1°, speed-independence), `restYaw`, `stepAngle` (zero time, partial step 7.87°, ±180° seam, convergence) — 11 tests.
- **Not covered:** the velocity detection inside `SdfDog.update` (checked by eye in screenshots).

## Known limits
- No eyes/face detail on the placeholder dog — the front view shows a blank head. Fixed by the fitted Aussie dog file.
- Placeholder's own `lookAt` uses `facing`, not our yaw, so the head's look-at can be off while the body is turned; revisit with our own skeleton.
- Bounds/hit-test still come from the placeholder's unturned meshes (80 px margin covers the yaw).

## Next Step
T5 look check and go/no-go.
