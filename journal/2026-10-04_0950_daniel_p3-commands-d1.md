# 2026-10-04 — daniel — P3 commands D1: the dog obeys seven commands (no AI yet)

**Status:** `{kind:'command', text}` now does something: sit, lie down, come, fetch, speak, good boy, trick; unknown text = head tilt. Clickable button bar + text box (windowed host). Tested; checked by eye (Lie down button -> the dog lies down). Branch `a/p3-commands`, stacked on `a/p3-serial-wiring` (#33).
**Decided:** The real pipeline is the PRD's: hold button -> mic (only while held) -> ElevenLabs STT -> Gemini function calling -> one of the command tools -> dog. The fixed word list built here is the fallback (PRD guardrail), not the main path. Phases D1 (this), D2 Gemini, D3 audio. `play_trick` = our idle tricks (yawn, sniff, shake) in rotation. `go_to(window)` dropped (dog cannot stand on windows yet; terrain is its own go/no-go).
**Spec:** No change (PRD §4.7/§4.8 followed; `command` event already in contract §3.6; the text carries the tool name so Gemini can reuse it).
**Next:** D2 Gemini function calling in the main process (needs the Gemini key in `.env`, already there), then D3 audio (ElevenLabs key now in gitignored `.env` too).
**Blocked on:** Nothing for D2. D3 needs a mic and Windows/Electron audio capture test.
**Touches:** `app/src/renderer/behaviour/{commands,behaviour,cues}.ts` (+tests), `app/src/renderer/host/command-bar.ts`, `app/src/renderer/main.ts`, `app/src/main/overlay-window.ts`, `docs/plans/a-p3-serial.md`

---

## What Worked
- Parser tests-first (43), whole words only ("situation" is not sit), first command word wins, round-trips every tool name; 5,000-string fuzz.
- Behaviour: 13 scenario tests + a 3,000-random-command fuzz; commands never interrupt a fetch; a new command replaces the old one with its own full hold; commands count as attention and wake a sleeping dog.
- Mutation checks: never-ends, same-trick, sit-hold, no-replace, no-attention all caught (the last two only after I tightened weak tests; "no fetch guard" is equivalent: the arbiter already refuses).
- By eye: button click -> dog lies down.

## What Didn't Work
- The old test "command text is ignored for now" encoded the placeholder; removed.
- Lie-down test first failed because the demo dog sits by itself when idle; fixed by keeping the user active in the test.
- Harness `--click` missed the buttons; a programmatic click in `--eval` worked.

## Test Coverage
- **Covered:** parser, behaviour reactions, cues, labels.
- **Not covered:** the DOM bar (no DOM test env; checked by eye), overlay click-through over the bar (needs Windows), typed box in the overlay (overlay window is `focusable:false`, so no text box there: buttons only).

## Secrets
ElevenLabs key pasted in chat was written only to the gitignored `.env` (both clones). Daniel should rotate it after the hackathon since it was shared in chat.
