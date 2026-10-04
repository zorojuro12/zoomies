# 2026-10-03 — ansh — Kickoff: what we're building and how we'll work

**Status:** Planning done, no code yet. PRD v1.2 and the tech-stack/workflow doc are written; repo `zorojuro12/zoomies` exists (empty until the first commit).
**Decided:** Zoomies is an always-on desktop pet: an animated version of the photo's dog, built as a photo-fitted SDF body with a Gaussian-splat coat and animated in code (no 3D generator, no rigging, no Blender). See PRD §4.0 and §6.
**Spec:** Updated — PRD v1.2 (`docs/specs/2026-10-03-zoomies-prd.md`) is the source of truth; this entry only explains how we got there.
**Next:** Ansh writes the master `/impl-plan` (shared setup, contracts, each lane's milestones per checkpoint); then each lane writes its own phase 1 plan.
**Blocked on:** Nothing. Abel still needs to be added as a GitHub collaborator; `main` and `dev` still need branch protection.
**Touches:** `docs/specs/2026-10-03-zoomies-prd.md`, `docs/tech-stack.md`, `.claude/skills/journal/`, `.gitignore`

---

## Start here (everyone)
1. Read **`docs/specs/2026-10-03-zoomies-prd.md`** — what we're building, Must/Should/Could, risks, timeline. (Web version: https://claude.ai/artifact/Cyv75ePrJWF7CuJcQgR4zv — shared by Ansh.)
2. Read **`docs/tech-stack.md`** — stack, repo layout, your lane, contracts, branching, Claude tooling.
3. Read the master plan in `docs/plans/` once it lands.

**Hackathon:** StormHacks 2026, Huawei Challenge #2 "Fetching Reality". **Submission deadline Sun Oct 4, 12:00 pm PDT** (feature freeze ~9 am). Devpost needs a project link and a ≤3 min demo video.

## Who does what
| Who | Machine | Lane | Claude workflow |
|---|---|---|---|
| **Ansh** | Windows (demo laptop) | **A — Desktop shell, world & integration:** Electron overlay, click-through, Windows OS layer + Mac stub, serial code, ball physics + fetch, behaviour/needs model, audio playback, ElevenLabs/Gemini runtime. Merges into `dev`, promotes to `main`. | Ansh's |
| **Daniel** | Mac | **B — The dog:** pipeline (cut-out → landmarks → fit → colours), SDF body + splat coat rendering, skeleton/poses/gait, pose & shape editor | His own (personal `~/.claude/`) |
| **Abel** | Mac | **C — Content, hardware & demo:** Gemini side/back views + landmarks (hour 0, critical path), ElevenLabs sound library, Arduino sketch + wiring, likeness/pose tuning, QA, demo video, Devpost, pitch | Ansh's |

## Decisions Made
- **Concept: an always-on desktop overlay pet** that lives on your real desktop — reason: the desktop *is* the environment, giving natural "environmental awareness" (windows as terrain, reacting to typing/idle) and a strong efficiency story. PRD §1, §4.
- **Hero interaction: joystick slingshot fetch** — the ball bounces off screen edges, the taskbar and windows; the dog predicts the landing and can catch mid-air. Reason: the brief names fetch; a joystick is reliable and precise on stage. PRD §4.1.
- **Look: stylised but faithful (animated, not photoreal)** — reason: cheaper per frame, forgiving of small errors, and cartoon motion reads as more alive; the aesthetics pillar is half "reconstructed dog", half "fluidity". PRD §4.0.
- **Dog = photo-fitted SDF body (~20 shapes) + Gaussian-splat coat (~5–10k splats)** — both techniques Huawei named, no triangle mesh, ~1–3 ms/frame (est.). PRD §6.
- **Animation in code: pose library + procedural gait + secondary motion**, tuned with an in-app pose/shape editor — reason: adapts to any jump/window, no clips or rigs needed, nobody on the team knows Blender. PRD §5 Must #4–5.
- **Platform: Windows-first Electron app; Mac teammates run a stub OS layer.** Ansh codes in WSL, pushes, and runs a separate Windows clone with Windows-native Node. Tech-stack §1, PRD §6.4.
- **Hardware (MLH rental — breadboard only, return it):** joystick, button, touch sensor, buzzer; accelerometer skipped. PRD §8.
- **Sponsor tracks:** Huawei #2 (primary), Best Hardware, Best Game, ElevenLabs (L1 Must), Gemini (G1 Must), Tiger Data (Could), Best Design maybe; TiDB future scope. PRD §9.
- **Scheduling rule:** do all Musts and Shoulds; Coulds if time allows, or immediately when cheap alongside related work. PRD §5.
- **Branching:** branch off `dev` as `<lane>/<task>` (`a/…`, `b/…`, `c/…`), PRs merge into `dev` with merge commits (no squash), Ansh promotes `dev` → `main` at checkpoints (hours 3, 6, 10, 14, 18) and tags it. Tech-stack §5.1.
- **Planning:** one master `/impl-plan` for everyone → each lane writes per-phase plans (Ansh with writing-plans, Daniel his own way; Abel mostly works from his checklist). Plan phase 1 in detail, later phases at each checkpoint.
- **Contracts first:** in hour 0–1, together, define the shared types in `app/src/shared/` (OS layer, dog file, dog controller, input events, serial protocol) with stubs, so lanes don't wait on each other. Tech-stack §3.
- **Repo `.claude/` is gitignored except the journal skill.** Personal tooling stays local; shared conventions go in a root `CLAUDE.md` (to be written).
- **Journal:** everyone uses this skill; one file per entry with your name in the filename; write at handoffs and checkpoints.

## What Didn't Work (approaches we considered and dropped)
- **Realistic Gaussian-splat dog from an image-to-3D generator (TRELLIS/Meshy/Tripo)** — dropped because it needs a quadruped rig (most auto-riggers are humans-only, nobody knows Blender), animating splats with a skeleton isn't standard, and it costs more per frame. TRELLIS survives only as an optional fitting target (Could).
- **Auto-rig services / scripted Blender / Blender MCP** — no longer needed; the skeleton lives in our code.
- **Accelerometer "real throw"** — dropped for the joystick: swing detection is noisy and varies per person; the accelerometer is only a Could ("shake to excite").
- **Running the overlay from WSL** — won't work; it must run as a native Windows app to sit over Windows apps.

## Open Questions / Blockers
- Do MLH provide Gemini / ElevenLabs credits?
- Does Huawei's Google Drive folder contain required assets, rules or a mandated photo?
- Splat coat: small custom pass or adapt an existing renderer? (decide in hours 0–3)
- How Abel gets Ansh's Claude tooling now that `.claude/` is gitignored (likely a one-time copy).
- Add Abel as collaborator; protect `main` and `dev`.

## Next Step
1. Ansh: first commit to `main`, create `dev`, push; protect branches; add Abel.
2. Ansh: master `/impl-plan` → review with the team.
3. Together (hour 0–1): scaffold + contracts.
4. Abel, immediately: start the Gemini side/back views of the Aussie in Google AI Studio — the dog pipeline depends on them.
5. Each lane: phase 1 plan → branch off `dev` → build to the hour-3 checkpoint (does the dog already read as *this* dog?).
