# Zoomies — Tech Stack & Team Workflow

Companion to the PRD (`docs/specs/2026-10-03-zoomies-prd.md`). This file answers three questions:
1. **What are we building with?** (stack, repo layout, lanes)
2. **What Claude Code tooling do we load?** (perennial vs scoped vs on-demand rules/skills/agents/commands)
3. **How do 3 devs work in parallel?** (branching, contracts, integration)

> Exact package versions are pinned when we scaffold (hour 0), not here. Anything marked **verify** must be checked against current docs before we rely on it.

---

## 1. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Language (app) | **TypeScript** | One language for main process, renderer and shared contracts; types make parallel work safer |
| Desktop shell | **Electron** | Transparent, always-on-top, click-through window; Node access for native Windows APIs and serial |
| Build / dev server | **Vite** via **electron-vite** (verify) | Fast HMR for renderer, handles main/preload/renderer builds |
| 3D / GPU | **Three.js** + **custom GLSL shaders** | Three.js for scene, camera, render loop; our own shaders for the SDF ray-march and the splat coat |
| Dog rendering | **SDF ray-marching** (body) + **custom Gaussian-splat pass** (coat, ~5–10k splats) | Both named techniques; tiny data; ~1–3 ms/frame target (est.) |
| Animation | **Our own code**: skeleton, pose library, procedural gait + leg IK, springs | No rig, no clips, no Blender |
| Physics | **Our own code**: ball vs SDF colliders, bounce prediction | Simple, exact, cheap — no physics engine needed |
| Audio | **Web Audio API** (`StereoPannerNode`, gain) | Spatial panning of pre-generated sounds |
| Package manager | **npm** | Least friction on Windows + Mac + WSL |
| Node | **Node LTS**, installed **natively on Windows** for the demo clone | Native modules must be built for Windows |
| Build-time pipeline | **Python 3.11+** | Best ecosystem for segmentation, Gemini SDK, optimisation |
| Hardware | **Arduino (C++)** sketch + **`serialport`** npm package | Standard, reliable USB serial |
| Tests | **Vitest** (TS unit) · **pytest** (pipeline) | Fast, minimal setup |
| Lint/format | **ESLint + Prettier** (defaults, light config) | Avoid formatting churn between 3 devs |

### 1.1 Desktop / OS layer (Windows-first)
| Need | Approach | Status |
|---|---|---|
| Transparent, always-on-top overlay | Electron `BrowserWindow` (`transparent`, `alwaysOnTop`, `frame: false`) | Standard |
| Click-through except on the dog | `setIgnoreMouseEvents(true, { forward: true })`, toggled by hit-testing the dog | Standard — test in hour 0–1 |
| Window rects + z-order | Win32 via FFI (**`koffi`**: `EnumWindows`, `GetWindowRect` / `DwmGetWindowAttribute`, `IsWindowVisible`) or a ready-made module (e.g. `node-window-manager`) | **verify** in hour 0–1 |
| Typing / mouse activity (timing only) | **`uiohook-napi`** global hooks — count events, never store keys | **verify** builds on Windows |
| Idle time | Electron `powerMonitor.getSystemIdleTime()` | Standard |
| Taskbar position | Electron `screen.getPrimaryDisplay().workArea` vs `bounds` | Standard |
| Mac teammates | **Stub OS layer**: screen edges only, fake activity events | Ours |

### 1.2 Services
| Service | Where it runs | SDK |
|---|---|---|
| **Gemini** G1 (views + landmarks) | Build-time pipeline (Python) | `google-genai` (Python) — **verify** current image model id |
| **Gemini** G2 / G3 / G4 | Electron main process, async | `@google/genai` (JS) |
| **ElevenLabs** L1 (sound library) | Build-time script (Python or Node) | `elevenlabs` (Python) / `@elevenlabs/elevenlabs-js` |
| **ElevenLabs** L2 / L3 (STT / TTS) | Electron main process, async | `@elevenlabs/elevenlabs-js` |
| **Tiger Data** (Could) | Electron main process, batched async | `pg` (node-postgres) |

All keys live in `.env` (gitignored); `.env.example` lists the names. **The repo will be public for Devpost — never commit a key.**

### 1.3 Build-time pipeline (Python, run once per photo)
| Step | Tool |
|---|---|
| Cut out the dog | `rembg` (simplest) or SAM 2 (better edges) — pick in hour 0 |
| Side/back views + landmarks | Gemini (`google-genai`) |
| Initial placement from landmarks | numpy |
| Silhouette fitting (Should) | numpy + scipy (`scipy.optimize`) or `cma` (CMA-ES) on a distance-transform loss |
| Coat colours | Project photo(s) onto the fitted body (numpy) |
| Output | `assets/dog/aussie.dog.json` (shapes, skeleton, splats, poses) — schema in `shared/` |

