# 2026-10-03 — daniel — Pulled all branches, merged Ansh's contracts into b/sdf-spike

**Status:** `b/sdf-spike` now contains `origin/a/contracts` (contracts as code, stubs, placeholder dog, preview page). `dev` and `main` had nothing new. `npm install` still not run (waiting for Daniel's go). Nothing pushed.
**Decided:** Build on Ansh's existing preview page and `PlaceholderDog` instead of writing our own Step 1; keep the Gemini dog-spec plan, and treat the landmarks contract (§3.9) as optional.
**Spec:** No change to the PRD. Lane B plan: kept my "Dog spec" section and merged it with Ansh's contract-pointer edits (single conflict in `docs/plans/lane-b-daniel.md`, resolved by combining both).
**Next:** Daniel says go → `npm install`, run the 18 tests, open `/preview.html`; then add the turntable and start Step 2 (skeleton) against the real contracts.
**Blocked on:** Nothing. `a/contracts` is not yet merged into `dev` (PR pending on Ansh's side); `dev` is protected, so our branch also lands through a PR.
**Touches:** `app/src/shared/*`, `app/src/renderer/{preview.html,preview.ts,host/,dog/placeholder/}`, `docs/plans/lane-b-daniel.md`, `assets/dog/placeholder.dog.json`

---

## What I found in `a/contracts`
- `app/src/shared/dog-file.ts` (+ `dog-file.schema.json`, `validateDogFile()`), `dog-controller.ts`, `dog-view.ts` — the interfaces Lane B implements.
- Dog-local frame: pixels, origin between the paws, +x forward, **y down**, +z toward the viewer. `SdfShape` gained a `color` (linear RGB 0..1).
- `PlaceholderDog` implements DogView + DogController with plain meshes; `placeholder.dog.json` has 10 bones, 12 shapes, 6 poses.
- `preview.html` + `preview.ts` already exist (pose buttons, walk/run/jump/ball, background toggle, frame-time readout). Assets load via `assetUrl()`; repo-root `assets/` is the renderer public dir.
- Branch rules: `dev`/`main` protected, PR + merge commit only, journals included.

## Decisions Made
- **Reuse Ansh's preview page** — reason: it already covers what Step 1 was going to build; we only add the turntable and later swap `PlaceholderDog` for the SDF dog behind the same interfaces.
- **Landmarks contract kept but optional** — `landmarks.ts` still says "Abel produces, Daniel consumes"; our Gemini dog-spec replaces it for fitting, so Ansh/Abel should know landmarks are no longer on the critical path.
- **Conflict rule applied** — `lane-b-daniel.md` is my plan, so my version wins; I combined both heading changes rather than dropping Ansh's edits.

## Open Questions / Blockers
- Tell Ansh: PRD G1/§6.2 and `landmarks.ts` comment still assume landmarks; ask him to merge `a/contracts` into `dev`.
- Tell Abel: landmark picker is off the critical path; views only for unseen-side colours.
- Contracts review session (~20 min with Ansh and Abel) not held yet; anything I want changed goes through a small PR. Candidate for review: the dog-spec needs no contract change.
- Placeholder dog not yet seen on screen by anyone (Ansh's journal says no browser in WSL).

## Next Step
`npm install` → `npm test` (expect 18 passing) → `npm run dev` → open `/preview.html` in Chrome and look at the placeholder dog.
