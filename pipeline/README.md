# Pipeline (Lane B — Daniel)

Build-time: **dog photo → Gemini → dog spec** (`assets/dog/<name>.spec.json`). The app turns a spec
into a dog (`buildDog`), so any photo of any dog works. See `docs/plans/b-p2-spec-and-motion.md` (step F).

```
photo ─► Gemini (3 calls in parallel, 15 s timeout) ─► median of the answers ─► snap colours to the photo ─► spec.json
              └─ if every call fails: the default template dog (never hangs, never crashes)
```

## Setup

```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pytest               # 49 tests, no network needed
```

Put your key in the repo-root `.env` (`cp .env.example .env`, then `GEMINI_API_KEY=...`). It is
gitignored and never printed or written anywhere.

## Run it

```bash
python -m zoomies_pipeline.photo_to_spec ../assets/photo/dog.jpeg --name aussie-gemini --source-photo photo/dog.jpeg
```

Writes `assets/dog/aussie-gemini.spec.json` and prints how many calls succeeded and which colours
were snapped. Look at it in the app: `/preview.html?spec=aussie-gemini` (add `&edit=1` to tune it).
Options: `--calls 3` · `--timeout 15` · `--model gemini-2.5-flash` · `--out path`.

## Files

| File | What it does |
|---|---|
| `spec-ranges.json` | The spec's safe ranges, key lists and defaults. TypeScript (`dog-spec.ts`) is the source of truth; `spec-ranges.test.ts` fails if this file drifts from it. |
| `zoomies_pipeline/spec_defs.py` | Loads that file; `normalize_spec` fills defaults and clamps, like TypeScript's `normalizeSpec`. |
| `zoomies_pipeline/aggregate.py` | Median of numbers, majority vote for ear/tail type, per-channel median for colours. |
| `zoomies_pipeline/colors.py` | Lab colour distance, dominant colours of the photo (backdrop removed), snapping. |
| `zoomies_pipeline/photo_to_spec.py` | Prompt + response schema, the Gemini call, parallel runner with timeouts, fallback, command line. |

Every spec file checked in under `assets/dog/` is also tested by the app's test suite (valid dog,
nothing clamped, valid colours), so a bad generated spec fails in `npm test`, not on stage.
