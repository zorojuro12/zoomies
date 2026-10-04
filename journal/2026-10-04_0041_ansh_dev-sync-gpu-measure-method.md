# 2026-10-04 — ansh — Synced dev into a/p1-overlay; how to measure the SDF dog's real cost; moving to Windows

**Status:** `a/p1-overlay` has `origin/dev` merged in (PRs #6 editor, #7 Gemini spec pipeline, #8 first sounds); 256/256 tests green in WSL. The SDF dog's GPU cost on Windows is **still not measured** — first attempt was invalid (see below). `docs/plans/a-p1-overlay.md` not written yet.
**Decided:** Ansh moves to working natively on Windows (Claude Code in the Windows clone) — WSL was eating memory, and all of Lane A P1 is Windows-only anyway (PRD §6.4 option).
**Spec:** No change.
**Next:** On Windows: copy `.claude/` from the WSL repo into the Windows clone, `git pull` this branch, redo the uncapped measurement below with few apps open, then write `docs/plans/a-p1-overlay.md`.
**Blocked on:** Nothing.
**Touches:** `journal/`, `app/src/renderer/main.ts` (frame readout, read-only), `app/src/renderer/preview.ts` (Daniel's, read-only)

---

## What's new on `dev` (merged into this branch, `8a4357c`)
- **#6 `b/editor`** — `/preview.html?spec=aussie&edit=1`: 13 proportion sliders, ear/tail dropdowns, 13 colour pickers, Save → downloads `.spec.json` for `assets/dog/`. Abel can start likeness tuning.
- **#7 `b/gemini-spec`** — `pipeline/zoomies_pipeline/photo_to_spec.py`: 3 parallel Gemini calls, median/majority vote, colour snap to the photo, template fallback. Not yet run with a real key; model name `gemini-2.5-flash` unverified. Daniel needs the Gemini key by DM.
- **#8 `c/sounds`** — `bark_happy` ×2, `ball_squeak` ×2, `pant` ×3, `snore` ×3 in `assets/sounds/`, `SOUNDS.md` (all 12 names + prompts), `scripts/generate_sounds.mjs`. Same-size files are expected (fixed duration × 64 kbps); hashes differ. No audio module yet.

## What Didn't Work
- **Reading the on-screen "ms" as GPU cost** — the 6.9 ms in the app host (`main.ts:35`) and preview status is the **rAF interval**, locked to the 144 Hz monitor's vsync. It says nothing about render cost. The console snippet in `2026-10-04_0013_ansh_sdf-dog-gpu-cost-todo.md` reads the same number, so it only detects dropped frames unless vsync is off.
- **That screenshot was the app host, not the SDF dog** — "click to call the dog" is `main.ts` with the placeholder. The SDF dog is only at `/preview.html?dog=sdf&spec=aussie`.
- **Task Manager → Details has no GPU column** — use Processes (GPU column) or Performance → GPU (3D graph).
- **First uncapped run lagged heavily** — expected partly (uncapped = GPU at 100%), but WSL memory pressure + many open apps made it unusable as a measurement. Redo on a quieter machine.

## How to measure (the valid method)
1. Plugged in, Windows power mode = Best performance; `npm run dev` running.
2. Separate Chrome profile with vsync and frame limit off (normal Chrome is untouched; the profile is needed or the flags are ignored while Chrome is open):
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$env:TEMP\zoomies-perf" --disable-gpu-vsync --disable-frame-rate-limit "http://localhost:5173/preview.html?dog=sdf&spec=aussie"
   ```
   Check `chrome://gpu` → WebGL hardware accelerated.
3. Click **run ↔** a few times, run the 8 s console snippet from the 0013 journal → JSON. Note GPU % (Task Manager Processes/Performance) and the GPU name.
4. Repeat on plain `/preview.html` (placeholder baseline), and on the SDF page at 200% zoom (≈4× dog pixels, worst case).
- **Read it:** SDF avg ≤ 3 ms fine (PRD target 1–3 ms) · 3–8 ms OK for 60 FPS, put Daniel's bounding-sphere early-out in · > 8 ms tell Daniel now (fewer march steps / half-res).
- The full-screen **transparent overlay** cost can't be measured until the overlay exists — first task of the P1 plan.

## Open Questions / Blockers
- Better long-term: a real render-time readout (time around `renderer.render` in the host loop) for the FPS overlay — candidate for the P1 plan.
- `.claude/` is gitignored, so the Windows clone has no skills/rules/agents until copied over.

## Relevant Commits
- `8a4357c` — merge `origin/dev` into `a/p1-overlay`
