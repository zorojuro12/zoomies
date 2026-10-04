# 2026-10-03 — daniel — T3 done: SDF dog first light

**Status:** T3 of `docs/plans/b-p1-sdf-spike.md` complete. `?dog=sdf` on the preview page now shows a ray-marched SDF dog: smooth-blended clay body, per-shape colours, key/fill/rim lighting, ambient occlusion, soft contact shadow, three-quarter view, driven by the placeholder's bones (sit works). ~16 ms/frame. Typecheck, lint, Prettier, 35/35 tests green. Committed on `b/sdf-spike`, not pushed.
**Decided:** SdfDog is a new class that borrows the placeholder's motion through a temporary bridge; the preview switch is `?dog=sdf` (preview.ts is Lane B's per CLAUDE.md, so no cross-lane edit was needed).
**Spec:** No change.
**Next:** T4 — direction → yaw (smooth turns; up the screen = back view, down = front view), then T5 look check vs the photo.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/sdf/{SdfDog.ts,sdf-shader.ts}`, `app/src/renderer/preview.ts`

---

## How it works (short)
A flat quad follows the dog. For each pixel the shader shoots a ray into the screen and marches it against ~12 SDF shapes (inverse bone matrices as uniforms), blended with each shape's smooth-min radius. Colour = shapes vote by closeness. Edge anti-aliasing from the ray's closest approach. `gl_FragDepth` is written for the later fur splats. Shadow = a soft radial-gradient plane behind the dog.

## What Worked
- First screenshot after the fix shows both leg pairs, soft joins at shoulder/tail/snout, rim light, contact shadow. `sit` pose drives the shader correctly. Frame time 16.1–16.7 ms (vsync cap).
- Verified the yaw direction by geometry: with `rotation.y = −25°` facing right, the dog's front turns toward the viewer.

## What Didn't Work
- **Nothing rendered at first (blank page, no console errors)** — cause: the camera is y-down (`top=0, bottom=h`), which mirrors the screen and flips plane winding, so a flat plane's front face was culled. Closed meshes (the placeholder's spheres) hide this. Fix: `side: THREE.DoubleSide` on the quad and shadow planes. Any future flat plane in this camera needs the same.
- Screenshot windows smaller than ~900 px make the preview buttons wrap and cover the dog — use the default size or bigger.

## Test Coverage
- **Covered:** SDF maths (T2, 17 tests). 
- **Not covered:** GLSL copy of the maths, shading, bridge — checked by eye via screenshots (hackathon policy).

## Known limits (expected, fixed in later phases)
- Legs are straight sticks and the chest/snout colours blob together — placeholder shapes; the fitted Aussie dog file and an extended skeleton fix this.
- Placeholder gait barely swings the legs; our own gait + IK replaces it.
- Shadow follows the dog's y, so it rises during a jump (no ground reference yet).
- Bounds/hit-test still come from the hidden placeholder meshes.

## Next Step
T4 then T5 per the phase plan.
