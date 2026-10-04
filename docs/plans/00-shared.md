# Plan 00 — Shared: setup, contracts, checkpoints, submission

**Read by:** everyone (Ansh, Daniel, Abel)
**Sources of truth:** `docs/specs/2026-10-03-zoomies-prd.md` (PRD v1.2) · `docs/tech-stack.md` · `journal/2026-10-03_1852_ansh_kickoff-decisions.md`
**Lane plans:** `lane-a-ansh.md` · `lane-b-daniel.md` · `lane-c-abel.md`
**Complexity:** Large (3 parallel lanes, one integration point)

This file holds only what crosses lanes: the setup we do together, the contracts everyone codes against, who needs what from whom, the checkpoint ritual, what to cut when we slip, and how we submit. Everything else lives in the lane plans.

---

## 1. Phases

Phases are relative — each ends at a checkpoint (§5). Don't start the next phase's features until the checkpoint passes.

| Phase | Goal | Ends with |
|---|---|---|
| **P0 — Setup & contracts** | Repo scaffolded, contracts + stubs merged, everyone can run the app | **CP0:** app launches as an overlay with a placeholder dog on every machine |
| **P1 — Spikes** | Prove the risky parts: does the SDF dog read as *this* dog? does the Windows overlay work? | **CP1 (go / no-go):** likeness side-by-side + click-through + window list on Windows |
| **P2 — MVP** | All Musts working end to end | **CP2:** demo path runs on Windows → promote → tag `mvp` |
| **P3 — Shoulds** | Hardware, window terrain, catch, fitting optimiser, voice, G2/G3 | **CP3:** promote → tag `demo-p3` |
| **P4 — Polish** | Opening, x-ray, motion polish, cheap Coulds | **CP4: feature freeze** → promote → tag `freeze` |
| **P5 — Submission** | Bug fixes only, video, Devpost, rehearsal | Submitted (tag `final`) |

---

## 2. P0 — Setup (together)

### 2.0 The photo — Abel (first thing)
- [ ] Open Huawei's Google Drive folder (link in the challenge brief), download the dog photo(s) and the brief, note any extra rules or assets.
- [ ] Put the photo at **`assets/photo/dog.jpeg`** (keep the original resolution) — it's the input to Lane B's whole pipeline and to Abel's Gemini views.

### 2.1 Repo & GitHub — Ansh
- [ ] Add Abel as collaborator; set `dev` as the default branch.
- [ ] Protect `main` and `dev`: PRs required, no force-push. Only Ansh promotes to `main`.

