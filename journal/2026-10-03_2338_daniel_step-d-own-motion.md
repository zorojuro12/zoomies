# 2026-10-03 — daniel — Step D done: our own motion (skeleton, poses, gait + IK, jumps)

**Status:** Step D of `docs/plans/b-p2-spec-and-motion.md` complete on `b/motion`. The SDF dog no longer borrows the placeholder: `SdfDog` is driven by our `DogMotion` over a new 17-bone skeleton (2-segment legs, jaw, 3-part tail). Poses (stand, sit, lie, sleep, playBow, headTilt, pant, stretch), walk/trot/run with planted feet, jumps with landing, look-at, tail wag chain, ear springs, breathing. 237/237 tests, lint, Prettier, typecheck green. Committed locally on `b/motion`, not pushed.
**Decided:** (1) Poses are numbers in units of the leg length T and the legs are solved with IK from where the PAWS should be, so one pose table fits every dog. (2) **Auto-grounding:** each frame the body lowers just enough that every planted paw can reach its ground point. (3) The gait cadence is computed from the dog's own forward axis (screen speed / cos yaw), so planted paws stay planted on screen despite the three-quarter view. (4) Feet are anchored to the hip at the *pose's* pitch, not the walking wobble.
**Spec:** No change to contracts or PRD. `DogFile.poses` now holds only `stand`; poses live in code (`dog/motion/poses.ts`). `?dog=sdf` on the preview now means the SDF dog with the default spec; `?spec=<name>` unchanged; no params = the old placeholder.
**Next:** PR the branch into `dev`; then step E (pose & shape editor for Abel), step F (Gemini fills the spec from any photo).
**Blocked on:** Daniel's go to push/open the PR.
**Touches:** `app/src/renderer/dog/motion/*`, `app/src/renderer/dog/sdf/SdfDog.ts`, `app/src/renderer/dog/spec/build-dog.ts`, `app/src/renderer/preview.ts`

---

## What Worked
- Pure maths first, test-first, mutation-checked: two-bone IK (angles verified by forward kinematics), gait (planted-stance property, hand-worked stance 100·0.6/2 = 30), spring (critical damping, overshoot), cartoon ease (peak 1.0706), `solveLegToGround` (paw lands on the target for 100+ body heights/pitches/lifts).
- `DogMotion` tests run headless against the real rig and cover **every demo dog** (default, aussie, golden, greyhound): paws within 1 px of the ground in all 8 poses; no foot sliding at walk/trot/run (screen-visible slide < 1.2 px vs 1.8/3.7/7 px if unplanted); moveTo arrives, jumpTo rises by the apex and lands, jaw opens, ball toggles.
- Mutation checks on the motion: halving the stance excursion broke 8 tests, removing the tilt-aware cadence broke 2, removing auto-grounding broke 9; file restored identical.
- Screenshots: sit (torso up, haunches down, hind legs folded), lie (sphinx), playBow (front down, rear up), mid-run stride, mid-jump (legs trailing).

## What Didn't Work (so nobody retries it blind)
- **Poses with a fixed `drop`** left paws hanging 11–19 px off the ground for playBow/stretch (all dogs) and golden sit — pitching the body lifts one pair of hips beyond leg reach. Fixed by auto-grounding, not by per-dog tuning.
- **Sliding feet at trot/run (and golden walk):** measured 0.77/1.5/2.9 px per frame = 42% of speed. Cause: the 25° three-quarter tilt makes the dog's forward axis differ from the on-screen travel direction. Fix: cycle the legs at screen-speed / cos(yaw); measure only the screen-visible (x) slide, since depth is invisible in the orthographic view.
- **Residual ~1 px slide at a run** with the old threshold 0.9: a paw counts as "down" up to 0.6 px off the ground, and a foot starting to lift moves ~1 px in that window. Tolerance set to 1.2 px, which still catches real sliding (checked by mutation).
- A diagnostic using 16.7 ms frames didn't reproduce a failure the test (16.667 ms) found — frame-phase matters; always diagnose with the same step as the test.

## Test Coverage
- **Covered:** all motion maths, the rig-level behaviour above for four different dogs, the builder's new skeleton (17 bones, shin at half the leg, tail chain, jaw, paw on shin).
- **Not covered:** how it looks beyond the screenshots checked; GPU cost (32 shapes per ray is heavier than the placeholder's 12; preview is vsync-capped on the Mac — a Windows measurement and bounding-sphere early-out are still to do); blink (no eyelids yet); the placeholder-based `?dog` default view is untouched Ansh code.

## Known limits
- Shadow follows the dog's arc height (no separate ground reference) — it rises with a jump.
- Vertical travel (up/down the screen) cycles the legs at screen speed; true foot planting is impossible in depth (invisible in ortho), so feet appear to skate slightly there.
- `scratch` pose not implemented (resolves immediately). Greyhound extreme still stilted.

## Next Step
Push `b/motion` and open the PR into `dev` (merge commit); then step E (editor).
