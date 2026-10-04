# Lane C — Abel: content, hardware & demo

**Owner:** Abel · **Machine:** Mac · **Branch prefix:** `c/`
**Workflow:** Ansh's Claude Code setup (copied from Ansh's zip). Mostly a checklist — use writing-plans only for the small code pieces if you want.
**Read first:** `journal/2026-10-03_1852_ansh_kickoff-decisions.md` → PRD v1.2 §4.0, §4.7, §8 → `00-shared.md` §3.7 (serial), §3.8 (audio), §5 (checkpoints)
**Why this lane matters:** the dog's source material, its voice, the physical controller, whether it looks like *this* dog, and the demo video all come from here. Several items are on the critical path — they're marked ⚡.

---

## Working with Claude Code (quick guide)
- Start Claude in the repo folder: `cd zoomies` then `claude`. First message: **"resume from the journal"** — it reads the latest entry and catches you up.
- Keep Claude in **default permission mode** (it asks before running commands or editing files). Read what it wants to do before saying yes.
- Work only on **`c/...` branches** (e.g. `c/sounds`). Ask Claude: "create a branch `c/sounds` off `dev`". Never work directly on `dev` or `main`.
- **Don't edit files in `app/` outside `app/src/renderer/audio/`** without asking Ansh first.
- When done with a piece: ask Claude to commit, push, and open a PR into `dev`, or use GitHub Desktop. Tell Ansh in the group chat.
- End of each phase: ask Claude to **"write a journal entry"** (your name goes in the filename).
- Stuck for more than 15 minutes? Ask Ansh or Daniel — don't fight it alone.

## What this lane owns

