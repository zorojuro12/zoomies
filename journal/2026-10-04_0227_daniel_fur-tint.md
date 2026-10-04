# 2026-10-04 — daniel — Fur tint variation: warm/cool strands, dark roots, light tips

**Status:** Built and checked by eye on the golden and Aussie. All tests green. Branch `b/fur-tint`, stacked on `b/idle-tricks` (PR #18).
**Decided:** Two small, switch-free tweaks from the art director's list: (1) each strand also varies warm/cool (up to ±6% red vs blue; brightness variation kept at ±10%), (2) each strand is darker at the root (×0.82) and lighter at the tip (×1.12), like real hair catching light.
**Spec:** No change.
**Next:** PR; stronger two-layer contact shadow (small, optional).
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/fur/{fur.ts,fur-renderer.ts}` (+tests)

---

## What Worked
- Test on a plain mid-grey dog (every colour #808080), so any warm/cool difference can only come from the variation: red/blue spread 4-10%, mean stays neutral (0.97-1.03), brightness spread 5-15%, never outside 0..1. Mutation check: no warm shift broke the spread test; restored identical.
- Root/tip shade constants exported and checked (tip > 1 > root, average near 1); the GLSL itself is checked by eye.
- By eye (before/after screenshots at the same frame): the golden's coat now shows individual strands with depth instead of a flat fuzz; the black coat gets lighter-tipped streaks.

## What Didn't Work
- First test used red/blue on the golden's body: useless because its blue channel is tiny (0.05) so the ratio is noisy without any change (baseline spread already 0.116). Replaced with the grey dog test.

## Test Coverage
- **Covered:** colour variation properties; shade constants.
- **Not covered:** the shader's tip/root gradient itself (by eye only); cost not re-benchmarked (one multiply per fragment); Windows.