### 2.2 Scaffold — Ansh (one PR: `a/scaffold`)
- [ ] `app/` — electron-vite TypeScript template (main / preload / renderer), Three.js, Vitest, ESLint + Prettier (defaults).
- [ ] `pipeline/` — `requirements.txt` (numpy, scipy, pillow, rembg, google-genai, pytest), README with venv steps.
- [ ] `hardware/arduino/zoomies_controller/` — empty sketch folder.
- [ ] `scripts/` — empty (Abel's sound script goes here).
- [ ] `assets/` — `photo/dog.jpeg` (the Huawei photo), `views/`, `dog/`, `sounds/`.
- [ ] Root files: `.gitattributes` (`* text=auto eol=lf`), `.env.example` (`GEMINI_API_KEY=`, `ELEVENLABS_API_KEY=`, `TIGER_DATABASE_URL=`), extend `.gitignore` (`node_modules/`, `out/`, `dist/`, `.env`, `.venv/`, `__pycache__/`, `*.log`).
- [ ] Root `README.md`: what Zoomies is, how to run on Windows / Mac, link to PRD.
- [ ] Root `CLAUDE.md` (shared conventions for every workflow): links to PRD/tech-stack/plans/journal, lane folders, branch rules, contracts rule, "never commit keys", hackathon test policy. Keep it under ~60 lines.
- **Validate:** `npm install && npm run dev` opens a window on Windows and Mac; `npm test` runs.

### 2.3 Claude tooling
- [ ] **Ansh:** trim `.claude/` to Tier 1 + path-scoped Tier 2 (tech-stack §4); add `rules/hackathon-workflow.md`; adapt `finishing-a-development-branch`, `executing-plans` and `/pr` to "PR into `dev`". Run `/context` to check the budget.
- [ ] **Ansh → Abel:** zip the trimmed `.claude/` and send it; Abel unzips into his clone (it's gitignored).
- [ ] **Daniel:** set up his own workflow; read the kickoff journal + `CLAUDE.md`. Add the journal skill to his flow (already in the repo).

### 2.4 Contracts + stubs — pre-drafted, then reviewed together
**Pre-drafted 2026-10-03 and merged into `dev`** (`a/contracts`): every contract in §3 as code in `app/src/shared/`, plus the stubs. The session with all three is now a ~20-minute **review**: read the files, agree or change them via small PRs. Then everyone branches for P1.

| Stub | Where |
|---|---|
| `StubOsLayer` | `app/src/main/os/stub-os-layer.ts` |
| `PlaceholderDog` (DogView + DogController) | `app/src/renderer/dog/placeholder/placeholder-dog.ts` |
| Placeholder dog file (dog-shaped, 12 shapes, 6 poses) | `assets/dog/placeholder.dog.json` |
| `StubAudio` | `app/src/renderer/audio/stub-audio.ts` |
| App host showing the placeholder dog | `app/src/renderer/main.ts` (+ `host/scene.ts`) |
| Dog preview page (Lane B harness) | `app/src/renderer/preview.html` → open `/preview.html` from the `npm run dev` server in a browser |

---

## 3. Contracts (`app/src/shared/`)

Changing anything here = a small PR everyone sees. Inside a lane, change freely.

> **The code in `app/src/shared/` is now the source of truth.** The snippets below are the original design. Differences in the code: `geometry.ts` holds `Point`/`Rect`/`Facing`/`Vec3`/`Quat`; `SdfShape` gained a `color`; the **dog-local frame** is defined in `dog-file.ts` (pixels, origin between the paws, +x forward, **y down**, +z toward the viewer); `dog-file.ts` has `validateDogFile()` and a JSON Schema twin `dog-file.schema.json` for the pipeline; `serial.ts` includes the line parser/formatter (tested); `audio.ts` has the `SOUND_NAMES` list and an `AudioPlayer` interface.

### 3.1 Coordinates (decided once, used everywhere)
- **World units = desktop pixels** (CSS/DIP px), origin at the top-left of the primary display, **x right, y down** — the same space as window rects and the cursor.
- The renderer uses an **orthographic camera** mapped to those pixels; **z points toward the viewer** and is used only for 3D depth inside the dog and for ordering (behind/in front of windows).
- The dog's **position** is the point between its paws on the ground; **facing** is `-1 | 1` (left/right) plus a continuous yaw for turns.

### 3.2 `os.ts` — OS layer (Ansh implements; everyone consumes)
```ts
export interface WindowRect { id: string; title: string; x: number; y: number; w: number; h: number; z: number; /* 0 = topmost */ minimized: boolean }
export type ActivityEvent =
  | { kind: 'typing'; keysPerSec: number; backspaceRatio: number }
  | { kind: 'mouse'; x: number; y: number; speed: number }
  | { kind: 'idle'; seconds: number };
export interface OsLayer {
  getWindows(): Promise<WindowRect[]>;          // visible, non-minimized, z-ordered
  getWorkArea(): { x: number; y: number; w: number; h: number }; // excludes taskbar
  getTaskbarRect(): { x: number; y: number; w: number; h: number } | null;
  onActivity(cb: (e: ActivityEvent) => void): () => void;         // timing only, never key contents
  setClickThrough(enabled: boolean): void;
}
```
**Stub (`StubOsLayer`):** two fake windows, a bottom taskbar, synthetic typing/idle events on a timer. Used on Mac.

### 3.3 `dog-file.ts` — dog asset (Daniel owns; pipeline writes, renderer reads)
```ts
export type ShapeKind = 'sphere' | 'capsule' | 'ellipsoid' | 'roundCone';
export interface Bone { name: string; parent: string | null; restPos: [number, number, number]; restRot: [number, number, number, number] }
export interface SdfShape { id: string; kind: ShapeKind; bone: string; params: number[]; offset: [number, number, number]; blend: number /* smooth-min k */ }
export interface CoatSplat { shape: string; pos: [number, number, number]; scale: [number, number, number]; color: [number, number, number]; opacity: number }
export type Pose = Record<string /* bone */, [number, number, number, number] /* quat */>;
export interface DogFile {
  version: 1; name: string; sourcePhoto: string; heightPx: number;
  bones: Bone[]; shapes: SdfShape[]; coat: CoatSplat[]; poses: Record<string, Pose>;
}
```
Plus a JSON Schema twin (`dog-file.schema.json`) the Python pipeline validates against.
**Stub:** `assets/dog/placeholder.dog.json` — a **roughly dog-shaped** SDF dog (head, snout, ears, body, four legs, tail from ~12 primitives) with stand/sit/lie/sleep poses, no coat. Worth the extra ~20 minutes: fetch and behaviour look right from day one and Daniel's real dog is a drop-in upgrade.

### 3.4 `dog-controller.ts` — what behaviour can ask the dog to do (Daniel implements; Ansh calls)
```ts
export type PoseName = 'stand' | 'sit' | 'lie' | 'sleep' | 'playBow' | 'headTilt' | 'scratch' | 'stretch' | 'pant';
export interface DogState { x: number; y: number; facing: -1 | 1; pose: PoseName | 'moving' | 'airborne'; busy: boolean }
export interface DogController {
  setPose(pose: PoseName, opts?: { durationMs?: number }): Promise<void>;
  moveTo(x: number, y: number, speed: 'walk' | 'trot' | 'run'): Promise<void>;   // along the current surface
  jumpTo(x: number, y: number, opts?: { apexPx?: number }): Promise<void>;        // physics arc, lands on target
  lookAt(target: { x: number; y: number } | null): void;                          // null = idle look-around
  setLayer(params: { tailWag?: number; earPerk?: number; breathing?: number }): void;
  attachBall(attached: boolean): void;                                           // ball in mouth
  getState(): DogState;
  onEvent(cb: (e: { kind: 'landed' | 'arrived' | 'poseDone' }) => void): () => void;
}
```
**Stub (`PlaceholderDog`):** moves the placeholder dog with simple tweens and pose snaps so Lane A can build fetch/behaviour on day one.

### 3.5 `dog-view.ts` — how the dog plugs into the render loop (Daniel implements; Ansh hosts)
```ts
export interface DogView {
  init(ctx: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera }, dog: DogFile): Promise<void>;
  update(dtMs: number): void;          // animation + skinning of shapes/splats
  getBounds(): { x: number; y: number; w: number; h: number }; // screen rect, used for region rendering + click hit-test
  hitTest(x: number, y: number): boolean;
  setDebugView(mode: 'normal' | 'landmarks' | 'shapes' | 'coat'): void; // x-ray
}
```

### 3.6 `input.ts` — player input (Ansh produces from mouse + serial; behaviour consumes)
```ts
export type InputEvent =
  | { kind: 'aim'; angle: number; power: number }      // while pulling back (0..1)
  | { kind: 'launch'; angle: number; power: number }
  | { kind: 'pet'; source: 'touch' | 'mouse' }
  | { kind: 'call' }
  | { kind: 'pushToTalk'; state: 'start' | 'stop' }
  | { kind: 'command'; text: string };                 // from STT / G3 / buttons
```

### 3.7 Serial protocol (Abel's sketch ↔ Ansh's reader)
- 115200 baud, newline-terminated ASCII lines.
- **Arduino → app:** `J:<x>,<y>` (0–1023, ~30 Hz while moved) · `B:<0|1>` (button) · `T:<0|1>` (touch) · `HELLO:zoomies:1` on boot.
- **App → Arduino:** `Z:<freqHz>,<ms>` (buzzer tone) · `S:squeak` · `S:chirp` (preset sounds).
- Anything unparseable is ignored (logged once).

### 3.8 `ipc.ts` and `audio.ts`
- `ipc.ts`: one map of channel names → payload types (`os:windows`, `os:activity`, `input:event`, `serial:status`, `services:*`). Nothing else uses raw strings.
- `audio.ts`: `playSound(name: SoundName, opts?: { pan?: number; gain?: number })`, `SoundName` = the file stems in `assets/sounds/` (e.g. `bark_happy_1`). **Abel owns this module** (playback, variants, panning) and the sound list defines the names; Ansh calls it from behaviour. Stub: a no-op that logs the sound name.

---

### 3.9 `landmarks.ts` — Abel produces, Daniel consumes
`assets/views/landmarks.json`: per view (`front` = the photo, `side_sit`, `side_stand`, `back`), a map of landmark name → `[x, y]` pixel coordinates (origin top-left), plus `image_size` per view. Only points visible in that view. The 28 names are `LANDMARK_NAMES` in `app/src/shared/landmarks.ts`.

### 3.10 `assets.ts` — how the app loads files from `assets/`
The repo-root `assets/` folder is the renderer's public directory (`app/electron.vite.config.ts`), copied into the build. **Always load with `assetUrl('<path under assets/>')`** (e.g. `assetUrl('dog/aussie.dog.json')` → `./dog/aussie.dog.json`) so it works in `npm run dev` and in the packaged app. Common paths are in `ASSETS`.

---

## 4. Dependency map

| Provider → Consumer | What | Needed by |
|---|---|---|
| Ansh → all | Scaffold + contracts + stubs merged | Start of P1 |
| Abel → Daniel | `side_sit`, `side_stand` and `back` views (`assets/views/`) and `landmarks.json` | Early P1 (the fitting work starts on it) |
| Ansh → Daniel | Overlay window + render loop hosting `DogView` | Mid P1 |
| Daniel → Ansh | Real `DogController` + `DogView` replacing the placeholder (fitted body, poses, walk) | End P2 (placeholder used until then) |
| Daniel → Abel | Pose & shape editor in the app | End P2 (Abel tunes likeness in P3) |
| Abel → Ansh | Audio module (`renderer/audio/`, `playSound` per §3.8) + sound library in `assets/sounds/` | Mid P2 |
| Abel → Ansh | Arduino sketch speaking §3.7 + wired breadboard | Start P3 |
| Ansh → Abel | Serial reader + buzzer commands, so Abel can test the controller end to end | Start P3 |
| Ansh (integrator) → all | `dev` running on the Windows laptop at every checkpoint | Each checkpoint |

If a dependency is late, the consumer keeps using the stub — nobody waits idle.

---

## 5. Checkpoint ritual (end of every phase)

1. Everyone finishes or parks their branch and **PRs into `dev`** (merge commit).
2. **Ansh** pulls `dev` on the Windows laptop, `npm install`, runs the **demo path** (below).
3. **Abel** does the QA pass and logs issues (GitHub issues or `docs/qa.md`).
4. If the demo path holds: **Ansh promotes `dev` → `main` and tags it.** If not: fix integration breaks first; no new features until it holds.
5. Each person writes a short **journal entry** (their name in the filename) and their **next phase plan**.

**Demo path** (grows each phase): launch → dog appears → follows cursor → (P2+) throw ball with mouse → dog fetches → idle → sleeps → wake → (P3+) joystick throw + touch pet + squeak → drag window it's on → (P4+) step-out-of-photo opening + x-ray.

### Go / no-go criteria
| Checkpoint | Must be true |
|---|---|
| **CP0** | App runs on all three machines; placeholder dog visible in the overlay |
| **CP1** | Side by side with the photo, the team agrees the SDF dog reads as *this* Aussie (or knows exactly what to tune); click-through + window list work on Windows. If likeness fails → use landmarks + sliders only (PRD §7) and move on |
| **CP2** | All Musts in PRD §5 work on Windows, ≥ 60 FPS active, FPS overlay shows the sleep drop |
| **CP3** | Demo path incl. hardware runs 3× without restart |
| **CP4** | Feature freeze — nothing new after this |

---

## 6. If we slip — cut in this order
1. Coulds not already started (PRD #22–32).
2. Gemini G4, ElevenLabs L3, Tiger Data (already Coulds).
3. Gemini G2 personality → fixed default profile.
4. Silhouette optimiser → landmarks + slider tuning.
5. Gemini G3 → fixed command list (ElevenLabs L2 still works).
6. Window terrain → screen edges + taskbar only.
7. Splat coat → SDF-only with projected colours.

**Never cut:** the dog reading as *this* dog, mouse fetch, idle/sleep, FPS overlay, the demo video.

---

## 7. P5 — Submission checklist
- [ ] Final bug fixes only; promote and tag `final`.
- [ ] Secret scan before the repo is public (no keys in history); `.env` never committed.
- [ ] Demo video ≤ 3 min (Abel leads): photo → step-out → fetch with joystick → windows → work companion → sleep FPS drop → x-ray technique reveal.
- [ ] Devpost: description, tech, screenshots, repo link, video link; **opt in to each track** (Huawei #2, Best Hardware, Best Game, ElevenLabs, Gemini, + Tiger Data / Best Design if shipped).
- [ ] Rehearse the live demo 3× on the Windows laptop; mouse fallback ready.
- [ ] Photograph the wiring, then return the MLH Arduino kit complete.

---

## 8. Git conventions (summary — full version in tech-stack §5)
- Branch off `dev` as `a/…`, `b/…`, `c/…`; small PRs; **merge commits** into `dev` (no squash, no rebase-merge); merge `dev` into your branch before opening a PR.
- Merge into `dev` at least every few hours — don't sit on a branch through a checkpoint.
- Contracts (`app/src/shared/`) and root files change only in tiny dedicated PRs.
- Only Ansh promotes `dev` → `main`, via a PR with a merge commit.
- GitHub repo settings: allow **merge commits only** (turn off squash and rebase merging) so nobody picks the wrong button.

## 9. Top cross-lane risks
| Risk | Mitigation |
|---|---|
| Contracts wrong once real code exists | Change via a tiny PR + tell the others; stubs keep everyone moving |
| Gemini views late or inconsistent → Daniel blocked | Daniel starts from the original photo + hand-placed landmarks; swaps in views when ready |
| Integration only happens at the end | Checkpoint ritual every phase; Windows run every time |
| One lane overloaded (Lane A is heaviest) | Hand L2/G2/G3 to Daniel once the dog is stable |

## Acceptance (for this shared plan)
- [ ] P0 complete: scaffold + contracts + stubs on `dev`, runs on all three machines.
- [ ] Each lane has its phase plan derived from its lane file.
- [ ] Every checkpoint run with the ritual; `mvp`, `demo-p3`, `freeze`, `final` tags exist by the end.
