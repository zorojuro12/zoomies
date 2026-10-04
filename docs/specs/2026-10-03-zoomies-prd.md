# Zoomies — PRD (draft v1.2)

**Product:** Zoomies (repo: `zorojuro12/zoomies`)
**Event:** StormHacks 2026, SFU Burnaby, Oct 3–4 (24 h)
**Submission deadline:** **Sun Oct 4, 12:00 pm PDT** (Devpost) — feature freeze ~9:00 am
**Primary track:** Huawei Custom Challenge #2 — Fetching Reality · **Goal:** top 2
**Team:** 3 (lead + 2) · **Platform:** Windows desktop app (Electron)
**Status:** Draft v1.2 — decisions so far are recorded; open questions in §15.

**Changes in v1.2:** the dog is now **stylised but faithful** (animated look, clearly the photo's dog), built as a **photo-fitted SDF body with a Gaussian-splat coat**, animated with a **pose library + procedural motion in code**. Image-to-3D generators, auto-rig services and Blender are no longer on the critical path.

---

## 1. Pitch

**One photo of a dog becomes a real pet that lives on your desktop.**
It roams over your real windows, keeps you company while you work, and plays fetch across your whole screen — launched with a physical joystick.

**Demo moment (first 15 s):** the original photo sits on the desktop as a picture window → an animated version of *that same dog* climbs *out of the frame* → watches the judge's cursor → judge pulls back the joystick and fires → the ball ricochets off windows and the taskbar → the dog predicts where it lands, sprints, leaps, catches it mid-air (squeak in the judge's hand) → trots back and drops it.

## 2. Judging criteria → how we win each

Huawei criteria (track):

| Pillar | What wins it | How we make it visible |
|---|---|---|
| **Computational efficiency** | Steady high FPS, real-time optimisation | Live FPS / frame-time overlay; ~1–3 ms/frame dog (est.); a few KB of SDF shapes + ~5–10k-splat coat; renders only the dog's region; adaptive FPS (60 active → ~5 asleep) |
| **Interactivity** | Responsive, engaging, seamless *human-dog* interaction | Judge drives everything: joystick fetch, petting via touch sensor or mouse, dog reacts to their typing/cursor/windows; <1 frame input latency |
| **Aesthetics & animation** | Quality of the *reconstructed* dog **and** fluid motion | Shape fitted to the photo, coat and markings coloured from it (step-out-of-photo opening shows the comparison); procedural motion with cartoon timing (anticipation, overshoot, settle) — never stiff |
| **Technique ask** (brief) | Move beyond mesh rendering; SDF / 3DGS / AI / maths / HCI | **SDF body + Gaussian-splat coat — both named techniques, each doing what it's best at; no triangle mesh anywhere.** AI finds landmarks, maths fits the shapes. Reconstruction x-ray toggle |

StormHacks general criteria (Surge Choice etc.): technical complexity, design, pitch, originality/creativity.

**Principle:** depth over breadth. Three things done beautifully beat ten done roughly.

## 3. Users & context

- **Primary:** hackathon judges, 2–3 min hands-on, no instructions.
- **Secondary:** anyone working at a computer who'd like a companion.
- **HCI stance:** calm technology — the pet never steals focus, never blocks clicks (click-through except on the dog), never touches files.

## 4. Experience: what the dog does

### 4.0 The dog's look
**Stylised but faithful — an animated version of *this* dog.** Not photoreal, not a generic cartoon. Proportions are measured from the photo; colours and markings (merle pattern, copper points, white blaze, eye colour, ear shape) are copied from it. Slightly pushed proportions (head, eyes) and cartoon-quality motion. Overall feel: a high-end plush or needle-felted model of the dog, as an animated film would render it.