---

## 2. Repo layout and lanes

Folders map to **owners**, so three people (and their Claude Code sessions) rarely touch the same files.

```
zoomies/
├─ app/                          # Electron app (TypeScript)
│  ├─ src/main/                  # main process
│  │  ├─ os/                     #  ├ OS layer interface + windows/ impl + stub/      → Lane A
│  │  ├─ hardware/               #  ├ serial port, protocol parser                   → Lane A (protocol agreed with C)
│  │  └─ services/               #  └ elevenlabs/, gemini/, tiger/                   → Lane A
│  ├─ src/preload/               # typed IPC bridge                                  → Lane A
│  ├─ src/renderer/
│  │  ├─ dog/                    # SDF body, splat coat, skeleton, poses, gait       → Lane B
│  │  ├─ world/                  # SDF colliders, ball, bounce prediction            → Lane A
│  │  ├─ behaviour/              # needs model, state machine, steering              → Lane A
│  │  ├─ audio/                  # Web Audio playback + panning                      → Lane C
│  │  └─ ui/                     # overlay, FPS meter, pose/shape editor, x-ray      → Lane B (editor) / A (overlay)
│  └─ src/shared/                # CONTRACTS: types, events, dog-file schema         → everyone, change via PR only
├─ pipeline/                     # Python build-time reconstruction                  → Lane B
├─ hardware/arduino/             # Arduino sketch                                    → Lane C
├─ scripts/                      # sound-generation script (ElevenLabs L1)           → Lane C
├─ assets/                       # photo, Gemini views, generated dog file, sounds   → Lane C (dog file: B)
└─ docs/                         # PRD, tech stack, plans, journal
```

| Lane | Owner | Claude workflow | Owns | Machine |
|---|---|---|---|---|
| **A — Desktop shell, world & integration** | Lead | Lead's workflow (this repo's `.claude/`) | Electron window, click-through, OS layer (Windows + stub), IPC, serial code, ball physics + fetch, needs model + behaviours, ElevenLabs/Gemini runtime (L2, G2, G3), Tiger Data. **Integrator:** merges into `dev`, promotes to `main`, runs the demo laptop | Windows |
| **B — The dog** | Teammate 2 | Their own workflow (personal `~/.claude/`), repo conventions apply | Pipeline code (cut-out → landmarks → fit → colours), SDF body + splat coat rendering, skeleton/poses/gait, pose & shape editor | Mac |
| **C — Content, hardware & demo** | Teammate 3 | Lead's workflow (this repo's `.claude/`), learning as they go | Gemini side/back views + landmarks (AI Studio web UI, hour 0), ElevenLabs sound library (web UI + small script), audio playback module (Web Audio + panning), Arduino sketch + breadboard wiring, likeness/pose tuning in the editor, QA on the demo path, demo video, Devpost write-up, pitch | Mac |

If Lane A falls behind, the services work (L2, G2, G3) is the first thing handed to Lane B once the dog is stable.

---

## 3. Contracts first (hour 0–1, together)

Parallel work only stays parallel if the seams are agreed before anyone builds. Write these in `app/src/shared/` in the first hour, with stubs/mocks:

| Contract | Between | Contents |
|---|---|---|
| `OsLayer` interface | A (Windows impl) ↔ A/B (consumers on Mac use the stub) | `getWindows(): WindowRect[]` (with z-order), `onActivity(cb)` (typing/mouse timing), `getWorkArea()`, `setClickThrough(bool)` |
| `DogFile` schema | B (pipeline) ↔ B (renderer) | shapes, bones, splats, poses — JSON Schema + TS type |
| `DogController` API | A (behaviour) ↔ B (dog) | `setPose(name, opts)`, `moveTo(x, y, speed)`, `jumpTo(target)`, `lookAt(point)`, `getState()` |
| `InputEvent` types | A (serial + mouse) ↔ A (behaviour) | `launch {angle, power}`, `pet`, `call`, `pushToTalk {start/stop}` |
| Serial protocol | C (Arduino sketch) ↔ A (serial code) | Newline-delimited JSON or `KEY:value` lines, e.g. `J:512,300`, `B:1`, `T:1`; buzzer commands back |
| IPC channels | main ↔ renderer | Named, typed channels in one file |

Changing a contract = a small PR everyone sees. Everything else can change freely inside a lane.

