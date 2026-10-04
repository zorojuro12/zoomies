# Zoomies — Demo Video Plan (≤ 3:00)

Draft by Ansh (covering for Abel, Lane C). Abel owns the final cut, voice-over and Devpost upload.

**Rules:** ≤ 3:00 total. First 15 s must already show the dog leaving the photo and catching the ball — judges may stop there. Every claim on screen is something the app really does in the recording (no mock-ups). Record on the **Windows demo laptop** (plugged in, high-performance GPU), 1920×1080, FPS overlay on unless a shot says otherwise.

**Status key:** ✅ works now · 🔜 being built in P3/P4 · ⚠️ if not ready by recording, use the fallback.

---

## Shot list

| # | Time | Shot | What's on screen | Capture | Status / fallback |
|---|---|---|---|---|---|
| 1 | 0:00–0:08 | **Cold open: the photo** | The Aussie photo as a picture window on a clean desktop → the dog climbs out of the frame onto the desktop | Screen rec | 🔜 P4 step-out-of-photo. ⚠️ Fallback: photo window beside the dog, quick cut from photo → live dog in the same pose |
| 2 | 0:08–0:15 | **Hook: joystick fetch** | Hand pulls joystick back (phone video, split-screen) → ball ricochets off windows/taskbar → dog sprints, leaps, catches mid-air → **squeak in the hand** | Screen rec + phone | Joystick 🔜 P3 Tasks 1–3; mid-air catch 🔜 P3 Task 5. ⚠️ Fallback: mouse slingshot ✅ + ground catch ✅ |
| 3 | 0:15–0:25 | **Title card** | "Zoomies — one photo of a dog becomes a real pet on your desktop" + team names, over the dog trotting back with the ball | Edit | — |
| 4 | 0:25–0:40 | **It's *that* dog** | Photo and dog side by side; slow turn of the dog; point out blaze, copper points, ear shape | Screen rec | ✅ (editor/preview page for the turn) |
| 5 | 0:40–1:00 | **Lives on your real desktop** | Dog follows the cursor (head + eyes), click-through: clicking/typing in apps right behind it works; it walks along window tops | Screen rec | Cursor + click-through ✅; window tops 🔜 P3 Task 6 |
| 6 | 1:00–1:15 | **Windows as terrain** | Drag the window the dog is standing on → it rides along → flick hard → it jumps off; close the window → it falls and stumbles | Screen rec | 🔜 P3 Task 6. ⚠️ Cut the shot if not ready (cut order §6 item 6) |
| 7 | 1:15–1:30 | **Physical petting** | Hand touches the sensor (phone) → dog leans in, eyes close, tail wags; same via mouse click on the dog | Phone + screen | Touch 🔜 P3 Task 4; mouse pet ✅ |
| 8 | 1:30–1:45 | **Keeps you company** | Start typing steadily → dog lies down near the active window; ~50 min no break (speed up with demo timers) → brings the ball + play-bow | Screen rec | ✅ (P2 reactions; set `ZOOMIES_DEMO=1`: idle 8 s, asleep 20 s, break due 90 s) |
| 9 | 1:45–1:55 | **Voice** | Hold the button, say "sit" → ears perk while held → dog sits | Phone + screen | 🔜 P3 Task 7 (ElevenLabs). ⚠️ Fallback: tray "Commands ▸ sit", or cut |
| 10 | 1:55–2:10 | **Sleep + efficiency** | Go idle → dog walks to the taskbar, curls up, snores; **FPS overlay drops 60 → ~5**; move the mouse → wakes, stretches, greets | Screen rec (overlay visible) | ✅ (P2 adaptive FPS; demo timers) |
| 11 | 2:10–2:40 | **Technique reveal (x-ray)** | Toggle x-ray: the SDF primitives (capsules/ellipsoids) under the coat, then the Gaussian-splat coat on top; overlay frame time ~1–3 ms; line: "no triangle mesh anywhere" | Screen rec | Debug views ✅ (Daniel's `setDebugView`); toggle UI 🔜 P4. ⚠️ Fallback: launch with the debug flag |
| 12 | 2:40–2:52 | **How it's built** | Fast diagram: photo → Gemini dog spec → fitted SDF body + splat coat → animated in code → Electron overlay reading real window rects; ElevenLabs voice; Arduino controller | Edit (slide) | — |
| 13 | 2:52–3:00 | **Close** | Dog drops the ball at the cursor, wags, looks at camera; logo + "StormHacks 2026 · Huawei Fetching Reality" | Screen rec + edit | ✅ |

## Voice-over script (~150 wpm, ≈ 380 words)

**[0:00 — over shots 1–2, no VO for the first 3 s, let the squeak land]**
"This is a photo of a dog. … And this is the same dog — living on my desktop."

**[0:15 — title]**
"Zoomies turns one photo of a dog into a real pet that lives on your screen."

**[0:25 — shot 4]**
"It's not a generic cartoon. Gemini reads the photo, and we fit the dog's body to it — the white blaze, the copper on the cheeks and legs, the ears — so it reads as *this* dog."

**[0:40 — shot 5]**
"It runs over your real windows. It watches your cursor, but it never gets in the way — every click goes straight through to the app underneath, unless you're touching the dog."

**[1:00 — shot 6]**
"Windows are its terrain. Drag the one it's standing on and it rides along. Close it, and it falls."

**[1:15 — shot 7]**
"You can pet it — with the mouse, or with the touch sensor on our controller."

**[1:30 — shot 8]**
"While you work, it keeps you company: it lies down next to you while you type, and if you haven't taken a break in a while… it brings you the ball."

**[1:45 — shot 9]**
"Hold the button and talk to it — ElevenLabs turns your voice into commands."

**[1:55 — shot 10]**
"Leave it alone and it naps on the taskbar — and drops from sixty frames a second to five, so it costs almost nothing while it sleeps."

**[2:10 — shot 11]**
"Under the fur there's no mesh. The body is a signed distance field — smooth shapes fitted to the photo — and the coat is a Gaussian splat. The whole dog renders in a couple of milliseconds a frame, and everything you see is animated in code."

**[2:40 — shot 12]**
"Photo in, Gemini, our fitter, an Electron overlay that reads your real windows, ElevenLabs for its voice, and an Arduino for the joystick and the squeak."

**[2:52 — shot 13]**
"Zoomies. One photo. Your dog — on your desktop."

## Recording checklist

- [ ] Clean desktop: hide icons, plain wallpaper, close notifications (Focus Assist on), taskbar visible.
- [ ] Launch with demo timers (`$env:ZOOMIES_DEMO=1; npm run dev` — idle 8 s, asleep 20 s, break due 90 s) so idle/sleep/break reactions happen within the shot.
- [ ] Record each shot separately (OBS or Xbox Game Bar `Win+Alt+R`), 2–3 takes each; keep the FPS overlay on for 2, 10, 11.
- [ ] Phone video of the controller in hand for 2, 7, 9 — same takes as the screen recording (clap once at the start to sync).
- [ ] Record the squeak/chirp audio from the room for 2 (the buzzer is the point).
- [ ] Final check: ≤ 3:00, captions on the VO, no keys/`.env`/terminal with secrets visible in any frame.
