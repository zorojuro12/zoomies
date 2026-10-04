# 2026-10-04 — daniel — P2 Task 4: reactions, arbiter and the Behaviour class (+ personality demo)

**Status:** Built test-first: `behaviour/arbiter.ts`, `reactions.ts`, `behaviour.ts` (the combining class, brought forward from Task 7), `dog-extras.ts`, `Fetch.bringBall`, and a personality demo on the preview page. 663/663 tests in the whole suite, lint clean, typecheck clean apart from the Windows-only native modules. Branch `a/p2-mvp-behaviour` (draft PR #22).
**Decided (Daniel):** no ear scratch (our dog's sit pose cannot play tricks; idle is a sit); "lie down near the window" = the floor below the topmost window; late night = a sleepier mood; "bored and has energy" brings the ball; build the demo with fake-activity buttons. Mine: `Behaviour` now, not at Task 7, so the demo shows the whole personality.
**Spec:** No contract change; plan Task 4 section updated.
**Next:** Task 5 (adaptive FPS) and Task 6 (sound cues), explained to Daniel first; then Task 7 (wire it into Ansh's `main.ts` after telling him: `behaviour.update`, feed `handleActivity`/`handleInput`/`setWindows`, remove his mousemove lookAt and ball lookAt, hide the world ball while `fetch.carrying`, route his slingshot release to `handleInput({kind:'launch'})`).
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/behaviour/{arbiter,reactions,behaviour,dog-extras,fetch,activity,fake-dog}.ts` (+tests), `app/src/renderer/preview.ts`, `docs/plans/a-p2-mvp-behaviour.md`

---

## How it works
**Arbiter:** one owner of the dog at a time: fetch > command > greet > reaction > none. Higher interrupts lower (the loser is told and tidies up); among equals a higher priority interrupts only after the current one's minimum hold. **Reactions** (priority): sleep/idle 1, rest 2, typing 2, focus 3, hover 5, greet 5, backspace 6, shake 7; each with cooldown and min-hold. **Behaviour.update(dt)** each frame: cursor timers, activity, fetch, run the owner, choose a reaction, maybe bring the ball (break due, or bored with energy > 40%; 4 "real breaks" cooldown), decide where to look (ball while fetching, a recently moved cursor for 3 s, else nothing), step the needs (doing = fetching / the reaction's / active).

## What Worked
- 27 scenario tests with the fake dog + real ball physics (idle, sleep, late night, welcome back, typing with and without windows, focus, backspace spam + cooldown, break nudge, bored, tired, rest hysteresis, hover, brush-past, look timing, shake + cooldown, pet, fetch preempting a lie-down, sleep not stealing a carried ball, ball-not-cursor, command hold, real timing) and a 20-game fuzz (dog.attached === fetch.carrying every frame, needs in 0..1, quiet minute ends free).
- Mutation checks: 10 mutations. 6 were caught immediately; of the 4 survivors, 2 were equivalent (the arbiter already blocks a reaction during a fetch; the rest hysteresis also lives in `update`), and 3 were real test gaps that I closed: `breakHandled` (the real-break timer was clearing the flag in my test, so the user now stays active), a brief cursor brush-past, and a preempted reaction tidying up. All three now fail their mutation.
- Visual (preview): typing -> the dog walks under the pretend window and lies down; fall asleep -> curled up; make bored -> it fetched the ball and dropped it beside itself.

## What Didn't Work (found while testing)
- My test helpers were off: the OS idle events restarted counting each call and were sent at the start of the second (an off-by-one against the real tracker's cadence); the greet test let the user go idle again after 8 s of demo time. Fixed in the helpers, not the code.
- A tricky one for the host: `DogMotion.playIdle` only plays while the dog is standing, so a sitting dog cannot yawn; idle therefore only sits.
- The demo's pretend window label overlaps the button panel (cosmetic).

## Test Coverage
- **Covered:** every row of the PRD table that the plan kept, the arbiter's ordering and holds, fetch preemption, look ownership, random play.
- **Not covered:** the real dog's timing/looks inside these reactions (a fake stands in; the demo shows the real one); sounds (Task 6) and the frame rate while asleep (Task 5); wiring into the Windows host (Task 7); `call`, `pushToTalk`, `command` inputs are ignored on purpose (P3).
