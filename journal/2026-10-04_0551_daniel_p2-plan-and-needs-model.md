# 2026-10-04 — daniel — Lane A P2 plan written; Task 1 (needs model) done

**Status:** Branch `a/p2-mvp-behaviour` off `a/p1-overlay` (Ansh is on Tasks 8-9 there). The P2 plan is written and committed; Task 1 (`behaviour/needs.ts`) is built test-first: 26 tests, 542/542 in the whole suite, lint clean, typecheck clean apart from the Windows-only native modules missing on this Mac.
**Decided:** (1) PR target is `a/p1-overlay`, so P1 and P2 reach `dev` together. (2) Everything is pure and under `behaviour/`; the only `main.ts` edit comes last, after Ansh's Tasks 8-9, and he is told first. (3) Every long threshold lives in `BEHAVIOUR_TIMING`; `?demo=1` swaps in `DEMO_TIMING` (seconds instead of minutes) so judges can see sleep, wake and the break nudge. (4) Dog-only extras (`setMood`, `playIdle`) go through one optional `DogExtras` interface, so the code works with the placeholder dog too. (5) `?behaviour=0` is the kill switch.
**Spec:** No change to contracts or the PRD; new plan `docs/plans/a-p2-mvp-behaviour.md` (Ansh asked for it).
**Next:** Task 2 (activity classifier + timers), then Task 3 (fetch). Fetch consumes Ansh's `launch` event from his Task 8; until then it is built against the `InputEvent` contract with a fake emitter.
**Blocked on:** Nothing.
**Touches:** `docs/plans/a-p2-mvp-behaviour.md`, `app/src/renderer/behaviour/needs.ts` (+test)

---

## What Worked
- Needs rates are constants in one `NEEDS` table; the tests use hand-worked numbers (fetching 10 s from energy 1 -> 0.6; attention after 20 s of an active user = 1 - e^-1 = 0.632; one 1e9 ms step counts as 5 s). The attention test is exact because a 1 s step repeated 20 times multiplies out to e^-1.
- Mutation checks: flipping the fetching drain broke 3 tests, removing the 0..1 clamp broke 5, removing the dt clamp broke 1; restored identical.
- A 20,000-step random walk of steps and events stays finite and inside 0..1.

## What Didn't Work
- Nothing abandoned.

## Test Coverage
- **Covered:** every rate, every event, clamps, thresholds at their boundaries, dt 0 / NaN / infinity / huge.
- **Not covered:** nothing is wired into the host yet (Task 7); the rates are my numbers, tuned by feel later, not measured.
