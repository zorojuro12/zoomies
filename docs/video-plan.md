# Zoomies — Demo Video Plan (≤ 3:00)

Draft by Ansh (covering for Abel, Lane C). Abel owns the final cut, captions and Devpost upload.

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

## On-screen captions (no voice-over)

The video has **no narration**. The story is carried by short captions plus the app's own sounds (barks, panting, snoring, squeak, buzzer chirp) — keep the in-app audio, add quiet background music under it. Captions: 1–2 lines, ≤ 10 words per line, bottom-centre, on screen ≥ 2.5 s, white text with a dark shadow so they read over any window. Shot 9 (voice command) is the one place a spoken word is heard — the person saying "sit" — caption it as well.

| Shot | Time | Caption |
|---|---|---|
| 1 | 0:00 | *(none for 3 s)* → "This is a photo of a dog." |
| 2 | 0:05 | "…and this is the same dog, on my desktop." |
| 3 | 0:15 | **Title card:** "Zoomies — one photo becomes a real desktop pet" |
| 4 | 0:25 | "Built from the photo: shape, markings, colours." · then "Gemini reads the photo → a fitted 3D dog" |
| 5 | 0:40 | "It lives on top of your real windows." · then "Clicks pass straight through — except on the dog." |
| 6 | 1:00 | "Windows are its terrain." *(cut with the shot if terrain isn't built)* |
| 7 | 1:15 | "Pet it — touch sensor or mouse." |
| 8 | 1:30 | "Typing? It lies down beside you." · then "No break in a while? It brings the ball." |
| 9 | 1:45 | "Hold the button and talk to it." · then "ElevenLabs speech → Gemini → the dog obeys" |
| 10 | 1:55 | "Idle → it naps on the taskbar." · then "60 fps → 5 fps while it sleeps" *(FPS overlay visible)* |
| 11 | 2:10 | "No triangle mesh." · "Body: signed distance field" · "Coat: Gaussian splats" · "~1–3 ms per frame" |
| 12 | 2:40 | **Diagram card:** "Photo → Gemini dog spec → SDF body + splat coat → animated in code → Electron overlay · ElevenLabs · Arduino" |
| 12b | 2:47 | "Any photo works:" + 2 s of right-click → Upload new dog → a different dog appears *(Daniel's feature; replaces part of 12 if short on time)* |
| 13 | 2:52 | "Zoomies. One photo. Your dog, on your desktop." + "StormHacks 2026 · Huawei Fetching Reality" |

## Recording checklist

- [ ] Clean desktop: hide icons, plain wallpaper, close notifications (Focus Assist on), taskbar visible.
- [ ] Launch with demo timers (`$env:ZOOMIES_DEMO=1; npm run dev` — idle 8 s, asleep 20 s, break due 90 s) so idle/sleep/break reactions happen within the shot.
- [ ] Record each shot separately (OBS or Xbox Game Bar `Win+Alt+R`), 2–3 takes each; keep the FPS overlay on for 2, 10, 11.
- [ ] Phone video of the controller in hand for 2, 7, 9 — same takes as the screen recording (clap once at the start to sync).
- [ ] Record the squeak/chirp audio from the room for 2 (the buzzer is the point).
- [ ] Final check: ≤ 3:00, all captions readable at phone size, no keys/`.env`/terminal with secrets visible in any frame.
