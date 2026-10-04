# 2026-10-03 — ansh — Scaffold, CLAUDE.md, workflow guide and onboarding

**Status:** P0 partly done. `dev` has the plans, a shared `CLAUDE.md`, the dev workflow guide, the electron-vite scaffold and `GETTING_STARTED.md`. Scaffold verified in WSL (typecheck, lint, 2 tests, build); `npm run dev` not yet run on Windows or Mac.
**Decided:** One shared scaffold for all three lanes, with the renderer flattened to `app/src/renderer/main.ts` so lane folders match the docs, and an `@shared/...` import alias across main, preload and renderer.
**Spec:** No change.
**Next:** Ansh runs `npm run dev` on a Windows clone; then trims `.claude/` + adapts skills (workflow guide §3a/§3c) and leads the contracts session → `a/contracts`.
**Blocked on:** Nothing. `dev`/`main` branch protection still to be turned on (a direct push to `dev` succeeded).
**Touches:** `app/`, `CLAUDE.md`, `GETTING_STARTED.md`, `README.md`, `docs/dev-workflow-guide.md`, `docs/tech-stack.md`, `pipeline/`, `hardware/`, `scripts/`, `assets/`

---

## Decisions Made
- **`CLAUDE.md` is shared and minimal** — conventions every workflow must follow (lanes, contracts, coordinates, secrets, Windows-only verification, git, testing, journal). Build/test commands and file structure were added only after the scaffold existed and ran (Tickwire's "verified reality only" rule).
- **Hot paths don't allocate** — `CLAUDE.md` overrides the ECC TypeScript rule "always immutable / use spread" for the render loop, physics and per-frame animation (GC stutter). Immutability still applies to state and contracts.
- **Dev workflow guide (`docs/dev-workflow-guide.md`) for Ansh + Abel**, built in Tickwire's format and checked against the actual ECC files. P0 tooling: remove ECC `common/` rules (~4.4k tokens/turn), add path-scoped TypeScript rules, keep 6 skills, remove the project `code-review.md` (it shadows the built-in `/code-review`), add `typescript-reviewer` + `build-error-resolver`. Phase-by-phase import map with triggers.
- **Rejected after reading them** (tech-stack corrected): `rules/ecc/web/` (Core Web Vitals/CSS), `contract-first` (OpenAPI-centric), `windows-desktop-e2e` (pywinauto, not Electron), `e2e-testing` (Playwright can't see overlay behaviour), `documentation-lookup` (needs a Context7 MCP we don't have).
- **Merged `a/master-plans` into `dev` directly with a merge commit** (PR not used this once, at Ansh's request), then committed `GETTING_STARTED.md` straight to `dev`.
- **`GETTING_STARTED.md`** is the onboarding entry point for Daniel and Abel: read order, tools per OS, clone, first run, per-person setup, everyday git/Claude commands, troubleshooting.

## What Worked
- `npm create @quick-start/electron app -- --template vanilla-ts --skip` scaffolds non-interactively.
- In WSL: `npm run typecheck`, `npm run lint`, `npm test` (2 passed), `electron-vite build`, Prettier check — all green.

## What Didn't Work
- `npm create @quick-start/electron -- --help` doesn't print help — it starts the interactive prompt. Flags (`--template`, `--skip`) found by reading the package's `index.js`.

## Test Coverage
- **Covered:** `app/src/shared/app-info.test.ts` — smoke test that Vitest and the `@shared` alias work.
- **Not covered yet:** everything else — no lane code exists.

## Open Questions / Blockers
- Does `npm run dev` work on Windows (native Node) and on a Mac?
- Branch protection + "merge commits only" on GitHub not set yet.
- Devpost project not created yet.
- `executing-plans`, `finishing-a-development-branch` and `/pr` still assume self-merge / `main` — adapt before the first execution session (workflow guide §3c).
- Still open from earlier: MLH credits, Huawei Drive folder, splat coat approach.

## Next Step
1. Ansh: Windows clone → `cd app && npm install && npm run dev`; update `CLAUDE.md`'s "not yet verified" line.
2. Ansh: protect `dev` and `main`, merge commits only; create the Devpost project (or ask Abel).
3. New Claude session in `~/projects/zoomies`: tooling trim + skill adaptations, `/context`, zip `.claude/` for Abel.
4. Contracts session with Daniel and Abel → `a/contracts` (incl. the dog-shaped placeholder).
5. Daniel and Abel: follow `GETTING_STARTED.md`; Abel starts the Gemini views immediately.
