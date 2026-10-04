# 2026-10-04 — daniel — P3 serial, phase A: what the controller means

**Status:** Built test-first on `a/p3-serial-reader` (off `dev`): the controller mapper (35 tests), the dog's reactions to `aim` / `call` / `pushToTalk` and a fix so the joystick and button count as user activity (14 tests), the buzzer cues (9 tests). 813/813 tests in the whole suite, lint exit 0, typecheck clean for both configs apart from the Windows-only native modules. **No hardware used or needed.** Not wired into the app yet (Phase C), so nothing changes for users.
**Decided:** Daniel and I take the serial reader over from Ansh (his `a/p3-serial` has only a kickoff journal): phases A (this), A2 (the pet hand), B (the reader), C (the wiring), in `docs/plans/a-p3-serial.md`. The numbers (25% aim, 35% throw, 15% release, 0.4 s tap, 8 s timeout) are my guesses, easy to tune on the real device.
**Spec:** No contract change (`input.ts`, `serial.ts` and the IPC channels already had everything).
**Next:** Phase A2 (the pet hand), then B (the reader), then C (the wiring) and the end-to-end check on Windows with Abel's breadboard.
**Blocked on:** Nothing. Tell Ansh he does not need to write the reader.
**Touches:** `app/src/main/hardware/controller-mapper.ts`, `app/src/renderer/behaviour/{behaviour,activity,buzzer-cues,cues}.ts`, `app/src/renderer/preview.ts`, `docs/plans/a-p3-serial.md` (+tests)

---

## What changed
- **`ControllerMapper`** (main process, pure): feed it parsed Arduino messages with the time, it emits `InputEvent`s: stick = slingshot (the ball flies opposite to the pull), `aim` from 25%, a throw on letting go after a 35% peak (with the PEAK direction and power), a button press while really aiming throws at once, a tap < 0.4 s = `call`, a hold = `pushToTalk` start (via `tick`) and stop, touch = `pet` (once per touch), an 8 s stuck-stick timeout needing a real release, `reset()` on unplug (ends a push-to-talk, forgets the centre), orientation flags.
- **Behaviour:** `aim` / `pushToTalk` are overlays (ears up and alert, eyes on the ball, relaxed after 0.5 s / on stop), `call` is a command-rank reaction (runs to the cursor, wags, 4.5 s) that a fetch outranks; all inputs call the new `ActivityClassifier.noteInput()` so the controller wakes a sleeping dog and holding the button keeps the user "active". New events `{call}` and `{talk}`; the sound cue table got `call` -> a soft `yip_excited`.
- **`BuzzerCues`**: squeak on pick-up, chirp per bounce of strength 0.2 or more, at most 4 a second.
- Demo (preview, `?behaviour=1`): buttons `joystick aim 2 s`, `call (button tap)`, `push-to-talk 3 s`, a double-click = call, and the status line shows the last buzzer request.

## What Worked
- Mapper tests with hand-worked angles and powers (pull down 60% = aim straight up at 0.6; down-left = 45 degrees), the boundaries (24% vs 26%, 399 vs 401 ms, exactly 35%), hello repeating forever, unplug cases, and a 20,000-step fuzz.
- Mutation checks, 23 in all. Of the first 11 on the mapper, 8 were caught at once; the 3 that survived each got a new test (a button-launch not locking the stick, the centre not re-measured after a replug, a hold-timer pattern my sed missed). The behaviour/buzzer set: 11 of 12 caught; the survivor is redundant by design (the "awake" flag already keeps aiming at full speed).
- Bugs the tests found: (1) a button pressed with the stick drifting back near the middle (the 15-25% hysteresis band) threw a power-0.246 non-throw: the button now throws only if the pull is really 25%+, else it is a plain tap; (2) a held push-to-talk let the dog decide the user had gone idle after 8 s (demo timing) and sit down: holding the button now counts as activity.
- Demo: aim makes the dog turn to the ball (ears up).

## What Didn't Work
- Calibrating the stick's centre from the first N messages would not work: Abel's sketch only sends a joystick line when the value changes, so a still stick may send one line. Used the first reading (with a rest-window check) instead.
- Nothing was heard or measured on real hardware: the joystick orientation is a guess behind three flags.

## Test Coverage
- **Covered:** every mapping rule, the dog's reactions, the buzzer rules.
- **Not covered:** the real device (orientation, how 25% / 35% FEEL, the buzzer sounds), the serial transport (Phase B), the wiring (Phase C).
