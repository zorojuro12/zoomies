# 2026-10-04 — abel — Breadboard done and photographed; handheld toy deferred

**Status:** Controller breadboard tests are done and the fully wired board has been photographed. The board stays assembled on the breadboard for the demo and is returned to MLH at the very end, after the demo. PR #20 (`c/controller` → `dev`) is still open.
**Decided:** The handheld "toy" build is **deferred** — there is no plush or enclosure to put it in, so the demo controller stays a breadboard-and-Arduino setup for now.
**Spec:** No change. The handheld item in `docs/plans/lane-c-abel.md` P3 is postponed, not removed; the plan file wasn't edited.
**Next:** Merge PR #20 and tell Ansh the controller repeats HELLO every 2 s (his reader must ignore repeats); then build the audio module.
**Blocked on:** Nothing.
**Touches:** `journal/`; the physical breadboard (no code changed this entry)

---

## Decisions Made
- **Handheld toy deferred to later** — reason: no plush or enclosure available. The plan's P3 "build the handheld toy" item waits until there is something to house it in; the controller works as it is on the breadboard.
- **Board kept for the demo, returned at the very end** — the MLH kit is a rental, so it still goes back complete (PRD §8), but only after the demo; the P5 "disassemble and return" step happens last.

## What Worked
- Wiring photographed with everything plugged in (done before the board is disturbed, as the plan asks for Devpost). The photo isn't in the repo yet; add it to the Devpost write-up.

## Relevant Commits
- PR #20 — `c/controller` → `dev` (open): the sketch with the repeating HELLO, plus the earlier journal entry

## Next Step
1. Merge PR #20 (merge commit); post in the group chat that the controller repeats `HELLO:zoomies:1` every 2 s forever and that Ansh's reader must treat repeats as a no-op.
2. Build the audio module (`playSound`, `app/src/renderer/audio/`) on a new `c/` branch — Ansh needs it by mid-P2.
3. P2: the remaining 8 sounds, then the Gemini side/back views. P3: controller → app end to end on Ansh's Windows laptop.
