# 2026-10-04 — daniel — P2 Task 2: activity classifier + timing table

**Status:** Built test-first: `behaviour/timing.ts` (every threshold in one table, real + demo) and `behaviour/activity.ts` (`ActivityClassifier`). 31 new tests, 577/577 in the whole suite, lint clean, typecheck clean apart from the Windows-only native modules. Branch `a/p2-mvp-behaviour` (draft PR #22).
**Decided:** (Daniel confirmed) demo timing: idle 8 s, asleep 20 s, steady typing 2 keys/s for 3 s, focus 15 s, break due 90 s of work, a real break is 10 s away (real: 60 s / 300 s / 3 keys/s for 8 s / 4 keys/s for 45 s / 50 min / 3 min). Idle comes from the OS idle seconds in Ansh's `idle` events, not our own timer, so a stalled app cannot get it wrong; only the break timer counts our own time.
**Spec:** No change. New files only; no contract touched.
**Next:** Task 3 (fetch: landing prediction + state machine). Explain it to Daniel first, as agreed.
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/behaviour/{timing.ts,activity.ts,activity.test.ts}`

---

## How it works
Inputs: Ansh's `ActivityEvent`s (typing every 0.5 s while typing, mouse every 0.1 s while moving, OS idle every 1 s) and `update(dtMs, hour)`. Output `state`: `user` (active / typing / focus / idle / asleep), `backspaceSpam`, `breakDue`, `lateNight`, `idleSec`; plus one-off notes through `onNote`: `wentIdle`, `fellAsleep`, `returned`, `breakDue`. A typing event of 0 keys/s and a still mouse are NOT activity; real input resets the idle clock at once instead of waiting for the next 1 s idle event.

## What Worked
- 31 tests with exact boundaries (59 s active / 60 s idle, 7.5 s vs 8 s typing, 2999 s vs 3000 s of work, 30% backspace is not spam, 31% is), one huge 10-minute step that must still say wentIdle THEN fellAsleep, a real break resetting the break timer, a huge step adding no work time, and a 20,000-step random fuzz. Mutation checks: idle `>=` to `>` broke 2, no typing-gap reset 2, spam `>` to `>=` 1, no work grace 1, no `wentIdle` note 3; restored identical.
- Printed timeline with the demo timing (typing steady at 4 s, idle 8 s after the last input, asleep at 20 s, `returned` on the mouse move, break due at 90 s) matched the plan.

## What Didn't Work
- My first scripted timeline sent typing events every 1.5 s instead of every 0.5 s (the real tracker's rate) and so showed odd labels; that was the script, not the classifier. Lesson: a demo script must send events at the real cadence.
- Counting every second before the idle threshold as "work" would give a 60 s bonus for every short trip away; work time now counts only while the last input is within 5 s.

## Test Coverage
- **Covered:** every label and boundary, notes and their order, demo timing, garbage numbers, long steps.
- **Not covered:** nothing is wired to real Windows events yet (Task 7); the cadence assumption (typing event every 0.5 s, up to 1.5 s considered fresh) comes from reading Ansh's `ActivityTracker`, not from a live run.
