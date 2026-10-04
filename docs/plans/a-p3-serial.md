# Lane A P3 — The controller (serial), the pet hand, and what follows

> **Written by Daniel (Lane B) with Claude**, taking over the serial reader from Ansh (his `a/p3-serial` branch only had a kickoff journal, no code). Tell Ansh before he writes it too. Branch family: `a/p3-serial-reader` (phases below), each phase its own small PR into `dev`.

**Goal:** Abel's handheld controller (joystick, button, touch sensor, buzzer; contract §3.7, sketch tested on the real board) drives the dog: pull the stick back to aim and let go to throw, tap the button to call, hold it to talk, touch to pet; the buzzer squeaks and chirps back. Everything has a mouse equivalent, so a loose wire cannot break the demo.

**Hardware needed to BUILD this: none.** The parser and the formatter already exist and are tested (`shared/serial.ts`); the reader is written against a fake serial port. The real device is needed only at the end, on the Windows laptop: the end-to-end check, the joystick orientation (`invertX` / `invertY` / `swapXY`) and `npm install serialport`.

## Phases
| Phase | What | Status |
|---|---|---|
| **A** | **What the controller means:** `main/hardware/controller-mapper.ts` (raw messages -> `InputEvent`s), the dog's reactions to `aim` / `call` / `pushToTalk` (and the joystick / button counting as user activity), `behaviour/buzzer-cues.ts` (when the buzzer goes) | built (PR) |
| **A2** | **The pet hand:** a white cartoon glove slides down and strokes the dog's head for about 2.4 s when a `pet` happens (touch or mouse), `dog/hand/` | next |
| **B** | **The reader:** `serialport`, auto-detect by `HELLO:zoomies:1` (repeats every 2 s forever: a repeat is a no-op), reconnect on unplug, fake port in tests | |
| **C** | **Wiring:** main process + preload + `main.ts` (forward `input:event`, `serial:status`, `serial:buzzer`; HUD status; double-click = call) | |

## Phase A decisions (Daniel confirmed the approach; numbers are tunable on the real device)
- Joystick = a slingshot: the ball flies the OPPOSITE way to the pull. `aim` from a pull of 25% or more (about 30 per second); letting go (back under 15%) after a pull of at least 35% throws with the strongest pull; pressing the button while really aiming (25%+) throws at once and is not also a call; a stick held pulled for 8 s is given up on (no throw).
- Centre = the stick's first reading (or 512 if that does not look like rest). Orientation flags for the real hardware.
- Button: a tap under 0.4 s = `call`; a hold = `pushToTalk` (start at 0.4 s, stop on release). Touch = `pet` (`source: 'touch'`), one per touch (1 s apart at least).
- The dog: `aim` = ears up, alert (more when pulled harder), eyes on the ball, relaxed 0.5 s after the last aim; `call` = runs to the cursor, wags, happy, holds the dog 4.5 s (a fetch outranks it); `pushToTalk` = ears up, alert (gives up after 10 s with no stop). The joystick and button count as user activity (they never come through the OS hooks): they wake a sleeping dog.
- Buzzer: a squeak when it picks up the ball, a chirp per real bounce (at most 4 a second). The serial writer turns these into `S:squeak` / `S:chirp`.
- Mouse equivalents: aim/launch = the slingshot, pet = a click, call = a double-click (Phase C), push-to-talk = a button (voice commands are Phase 3 of the P3 list).

## Later P3 phases (own plans when started)
Mid-air catch; commands (a fixed list, typed or spoken text, clickable buttons as the fallback); window terrain (lite); leftovers (the `scratch` pose, a more accurate click box). See `lane-a-ansh.md` P3 and the cut order in `00-shared.md` §6.
