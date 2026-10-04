# 2026-10-04 — daniel — P3 serial, phase A2: the pet hand

**Status:** Built test-first on `a/p3-pet-hand` (stacked on `a/p3-serial-reader`, PR #28). 841/841 tests in the whole suite, lint exit 0, typecheck clean (both configs, apart from the Windows-only native modules). Seen in the preview. Not run on Windows or with the real touch sensor.
**Decided (my defaults; Daniel did not answer the three questions):** a white cartoon glove with a dark outline; shown for BOTH the touch sensor and a mouse click on the dog; it slides in from above-right. Easy to change: the source is on the event, so touch-only is one `if`.
**Spec:** No change.
**Next:** Phase B (the serial reader), then C (the wiring).
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/dog/hand/{hand-motion,hand-view,head-anchor}.ts` (+tests), `app/src/renderer/dog/{motion/dog-motion.ts,sdf/SdfDog.ts}`, `app/src/renderer/behaviour/behaviour.ts`, `app/src/renderer/{main.ts,preview.ts}`, `docs/plans/a-p3-serial.md`

---

## What changed
- **`hand-motion.ts`** (pure): a function of time in units of the dog's height, relative to the head: slides in from up-right (450 ms), strokes back and forth 3 times (sweep +-0.1 of the dog's height, a small press in the middle of each stroke, a 7-degree tilt), slides out (450 ms); 2.4 s in all, the same as the dog's happy "being petted" reaction.
- **`hand-view.ts`**: the glove as three.js shapes (a palm, 4 fingers, a thumb, a cuff and a long sleeve, each with a darker outline from a slightly bigger back-face copy), drawn on top of everything (`depthTest` off, render order 7/8), faded with the pose, scaled with the dog.
- **`head-anchor.ts`**: where to put it: `SdfDog.headPosition` / `dogHeightPx` (new, from the head bone) or an estimate from the screen box for the placeholder dog.
- The `pet` event now carries its `source` (`touch` | `mouse`). Wired into the real host (`main.ts`) and the demo (`preview.ts`; a `pet (touch sensor)` button, and a click on the dog pets it there too).

## What Worked
- 14 motion tests (starts and ends hidden, fades, comes and goes high and to the side, exactly three strokes (5 to 7 turning points), never wider than a head, presses a little, tilts a few degrees, no jump bigger than 0.004 of the dog's height per millisecond, writes into the given object), 10 view tests with no GPU (hidden until played, position = head + pose x height, scales with the dog, on top, fades, restarts without stacking shapes, survives garbage, dispose), 3 head-anchor tests.
- Seen in the preview: the glove comes down onto the dog's head and strokes it while the dog tilts its head and wags.

## What Didn't Work (found by looking, not by tests)
- First draft: the sleeve was a thin pole with a visible flat cap, and the hand was small next to the head. Made the hand 1.5x bigger, added a cuff, and made the sleeve 6 dog-heights long so its end is never on screen.
- Then a dark slab appeared behind the hand: the sleeve's outline was a uniformly scaled copy, so a long shape stuck out past the cuff. Long parts now get an outline that is wider but not longer.
- The hand first covered the eyes: raised its resting height from -0.26 to -0.34 of the dog's height.
- Tests cannot tell whether it LOOKS right: only the screenshots can; the look is plain flat white with an outline (no shading).

## Test Coverage
- **Covered:** the motion, the scene-graph behaviour, the anchor logic.
- **Not covered:** how it looks on other dogs and sizes (only the Aussie in the preview), on Windows, and with the real touch sensor (phase B/C).