---

## 4. Claude Code tooling — load lean, pull in on demand

> **Superseded for Ansh and Abel by `docs/dev-workflow-guide.md` §3**, which was checked against the actual ECC files: `rules/ecc/web/` and `contract-first` turned out not to apply (Core Web Vitals / CSS; OpenAPI-centric), and docs lookup needs a Context7 MCP we don't have. The tiers below remain the general idea.

**Shared vs personal.** The repo's `.claude/` and `CLAUDE.md` hold the **lead's workflow**, used by Lanes A and C. Teammate 2 keeps their own skills/agents in their **personal `~/.claude/`** (user scope) so the two workflows never collide in the repo. Everyone — whatever their workflow — follows the same **repo conventions**: `CLAUDE.md`, branch rules (§5.1), lane ownership (§2), contracts (§3), "never commit keys". Personal tweaks go in `CLAUDE.local.md` / `.claude/settings.local.json` (gitignored).

**For teammate 3 (new to Claude Code):** run in the default permission mode (Claude asks before acting) rather than auto mode, work only on `c/*` branches, and ask the lead before anything touches `app/`. The perennial skills below are their whole toolkit — no need to learn the on-demand list.

The goal: every session starts with **only what this project needs every time**; everything else is pulled in for the task at hand. Sources: `~/projects/ECC`, `~/projects/call_it/.claude`, `~/projects/tickwire/.claude`, `~/projects/superpowers`.

### 4.1 Perennial (always loaded, keep small)
| Kind | Item | Why |
|---|---|---|
| Project memory | **`CLAUDE.md`** (new, short): links to PRD + this file, lane ownership, branch rules, hackathon test policy, "never commit keys" | The one always-on source of truth |
| Rules | `common/security.md` (trimmed) | Public repo + API keys |
| Rules | A **new `hackathon-workflow.md`** replacing the heavy ECC `common/*` set | ECC common rules mandate TDD + 80% coverage + proactive agents — wrong trade-off for 24 h (see §5.6) |
| Skills | `writing-plans`, `executing-plans`, `finishing-a-development-branch` | Your existing plan → execute → finish loop (finishing adapted to PR-to-main) |
| Skills | `journal` | Hand-offs between devs and across sleep shifts |
| Skills | `verification-loop` | Quick "is it actually working" check before merging |
| Agents | `code-reviewer`, `typescript-reviewer` | One review pass before each merge |
| Commands | `/impl-plan`, `/pr`, built-in `/code-review` | Planning and merging |

### 4.2 Scoped (auto-load only when touching matching files — use `paths:` frontmatter)
| Rules | `paths:` | Source |
|---|---|---|
| `typescript/*` (coding-style, patterns, security, testing) | `app/**/*.ts` | call_it (already path-scoped) / ECC `rules/typescript` |
| `python/*` (coding-style, patterns, testing) | `pipeline/**/*.py` | ECC `rules/python` |
| `cpp/*` (trimmed: coding-style only) | `hardware/**` | tickwire / ECC `rules/cpp` |

### 4.3 On-demand (pull in when the task needs it, then drop)
| When | Pull in | Source |
|---|---|---|
| Two Claude sessions on one machine / parallel lanes | `using-git-worktrees`, `dispatching-parallel-agents` | Backup in `~/.claude/backups/doctor-2026-10-03/skills/` |
| Before adding a dependency | `search-first` | ECC skills |
| Library/API questions (Electron, Three.js, Gemini, ElevenLabs) | `documentation-lookup` / `docs-lookup` agent (needs Context7 MCP) | ECC |
| Vite / electron-vite config trouble | `vite-patterns` | ECC skills |
| Build or type errors | `/build-fix`, `build-error-resolver` agent | ECC |
| FPS pass (hours 10–16) | `benchmark-optimization-loop`, `performance-optimizer` agent | ECC |
| Pipeline code review | `python-reviewer` agent, `python-testing` skill | ECC |
| Arduino sketch review | `cpp-coding-standards` skill | tickwire / ECC |
| Before pushing the public repo | `security-review` skill, `security-reviewer` agent | already installed |
| Overlay/editor UI polish | `frontend-design-direction` | ECC skills |

### 4.4 Not needed for this project
Rigging/Blender skills, `blender-motion-state-inspection`, React/Next/Vue/motion-react skills (no React), database-migration and backend-API skills, `spec-miner`, `agent-evaluator`, `comment-analyzer`, `type-design-analyzer`, `refactor-cleaner`, `doc-updater`, the `orch-*` commands (too much ceremony for 24 h), `continuous-learning-v2`, TDD-mandatory `tdd-workflow`.

