# 2026-10-04 — daniel — Step F built (waiting on the Gemini key): photo → Gemini → dog spec

**Status:** The whole pipeline is written and tested with a **fake Gemini**; the real call has not been run because there is **no `GEMINI_API_KEY` on Daniel's machine yet** (no `.env`). On branch `b/gemini-spec` off `dev` (PR #6, the editor, is still open on `b/editor`). 240 TypeScript tests + 49 Python tests green, lint/typecheck clean. Committed locally, not pushed.
**Decided:** (1) The spec's safe ranges live in ONE shared file `pipeline/spec-ranges.json`; TypeScript stays the source of truth and `spec-ranges.test.ts` fails if the two ever drift. (2) Python never decides ranges itself, so a Gemini spec that passes the pipeline also passes the app's spec-file test. (3) Calls run in **daemon threads** so a hung network request can never block the program's exit.
**Spec:** No change to contracts or PRD.
**Next:** Put `GEMINI_API_KEY` in the repo-root `.env`; run `python -m zoomies_pipeline.photo_to_spec ../assets/photo/dog.jpeg --name aussie-gemini --source-photo photo/dog.jpeg`; open `/preview.html?spec=aussie-gemini` next to `?spec=aussie` and compare; check the model name (`gemini-2.5-flash` is a default to VERIFY against the models list).
**Blocked on:** The Gemini API key (Ansh has one and shares it by DM; it goes only in the gitignored `.env`).
**Touches:** `pipeline/{README.md,pytest.ini,spec-ranges.json,tests/,zoomies_pipeline/}`, `app/src/renderer/dog/spec/spec-ranges.test.ts`

---

## What was built
`photo_to_spec(photo, name, ask=…)`: runs 3 `ask` calls in parallel with a 15 s timeout → drops failures → **median** of numbers, **majority vote** of ear/tail type, **per-channel median** of colours (`aggregate.py`) → snaps each colour to the photo's real dominant colours (`colors.py`: Lab k-means with the backdrop removed, snap only within ΔE 35) → always returns a valid normalised spec; if every call fails, the default template dog (`fallback: true`). The prompt tells Gemini that 1.0 = a typical dog and gives example values per field (0.55 = corgi legs, 1.6 = greyhound legs …); the response schema enforces the fields and enum values.

## What Worked
- Test-first (red: modules missing): 49 pytest tests; all green on the first implementation run.
- **Mutation checks:** median→mean broke 6 tests; snapping without the distance limit broke 2; sequential (not parallel) calls broke 2; ignoring the timeout broke 1; unclamped numbers broke 1; files restored identical.
- Shared-ranges test: changing `legLength` max in the JSON from 1.7 to 1.8 failed exactly 1 test; restored identical.
- Environment: Python 3.14.7 venv works with `numpy 2.5`, `pillow 12`, `scipy`, `jsonschema`, `google-genai 2.28`, `pytest 9` (no wheels problems). `.venv` is gitignored.

## What Didn't Work / Notes
- `rembg` (background removal) was deliberately NOT used: heavy model download. Instead the backdrop is taken as the median of the image's border ring and dropped by Lab distance — fine for studio photos like the Huawei dog; a busy background would need rembg.
- Real Gemini behaviour is untested: model name, `response_json_schema` support in the installed SDK, and answer quality are all still to verify with a real key.
- A hung HTTP call keeps running in its daemon thread after its timeout (Python cannot kill threads); harmless for a short build-time CLI.

## Test Coverage
- **Covered:** spec normalisation (defaults, clamping, strings, bools, NaN, colours, key order, immutability), aggregation, colour maths and snapping, dominant-colour extraction, the parallel runner (median, one failure, invalid answers, all-fail fallback, timeout < 1.5 s, parallel < 0.8 s, colour snap, source photo, prompt/schema cover every field).
- **Not covered:** the real network call and the answer quality (by hand, once the key exists).

## Next Step
Key → real run on the Aussie photo → compare `aussie-gemini` with the hand-made `aussie` in the preview. That comparison is the "is Gemini a good primary, with our hand-made Aussie as the fallback" check Daniel asked for.
