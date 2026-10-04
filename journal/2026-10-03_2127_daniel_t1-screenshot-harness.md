# 2026-10-03 — daniel — T1 done: screenshot harness

**Status:** T1 of `docs/plans/b-p1-sdf-spike.md` complete. `app/src/renderer/dog/tools/shot.mjs` loads the preview page in a hidden Electron window, clicks buttons by label, waits, and saves a PNG that Claude can read. Verified on Daniel's Mac with `stand`, `sit` and `run ↔`. Lint, Prettier, typecheck and 18/18 tests still green. Committed on `b/sdf-spike`, not pushed.
**Decided:** The harness lives in the Lane B folder as a plain `.mjs` (not bundled) and takes everything by flags, so no changes to Ansh's `preview.ts` were needed.
**Spec:** No change.
**Next:** T2 — SDF maths reference (`sdSphere`, `sdCapsule`, `sdEllipsoid`, `sdRoundCone`, `smin`) with tests written first; then T3 `SdfDog` first light.
**Blocked on:** Nothing. The dev server must be running (`npm run dev`); it is on port 5174 here because 5173 is used by another process, so pass `--url` if the port changes.
**Touches:** `app/src/renderer/dog/tools/shot.mjs`

---

## How to use it
From `app/`, with `npm run dev` running:
```
node_modules/.bin/electron src/renderer/dog/tools/shot.mjs --click sit --wait 900 --zoom 2 --out /path/sit.png
```
Flags: `--url`, `--click "a,b"`, `--wait ms`, `--zoom n`, `--size WxH`, `--out file.png` (required).

## What Worked
- A hidden (`show: false`) Electron window still renders WebGL and `capturePage()` returns the frame.
- Clicking works through `executeJavaScript` by matching the button label in `#panel`; the `sit` shot shows the pose change.
- First look at the placeholder at 2× zoom: a sphere chest that clips through the body, a cone snout, two stick legs visible in the pure side view, no eyes or jaw. This is the "before" for the SDF work.

## What Didn't Work
- `timeout 60 …` — macOS has no `timeout` command; run the harness directly.
- `console-message` handler with positional args — deprecated in Electron 39; use the event object (`event.level`, `event.message`).
- ESLint's `explicit-function-return-type` rejects functions in plain `.mjs` — fixed with a file-level `eslint-disable` comment instead of touching the shared `eslint.config.mjs`.

## Test Coverage
- **Covered:** nothing new (the harness is a dev tool); existing 18 tests pass.
- **Not covered yet:** SDF maths (T2 adds tests first).

## Next Step
T2 → T3 per the phase plan.
