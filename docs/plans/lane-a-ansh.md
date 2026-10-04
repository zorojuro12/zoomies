# Lane A — Ansh: desktop shell, world & integration

**Owner:** Ansh · **Machine:** Windows (demo laptop) · **Branch prefix:** `a/`
**Workflow:** writing-plans per phase from this file → executing-plans → finishing-a-development-branch → PR into `dev` (merge commit)
**Read first:** `00-shared.md` (contracts §3, dependencies §4, checkpoints §5) · PRD v1.2 · tech-stack §1.1
**Also the integrator:** merges into `dev`, runs the demo path on Windows, promotes `dev` → `main`, tags.

---

## What this lane owns

| Folder | Contents |
|---|---|
| `app/src/main/` | Electron main process: overlay window, IPC, app lifecycle |
| `app/src/main/os/` | `OsLayer` — Windows implementation + `StubOsLayer` for Mac |
| `app/src/main/hardware/` | Serial port, protocol parser, buzzer commands |
| `app/src/main/services/` | ElevenLabs (L2 STT, L3 TTS), Gemini (G2, G3, G4), Tiger Data |
| `app/src/preload/` | Typed IPC bridge |
| `app/src/renderer/` (host) | Three.js renderer, orthographic camera, render loop, region rendering, FPS overlay, input (mouse slingshot) |
| `app/src/renderer/world/` | SDF colliders (screen edges, taskbar, windows), ball physics, bounce prediction |
| `app/src/renderer/behaviour/` | Needs model, state machine, fetch sequence, desktop reactions, steering between platforms |
| `app/src/shared/` | Contracts (shared ownership — Ansh merges) |

**Doesn't own:** `renderer/dog/` + the pose/shape editor (Daniel), `pipeline/` (Daniel), `renderer/audio/` + `hardware/arduino/` + `assets/sounds/` + `scripts/` (Abel).

## Needs / provides

| | From / to | What | When |
|---|---|---|---|
| **Provides** | everyone | Scaffold, contracts + stubs | P0 |
| **Provides** | Daniel | Overlay + render loop hosting `DogView` | Mid P1 |
| **Provides** | Abel | Serial reader + buzzer commands | Start P3 |
| **Provides** | everyone | `dev` running on Windows at each checkpoint | Every checkpoint |
| **Needs** | Daniel | Real `DogController` + `DogView` | End P2 (use `PlaceholderDog` until then) |
| **Needs** | Abel | Audio module (`playSound` per contract §3.8) + sounds in `assets/sounds/` | Mid P2 (silent no-op until then) |
| **Needs** | Abel | Arduino sketch + wired controller (§3.7 protocol) | Start P3 (mouse until then) |

---

## P0 — Setup & contracts
- [ ] GitHub: add Abel, `dev` default, protect `main` + `dev`, merge commits only.
- [x] `a/scaffold` — everything in `00-shared.md` §2.2 (electron-vite TS app, pipeline/, hardware/, scripts/, assets/, root files, README, `CLAUDE.md`).
- [ ] Claude tooling: trim `.claude/` (Tier 1 + path-scoped Tier 2), add `rules/hackathon-workflow.md`, adapt finishing/executing/`/pr` to "PR into `dev`"; `/context` check; zip for Abel.
- [x] `a/contracts` — pre-drafted and merged (2026-10-03): `app/src/shared/*`, `StubOsLayer`, `PlaceholderDog`, `placeholder.dog.json`, `StubAudio`, preview page. **Still to do:** review it with Daniel + Abel; changes via small PRs.
- **Done when:** CP0 — app launches on all three machines with the placeholder dog.

