# 2026-10-04 — daniel — Polish: the dog blinks, and the jump shadow stays on the ground

**Status:** Two small safe wins on `b/polish` (stacked on `b/xray`, which is stacked on `b/perf`; PRs #9–#12 are all still open). (1) **Blink:** the eyes squash to a thin slit for 0.16 s every 2.2–5.2 s. (2) **Shadow:** it stays on the ground while the dog jumps, and shrinks and fades with height. 300/300 tests, lint, typecheck green. Committed locally; PR next.
**Decided:** Blink lives in `SdfDog` (render level): the eyes become ellipsoids in the builder and the shader's vertical radius is scaled by the blink amount each frame; the schedule is a small pure module (`motion/blink.ts`) so it is deterministic and testable. The ground for the shadow comes from `DogMotion.getGroundY()` (the lower of take-off and landing levels during a jump; the dog's own y otherwise).
**Spec:** No change to contracts or PRD.
**Next:** PR; then the splat-fur experiment with the strict gate (flicker-free, < ~2 ms extra, clearly better, or cut at ~03:00).
**Blocked on:** Reviews of #9–#12.
**Touches:** `app/src/renderer/dog/motion/{blink.ts,blink.test.ts,dog-motion.ts,dog-motion.test.ts}`, `app/src/renderer/dog/sdf/SdfDog.ts`, `app/src/renderer/dog/spec/build-dog.ts`

---

## What Worked
- Test-first. `blink.test.ts` (8 tests): open before the first blink; fully closed at the middle of the first blink (> 0.99) and open again after; a blink is quick (closed for 0.1–0.25 s); always within 0..1 and eased (no frame-to-frame jump > 0.55 at 60 Hz); 60 s gives 11–25 blinks; deterministic per seed, different seeds differ; survives a dropped frame (dt up to 10 s); zero time does nothing. `getGroundY` (4 tests): equals the dog's y on the ground; stays put through a whole jump while the dog is really in the air; is the lower level when jumping to a lower platform; equals the new y after landing.
- Mutation checks: eyes never close broke 4 tests, a blink schedule that never repeats broke 2, a shadow that follows the dog up broke 2; restored identical.
- By eye: eyes open (round dark ball) vs the middle of a blink (a thin slit); mid-jump the shadow stays far below the paws, smaller and fainter.

## What Didn't Work / Notes
- Screenshot cropping cost several tries: at zoom 3 the toolbar (now three rows after the x-ray buttons) covers the dog. Use `--zoom 2.2 --size 1000x900` and crop `(1050, 640, 1450, 900)` for the head.
- Diffing `freeze=30` against `freeze=65` finds the whole dog (breathing, tail wag, head look-around keep moving), not just the eyes — don't use a diff to locate the eyes.
- `getGroundY` is the right idea only for jumps between two levels; if Ansh's window-terrain code later makes the dog fall off a window edge, the ground under it changes continuously and he will need to feed a real ground height (the shadow code reads one number: `getGroundY()`).

## Test Coverage
- **Covered:** the blink schedule and the ground reference (12 tests).
- **Not covered:** that the eye uniform really squashes in the shader (checked by eye) and the shadow's size/opacity numbers (by eye).

## Next Step
PR; fur experiment.
