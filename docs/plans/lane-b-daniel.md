# Lane B — Daniel: the dog

**Owner:** Daniel · **Machine:** Mac · **Branch prefix:** `b/`
**Workflow:** Daniel's own. Repo conventions still apply: branch off `dev`, PR into `dev` with a merge commit, journal entries with your name in the filename (`.claude/skills/journal/` is in the repo), contracts change only via small PRs.
**Read first:** `00-shared.md` (contracts §3 — especially §3.1 coordinates, §3.3 dog file, §3.4 controller, §3.5 view) · PRD v1.2 §4.0, §6, §7 · `journal/2026-10-03_1852_ansh_kickoff-decisions.md`
**Input photo:** `assets/photo/dog.jpeg` — black tri-colour Australian Shepherd, sitting, facing the camera, 380×466 (a larger original may arrive from Huawei's Drive folder; same filename).

---

## What this lane owns

| Folder / file | Contents |
|---|---|
| `pipeline/` | Python build-time reconstruction: cut-out → landmarks → placement → (optimiser) → coat colours → dog file |
| `app/src/renderer/dog/` | SDF body ray-marcher, splat coat pass, skeleton, pose library, procedural gait + IK, secondary motion, `DogView` + `DogController` implementations |
| `app/src/renderer/ui/editor/` | Pose & shape editor (sliders) |
| `app/src/renderer/preview.html` + `preview.ts` | **Standalone dog preview page** — the dog in a normal window, no overlay, works on Mac. Already scaffolded with the placeholder dog: run `npm run dev` and open `/preview.html` on the dev server in a browser |
| `assets/dog/*.dog.json` | Generated dog files (`placeholder.dog.json` comes from P0 contracts) |
| `app/src/shared/dog-file.ts` + schema | Dog file contract (shared; you're its primary owner) |

**Doesn't own:** overlay, render loop host, behaviour, physics (Ansh) · Gemini views/landmarks generation, sounds, audio, Arduino (Abel).

## Needs / provides

| | From / to | What | When |
|---|---|---|---|
| **Needs** | Abel | `assets/views/{side_sit,side_stand,back}.png` — **only for colouring the unseen sides** (P2 coat). **No longer needs `landmarks.json`** (see "Dog spec" below) | P2 — **fallback:** colour the unseen sides from the nearest front-photo colour |
| **Needs** | Ansh | Overlay + render loop hosting `DogView` | Mid P1 — **until then:** the preview page |
| **Provides** | Ansh | Real `DogView` + `DogController` (fitted body, poses, walk/run, jumps, ball in mouth) | End P2 (Ansh uses `PlaceholderDog` until then) |
| **Provides** | Abel | Pose & shape editor in the app | End P2 (Abel tunes likeness in P3) |
| **Provides** | Ansh | X-ray debug views (`setDebugView`) | P3 |
| **Provides** | Ansh | Step-out-of-photo emergence animation | P4 |
| **May take over** | Ansh | ElevenLabs L2 / Gemini G2 / G3 if Lane A is behind | Mid P3, once the dog is stable |

### Dog spec (decided 2026-10-03, replaces pixel landmarks for fitting)
Measuring limb lengths from pixel landmarks is fragile (one bad point skews a whole limb) and accuracy needn't be exact, so **Gemini returns a structured "dog spec" directly** and the pipeline starts from a standard Aussie template:
- **One Gemini call → JSON** (response schema enforced): proportions as **ratios to body height** (`leg_length`, `snout_length`, `ear_size`, `tail_length`, `chest_width`, `head_size`, ...), `ear_type`, `tail_type`, and **per-region colours as hex** (`coat, blaze, chest, paws, cheeks, brows, ear_back, ...`).
- **Robustness:** 3 calls in parallel (wait = slowest, not the sum), 15 s timeout each, take the **median** of each ratio; if all fail → the default Aussie template. Build-time only, result saved to `aussie.dog.json`, so nothing waits on Gemini on stage.
- **Clamp** every ratio to a plausible range around the template, so the dog can't come out broken.
- **Colour snap:** extract the photo's 5–6 dominant colours (k-means) and move each Gemini hex to the nearest real photo colour — Gemini decides *which colour goes where*, the photo supplies the exact paint. Fallback: default Aussie palette.
- Pixel landmarks (`landmarks.json`) become **optional**, used only by the P3 silhouette optimiser if there's time. Abel's landmark picker is off the critical path.

### Landmarks format — contract §3.9 (`app/src/shared/landmarks.ts`); optional, only for the P3 optimiser
`assets/views/landmarks.json`:
```json
{
  "image_size": { "front": [380, 466], "side_sit": [W, H], "side_stand": [W, H], "back": [W, H] },
  "front":      { "nose_tip": [x, y], "eye_l": [x, y], "...": [x, y] },
  "side_sit":   { "nose_tip": [x, y], "...": [x, y] },
  "side_stand": { "...": [x, y] },
  "back":       { "...": [x, y] }
}
```
Pixel coordinates, origin top-left. Names (use whichever are visible per view): `nose_tip, eye_l, eye_r, head_top, chin, ear_base_l, ear_base_r, ear_tip_l, ear_tip_r, withers, chest_front, belly_low, shoulder_l, shoulder_r, elbow_l, elbow_r, front_paw_l, front_paw_r, hip_l, hip_r, stifle_l, stifle_r, hock_l, hock_r, rear_paw_l, rear_paw_r, tail_base, tail_tip`.
Abel generates **two side views**: `side_sit` (same sitting pose as the photo, only the angle changes — least drift, so use it for proportions and side colours) and `side_stand` (standing profile — use it only to check leg lengths for the standing rest pose). Changing pose and angle at once makes Gemini more likely to drift into a different dog.

---

## P0 — Setup & contracts
- [ ] Clone, read the kickoff journal + `CLAUDE.md`, set up your workflow.
- [ ] Contracts session (with Ansh + Abel): own §3.3 dog file + schema, review §3.4 / §3.5, agree the landmarks format above with Abel.
- [ ] `pipeline/` venv runs (`pip install -r requirements.txt`, `pytest`).
- **Done when (CP0):** app runs on your Mac with the placeholder dog (stub OS layer).

## P1 — Spike: does the SDF dog read as *this* dog?
**Goal:** answer the project's #1 risk early, on your Mac, without waiting for anyone.
- [ ] **Preview page:** `app/src/renderer/preview.html` already exists with the placeholder dog, pose/walk/run/jump/ball buttons, a background toggle and a frame-time readout. Add a turntable and swap in your SDF dog. Your dev harness for the whole weekend.
- [ ] **Skeleton in code:** bones per §3.3 (spine, neck, head, jaw, ears, 4 × 2-segment legs + paws, tail chain); forward kinematics; rest pose standing.
- [ ] **SDF ray-marcher:** fragment shader over a screen-space quad around the dog; ~20 primitives (sphere / capsule / ellipsoid / round cone) in bone space, combined with smooth-min (`blend` per shape); soft/toon lighting; per-shape base colour; writes `gl_FragDepth` (needed later for the coat). Step + distance limits for cost.
- [ ] **Pipeline v1 — Gemini dog spec** (see "Dog spec" above): standard Aussie template dog file → Gemini call(s) return ratios + ear/tail type + region colours → median, clamp to template ranges → scale bones/shapes → `assets/dog/aussie.dog.json` (validated against the schema). Template-only fallback if Gemini fails. (`rembg` cut-out only if the colour snap needs it.)
- [ ] **Colour v0:** Gemini's per-region hex colours snapped to the photo's dominant colours (k-means) and assigned to shapes by region (black coat, white blaze/chest/paws, copper cheeks/brows/legs).
- **Tests:** smooth-min / primitive SDF maths (TS); spec → bone/shape params + clamping + median (pytest, with a fake Gemini response); colour snap (pytest); dog file validates against the schema.
- **Done when (CP1 — go / no-go):** front and side renders next to the photo; the team agrees it reads as *this* Aussie, or has a concrete tuning list. If not, continue with landmarks + slider tuning (PRD §7) — don't sink P2 into fitting.

## P2 — MVP: a living, fetching dog
- [ ] **Splat coat:**
  - Pipeline: sample ~5–10k points on the SDF surface (ray-march / gradient projection), assign each to its nearest shape, give each a small oriented size.
  - Colour by projecting the front photo; use the side/back views for surfaces the front can't see; fill gaps from the nearest coloured splat.
  - Renderer: instanced quads with Gaussian falloff, each transformed by its shape's bone (rigid per shape, no skin weights), depth-tested against the SDF depth, sorted back-to-front per frame (small set → CPU sort is fine).
  - Fallback flag: SDF-only with projected colours.
- [ ] **Pose library:** `stand, sit, lie, sleep, playBow, headTilt, scratch, stretch, pant` stored as quaternions in the dog file; transitions with cartoon timing (anticipation dip, overshoot, settle).
- [ ] **Procedural locomotion:** walk / trot / run gait phase offsets; 2-bone leg IK with feet planted on the support surface (no sliding); body bob and spine flex; smooth speed blending; turn-around.
- [ ] **Jumps:** crouch → stretch → tuck → land poses blended along the arc `jumpTo` receives; landing squash.
- [ ] **Secondary layers:** breathing, blink, tail wag (amount from `setLayer`), ear springs, head/neck look-at with clamps; ball attach point at the mouth.
- [ ] **`DogController` + `DogView`** fully implemented per §3.4 / §3.5 (`getBounds` + `hitTest` accurate — Ansh uses them for click-through and region rendering). Hand to Ansh as soon as stand/walk/sit work; iterate after.
- [ ] **Pose & shape editor:** sliders for each bone's rotation and each shape's size/offset; save poses + shape tweaks back into the dog file (download/export JSON). Usable by Abel without code.
- [ ] **Perf:** dog ≤ ~3 ms/frame on the demo laptop (Ansh measures on Windows); coat count and march steps as the knobs.
- **Tests:** 2-bone IK solver; gait phase timing; pose interpolation/easing; coat projection colour lookup (pytest).
- **Done when (CP2):** in the overlay on Windows, the real dog stands, sits, lies, sleeps, walks/runs to the ball, jumps, carries the ball, wags — smooth, no foot sliding you notice at desktop-pet size.

## P3 — Shoulds
- [ ] **Silhouette-fitting optimiser** (PRD Should #13): render front + side silhouettes of the SDF dog on a pixel grid (numpy), loss = mismatch vs the cut-out masks (distance-transform or IoU), optimise shape sizes/offsets within bone constraints (`scipy.optimize` or CMA-ES); regenerate the dog file. Keep Abel's editor tweaks as overrides on top.
- [ ] **X-ray debug views** (Should #21): `landmarks` (photo with points + fitted skeleton), `shapes` (SDF primitives in flat colours), `coat` (splats only), wired to `setDebugView`.
- [ ] **Likeness + motion polish** with Abel using the editor (head shape, ear set, muzzle length, tail).
- [ ] If Ansh hands them over: ElevenLabs L2 / Gemini G2 / G3 (see Lane A P3).
- **Tests:** silhouette loss decreases on a synthetic target; optimiser respects constraints.
- **Done when (CP3):** fitted dog + x-ray views in the demo path on Windows.

## P4 — Polish
- [ ] **Step-out-of-photo emergence** (with Ansh): the dog starts matching the photo's sitting pose and framing, then steps out of the picture window.
- [ ] Motion polish on whatever looks weakest in the demo path.
- [ ] Cheap Coulds riding on your work: denser/longer coat (#28), screen-colour lighting (#27), TRELLIS shape as an extra fitting target (#29) — in that order, only if time.
- **Done when (CP4 — feature freeze).**

## P5 — Submission
- [ ] Bug fixes only. Help Abel capture the x-ray "technique reveal" shot for the video.

---

## Risks in this lane
| Risk | Mitigation |
|---|---|
| Dog doesn't read as *this* Aussie (head/face) | CP1 side-by-side early; head shapes get the most primitives; editor sliders; colours always from the photo |
| Gemini dog spec off (wrong ratios/colours) | Median of 3 calls; clamp to template ranges; colour snap to the photo; default Aussie template; editor sliders to fix by eye |
| Gemini side/back views inconsistent or late | Only needed for unseen-side colours (P2); fall back to front-photo colours |
| Low-res photo (380×466) limits colour detail | Coat is stylised anyway; ask Abel for the original from Huawei's Drive |
| Coat splats fighting the SDF surface (z-fighting, flicker) | Depth-test against SDF `gl_FragDepth` with a small offset; rigid-per-shape attachment; fallback to SDF-only |
| Procedural gait looks robotic | Cartoon timing, body bob, simplify phases; tune in the preview page |
| Ray-march cost too high on the Windows laptop | Tight screen-space quad, bounding spheres per bone, step cap, half-res + upscale if needed |
| Integration only tested on Windows | Ship `DogView` early (stand/walk) so Ansh finds overlay issues while you keep iterating |

## Suggested phase plans (Daniel's tools, Daniel's format)
`b-p1-sdf-spike` → `b-p2-coat-poses-gait` → `b-p3-fitting-xray` → `b-p4-polish` — written at the start of each phase. Put them in `docs/plans/` if you want the others to see them.
