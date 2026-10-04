# 2026-10-04 — ansh — SDF dog GPU cost measured on Windows: ~8x the placeholder, stutters to 150ms

**Status:** Measured. Using the corrected method from `2026-10-04_0041_ansh_dev-sync-gpu-measure-method.md` (isolated Chrome profile, `--disable-gpu-vsync --disable-frame-rate-limit`, WebGL hardware-accelerated confirmed via `chrome://gpu`), on the Windows demo laptop:

| | avg | p95 | max | GPU (Task Manager) |
|---|---|---|---|---|
| `preview.html` (placeholder, 12 shapes/ray) | 1.27 ms | 1.5 ms | 6 ms | not maxed |
| `preview.html?dog=sdf&spec=aussie` (real dog, 32 shapes/ray), running | 10.12 ms | 121.9 ms | 153.5 ms | 100% |

**Decided:** This crosses the "> 8 ms → tell Daniel now" line from the 0041 journal's read-the-numbers guide. Not just average cost — the placeholder never stutters past 6 ms; the SDF dog spikes repeatedly to 100+ ms under full GPU load, which would be very visible jank at 60 FPS. Needs Daniel's bounding-sphere early-out (or fewer march steps / half-res) before this goes anywhere near the real overlay.
**Spec:** No change.
**Next:** Tell Daniel these numbers (DM, per team's usual channel — not done by me, no messaging tool wired to him from this session). Once he's applied an optimization, re-measure with the same method before writing it into `docs/plans/a-p1-overlay.md`'s GPU-cost decision (full-screen overlay vs. dog-following window).
**Blocked on:** Daniel's optimization pass; re-measurement after.
**Touches:** `journal/`, `docs/plans/lane-a-ansh.md` (P1 GPU-cost bullet, not yet edited), `docs/plans/a-p1-overlay.md` (not yet written)

---

## What Worked
- The corrected method (separate perf-flagged Chrome profile, vsync off, hardware acceleration confirmed) produced self-consistent numbers: placeholder's `n` (6309 samples / 8s ≈ 788 Hz average interval) matches its reported 788.5 fps: Chrome genuinely ran uncapped. The dog's `n=789` over the same 8s window confirms sampling covered the full window, not a partial/stalled page.
- GPU % in Task Manager (100% during the SDF run, not maxed during placeholder) independently corroborates the frame-time numbers — this isn't a sampling artifact, the GPU really is the bottleneck.

## What Didn't Work (earlier this session, now resolved)
- First attempt ran the console snippet on `chrome://gpu` by mistake (navigated there to check hardware acceleration, didn't open a new tab) — `MutationObserver.observe(null)` threw `TypeError`. Fixed by re-navigating to the preview URL and re-running.
- (Carried over from 0041): reading the on-screen "ms" status with normal vsync-capped Chrome only detects dropped frames, not real render cost — this whole measurement redo existed because of that.

## Test Coverage
- **Covered:** aussie spec, "run ↔" animation, uncapped/hardware-accelerated conditions.
- **Not covered:** other specs (default/golden/greyhound — aussie was the one flagged in Daniel's motion journal as "still stilted" but not necessarily the heaviest); idle/stand cost; the real transparent full-screen overlay (can't measure until the overlay window exists — first task of the actual P1 plan); 200% zoom worst-case (0041 suggested this, not yet run).

## Next Step
1. Send Daniel the table above.
2. After his fix, re-run the same method (placeholder baseline + SDF dog) and record the delta.
3. Feed the final numbers into `docs/plans/a-p1-overlay.md`'s overlay-cost decision once that plan is written.