---

## 5. How we work in parallel — recommendations

### 5.1 Branching: `dev` for integration, `main` for known-good
```
main   ●───────────────●───────────────●──────────►   demoable builds only (tagged)
        \             ↑ promote        ↑ promote
dev      ●──●──●──●──●──●──●──●──●──●──●──────────►   integration: every PR merges here
            ↑  ↑     ↑     ↑     ↑
          a/*  b/*  c/*   a/*   b/*                    short-lived task branches, cut from dev
```
- **Branch off `dev`**, named `<lane>/<task>`: `a/click-through`, `b/sdf-body`, `c/arduino-sketch`.
- **PR into `dev` with a merge commit** (no squash, no rebase-merge). Branch history is preserved and each PR is one merge commit on `dev`, so a whole PR can still be reverted with `git revert -m 1 <merge>`. Self-merge once it builds and someone glanced at it (or a quick `/code-review`). In GitHub settings, allow merge commits only.
- **Keep branches short — merge into `dev` every 2–3 hours at most.** Before opening a PR, merge the latest `dev` into your branch (`git fetch && git merge origin/dev`). Don't rebase branches others may have pulled.
- **Promote `dev` → `main` only at checkpoints** (§5.3), after the lead runs the demo path on the Windows laptop. Tag each promotion (`mvp`, `demo-h14`, …). `main` is what goes on stage and what Devpost links to.
- **Protect both `dev` and `main`** on GitHub: PRs only, no force-push. Only the lead promotes to `main`.
- **Hotfix during the demo window:** branch from `main`, fix, PR into `main`, then merge `main` back into `dev`.

### 5.2 Avoid conflicts by design
- **Lane-owned folders** (§2). If you must edit another lane's folder, tell them first.
- **Shared hot files** — `package.json`, `app/src/main/index.ts`, `app/src/shared/*` — change in tiny dedicated PRs, merged quickly.
- **Mocks first:** each lane works against stubs of the others' contracts (placeholder SDF dog, fake window list, fake joystick events) so nobody waits.

### 5.3 Integration checkpoints
At **hours 3, 6, 10, 14, 18** (and feature freeze): everyone merges into `dev`, the lead pulls `dev` on the Windows laptop and runs the demo path; teammate 3 does the QA pass. If it holds, **promote `dev` → `main` and tag it** (`mvp`, `demo-h14`, …) so there's always a known-good build for the stage. Fix integration breaks before starting new work.

### 5.4 Claude Code in parallel
- **One Claude Code session per dev, per branch.** Two sessions on one machine → separate **git worktrees**, never two sessions in one checkout.
- **Plan per lane, not per tiny feature:** one `writing-plans` plan per lane milestone (`docs/plans/`), executed inline with `executing-plans`.
- **Keep subagents rare** — they cost time and tokens; use them for reviews and wide searches, not routine coding.
- **Journal at hand-offs** (sleep shifts, lane swaps) so the next person — or the next session — can resume cold.

### 5.5 Repo hygiene
- `.env` gitignored, `.env.example` committed; run a quick secret scan before the repo goes public.
- `.gitattributes` with `* text=auto eol=lf` (Windows + Mac + WSL).
- Never commit `node_modules`, Python venvs, or build output.
- Keep assets small (compressed sounds, one photo, JSON dog file) — no Git LFS needed.

### 5.6 Testing policy for a 24 h build (replaces ECC's "TDD mandatory, 80% coverage")
- **Test the pure logic that breaks silently:** bounce prediction, SDF maths, needs model, gait phase timing, serial protocol parser, fitting loss. Fast Vitest/pytest unit tests — write them alongside the code (test-first where it's natural).
- **Don't unit-test visuals, shaders or feel** — verify those by eye on the demo laptop at each checkpoint.
- **The real end-to-end test is the demo path**, run on Windows at every checkpoint.
- No coverage target.

### 5.7 First hour checklist
1. Lead creates the GitHub repo with `main` and `dev`, protects both, adds collaborators.
2. Scaffold: electron-vite TypeScript app, `pipeline/` venv, `hardware/arduino/`, `.gitattributes`, `.env.example`, `CLAUDE.md`.
3. Together: write the contracts in `app/src/shared/` with stub implementations (§3).
4. Import the perennial tooling (§4.1) and path-scoped rules (§4.2).
5. Each dev branches off `dev` for their lane's hour 0–3 spike. Teammate 3 starts the Gemini views in AI Studio right away — it's on the critical path.
