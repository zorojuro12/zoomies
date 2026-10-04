# 2026-10-04 — daniel — Idle tricks: yawn, sniff, shake-off

**Status:** Built and tested: 448/448 tests, lint and typecheck green. Branch `b/idle-tricks`, stacked on `b/idle-life` (PR #17).
**Decided:** Three tricks (the panel's list had scratch too; cut for time). Each is a pure function of time that writes small OFFSETS to the pose (so it works for any dog), starts and ends at exactly zero, and is cancelled by any command. A bored standing dog does one by itself every 10-20 s so the dog is alive in the demo without Ansh's behaviour layer; `DogMotion.polish.idleTricks = false` turns the automatic ones off, `polish.idle = false` turns off all standing life.
**Spec:** No change. `playIdle(name)`/`getIdle()` are extras like `setMood`, not contract.
**Next:** PR; Ansh decides when to call `playIdle` / `setMood` himself.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/motion/{idles.ts,idle-life.ts,dog-motion.ts}` (+tests), `dog/sdf/SdfDog.ts`, `app/src/renderer/preview.ts`

---

## What changed
- `idles.ts`: yawn (2.6 s: head back, jaw wide, eyes shut), sniff (2.8 s: nose down, bobbing fast), shake (1.5 s: body and head rattle, ears flap). All offsets in degrees/fractions, eased in and out.
- `DogMotion.playIdle(name)`: only when the dog is standing with nothing to do (never interrupts a walk or pose); resolves when done or when any command cancels it (the offsets fade out in ~0.2 s, no snap). Offsets are added to a scratch copy of the current pose, so the legs still plant on the ground.
- `idle-life.ts`: now also schedules a trick request every 10-20 s of standing (deterministic per seed); a new `quiet` flag lets the weight shift step aside during a trick without resetting boredom.
- Preview buttons: `idle: yawn / sniff / shake`.

## What Worked
- Tests first (19 pure trick tests, 5 schedule tests, 8 DogMotion tests): every trick starts and ends at exactly zero, stays inside limits, paws stay on the ground during every trick for all four demo dogs, cancel resolves the promise and shuts the mouth, never interrupts a walk, flags off do nothing, automatic tricks appear (and stop with the flag).
- Mutation checks: no jaw opening broke 4 tests, a no-op cancel broke 1; restored identical.
- By eye: the yawn (screenshot) tips the head back, opens the jaw and shuts the eyes.

## What Didn't Work (found by the tests)
- Tricks that reset the boredom timer broke the droop (a trick every 10-20 s kept lifting it): fixed with the `quiet` flag instead of treating the trick as activity.
- A shake with body roll 0.07 rad lifted one paw about 1 px above the ground (the IK ignores roll): reduced to 0.05 rad (about 3°), under the limit.
- `getIdle()` still named a cancelled trick while it faded out: now null from the moment of cancel.

## Test Coverage
- **Covered:** the pure tricks, the schedule, and DogMotion behaviour for all four dogs.
- **Not covered:** how the shake looks on Windows / in motion (only a still of the yawn); no sound with the tricks (a happy yip or yawn sound would be Abel's).
