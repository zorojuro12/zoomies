# 2026-10-04 — daniel — P3 serial phase B: the reader (no hardware needed to build)

**Status:** Serial reader built and tested with fake ports and a fake clock; not yet wired into the app (Phase C) and never run against the real board. Branch `a/p3-serial-transport`, stacked on `a/p3-serial-reader` (#28). 42 new tests, whole suite green, lint clean.
**Decided:** 6 s of silence = dead connection (board sends HELLO every 2 s); try every port, Arduino-looking USB ones first, claim only the one that says `HELLO:zoomies:1`; `serialport` added to `package.json` (Ansh runs `npm install` on Windows).
**Spec:** No change (implements contract §3.7 as written).
**Next:** Phase C wiring (main registers the reader, preload `onInput`/`onSerialStatus`/`buzz`, `main.ts` handles events, HUD status, double-click = call), then the Windows run with Abel's breadboard.
**Blocked on:** Nothing to build; the real-board check needs Windows + the breadboard. Ansh to run `npm install` (new dependency `serialport`).
**Touches:** `app/src/main/hardware/{line-splitter,serial-reader,serial-driver}.ts` (+tests), `app/package.json`, `docs/plans/a-p3-serial.md`

---

## What it does
- `LineSplitter`: glues byte chunks into lines, handles `\r\n`, drops over-long junk (64 chars) without buffering it.
- `SerialReader`: lists ports, probes one at a time (3 s each) for HELLO, claims that one, closes the rest; feeds lines to `ControllerMapper`; ticks it every 50 ms; silence watchdog; close/error = unplug; reconnect with 2→5 s backoff; resets the mapper on loss (ends push-to-talk); `send()` writes buzzer lines; never throws.
- `serial-driver.ts`: thin real wrapper, `serialport` loaded lazily via a variable specifier so typecheck passes before install and the app still starts without it.

## What Worked
- Tests first (red, then green), 18 splitter + 24 reader tests incl. 20,000-chunk fuzz and a 3,000-step reader fuzz, 30 unplug/replug cycles.
- Mutation checks, all caught: no watchdog, claim-any-line, no mapper reset on loss, stale-connection guard removed, retry backoff not reset, splitter off-by-one.

## What Didn't Work
- First reconnect tests waited 5.5 s before the board said HELLO, but the 3 s probe had already closed the port; fixed the test timing (replug at ~2.1 s), not the reader.
- `sed -i` flags differ on macOS; used perl.

## Test Coverage
- **Covered:** all reader logic with fakes.
- **Not covered:** the real `serialport` wrapper (no logic, but untested), real Windows COM ports, a real board, whether the Arduino resets on port open (an Uno reboots when opened, so HELLO may take ~2 s: probe window is 3 s).
- `npm run typecheck` shows 2 pre-existing errors on this Mac (koffi, uiohook-napi not installed), none from this work.