### 4.1 Hero interaction — slingshot fetch across the desktop
- **Launch:** pull the joystick back (aim + power), release (or press the button) to fire. Mouse fallback: drag-back-and-release.
- **Aim preview:** dotted trajectory incl. first 1–2 bounces while aiming.
- **Ball physics:** bounces off screen edges, taskbar and open windows (all SDF colliders); loses energy each bounce (restitution + rolling friction) and settles, so every throw completes.
- **Dog behaviour:** head tracks the ball in flight; dog **predicts the landing point** and runs there; **leaps for a mid-air catch** when the ball's path crosses it; skidding stops/turns; picks up, trots back, drops near the cursor/launcher side.
- **Feedback:** buzzer squeak on catch, chirp per bounce; sound effects on screen.

### 4.2 Living on the desktop (environmental awareness)
| Trigger | Dog response |
|---|---|
| Dog stands on a window's top edge / taskbar | Windows and taskbar are walkable platforms |
| User drags the window it's on | Wobbles and rides along; jumps off if dragged too hard |
| Window moved over the dog | Peeks out from behind the edge (uses window z-order), walks out |
| User closes the window it's on | Falls, lands with a stumble, shakes off |
| User minimises everything | Zoomies across the empty desktop |

### 4.3 Companion while you work
| Trigger | Dog response |
|---|---|
| Steady typing | Settles near the active window, lies down, ears twitch with typing bursts |
| Long intense typing | Dozes beside you ("focus buddy") |
| Backspace spam | Head tilt (confused) |
| ~50 min without a break | Brings the ball, drops it by the cursor, play-bows ("break time?") |
| Cursor hovers on dog | Looks up, wags, leans in (mouse petting) |
| Cursor shaken fast | Excited, play-bow, chases it |
| Touch sensor touched | Leans in, eyes close, tail wag (physical petting) |

### 4.4 Idle and time
| Trigger | Dog response |
|---|---|
| Idle 1 min | Sits, looks around, scratches ear |
| Idle 5 min | Curls up asleep on the taskbar — **FPS drops to ~5, overlay shows it** |
| User returns | Wakes, stretches, yawns, trots to greet the cursor |
| Late night | Yawns more, sleepier |

### 4.5 Needs model (why it feels alive, not scripted)
Internal **energy / boredom / attention** values rise and fall: fetch drains energy (panting, lies down); being ignored raises boredom (brings the ball); attention follows the user's activity. Behaviour is chosen from these, not from a fixed loop.

### 4.6 Privacy
Typing detection uses **timing only** (rate, bursts, idle) — never key contents. The microphone is only on while the push-to-talk button is held (§4.7). Rendering, behaviour and input processing run locally; the only network calls are ElevenLabs speech (§4.7), Gemini (§4.8) and Tiger Data telemetry (§4.9), all async. Any screen capture (G4) is opt-in, low-resolution and never stored. Stated in the pitch.

### 4.7 Audio & voice (ElevenLabs)

Track framing: natural, expressive audio for "interactive AI companions" — judged on **meaningful** use, so ElevenLabs gives the dog its whole voice and an ear, not a couple of clips.

| Layer | Priority | What | ElevenLabs API | Effort |
|---|---|---|---|---|
| **L1 — The dog's whole voice** | **Must** | Full sound library generated from text prompts: happy bark, alert bark, whine, panting (after fetch), yawn, snoring, sneeze, excited yips, paws on windows, ball squeak. **Multiple variants per sound** so it never repeats exactly. **Spatial audio:** stereo pan follows the dog's screen position; volume drops with distance. | Sound Effects | ~1 h |
| **L2 — Voice commands (push-to-talk)** | **Should** | Hold the Arduino button → speak → release: "sit", "come", "fetch", "good boy", "lie down", "speak" → dog reacts. Ears perk the instant the button is pressed, so transcription delay reads as the dog listening. Mouse fallback: clickable command buttons. | Speech-to-Text (Scribe) | ~2 h |
| **L3 — Dog translator mode** | **Could** (if there is time) | Toggle (off by default): the dog's "thoughts" appear in a speech bubble and are spoken in a playful voice — e.g. break nudge *"You've been typing for 50 minutes… ball?"*, after a catch *"Did you SEE that?!"*. | Text-to-Speech | ~1–2 h |

