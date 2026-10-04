# 2026-10-03 — ansh — Tooling trim, branch rules, protection, drafted contracts

**Status:** P0 nearly done. Contracts + stubs + placeholder dog + preview page are drafted on `a/contracts` (PR into `dev` pending). Tooling trimmed; Abel's zip ready. `dev`/`main` are protected — everything, Ansh included, now lands via PR.
**Decided:** Contracts are pre-drafted as code (`app/src/shared/`) and become the source of truth; the session with Daniel and Abel is a ~20-minute review, with changes via small PRs.
**Spec:** No change to the PRD. Plans updated: landmarks format → contract §3.9, asset loading → §3.10.
**Next:** Merge the `a/contracts` PR (merge commit); first `npm run dev` on Windows and a Mac (placeholder dog should appear); contracts review with Daniel + Abel; then each lane writes its P1 plan.
**Blocked on:** Nothing.
**Touches:** `app/src/shared/*`, `app/src/renderer/{main.ts,preview.*,host/,dog/placeholder/,audio/}`, `app/src/main/os/`, `app/electron.vite.config.ts`, `assets/dog/placeholder.dog.json`, `docs/plans/*`, `CLAUDE.md`, `GETTING_STARTED.md`, `README.md`

---

## Decisions Made
- **Tooling trimmed** (local `.claude/`, gitignored): ECC `common/` rules removed; `rules/hackathon-workflow.md` + trimmed `rules/security.md` (~450 tokens always-on) + path-scoped ECC TypeScript rules; 6 skills, 3 commands (`/build-fix`, `/security-scan`, `/impl-plan`), 5 agents. **`/pr` removed** — not in Ansh's workflow; `finishing-a-development-branch` prints the GitHub compare URL instead. `executing-plans`/`finishing-a-development-branch` adapted to "PR into `dev`, merge commit", inline only. "Use PROACTIVELY / MUST BE USED" removed from agent descriptions. Backup: `~/.claude/backups/zoomies-claude-2026-10-03/`.
- **Personal workflow guides are local-only:** `docs/dev-workflow-guide*.md` gitignored and untracked (Ansh's + Abel's). Tracked docs no longer link to them.
- **Abel's setup:** `~/projects/zoomies-claude-for-abel.zip` (`.claude/` + his guide). Unzip in the repo root with `unzip -o` in Terminal (not Finder — it extracts to a new folder), then delete the zip. Tested: merges with the tracked journal skill, `git status` clean.
- **Branch rules in README:** before branching (pull `dev`, lane prefix), while working (own lane files only, `git merge origin/dev`), before merging (merge `dev` in, resolve conflicts in your branch — keep your own plan's version, combine shared files — re-run checks, PR with merge commit), after merging. Plan ownership rule added to `CLAUDE.md`.
- **Merge, not rebase, to update branches** — no force-pushes, one rule for everyone.
- **Contracts drafted** (`app/src/shared/`): geometry, os, dog-file (+ `dog-file.schema.json`, `validateDogFile()`; dog-local frame = pixels, origin between the paws, +x forward, y down, +z toward the viewer; `SdfShape.color` added), dog-controller, dog-view, input, serial (parser/formatter), ipc, audio (`SOUND_NAMES`, `AudioPlayer`), landmarks (§3.9), assets (§3.10, `assetUrl()`).
- **Asset loading:** repo-root `assets/` is the renderer's public dir (`electron.vite.config.ts`); load with `assetUrl()` so dev and packaged builds both work.
- **Stubs:** `StubOsLayer` (main/os), `StubAudio` (renderer/audio), `PlaceholderDog` (renderer/dog/placeholder — implements DogView + DogController with meshes from the dog file: poses with overshoot easing, walk/run, jump arc, look-at, tail wag, ball), dog-shaped `assets/dog/placeholder.dog.json` (10 bones, 12 shapes, 6 poses). App host now shows the placeholder dog (click → it runs there and sits). `preview.html` built as a second page for Daniel.
- **`.env` loading:** Node's built-in `process.loadEnvFile()` in the main process (Lane A P3 note).

## What Worked
- In WSL: typecheck, lint, **18 tests** (serial parser, dog-file validation, asset URLs, app-info), production build. Built `index.html`/`preview.html` and `dog/placeholder.dog.json` served correctly over HTTP. Placeholder validates against the JSON Schema in Python (`jsonschema`).
- Branch protection works: GitHub rejected a direct push to `dev` ("Changes must be made through a pull request").

## What Didn't Work
- **Pushing straight to `dev` after protection** — rejected; Ansh isn't on the ruleset bypass list. The local merge was undone (`dev` reset to `origin/dev`); work goes through the `a/contracts` PR. From now on every change — journals included — goes via PR, unless Ansh adds himself as a bypass actor.
- ESLint flagged `_`-prefixed unused parameters in stubs — fixed by allowing `argsIgnorePattern: '^_'`.

## Test Coverage
- **Covered:** serial protocol parse/format incl. malformed lines; dog-file cross-reference validation + placeholder poses; `assetUrl`.
- **Not covered yet:** PlaceholderDog rendering and motion (visual — **not yet seen on screen**: no browser in WSL); StubOsLayer timing.

## Open Questions / Blockers
- First on-screen check of the placeholder dog (Windows + Mac).
- Ruleset bypass for Ansh — add it, or keep PR-only for everyone?
- Still open: MLH credits, Huawei Drive folder, Devpost project, splat coat approach.

## Next Step
1. Open the PR `a/contracts` → `dev`, merge with a merge commit.
2. `npm run dev` on Windows and a Mac — placeholder dog visible, click to make it run; Daniel opens `/preview.html`.
3. Contracts review with Daniel + Abel (~20 min); changes via small PRs.
4. Each lane writes its P1 plan and branches off `dev`.
