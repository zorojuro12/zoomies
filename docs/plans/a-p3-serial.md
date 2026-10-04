# Lane A P3 — The controller (serial), the pet hand, and what follows

> **Written by Daniel (Lane B) with Claude**, taking over the serial reader from Ansh (his `a/p3-serial` branch only had a kickoff journal, no code). Tell Ansh before he writes it too. Branch family: `a/p3-serial-reader` (phases below), each phase its own small PR into `dev`.

**Goal:** Abel's handheld controller (joystick, button, touch sensor, buzzer; contract §3.7, sketch tested on the real board) drives the dog: pull the stick back to aim and let go to throw, tap the button to call, hold it to talk, touch to pet; the buzzer squeaks and chirps back. Everything has a mouse equivalent, so a loose wire cannot break the demo.

**Hardware needed to BUILD this: none.** The parser and the formatter already exist and are tested (`shared/serial.ts`); the reader is written against a fake serial port. The real device is needed only at the end, on the Windows laptop: the end-to-end check, the joystick orientation (`invertX` / `invertY` / `swapXY`) and `npm install serialport`.

## Phases
| Phase | What | Status |
|---|---|---|
| **A** | **What the controller means:** `main/hardware/controller-mapper.ts` (raw messages -> `InputEvent`s), the dog's reactions to `aim` / `call` / `pushToTalk` (and the joystick / button counting as user activity), `behaviour/buzzer-cues.ts` (when the buzzer goes) | built (merged, #28) |
| **A2** | **The pet hand:** a white cartoon glove slides down and strokes the dog's head for about 2.4 s when a `pet` happens (touch or mouse), `dog/hand/` | built (merged, #30) |
| **B** | **The reader:** `serialport`, auto-detect by `HELLO:zoomies:1` (repeats every 2 s forever: a repeat is a no-op), reconnect on unplug, fake port in tests. Files: `line-splitter.ts`, `serial-reader.ts`, `serial-driver.ts`; 6 s silence = dead, probe every port (Arduino-looking first), claim only the one that says HELLO | **verified on Windows** (merged, #28/#32/#33) |
| **C** | **Wiring:** main process + preload + `main.ts` (forward `input:event`, `serial:status`, `serial:buzzer`; HUD status; double-click = call) | **verified on Windows** (merged, #33); **fix merged (#40):** the joystick's `launch` never gave the ball real velocity — only the mouse slingshot did; `fetch.launch()` fired with the ball still at rest, so it looked like an instant pickup with no flight |
| **D1** | **Commands, the action layer (no AI, no network):** `behaviour/commands.ts` (seven commands + a forgiving fixed word list, also the fallback when the AI is offline), `Behaviour` runs them (sit, lie down, come, fetch, speak, good boy, trick; head tilt when not understood), sounds for speak / good boy, `host/command-bar.ts` (buttons; a text box in the windowed host; `?commands=1` / `ZOOMIES_COMMANDS=1` / the C key) | built (PR) |
| **D2** | **Gemini function calling (PRD G3):** text in, one tool call out (the seven commands as tools), runs in the main process with the key from `.env`; falls back to the word list if offline; model `gemini-3.8-flash` (the 2.5 models are retired for new keys), overridable with `GEMINI_MODEL` | built (PR) |
| **D3** | **Push-to-talk audio (PRD L2):** record only while the button is held, ElevenLabs speech-to-text, text into D2; hold-to-talk button + space as the mouse/keyboard twins | built (PR) |
| **E1** | **Photo -> dog inside the app (new-dog flow, no Python):** `main/services/{photo-colors,dog-from-photo}.ts`, the TypeScript twin of `pipeline/`: 3 parallel Gemini calls, median, colours snapped to the photo, never fails | built (PR) |
| **E2** | **Right-click the dog -> "Upload new dog…":** file picker, a visible "Making your dog…" card with steps and a bar, `[new-dog]` terminal logs, live swap (same spot and pose), remembered between launches, "Back to the original dog" | built (PR) |

## Phase A decisions (Daniel confirmed the approach; numbers are tunable on the real device)
- Joystick = a slingshot: the ball flies the OPPOSITE way to the pull. `aim` from a pull of 25% or more (about 30 per second); letting go (back under 15%) after a pull of at least 35% throws with the strongest pull; pressing the button while really aiming (25%+) throws at once and is not also a call; a stick held pulled for 8 s is given up on (no throw).
- Centre = the stick's first reading (or 512 if that does not look like rest). Orientation flags for the real hardware.
- Button: a tap under 0.4 s = `call`; a hold = `pushToTalk` (start at 0.4 s, stop on release). Touch = `pet` (`source: 'touch'`), one per touch (1 s apart at least).
- The dog: `aim` = ears up, alert (more when pulled harder), eyes on the ball, relaxed 0.5 s after the last aim; `call` = runs to the cursor, wags, happy, holds the dog 4.5 s (a fetch outranks it); `pushToTalk` = ears up, alert (gives up after 10 s with no stop). The joystick and button count as user activity (they never come through the OS hooks): they wake a sleeping dog.
- Buzzer: a squeak when it picks up the ball, a chirp per real bounce (at most 4 a second). The serial writer turns these into `S:squeak` / `S:chirp`.
- Mouse equivalents: aim/launch = the slingshot, pet = a click, call = a double-click (Phase C), push-to-talk = a button (voice commands are Phase 3 of the P3 list).

## Windows hardware verification (Ansh, 2026-10-04)

With the real Arduino board on COM4: HUD shows `controller COM4`; joystick pull-back + release
launches the ball opposite the pull (after fixing the instant-pickup bug above, and with
`ZOOMIES_INVERT_Y=1` — **this physical board's joystick is mounted upside-down**, see `CLAUDE.md`);
button tap = call, hold = push-to-talk; touch sensor = pet (lies down, hand strokes it); buzzer
squeaks on pickup and chirps on bounces; unplugging flips the HUD to disconnected within 6 s
without crashing the app, replugging reconnects on its own. All pass.

**Don't forget for the live demo:** launch with `ZOOMIES_INVERT_Y=1 npm run dev`, not plain
`npm run dev` — the joystick throws in the wrong direction without it.

## Later P3 phases (own plans when started)
Mid-air catch; commands (a fixed list, typed or spoken text, clickable buttons as the fallback); window terrain (lite); leftovers (the `scratch` pose, a more accurate click box). See `lane-a-ansh.md` P3 and the cut order in `00-shared.md` §6.
