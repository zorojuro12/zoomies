# 2026-10-03 — daniel — Lane B: Gemini "dog spec" replaces landmark measuring

**Status:** Read all plans; `dev` has the scaffold but no contracts yet (`app/src/shared/` has only `app-info`). Lane B plan updated on `b/sdf-spike`; no dog code yet.
**Decided:** Fit the dog from a Gemini-returned **dog spec** (ratios + ear/tail type + per-region hex colours) over a standard Aussie template, instead of measuring pixel landmarks.
**Spec:** Updated — Lane B plan only (P1 pipeline, colour, needs, risks). PRD §4.8 G1 / §6.2 and `lane-c-abel.md` still describe landmarks; their owners should align (landmarks are now optional, for the P3 optimiser only).
**Next:** Get `a/contracts` merged (or agree the dog-file contract with Ansh), then P1 Step 1: standalone `preview.html` stage.
**Blocked on:** Contracts (`dog-file.ts`, `dog-controller.ts`, `dog-view.ts`, placeholder dog) not yet pushed by Ansh. Preview page can start without them.
**Touches:** `docs/plans/lane-b-daniel.md`, `pipeline/`, `assets/dog/`

---

## Decisions Made
- **Gemini dog spec instead of landmark measurement** — reason: limb lengths from pixel landmarks are fragile and accuracy isn't critical. One Gemini call returns ratios to body height (`leg_length`, `snout_length`, `ear_size`, `tail_length`, ...), `ear_type`, `tail_type`, and region colours as hex. Details in `lane-b-daniel.md` "Dog spec".
- **Robustness** — 3 parallel calls (wait = slowest), 15 s timeout, median per ratio, clamp to template ranges, default Aussie template if all fail. Build-time only, so nothing waits on Gemini on stage.
- **Colours: Gemini picks which colour goes where; the photo supplies the exact paint** — Gemini hexes are snapped to the photo's dominant colours (k-means). Reason: models are loose with exact hex.
- **Abel's landmark picker is off the critical path;** his side/back views are now only for colouring unseen sides (P2).

## Open Questions / Blockers
- Tell Ansh (PRD G1 wording) and Abel (drop the landmark picker/`landmarks.json` as a P1 dependency).
- Contracts not on the remote yet.

## Next Step
1. Ping Ansh about `a/contracts`; Daniel owns §3.3 (`dog-file.ts` + schema).
2. Step 1: `app/preview.html` — orthographic camera, turntable, pose buttons, FPS readout.
