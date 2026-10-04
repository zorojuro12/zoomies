# 2026-10-04 — ansh — CP2 verified on Windows; promoting dev to main

**Status:** CP2 (the MVP checkpoint) passed on the Windows demo laptop, on `dev` directly: full cycle (launch the ball → cursor reaction → mouse fetch, ball carried and returned → idle → sleep, HUD shows the FPS tier drop → wake and greet) confirmed twice in the same running session, no restart needed between. 753/753 tests, typecheck and lint clean.
**Decided:** Verify CP2 on `dev` itself (not a feature branch) since that's what actually gets promoted and tagged — testing on a side branch and then claiming `dev` was checkpointed would be sloppy. No code changes needed this session; P2 arrived already working via Daniel's PRs (#22 behaviour, #25 audio module, #26 wiring, #27 sound cues) plus Abel's controller/sounds.
**Spec:** No change.
**Next:** Promote `dev` → `main`, tag `mvp`, then resume P3 (serial reader) on `a/p3-serial`.
**Blocked on:** Nothing.
**Touches:** `docs/plans/lane-a-ansh.md`

---

## What Worked

- Caught, before declaring CP2 done, that neither Daniel's own verification (done on a Mac with a fake OS layer, explicitly not on Windows per his journal) nor my own quick spot-checks earlier in the session (sounds, dog starting position) actually covered the full done-criteria in `lane-a-ansh.md`: the complete fetch cycle (not just "a sound played"), the idle→sleep→wake cycle with the FPS tier visibly dropping, and running it twice without restarting. Said so explicitly instead of assuming "sounds work" meant "CP2 passed," then went back and ran the actual checklist.
- `ZOOMIES_DEMO=1` (short timers: idle 8s, asleep 20s) made this fast to verify by hand instead of waiting on the real multi-minute thresholds.
- Avoided testing or committing on `a/p3-serial` once it became clear Daniel was also actively pushing to it (a P3 planning doc had landed there from him) — did the CP2 check on `dev` instead, which was also the more correct branch for it regardless.

## What Didn't Work

- Nothing failed this session for CP2 itself — it passed clean both times. The only friction was procedural: realizing mid-session that `a/p3-serial` had become a shared branch (Daniel pushing to it too) and needing to redirect the verification to `dev`.

## Test Coverage

- **Covered:** needs model, activity classifier, fetch state machine (incl. fuzz/random-event tests), reactions/arbiter, adaptive FPS, sound cues — all with unit tests; the full end-to-end cycle manually on Windows, twice.
- **Not covered:** exact FPS numbers weren't measured with a profiler, just observed via the HUD's tier readout (full / resting / asleep) and no visible stutter — matches the project's "visuals checked by eye" policy rather than a gap.

## Relevant Commits

- (this session, on `a/cp2-verify` off `dev`) — docs: CP2 verified; lane plan updated, journal entry
