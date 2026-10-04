# Zoomies — Dev Workflow Guide: What to Reach For, When

For **Ansh (Lane A)** and **Abel (Lane C)**, who share Ansh's Claude Code setup.
Daniel runs his own workflow inside the rules in `CLAUDE.md`.

Adapted from Tickwire's guide (`~/projects/tickwire/docs/dev-workflow-guide.md`)
with the same migration test:

> **Did we invent a rule, or set a value? Rules travel; values don't.**
> **Verdicts are project-specific; the reasoning is portable.**

Conditions that differ from Tickwire and CallIt, so every verdict below was
re-derived: **three developers in parallel**, **a 24-hour hackathon**, **PRs into
`dev`** instead of solo self-merge, a **Windows-first** app developed partly from
WSL and Macs, and **no coverage target**.

Project docs: PRD [`specs/2026-10-03-zoomies-prd.md`](specs/2026-10-03-zoomies-prd.md) ·
[`tech-stack.md`](tech-stack.md) · plans in [`plans/`](plans/).

---

## 1. Design & spec work

**Done.** PRD v1.2 is approved. Reopen brainstorming only for a genuinely new
question no PRD section covers, and record the outcome in the PRD + a journal entry.

| Situation | Use |
|---|---|
| A new open-ended question mid-build | `brainstorming` skill (keep it short — bounded path) |
| A decision changes the PRD | Edit the PRD in a small `docs` PR + one line in your next journal entry |

## 2. Plans

**The architectural layer is DONE — don't re-run `/impl-plan`.** Its output is
`docs/plans/00-shared.md` + the three lane plans. A phase starts at `writing-plans`.

| Situation | Use |
|---|---|
| Starting a phase of your lane | `writing-plans` on your lane file's phase section → `docs/plans/a-p<N>-<slug>.md` (Abel: `c-p<N>-<slug>.md`) |
| Executing it | `executing-plans` → `finishing-a-development-branch` → PR into `dev` |
| A small standalone task not in your lane plan | `writing-plans` directly, or just do it if it's under ~30 minutes |
| Abel's non-code checklist items (views, sounds, wiring, QA, video) | Work straight from `lane-c-abel.md` — no plan document needed |

**Rolling waves:** write only the current phase's plan in detail; write the next
one at the checkpoint, from what actually works.

### 2a. Plan in Opus, execute in Sonnet (carried from Tickwire)

| Window | Model | Does |
|---|---|---|
| Planning | Opus | `writing-plans` — resolves open questions, writes the phase plan |
| Executing | Sonnet | `executing-plans` — works the plan task by task |

The executing window needs **no conversation history**: everything it needs must
be in the plan (constraints, Windows gotchas, contract references). If only
someone who watched the plan being written can execute it, it isn't finished.

**Changed from Tickwire:** `dev` is protected, so the plan can't be committed to
`dev` first. Make the plan the **first commit on the phase branch** — it lands in
that PR's history, which is fine here (the PR is reviewed as one unit anyway).

**Only one window edits `.claude/` at a time** (CallIt lost work to this).

## 3. Tooling: what's installed, and when to import more

Cost model (see `/context`): **rules without `paths:` load their full text every
turn**; rules with `paths:` load only when a matching file is read; skills,
commands and agents cost one listing line each until used. So: keep always-on
rules tiny, scope language rules by path, install skills/agents/commands only
when a phase needs them, and remove what a phase no longer needs.

**Every candidate below was checked by reading its actual file, not its name** —
Tickwire's import map was wrong 3 times out of 4 when built from names.

### 3a. P0 — the starting set (do this before writing the P1 plan)

**Rules** (`.claude/rules/`):
| Action | Item | Why |
|---|---|---|
| **Remove** | all of `rules/ecc/common/` (10 files, ~4.4k tokens every turn) | Mandates TDD + 80% coverage + proactive agents; contradicts our hackathon policy and the "agents only when asked" harness default |
| **Add** | `rules/hackathon-workflow.md` (new, ~30 lines): test policy, branch/PR rules, checkpoint ritual pointer, "no per-frame allocation" | Replaces `common/`; most of it already lives in `CLAUDE.md`, so keep it to what `CLAUDE.md` doesn't say |
| **Add** | trimmed `rules/ecc/common/security.md` (secrets + error messages only, ~15 lines) | Public repo + API keys |
| **Add** | `rules/ecc/typescript/` from `~/projects/ECC/rules/typescript` (already `paths:`-scoped to `**/*.ts` etc.) | Loads only when editing TS. **Its "Immutability — use spread" section conflicts with hot paths; `CLAUDE.md` overrides it.** |
| **Don't add** | `rules/ecc/web/` | Read it: Core Web Vitals, bundle budgets, CSS — scoped to `.tsx/.css/.html`; we're `.ts` + GLSL in Electron with no React. Not applicable. |
| **Don't add (Lane A)** | `rules/ecc/python/`, `rules/ecc/cpp/` | Not Ansh's folders. Abel: if you want C++ rules for the Arduino sketch, copy `cpp/coding-style.md` only and add `"**/*.ino"` to its `paths:` — ECC's cpp paths don't match `.ino`. |

