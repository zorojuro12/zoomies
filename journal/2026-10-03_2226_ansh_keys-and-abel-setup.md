# 2026-10-03 — ansh — API keys, Abel's Mac setup, plan/execute skills adapted

**Status:** P0 almost complete. Gemini + ElevenLabs keys in `.env` (gitignored); Abel set up on his Mac and `npm run dev` works there; contracts merged (PR #1). Windows run of `npm run dev` still pending.
**Decided:** Plans get a second checkpoint kind — **manual "Verify by hand"** (Where / Steps / Expected) — for behaviour a unit test can't observe; the executor stops and waits for the human's result before committing.
**Spec:** No change. `CLAUDE.md`: `npm run dev` verified on macOS.
**Next:** Ansh runs `npm run dev` on the Windows clone; contracts review with Daniel + Abel; each lane writes its P1 plan (new Claude session in `~/projects/zoomies`).
**Blocked on:** Nothing.
**Touches:** `CLAUDE.md`, `.env` (local only), local `.claude/skills/{writing-plans,executing-plans}`, local `docs/dev-workflow-guide*.md`

---

## Decisions Made
- **API keys:** Gemini key (Ansh) and ElevenLabs key (from Abel's Creator account, redeemed via code) live only in each machine's repo-root `.env` (copied from `.env.example`, `KEY=value`, no quotes). Shared by DM only. Nothing reads `.env` yet — Lane A loads it with `process.loadEnvFile()` in P3.
- **Key checks** (not run yet): Gemini `GET …/v1beta/models` with `x-goog-api-key` → 200; ElevenLabs `POST /v1/sound-generation` (1 s bark) → 200. Use the sound endpoint, not a profile lookup — a key restricted to Sound Effects / STT / TTS can fail profile calls while working fine. Print status codes only, never the keys.
- **`writing-plans` adapted (local):** manual checkpoints (Windows demo laptop / your Mac / Arduino Serial Monitor / browser); pure logic stays RED→GREEN; plan becomes the first commit on its phase branch (not `dev` — protected); Zoomies test commands (Vitest/pytest, `&&`-chained commit, test-count check); spec = PRD + lane file + contracts; Review Focus "up to five".
- **`executing-plans` adapted (local):** at a manual checkpoint it stops, gives exact steps for the named machine, waits for the user's result; Mac owners hand Windows-only checks to Ansh.
- **Abel's zip rebuilt** with the new skills and a Mac-aware guide (manual checks table, Mac notes: stub OS layer, `/dev/cu.usbmodem…` Arduino port, hidden dot-files).

## What Worked
- Abel: unzip into the repo root via Terminal (`unzip -o`, then delete the zip) → `git status` clean; Node LTS installed from nodejs.org; `npm install && npm run dev` shows the placeholder dog on macOS.

## What Didn't Work
- **Double-clicking the zip in Finder** didn't visibly do anything (contents are hidden dot-folders or go into a new folder). Use Terminal `unzip -o` in the repo root.
- **`npm: command not found`** on Abel's Mac — Node.js wasn't installed. Fix: nodejs.org LTS `.pkg`, reopen Terminal, `node -v`.
- Pushing straight to `dev` is rejected by the ruleset — this entry goes via PR.

## Open Questions / Blockers
- Windows `npm run dev` (Ansh).
- Key checks not yet run.
- Still open: Huawei Drive folder / larger photo, MLH credits, splat coat approach.

## Next Step
1. Merge this PR (`a/setup-keys-mac-check` → `dev`, merge commit).
2. Windows clone: `git pull`, `.env` in place, `cd app && npm install && npm run dev`; then update `CLAUDE.md`'s Windows line.
3. Optionally run the key checks (status codes only).
4. Contracts review with Daniel + Abel → P1 plans in a new session in `~/projects/zoomies`.
