# 2026-10-04 — daniel — Resting dog faces us, standing life, GPU guard

**Status:** Built and tested: 416/416 tests, lint and typecheck green. Branch `b/idle-life`, stacked on `b/animation` (PR #16).
**Decided:** (1) The RESTING dog now turns 60° from side-on toward the viewer (front three-quarter: chest, both eyes, both ears), instead of 25°. Walking sideways keeps the 25° lean, so the dog turns to profile-ish when it sets off, like a real dog turning to go. This was Daniel's ask: "body toward the screen, not sideways". (2) Standing life and the GPU guard from the panel's list.
**Spec:** No change.
**Next:** PR; Ansh calls `setMood` / decides what to do with the facing; see how long-bodied dogs (golden, greyhound) look at 60°.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/sdf/{yaw.ts,gpu-check.ts,SdfDog.ts}` (+tests), `dog/motion/{idle-life.ts,dog-motion.ts}` (+tests)

---

## What changed
- **Facing:** `restYaw` uses a new `REST_TILT = 60°`. Tests first (hand-worked: right = -60°, left = -120°; leans toward the viewer; further round than the walking lean). By eye: the Aussie shows chest, face, both ears; the long-bodied golden still shows more side (a long body does).
- **Standing life** (`idle-life.ts`, pure + `DogMotion.polish.idle`): a ~2° weight shift (body roll, 6.5 s period), an ear flick every 3–8 s (deterministic per seed), and the head droops over 25 s of nothing to do; any command (pose, move, jump, mood) lifts it again. It eases in and out and is off while walking or posing.
- **GPU guard** (`gpu-check.ts`): `SdfDog.init` now throws if the GPU has too few shader uniforms (needs 420 fragment / 170 vertex vectors) or if a dog shader fails to compile, removing what it added, so the host can show the placeholder instead of a silent black dog. The host-side fallback itself is in PR #10 (`createDog`), not yet merged.

## What Worked
- Mutation/edge checks via tests: the sway test caught a real bug (resetting the phase snapped the sway to zero when the dog started moving instead of fading); fixed by not resetting it.
- Paws stay on the ground during 30 s of idling for all four demo dogs; sway is zero while walking.
- Preview still renders with the guard on the Mac (no false alarm).

## What Didn't Work
- Nothing abandoned. Note: `setPolish(false)` now also turns off the standing life.

## Test Coverage
- **Covered:** idle-life (8), standing life in DogMotion (6), rest yaw (4), GPU limits and compile-failure handling with a fake renderer (8).
- **Not covered:** a real shader compile failure on a real GPU (only the fake path is tested); Windows.