## P1 — Spikes: prove the Windows overlay
**Goal:** the hardest Windows-specific unknowns are solved and Daniel has a host to render into.
- [x] **Overlay window:** transparent, frameless, covers the primary display, no taskbar icon/focus stealing, stays above the taskbar, click-through (mouse events pass straight through — gating a specific hit area is Task 3). Verified by hand on Windows 2026-10-04: dog renders over other apps, no taskbar button, tray "Quit Zoomies" works, GPU log confirms NVIDIA active. Commit `f8acda4`.
- [x] **Above the taskbar:** `setAlwaysOnTop(true, 'screen-saver')` — done as part of the overlay window above; confirmed clicking the taskbar doesn't hide the dog.
- [x] **Measure the full-screen transparent overlay cost** (Windows demo laptop, 2026-10-04): idle overlay **30%** GPU (Electron process, Processes tab), patrolling overlay **30%** (no visible stutter), windowed baseline **27%**; **CPU 2.7%** (trivial — this is purely a GPU/compositing cost). Also found: Desktop Window Manager itself runs **~20% GPU** during the overlay (not measured in the windowed baseline) — DWM has to alpha-composite the transparent full-screen layer every frame, a real cost the small-window fallback probably *would* reduce (not measured for sure, but DWM load should scale with composited area). System-wide total ≈ **40% GPU** during patrol.
  **Decision: keep the full-screen overlay, skip the small-window fallback** — not because it wouldn't help (it probably would, via DWM), but because it isn't worth building now: 40% GPU still leaves plenty of headroom for a short plugged-in demo, there's no visible stutter, CPU cost is negligible, and the fallback needs real new engineering (a window that tracks the dog every frame across runs/jumps/sleep-on-taskbar, plus a second one for the ball in flight per the risk table) that this close to the deadline is better spent on P1 work that doesn't exist at all yet (OsLayer, activity, world/ball). Recorded as a stretch/Could for P4 polish only if time remains.
