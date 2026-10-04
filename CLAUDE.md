# Zoomies — Project Conventions

## Project Overview

Zoomies is a StormHacks 2026 entry for Huawei Challenge #2 "Fetching Reality":
one photo of a dog becomes an always-on desktop pet. It's an animated version of
*that* dog — a photo-fitted SDF body with a Gaussian-splat coat, animated in
code — that roams over your real windows, keeps you company while you work, and
plays joystick-launched fetch across the screen. Windows-first Electron app.
**Submission deadline: Sun Oct 4, 12:00 pm PDT.**

**Source of truth, in order:** `docs/specs/2026-10-03-zoomies-prd.md` (what) →
`docs/tech-stack.md` (with what) → `docs/plans/00-shared.md` (contracts,
checkpoints) → your lane plan in `docs/plans/` → latest entries in `journal/`.
When they disagree, the earlier one wins — and fix the later one.

## Team and lanes

| Lane | Owner | Owns (folders) |
|---|---|---|
| A — shell, world, integration | Ansh | `app/src/main/`, `app/src/preload/`, renderer host + `world/` + `behaviour/` |
| B — the dog | Daniel | `pipeline/`, `app/src/renderer/dog/`, pose/shape editor, `assets/dog/` |
| C — content, hardware, demo | Abel | `assets/photo/`, `assets/views/`, `assets/sounds/`, `scripts/`, `app/src/renderer/audio/`, `hardware/arduino/` |

**Don't edit another lane's folders without telling its owner first.**

## Critical rules

- **Contracts:** `app/src/shared/` is the seam between lanes. Change it only in a
  small dedicated PR that everyone sees. Inside your lane, change freely.
- **Coordinates:** world units are desktop pixels (DIP), origin top-left of the
  primary display, x right, **y down**; orthographic camera; z only for depth.
- **Never commit secrets.** Keys live in `.env` (gitignored); `.env.example` lists
  the names. The repo goes public for Devpost.
- **Windows is the demo target.** Anything touching the overlay, click-through,
  window list, input hooks or serial is only verified when it runs on Windows —
  a pass on a Mac or in WSL doesn't count.
- **Hot paths don't allocate.** In the render loop, physics and per-frame
  animation, reuse preallocated vectors/arrays and mutate them in place. This
  overrides the generic "always immutable / spread to update" guidance in the
  ECC TypeScript rules — per-frame allocation causes GC stutter. Immutability
  still applies to state, config and contract data.
- **Nothing slow in the frame loop:** network/AI calls (ElevenLabs, Gemini, Tiger
  Data) and file I/O are async and never awaited inside a frame.
- **Privacy:** activity tracking records timing only (rate, bursts, idle) — never
  key contents. Mic only while push-to-talk is held. Screen capture is opt-in.
- **Every hardware action has a mouse equivalent.** The demo must survive a
  loose wire.

## Build and test

All commands run from `app/`. Verified in WSL (Linux) at scaffold time:
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. **`npm run dev`
still needs its first run on Windows and on a Mac** — update this line once done.

| Command | Does |
|---|---|
| `npm install` | Install deps (run separately in each OS clone — never share `node_modules`) |
| `npm run dev` | Launch the app with hot reload |
| `npm test` / `npm run test:watch` | Vitest — `src/**/*.test.ts`, co-located with the code |
| `npm run typecheck` | `tsc` for main/preload (`tsconfig.node.json`) and renderer (`tsconfig.web.json`) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run build` | Typecheck + production build to `out/` |

Pipeline (`pipeline/`): Python 3.11+ venv, `pip install -r requirements.txt`, `pytest`.

## File structure

| Path | Contents |
|---|---|
| `app/src/main/` | Electron main process (`index.ts`); `os/`, `hardware/`, `services/` for Lane A |
| `app/src/preload/` | IPC bridge exposed to the renderer |
| `app/src/renderer/` | `index.html` + `main.ts` (render host); `dog/` (B), `world/`, `behaviour/` (A), `audio/` (C), `ui/` |
| `app/src/shared/` | Contracts and constants imported as `@shared/...` by main, preload and renderer |
| `pipeline/` | Python reconstruction pipeline (B) |
| `hardware/arduino/zoomies_controller/` | Controller sketch (C) |
| `scripts/` | Helper tools (C) |
| `assets/` | `photo/`, `views/`, `dog/`, `sounds/` |
| `docs/`, `journal/` | PRD, stack, plans, workflow guide, session journal |

## Git

- Branch off `dev` as `<lane>/<task>`: `a/…`, `b/…`, `c/…`. Never commit directly
  to `dev` or `main`.
- PR into `dev` with a **merge commit** (no squash, no rebase-merge). Before
  opening a PR, `git fetch && git merge origin/dev` into your branch; don't rebase
  branches others may have pulled.
- Commits: `type: description` (feat, fix, refactor, docs, test, chore, perf).
  `git add` exact paths, not `-A`.
- **Plans have one owner:** only edit `docs/plans/lane-<you>-*.md` and your own phase plans. On a merge conflict in your own plan, keep your branch's version (after checking what `dev` changed); in shared files, combine both sides.
- Only Ansh promotes `dev` → `main`, at checkpoints, and tags it.

## Testing (hackathon policy)

- Unit-test the pure logic that fails silently: SDF maths, physics and bounce
  prediction, needs model, gait/IK, serial parser, fitting loss. Vitest
  (`app/`), pytest (`pipeline/`). Test-first where it's natural.
- Visuals, shaders and "feel" are checked by eye on Windows at each checkpoint.
- No coverage target. The real end-to-end test is the demo path
  (`docs/plans/00-shared.md` §5).
- Check that a new test actually ran (it shows in the run's count) — a name
  filter that matches nothing is a false green.

## Journal

Use the `journal` skill (`.claude/skills/journal/`). One file per entry with
your name in the filename. Write one at every checkpoint and handoff; start a
new session with "resume from the journal".

## Workflow

Each person keeps their own workflow guide locally (not in the repo); Ansh and
Abel share Ansh's Claude Code setup, Daniel uses his own — all within the rules
above.
