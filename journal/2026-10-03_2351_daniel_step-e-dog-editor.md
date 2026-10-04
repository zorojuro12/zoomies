# 2026-10-03 — daniel — Step E done (minimal): the dog editor

**Status:** PR #5 (motion) was merged into `dev` (`b3bfea2`). New branch `b/editor` off the updated `dev` holds the editor: open `/preview.html?spec=aussie&edit=1` and a side panel gives 13 sliders (overall size + 12 proportions), ear/tail type dropdowns, a colour picker for each of the 13 colours, a name field and **Save**, which downloads the dog's `.spec.json` (to put in `assets/dog/` and commit). Dragging a slider rebuilds the dog live in the same place and pose. 253/253 tests, lint, Prettier, typecheck green. Committed locally on `b/editor`, not pushed.
**Decided:** Scope kept to the plan's Must (PRD #5): **Dog tab only**. Dropped as creep: Poses tab, View tab, photo overlay, autosave, copy button, per-slider reset. Add back only if hours remain.
**Spec:** No change to contracts or PRD.
**Next:** PR `b/editor` into `dev`; then step F (Gemini fills the dog spec from any photo), then a GPU/Windows check with Ansh.
**Blocked on:** Daniel's go to push/open the PR.
**Touches:** `app/src/renderer/ui/editor/{editor-model.ts,editor-model.test.ts,spec-editor.ts}`, `app/src/renderer/dog/sdf/SdfDog.ts` (new `rebuild()`), `app/src/renderer/preview.ts` (`&edit=1`), `app/src/renderer/dog/tools/shot.mjs` (new `--eval`)

---

## How it works
`editor-model.ts` is pure and tested: `withNumber / withColor / withEarType / withTailType / withName` each return a NEW spec, clamped to the safe ranges (invalid input is ignored); `serializeSpec` writes a fixed key order so git diffs stay small; `specFileName` makes a safe file name. `spec-editor.ts` is only the DOM (checked by eye). Slider events are coalesced to one rebuild per frame; `SdfDog.rebuild(dogFile)` swaps the dog in place (keeps position and pose).

## What Worked
- Test-first (red: module missing), 16 tests; mutation checks: no clamping, accepting any colour string, and dropping the file's final newline each broke exactly 1 test; file restored identical.
- Driving the real sliders via the new harness `--eval` flag: Leg length 0.55, Body length 1.35, Ear size 1.5, ear type floppy, coat gold turned the Aussie into a long, low, golden, floppy-eared dog, with the readouts updating.

## What Didn't Work / Notes
- Frame time showed 32.9 ms in a 1300×900 window at zoom 1.6 (about 2080×1440 device pixels): the shader's cost grows with the dog's on-screen size; the preview is not vsync-capped there. Worth measuring on Ansh's Windows laptop (bounding-sphere early-out is still planned).
- The harness can only click buttons; use `--eval "<js>"` to drive sliders/selects (dispatch `input` / `change` events).

## Test Coverage
- **Covered:** all editor logic (slider list matches the spec ranges, edits clamp / ignore bad input / never mutate, serialisation round-trip and key order, file names).
- **Not covered:** the panel's DOM and the download itself (checked by eye; Save not clicked in the headless run).

## Next Step
PR into `dev`, then step F.
