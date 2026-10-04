# Zoomies

**One photo of a dog becomes a real pet that lives on your desktop.**

It roams over your real windows, keeps you company while you work, reacts to how you're
typing and whether you've taken a break, and plays joystick-launched fetch across your
entire screen — ricocheting the ball off your actual open windows and taskbar.

Built in 24 hours at **StormHacks 2026** (SFU Burnaby) for **Huawei Custom Challenge #2 —
"Fetching Reality"**, also eligible for the ElevenLabs, Gemini and Best Hardware tracks.

— Ansh, Daniel, Abel

---

## What makes it *this* dog

Not a generic cartoon puppy. Give it one photo and it builds a dog whose proportions,
coat colours and markings are actually measured from that photo:

```
your dog's photo ──► Gemini reads proportions, colours, markings ──► dog spec (JSON)
                                                                          │
                                                                          ▼
                                            generic builder ──► SDF body + Gaussian-splat coat
```

No mesh, no rig, no Blender, anywhere in this pipeline. The body is **signed-distance-field
ray-marching** (a handful of capsules and ellipsoids, fit to the photo's proportions); the fur
is a **custom Gaussian-splat pass** on top, coloured from the photo. Both are named,
GPU-native techniques doing exactly what they're best at — a few KB of shape data standing in
for a model that would otherwise be megabytes of mesh and textures. Flip on the x-ray debug
view and you can watch the primitives moving under the coat in real time.

Run the real pipeline on any dog photo and it builds a dog file for it — we've verified it
end-to-end against the live Gemini API, not just mocked. The hand-tuned spec for this specific
Aussie is what you actually see in the demo, because it captures the photo's fine markings
better than any automated pass did on the day; the generated pipeline is the proof that it
works on *any* dog, not just this one.

## What it actually does

Everything below is built and has been verified running, on Windows, with the real hardware
where hardware is involved — not a mockup.

**Lives on your desktop, not in a window.** Transparent, always-on-top, click-through overlay
— you can click and type in whatever's behind the dog without it ever stealing the click. The
dog only intercepts input aimed directly at it. Your real windows and taskbar are solid objects
in its physics world.

**A whole personality, not a loop.** An internal needs model (energy / boredom / attention)
decides what the dog does, not a fixed animation cycle:
- Goes idle → sits and looks around → curls up asleep on the taskbar, and the frame rate
  actually drops with it (60 fps active → ~5 fps asleep, shown live on the HUD).
- Notices you come back — wakes, stretches, yawns, trots over to greet your cursor.
- Settles down near whatever window you're actively typing in; dozes beside you during a long
  focus session; gets confused (head-tilt) at a burst of backspaces.
- After a long stretch with no break, brings you the ball and play-bows at you.
- Typing detection is **timing only** — keystroke rate and bursts, never key contents.

**Physical joystick fetch.** A real Arduino controller — joystick, button, touch sensor,
buzzer — drives the dog over serial: pull the stick back and let go to throw (or press the
button mid-pull to throw instantly), tap the button to call the dog, hold it for push-to-talk,
touch the sensor to pet it. The board auto-detects its port, survives being unplugged and
replugged mid-demo, and every single one of those actions has a mouse/keyboard fallback — a
loose wire can never break the demo. The ball bounces off your real windows and the taskbar
with proper restitution and friction until it settles, and the buzzer squeaks on pickup and
chirps on every bounce.

**Petting, for real.** Touch the sensor (or click the dog) and it lies down on its tummy while
a small cartoon hand strokes it.

**Talks back.** Hold the push-to-talk button and say something — ElevenLabs transcribes it,
Gemini turns free text into one of seven real commands (sit, lie down, come, fetch, speak,
good boy, a trick) with a fixed word-list fallback if the network's down, and the dog obeys.
Type a command into the on-screen bar if you'd rather not talk.

**It's quietly efficient.** Live frame-time overlay, adaptive frame rate, and a dog that
measured **0.8 ms average / 0.9 ms p95 per frame** on the real demo hardware (RTX 2060) —
the whole point of choosing SDFs and splats over a traditional rig in the first place.

## The technique, lined up against what judges actually score

| What's being judged | How we made it visible |
|---|---|
| Computational efficiency | Live FPS/frame-time HUD; adaptive 60→~5 fps asleep; a few KB of SDF shapes + a sparse splat coat, no triangle mesh |
| Interactivity | Real joystick/button/touch hardware with full mouse fallback; dog reacts to your cursor, your typing, your breaks, your windows |
| Aesthetics & animation | Shape and colour fitted to the actual photo; procedural gait + leg IK + springs + idle life (weight shifts, ear flicks, yawns) — hand-authored cartoon timing, not canned clips |
| The technique ask | SDF ray-marched body **+** Gaussian-splat coat, both doing what they're named for; AI (Gemini) measures the photo, maths fits the shapes; an x-ray toggle shows the reconstruction live |

## Quick start

```bash
cd app
npm install
npm run dev       # launch with hot reload
```

Requires Node 22+, and on Windows a **native Windows clone** (not WSL — the transparent
overlay only works as a real Windows app). Copy `.env.example` to `.env` at the repo root and
add your own Gemini/ElevenLabs keys to use those features.

**Launching with the real controller plugged in?** Use
`ZOOMIES_INVERT_Y=1 npm run dev` — see [`CLAUDE.md`](CLAUDE.md) for why.

```bash
npm test          # Vitest, 1000+ tests
npm run typecheck
npm run lint
npm run build      # typecheck + production build
```

New to the repo or picking this up to contribute? Start at
[`GETTING_STARTED.md`](GETTING_STARTED.md) — setup, branch rules, and the day-to-day workflow
all three of us used to build this in 24 hours.

## Repo layout

| Path | Contents |
|---|---|
| `app/` | The Electron app (TypeScript, Three.js) — overlay shell, dog rendering, physics, AI behaviour |
| `app/src/shared/` | Contracts shared between the shell, the dog and the hardware/voice layer |
| `pipeline/` | Python: photo → Gemini → dog spec |
| `hardware/arduino/` | The controller's Arduino sketch |
| `assets/` | The source photo, generated views, dog spec files, sound library |
| `docs/` | PRD, tech stack, phase plans | 
| `journal/` | A dated log of the entire build, decision by decision |

## More

- **What we're building and why:** [`docs/specs/2026-10-03-zoomies-prd.md`](docs/specs/2026-10-03-zoomies-prd.md)
- **Stack and architecture:** [`docs/tech-stack.md`](docs/tech-stack.md)
- **Everything, in order, as it happened:** [`journal/`](journal/)
