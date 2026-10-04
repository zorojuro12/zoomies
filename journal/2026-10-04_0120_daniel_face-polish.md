# 2026-10-04 — daniel — Face polish: catchlights, nose shine, inner ears, warmer light

**Status:** Built and verified by eye on the Aussie and golden dogs. 368/368 tests, lint and typecheck green. Branch `b/face-polish`, stacked on `b/fur` (PR #14).
**Decided:** Do the cheapest items from the six-agent panel first (art director's list): eye catchlights, nose shine, inner-ear patch, warmer rim/ambient. All built in code from existing spec colours, so any photo's dog works (no new spec key, no breed-specific code).
**Spec:** No change.
**Next:** PR; Windows re-measurement by Ansh (perf PR #9 first); then the animation items (anticipation/overshoot, mood channel) if Daniel says go.
**Blocked on:** Nothing for this change.
**Touches:** `app/src/renderer/dog/spec/build-dog.ts` (+test), `dog/sdf/{SdfDog.ts,sdf-shader.ts}`, `dog/fur/{fur.ts,fur.test.ts}`

---

## What changed
- `glint_l/r`: small white ellipsoid on each eye, up toward the key light; `shine`: tiny white sphere on the nose; `earin_l/r`: inner-ear patch on each ear's bone, colour = 55% of the way from the ear colour to the cheek colour.
- Blink squashes the catchlights with the eyes (to 1% height) so no white dot hovers over a closed eye.
- Fur never grows on eyes, nose, catchlights or shine (the bare-shape rule now covers them).
- Shader: ambient floor 0.55 → 0.7; rim exponent 3 → 2.5, strength 0.35 → 0.42, warmer peach tint.

## What Worked
- Tests first (31 failed red), then green: highlights are near-white, small, poke out of their parent, mirror left/right, sit on the same bone; inner ear sits inside the ear and its colour is between ear and cheek colours; for every range corner, floppy, semi and pointy ears. Mutation checks: grey highlights broke 15 tests, an inner ear pushed out of the ear broke 10.
- By eye: eye reads glossy, nose wet, inner ears warm.
- Cost on the Mac (800x600, aussie, fur on): about 3.4 ms/frame steady vs 3.0 before (+0.4 ms from 5 extra shapes in the shader loop). First run was a 9.5 ms cold start.

## What Didn't Work
- Catchlight radius 0.9 was invisible; 1.3 turned the whole eye into a grey ball because the shader's colour vote blends nearby shapes widely. A radius 1.0 dot placed farther out reads as a highlight. Do not make it bigger.
- Zoomed screenshots are hidden behind the toolbar buttons: hide them with `--eval "document.querySelectorAll('button').forEach(b=>b.style.display='none')"` and crop with `sips`.

## Test Coverage
- **Covered:** builder output for all new shapes on every range-corner spec; fur bare rule.
- **Not covered:** the blink squash of catchlights (SdfDog, checked by reading the code only); not run on Windows/RTX 2060.
