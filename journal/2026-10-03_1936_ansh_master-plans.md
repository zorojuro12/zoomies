# 2026-10-03 — ansh — Master plans for all three lanes

**Status:** Planning complete. Shared plan + one plan per lane written in `docs/plans/`; dog photo added. No app code yet — next is P0 (scaffold + contracts).
**Decided:** One shared plan (`00-shared.md`) for everything that crosses lanes + one plan per person (`lane-a-ansh.md`, `lane-b-daniel.md`, `lane-c-abel.md`); each person writes detailed per-phase plans from their lane file.
**Spec:** Updated — PRD §4.0 coat corrected to black tri-colour (the photo is not a blue merle); PRD §6.4 notes running Claude Code natively on Windows as an option for Lane A.
**Next:** P0 — Ansh: GitHub settings + `a/scaffold`; all three: contracts session → `a/contracts` (incl. dog-shaped placeholder); Abel: Huawei Drive folder, then Gemini views immediately.
**Blocked on:** Nothing.
**Touches:** `docs/plans/*`, `assets/photo/dog.jpeg`, `docs/tech-stack.md`, `docs/specs/2026-10-03-zoomies-prd.md`

---

## Start here (each person)
- **Everyone:** `docs/plans/00-shared.md` — phases, P0 setup, contracts (§3), dependency map (§4), checkpoint ritual (§5), cut list (§6), submission (§7).
- **Ansh:** `docs/plans/lane-a-ansh.md` · **Daniel:** `docs/plans/lane-b-daniel.md` · **Abel:** `docs/plans/lane-c-abel.md` (has a quick Claude Code guide at the top).

## Decisions Made
- **Phases are relative, not clock-based:** P0 setup & contracts → P1 spikes → P2 MVP → P3 Shoulds → P4 polish → P5 submission; each ends at a checkpoint (CP0–CP4) with go/no-go criteria. `00-shared.md` §1, §5.
- **Merge commits, not squash:** PRs into `dev` and `dev` → `main` promotions use merge commits; GitHub set to allow merge commits only; update branches with `git merge origin/dev`, don't rebase shared branches. `00-shared.md` §8, tech-stack §5.1.
- **Contracts written as TypeScript** in `00-shared.md` §3, incl. **coordinates = desktop pixels, y down, orthographic camera** — every lane depends on this.
- **Audio playback moved from Ansh to Abel** — Lane A was the heaviest; Abel owns the sound names anyway. Contract §3.8.
- **Dog-shaped placeholder** (~12 SDF primitives with poses) built in the contracts session instead of a capsule, so Lane A's fetch/behaviour look right from day one.
- **Two Gemini side views:** `side_sit` (same pose as the photo — used for proportions/colour) and `side_stand` (only for leg lengths). Changing pose and angle together makes Gemini drift into a different dog. Landmarks format in `lane-b-daniel.md`.
- **Daniel confirmed proficient** for Lane B (shaders, IK, gait); cut order inside his lane if he slips: optimiser → extra x-ray modes → jump polish → splat coat.
- **Standalone dog preview page** for Daniel so he never depends on the Windows overlay to iterate.

## Things to watch (from the plan review)
- **Full-screen transparent overlay cost on Windows** — measure GPU % / frame time in P1; fallback is a small window that follows the dog. Lane A P1.
- **Overlay must sit above the taskbar:** `setAlwaysOnTop(true, 'screen-saver')`. Lane A P1.
- **Integration bugs will cluster on Ansh's Windows machine** (Macs can't run the real overlay) — merge into `dev` more often than checkpoints.
- **Photo is low-res (380×466)** and likely taken from the brief; the full-size original is probably in Huawei's Drive folder (same filename if replaced).
- **It's a black tri-colour Aussie** (black coat, white blaze/chest/paws, copper cheeks/brows/legs), not a blue merle.

## What Didn't Work
- Photo first landed in a misspelled `assests/` folder — moved to `assets/photo/dog.jpeg`.

## Open Questions / Blockers
- MLH credits for Gemini / ElevenLabs?
- Anything extra in Huawei's Drive folder (rules, assets, larger photo)?
- Splat coat: custom pass vs existing renderer (Daniel, P1–P2).

## Next Step
1. Ansh: GitHub — add Abel, `dev` default, protect `main` + `dev`, merge commits only; merge this PR into `dev`.
2. Ansh: `a/scaffold`; trim `.claude/` and zip it for Abel.
3. All three: contracts session → `a/contracts`.
4. Abel: Huawei folder → Gemini views + landmarks (Daniel is waiting on them).
5. Each lane: write the P1 plan and branch off `dev`.
