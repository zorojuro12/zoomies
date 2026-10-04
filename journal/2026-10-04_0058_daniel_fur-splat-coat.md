# 2026-10-04 — daniel — The splat fur coat works (PRD Must #2): gate passed

**Status:** The dog now has a fur coat: 6000 soft strand splats scattered over its rest-pose surface, each glued to the nearest SDF shape, drawn as instanced quads after the dog. It passed all three gates set beforehand: **no flicker** (every strand is a fixed function of the bone matrices, no per-frame randomness), **cheap** (+0.6 ms at demo size, ~+1 ms at the large size; limit was 2 ms), and **clearly better** (compare `fur: on/off` in the preview). On branch `b/fur`, stacked on `b/polish` → `b/xray` → `b/perf`. 337/337 tests, lint, typecheck green. Committed locally; PR next.
**Decided:** (1) Glue each splat to the NEAREST shape and store its position/normal in that shape's local frame, so it follows the bones with one matrix per shape (no skin weights). (2) Strands lie back along the body ("flow") blended with the outward normal, which reads as groomed fur; straight-out strands looked like a hedgehog. (3) No sorting: strands are tiny and alike. (4) The contract's `'coat'` x-ray mode now means "fur only"; `'shapes'` hides the fur. (5) **Pitch wording:** these are anisotropic Gaussian-profile splats (soft elongated sprites) rendered as instanced quads and glued to SDF shapes; no depth sorting and no spherical harmonics, so say "splat-style fur coat", not full 3D Gaussian splatting.
**Spec:** No change to contracts or PRD (the PRD's coat is delivered; `DogFile.coat` stays unused: our strands also need normals, which `CoatSplat` has no field for, so the fur is generated at load, 288 ms for 6000 splats).
**Next:** PR; update the pitch / Devpost wording; step-out-of-photo with Ansh; Windows/RTX 2060 check of the whole stack.
**Blocked on:** Reviews of #9–#13 (Ansh).
**Touches:** `app/src/renderer/dog/fur/{fur.ts,fur.test.ts,fur-renderer.ts,fur-renderer.test.ts}`, `app/src/renderer/dog/sdf/{SdfDog.ts,debug-view.ts,debug-view.test.ts}`, `app/src/renderer/preview.ts`

---

## How it works
**Build time (`fur.ts`, pure):** pick a shape (weighted by size) and a random point near it → slide it onto that shape's own surface (follow the distance gradient) → slide it onto the BLENDED surface of the whole dog (smooth union; where shapes overlap the visible surface is no single shape's) and keep it only if it lands (|d| < 0.3 px) → normal = gradient of the union, and the splat is rejected unless stepping 2 px along it really leads away (creases where a leg meets the body are ambiguous) → glue to the nearest shape (never the eyes or nose) → colour = the shader's own colour-vote at that spot, with ±10% brightness variation.
**Run time (`fur-renderer.ts`):** one instanced quad per splat. The vertex shader reads that splat's shape matrix from a uniform array (`uFwd`, refreshed per frame by `SdfDog`), places the root on the surface, lays the strand along the screen projection of its normal blended with the flow, shortens it when it faces the viewer, lights it with the body's key light. The fragment is a Gaussian across the strand fading toward the tip. Depth-tested against the SDF dog's depth so far-side strands are hidden; strands can stick out past the outline (that is the fluffiness).

## What Worked
- Test-first sampler (31 tests, every demo dog: default, aussie, golden, greyhound): every splat within 0.6 px of the blended surface; normals unit length and lead outward; valid shape indices; colours in 0..1; sizes in 0.5..1.6 with variation; the big parts each get a fair share (body, head, tail, legs); never on the eyes/nose; deterministic per seed; **white-chest fur is bright and black-body fur is dark** (independent semantic check, not a re-computation). Mutation checks: no projection onto the surface broke 4, fur on the eyes/nose broke 4, constant grey colour broke 1.
- Renderer tests (6): one instance per splat, matrix slots for every shape, flow normalised and falls back to "hang down" when there is no screen direction, strand length scales with dog size, show/hide/dispose. Mutations (flow not normalised; size ignoring dog scale) each broke 1.
- Cost on the M4 (800×600, 3 runs each, GPU-bound): fur OFF 2.42 ms → fur ON **3.02 ms** (size 1.15); size 1.6: fur ON 4.1 ms.
- By eye: standing, running (fur streams back, tail feathered, paws fluffy) and from the front (soft face and chest, eyes and nose clear). The fur-only view shows the whole coat as thousands of oriented strands.

## What Didn't Work (so nobody retries it blind)
- **First render: strands 5.5 px long standing straight out** = a spiky hedgehog halo. Fixed with shorter strands (3.4 px) that lie back along the body.
- **4 of 1500 splats on the greyhound pointed sideways** in tight leg/body creases (moving 2 px along the normal gained only 0–0.5 px of distance). Fixed in the sampler by rejecting splats whose normal does not lead outward, not by loosening the test.
- A first attempt to write the test file failed because the target folder did not exist yet (`mkdir` after `cat >`); and a patch script run from the repo root instead of `app/` silently did nothing. Always `cd app` first.

## Test Coverage
- **Covered:** the whole sampler and the renderer's pure behaviour (37 fur tests) plus the updated x-ray flags.
- **Not covered:** the GLSL (checked by eye and by the benchmark); temporal stability beyond "no per-frame randomness" (not measured frame by frame); behaviour on Windows/the RTX 2060 (not run).

## Next Step
PR; Devpost wording; Windows check.
