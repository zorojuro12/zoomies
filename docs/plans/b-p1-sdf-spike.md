# b-p1 — SDF spike: first light (Lane B, Daniel)

**Branch:** `b/sdf-spike` · **Parent plan:** `lane-b-daniel.md` P1 · **Contracts:** `app/src/shared/{dog-file,dog-controller,dog-view}.ts`
**Question this phase answers:** does a dog made of blended SDF shapes, lit in a three-quarter view, look good enough to build the project on?

## Decisions already made (2026-10-03)
- **3D dog on the 2D desktop stage.** Orthographic camera in desktop pixels (contract §3.1). The dog is true 3D inside: it has depth, yaw and lighting. No change to the contracts.
- **Three-quarter view** (~25° yaw instead of a pure side view) so both sides of the dog read. Direction of travel drives yaw, including up/down the screen (running away from / toward the viewer). **No size change by screen height** — a dog on a high window must not shrink.
- **New `SdfDog` class** behind `DogView` + `DogController`; the placeholder stays as Ansh's fallback. If the 3/4 view doesn't read well, we revisit a deeper 3D approach.
- **Temporary bridge:** `SdfDog` drives a hidden `PlaceholderDog` for motion (poses, walk, jump) and reads its bone world matrices each frame. Replaced by our own skeleton + gait in the next phase.

## Tasks (in order)

### T1 — Screenshot harness (~20 min)
A small Electron script that loads `http://localhost:<port>/preview.html`, clicks a named button (`sit`, `run ↔`...), waits N ms, and saves a PNG. Lets Claude see the dog without a human describing it.
- Location: `app/src/renderer/dog/tools/shot.mjs` (lane B folder, not bundled).
- **Done when:** `electron … shot.mjs --pose sit --out sit.png` writes a PNG showing the dog.

### T2 — SDF maths reference (CPU) + tests (~30 min)
`app/src/renderer/dog/sdf/sdf-math.ts`: `sdSphere`, `sdCapsule`, `sdEllipsoid`, `sdRoundCone`, `smin`. These mirror the GLSL and are the reference for bounds/hit-testing.
- **Tests first (tdd skill; seam = the exported functions):** known literals — e.g. sphere r=2 at distance 5 → 3; point inside → negative; `smin(a,b,k)` ≤ `min(a,b)` and equals `min` when |a−b| ≥ k.
- **Done when:** `npm test` passes with the new tests.

### T3 — `SdfDog` first light (~1.5 h)
- `app/src/renderer/dog/sdf/SdfDog.ts` + `sdf.vert.glsl` / `sdf.frag.glsl` (imported with `?raw`).
- A quad in world pixels around the dog's bounds (+margin); each pixel ray-marches the shapes (inverse bone matrices as a uniform array), smooth-min with each shape's `blend`, per-shape colour mixed by blend weight, `gl_FragDepth` written (needed later for the coat).
- Lighting v0: warm key + cool fill + rim light, soft toon bands, SDF ambient occlusion, soft contact shadow under the paws.
- Preview page gets a toggle: **placeholder ↔ SDF dog** (preview.ts is Ansh's file → small separate change, or load SdfDog via `?dog=sdf` handled in a lane-B file; decide at T3 start and tell Ansh).
- **Done when (first-light check):** screenshots of stand / sit / lie / walk from the harness show a smooth, connected clay dog with both sides visible, ≥60 FPS in the preview page.

### T4 — Direction and yaw (~45 min)
Yaw follows the move direction (left/right ±25°, up the screen → turned away, down → turned toward), eased so turns are smooth.
- **Test:** direction vector → target yaw (pure function).
- **Done when:** `run ↔` and `jump` visibly turn the body; a hand-made "run up" test shows the back view.

### T5 — Look check and go/no-go (~20 min)
> **Moved (2026-10-03):** the dog on screen is the placeholder, not fitted to the photo, so a likeness check now is premature. T5 is replaced by step B of `b-p2-spec-and-motion.md` (hand-written Aussie spec, then the side-by-side). The rendering itself (clay look, lighting, 3D turning) is judged done at T4.
Side-by-side screenshots (stand, sit, run, run-up) next to `assets/photo/dog.jpeg`. Daniel and Claude decide: continue with this approach, or change the view/approach.

## Risks
| Risk | Mitigation |
|---|---|
| Shader too slow with many shapes on the Mac/Windows laptop | Tight quad around the dog, bounding-sphere early-out, step cap, half-res fallback; measure in the preview page |
| Hidden-placeholder bridge breaks when Ansh edits it | Pin to bone names from the dog file; keep the bridge in one file; replace in the next phase |
| Looks flat/plastic | Rim light, AO and contact shadow are in T3; fur/coat comes later |
| Screenshot harness can't create a WebGL context headless | Run with a visible window (`show: true`) and capture the page |

## Out of scope for this phase
Aussie fitting, Gemini dog-spec pipeline, splat coat, extended skeleton (2-segment legs, jaw, tail chain), pose editor.
