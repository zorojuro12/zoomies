# 2026-10-04 — daniel — P2 Task 6: sound cues (the dog's voice)

**Status:** Built test-first on `a/p2-sounds` (off `dev`, which now has Abel's real audio player (#25), all 12 sounds, and the host wiring (#26)). 753/753 tests, lint clean (exit 0), typecheck clean apart from the Windows-only native modules. Verified in a real browser engine with a console log of every sound; **not heard through Windows speakers**.
**Decided (Daniel: "that looks good, build"):** the cue table below, `sneeze` and `paw_step` unused for now, 70% master volume. Mine: with Abel's player, no fallback table is needed (a sound with no files is already a silent no-op).
**Spec:** No contract change.
**Next:** Ansh/Daniel listen on the demo laptop (speakers, panning, volume vs the room); then P3 or the Lane B leftovers (the dog's `scratch` pose, a more accurate click box).
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/behaviour/{cues.ts,behaviour.ts}` (+tests), `app/src/renderer/{main.ts,preview.ts}`, `app/src/main/overlay-window.ts`, `app/src/renderer/dog/tools/{shot.mjs,zoomies-stub-preload.cjs}`, `docs/plans/a-p2-mvp-behaviour.md`

---

## What changed
- **`Behaviour.onEvent`**: emits `{fetch, note}`, `{activity, note}`, `{reaction, id, start|end}` (also when something more important takes the dog), `{pet}` and `{bounce, x, strength}`. The bounce is detected once a frame: the ball reversing direction faster than 150 px/s (slower is just the top of a throw), strength = impact speed / 2000, at most one per 80 ms. `cursorX()` added.
- **`SoundCues`** (`cues.ts`): throw bark_happy; bringing bark_alert (80%); pick-up ball_squeak; bounce ball_bounce (25-100% by strength, panned to the BALL); fetch done pant loop stopped after 4 s (a second fetch restarts the 4 s); gave up whine; sits idle sigh; falls asleep sigh then snore loop 1.5 s later; coming back or the sleep ending stops the snore (and cancels a snore not yet started); welcome back yawn at 1.3 s and yip_excited at 2.8 s; backspace tilt whine (60%); shake / pet yip_excited. Pan = dog x over screen width, x0.8; volume x0.5 across the whole screen from the cursor; per-sound cooldowns (bark 1.5 s, whine 3 s, sigh/yawn 4 s, bounce 100 ms...); `setMuted`; a 16-slot fixed queue (no allocation).
- **Wiring:** the real host (`main.ts`: `createAudioPlayer()`, `preload()`, `cues.update` in the frame loop, `ZOOMIES_MUTE=1` via `overlay-window.ts`) and the preview demo (`mute on/off` button, `?audiolog=1`).
- Tool: `shot.mjs --console 1` prints every page console message.

## What Worked
- 31 cue tests + 9 event tests (fake player; every cue, pan at the edges, loops panned too, distance, cooldowns, scheduling order after a stall, mute/unmute, a 5,000-step fuzz that leaves nothing queued).
- Mutation checks, 15 in total: every one is now caught. Four first survived, and I added tests: loops panned like everything else, a mute then unmute not letting an old scheduled snore out late, a stall firing scheduled sounds in order of TIME (not queue order), and a reaction that is interrupted still reporting its end. Two others were partly defensive duplicates.
- Real engine log of a throw: bark_happy, 5 x ball_bounce (volume falling, pan sliding as the ball rolls), ball_squeak, pant loop (then `stop pant` after 4 s); fall asleep + come back: sigh, snore loop, stop snore, yawn, yip_excited.

## What Didn't Work
- My own PR #26 shipped a lint ERROR: the fake-OS preload `zoomies-stub-preload.cjs` uses `require` (a CommonJS preload must). I had looked at only the last line of the lint output. Fixed here with an eslint-disable line; lint now exits 0. Lesson: check the exit code, not the tail.
- `stop snore` is sent twice when waking from sleep (the reaction ending and `returned`); harmless (stopping a stopped sound is a no-op).

## Test Coverage
- **Covered:** the whole cue table and its rules; the events.
- **Not covered:** how it sounds (the mix, panning through real speakers, the 70% volume against a room); autoplay in the Windows overlay (Electron allows it by default, not run); a Chrome tab needs one click before audio starts.
