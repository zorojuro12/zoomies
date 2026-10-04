# Getting Started — read this before you start

For **Ansh, Daniel and Abel**. Do sections 1–5 once, then use section 6 every time you work.
**Submission deadline: Sun Oct 4, 12:00 pm PDT.**

---

## 1. Read first (10 minutes)

1. [`journal/`](journal/) — the latest entries catch you up on every decision so far.
2. [`CLAUDE.md`](CLAUDE.md) — the rules everyone follows (lanes, contracts, git, testing).
3. [`docs/plans/00-shared.md`](docs/plans/00-shared.md) — phases, contracts, who needs what from whom, checkpoints.
4. **Your lane plan:** [`lane-a-ansh.md`](docs/plans/lane-a-ansh.md) · [`lane-b-daniel.md`](docs/plans/lane-b-daniel.md) · [`lane-c-abel.md`](docs/plans/lane-c-abel.md)
5. Background when you need it: [PRD](docs/specs/2026-10-03-zoomies-prd.md) · [tech stack](docs/tech-stack.md)

## 2. Install the tools

| Tool | Who | Check it works |
|---|---|---|
| Git | everyone | `git --version` |
| Node.js **LTS** (22 or 24) | everyone | `node -v` · `npm -v` |
| Python **3.11+** | Daniel (pipeline) | `python3 --version` |
| Arduino IDE 2 | Abel | opens, sees the board on USB |
| GitHub Desktop (optional) | Abel | — |
| Claude Code | everyone | `claude --version` |

**Windows (Ansh — the demo machine):**
- Install Node **for Windows** (installer from nodejs.org, or `nvm-windows`). The app must run as a native Windows app; WSL can't show an overlay over Windows apps.
- Native modules we'll add in P1 (window list, input hooks, serial) may need **Visual Studio Build Tools → "Desktop development with C++"** if no prebuilt binary exists. Install it early if you have time.

**Mac (Daniel, Abel):**
- `xcode-select --install` (compiler tools for native modules).
- Node via the nodejs.org installer, `brew install node@22`, or `nvm`.

## 3. Get the code

Accept the GitHub invite first (check your email), then:

```bash
git clone https://github.com/zorojuro12/zoomies.git
cd zoomies
git checkout dev          # dev is where all work merges; never work on main
```

**Ansh on Windows:** clone into a normal Windows folder (e.g. `C:\dev\zoomies`) for running the app, separate from any WSL clone.

## 4. First run of the app

```bash
cd app
npm install               # run separately on every machine/OS — never copy node_modules
npm run dev               # opens a window with a placeholder dog — click to make it run there
```

If that window appears, you're set. Then check the rest once:

```bash
npm test                  # unit tests (Vitest) — should say 18 passed
npm run typecheck
npm run lint
```

**Tell the group chat whether `npm run dev` worked on your OS** — it's only been verified in WSL so far.

### Secrets
```bash
cp .env.example .env      # from the repo root; then paste your keys into .env
```
Never commit `.env`. The repo will be public for Devpost.

## 5. Per-person setup

**Ansh (Lane A)**
- Run the app on Windows (section 4).
- Trim `.claude/` and adapt the skills (done 2026-10-03), then send Abel the `.claude/` zip and his workflow guide.
- Lead the contracts session (`docs/plans/00-shared.md` §3) → branch `a/contracts`.

**Daniel (Lane B)**
```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
- Set up your own Claude workflow; the repo's shared `journal` skill is in `.claude/skills/journal/`.
- Your preview page already exists: with `npm run dev` running, open `/preview.html` on the dev server URL it prints (e.g. `http://localhost:5173/preview.html`) in a browser.

**Abel (Lane C)** — some of this doesn't need the code at all, so start it right away:
- ⚡ Open Huawei's Google Drive folder (link in the challenge brief); if there's a larger dog photo, save it as `assets/photo/dog.jpeg`.
- ⚡ Google AI Studio: generate the side/back views (`docs/plans/lane-c-abel.md` P1). Daniel is waiting on them.
- Sign up for ElevenLabs; ask the MLH desk about Gemini/ElevenLabs credits.
- Unzip Ansh's `.claude/` into the repo folder and read the workflow guide Ansh sends you; use Claude in **default permission mode**.
- Install the Arduino IDE and test each hardware part with the built-in examples.

**Someone, now:** create the project on **Devpost** and add all three teammates (track opt-ins happen there later).

## 6. Everyday commands

### Start a piece of work
```bash
git checkout dev
git pull
git checkout -b a/my-task        # a/ = Ansh, b/ = Daniel, c/ = Abel
```

### While working
```bash
git add <exact files>            # not "git add -A"
git commit -m "feat: what changed"
git fetch && git merge origin/dev   # pick up others' work — merge, don't rebase
git push -u origin a/my-task
```

### Finish
- Open a PR on GitHub **into `dev`** and choose **"Create a merge commit"** (not squash, not rebase).
- Post the PR link in the group chat.

### With Claude Code
```bash
cd zoomies
claude
```
First message: **"resume from the journal"**. At the end of a phase or before a break: **"write a journal entry"** (your name goes in the filename).

### Checkpoints (Ansh)
Everyone merges into `dev` → Ansh runs the demo path on Windows → Abel does QA → Ansh merges `dev` → `main` (merge commit) and tags it (`mvp`, `demo-p3`, `freeze`, `final`).

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` fails after pulling | `npm install` again (someone added a dependency) |
| Native module errors on Windows | Install VS Build Tools (C++); then `npm install` again |
| App works in WSL but not on Windows / vice versa | Expected — use separate clones and separate `npm install` per OS |
| Every file shows as changed | Line endings; `.gitattributes` handles it — `git add --renormalize .` once |
| Merge conflict in `app/src/shared/` | Stop and tell the others — contracts change only in small PRs |
| Stuck for 15+ minutes | Ask in the group chat |
