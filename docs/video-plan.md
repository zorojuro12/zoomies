# Zoomies — Demo Video Plan (≤ 3:00)

Draft by Ansh (covering for Abel, Lane C). Abel owns the final cut, voice-over and Devpost upload.

**Rules:** ≤ 3:00 total. First 15 s must already show the dog fetching the ball; judges may
stop there. Every claim on screen is something the app really does in the recording (no
mock-ups). Record on the **Windows demo laptop** (plugged in, high-performance GPU),
1920×1080, FPS overlay on unless a shot says otherwise.

**Updated 2026-10-04 (Ansh):** rewritten against what's actually built today, after P3 landed
(real hardware controller, voice commands, live photo-to-dog generation). Three shots from the
original draft are cut, not just flagged 🔜 — mid-air catch, riding a dragged window, and the
step-out-of-photo opening are genuinely not built, and there isn't time left to build them
before recording. Their time budget moved to the new live dog-generation shot, which is real,
working, and a stronger moment than any of the three would have been anyway.

**Status key:** ✅ works now, verified on Windows with the real hardware where hardware is
involved · ❌ cut from this video (not built; see note above).

---

## Shot list

| # | Time | Shot | What's on screen | Capture | Status |
|---|---|---|---|---|---|
| 1 | 0:00–0:15 | **Hook: joystick fetch** | Hand pulls joystick back (phone video, split-screen) → release → ball ricochets off real windows/taskbar, settles → dog runs to it, picks it up, brings it back → **squeak in the hand** | Screen rec + phone | ✅ real controller, `ZOOMIES_INVERT_Y=1` |
| 2 | 0:15–0:25 | **Title card** | "Zoomies — one photo of a dog becomes a real pet on your desktop" + team names, over the dog trotting back with the ball | Edit | — |
| 3 | 0:25–0:55 | **It builds YOUR dog, live, from a photo** | Right-click the dog → "Upload new dog…" → pick a photo → the progress card ticks through its real steps ("Reading your photo" → "Asking Gemini what your dog looks like" → "Combining the answers" → "Matching colours to your photo" → "Building your dog") → the new dog appears in place. Repeat once more with a second, very different-looking dog photo, cut quickly between the two results | Screen rec | ✅ live Gemini pipeline, real photos, no mock-up |
| 4 | 0:55–1:10 | **It's *that* dog** | Switch back to the hand-tuned Aussie spec; photo and dog side by side; slow turn; point out the blaze, copper points, ear shape | Screen rec | ✅ |
| 5 | 1:10–1:30 | **Lives on your real desktop** | Dog follows the cursor (head + eyes); click-through: clicking/typing in apps right behind it works; open/move a few windows and show the dog's world SDF tracking them live (debug view) | Screen rec | ✅ |
| 6 | 1:30–1:45 | **Petting** | Touch sensor (phone) → dog lies down, the hand strokes it; same via a mouse click | Phone + screen | ✅ |
| 7 | 1:45–2:00 | **Keeps you company** | Start typing steadily → dog lies down near the active window; go idle → sits, looks around; ~50 s no break (demo timers) → brings the ball + play-bow | Screen rec | ✅ `ZOOMIES_DEMO=1` |
| 8 | 2:00–2:10 | **Voice** | Hold the controller button (or space), say "sit" → HUD shows "listening…" then the transcript → dog sits | Phone + screen | ✅ real ElevenLabs STT + Gemini |
| 9 | 2:10–2:25 | **Sleep + efficiency** | Keep idling → dog walks to the taskbar, curls up, snores; **HUD FPS tier drops 60 → ~5**; move the mouse → wakes, stretches, greets | Screen rec (HUD visible) | ✅ |
| 10 | 2:25–2:50 | **Technique reveal (x-ray)** | Toggle the debug view: SDF primitives under the coat, then the splat coat on top; HUD frame time **0.8 ms avg** on the real demo GPU; line: "no triangle mesh anywhere" | Screen rec | ✅ |
| 11 | 2:50–2:58 | **How it's built** | Fast diagram: photo → Gemini dog spec → fitted SDF body + splat coat → animated in code → Electron overlay reading real window rects; ElevenLabs voice; Arduino controller | Edit (slide) | — |
| 12 | 2:58–3:00 | **Close** | Dog drops the ball at the cursor, wags, looks at camera; logo + "StormHacks 2026 · Huawei Fetching Reality" | Screen rec + edit | ✅ |

