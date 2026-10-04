# 2026-10-04 — daniel — P2 Task 3: fetch (landing prediction + state machine + preview demo)

**Status:** Built test-first: `behaviour/landing.ts`, `behaviour/fetch.ts`, `behaviour/fake-dog.ts` (a reusable stand-in dog for tests) and a fetch demo on the preview page. 10 landing tests + 23 fetch tests; 618/618 in the whole suite, lint clean, typecheck clean apart from the Windows-only native modules. Branch `a/p2-mvp-behaviour` (draft PR #22).
**Decided (Daniel):** (1) A ball the dog cannot reach (resting on a window; terrain is P3) is given up on gracefully: it runs under it, looks up, head-tilts, ball stays. (2) The dog brings the ball back to where the dog was standing when thrown (`dropSpot: 'dogOrigin'` default; `'ballOrigin'` = where the ball was thrown from; one option). (3) Build the preview demo. Mine: a long way home (> 500 px) is a run, not a 7-second trot.
**Spec:** No contract change; plan Task 3 section updated with these decisions.
**Next:** Task 4 (reactions + arbiter). Explain it to Daniel first. At Task 7 the host needs ONE line in Ansh's `pointerup` (`fetch.launch()` after `launchVelocity`) and to hide the world's ball while `fetch.carrying`; Ansh is told before I touch `main.ts`.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/behaviour/{landing.ts,fetch.ts,fake-dog.ts}` (+tests), `app/src/renderer/preview.ts`, `docs/plans/a-p2-mvp-behaviour.md`

---

## How it works
`predictLanding(ball, world, maxMs, out)` replays Ansh's real `stepBall` on a scratch copy, so its answer matches the live ball (tested: same rest spot within 2 px for four throws incl. one with a window in the way) and the live ball is never touched. `Fetch` (states idle, chasing, grabbing, returning, celebrating, gaveUp): `launch()` -> look at the ball, re-guess the landing every 250 ms and run there; ball at rest within 30 px -> `attachBall(true)`, ball held (`fetch.carrying`); carry back; drop 45 px in front of the dog, play-bow 1.2 s, done. Notes for sounds/moods: launched, pickedUp, returning, dropped, done, gaveUp, cancelled. It listens to the dog's `arrived` event, not the moveTo promise (a superseded order resolves its promise too).

## What Worked
- Tests: happy path order, re-guess around a window, re-throw mid-chase (one pick-up, first return spot kept), ball at the dog's feet, user grabbing the ball back, 20 s give-up, unreachable ball on a window, cancel (chasing and carrying), second fetch, and a 30-game random fuzz (throws, cancels, grabs, teleports, moving windows) where the dog always ends free and `dog.attached === fetch.carrying` on every frame.
- Mutation checks: 7 mutations; 6 were caught at once. The 7th ("never re-guess the landing") SURVIVED because the dog is sent to the resting ball anyway; I added a test that the first order is given while the ball is still in the air and points at the real rest spot (within 40 px), and the mutation then failed it. That test also needed a fix: the order is given in the same frame the ball rests, so it must look at the moment before.
- A printed play-by-play showed the trip home took 7 s at a trot over 1500 px: now a run over 500 px.
- Visual (preview, Mac): ball in the air with the dog running, then the dog carrying the green ball, then the ball dropped by the standing dog.

## What Didn't Work
- Nothing abandoned. Note for Windows: `DogMotion.getState()` allocates a small object; Fetch calls it once per frame only while a fetch is active.

## Test Coverage
- **Covered:** prediction accuracy against the live physics, every state transition and exit, the random fuzz.
- **Not covered:** the real dog's timing (a fake dog at the real gait speeds stands in); the host wiring (Task 7); sounds (Task 6); mid-air catch and window terrain (P3).