**Guardrails**
- All ElevenLabs calls are async and never block the render loop.
- L1 sounds are generated at build time, saved, and played locally: zero latency, offline-safe, no FPS cost — a Wi-Fi drop can't silence the dog mid-demo.
- Push-to-talk keeps the mic off by default (privacy) and avoids false triggers in a loud venue.
- Check for MLH-provided ElevenLabs credits and sign up at the start.

### 4.8 Intelligence (Gemini)

Used where it strengthens the core project, never in the render loop.

| Layer | Priority | What | Why it matters | Runtime cost |
|---|---|---|---|---|
| **G1 — Views + landmarks** | **Must** | Gemini's image model turns the front-facing photo into **consistent side and back views of the same dog**, and marks **landmarks** on every view (nose, eyes, ear tips, shoulders, hips, knees, paws, tail base). These drive the SDF fitting and the coat colouring (§6). | Core of the reconstruction: gives the dog's true proportions and its unseen sides. | None (build time) |
| **G2 — Read the photo for personality** | **Should** | Gemini analyses the photo → structured profile (breed, energy, playfulness, traits). Sets the needs-model parameters (§4.5) and writes the ElevenLabs sound prompts (§4.7). Breed behaviours: an Aussie is a herding breed, so it **"herds" scattered windows** into a neat stack. | Makes "any dog photo" produce a dog that behaves like its breed. | None (once per photo) |
| **G3 — Understand any command** | **Should** | ElevenLabs Speech-to-Text (L2) → Gemini (function calling) maps free speech ("go lie on my code editor", "show me a trick") to a dog action. | Upgrades voice from 6 fixed words to natural language. | None (only when the user speaks) |
| **G4 — Occasional screen glance** | **Could** | Opt-in: every few minutes a tiny screenshot → Gemini → context tag (in a video call → dog stays quiet; cat video → barks). | Strongest "environmental awareness", but privacy-sensitive. | Low (rare, async, low-res) |

**Guardrails:** G1 consistency (same dog across views? landmarks plausible?) is tested in hour 0–1. All calls async; failures fall back to defaults (hand-placed landmarks, fixed personality profile, fixed command list, no screen glance).

### 4.9 Telemetry & insights (Tiger Data)

Tiger Data (PostgreSQL for time-series) used for what it's good at — **Could** priority.

- **Dog life log:** fetch sessions, catch streaks, breaks taken, focus stretches, needs over time. Typing *timing* only.
- **Performance log:** frame time and splat count every second.
- **Dashboard** from continuous aggregates:
  - Pet stats — "12 fetches today, 4 breaks, longest focus 1 h 20 m".
  - **Efficiency evidence for judges** — frame-time percentiles and the FPS drop while asleep.
- **Learns your rhythm:** if you usually break around 3 pm, the dog brings the ball at 3.
- **Guardrails:** batched async writes; local buffer when offline; the pet never depends on the database to run.
- Effort ~2–4 h.

## 5. Requirements

**Scheduling rule:** do every Must and Should. Coulds happen if time allows — **and if a Could is a simple addition at the moment its related work is being built, do it then** rather than deferring it (e.g. backspace head tilt while building the typing behaviours). Each Could below names the work it piggybacks on.