**Skills** (`.claude/skills/`):
| Action | Item |
|---|---|
| Keep | `writing-plans`, `executing-plans`, `finishing-a-development-branch`, `journal`, `verification-loop`, `security-review` |
| Remove | `brainstorming` (spec is done — re-copy from `~/projects/superpowers/skills/` if a new question needs it) |

**Commands** (`.claude/commands/`):
| Action | Item | Why |
|---|---|---|
| Keep | `/pr` (adapt — §3c), `/build-fix`, `/security-scan` | Used every phase / before going public |
| Keep | `/impl-plan` | Already run; keep only as reference — remove if you want the line back |
| **Remove** | `code-review.md` | It **shadows Claude Code's built-in `/code-review`**; removing it restores the built-in |
| Remove | `checkpoint` (ECC's "checkpoint" ≠ our phase checkpoints — confusing), `test-coverage` (no target), `orch-*` ×5, `learn`, `learn-eval`, `harness-audit`, `ecc-guide`, `model-route`, `refactor-clean`, `review-pr`, `project-init` | Not used in a 24 h build |

**Agents** (`.claude/agents/`):
| Action | Item |
|---|---|
| Keep | `code-reviewer`, `security-reviewer`, `silent-failure-hunter` |
| **Add** | `typescript-reviewer`, `build-error-resolver` from `~/projects/ECC/agents/` |
| Remove | `planner`, `architect`, `code-architect`, `code-explorer`, `doc-updater`, `spec-miner`, `agent-evaluator`, `comment-analyzer`, `type-design-analyzer`, `refactor-cleaner`, `tdd-guide`, `performance-optimizer` (re-add at P4) |

Then: `/context`. Target ≲ 1.5k tokens always-on (`CLAUDE.md` + unscoped rules),
≲ 15 skills+commands+agents. **Zip `.claude/` for Abel** after this.

### 3b. Phase-by-phase import map

Only what's **not** in the starting set. Source: `~/projects/ECC/` unless noted.

| Phase | Import | Trigger | Remove after |
|---|---|---|---|
| P0 scaffold | `vite-patterns` skill | Only if electron-vite config fights you (aliases, env, main/preload/renderer builds) | When the build is stable |
| P1 Windows spikes | `search-first` skill | Before adding a native module (`koffi`, `uiohook-napi`, `serialport`, window-enumeration packages) — compare options before committing to one | End of P1 |
| P1 / P3 | `/build-fix` (installed) + `build-error-resolver` (installed) | Native module rebuild failures on Windows (`electron-rebuild`), TS errors | — |
| P2 MVP | Nothing new | — | — |
| P3 serial + services | `security-review` (installed) | Parsing serial input; handling API keys in the main process; mic audio to ElevenLabs | — |
| P4 perf pass | `benchmark-optimization-loop` skill + `performance-optimizer` agent | Start of the FPS pass: baseline frame time first, one-hypothesis variants, promote only measured wins | End of P4 |
| P5 submission | `/security-scan` (installed) + `security-review` | Before the repo goes public | — |

**Checked and rejected — don't re-litigate:**
- `windows-desktop-e2e` — pywinauto for native WPF/WinForms/Qt apps, not Electron overlays.
- `e2e-testing` / `e2e-runner` — Playwright; can launch Electron, but our risky behaviour (transparency, click-through, window list, serial) isn't observable from inside the page. Not worth it in 24 h.
- `documentation-lookup` / `docs-lookup` — inert: their whole mechanism is the **Context7 MCP, which isn't configured** (`mcpServers` is empty). Revisit only if someone installs Context7.
- `latency-critical-systems` — dashboards/queues/caches hot-path model; not a 60 FPS render loop.
- `motion-*` skills — React `motion/react` UI animation; we have no React.
- `frontend-design-direction` — web product UI; our UI is a pet overlay + small editor.
- `rules/ecc/web/` — see 3a.
- `contract-first` — OpenAPI/AsyncAPI/protobuf-centric; our contracts are plain TS types written in one session.

### 3c. Skill adaptations needed at P0 (record the hazard, not the wording)

| Item | Change | Prevents (the hazard) |
|---|---|---|
| `executing-plans` | Replace "per `docs/dev-workflow-guide.md` §8 — branch per phase, self-merge into `dev`, no PR" and "expected choice is Option 1, merge locally into `dev`" with: branch `a/<slug>` (or `c/<slug>`) off `dev`; finish = push + PR into `dev` with a merge commit | A session self-merging into protected `dev`, bypassing the PR the other two rely on to see changes |
| `finishing-a-development-branch` | Default to "push and create a PR" against `dev`; local merge is not an option here | Same |
| `/pr` | Default base `dev` (not `main`); replace its `git rebase origin/<base>` step with `git merge origin/dev` | PRs opened against `main`; rewriting a branch someone else pulled |
| `writing-plans` | Plans saved as `docs/plans/a-p<N>-<slug>.md`; "Where a plan stops" stays (finishing owns the PR) | Plans scattered under different names; plans that merge themselves |

## 4. Implementation loop

| Situation | Use |
|---|---|
| Building a phase (default) | `writing-plans` → `executing-plans` |
| Build / type / native-module errors | `/build-fix`, `build-error-resolver` agent |
| Windows-only behaviour | Run it on Windows before calling it done (`CLAUDE.md` rule) |
| A bug | Reproduce as a failing test when it's pure logic; otherwise reproduce on Windows and note the steps in the PR |

**Windows loop for Lane A:** either run Claude Code natively on Windows for this
repo (fastest), or edit in WSL and drive the Windows clone via `powershell.exe`
(pull → `npm install` → `npm run dev`). Never share `node_modules` between WSL
and Windows.

## 5. Review (before every PR into `dev`)

| Situation | Use |
|---|---|
| Any code PR | built-in `/code-review` or `code-reviewer` agent |
| TypeScript-heavy changes (contracts, main process, behaviour) | `typescript-reviewer` agent |
| Serial parsing, API keys, mic/screen data, anything going public | `security-review` skill / `security-reviewer` agent — **mandatory** |
| Fallbacks and catch blocks (services, serial reconnect) | `silent-failure-hunter` agent |

Keep reviews proportional: a 30-line PR gets a quick look, not three agents.

## 6. Testing

- Hackathon policy in `CLAUDE.md`: unit-test pure logic, check visuals by eye on
  Windows, demo path as the end-to-end test, no coverage target.
- **No false green.** Ask what this runner's route to a false green is: for
  Vitest, a `-t` name filter or file filter that matches nothing. Confirm the new
  test appears in the run's count. (Carried hazard from Tickwire — the mechanism
  differs per runner; the question doesn't.)
- **Checkpoint commits chained behind their test with `&&`** (`npx vitest run
  <file> && git commit …`) so a red test makes the commit unreachable.

## 7. Docs & knowledge capture

| Situation | Use |
|---|---|
| End of a phase, a handoff, going to sleep | `journal` skill — your name in the filename |
| A decision changes the plan | Update the lane plan / `00-shared.md` in the same PR + journal line |
| A cross-lane decision | `00-shared.md` (contracts, dependencies, cut list) — tell the others |

## 8. Git & shipping

**Branch per task, PR into `dev` with merge commits.** Re-derived: Tickwire chose
"no PR ceremony" for a solo project and said *revisit immediately if a
collaborator joins* — two joined, so PRs are how the others see changes.

| Situation | Use |
|---|---|
| Starting a task/phase | `git checkout -b a/<slug> dev` (`executing-plans` Step 1 does this) |
| Committing | `type: description`, one commit per checkpoint, `git add <exact paths>` |
| Staying current | `git fetch && git merge origin/dev` — not rebase |
| Finishing | `finishing-a-development-branch` → `/pr` (base `dev`) → merge commit on GitHub |
| Phase checkpoint (Ansh) | Merge all PRs → run the demo path on Windows → Abel's QA → PR `dev` → `main` (merge commit) → tag |
| Before going public | `/security-scan` + `security-review` |

## 9. Context hygiene

- **New session per phase** (plan window, then execute window); start each with
  "resume from the journal".
- `/compact` at natural breaks inside a long phase, not mid-task.
- `/context` after any import; remove what the phase no longer needs (3b's last column).

## 10. Decisions & tradeoffs

Reasoning is portable; verdicts are not — re-run these if conditions change.

| Decision | Verdict | Revisit when |
|---|---|---|
| PR vs self-merge | PRs into `dev` | Never this weekend |
| Squash vs merge commit | Merge commits | Never this weekend |
| ECC `common/` rules | Removed; replaced by `CLAUDE.md` + a small hackathon rule | The project outlives the hackathon |
| Immutability guidance | Overridden for hot paths only | — |
| Rule packs vs skills timing | TS rules at P0 (path-scoped, ~0 cost); skills/agents per phase trigger | A rule pack turns out to be always-on |
| `CLAUDE.md` timing | Minimal shared conventions now; add Build/Test commands and File Structure **after the scaffold exists**, from verified reality (Tickwire's rule) | — |
| Test policy | Pure-logic unit tests, no coverage target | The project outlives the hackathon |
| Context7 / docs lookup | Not installed | Someone configures the Context7 MCP |
| `.claude/` in git | Gitignored except `journal` | Keeping Abel's copy in sync becomes painful |

### `CLAUDE.md` additions owed (after `a/scaffold` merges)
- **Build and test commands** — the real `npm` scripts, verified by running them on Windows and Mac.
- **File structure** — the actual tree once `app/`, `pipeline/`, `hardware/` exist.
- Consider nested `app/src/main/CLAUDE.md` and `app/src/renderer/CLAUDE.md` for Lane A-only gotchas (Electron flags, DIP scaling, render-loop rules) — they load only when working in those folders.
