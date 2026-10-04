# Lane A P3 — Shoulds (serial controller, catch, terrain, voice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `executing-plans` skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The judge drives the dog from Abel's Arduino controller (joystick throw, touch pet, button call/push-to-talk, buzzer squeak/chirp), the dog catches the ball mid-air, uses windows as terrain, and understands spoken commands.

**Architecture:** The serial port lives in the main process (`app/src/main/hardware/`): a link that finds the board by its `HELLO`, reconnects on unplug, and a pure mapper that turns §3.7 messages into §3.6 `InputEvent`s sent over `input:event`. The renderer feeds those events into the same paths the mouse uses (slingshot aim line, ball launch, `Behaviour.handleInput`). Catch, terrain and voice build on Daniel's `Behaviour`/`Fetch` (P2), so they come after P2 lands in `dev`.

**Tech Stack:** Electron main (Node 22), `serialport` + `@serialport/parser-readline`, Vitest (fake timers), Three.js renderer host, `@elevenlabs/elevenlabs-js` (STT), `@google/genai` (G3 function calling).

**Spec:** `docs/specs/2026-10-03-zoomies-prd.md` (§4.3 fetch, §4.4 reactions, §4.7 L2, §4.8 G2/G3, §8 hardware) + `docs/plans/lane-a-ansh.md` (P3 section) + `docs/plans/00-shared.md` §3.6 `input.ts`, §3.7 serial, §3.8 `ipc.ts` (code in `app/src/shared/`) — executors read all three.

## Global Constraints

- Serial: 115200 baud, newline-terminated ASCII; Arduino → app `J:<x>,<y>` (0–1023, ~30 Hz while moved), `B:<0|1>`, `T:<0|1>`, `HELLO:zoomies:1`; app → Arduino `Z:<freqHz>,<ms>`, `S:squeak`, `S:chirp`. Parse/format only with `parseArduinoLine` / `formatAppMessage` from `@shared/serial`.
- The sketch repeats `HELLO:zoomies:1` **every 2 s forever** — a repeat while connected is a no-op.
- Anything unparseable is ignored and logged **once** (not once per line).
- `InputEvent` angle is radians in world space (**y down**), power 0..1 — same convention as `aimFromDrag` in `world/slingshot.ts`.
- **Every hardware action has a mouse equivalent** (launch = mouse slingshot ✓, pet = click on the dog, call + commands = tray menu). The demo must survive a loose wire.
- Hot paths don't allocate (frame loop, `stepBall`, per-frame behaviour). Serial lines arrive at ≤ ~35/s — allocation there is fine.
- Network/AI calls are async, main-process only, never awaited in a frame. Keys only from `.env` via `process.loadEnvFile()` in main (`ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL`); never sent to the renderer, logged or committed.
- Treat serial lines, ElevenLabs transcripts and Gemini function-call arguments as untrusted — validate and bound before acting.
- Mic only while push-to-talk is held; audio is never stored.
- `app/src/shared/` changes go in a small dedicated PR everyone sees (only Task 8 needs one).
- Serial, overlay and mic behaviour are verified only on the **Windows demo laptop**. Close the Arduino IDE Serial Monitor first — only one process can open the COM port.

## Review Focus