- [x] **Click-through:** `setIgnoreMouseEvents(true, { forward: true })` via `ClickThroughGate` (hold timer so crossing the dog's edge doesn't flicker); toggles off over the dog, the ball, or while dragging it (slingshot). Verified by hand on Windows.
- [x] **Windows `OsLayer` spike** (tech-stack §1.1): `WindowsOsLayer` polls DWM extended frame bounds + z-order at 150ms with change detection; filters cloaked/tool/minimized/titleless/self/off-screen/tiny windows; taskbar rect derived from `workArea` vs display bounds. Verified by hand: outlines track every real window, minimizing removes one, maximized windows excluded.
- [x] **Activity:** `uiohook-napi` builds fine on Windows → `ActivityTracker` (typing rate + backspace ratio, timing only; mouse speed; idle seconds via `powerMonitor`), throttled per §3.5.
- [x] **Render host:** `WebGLRenderer` (alpha), `OrthographicCamera` in DIP (y down), render loop hosting the dog, FPS/frame-time overlay (`FrameStats`/`Hud`). **Region rendering/scissor skipped** — Task 1's GPU numbers (40% system-wide, no stutter, CPU 2.7%) didn't need it; left in P4's perf pass if it's ever actually needed.
- [x] **World SDF v0:** `World`/`sdBox` — signed distance to the work-area bounds + window solids (min of per-solid SDFs), debug outline draw toggle (`ZOOMIES_DEBUG=1`).
- [x] **Ball + mouse slingshot v0:** `ball.ts` (gravity, restitution, friction, substepped, no tunnelling) + `slingshot.ts` (drag-to-aim, power/angle, launch). Three bugs found and fixed during manual verification (render-order vs. the dog's transparent SDF quad; a flush-with-floor collision oscillation; an off-screen freeze when spawned under a near-full-screen window — root-caused by Daniel) — see `journal/2026-10-04_0529_daniel_ball-freeze-root-cause.md` and `docs/plans/a-p1-overlay.md` Task 7/8. `maxPullPx` tuned 200→100 after a feel check.
- **Tests (Vitest):** world SDF distance for rect sets; ball integrator settles; slingshot angle/power mapping. 524/524 passing project-wide as of CP1 close, incl. 200-random-layout and fully-covered-screen fuzz tests for the ball.
- **Done when (CP1):** on Windows — overlay with working click-through, live window list feeding the world SDF, placeholder dog hosted, ball bounces off real windows, FPS overlay showing frame time. **Confirmed twice in a row from a fresh `git pull`, no restart needed between, 2026-10-04.**

## P2 — MVP: everything Must works end to end
- [x] **Fetch sequence** (behaviour state machine): ball launched → dog looks at ball → `moveTo` landing spot (run) → pickup (`attachBall`) → return → drop near cursor → wag. `behaviour/fetch.ts` + `behaviour/landing.ts` (Daniel), wired into `main.ts`.
- [x] **Needs model:** energy / boredom / attention, decaying and reacting to events; behaviour picked from needs (PRD §4.5). `behaviour/needs.ts`.
- [x] **Desktop reactions (Musts):** cursor hover = look + wag; idle 1 min = sit/look around; **idle 5 min = sleep on the taskbar + adaptive FPS (~5)**; return = wake/stretch/greet; steady typing = lie down near the active window; ~50 min no break = bring ball + play-bow. `behaviour/reactions.ts` + `behaviour/arbiter.ts`.
- [x] **Adaptive FPS:** 60 when active, ~5 asleep, overlay shows it. `behaviour/fps.ts` (`FrameGovernor`), HUD shows the tier.
- [x] **Sound cues:** call Abel's `playSound` from behaviour events (bark on launch, squeak on pickup, panting after fetch, snoring asleep), passing the dog's screen x for panning. `behaviour/cues.ts`, real audio module from Abel (`app/src/renderer/audio/`) — confirmed audible (bark + squeak on launch).
- [x] **Integrate Daniel's `DogView` / `DogController`** — `SdfDog` is the real dog in the host; placeholder stays as the fallback flag.
- **Tests:** needs-model transitions; idle/typing classification thresholds; fetch state machine transitions (with a fake controller). 753/753 passing project-wide at CP2 close.
- **Done when (CP2):** demo path (launch → cursor → mouse fetch → idle → sleep → wake) on Windows with the real dog, ≥ 60 FPS active, sleep FPS drop visible. **Verified on Windows, 2026-10-04, twice in the same running session without restarting** — full cycle (launch/fetch/idle/sleep/wake) held both times. Promote + tag `mvp`.

## P3 — Shoulds
- [x] **Serial (with Abel):** `serialport`, auto-detect the port by `HELLO:zoomies:1`, parse §3.7, reconnect on unplug; map to `InputEvent`s — joystick pull-back = `aim`, release past threshold or button = `launch`, touch = `pet`, button tap = `call`, button hold = `pushToTalk`. Buzzer: `S:squeak` on catch, `S:chirp` per bounce.
  **Note (2026-10-04, from Abel's `c/controller` journal):** the merged sketch sends `HELLO:zoomies:1` every 2s, repeating forever (not just once on boot/connect) — the reader must treat a repeat as a no-op, not re-run port-detect/reconnect logic each time it arrives.
  **Done (2026-10-04):** `main/hardware/` (Daniel, PRs #28/#32/#33) + launch fix #40; verified end to end on Windows with the real board on COM4 (aim/launch, call, push-to-talk hold, touch pet + pet hand, squeak/chirp, unplug/replug). This board needs `ZOOMIES_INVERT_Y=1` (see `CLAUDE.md`).
- [ ] **Bounce prediction + mid-air catch:** simulate the ball forward against the world SDF → landing point; if the path crosses a reachable point, `jumpTo` an intercept and catch.
- [ ] **Window terrain:** platforms from window top edges + taskbar; route with walks + `jumpTo` arcs; ride a dragged window (follow its delta, jump off on large acceleration); fall + stumble when the window under the dog closes; **peek from behind** (dog behind a higher-z window is masked by that window's rect, peeks at the edge).
- [ ] **ElevenLabs L2:** push-to-talk records mic → STT → `command` event; ears perk on press; clickable command buttons as fallback.
  **Built (Daniel, #36):** mic only while held (button / on-screen hold / space), 10 s cap, ElevenLabs STT → D2 router; command bar is the fallback. Verified with a real clip on Mac. **Still to verify: the real mic on Windows** (overlay is `focusable:false` — check the permission).
- [x] **Gemini G3:** free text → function-call to a dog action; fixed command list as fallback. `main/services/gemini-command.ts` (Daniel, #35), `gemini-3.8-flash` (override `GEMINI_MODEL`), word list `behaviour/commands.ts` when offline; seven commands + head tilt when not understood.
- [x] **Keys:** load `.env` in the main process with Node's built-in `process.loadEnvFile()` (no extra package); never pass keys to the renderer. Done with a tiny tested reader instead (`main/services/dotenv.ts`, no dependency, never overrides an existing variable); keys stay in main.
- [ ] **Gemini G2:** load the personality profile (generated once from the photo) into needs-model parameters; window-herding trick for the Aussie.
- **Hand-off rule:** if behind at mid-P3, hand L2/G2/G3 to Daniel once the dog is stable.
- **Tests:** serial parser (good/bad lines); landing prediction vs simulated result; platform graph from window rects; command mapping.
- **Done when (CP3):** demo path incl. joystick throw, touch pet, squeak, riding a dragged window, runs 3× without restart. Promote + tag `demo-p3`.

## P4 — Polish
- [ ] **Step-out-of-photo opening:** a second window showing `assets/photo/dog.jpeg`; on start the dog emerges from the frame (animation timing with Daniel).
- [ ] **X-ray toggle UI** wired to `DogView.setDebugView` + world SDF debug draw.
- [ ] **Perf pass** (pull in `benchmark-optimization-loop` / `performance-optimizer`): frame-time budget, region rendering, polling rates.
- [ ] **Stretch — small-window overlay fallback:** only if time remains and GPU headroom becomes an actual problem (it wasn't in P1 — 40% GPU, no stutter, CPU 2.7%). A window that tracks the dog's current bounds instead of the full screen, to cut DWM's compositing cost; needs a second small window for the ball in flight too. See P1 risks/measurement notes.
- [ ] **Cheap Coulds** that ride on your work: zoomies when everything is minimised (#24), backspace head tilt (#22), time-of-day mood (#23), then Tiger Data (#32), ElevenLabs L3 (#30), Gemini G4 (#31) in that order if time remains.
- **Done when (CP4 — feature freeze):** promote + tag `freeze`.

## P5 — Submission (integrator duties)
- [ ] Merge final fixes, tag `final`, run the demo path from a clean clone on Windows.
- [ ] Secret scan before the repo goes public.
- [ ] Support Abel on the video capture (screen recording on the Windows laptop).
- [ ] **GPU assignment on the demo laptop:** after the final `npm run build:win`, assign "High performance" GPU to the built `zoomies.exe` (Settings → Display → Graphics, or the laptop will silently run on the weak integrated GPU — see risks table).

---

## Risks in this lane
| Risk | Mitigation |
|---|---|
| Native modules (`koffi` / window enumeration, `uiohook-napi`, `serialport`) fail to build on Windows | Spike all three in P1 first; alternatives: `node-window-manager`, polling-based activity via `powerMonitor`, Web Serial in the renderer |
| Click-through flicker / missed clicks | Hit-test with a small margin; hysteresis on toggling |
| Display scaling makes rects and pixels disagree | Use DIP everywhere; convert DWM physical px via the display's `scaleFactor` |
| Full-screen transparent overlay costs GPU/frame time on Windows | Measure in P1; fall back to a dog-following small window |
| Integration bugs cluster on the Windows machine (Macs can't run the real overlay) | Daniel develops in a standalone dog preview page; merge into `dev` more often than checkpoints |
| WSL → push → pull → rebuild loop is slow for Windows-only work | Consider running Claude Code natively on Windows for this repo (see PRD §6.4) |
| Lane overload | Hand L2/G2/G3 to Daniel; cut per `00-shared.md` §6 |
| **Demo laptop has a hybrid AMD+NVIDIA GPU; Chrome/Electron default to the weak AMD iGPU unless explicitly assigned.** Measured 2026-10-04: SDF dog cost went from avg 10ms/p95 122ms (AMD) to avg 0.8ms/p95 0.9ms (NVIDIA) on the same build. The fix (Windows Settings → Display → Graphics → assign the app's `.exe` to "High performance") is per-exe-path and was only applied to `chrome.exe` and this dev session's `node_modules/electron/dist/electron.exe` — it will **not** carry over to the real `npm run build:win` output (different exe path). | **Before the real demo (P5):** re-assign "High performance" GPU to the actual built `zoomies.exe` path on the demo laptop. Check `chrome://gpu`-equivalent (Electron's `chrome://gpu` works the same way) shows the NVIDIA GPU `*ACTIVE*` before presenting. Added as a P5 checklist item below. |

## Phase plans to write (writing-plans)
`docs/plans/a-p1-overlay.md` → `a-p2-mvp-behaviour.md` → `a-p3-hardware-terrain-voice.md` → `a-p4-polish.md` — each written at the start of its phase.
