# 2026-10-04 — daniel — Right-click the dog -> "Upload new dog…": a new dog from any photo, any time

**Status:** Built and tested; not yet verified on Windows or with a real file-picker click by Daniel. Right-click the dog, pick a photo, watch a "Making your dog…" card (steps, bar, detail), and the dog is swapped in place (same spot and pose), remembered for the next launch; "Back to the original dog" undoes it. Branch `a/p3-new-dog`, off dev (cf0cf36).
**Decided:** (1) Port the Python pipeline (`pipeline/`) to TypeScript in the main process so the Windows demo machine needs no Python; same prompt and schema, 3 parallel calls, median, colours snapped to the photo (max change 10). (2) A failed run NEVER swaps in a generic dog: the current dog stays and the card says what went wrong. (3) The saved dog is `userData/custom-dog.spec.json`, loaded at start. (4) `ZOOMIES_NEWDOG_PHOTO=/path.jpg` skips the picker (testing, demo safety net).
**Spec:** Additive lines in `shared/ipc.ts`: channels `dog:new`, `dog:progress`, `dog:saved`, `dog:reset` and types `NewDogProgress`, `NewDogResult`. Tell Ansh. New files in `app/src/main/services/` and a touch to `main/index.ts`, `ipc-main.ts`, `preload` (Ansh's folders, small and guarded).
**Next:** Daniel tries it; then a Windows check (file dialog from a non-focusable overlay window, right-click over the dog in click-through mode).
**Blocked on:** Windows for the real checks.
**Touches:** `app/src/main/services/{photo-colors,dog-from-photo,new-dog-flow,new-dog-main}.ts` (+tests), `app/src/renderer/host/new-dog-card.ts` (+test), `app/src/renderer/main.ts`, `app/src/main/{index,ipc-main}.ts`, `app/src/preload/*`, `app/src/shared/ipc.ts`

---

## What Worked
- 87 new tests. Colour maths checked against numbers computed with the Python formulas (Lab, delta-E); aggregate rules mirror the Python tests (median, vote, per-channel colour median, ties to the first answer); the whole flow with fakes (cancel, unreadable file, huge file, Gemini down, no key, 1-2 calls failing, save failing, one run at a time, safe names). Mutations caught: generic dog on failure, no busy guard, no size cap, save not awaited, name length, stuck busy, even-count median, tie order, snap too wide, temperature, fallback not default.
- Live, real Gemini: the repo photo (the Aussie) in 7.3 s with proportions almost identical to what the Python pipeline gave (size 1.1 vs 1.05, ears/tail the same). A corgi photo (side view, dim light) gave legLength 0.55 (the minimum), long body, pointy ears, fluffy tail in 6.8 s. A dachshund standing on its hind legs gave floppy ears, size 0.7, long body, short legs, russet coat. Both render as clearly different dogs.
- Real Electron image handling checked (decode, shrink to 1024, JPEG, pixel buffer size right, junk file reported as unreadable).
- On screen: the menu opens at the click and stays on screen; the card shows a spinner, ticked steps, a bar and what is happening; the dog swaps in place.

## What Didn't Work
- The screenshot harness lags behind short animations, so I could not catch the 4 s "Meet <name>!" state by eye (the unit tests cover the card's states).
- Without numpy the Python test suite cannot run here; reference numbers were computed with plain Python.

## Test Coverage
- **Covered:** colour maths, merging, the Gemini call shape (key in a header, schema, temperature), the whole flow, card step states, menu clamp.
- **Not covered:** the real file dialog click, Windows, the colour step with a real photo inside the app (verified separately: the Electron decode), very large or odd formats (HEIC is not decodable by Electron: the card tells the user to try a JPG/PNG).
