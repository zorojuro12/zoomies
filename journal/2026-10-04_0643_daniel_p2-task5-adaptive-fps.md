# 2026-10-04 — daniel — P2 Task 5: adaptive frame rate

**Status:** Built test-first: `behaviour/fps.ts` (`FrameGovernor`, `TIER_FPS`), `Behaviour.fpsTier()` and the long-frame fix, wired into the preview demo with a real fps readout. 689/689 tests in the whole suite, lint clean, typecheck clean apart from the Windows-only native modules. Branch `a/p2-mvp-behaviour` (draft PR #22).
**Decided (Daniel, by "lets do it" on my recommendations):** a 30 fps middle tier for resting (sitting idle, lying beside you while you type), 5 fps asleep, and the active mode NOT capped (the plan says at least 60 FPS active; a 60 cap on a 144 Hz laptop would judder).
**Spec:** No contract change; plan Task 5 section updated.
**Next:** Task 6 (sound cues), explained to Daniel first; then Task 7 (wire into Ansh's `main.ts`). For Task 7 the host loop needs: `if (!governor.shouldRun(now, behaviour.fpsTier())) { requestAnimationFrame(frame); return }` before doing a frame, and the HUD should show the target tier (his `Hud.set` takes only 'world' | 'activity' today).
**Blocked on:** Nothing.
**Touches:** `app/src/renderer/behaviour/{fps.ts,behaviour.ts,reactions.ts,activity.ts}` (+tests), `app/src/renderer/preview.ts`, `docs/plans/a-p2-mvp-behaviour.md`

---

## How it works
`FrameGovernor.shouldRun(nowMs, tier)` is asked on every screen refresh: `full` always yes; `rest` / `sleep` keep to a 30 / 5 per second beat (the beat advances by the interval so the average is exact, with 1 ms slack for refresh jitter; after a long pause it does ONE frame, not a flood; a backwards or NaN clock just runs the frame). `Behaviour.fpsTier()`: full for anything going on (a fetch, a greet, a pet, hover, shake, backspace, moving into place, 1.5 s settling in, a recent wake); resting / sleep speed once a reaction has settled (idle -> rest, typing/focus lying -> rest once actually lying, rest need -> rest, sleep -> sleep). A touch (mouse with speed > 0, or typing) wakes a sitting or sleeping dog at once for a second; input while it is already up and about changes nothing.

## What Worked
- 12 governor tests on a fake 144 / 60 / 30 Hz screen (counts per second within 1-2%, switching speed both ways, jitter, long pause, bad clock) and 13 behaviour tests (each tier, wake-at-once before any update runs, a still cursor does not wake it, awake for a second, long frames).
- Mutation checks: 7 mutations; 6 caught (no wake, no settling time, long frames counting 100 ms, drifting beat, catch-up flood, a sleeping dog at resting speed). The 7th (fetch not drawn at full speed) is equivalent: a fetch also falls through to `full` by another route.
- Seen in the demo: asleep it reads `199.3 ms · 6 fps (sleep)`; after `come back`, `61 fps (full) · greet`.

## What Didn't Work (found by the tests, all fixed)
- My first wake rule fired on EVERY key press, so a typing user kept the dog at full speed and the resting tier never showed; it now wakes only a dog that was sitting idle or asleep.
- Eighty 100 ms steps add up to 7.999999999999993 s, so the idle threshold at exactly 8 s was missed (a real rounding bug in the classifier from Task 2, only reachable by small steps): thresholds now allow a micro-epsilon; two new tests.
- Behaviour clamped one update to 100 ms, which at 5 fps would have slowed all time-based logic to half speed while asleep; updates up to 1 s are now taken in 100 ms pieces (anything longer counts as 1 s).

## Test Coverage
- **Covered:** the governor's beat, all tiers, waking, long frames, rounding.
- **Not covered:** the real GPU saving (to be measured on Ansh's laptop in Task 7: GPU% asleep vs awake); `DogMotion` still clamps its own step to 50 ms, so a sleeping dog breathes slowly at 5 fps (harmless); host wiring (Task 7).