### Must (MVP — demoable by hour ~10)
1. **Photo-fitted SDF dog body:** ~20 smoothly blended SDF shapes on a code-defined skeleton, placed from landmarks so proportions match the photo (§6).
2. **Gaussian-splat coat:** ~5–10k splats on the body surface, coloured by projecting the photo(s), each attached to its shape (fallback: SDF-only with projected colours, §7).
3. **Gemini G1:** side/back views + landmarks feed the fitting and colouring (§4.8).
4. **Animation in code:** pose library (sit, stand, lie, sleep, play-bow, head tilt…) with cartoon-timed transitions; procedural walk/trot/run gait with leg IK; always-on layers (breathing, blink, tail wag, ear springs, look-at).
5. **Pose & shape editor:** in-app sliders to tune poses and proportions by eye and save them.
6. Transparent, always-on-top, click-through desktop overlay; dog is clickable.
7. Slingshot fetch end-to-end (mouse version first), ball with SDF collisions against screen edges + taskbar.
8. Idle → sleep → wake greeting, with adaptive FPS.
9. Typing → lie down beside you; break nudge.
10. FPS / frame-time overlay.
11. **ElevenLabs L1:** generated dog sound library with variants + spatial panning (§4.7).
12. Demo video (≤ 3 min, required by Devpost) + project link (repo/slides).

### Should
13. **Silhouette-fitting optimiser:** automatically refines shape sizes/positions so the dog's outline matches the photo from front and side.
14. Joystick + button launcher, touch-sensor petting, buzzer squeak (Arduino over USB serial).
15. Windows as terrain: walk on window tops, ride dragged window, fall when closed, peek from behind.
16. Bounce prediction + mid-air catch.
17. Step-out-of-the-photo opening.
18. **ElevenLabs L2:** push-to-talk voice commands via the Arduino button (§4.7).
19. **Gemini G2:** photo → personality profile driving needs model + sound prompts; breed trick (window herding) (§4.8).
20. **Gemini G3:** free-speech commands mapped to dog actions (§4.8).
21. **Reconstruction x-ray toggle:** photo → landmarks → fitted SDF shapes → splat coat → living dog.