**Cut from this video (not built, don't attempt live):** mid-air catch (the dog only ever
catches a ball that's already come to rest — ground pickup, not a leaping catch); riding a
dragged window as moving terrain; the opening "dog climbs out of the photo frame" animation.
None of these exist in the code; don't improvise a take hoping it half-works.

## Voice-over script (~150 wpm, ≈ 380 words)

**[0:00 — shot 1, no VO for the first 3 s, let the squeak land]**
"Pull back. Let go."

**[0:15 — title]**
"Zoomies turns one photo of a dog into a real pet that lives on your screen."

**[0:25 — shot 3]**
"Give it any photo, and it builds that dog — for real, live, right now. Gemini reads the
proportions and the markings; we fit the shape and match the colours. Different dog, same
pipeline, no mock-up."

**[0:55 — shot 4]**
"This one's ours — the markings, the ears, the copper points, all measured from the photo."

**[1:10 — shot 5]**
"It lives on your real desktop. It watches your cursor, it knows where your windows are — but
it never gets in the way. Every click goes straight through to the app underneath, unless
you're touching the dog."

**[1:30 — shot 6]**
"You can pet it — with the touch sensor on our controller, or just a click."

**[1:45 — shot 7]**
"While you work, it keeps you company: lies down next to you while you type, and if you
haven't taken a break in a while… it brings you the ball."

**[2:00 — shot 8]**
"Hold the button and talk to it — real speech-to-text, real language understanding, turned
into one of seven commands it actually obeys."

**[2:10 — shot 9]**
"Leave it alone and it naps on the taskbar — and drops from sixty frames a second to five, so
it costs almost nothing while it sleeps."

**[2:25 — shot 10]**
"Under the fur there's no mesh. The body is a signed distance field — smooth shapes fitted to
the photo — and the coat is a Gaussian splat. Measured cost: eight tenths of a millisecond a
frame, on the real hardware."

**[2:50 — shot 11]**
"Photo in, Gemini, our fitter, an Electron overlay that reads your real windows, ElevenLabs
for its voice, an Arduino for the joystick and the squeak."

**[2:58 — shot 12]**
"Zoomies. Any photo. A real dog — on your desktop."

## Recording checklist

- [ ] Clean desktop: hide icons, plain wallpaper, close notifications (Focus Assist on), taskbar visible.
- [ ] Launch with **both** flags: `$env:ZOOMIES_DEMO=1; $env:ZOOMIES_INVERT_Y=1; npm run dev` —
  demo timers (idle 8 s, asleep 20 s, break due ~90 s) *and* the joystick direction fix for
  this specific board. Forgetting `ZOOMIES_INVERT_Y` throws the ball backwards on camera.
- [ ] Pick 2-3 real dog photos ahead of time for shot 3 — ideally dogs that look visibly
  different from each other and from the Aussie, so the "it's not just templated" point reads
  clearly on screen. Confirm each one actually works in a dry run before the real take (a bad
  photo or a Gemini outage falls back to the default template dog, which looks fine but isn't
  the point of the shot).
- [ ] Record each shot separately (OBS or Xbox Game Bar `Win+Alt+R`), 2–3 takes each; keep the
  HUD visible for shots 1, 9, 10.
- [ ] Phone video of the controller in hand for shots 1, 6, 8 — same takes as the screen
  recording (clap once at the start to sync).
- [ ] Record the squeak/chirp audio from the room for shot 1 (the buzzer is the point).
- [ ] Final check: ≤ 3:00, captions on the VO, no keys/`.env`/terminal with secrets visible in
  any frame — the pipeline's own progress card and HUD never show the Gemini/ElevenLabs keys,
  but double-check nothing else in frame does either.
