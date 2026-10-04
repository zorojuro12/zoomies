# 2026-10-03 — daniel — T2 done: SDF maths reference with tests

**Status:** T2 of `docs/plans/b-p1-sdf-spike.md` complete. `app/src/renderer/dog/sdf/sdf-math.ts` has `sdSphere`, `sdCapsule`, `sdEllipsoid`, `sdRoundCone`, `smin`; 17 new tests in `sdf-math.test.ts`. Full suite 35/35, lint, Prettier, typecheck clean. Committed on `b/sdf-spike`, not pushed.
**Decided:** Test seam = the five exported functions through inputs/outputs only; functions take plain numbers (no vector objects) so they never allocate per call.
**Spec:** No change.
**Next:** T3 — `SdfDog` first light: ray-march shader over a quad around the dog, driven by the hidden placeholder's bones.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/sdf/sdf-math.ts`, `app/src/renderer/dog/sdf/sdf-math.test.ts`

---

## What Worked
- Red first: the test file failed ("module not found") before any maths existed; then green with 17/17.
- **Mutation check:** three deliberate bugs (smin bulge ×2, round-cone tangent sign flipped, capsule ignoring end caps) each made 1–2 tests fail; file restored byte-identical afterwards. So the tests catch real mistakes.
- Expected values are hand-worked literals. For the round cone, the surface point `(x=5, r=2.0412)` was derived from the tangent-line geometry (touch points `(0.6, 2.9394)` and `(10.2, 0.9798)`), not from the formula.

## Decisions Made
- `sdEllipsoid` uses Inigo Quilez's approximation (exact on the axes, close elsewhere) with an explicit centre case, because the formula divides 0 by 0 at the exact centre.
- `sdRoundCone` assumes `|rA − rB| < length` (as the contract's roundCone params imply); the dog file must respect that.

## Test Coverage
- **Covered:** all five SDF functions (outside/surface/inside, axis symmetry, end caps, blending limits).
- **Not covered yet:** the GLSL copy in the shader (T3) — checked by eye with screenshots, per the hackathon test policy; ellipsoid accuracy off-axis (approximation, not tested).

## Next Step
T3: `SdfDog` first light.