### Could (if time allows — or pulled forward when cheap alongside related work)
| # | Could | Piggybacks on |
|---|---|---|
| 22 | Backspace head tilt | Typing behaviours (#9) |
| 23 | Time-of-day mood (sleepier late at night) | Needs model / idle (#8) |
| 24 | Zoomies when all windows are minimised | Window terrain (#15) |
| 25 | Mic reactions (whistle → comes; loud noise → startled) | Push-to-talk audio input (#18) |
| 26 | Accelerometer "shake to excite" | Arduino controller (#14) |
| 27 | Screen-colour-aware lighting on the dog | Coat shading (#2) |
| 28 | Denser / longer fur coat (pushes the look a little closer to real) | Splat coat (#2) |
| 29 | TRELLIS 3D shape as an extra fitting target | Fitting optimiser (#13) |
| 30 | **ElevenLabs L3:** dog translator mode (§4.7) | Voice commands (#18, #20) |
| 31 | **Gemini G4:** opt-in screen glance (§4.8) | Gemini integration (#19, #20) |
| 32 | **Tiger Data:** life log + performance log + dashboard (§4.9) | FPS overlay (#10) and needs model |

### Won't (this weekend)
- Photoreal dog · training our own models · rigging/skinning a mesh · multiplayer/accounts · anything touching user files · continuous screen watching (G4 is opt-in and occasional only).

## 6. Technical approach (decided)

**A photo-fitted SDF body with a Gaussian-splat coat. Both named techniques, no triangle mesh anywhere, no rigging.**

### 6.1 What the dog is made of
- **Body (SDF):** ~20 simple shapes (spheres, capsules, ellipsoids) for head, snout, nose, ears, neck, body, thighs, shins, paws and tail, blended with smooth-minimum so they melt together like clay. Each shape is attached to a bone of a skeleton defined in code — moving a bone moves its shapes, and the smooth blending keeps joints seamless.
- **Coat (Gaussian splats):** ~5–10k small soft splats scattered over the body surface, each attached to the shape it sits on (rigid per shape, so no skin weights). They carry the photo's colours and give a soft, furry edge.
- **Output:** one small dog file (shapes + skeleton + splats + poses) loaded by the app.

### 6.2 Build-time pipeline (once per photo)
```
Photo ──► SAM cut-out ──► Gemini G1: side/back views + landmarks
                                   │
                 landmarks ──► initial bone + shape placement (proportions of THIS dog)
                                   │
            silhouettes ──► optimiser refines shape sizes/positions to match front + side outlines (Should)
                                   │
           photo(s) ──► projected onto the surface ──► colours for the splat coat
                                   │
                         dog file (shapes, skeleton, splats, poses)
```

### 6.3 Runtime
```
Electron overlay (Windows), Three.js scene, custom shaders
  ├─ Body: SDF ray-marched in a screen-space box around the dog only
  ├─ Coat: splats sorted (small set) and drawn over the body
  ├─ Animation: pose library + cartoon-timed transitions + procedural gait (leg IK) + jump arcs + secondary layers
  ├─ World as SDFs: screen edges, taskbar, window rects, ball → collisions, contact shadows, x-ray view
  ├─ Behaviour: needs model + state machine + steering/jump arcs between window platforms
  ├─ Input: mouse/keyboard activity (timing only), window rects + z-order (native module), Arduino serial
  ├─ Efficiency: dog-region rendering, adaptive FPS, overlay — target ~1–3 ms/frame for the dog (est.)
  └─ Async services (never in the render loop): ElevenLabs STT/TTS · Gemini G2–G4 · Tiger Data telemetry
```

**AI tools:** SAM (segmentation), Gemini (views, landmarks, personality, command understanding), ElevenLabs (audio); optional TRELLIS 3D shape as a fitting target. **No image-to-3D generator, auto-rig service or Blender on the critical path.**
**Maths:** SDF smooth blending, ray marching, silhouette-fitting optimisation, photo projection, look-at and leg IK, spring dynamics, projectile + bounce prediction, SDF collision, jump arcs.
**HCI:** calm tech, click-through, feedforward (trajectory preview), immediate feedback (squeak/animation), forgiving input, physical-digital loop.

### 6.4 Platform (decided)
Electron desktop app; **Windows is the target and the demo machine** (team lead's laptop).
- **OS layer behind one interface:** window rects + z-order, input activity timing, click-through. Windows implementation is real; a **screen-edges-only stub** lets Mac teammates run everything else. Full macOS support is out of scope this weekend.
- **Dev workflow:** code is written in WSL (Claude Code) and pushed to a GitHub repo; a separate clone on the Windows filesystem is pulled and run with **Windows-native Node**. Never share `node_modules` between WSL and Windows — native modules (window enumeration, serial port, input hooks) are rebuilt per OS. Line endings pinned with `.gitattributes` (`* text=auto eol=lf`).
- **Fast loop:** Claude Code in WSL can drive the Windows clone via `powershell.exe` (pull → install → launch) so testing doesn't require switching terminals.

## 7. Fallback ladders (decide at checkpoints, don't drift)

**Likeness (does it look like this dog?)**
1. Landmarks + silhouette optimiser fit automatically — target.
2. Landmarks only, then tune proportions with the shape-editor sliders by eye.
3. Hand-placed landmarks on the photo (if Gemini's are off), then sliders.
Colours always come from the photo, so it stays *this* dog at every step.

**Appearance**
1. SDF body + splat coat — target.
2. SDF body only, with photo colours projected onto the surface (if the coat flickers or costs too much).

**Animation**
1. Pose library + procedural gait + secondary layers — target.
2. Simplify gait (fewer leg phases, more body bounce) and lean on cartoon timing if procedural walking looks off.

**Input hardware**
Mouse equivalents for every hardware action, always on.

**Network services**
ElevenLabs L1 sounds cached locally; Gemini and Tiger Data failures fall back to defaults; the pet runs fully offline in a degraded-but-complete mode.

## 8. Hardware

| Part | Use | Status |
|---|---|---|
| Joystick | Slingshot aim + power | ✅ Use |
| Button | Fire / call dog back (clicker) / push-to-talk | ✅ Use |
| Touch sensor | Physical petting | ✅ Use |
| Buzzer | Squeak on catch, chirp per bounce | ✅ Use |
| Arduino | Reads sensors → USB serial → app | ✅ Use |
| 3-axis accelerometer | "Shake to excite" | ❌ Skip (Could only) |

Packaged as one handheld "toy" controller. One owner, ~4–6 h, never on the critical path.

**The Arduino kit is an MLH rental:** build on a breadboard with jumper wires and tape — no soldering, glue, or permanent modifications — and return it complete before leaving. Photograph the wiring for the Devpost write-up before disassembly.

## 9. Tracks to enter (opt in to each on Devpost)

| Track | Fit | Extra work |
|---|---|---|
| Huawei #2 Fetching Reality | Primary | — |
| Surge Choice Award | Automatic | — |
| Best Hardware | Strong | Arduino toy controller (already planned) |
| Best Game | Good | Frame fetch as play (catch streaks / tricks) |
| [MLH] Best Use of ElevenLabs | Strong ("interactive AI companions") | L1 sound library (Must) · L2 push-to-talk commands (Should) · L3 translator mode (Could) — §4.7 |
| [MLH] Best Use of Gemini API | Strong | G1 views + landmarks drive the reconstruction (Must) · G2 personality (Should) · G3 commands (Should) · G4 screen glance (Could) — §4.8 |
| [MLH] Best Use of Tiger Data | Possible (Could) | Life log + performance telemetry dashboard — §4.9 |
| IATSU Best Design | Possible | Visual/UX polish (already a goal) |

Skipped: tracks that don't fit or we aren't eligible for. Enter Gemini and Tiger Data only if the corresponding work actually ships.

**Future scope (only if ahead of schedule): TiDB x AI Open Build.** Use TiDB's agent memory/state to give the dog a persistent memory — tricks it has learned, favourite play times. Overlaps with Tiger Data (§4.9), which fits time-series better, so TiDB is lowest priority.

## 10. What AI can and can't build for us

| Part | AI coding? | Human focus |
|---|---|---|
| Electron overlay, click-through | ✅ | Verify window-rect native module in hour 1 |
| SDF dog renderer, splat coat, photo projection | ✅ | — |
| Landmark placement + silhouette-fitting optimiser | ✅ | Judge the likeness |
| Pose library, procedural gait, IK, secondary motion | ✅ | Tune poses and timing by eye (pose editor) |
| Ball physics, SDF collisions, prediction | ✅ | — |
| Behaviour / needs system | ✅ | — |
| Arduino sketch + serial link | ✅ | — |
| ElevenLabs, Gemini, Tiger Data integrations, FPS overlay | ✅ | — |
| "Does it look like this dog?" | ❌ | People decide |
| Animation feel | ❌ | Human tuning time budgeted |

## 11. Hardest parts (ranked)

1. **Likeness.** Making the fitted head, face and ears clearly read as *this* Aussie, not a generic dog. Colours from the photo help; the head shape is where it's won or lost.
2. **Natural procedural gait.** Four legs, timing between them, feet planted on edges without sliding, smooth speed changes from walk to sprint.
3. **Fetch feeling natural.** Long chain (aim → fly → bounce → predict → run → leap/catch → turn → return → drop); every hand-off can look robotic.
4. **Desktop integration.** Click-through hit-testing, reading window positions/z-order, multi-monitor and display scaling.
5. **A stable splat coat on a moving body.** Splats must stay attached, sorted and flicker-free as shapes move and blend.
6. **Integration and demo stability** in the final hours.

## 12. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Dog doesn't look like the photo's dog | Medium | Critical | Landmarks + optimiser; shape-editor sliders; colours always from the photo; side-by-side check at hour 3 |
| R2 | Procedural gait looks unnatural | Medium | High | Cartoon timing hides imperfection; simplify gait; tune with the pose editor |
| R3 | Splat coat flickers or costs too much | Medium | Medium | Small splat count; per-shape attachment; fallback to SDF-only with projected colours |
| R4 | Fetch looks robotic | Medium | High | Full loop working ugly by hour ~10, then polish |
| R5 | Can't read window rects / click-through quirks on Windows | Medium | High | Native-module spike in hour 0–1; screen-edges-only fallback |
| R6 | Ray-marching cost on a weak GPU | Low | Medium | Dog-region-only rendering, step limits, adaptive FPS; test on the weakest team laptop |
| R7 | AI service limits (credits, queues, sign-ups) | Medium | Medium | Sign up and generate views/sounds immediately |
| R8 | Hardware/serial flakiness in the demo | Medium | Medium | Mouse fallback for every action; test with the real cable early |
| R9 | Live demo breaks (Wi-Fi, crash) | Medium | Critical | Fully offline build; required demo video doubles as backup; rehearse 3× |
| R10 | Critical-path bottleneck on one person | Medium | High | Runtime/behaviour work proceeds with a placeholder SDF dog in parallel |
| R11 | Gemini views/landmarks inconsistent | Medium | High | Test in hour 0–1; hand-place landmarks on the original photo if needed |
| R12 | Sponsor integrations sprawl and eat core time | Medium | High | Only Musts/Shoulds are scheduled; Coulds only when cheap alongside related work |
| R13 | Network services down at the venue | Medium | Medium | Cached sounds, default fallbacks, fully offline degraded mode |

## 13. Timeline (to the noon deadline)

| Hours from start | Milestone |
|---|---|
| 0–3 | Gemini G1 views + landmarks · SDF dog prototype on a code skeleton (placeholder proportions) · landmark-based placement · overlay + window-rect spike · Arduino wiring · sign up for ElevenLabs/Gemini/Tiger Data · **checkpoint: does it already read as this dog? (side-by-side with the photo)** |
| 3–10 | Splat coat with photo colours · pose library + pose/shape editor · procedural gait · behaviour state machine · mouse slingshot fetch end-to-end · idle/sleep/wake · typing behaviours (+ backspace tilt, Could #22, if cheap) · ElevenLabs L1 sound library · **MVP demoable** |
| 10–16 | Silhouette-fitting optimiser · joystick/touch/buzzer live · ElevenLabs L2 push-to-talk + Gemini G3 · Gemini G2 personality · window terrain · bounce prediction + mid-air catch · motion polish · FPS pass |
| 16–20 | Step-out-of-photo opening · reconstruction x-ray toggle · Coulds by remaining time: Tiger Data dashboard → ElevenLabs L3 → Gemini G4 |
| 20–~23 (≈ 9 am Sun) | **Feature freeze** · bug fixes · record demo video · Devpost write-up · opt in to tracks · rehearse |
| by 12:00 pm Sun | Submit |

## 14. Success metrics

- Judge plays fetch with zero instructions within 10 s.
- ≥ 60 FPS active, ~1–3 ms dog frame time, and a visible FPS drop when asleep, on the demo laptop.
- Side by side with the photo, people say "that's the same dog".
- Demo runs end-to-end 3× in a row without restart.

## 15. Open questions

1. Team skills — individual skills still to confirm to lock the role split.
2. ~~Demo laptop OS~~ — **decided: Windows** (lead's laptop); teammates on Mac run the stub OS layer (§6.4).
3. Credits for Gemini and ElevenLabs (MLH-provided?).
4. Does the Huawei Google Drive folder contain required assets, rules, or a mandated photo?
5. Splat coat: write a small custom splat pass (likely, since the coat is small) or adapt an existing renderer? Decide in hour 0–3.
6. ~~Rigging services / Blender automation~~ — **no longer needed**: the skeleton lives in code.
