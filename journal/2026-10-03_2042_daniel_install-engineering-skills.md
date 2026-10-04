# 2026-10-03 — daniel — Installed engineering skills (mattpocock/skills) for Lane B

**Status:** Six skills from `mattpocock/skills/skills/engineering` installed locally in `.claude/skills/` (gitignored, not in the repo). No app code written yet; `npm install` deliberately not run (Daniel said wait).
**Decided:** Install only what fits a 16-hour, 3-person hackathon that already has its own plans/journal/CLAUDE.md conventions: `tdd`, `diagnosing-bugs`, `prototype`, `codebase-design`, `research`, `pr`.
**Spec:** No change.
**Next:** Daniel says "start" → Step 1: standalone `preview.html` stage (orthographic camera, turntable, pose buttons, FPS readout). Skills may need a new Claude Code session before they are listed.
**Blocked on:** Nothing for Step 1. Contracts (`a/contracts`) still not on the remote.
**Touches:** `.claude/skills/{tdd,diagnosing-bugs,prototype,codebase-design,research,pr}/` (local only)

---

## Decisions Made
- **Installed (read in full first, no network calls or hidden behaviour; only script is a "press Enter" HITL template):**
  - `tdd` — CLAUDE.md wants unit tests on SDF maths, IK, gait, fitting. Rule to know: it asks us to agree the test *seams* before writing tests.
  - `diagnosing-bugs` — shader flicker, splat z-fighting, foot sliding and frame-time problems need a tight repro loop before guessing.
  - `prototype` — throwaway HTML to feel out a gait/pose before committing it to the real renderer.
  - `codebase-design` — vocabulary for deep modules/seams; `tdd` calls it, and `DogController`/`DogView` are our seams.
  - `research` — background agent to read primary docs (Gemini model IDs and response schemas, SDF primitives, splat rendering) and save a cited note.
  - `pr` — PR body template (summary visual, before/after evidence, merge danger); fits the merge-into-`dev` flow.
- **Skipped on purpose:**
  - `code-review` — we already have the built-in `/code-review`; same name would clash.
  - `setup-matt-pocock-skills`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `wayfinder`, `triage` — they assume an issue tracker and their own spec/ticket flow; we already have a PRD, lane plans and checkpoints, and no time to set up a tracker.
  - `grill-with-docs`, `domain-modeling` — create `GLOSSARY.md` and ADRs; the journal already records decisions. Revisit only if the team wants a glossary.
  - `improve-codebase-architecture`, `retro`, `wizard`, `ask-matt` — not useful in a 16-hour window.
- **Installed locally, not committed** — `.gitignore` excludes `.claude/skills/*` except `journal/`, and CLAUDE.md says personal tooling stays local. Teammates are unaffected.
- Dropped each skill's `agents/openai.yaml` (Codex-only config).

## Open Questions / Blockers
- Skills often only appear after restarting Claude Code; if `/tdd` etc. don't show up, start a new session in this folder.
- Several skills mention an optional `GLOSSARY.md` — we have none, they ignore it.

## Next Step
Wait for Daniel's go, then explain and build Step 1 (preview page).
