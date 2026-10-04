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

## Addendum: Daniel said "the hand is horrible, no arm, just a hand, make it smoother" (redone)
- **Shape:** removed the cuff and the sleeve (the arm). It is now JUST a hand: a rounded oval palm, four tapered fingers that splay slightly (the outer two lean outward), a thumb angled out at the side, each a smooth high-segment capsule with a thin dark outline, off-white, and a soft shadow on the dog's head where the fingers fall (a radial-gradient blob; skipped when there is no canvas, as in tests). 13 meshes: (palm + 4 fingers + thumb) x (fill + outline) + the shadow.
- **Motion:** longer and calmer (2.6 s: 0.5 s slide in, 0.5 s slide out, TWO slow strokes instead of three quick ones); a soft landing (it dips a hair past its resting height and settles); the strokes ease in and out (their sweep, press and tilt grow from nothing and fade to nothing instead of starting at full speed); the fade uses an eased curve, not a straight line. The dog's pet reaction now lasts 2.7 s to match.
- **Tests:** 16 motion tests (new: the sweep starts and ends at nothing, a soft landing that exactly reaches its resting height); my "stroke window" helper had been including part of the slide in (a test flaw, fixed to use the true time window); the landing is the fastest part so its per-millisecond limit is 0.006 of the dog's height (0.004 for sideways and tilt). 13 view tests. 843/843 in the whole suite, lint exit 0.
- **Lesson:** I judged the first version by tests alone, then looked at screenshots and found the arm ugly: the flat-colour arm was never going to look good next to a fluffy dog, and "no arm" is simply better. Look at it early.

## Addendum 2: Daniel asked "the dog needs to lay on his tummy while you petting him and the hand goes to the stomach" (Option A)
Two readings: (A) the dog lies on its BELLY and the hand strokes its body; (B) the dog rolls onto its BACK for a real tummy rub (a whole new belly-up pose; 1-2 h and risky: the leg code assumes paws go down, the fur, shadow and lighting assume upright). Daniel chose A.
- **The dog:** a pet now lies the dog down (`lie` pose) instead of the head tilt, stopping first if it was running (it never lies down mid-stride), stays happy and wagging for 2.7 s, then stands up.
- **The hand:** `HandSpot = 'head' | 'body'`; the body spot sweeps wider (0.16 of the dog's height, strokes along the torso) and rests lower (-0.2); `PetHand.play(spot)`; `bodyAnchor` / `handAnchor` (`SdfDog.bodyPosition` from the body bone, or an estimate from the screen box). The host plays `'body'`.
- **Seen in the preview:** the first body anchor put the hand over the dog's cheek, because the dog lies facing us and its torso is right behind its head. Shifted the anchor 0.2 of the dog's height toward the back end (away from where it faces; mirror-image tested), and lowered the hover height so the fingers touch the fur rather than float above it.
- **Tests:** 11 new (the spots, the body anchor and its mirror, the lying-down pet, the pet stopping a run). 854/854 in the whole suite, lint exit 0.
- **Not done (Option B):** belly-up tummy rub. Possible later as its own phase if there is time; flagged risky.
