# 2026-10-04 — ansh — SDF dog GPU cost: resolved (wrong GPU + Daniel's fix). New risk: hybrid-GPU laptops

**Status:** Resolved. The original "8x cost, 150ms stutter" measurement (`2026-10-04_0102_...`) was measuring the wrong GPU — this Windows demo laptop has a hybrid AMD iGPU + NVIDIA RTX 2060, and neither Chrome nor Electron had a "High performance" GPU assignment, so both defaulted to the weak AMD chip. After forcing both to the RTX 2060 (Windows GPU-preference registry key, same one `Settings → Display → Graphics` writes to) and testing Daniel's `b/perf` branch (bounding-sphere early-out): avg 0.81ms, p95 0.9ms, n=9820 over 8s. Looks smooth in normal Chrome (vsync on) — the "still laggy" feeling reported mid-session was the vsync-disabled perf profile causing visible tearing, not a real cost problem.
**Decided:** `b/perf`'s bounding-sphere early-out is sufficient — no need for Daniel's further fallback steps (pixel-ratio cap, fewer march steps, auto-fallback). The GPU-preference issue is orthogonal to his fix and would have masked any amount of shader optimization.
**Spec:** No change.
**Next:** Tell Daniel: his fix works, PR #9 (`b/perf`) is good to merge. **New risk to track:** the GPU-preference fix only covers `chrome.exe` and this dev session's `node_modules/electron/dist/electron.exe` path on *this* machine — it will not carry over to the final `npm run build:win` output (different exe path) or to any other machine. Needs a permanent fix (ideally baked into the build, e.g. an embedded NVIDIA Optimus / AMD PowerXpress exe symbol, or electron-builder config) or at minimum a demo-day checklist step to reassign GPU preference on the actual built `.exe` before presenting. Add to `docs/plans/lane-a-ansh.md` risks table.
**Blocked on:** Nothing for now; revisit when the first `build:win` output exists.
**Touches:** `docs/plans/lane-a-ansh.md` (risks table — not yet edited), Windows registry `HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences` (local machine only, not repo-tracked)

---

## What Worked
- `chrome://gpu` before/after comparison was the definitive check: `GPU0` went from AMD (`*ACTIVE*`) to NVIDIA RTX 2060 (`*ACTIVE*`) after setting the registry key for `chrome.exe`'s full path to `GpuPreference=2;` and fully killing/relaunching Chrome (GPU selection happens at process start, not per-tab).
- Cross-checking the measured numbers against the visual "feel" caught a second, unrelated issue (vsync-off tearing) that would have otherwise been misattributed to render cost.

## What Didn't Work
- Scripting Chrome's window focus/foreground via PowerShell (`SetForegroundWindow`) to drive the manual steps was unreliable — windows opened as blank "New Tab" instead of the target URL, and focus-forcing didn't help the user actually see anything useful. Stopped trying to automate the browser blind; asked the user to drive Chrome manually instead. No real browser-automation tool is available in this session — don't retry PowerShell window-juggling for this.
- Reading frame cost from the vsync-disabled perf profile and judging "does it look laggy" from the same window conflates two different things: raw render cost (what the snippet measures) and vsync-off tearing (a visual artifact of the measurement setup itself, not of the app). Always cross-check a "still laggy" visual report against a normal, vsync-on Chrome window before trusting it as a performance signal.

## Test Coverage
- **Covered:** `b/perf`, aussie spec, running, on the correct (NVIDIA) GPU, both in the perf profile (quantitative) and normal Chrome (qualitative/visual).
- **Not covered:** `b/fur` with `?fur=0` vs fur on (Daniel's second ask, not yet run since the perf fix resolved the headline number first); other specs; 200% zoom worst case; the real overlay window (still doesn't exist).

## Relevant Commits
- None yet — this session only measured; no code changed.
