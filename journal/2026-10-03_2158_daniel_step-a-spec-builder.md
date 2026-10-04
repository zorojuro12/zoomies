# 2026-10-03 — daniel — Step A done: dog spec + generic builder

**Status:** Step A of `docs/plans/b-p2-spec-and-motion.md` complete. A dog spec (JSON) now turns into a full dog through one generic builder: `normalizeSpec` (defaults + clamping) and `buildDog(spec) → DogFile` with eyes, nose, brows, cheeks, blaze, ears (pointy/semi/floppy), tail (long/fluffy/stub/curled), legs and paws. The preview page takes `?spec=<name>` and loads `assets/dog/<name>.spec.json`. 111/111 tests (65 new), lint, Prettier, typecheck green. Committed on `b/sdf-spike`, not pushed.
**Decided:** The builder is generic — a dog's identity lives only in the spec; `{ "name": "default" }` is a complete valid spec. Colour weighting in the shader now depends on each shape's `blend` so small hard shapes (eyes, nose) stay crisp.
**Spec:** No change to contracts or PRD. `DogFile` untouched; spec files and builder are new Lane B files.
**Next:** Step B — hand-write `assets/dog/aussie.spec.json` from `assets/photo/dog.jpeg`, fix the blaze (currently a forehead bump), then the side-by-side look check and go/no-go.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/spec/{dog-spec.ts,build-dog.ts,*.test.ts}`, `app/src/renderer/dog/sdf/sdf-shader.ts`, `app/src/renderer/preview.ts`, `assets/dog/default.spec.json`

---

## How it works
`normalizeSpec(anything)` → a safe `DogSpec`: every number clamped to `RANGES`, unknown ear/tail types and bad hex colours replaced by defaults, input never mutated. `buildDog` builds the template in template units and scales by `size`. The body hangs at `10*bodyDepth + 2*legHalf + pawRadius` above the ground, so the paws always land on y = 0 for any spec. Ears and tail ride on bone rest rotations (shapes have no rotation field).

## What Worked
- Tests first (red: module missing), then green. **Mutation check on the builder:** forgetting the paw radius broke 13 tests, an unmirrored right eye broke 1, ignoring `size` on shapes broke 3; file restored identical.
- Property tests run on every spec incl. the extreme corners of all ranges: valid dog file, paws on the ground, finite positive sizes, round-cone radii valid, unit-length bone rotations, ≤ 32 shapes.
- Default spec renders a complete dog with a face (side and front views checked). ~16–17 ms/frame.

## What Didn't Work
- My own test used `size: 2`, above the clamp maximum 1.6, so the clamp (correctly) returned −96 instead of −120. Fixed the test (size 1.5 → −90) and added a test that an oversize value is clamped.
- Typecheck flagged `hexToLinear(...)` possibly null in tests — added non-null assertions.
- A 700 px window at zoom 3 made the button panel cover the dog; ~1000×1000 at zoom 2.2 works for front views.

## Test Coverage
- **Covered:** `hexToLinear` (sRGB curve literal 0.2159), `normalizeSpec` (defaults, clamping, junk, unknown keys, immutability), `buildDog` structure, hand-worked ground heights (−60, −82, −63, −62, −90), ear/tail types, face symmetry, colours, and the all-specs properties.
- **Not covered:** how the dog looks (checked by eye); shader cost with 25 shapes (frame time is vsync-capped in the preview, so a GPU-time check is still needed before the Windows demo).

## Known limits (tracked)
- **Blaze** is a bump on the forehead, not a stripe down the face → step B.
- Poses still come from the 6 placeholder poses; sit/lie body-drop distances are placeholder constants that don't scale with leg length → step D replaces the motion.
- 25 shapes per ray is heavier than the placeholder's 12; add bounding-sphere early-out in the perf pass.

## Next Step
Step B.
