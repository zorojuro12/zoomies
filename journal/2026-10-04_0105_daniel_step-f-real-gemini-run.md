# 2026-10-04 — daniel — Step F verified on real Gemini: great on proportions, wobbly on small markings

**Status:** Real `gemini-3.8-flash` run on `assets/photo/dog.jpeg` works end to end (`5/5 calls ok`) and the output `assets/dog/aussie-gemini.spec.json` passes the app's own spec safety net (259 TypeScript tests, 51 pytest, lint, typecheck green). Two fixes came out of the real run (model name; colour snap). On branch `b/gemini-run` off `dev`; committed locally, PR next.
**Decided:** (1) Default model **`gemini-3.8-flash`** (verified: `gemini-2.5-flash` is in the model list but returns 404 "no longer available to new users"). (2) The colour snap to the photo is now **conservative** (`--snap-delta 10`, was an effective 35): the first real run showed it dulled Gemini's already-correct copper (`#ba6c34` → `#876849`) because the photo's small copper areas blend with black fur in the k-means clusters. (3) Default **5 calls** (parallel, so no extra wait). (4) **The hand-made `aussie` stays the demo dog**; `aussie-gemini` is the "any photo" capability, and a second opinion on the proportions.
**Spec:** No change to contracts or PRD.
**Next:** PR this; x-ray "shapes" view; splat coat only after that (hard stop ~2 AM).
**Blocked on:** Nothing. (Ansh's OK on PR #10's `main.ts`; Windows/RTX 2060 check of PR #9/#10.)
**Touches:** `pipeline/zoomies_pipeline/photo_to_spec.py`, `pipeline/tests/test_photo_to_spec.py`, `pipeline/README.md`, `assets/dog/aussie-gemini.spec.json`

---

## What the real runs showed
- **Proportions and types are stable and close to the hand-made Aussie.** 3 runs × 5 calls gave identical numbers every time: legLength 1, headSize 1.05, tailThickness 1.35, earType `semi`, tailType `fluffy`, cheeks always copper (`#b36837 … #ba7139`). Hand-tuned vs Gemini: legs 1.0 vs 1.0, chest 1.15 vs 1.15, leg thickness 1.1 vs 1.1–1.15, ears `semi`/`semi`, tail `fluffy`/`fluffy`; main differences: head size 1.25 vs 1.05, body width 1.3 vs 1.15, tail bushiness 0.85 vs 1.35.
- **Leg colour is the one thing that wobbles** across runs (white / copper / white): the legs in this photo really are a black / white / copper mix. Fine markings are where the hand-made spec is better.
- Gemini's raw colours were already within a few units of the hand-picked ones (coat `#1b1b1e`, chest `#eae8e2`).

## What Worked
- The fallback did its job on the first real failure: with the dead model name all 3 calls returned 404, the pipeline wrote the default dog and exited with a clear message; nothing hung.
- Model-list check: `client.models.list()` filtered to `generateContent` (names only; the key is never printed): 32 models; flash-family text/vision candidates include `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-flash-latest`.
- Test-first for the snap change: far-from-palette colours are kept (not dulled), near ones get a tiny correction, the distance can be widened; mutation (snap distance ignored) failed 1 test; restored identical. Then the 51 pytest + the app's `spec-files.test.ts` over the real generated file.

## What Didn't Work
- `gemini-2.5-flash` (my default): 404 for new keys. Don't use it.
- A wide colour snap (ΔE 35): turned vivid copper into dull brown and made the pipeline's output worse than the model's own answer.
- 3 calls were not enough to stabilise the leg colour; 5 calls improved proportions' agreement but leg colour still varies (2 of 3 runs white).

## Notes
- The Gemini key was pasted into chat by Daniel and stored in the gitignored repo-root `.env` (`chmod 600`); never printed or committed. **Rotate it if this conversation is ever shared.**
- SDK prints a harmless "Direct use of automatic function calling" notice on each call.

## Test Coverage
- **Covered:** all pipeline logic (51 pytest) and the real output against the app's spec safety net.
- **Not covered:** answer quality on dogs other than this Aussie (only one photo exists in the repo): the generality claim for the pipeline rests on the builder tests and this one real run.

## Next Step
PR; then x-ray shapes view.
