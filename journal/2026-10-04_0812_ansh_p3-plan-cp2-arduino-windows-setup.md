# 2026-10-04 — ansh — P3 plan written, CP2 closed, Arduino IDE set up on Windows

**Status:** P3 plan (`docs/plans/a-p3-shoulds.md`) written and pushed on `a/p3-serial`; Daniel is now executing it. CP2 verified on Windows by Ansh, `dev` → `main` promoted (PR #31), tagged `mvp`. Arduino IDE 2.3.10 installed on the Windows laptop, UNO R4 package installed, board seen on **COM4**; sketch not uploaded yet. Video plan drafted on `c/video-plan` (pushed, PR not opened).
**Decided:** Daniel executes Lane A P3 while Ansh covers Lane C (Abel's) tasks: hardware bring-up on Windows, video plan. Hardware *app* testing waits on Daniel's serial code (plan Tasks 2–3); Serial Monitor checks don't.
**Spec:** No change.
**Next:** Upload `hardware/arduino/zoomies_controller/zoomies_controller.ino` from the Windows clone (path is relative to the clone root), run the Serial Monitor checks (115200, New Line), record joystick `J:` values at rest / four extremes / stick click for Daniel's calibration (plan Task 2 Checkpoint 4).
**Blocked on:** Nothing for the Serial Monitor checks; controller → app test blocked on Daniel's P3 Tasks 1–3.
**Touches:** `docs/plans/a-p3-shoulds.md`, `docs/video-plan.md` (on `c/video-plan`), `hardware/arduino/zoomies_controller/`

---

## What We Worked On
- Pulled `dev` several times as P2 landed piece by piece: PR #22 (behaviour), #25 (Abel's audio module + all 12 sounds), #26 (Daniel's `main.ts` wiring), #27 (sound cues). All of P2 is in `dev` and `a/p3-serial`.
- Wrote the P3 plan: Tasks 1–3 serial (pure mapper, link with fake-port tests, renderer throw + bounce chirp), Gate G, then behaviour hookup, mid-air catch, terrain (ride/fall only), keys + ElevenLabs L2, Gemini G3, G2 (cut first). Gate G is now cleared.
- Drafted the ≤ 3:00 video plan (13 shots, VO script, recording checklist), with fallbacks for every not-yet-built feature.

## Decisions Made
- **Plan's priority order and cuts** — see `docs/plans/a-p3-shoulds.md` "Blockers" table and cut line. Peek-from-behind, platform routing and window herding are out of P3.
- **Video plan on its own `c/video-plan` branch**, not on `a/p3-serial` — it doesn't belong in a P3 PR. Abel owns the final cut and VO.
- **Arduino IDE firewall prompt: deny.** The controller talks over USB serial only; the sketch never uses Wi-Fi.

## What Worked
- Arduino IDE on Windows: Boards Manager → "Arduino UNO R4 Boards" (`arduino:renesas_uno@1.6.0`) installed; board auto-detected as "Arduino UNO R4 WiFi on COM4".

## Open Questions / Blockers
- Abel hasn't pushed since 06:52 or journaled since 03:41 — his current task is unknown; tell him Ansh has taken the hardware bring-up and the video plan.
- `gh` isn't installed in WSL — PRs are opened/checked on github.com.
- Close the Serial Monitor before running the app, or the app can't open COM4.

## Relevant Commits
- `0922ac8`, `5c3d02d`, `c12e0af` — P3 plan and its gate updates
- `91abcc4` (on `c/video-plan`) — demo video plan
- PR #31 — `dev` → `main` after CP2, tag `mvp`