| Folder / file | Contents |
|---|---|
| `assets/photo/dog.jpeg` | The source photo (replace with the full-size original if Huawei's folder has one — same filename) |
| `assets/views/` | Gemini-generated side/back views (+ `landmarks.json` only if the P3 optimiser happens) |
| `assets/sounds/` | The dog's sound library (+ `SOUNDS.md` listing the names) |
| `scripts/` | Small helper tools: sound generation/processing (landmark picker only if needed in P3) |
| `app/src/renderer/audio/` | Audio playback module (`playSound`, contract §3.8) |
| `hardware/arduino/zoomies_controller/` | Arduino sketch (serial protocol §3.7) |
| `docs/qa.md` | QA log |
| Demo video, Devpost page, pitch | Submission material |

## Needs / provides

| | From / to | What | When |
|---|---|---|---|
| **Provides** ⚡ | everyone | Huawei Drive folder checked; photo in `assets/photo/` | P0, first thing |
| **Provides** | Daniel | Side + back views — only to colour the sides the photo can't see | By end of P2 (not urgent) |
| **Provides** | Ansh | Sound library + audio module | Mid P2 |
| **Provides** | Ansh | Arduino sketch + wired controller | Start P3 |
| **Needs** | Daniel | Pose & shape editor | End P2 (for likeness tuning in P3) |
| **Needs** | Ansh | Serial reader on Windows to test the controller end to end | Start P3 |

---

## P0 — Setup
- [ ] ⚡ **Huawei folder:** open the Google Drive link from the challenge brief. Download the dog photo(s) and any brief/rules. If there's a bigger version of the Aussie photo, save it as `assets/photo/dog.jpeg` (replacing the current 380×466 one). Tell the team about any extra rules.
- [ ] Clone the repo; unzip Ansh's `.claude/` into it; install **GitHub Desktop** (optional) and the **Arduino IDE**.
- [ ] Accounts: **Google AI Studio** (Gemini) and **ElevenLabs**. Ask at the MLH desk whether there are credits for either. Put API keys only in `.env` (never commit it).
- [ ] Contracts review (with Ansh + Daniel): check the **landmarks format** (`00-shared.md` §3.9, `app/src/shared/landmarks.ts`), the **sound names** (`SOUND_NAMES` in `app/src/shared/audio.ts`), and the **serial protocol** (§3.7, `app/src/shared/serial.ts`).
- **Done when (CP0):** the app runs on your Mac with the placeholder dog.

## P1 — The dog's voice, the breadboard, and the views

> **Changed 2026-10-03:** Daniel's pipeline now gets the dog's proportions and colours from a **Gemini "dog spec"** (see `lane-b-daniel.md`), not from hand-marked landmarks. So the **landmark picker is no longer needed** (only if the P3 optimiser happens), and the **side/back views aren't urgent** — they only colour the sides the photo can't see, by the end of P2. Start with the sounds and the breadboard.

### 1. Plan and start the sounds ⚡ → `assets/sounds/SOUNDS.md`
Sound names are fixed in `SOUND_NAMES` (`app/src/shared/audio.ts`), 2–3 variants each, numbered `_1`, `_2`, `_3`:
`bark_happy · bark_alert · yip_excited · whine · pant · yawn · snore · sneeze · sigh · paw_step · ball_bounce · ball_squeak`
- [ ] Write a one-line ElevenLabs prompt per sound in `SOUNDS.md`.
- [ ] Generate the four most important first in the ElevenLabs Sound Effects tool: `bark_happy`, `pant`, `snore`, `ball_squeak` (then the rest in P2).

### 2. Wire the breadboard (MLH kit — no soldering, no glue)
- [ ] Joystick (2 analog pins + its button), button, touch sensor, buzzer → Arduino. Draw/photograph the wiring.
- [ ] Test each part with the Arduino IDE's built-in examples (AnalogReadSerial, Button, toneMelody).

### 3. Generate views with Gemini (not urgent — by end of P2) (Google AI Studio, image model — e.g. "Nano Banana"; check what AI Studio offers)
Upload `assets/photo/dog.jpeg` each time and ask for **one change at a time** — changing pose *and* angle together makes Gemini drift into a different dog.

| File | What to ask for | Used for |
|---|---|---|
| `assets/views/side_sit.png` | **Same sitting pose**, seen from the dog's left side, same plain grey background, same lighting | Body length, snout length, depth, side colours (**most important**) |
| `assets/views/side_stand.png` | The same dog **standing** in profile (left side), plain grey background | Leg lengths for the standing skeleton |
| `assets/views/back.png` | Same sitting pose seen from behind | Colours of the back and tail |

Example prompt: *"This exact dog, identical markings and colours (black coat, white blaze, chest and paws, copper cheeks, brows and legs), same sitting pose, viewed from its left side. Plain light-grey studio background, same soft lighting. Full body visible, nothing cropped."*

**Check each result before keeping it** (regenerate if any fail):
- [ ] Same markings — white blaze shape, white chest, copper on cheeks/brows/legs in the same places
- [ ] Same ear shape and set, same fluffy tail
- [ ] Same proportions (not slimmer, not puppy-like)
- [ ] Full body in frame, plain background

- [ ] Commit the views on `c/views`, PR into `dev`, tell Daniel.

### 4. Landmarks — optional (only if Daniel asks for the P3 optimiser)
If it happens: a tiny **landmark picker** (`scripts/landmark_picker.html`, with Claude) that downloads JSON in the `00-shared.md` §3.9 format. Skip it otherwise.

- **Done when (CP1):** `SOUNDS.md` written and the first four sounds generated; every hardware part responds in the Serial Monitor. Views: started if there was time.

## P2 — The dog's voice + the controller sketch
- [ ] **ElevenLabs sound library (L1, a Must):** finish generating each sound in the ElevenLabs Sound Effects tool (or with a small script in `scripts/` via Claude), 2–3 variants each. Trim silence, keep them short (< 2 s, except `snore`/`pant` loops), similar loudness, export small `.mp3`/`.ogg`. Save as `assets/sounds/<name>_<n>.mp3`.
- [ ] **Audio module** (with Claude) in `app/src/renderer/audio/`: `playSound(name, { pan, gain })` per contract §3.8 — preload all files, pick a random variant, stereo pan with `StereoPannerNode`, gain, looping for `snore`/`pant`. Add a small test page/button to hear every sound.
- [ ] **Arduino sketch** (with Claude) `hardware/arduino/zoomies_controller/`: send `HELLO:zoomies:1` on boot, `J:x,y` (~30 Hz while moving), `B:0/1`, `T:0/1`; receive `Z:freq,ms`, `S:squeak`, `S:chirp` and play them on the buzzer. Test everything in the Serial Monitor.
- [ ] **Gemini side/back views** (P1 §3) if not done yet.
- **Done when (CP2):** sounds + audio module merged and audible in the app; sketch merged and working in the Serial Monitor; side/back views merged.

## P3 — Hardware live + likeness
- [ ] **With Ansh on the Windows laptop:** controller → app end to end (aim, launch, pet, call, push-to-talk, squeak on catch).
- [ ] **Build the handheld "toy":** breadboard + Arduino taped into a box/tube so the joystick and button are thumb-reachable and the touch sensor sits where you'd "pet". Removable — it goes back to MLH.
- [ ] **Likeness tuning** with Daniel's pose & shape editor: compare with the photo side by side; adjust head, muzzle, ears, tail; save.
- [ ] **QA at the checkpoint:** run the demo path, log every issue in `docs/qa.md` (what you did → what happened → expected).
- [ ] **Video plan:** write the shot list (below) and the 3-minute script.
- **Done when (CP3):** demo path with the controller runs 3× without restart.

## P4 — Polish & pitch prep
- [ ] QA pass; re-test fixed issues.
- [ ] Capture B-roll as features land (screen recordings on the Windows laptop + phone video of the controller in hand).
- [ ] Draft the Devpost page: what it is, how we built it (SDF + splats + AI + maths + HCI), tracks, challenges, team.
- [ ] Pitch script (60–90 s) + who demos what.
- **Done when (CP4 — feature freeze).**

## P5 — Submission (you lead)
- [ ] **Demo video ≤ 3 min:** photo → dog steps out → watches cursor → joystick fetch with bounce + mid-air catch (squeak in hand) → rides a dragged window → lies down while typing → falls asleep (FPS drop on the overlay) → x-ray technique reveal → team.
- [ ] Devpost: description, screenshots, repo link, video link; **opt in to each track** (Huawei #2, Best Hardware, Best Game, ElevenLabs, Gemini, + Tiger Data / Best Design if shipped).
- [ ] Rehearse the live demo 3× with Ansh.
- [ ] Photograph the wiring, disassemble, **return the MLH Arduino kit complete**.

---

## Risks in this lane
| Risk | Mitigation |
|---|---|
| Gemini makes a "different dog" | One change at a time; check list above; regenerate; Daniel can start from the front photo alone |
| Gemini views drift into a different dog | Not on the critical path any more — Daniel falls back to front-photo colours |
| ElevenLabs credits run out | Generate the must-have sounds first (bark_happy, pant, snore, ball_squeak); reuse variants |
| Hardware part doesn't work | Test each part alone first; the mouse fallback means the demo never depends on it |
| New to Claude Code | Default permission mode, `c/` branches, ask Ansh/Daniel after 15 minutes stuck |
