# Devpost submission — Zoomies

Paste each section into the matching Devpost field. Devpost accepts Markdown.

---

## Project name
Zoomies

## Tagline (≤ 200 chars)
One photo of a dog becomes a pet that lives on your desktop: it plays fetch off your real windows, keeps you company while you work, and answers to a joystick you can hold.

## Tracks to opt into
- Huawei Custom Challenge #2 — Fetching Reality (primary)
- [MLH] Best Use of Gemini API
- [MLH] Best Use of ElevenLabs
- Best Hardware Hack
- Best Game *(optional — fetch is the core loop)*

---

## Inspiration

Every desktop pet we'd seen was somebody else's cartoon. The Huawei brief asked us to take a real dog and make it interactive, so we asked a simpler question: what if the pet on your screen was *your* dog, built from a single photo, and it actually behaved like a dog around the things on your desktop?

## What it does

Give Zoomies one photo of a dog and it builds that dog, with its build, its markings and its colours, then lets it loose on your Windows desktop as an always-on-top, click-through overlay.

- **Fetch across your whole screen.** Pull back the joystick on our Arduino controller (or drag with the mouse) and let go. The ball ricochets off your real open windows and the taskbar; the dog predicts where it will land, sprints there, grabs it, and trots back. The buzzer in your hand chirps on every bounce and squeaks on the catch.
- **Company while you work.** It lies down beside you while you type steadily, brings you the ball if you haven't taken a break in a while, and naps on the taskbar when you walk away, waking up to greet you when you come back.
- **It listens.** It follows your cursor, leans in when you pet it (with the touch sensor or a click), and comes when called. Hold the button and talk: "sit", "lie down", or free-form like "go lie on my code editor".
- **Any photo, any dog.** Right-click the dog, upload a different photo, and a few seconds later a new dog stands in its place.
- **It stays out of the way.** Clicks pass straight through to the app underneath unless you're clicking the dog, it never takes keyboard focus, and it drops from full frame rate to 5 fps while it sleeps.

## How we built it

**From photo to dog.** The photo goes to Gemini with a structured prompt: three calls in parallel, and we take the median answer to smooth out a bad reply. That gives a small JSON "dog spec": proportions, ear and tail type, and region colours, which we then correct against the photo's actual pixels. The app turns that spec into the dog at runtime. There's no image-to-3D generator, no auto-rigging and no Blender anywhere in the pipeline. The Aussie in our demo is a hand-tuned version of its Gemini spec; uploading any other photo runs the full pipeline live.

**No triangle mesh.** The body is a **signed distance field**: spheres, capsules and ellipsoids blended smoothly on a code-defined skeleton and ray-marched in a fragment shader. The coat is a pass of **Gaussian splats**, thousands of soft splats each glued to the shape beneath it, so the fur moves with the body and takes its colour from the photo's markings. Everything is animated in code: a pose library with cartoon timing, a procedural gait, breathing, blinking, tail wag, ear springs and look-at.

**The desktop as a world.** An Electron app on Windows: a transparent full-screen overlay that hands clicks through except where the dog or ball is. The main process reads every visible window's real frame and z-order, and the renderer turns them into a 2D signed distance field the ball collides with (substepped physics, no tunnelling). Behaviour runs on a needs model (energy, boredom, attention) plus an activity classifier that only ever sees *timing*: typing rate, bursts and idle time, never key contents.

**Hardware.** An Arduino UNO R4 with a Grove thumb joystick, button, touch sensor and buzzer, talking a tiny newline-delimited serial protocol. The app finds the board automatically by its hello line, reconnects if it's unplugged, and every hardware action has a mouse equivalent, so the demo survives a loose wire.

**Voice and sound.** ElevenLabs generated the dog's whole voice (12 sounds with variants, panned to wherever the dog is on screen) and does speech-to-text for push-to-talk. The mic is open only while the button is held, and clips are never saved. The transcript goes to Gemini function calling, which maps it to one of the dog's actions, with a plain word list as the offline fallback.

**Process.** Three people in three lanes (shell and world, the dog, content and hardware) with shared TypeScript contracts between them, short-lived branches, and 1,123 automated tests on the logic that fails silently: physics, SDF maths, the serial parser, the needs model, the photo pipeline.

## Challenges we ran into

- **The GPU that wasn't.** Our first measurement of the SDF dog showed 100 ms+ frame spikes. The cause turned out to be our hybrid-GPU laptop silently running both Chrome and Electron on the weak integrated chip. Forced onto the discrete GPU, and with a bounding-sphere early-out added to the shader, the dog renders in **0.81 ms per frame on average (p95 0.9 ms)**.
- **A ball that escaped the universe.** A window sitting just under "maximized" size, flush with both the top of the screen and the taskbar, left the ball nowhere to go. Our collision escape pushed it off-screen, where everything counted as solid, and it froze. We fixed it with an 8-direction shortest-way-out search, then fuzzed it against 200 random window layouts.
- **Hardware surprises.** The controller repeats its hello line forever (the board can't tell when the app connects), so the reader treats repeats as no-ops. Our joystick turned out to be mounted upside-down. And the first joystick throws "caught" the ball instantly, because the launch never gave the ball any velocity.
- **Rethinking the AI step.** We planned to have Gemini draw side and back views plus landmarks. Consistency between views was the risk, so we switched to asking Gemini for a structured spec instead: more reliable, and it's what made "any photo" work.

## Accomplishments that we're proud of

- The dog reads as *that* dog, and it's built from maths and splats, not a mesh.
- It runs on top of your real windows at full frame rate and costs almost nothing asleep (60 → 30 → 5 fps adaptive, 2.7% CPU for the overlay).
- A judge can pick up the controller with no instructions, throw the ball, and feel the squeak in their hand when the dog catches it.
- Upload any photo and get a different dog in seconds.

## What we learned

- Measure before optimising, and check *which* GPU you're measuring.
- Shared contracts and a written journal let three people (and our AI pair-programmers) hand work across lanes without stepping on each other.
- Calm technology is mostly about what you *don't* do: never take focus, never block a click, never record what someone types.

## What's next for Zoomies

- Mid-air catches: the landing prediction is there, the leap isn't yet.
- Windows as terrain: walking on window tops and riding a window when you drag it.
- The "step out of the photo" opening, where the dog climbs out of its own picture.
- A personality read from the photo (herding breeds herd your windows).

## Built with
`electron` `typescript` `three.js` `webgl` `glsl` `signed-distance-fields` `gaussian-splatting` `gemini-api` `elevenlabs` `arduino` `serialport` `vitest` `node.js` `windows`

## Links
- Repo: https://github.com/zorojuro12/zoomies
- Video: [paste YouTube/Vimeo link]
- Slides: [paste the deck's share link once it's shared]