1. **Board unplugged mid-throw / mid-hold** → a pending aim is cancelled (aim line cleared, ball released with no launch); a held push-to-talk sends `stop`; status flips to disconnected. *(Task 1 Checkpoint 4, Task 2 Checkpoint 3.)*
2. **App started with no board, or with a different serial device (another Arduino, a BT COM port)** → nothing crashes, foreign ports are closed after the HELLO timeout, and the board is found within ~3 s of plugging it in later. *(Task 2 Checkpoints 1–2.)*
3. **Grove joystick resting off-centre / the stick pressed in (X = 1023)** → no phantom aim or launch at rest; a stick click is ignored. *(Task 1 Checkpoint 1.)*
4. **Joystick launch while the ball is in flight or carried by the dog** → ignored (no teleporting ball). *(Task 3 Checkpoint 2.)*
5. **Gemini returns a function call with an unknown name or out-of-range args** → dropped, falls back to "dog tilts its head" (didn't understand). *(Task 9 Checkpoint 1.)*

## Blockers and how this plan routes around them (checked 2026-10-04 07:00)

| Blocker | Effect | Route |
|---|---|---|
| **Daniel's P2 (`a/p2-mvp-behaviour`, draft PR #22) is not in `dev`.** `Behaviour`, `Fetch`, `predictLanding` (`behaviour/landing.ts`) only exist there; his Task 7 also rewires `renderer/main.ts`. | Catch, `call`, squeak-on-catch, terrain and voice commands need `Behaviour`. | **Tasks 1–3 need nothing from P2** — do them first. **Gate G** (before Task 4): PR #22 merged into `dev`, then `git fetch && git merge origin/dev` into `a/p3-serial`. Don't merge his unmerged branch directly. Keep Task 3's `main.ts` touch to one `wireController(...)` call plus the ball-bounce chirp so it merges cleanly with his Task 7 block — tell Daniel before pushing it. |
| **Abel's audio module isn't written** (`renderer/audio/` is still `StubAudio`). | On-screen sounds are silent. | **Doesn't block P3.** The CP3 "squeak" is the **buzzer** (serial), not audio. Sound cues are Daniel's P2 Task 6 against `StubAudio`. |
| **The controller is physical and Abel has it.** | Manual checkpoints in Tasks 2–3 and 5 need it plugged into the Windows laptop, with the merged sketch flashed. | Ask Abel to bring the board to the Windows laptop before Task 2's manual checkpoint. Until then, Tasks 1–2 are unit-tested with a fake port; keep going on Task 3's mouse parts. |
| **Grove joystick range/axes not measured.** | Aim direction could be mirrored, or power never reaches 1. | Task 2's manual checkpoint logs raw `J:` values; set `CONTROLLER.center/fullScale/invertX/invertY` from what you see. |
| **`gh` isn't installed in WSL.** | Can't check PR #22's state from here. | Check on github.com or the Windows clone. |

**Priority and cut line** (5 h to the deadline): Tasks 1–3 (serial, CP3 hardware) → Gate G → 4 (controller ↔ behaviour) → 5 (mid-air catch) → 6 (terrain: ride + fall) → 7 (keys + L2) → 8 (G3) → 9 (G2, **cut first**). Per `00-shared.md` §6, cut G2, then G3, then terrain beyond "ride a dragged window". Peek-from-behind is cut from this plan (back in P4 only if time remains).

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `app/src/main/hardware/controller-mapper.ts` (+test) | Pure: `ArduinoMessage` + time → `InputEvent[]` (aim/launch/pet/call/pushToTalk) | 1 |
| `app/src/main/hardware/serial-link.ts` (+test) | Port scan, HELLO handshake, reconnect, line I/O; port API injected | 2 |
| `app/src/main/hardware/node-serial.ts` | The real `serialport` adapter (thin, untested — verified on Windows) | 2 |
| `app/src/main/index.ts`, `ipc-main.ts`, `preload/index.ts`, `preload/index.d.ts` | Wire link → `input:event` / `serial:status`; `serial:buzzer` renderer → main; tray "Call" + "Commands" | 2, 3, 7 |
| `app/src/renderer/world/controller-input.ts` | Renderer: controller events → aim line / ball launch / behaviour | 3, 4 |
| `app/src/renderer/world/ball.ts` (+test) | `ball.bounces` impact counter for the chirp | 3 |
| `app/src/renderer/behaviour/intercept.ts` (+test) | Pure: ball path vs dog reach → catch point | 5 |
| `app/src/renderer/behaviour/terrain.ts` (+test) | Pure: platforms from window rects; "what am I standing on", delta follow | 6 |
| `app/src/main/services/env.ts`, `elevenlabs-stt.ts`, `commands.ts` (+test) | Keys, STT call, transcript → command | 7 |
| `app/src/main/services/gemini-commands.ts` (+test) | G3 function-calling + argument validation | 8 |
| `app/src/main/services/gemini-personality.ts` (+test) | G2 profile → needs params | 9 |

---

### Task 1: Controller mapper (pure)

**Files:**
- Create: `app/src/main/hardware/controller-mapper.ts`
- Test: `app/src/main/hardware/controller-mapper.test.ts`

**Interfaces:**
- Consumes: `ArduinoMessage`, `JOYSTICK_MAX` from `@shared/serial`; `InputEvent` from `@shared/input`.
- Produces:
  - `export const CONTROLLER = { center: 512, fullScale: 300, deadzone: 0.15, armPower: 0.3, releasePower: 0.12, releaseLookbackMs: 150, stickClickX: 1000, holdMs: 400, invertX: false, invertY: false }` (mutable values tuned in Task 2's manual checkpoint; keep it one object).
  - `export class ControllerMapper { feed(msg: ArduinoMessage, nowMs: number): InputEvent[]; tick(nowMs: number): InputEvent[]; reset(): InputEvent[] }` — `tick` is called every 50 ms by the link (detects a button hold with no new message); `reset` is called on disconnect.

Joystick → aim: `dx = (x − center)/fullScale`, `dy = (y − center)/fullScale` (each negated if `invertX/invertY`), deflection `p = min(hypot(dx,dy), 1)`. The stick is a **pull-back**: the ball launches **opposite** the deflection, so `angle = atan2(−dy, −dx)`, `power = (p − deadzone)/(1 − deadzone)` clamped 0..1. Screen y is down and joystick y down is +, so pulling the stick down-left aims up-right.

**Checkpoint 1: joystick aim, deadzone and stick click**

- [ ] **Step 1: Write failing tests**
  - `J:512,512` → `[]`. `J:550,512` (deflection ≈ 0.13, inside the 0.15 deadzone) → `[]`.
  - `J:212,812` (full pull down-left) → exactly one `{kind:'aim'}` with `power` 1 (±1e-9) and `angle` ≈ `atan2(-1, 1)` = −π/4 (±1e-6, up-right).
  - `J:1023,512` (stick click, `x ≥ stickClickX`) → `[]` and doesn't change the armed state.
  - With `invertY = true` (set and restore in the test), `J:512,812` → angle ≈ +π/2 (down) instead of −π/2.
- [ ] **Step 2: Run** `cd app && npx vitest run src/main/hardware/controller-mapper.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `feed` for `joystick` per the formula above; emits `aim` whenever `power > 0`.
- [ ] **Step 4: Run** — expect PASS (4 tests counted).
- [ ] **Step 5: Commit** `npx vitest run src/main/hardware/controller-mapper.test.ts && git add app/src/main/hardware/controller-mapper.ts app/src/main/hardware/controller-mapper.test.ts && git commit -m "feat: joystick to aim mapping for the serial controller"`

**Checkpoint 2: release launch with peak lookback**

- [ ] **Step 1: Write failing tests**
  - Feed at t=0 `J:362,662` (deflection ≈ 0.71, power ≈ 0.66), t=33 `J:212,812` (power 1), t=66 `J:420,604` (deflection ≈ 0.43, power ≈ 0.33), t=99 `J:505,515` (deflection ≈ 0.05, under `releasePower`) → the t=99 call returns `[{kind:'launch', power: 1, angle: −π/4}]` (the **highest-power aim within the last `releaseLookbackMs`**, not the last sample). It also returns no `aim`.
  - Never past `armPower`: t=0 `J:600,512` (power ≈ 0.17 < `armPower`, aim emitted) then t=33 `J:512,512` → no `launch`.
  - Peak older than the lookback: t=0 `J:212,812`, t=400 `J:505,515` → `launch` using the max-power aim among samples with `t ≥ 400 − 150`; none is in that window, so it falls back to the last aim seen → assert `power` 1, `angle` −π/4.
- [ ] **Step 2: Run** — expect FAIL (no `launch` emitted).
- [ ] **Step 3: Implement** — keep a small ring (8 entries, reused) of `{t, angle, power}`; "armed" once any power ≥ `armPower`; on a sample with deflection under `releasePower` while armed → emit `launch`, disarm, clear the ring.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: joystick release launches with the peak aim"`

**Checkpoint 3: button tap / hold / launch-while-aiming, touch**

- [ ] **Step 1: Write failing tests**
  - `B:1` at 0, `B:0` at 200 → on `B:0`: `[{kind:'call'}]`.
  - `B:1` at 0, `tick(450)` → `[{kind:'pushToTalk', state:'start'}]` (once — `tick(500)` → `[]`); `B:0` at 900 → `[{kind:'pushToTalk', state:'stop'}]` and **no** `call`.
  - Armed aim (`J:212,812` at 0), `B:1` at 50 → `[{kind:'launch', power:1, angle:−π/4}]`, disarmed; the following `B:0` at 120 → `[]` (no `call`), and a `tick(600)` while still held after a launch-press → `[]` (no push-to-talk).
  - `T:1` → `[{kind:'pet', source:'touch'}]`; `T:0` → `[]`.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** per the cases above.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: button call, push-to-talk hold and touch pet mapping"`

**Checkpoint 4: reset on disconnect**

- [ ] **Step 1: Write failing tests** — after `B:1` + `tick(450)` (talking), `reset()` → `[{kind:'pushToTalk', state:'stop'}]`. After an armed aim with no button, `reset()` → `[{kind:'aim', angle: <last>, power: 0}]` (power 0 = "aim cancelled", the renderer clears the line). Fresh mapper `reset()` → `[]`. After any reset, `B:0` → `[]`.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** `reset`.
- [ ] **Step 4: Run** — expect PASS. Then `cd app && npm test && npm run typecheck`.
- [ ] **Step 5: Commit** `... && git commit -m "feat: controller mapper cancels aim and talk on disconnect"`

---

### Task 2: Serial link — find the board, reconnect, wire to IPC

**Files:**
- Modify: `app/package.json`, `app/package-lock.json` (`npm install serialport` — brings `@serialport/parser-readline`)
- Create: `app/src/main/hardware/serial-link.ts`, `serial-link.test.ts`, `node-serial.ts`
- Modify: `app/src/main/index.ts`, `app/src/main/ipc-main.ts`, `app/src/preload/index.ts`, `app/src/preload/index.d.ts`

**Interfaces:**
- Consumes: `ControllerMapper` (Task 1); `parseArduinoLine`, `formatAppMessage`, `SERIAL_BAUD`, `SERIAL_HELLO` from `@shared/serial`.
- Produces:
  - `export interface SerialPortApi { list(): Promise<{ path: string }[]>; open(path: string, baud: number): Promise<SerialConn> }`
  - `export interface SerialConn { onLine(cb: (line: string) => void): void; onClose(cb: () => void): void; write(s: string): void; close(): Promise<void> }`
  - `export const LINK = { scanEveryMs: 2000, helloTimeoutMs: 2500, tickMs: 50 }`
  - `export class SerialLink { constructor(api: SerialPortApi, handlers: { onInput(e: InputEvent): void; onStatus(s: { connected: boolean; port: string | null }): void; log(msg: string): void }); start(): void; stop(): Promise<void>; buzz(preset: BuzzerPreset): void }`
  - `node-serial.ts`: `export const nodeSerial: SerialPortApi` (wraps `SerialPort.list()` / `new SerialPort({ path, baudRate })` + `ReadlineParser({ delimiter: '\n' })`; on open error rejects; `close` is safe to call twice).
  - Preload: `window.zoomies.onInput(cb: (e: InputEvent) => void): () => void`, `onSerialStatus(cb: (s: {connected: boolean; port: string | null}) => void): () => void`, `buzz(preset: 'squeak' | 'chirp'): void`.

Behaviour: `start()` scans every `scanEveryMs` while disconnected. A scan tries each listed port **one at a time** (skipping ports that failed in the last scan only if they threw on open), opens it, waits up to `helloTimeoutMs` for a line equal to `SERIAL_HELLO` (after trim), and closes it if none arrives. The first HELLO marks it connected → `onStatus({connected: true, port})`. While connected: HELLO lines are no-ops; other lines → `parseArduinoLine` → `mapper.feed` → `onInput` for each event; an unparseable line is logged once per connection; `mapper.tick` runs every `tickMs`. On close/error → `mapper.reset()` events forwarded, `onStatus({connected:false, port:null})`, resume scanning. `buzz` writes `formatAppMessage({kind:'preset', name})` only when connected (else no-op).

Tests use a `FakePortApi` (in the test file) with `vi.useFakeTimers()`: ports are scripted objects whose `emit(line)` / `unplug()` drive the callbacks.

**Checkpoint 1: finds the board among foreign ports; repeated HELLO is a no-op**

- [ ] **Step 1: Write failing tests** — ports `COM3` (never speaks) and `COM5` (sends `HELLO:zoomies:1` 100 ms after open). After `start()` + advancing 6 s: `onStatus` called **exactly once** with `{connected:true, port:'COM5'}`; `COM3` was closed. Then `COM5` emits HELLO 3 more times → `onStatus` still once, and `api.open` call count unchanged.
- [ ] **Step 2: Run** `npx vitest run src/main/hardware/serial-link.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** scan + handshake.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git add app/package.json app/package-lock.json app/src/main/hardware/serial-link.ts app/src/main/hardware/serial-link.test.ts && git commit -m "feat: serial link finds the controller by its HELLO"`

**Checkpoint 2: lines → InputEvents, junk logged once, no board → keeps scanning**

- [ ] **Step 1: Write failing tests** — connected to COM5: emits `T:1` → `onInput({kind:'pet', source:'touch'})`; emits `garbage`, `J:9999,1`, `nope` → `log` called **once** in total for them, nothing thrown, no `onInput`. Separately: `list()` returns `[]` for 5 s, then `[COM5]` → connected within `scanEveryMs + 200 ms` of COM5 appearing. `open` rejecting (port busy) → logged, no throw, scan continues.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: serial link forwards controller input and survives junk lines"`

**Checkpoint 3: unplug → reset events, status, reconnect; buzz**

- [ ] **Step 1: Write failing tests** — connected, `B:1`, advance 450 ms (push-to-talk start seen), `unplug()` → `onInput` receives `{kind:'pushToTalk', state:'stop'}`, then `onStatus({connected:false, port:null})`; replug (COM5 listed again, sends HELLO) → `{connected:true, port:'COM5'}` within 3 s. `buzz('squeak')` while connected → the port's `write` received `'S:squeak\n'`; while disconnected → no write, no throw.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expect PASS. Then `cd app && npm test && npm run typecheck`.
- [ ] **Step 5: Commit** `... && git commit -m "feat: serial link reconnects after unplug and drives the buzzer"`

**Checkpoint 4 (manual): real board on Windows + joystick calibration**

- [ ] **Step 1: Implement** — `node-serial.ts`; in `index.ts` create `new SerialLink(nodeSerial, { onInput: (e) => sendTo(win, 'input:event', e), onStatus: (s) => sendTo(win, 'serial:status', s), log: (m) => console.log('[serial]', m) })`, `start()` it, `stop()` on `will-quit`. `ipc-main.ts`: `ipcMain.on('serial:buzzer', …)` validates `preset ∈ {'squeak','chirp'}` then `link.buzz`. Preload: `onInput`, `onSerialStatus`, `buzz` (+ `index.d.ts` types). Temporary: with `ZOOMIES_DEBUG=1`, log every raw `J:` line in main (`[serial] raw J:…`) — remove at the end of the checkpoint.
- [ ] **Step 2: Verify by hand** — Where: **Windows demo laptop**, board plugged in, merged sketch flashed, Arduino IDE closed.
  Steps: `git pull`, `cd app && npm install` (native `serialport` build), `$env:ZOOMIES_DEBUG=1; npm run dev`. Watch the terminal. Rest the stick; push it fully left, right, up, down; click it in. Unplug the USB, wait 3 s, replug.
  Expected: `[serial]` shows connected on the right COM port within ~3 s of start; HELLO repeats cause no reconnect spam. Note rest/extreme raw values → set `CONTROLLER.center`, `fullScale` (distance from rest to the smaller extreme), and `invertX/invertY` so that **pulling the stick down-left aims up-right**. Unplug → "disconnected" logged; replug → connected again, no app restart.
- [ ] **Step 3: Commit** (after confirming; debug raw log removed) `git add app/src/main/hardware/node-serial.ts app/src/main/hardware/controller-mapper.ts app/src/main/index.ts app/src/main/ipc-main.ts app/src/preload/index.ts app/src/preload/index.d.ts && git commit -m "feat: wire the serial controller into the app, calibrated on the real board"`

---

### Task 3: Renderer — joystick throw, chirp per bounce, mouse equivalents

**Files:**
- Create: `app/src/renderer/world/controller-input.ts`
- Modify: `app/src/renderer/world/ball.ts`, `ball.test.ts`, `app/src/renderer/main.ts` (one `wireController(...)` call + the chirp check in the frame loop + click-on-dog = pet), `app/src/renderer/host/hud.ts` (add `'controller'` field), `app/src/main/index.ts` (tray item "Call the dog" → `sendTo(win, 'input:event', {kind:'call'})`)

**Interfaces:**
- Consumes: `window.zoomies.onInput/onSerialStatus/buzz` (Task 2); `launchVelocity`, `Ball`, `worldView.setAim(ball, aim | null)`.
- Produces:
  - `Ball.bounces: number` — incremented once per impact whose inward normal speed exceeds `BALL.chirpMinSpeed = 120` px/s; `createBall` sets 0.
  - `export function wireController(opts: { ball: Ball; setAim(aim: {angle: number; power: number} | null): void; onLaunch(angle: number, power: number): void; onOther(e: InputEvent): void; onStatus(text: string): void }): () => void` — `onOther` receives pet/call/pushToTalk/command (logged now; Task 4 routes them to `Behaviour`).

**Checkpoint 1: `ball.bounces` counts real impacts only**

- [ ] **Step 1: Write failing tests** (`ball.test.ts`) — a ball dropped from 300 px above the floor of a plain work area (no windows), stepped at 16 ms for 3 s → `bounces ≥ 2` and it ends `resting`; then 2 more seconds of steps → `bounces` unchanged. A ball already resting, stepped 2 s → `bounces` 0. A ball launched straight into a window side at 800 px/s → `bounces` increments by exactly 1 on that hit.
- [ ] **Step 2: Run** `npx vitest run src/renderer/world/ball.test.ts` — expect FAIL (`bounces` undefined).
- [ ] **Step 3: Implement** — in `resolveCollision`, when the inward normal speed before reflecting exceeds `chirpMinSpeed`, `ball.bounces++` (no allocation).
- [ ] **Step 4: Run** — expect PASS, existing ball tests still green (count them: ≥ the previous count + 3).
- [ ] **Step 5: Commit** `... && git commit -m "feat: count ball impacts for the bounce chirp"`

**Checkpoint 2 (manual): joystick throw, chirps, status, mouse pet + tray call**

- [ ] **Step 1: Implement** — `wireController`: `aim` with power > 0 → only if `ball.resting || ball.held`: `ball.held = true`, zero velocity, `setAim(aim)`; `aim` power 0 → `setAim(null)`, `ball.held = false`; `launch` → only if `ball.held` (set by an earlier aim) or `ball.resting`: `onLaunch(angle, power)` (main.ts does `launchVelocity` + `held = false` + `setAim(null)`, the same as mouse pointerup); otherwise ignored. Status → HUD `controller` line: `controller: COM5` / `controller: —`. Frame loop: if `ball.bounces !== lastBounces` and ≥ 80 ms since the last chirp → `window.zoomies.buzz('chirp')`. Click on the dog (overlay `click` handler, `dog.hitTest`) → log `pet (mouse)` for now (Task 4 routes it). Tray "Call the dog".
- [ ] **Step 2: Verify by hand** — Where: **Windows demo laptop**, board plugged in.
  Steps: `git pull && cd app && npm run dev`. Pull the joystick back and release; pull back, hold, press the button; launch while the ball is mid-air; unplug mid-aim.
  Expected: the aim line follows the stick, release fires the ball opposite the pull with matching power; the button fires too; the board **chirps on each hard bounce** (not while it rolls); mid-air launch does nothing; unplug mid-aim clears the line and leaves the ball where it was; HUD shows the controller port, then `—`. The mouse slingshot still works exactly as before.
- [ ] **Step 3: Commit** `git add app/src/renderer/world/controller-input.ts app/src/renderer/main.ts app/src/renderer/host/hud.ts app/src/main/index.ts && git commit -m "feat: joystick throw, bounce chirp and controller status in the overlay"` — **then tell Daniel** what `main.ts` lines changed (before his Task 7 lands).

---

### Gate G — P2 is in `dev` and `Behaviour` is wired into `main.ts`

- [x] PR #22 (`a/p2-mvp-behaviour`, P2 Tasks 1–5) merged into `dev` and `dev` merged into `a/p3-serial` (2026-10-04 ~07:15).
- [ ] P2 Task 7 (`Behaviour` created in `renderer/main.ts`, fed `handleActivity`/`handleInput`/`setWindows`, `update` per frame) — Daniel's, not in PR #22. When it lands in `dev`, `git fetch && git merge origin/dev` again. Resolve `main.ts` by keeping **both** Daniel's behaviour block and the Task 3 `wireController` call; his mouse `pointerup` → `behaviour.handleInput({kind:'launch', …})` is the pattern `onLaunch` must also follow.
- [ ] `cd app && npm test && npm run typecheck && npm run lint` green; quick `npm run dev` on Windows: mouse fetch still works.
- [ ] If P2 Task 7 isn't in by **09:30**, skip to Task 7 (keys + L2's main-process half doesn't need `Behaviour`) and come back.

---

### Task 4: Controller ↔ behaviour (call, pet, squeak on catch, ears on push-to-talk)

**Files:**
- Modify: `app/src/renderer/behaviour/behaviour.ts`, `behaviour.test.ts` (Lane A file, written by Daniel — tell him), `app/src/renderer/world/controller-input.ts`, `app/src/renderer/main.ts`

**Interfaces:**
- Consumes: `Behaviour.handleInput(e: InputEvent)`, `Fetch.onNote(cb)` with `FetchNote` `'pickedUp'`, the P2 fake dog (`behaviour/fake-dog.ts`).
- Produces: `Behaviour.handleInput` handles `call` and `pushToTalk`; `Behaviour.onCue(cb: (cue: 'catch') => void): () => void` fired on fetch `pickedUp`.

**Checkpoint 1: `call` and `pushToTalk`**

- [ ] **Step 1: Write failing tests** (with the fake dog, cursor set to x=900 via `setCursor`) — `handleInput({kind:'call'})` → the fake dog's last `moveTo` target x is 900 (±`deadband`) with gait `'run'`, and after `arrived` the pose is `'sit'`. While fetch is active, `call` → no `moveTo` issued by call (fetch keeps ownership). `pushToTalk start` → pose `'headTilt'` (ears perk / listening) held until `stop`; `stop` releases it.
- [ ] **Step 2: Run** `npx vitest run src/renderer/behaviour/behaviour.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** through the arbiter (`'command'` slot, same as `pet`).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: dog comes when called and listens on push-to-talk"`

**Checkpoint 2: catch cue**

- [ ] **Step 1: Write failing test** — subscribe `onCue`; drive a fetch to `pickedUp` (as the existing fetch tests do) → callback called once with `'catch'`; `dropped` → not called again.
- [ ] **Step 2: Run** — expect FAIL. **Step 3: Implement.** **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: behaviour emits a catch cue"`

**Checkpoint 3 (manual): routing**

- [ ] **Step 1: Implement** — `onOther` → `behaviour.handleInput(e)`; mouse click on the dog → `handleInput({kind:'pet', source:'mouse'})`; tray "Call" arrives as `input:event` → same path; `onLaunch` also calls `behaviour.handleInput({kind:'launch', angle, power})`; `behaviour.onCue('catch')` → `window.zoomies.buzz('squeak')`.
- [ ] **Step 2: Verify by hand** — Windows, board plugged in. Expected: joystick throw → dog chases, picks up → **board squeaks**; touch sensor → dog leans in / wags; button tap → dog runs to the cursor and sits; hold button → head tilts until release; click on the dog and the tray "Call" do the same without the board.
- [ ] **Step 3: Commit** `git add app/src/renderer/world/controller-input.ts app/src/renderer/main.ts && git commit -m "feat: controller and mouse equivalents drive the dog"`

---

### Task 5: Mid-air catch

**Files:**
- Create: `app/src/renderer/behaviour/intercept.ts`, `intercept.test.ts`
- Modify: `app/src/renderer/behaviour/fetch.ts` (+ `fetch.test.ts`)

**Interfaces:**
- Consumes: the ball/world stepping that `predictLanding(ball, world, maxMs, out)` uses (`behaviour/landing.ts`).
- Produces:
  - `export const CATCH = { maxJumpPx: 140, runSpeedPx: 900, sampleMs: 16, horizonMs: 2500, minLeadMs: 120 }`
  - `export interface Intercept { found: boolean; x: number; y: number; tMs: number }`
  - `export function findIntercept(ball: Ball, world: World, dogX: number, groundY: number, out: Intercept): Intercept` — simulates a **copy** of the ball (a module-level scratch `Ball`, no per-call allocation) in `sampleMs` steps up to `horizonMs`; returns the **earliest** sample where `groundY − y ≤ maxJumpPx`, `y < groundY − 20` (actually airborne), the ball is descending (`vy > 0`), and `|x − dogX| / runSpeedPx * 1000 + minLeadMs ≤ tMs`. Else `found = false`.

**Checkpoint 1: intercept maths**

- [ ] **Step 1: Write failing tests** — plain work area 1920×1040 (floor y 1040): ball at (200, 600) with v (700, −900), dog at x 1200 → `found`, `tMs > 0`, `y` within 140 px of the floor, and the dog can reach `x` in time (assert the inequality). Same throw, dog at x 1900 with `runSpeedPx` 100 (set + restore) → `found = false`. A ball that only rolls along the floor → `found = false`. Calling twice gives identical results (scratch ball doesn't leak state into the real ball: the real ball's x/y/vx/vy are unchanged).
- [ ] **Step 2: Run** `npx vitest run src/renderer/behaviour/intercept.test.ts` — expect FAIL. **Step 3: Implement.** **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: predict a mid-air catch point"`

**Checkpoint 2: fetch uses it**

- [ ] **Step 1: Write failing test** (`fetch.test.ts`, fake dog) — after `launch()` with an interceptable throw, fetch runs to the intercept x and calls `jumpTo(x, y)` timed so the jump starts `≈ tMs − jumpDurationMs` after launch; on `landed`, `attachBall(true)` and the state is `'returning'` (skips the ground pickup). A throw with no intercept → old behaviour (`predictLanding` → run → `grabbing`).
- [ ] **Step 2: Run** — expect FAIL. **Step 3: Implement** — new internal state `'leaping'` (add to `FetchState`, Lane A file); `pickedUp` note still fires on the catch so the squeak follows. **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `... && git commit -m "feat: dog leaps for a mid-air catch"`

**Checkpoint 3 (manual):** Windows. A medium-power joystick throw across the screen → the dog runs under it, leaps and catches it in the air, squeak on the board; a low throw that lands at its feet → normal ground pickup. Commit any tuning of `CATCH` values: `git commit -m "chore: tune mid-air catch"`.

---

### Task 6: Windows as terrain — stand on, ride, fall

Scope cut to what CP3 needs: the dog can be **on a window top**, **rides it when the window is dragged**, **jumps off on a hard drag**, and **falls to the floor when the window closes or minimises**. Routing walks between platforms and peek-from-behind are out.

**Files:**
- Create: `app/src/renderer/behaviour/terrain.ts`, `terrain.test.ts`
- Modify: `app/src/renderer/behaviour/behaviour.ts` (`setWindows` feeds terrain; per-frame follow), `behaviour.test.ts`

**Interfaces:**
- Produces:
  - `export const TERRAIN = { minPlatformW: 120, snapPx: 6, jumpOffAccel: 25000 }` (px/s²)
  - `export interface Platform { id: number; x: number; y: number; w: number }` — a window's top edge (`y = rect.y`), only for windows ≥ `minPlatformW` wide whose top edge isn't covered at the dog's x by a higher-z window.
  - `export function platformsFrom(windows: readonly WindowRect[], out: Platform[]): Platform[]`
  - `export function supportUnder(x: number, feetY: number, platforms: readonly Platform[]): Platform | null` — the platform whose top is within `snapPx` of `feetY` and spans `x`.
  - `export class Rider { onWindows(platforms: readonly Platform[], dtMs: number): { dx: number; dy: number; fall: boolean; jumpOff: boolean } }` — tracks the platform the dog is on by window `id`; returns its delta since last update; `fall` when that id vanished or no longer spans the dog; `jumpOff` when the platform's acceleration exceeds `jumpOffAccel`.

**Checkpoint 1: platforms + support** — tests: two windows, the lower-z one's top edge under a higher-z window at x is excluded at that x; a 100 px wide window → no platform; `supportUnder` hits at `feetY` = top ± 5, misses at ± 10. RED (module missing) → GREEN. Commit `feat: platforms from window tops`.

**Checkpoint 2: rider** — tests: dog on window id 7; window moves +40 px x over one 150 ms update → `{dx: 40, dy: 0, fall: false}`; window id 7 gone → `fall: true`; a move of +300 px then −300 px in consecutive 150 ms updates → `jumpOff: true`. RED → GREEN. Commit `feat: ride a dragged window, fall when it closes`.

**Checkpoint 3 (manual)** — wire into `Behaviour`: when the dog's feet are on a platform it follows `dx/dy` (via `placeAt`); `fall` → drop to the floor (gravity via `jumpTo(x, floorY, {apexPx: 0})`) and stumble (`setPose('stretch')`); `jumpOff` → `jumpTo` the floor next to the window. A way to get onto a window for the demo: after a fetch drop, if the cursor is over a platform's span, `jumpTo` its top (`apexPx` 80). Windows: get the dog onto Notepad's title bar, drag Notepad slowly (dog rides), flick it hard (dog jumps off), close it while the dog is on it (dog falls). Commit `feat: windows as terrain in behaviour`.

---

### Task 7: Keys + ElevenLabs L2 push-to-talk

**Files:**
- Create: `app/src/main/services/env.ts`, `commands.ts`, `commands.test.ts`, `elevenlabs-stt.ts`; `app/src/renderer/ui/mic.ts`
- Modify: `app/src/main/index.ts` (load env first; tray "Commands ▸ sit / lie down / come / fetch / speak / good boy" → `input:event` command), `app/package.json` (`@elevenlabs/elevenlabs-js`), `app/src/renderer/behaviour/behaviour.ts` (handle `command`)
- **Contract PR (separate, small, announce to all):** `app/src/shared/ipc.ts` — add `'services:transcribe': ArrayBuffer` (renderer → main, invoke, resolves `void`; the result arrives as `input:event` `command`). Preload gains `transcribe(audio: ArrayBuffer): Promise<void>`.

**Interfaces:**
- `env.ts`: `export function loadKeys(): { elevenlabs: string | null; gemini: string | null; geminiModel: string | null }` — `process.loadEnvFile()` on the repo-root `.env` inside try/catch (missing file → all null, logged once with no values).
- `commands.ts`: `export const COMMANDS = ['sit', 'lie down', 'come', 'fetch', 'speak', 'good boy'] as const`; `export type Command = (typeof COMMANDS)[number]`; `export function matchCommand(transcript: string): Command | null`.
- `elevenlabs-stt.ts`: `export async function transcribe(audio: ArrayBuffer, key: string): Promise<string>` (Scribe `speechToText.convert`, 8 s timeout via `AbortController`, rejects on failure).
- `mic.ts`: on `pushToTalk start` → `getUserMedia({audio:true})` + `MediaRecorder`; on `stop` → stop tracks (mic off), send the blob's `ArrayBuffer` via `transcribe`; recordings over 10 s are cut at 10 s; under 300 ms → dropped.

**Checkpoint 1: `matchCommand`** — tests: `"Sit!"` → `'sit'`; `"  please LIE   down "` → `'lie down'`; `"come here buddy"` → `'come'`; `"who's a good boy"` → `'good boy'`; `"go get it"` → `null` (G3 handles free text); `""` → `null`; a 5,000-char string → `null` without throwing (input capped at 200 chars before matching). RED → GREEN. Commit `feat: match spoken text to dog commands`.

**Checkpoint 2: behaviour handles `command`** — tests (fake dog): `sit` → pose `'sit'`; `lie down` → `'lie'`; `come` → same as `call`; `fetch` → `bringBall` path (P2's `canBring`); `speak` → emits a `'bark'` cue via `onCue`; `good boy` → applies the `pet` needs event + tail wag; unknown text (`{kind:'command', text:'dance'}`) → pose `'headTilt'` ("didn't understand"). RED → GREEN. Commit `feat: dog obeys voice commands`.

**Checkpoint 3 (manual)** — Windows, `.env` with `ELEVENLABS_API_KEY`. Hold the board button, say "sit", release → the head tilts while held, the dog sits ~1–2 s after release. Tray "Commands ▸ lie down" → dog lies down with no mic. Unplug Wi-Fi → saying a command logs a failure and the dog tilts its head; nothing freezes. Grep the build log for the key: absent. Commit `feat: push-to-talk voice commands via ElevenLabs`.

---

### Task 8: Gemini G3 — free-speech commands

**Files:**
- Create: `app/src/main/services/gemini-commands.ts`, `gemini-commands.test.ts`
- Modify: `app/src/main/index.ts` (when `matchCommand` returns null and a Gemini key exists, call it), `app/package.json` (`@google/genai`)

**Interfaces:**
- `export const DOG_TOOLS` — one function declaration `do_action({ action: enum COMMANDS, target?: enum ['cursor','active_window'] })`.
- `export function validateCall(call: unknown): { action: Command; target: 'cursor' | 'active_window' | null } | null` — pure; untrusted input.
- `export async function interpret(text: string, key: string, model: string): Promise<{ action: Command; target: ... } | null>` — 6 s timeout; returns `validateCall` of the first function call, else null. Model from `GEMINI_MODEL` or a default — **check the current Gemini text model id in the `@google/genai` docs before writing it.**

**Checkpoint 1: `validateCall`** — tests: `{name:'do_action', args:{action:'sit'}}` → `{action:'sit', target:null}`; `{name:'do_action', args:{action:'lie down', target:'active_window'}}` → ok; `{name:'rm_rf', args:{}}` → null; `{name:'do_action', args:{action:'explode'}}` → null; `{name:'do_action', args:{action:'sit', target:'kitchen'}}` → null; `null`, `"sit"`, `{}` → null. RED → GREEN. Commit `feat: validate Gemini command calls`.

**Checkpoint 2 (manual)** — Windows, both keys. Hold the button: "go lie down on my code editor" → dog lies down (target `active_window` → lie on the floor below the topmost window, P2's definition); "show me a trick" → some valid action or head tilt. Without a Gemini key → unmatched speech gives a head tilt, no error spam. Commit `feat: Gemini understands free-speech commands`.

---

### Task 9 (cut first): Gemini G2 — personality profile

**Files:** Create `app/src/main/services/gemini-personality.ts`, `gemini-personality.test.ts`; Modify `app/src/main/index.ts`, `app/src/renderer/behaviour/needs.ts` (parameter injection), preload.

**Interfaces:** `export interface Personality { energy: number; playfulness: number; herding: boolean }` (each 0..1); `export function validatePersonality(raw: unknown): Personality | null` (clamp numbers to 0..1, reject NaN/missing → null); `export function needsParamsFrom(p: Personality): NeedsParams` (higher energy → slower energy drain, higher playfulness → faster boredom rise; exact factors: drain × (1.5 − energy), boredom rise × (0.5 + playfulness)). Profile generated **once** from `assets/photo/dog.jpeg`, cached at `assets/dog/personality.json`; app reads the cache; missing/invalid → default profile.

**Checkpoint 1** — tests: `validatePersonality({energy: 2, playfulness: -1, herding: true})` → `{1, 0, true}`; `{energy: 'high'}` → null; `needsParamsFrom` at energy 1 vs 0 → drain halves vs ×1.5. RED → GREEN. Commit `feat: personality profile drives needs parameters`.

**Checkpoint 2 (manual)** — the cached profile loads (HUD/log shows it); deleting the file → default profile, no crash. Window herding is **out** (P4 Could).

---

### Task 10: Verify, journal, lane plan

- [ ] `cd app && npm test && npm run typecheck && npm run lint` — all green; record the test count.
- [ ] **CP3 run on the Windows demo laptop, 3× without restart:** launch → dog follows cursor → mouse fetch → **joystick throw** (chirps per bounce) → mid-air catch (squeak) → **touch pet** → button call → **drag the window the dog is on** → push-to-talk "sit". Pull the USB once mid-run and plug it back: the mouse path keeps working throughout and the controller comes back.
- [ ] Tick the P3 items done in `docs/plans/lane-a-ansh.md` (note what was cut: peek-from-behind, platform routing, window herding, and any later task skipped).
- [ ] Journal entry via the `journal` skill.
