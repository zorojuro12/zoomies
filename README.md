# Zoomies

One photo of a dog becomes an always-on desktop pet: an animated version of *that* dog
(photo-fitted SDF body + Gaussian-splat coat) that roams over your windows, keeps you
company while you work, and plays joystick-launched fetch across your screen.

StormHacks 2026 · Huawei Challenge #2 "Fetching Reality" · Ansh, Daniel, Abel

- **New to the repo? Start with [`GETTING_STARTED.md`](GETTING_STARTED.md).**
- What we're building: [`docs/specs/2026-10-03-zoomies-prd.md`](docs/specs/2026-10-03-zoomies-prd.md)
- Stack and team workflow: [`docs/tech-stack.md`](docs/tech-stack.md)
- Plans: [`docs/plans/`](docs/plans/) · Session journal: [`journal/`](journal/)

## Run the app

Requires Node.js LTS. **On Windows, use Windows-native Node in a Windows clone** (not WSL) —
the overlay only works as a native Windows app.

```bash
cd app
npm install
npm run dev      # launch with hot reload
npm test         # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build    # typecheck + production build
```

Copy `.env.example` to `.env` and add keys before using Gemini/ElevenLabs features.

## Repo layout

| Path | Contents | Lane |
|---|---|---|
| `app/` | Electron app (TypeScript, Three.js) | all |
| `app/src/shared/` | Contracts between lanes | all |
| `pipeline/` | Python build-time dog reconstruction | B |
| `hardware/arduino/` | Controller sketch | C |
| `scripts/` | Helper tools (landmark picker, sound generation) | C |
| `assets/` | Photo, Gemini views, dog files, sounds | B / C |
| `docs/`, `journal/` | PRD, stack, plans, session journal | all |

## Branch rules

`main` = demo-ready builds (only Ansh merges into it, at checkpoints) · `dev` = where all work merges · your work = short-lived branches off `dev`.

### Before making a branch
1. Commit or stash anything unfinished on your current branch.
2. Start from the latest `dev`:
   ```bash
   git checkout dev
   git pull
   ```
3. Create the branch with your lane prefix — `a/` Ansh, `b/` Daniel, `c/` Abel — and a short task name:
   ```bash
   git checkout -b a/overlay-window
   ```
4. One task or phase per branch. Plan to merge it within a few hours — long-lived branches are where conflicts come from.

### While working
- Commit small and often: `git add <exact files>` (not `-A`), message `type: what changed` (`feat`, `fix`, `docs`, `chore`, `test`).
- **Only edit your own lane's folders and plans.** Plans: you edit only `docs/plans/lane-<you>-*.md` and your own phase plans (`a-p*`, `b-p*`, `c-p*`). Then your branch's version of your plan always wins without conflicts.
- When someone says they merged into `dev`, pull it in: `git fetch && git merge origin/dev`.
- Shared files — `app/src/shared/` (contracts), `docs/plans/00-shared.md`, `CLAUDE.md`, `package.json` — change only in a **small separate PR**, merge it quickly, and tell the group chat.

### Before merging a branch
1. **Bring in the latest `dev`** — merge, don't rebase:
   ```bash
   git fetch
   git merge origin/dev
   ```
2. **Resolve conflicts in your branch**, not on `dev`:
   - **Your own plan/lane files:** keep your version — `git checkout --ours <file>`, then `git add <file>` — but first look at what `dev` changed (`git diff MERGE_HEAD -- <file>`) in case it matters.
   - **Shared files and other people's files:** combine both sides by hand; ask the owner if unsure. Never blindly keep yours.
   - Finish with `git commit`.
3. **Re-run the checks** after the merge: `cd app && npm test && npm run typecheck` (and `cd pipeline && pytest` if you touched it).
4. **Windows-only changes** (overlay, click-through, window list, input hooks, serial) must have run on Windows.
5. **No secrets:** `.env` isn't staged, no keys in code.
6. Push: `git push -u origin <your-branch>`.
7. Open a PR **into `dev`** on GitHub and merge with **"Create a merge commit"** (not squash, not rebase).
8. If GitHub says *"This branch is out-of-date"*, click **Update branch** (or repeat steps 1–3).

### After merging
- Post in the group chat: what merged, and whether it touched shared files.
- Delete the branch (GitHub can do it automatically), then `git checkout dev && git pull` before the next task.
- End of a phase or before a break: write a journal entry (`journal/`, your name in the filename).
