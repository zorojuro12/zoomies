# 2026-10-04 — daniel — Animation: jump crouch, mood channel, head-leads-neck

**Status:** Built and tested. 391/391 tests, lint and typecheck green. Branch `b/animation`, stacked on `b/face-polish` (PR #15).
**Decided:** Build the animator panel's top two items in the dog's own motion code, all behind `polish` flags (`DogMotion.polish.anticipation`, `.mood`; `?polish=0` and a `polish: on/off` button in the preview). Skipped "overshoot": `cartoonEase` already overshoots by ~7%, the panel had not seen that. No contract change: `setMood`/`getLidDroop` are extras like `getGroundY`.
**Spec:** No change.
**Next:** PR; Ansh decides when the behaviour layer calls `setMood` (happy on pet/ball, sleepy when idle, alert on noise, curious on cursor near).
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/motion/{dog-motion.ts,mood.ts,poses.ts}` (+tests), `dog/sdf/SdfDog.ts`, `app/src/renderer/preview.ts`

---

## What changed
- **Anticipation:** `jumpTo` first crouches for 130 ms (new `crouch` pose: body sinks, nose dips), staying put on the ground, then springs. Costs 130 ms before the jump starts. If a new command interrupts a jump or crouch, the dog now eases back to stand instead of freezing in the pose (found while writing the interrupt test; the old mid-air interrupt had the same hole).
- **Mood** (`mood.ts`, pure): neutral, happy, curious, sleepy, alert, each a few numbers (tail wag, ear perk, neck/head angle, head tilt, eyelid droop, breathing depth), eased toward over ~0.25 s so there are no pops. Intensity 0..1. Sleepy holds the eyelids half down via `getLidDroop()` which `SdfDog` adds to the blink.
- **Head leads, neck follows:** the neck now follows the look target a beat after the head (two different smoothing speeds) instead of moving together.

## What Worked
- Tests first (mood: 12 pure tests; motion: 9 red, then green). Paws stay on the ground during the crouch for all four demo dogs and in every mood; jump still lands, fires `landed` and resolves; interrupt during the crouch resolves cleanly; flags off give the old behaviour.
- Mutation checks: crouch time 0 broke 2, lid always 0 broke 1, neck smoothing as fast as the head broke 1; restored identical.
- By eye (screenshot): sleepy = lower head, half-closed eyes, drooped ears.

## What Didn't Work
- The harness could not catch the crouch frame (click-to-screenshot delay is longer than the crouch). The crouch is covered by unit tests only; look at it live with the `jump` button.

## Test Coverage
- **Covered:** mood table and smoothing; crouch timing/ground contact/interrupt; mood effects on lids, neck and tail; head-leads-neck ratio.
- **Not covered:** how it looks on Windows; the moods have no caller yet (Ansh's behaviour layer).
