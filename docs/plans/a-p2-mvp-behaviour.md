# Lane A P2 — MVP Behaviour: the dog acts like a pet

> **Written by Daniel (Lane B) at Ansh's request** (journal `2026-10-04_0541_ansh_task7-closeout-daniel-p2-handoff.md`): Ansh finishes P1 Tasks 8-9 on `a/p1-overlay` while Daniel builds this on `a/p2-mvp-behaviour`, a branch off it. Lane A's owner has delegated this on purpose; Ansh reviews every PR.

**Goal:** turn "a dog that can move" into "a pet that acts": it fetches a thrown ball end to end, has needs that drive what it does, reacts to your typing, idling and return, sleeps with an adaptive frame rate, and makes the right sounds. This is the Lane A P2 list in `docs/plans/lane-a-ansh.md`, and PRD §4.1-4.5 + Musts 7-9.

**Architecture:** all decisions live in pure, testable modules under `app/src/renderer/behaviour/` that take plain inputs (needs, activity numbers, a clock, a `DogController`) and return decisions. A thin `Behaviour` class composes them and is called once per frame by the host. The host (`renderer/main.ts`, Ansh's file) gets ONE small wiring change at the end. Nothing in `behaviour/` imports Three.js, Electron or the DOM.

**Tech stack:** TypeScript + Vitest only. No new dependencies.

**Branch:** `a/p2-mvp-behaviour` (off `a/p1-overlay`). **PR target:** `a/p1-overlay`, so P1 and P2 reach `dev` together. Merge `origin/a/p1-overlay` into this branch regularly.

## Global constraints

- **Lane files:** new code goes in `app/src/renderer/behaviour/` and `app/src/renderer/audio/`-facing glue only. The one edit to `renderer/main.ts` comes last, after Ansh has finished Tasks 8-9, and is told to him first. No contract change (`app/src/shared/` is untouched); if something seems to need one, stop and ask.
- **Hot paths don't allocate:** `Behaviour.update` runs every frame. Reuse preallocated objects, mutate in place (CLAUDE.md).
- **Injectable time:** nothing reads `performance.now()` or `Date` inside the logic. Time comes in as `dtMs` or a `nowMs` argument, so every threshold (1 min idle, 5 min sleep, 50 min break) is testable in microseconds.
- **Demo speed:** one config object `BEHAVIOUR_TIMING` holds every long threshold; `?demo=1` swaps in `DEMO_TIMING` (seconds instead of minutes) so the judges can see sleep, wake and the break nudge in a 3-minute demo.
- **Privacy:** typing is timing only (rate, backspace ratio), exactly what `ActivityEvent` already carries. Nothing here sees key contents.
- **Mouse equivalent for everything:** every behaviour trigger has a mouse path (`InputEvent` `pet`/`launch`/`call`); the demo must survive a loose wire.
- **The dog is whichever `DogController` we are given:** SDF dog, placeholder, or a test fake. Dog-only extras (`setMood`, `playIdle`, `getGroundY`) are reached through one optional interface `DogExtras`, a no-op when absent.
- **Kill switch:** `?behaviour=0` runs the host exactly as in P1 (no behaviour object at all).
- Commits: `type: description`, `git add` exact paths, each behind its tests. Tests first (red, then green), mutation-check the important ones.

## Review focus

1. **The fetch loop must always finish.** Ball lost off-screen, ball resting inside the dog, ball re-thrown mid-run, dog interrupted by a click: every path ends with the dog idle, never stuck holding a ball or running at nothing. → Task 3 state-machine tests incl. a random-event fuzz.
2. **Time-based states must survive a long frame** (laptop wake, DevTools pause): thresholds use accumulated real time but a single huge `dt` must not skip straight through three states. → Task 2 tests.
3. **Sleeping must really cut the frame rate** and wake instantly on any input. → Task 5.
4. **No fighting over the dog:** one owner of the dog at a time (an arbiter); the cursor look-at must not fight the ball look-at. → Task 4 arbiter tests.

## File structure

| File | Responsibility |
|---|---|
| `behaviour/needs.ts` (+test) | energy / boredom / attention, how they change, what the dog wants |
| `behaviour/activity.ts` (+test) | classify typing / idle / return from `ActivityEvent`s and the clock; break timer |
| `behaviour/timing.ts` | `BEHAVIOUR_TIMING` and `DEMO_TIMING` (all thresholds in one place) |
| `behaviour/landing.ts` (+test) | predict where a thrown ball will land / come to rest (re-runs `stepBall` on a copy) |
| `behaviour/fetch.ts` (+test) | the fetch state machine, driven by a fake `DogController` in tests |
| `behaviour/reactions.ts` (+test) | the PRD §4.3/4.4 table: trigger → dog response |
| `behaviour/arbiter.ts` (+test) | who owns the dog right now (fetch > user command > reaction > idle) |
| `behaviour/sounds.ts` (+test) | behaviour event → `SoundName` + pan from the dog's x |
| `behaviour/fps.ts` (+test) | awake → 60, asleep → ~5 |
| `behaviour/behaviour.ts` | `Behaviour`: composes the above; `update(dtMs)`; `handleInput(InputEvent)`; `handleActivity(ActivityEvent)` |
| `behaviour/dog-extras.ts` | optional `DogExtras` interface + `asExtras(dog)` |
| `renderer/main.ts` (modify, LAST) | create `Behaviour`, feed it events, honour `?behaviour=0` and `?demo=1` |

---

### Task 1: Needs model

**Files:** create `behaviour/needs.ts`, `behaviour/needs.test.ts`.

Three numbers in 0..1 that rise and fall so behaviour is chosen from them, not from a fixed loop (PRD §4.5).

```ts
interface Needs { energy: number; boredom: number; attention: number }
type Doing = 'fetching' | 'active' | 'resting' | 'sleeping'   // what the dog is doing right now
createNeeds(): Needs                                  // energy 1, boredom 0, attention 0.5
stepNeeds(n: Needs, dtMs: number, doing: Doing, userActive: boolean): void   // mutates n
applyNeedsEvent(n: Needs, e: 'pet' | 'launch' | 'fetchDone' | 'ballBrought'): void
wants(n: Needs): { play: boolean; rest: boolean }
```

Rates per second (constants in `NEEDS`):

| | fetching | active | resting | sleeping |
|---|---|---|---|---|
| energy | -0.01 | +0.002 | +0.01 | +0.03 |
| boredom | -0.02 | +0.002 if the user is idle, +0.0006 if active | same | -0.01 |

attention moves toward 1 when the user is active, toward 0 when not, as an exponential with a 20 s time constant. Events: `pet` boredom -0.3, attention +0.3; `launch` boredom -0.4, attention = 1; `fetchDone` energy -0.05, boredom -0.2; `ballBrought` boredom -0.3. `wants.play` = boredom > 0.6 and energy > 0.4; `wants.rest` = energy < 0.25. Everything is clamped to 0..1. `dtMs` is clamped to 5000 per step; a non-finite `dtMs` changes nothing.

**Tests (hand-worked, written first):** fetching 10 s from energy 1 → 0.9; resting 10 s from 0.5 → 0.6; sleeping 20 s from 0.5 → 1 (clamped); boredom idle 100 s from 0 → 0.2; fetching 10 s from 0.5 → 0.3; attention active 20 s from 0 → 0.632 (1 - e^-1) and 100 s → above 0.99; idle decay mirrors it; each event's effect and the clamps; `wants` thresholds at the boundaries; `dtMs` 0, 1e9 and `NaN`; a random walk of 10,000 steps and events stays inside 0..1 and finite.

**Done when:** all green, mutation-checked (wrong sign on the fetching drain, no clamp, no dt clamp each break a test).

### Task 2: Activity classifier + timers

`activity.ts` + `timing.ts`. Consumes `ActivityEvent` (typing, mouse, idle) and `dtMs`; produces a small state: `userState: 'active' | 'typing' | 'focus' | 'idle1' | 'asleep' | 'returned'`, `backspaceSpam: boolean`, `breakDue: boolean`, `lateNight: boolean`. Thresholds from `BEHAVIOUR_TIMING` (idle 60 s, sleep 300 s, steady typing 3 keys/s for 8 s, focus typing 5 s of sustained 4+ keys/s for 45 s, backspace spam ratio > 0.3, break 50 min of continuous activity, late night 23:00-05:00). `DEMO_TIMING` divides the long ones by ~30. Tests with a fake clock: each threshold at the boundary, a single 10-minute `dt` goes idle1 → asleep in ORDER (not skipping), `returned` fires once on the first input after `asleep` and then goes back to active, break timer resets on a real 3-minute pause, backspace spam needs a minimum key rate so one stray backspace does nothing.

### Task 3: Fetch (landing prediction + state machine)

`landing.ts`: `predictLanding(ball, world, maxMs): { x, y, tMs }` re-running `stepBall` on a scratch copy (never touches the live ball). `fetch.ts`: states `idle → watching → running → grabbing → returning → dropping → celebrating → idle`, driven by `launch` input, ball state and the dog's events through a `DogController`. Behaviour: look at the ball in flight (`lookAt`), `moveTo` the predicted landing x (run), `attachBall(true)` on arrival (ball hidden in the world, shown in the mouth), `moveTo` near the cursor, `attachBall(false)`, drop the ball there, a wag and a mood. Tests with a fake controller and a scripted ball: the happy path event order; ball re-thrown mid-run (retarget, no double pickup); ball rests inside the dog; ball predicted off-screen (clamp to the work area); user clicks the dog mid-fetch (cancel cleanly, ball released); a random-event fuzz that must always end in `idle` with no ball attached.

### Task 4: Reactions + arbiter

`reactions.ts` is the PRD §4.3/4.4 table as data + a chooser: steady typing → lie down near the active window; long typing → doze (focus buddy); backspace spam → head tilt; idle 1 min → sit, look around, ear scratch (the dog's idle tricks); idle 5 min → sleep on the taskbar; return → wake, stretch, yawn, trot to greet the cursor; cursor hover → look up, wag; cursor shaken fast → play-bow; break due → bring the ball, drop it by the cursor, play-bow; late night → more yawns. Mood hints through `DogExtras` (`happy` after fetch, `sleepy` at night/idle, `alert` on a sudden mouse). `arbiter.ts`: priority fetch > user command > reaction > idle; a higher priority preempts, a lower one waits. Tests: each row of the table; the arbiter's preemption and release; look-at ownership (ball beats cursor).

### Task 5: Adaptive FPS

`fps.ts` + the host loop: awake → 60, asleep → ~5 (the loop skips frames, the dog is not updated, HUD shows the target and real fps). Any input wakes it on the next event, not the next slow frame. Tests: target per state; wake latency (an event while asleep requests an immediate frame).

### Task 6: Sound cues

`sounds.ts`: behaviour event → `SoundName` (`bark_happy` on launch, `ball_squeak` on pickup, `pant` after fetch, `snore` while asleep, `yawn` on waking, `yip_excited` on greet…) with `pan` from the dog's x over the screen width and a cooldown so nothing repeats too fast. Calls the `AudioPlayer` contract (`StubAudio` until Abel's module lands). Tests: the cue table, pan at the screen edges and centre, cooldown, a missing player is a silent no-op.

### Task 7: Compose, wire, verify

`behaviour.ts` composes Tasks 1-6; `main.ts` gets one small block (create it, feed `handleActivity`/`handleInput`, call `update`, honour `?behaviour=0` and `?demo=1`). Done AFTER Ansh's Tasks 8-9 land and with his OK. **Checkpoint (manual, Windows):** the CP2 demo path: launch → cursor reaction → mouse fetch (drag, release, dog runs, catches, returns) → idle → sleep (HUD shows ~5 fps) → wake and greet. Run twice without restarting.

## Cut order if time runs short

Break nudge first (Task 2/4 part), then adaptive FPS polish, then late-night and focus-buddy, then ear-scratch. Never cut: fetch, idle → sleep → wake, typing → lie down.

## Out of scope (P3+)

Windows as terrain, mid-air catch, joystick/serial, voice (L2/G3), personality (G2), aim-preview trajectory.
