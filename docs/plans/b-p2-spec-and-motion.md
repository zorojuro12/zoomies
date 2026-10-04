# b-p2 — Dog spec, the Aussie, and our own motion (Lane B, Daniel)

**Follows:** `b-p1-sdf-spike.md` (T1–T4 done; T5 replaced by step B below) · **Parent plan:** `lane-b-daniel.md`
**Principle (Daniel, 2026-10-03):** nothing in the code knows it is an Aussie — a dog's identity lives only in a **dog spec** (data). Demo-level accuracy is enough; polish where judges look (face, motion, lighting).

```
any photo ─► Gemini ─► dog spec (JSON) ─► generic builder (TS) ─► DogFile ─► SdfDog
                              ▲
              hand-written for the Aussie first
```
Builder is TypeScript (instant preview via Vite, Vitest-testable); Python only produces the spec (Gemini, median of 3, colour snap). **No contract change** — `DogFile` stays as defined in `app/src/shared/dog-file.ts`.

## Constraint to remember
`SdfDog` still borrows the placeholder's motion (10 bones: body, neck, head, ear_l/r, tail, leg_fl/fr/rl/rr; 6 poses). Until step D, the builder keeps those bone names and poses and adds detail through extra **shapes** on those bones (eyes, nose, brows, cheeks, paws, elbow/hock bulges). The richer skeleton arrives in step D.

## Steps, in order (demo-level; times are estimates)

| # | Step | Done when | Est. |
|---|---|---|---|
| **A** | **Spec + generic builder.** Spec type with defaults and clamping (body size, leg/snout/head/ear/tail ratios, ear type, tail type, region colours, eye/nose colour); `buildDog(spec) → DogFile` from a template; eyes, nose, brows, cheeks, paws. Tests first (clamping, ear/tail variants, output passes `validateDogFile`). | A spec renders as a complete dog with a face in the preview (`?dog=sdf&spec=<name>`) | 1.5 h |
| **B** | **Aussie spec from the photo + look check (old T5).** Hand-write `assets/dog/aussie.spec.json` from `assets/photo/dog.jpeg`; side-by-side screenshots (stand, sit, run, run-up, front) next to the photo. **Go/no-go.** | Daniel and Claude agree it reads as this Aussie, or have a short tuning list | 1 h |
| **C** | **Second spec — generality proof.** A very different dog (short legs, floppy ears, golden). | Both dogs render from the same builder with no code changes | 30 min |
| **PR 1** | Merge `dev` in, run checks, push, PR into `dev` (merge commit). Ansh can now swap `PlaceholderDog` → `SdfDog` in the host. | PR merged; group chat told | 30 min |
| **D** | **Own motion:** skeleton with 2-segment legs, jaw, ear and tail chain; pose library (stand, sit, lie, sleep, playBow, headTilt, scratch, stretch, pant) with cartoon timing; procedural gait + 2-bone leg IK (no foot sliding); jump poses; breathing, blink, tail wag, ear springs, head look-at that respects yaw. Replaces the placeholder bridge. | Dog walks/runs/sits/lies/jumps with planted feet; `DogController` fully ours | 3 h |
| **E** | **Pose & shape editor** (sliders, save to JSON) — Abel needs it for likeness tuning. | Abel can tweak a pose/shape without code | 1.5 h |
| **F** | **Gemini dog-spec pipeline (Python):** one call → spec JSON, 3 in parallel, median, clamp, colour snap, template fallback. | Any dog photo → `*.spec.json` that renders | 1.5 h |
| **G** | **Splat fur coat** (stretch; first thing cut per `00-shared.md` §6). | Fuzzy edge on the dog without flicker | 2 h |
| **H** | Polish: step-out-of-photo with Ansh, x-ray views, motion tuning. | — | rest |

## Cut order if we slip
G (splat coat) → F reduced to template-only fallback + manual spec → E reduced to a read-only debug panel. **Never cut:** A–D (the dog reading as a dog, moving well).

## Out of scope
Spots/patch markings (a dalmatian) — later via the splat coat's projected photo colours; non-dog bodies (cat, horse).
