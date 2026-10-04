# 2026-10-04 — daniel — Perf pass: the SDF dog is ~4× cheaper (bounding spheres)

**Status:** On branch `b/perf` (stacked on `b/editor`, PR #6 still open; PR #7 for step F is also open). The shader now rejects rays that miss the dog's bounding sphere, marches only the stretch of each ray inside it, skips a shape's exact distance when its own bounding sphere is far away, and the quad is sized to the dog's sphere. Measured on Daniel's M4 (GPU-bound, 60 FPS lock off, 800×600 canvas, 3 runs each): demo-size dog total **5.2 → 2.4 ms/frame**, the dog's own cost **≈3.8 → ≈0.9 ms** (PRD target 1–3 ms). 277/277 tests, lint, typecheck green. Committed locally, not pushed.
**Decided:** The speed-up must not change the picture. The skip rule is exact for the SDFs (smin(d, x, k) = d once x ≥ d + k), and a bounding sphere's distance is a lower bound of the shape's distance; both are proven by tests (`bounds.test.ts`) and a pixel comparison.
**Spec:** No change to contracts or PRD.
**Next:** PR the perf work after #6 merges (it is stacked on it); a Windows/RTX 2060 run with Ansh (`shot.mjs --bench` or the preview); then Gemini key → real run of step F.
**Blocked on:** Nothing for perf; the Gemini key for the real step F run.
**Touches:** `app/src/renderer/dog/sdf/{sdf-shader.ts,SdfDog.ts,bounds.ts,bounds.test.ts}`, `app/src/renderer/dog/tools/shot.mjs` (`--bench N`), `app/src/renderer/preview.ts` (`?size=`, `?pose=`, `?freeze=N`)

---

## Measurements (M4, before → after, ms/frame at 800×600)
| Case | Before | After |
|---|---|---|
| placeholder dog (the floor, no shader) | ~1.45 | ~1.6 |
| SDF dog, size 0.6 | 2.8 | 1.74 |
| SDF dog, size 1.15 (demo) | 5.2 | 2.42 |
| SDF dog, size 1.6 | 7.8 | 3.07 |
Spread between the 3 runs of a case was 1–2%. (The first "after" floor run read 3.0 ms: a warm-up outlier.) Reproduce: `node_modules/.bin/electron src/renderer/dog/tools/shot.mjs --zoom 1 --size 800x600 --bench 250 --url '<preview url>?spec=aussie&size=1.15'`.

## What Worked
- Test-first: bounding spheres contain every shape (sampled points for sphere/capsule/ellipsoid/round cones), are tight, and never over-estimate the exact SDF distance; union sphere (hand-worked: two unit spheres 10 apart → centre 5, radius 6) and an allocation-free `unionSphereInto` matching it. Mutation checks (round cone centred on the origin, capsule without end caps, union ignoring sphere radii) each failed 3–5 tests; restored identical.
- **Pixel comparison** with a deterministic mode (`?freeze=150&pose=<name>`, fixed 1/60 s steps): before vs after differ in only ~230–260 pixels of 3.5 million (0.007%), max difference up to ~135/255, **all on edges** (outline and the places where one part passes in front of another: single-pixel grazing rays); nothing changed on any surface.

## What Didn't Work (so nobody retries it blind)
- **First benchmark numbers were nonsense** (13.9 / 4.7 / 12.4 ms at zoom 1/2/3): the harness `--zoom` changes the canvas size as well as the dog's, mixing two costs. Measure with a FIXED window and change only the dog (`?size=`).
- **A background `npm run dev` Electron app window competes for the GPU** and makes timings noisy (one run read 42 ms). Benchmarks ran against a bare `vite` server with a throw-away config in the scratchpad (outside the repo), on port 5199.
- Piping the harness output into `grep` dropped the result line when Electron exits; redirect to a file instead.
- First comparison (non-deterministic) showed thousands of differing pixels: that was the tail wag / ears / idle look-around moving between screenshots, not the shader. A frozen, fixed-step mode removed it.
- My first bounds tests failed on correct code: sampling a fixed ±30 cube hit too few points of a small shape, and the ellipsoid SDF is an approximation that under-estimates far away, so "never over-estimates" is only asserted for the exact SDFs (the ellipsoid is covered by containment).
- GLSL: `half` is a reserved word (renamed `halfLen`).
- A command containing `rm -f $S/*.png` was blocked by the safety check (unexpanded variable); the removal was unnecessary (files are overwritten), so it was dropped.

## Test Coverage
- **Covered:** shape bounds, union spheres (24 tests).
- **Not covered:** the GLSL itself (checked by the pixel comparison and by eye); GPU time on the Windows RTX 2060 (not measured yet).

## Next Step
Wait for #6 to merge, merge `dev` into `b/perf`, open the PR; ask Ansh to run the benchmark on his Windows laptop.
