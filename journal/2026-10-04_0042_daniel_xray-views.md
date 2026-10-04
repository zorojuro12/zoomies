# 2026-10-04 — daniel — X-ray views: `setDebugView('shapes')` and a skeleton overlay

**Status:** `DogView.setDebugView` is implemented on the SDF dog (plan Should #21). **`'shapes'`**: every SDF primitive drawn in its own flat colour with a hard union (no blending): the "clay balls" the dog is made of. **`'landmarks'`** (the contract's slot): the skeleton drawn over the normal dog (cyan bones, pink joints), following the pose live. **`'coat'`**: no splat coat exists, so it shows the normal dog. Three preview buttons: `x-ray: shapes`, `x-ray: skeleton`, `x-ray: off`. On branch `b/xray`, **stacked on `b/perf`** (PR #9 still open; the x-ray shader edits sit on top of its shader). All tests, lint, typecheck green. Committed locally; PR next.
**Decided:** Use the contract's `'landmarks'` slot for the skeleton (our fit comes from a Gemini spec, not pixel landmarks, so there are no landmarks to show). X-ray stays a debug/demo view: it costs nothing in the normal path (the extra loop only runs when `uHard` is on).
**Spec:** No change to contracts or PRD.
**Next:** PR (note: stacked on #9); then the splat-coat decision with a hard stop ~2:30 AM; step-out-of-photo with Ansh.
**Blocked on:** PR #9/#10/#11 reviews (Ansh).
**Touches:** `app/src/renderer/dog/sdf/{debug-view.ts,debug-view.test.ts,sdf-shader.ts,SdfDog.ts}`, `app/src/renderer/preview.ts`

---

## What Worked
- Test-first (`debug-view.test.ts`, 8 tests): `debugColor(i)` is a valid RGB in 0..1, deterministic, **all 40 colours clearly different** (min pairwise distance > 0.1), **neighbours very different** (> 0.3), never near-black/white (luminance 0.12–0.92); `debugFlags` maps each mode (normal / shapes / landmarks / coat). Mutation checks: constant hue broke 1, forgetting the hard union for `'shapes'` broke 1; restored identical.
- **Normal view unchanged:** pixel comparison against the render saved before this work: 0 differing pixels (sit and stand; two fresh stand runs also agree with each other).
- Shapes view shows: ellipsoid body, chest ball, neck tube, head sphere, cone snout, 3-part tail, each leg as upper + shin + paw, ears, eyes: a ready-made "how it's built" shot for the demo video.

## What Didn't Work (so nobody retries it blind)
- **First palette failed its own test:** two of 40 colours were only 0.047 apart. Fixed the palette (brightness cycle of 3 × saturation cycle of 2 on a golden-ratio hue walk), not the test.
- **GLSL reserved word:** `flat` (interpolation qualifier) can't be a variable name → `flatCol`.
- **Skeleton disappeared** when I removed `transparent: true` from the line/point materials: opaque objects draw BEFORE the dog's transparent quad and get painted over. Keep `transparent: true` + `renderOrder 5` + `depthTest: false`.
- A search-and-replace for the points material silently didn't match because prettier had reformatted the block; always re-read the actual text before patching.
- **Point size is in device pixels:** `size: 12` was ~50 px squares at zoom 2.2 on a retina display; `size: 4` is right.
- My first "normal view unchanged" check reported thousands of differing pixels: (1) three new buttons changed the toolbar rows at the top of every screenshot (compare only the dog's region), and (2) a stand screenshot taken before the deterministic freeze had finished (needs `--wait 5000` for `freeze=150` on a busy machine).

## Test Coverage
- **Covered:** palette and mode mapping (8 tests).
- **Not covered:** the GLSL x-ray branch and the skeleton overlay (checked by eye with screenshots of shapes and skeleton on standing and sitting dogs).

## Next Step
PR; then decide on the splat coat.
