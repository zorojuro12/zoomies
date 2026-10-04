# 2026-10-04 — ansh — TODO: measure SDF dog frame time on Windows for P1 GPU-cost task

**Status:** Gap identified, not yet measured. The Windows first-run check only exercised the placeholder dog (stock Electron window, `index.html`). Nobody has measured frame time / GPU cost of Daniel's real SDF dog on Windows — `/preview.html?dog=sdf&spec=aussie`. Daniel's own journal (`2026-10-03_2338_daniel_step-d-own-motion.md`) already flagged this as untested: his dog is 32 shapes/ray vs the placeholder's 12, and he only checked vsync-capped on his Mac.
**Decided:** This measurement folds into Lane A's existing P1 task "Measure the full-screen transparent overlay cost" (`docs/plans/lane-a-ansh.md`) rather than being a separate item — same GPU-cost decision point (full window vs. dog-following small window), just needs the real dog's shape count, not the placeholder's.
**Spec:** No change.
**Next:** Run the manual measurement below on the Windows demo laptop, then feed the numbers into `docs/plans/a-p1-overlay.md` (not yet written) and update `lane-a-ansh.md`'s GPU-cost bullet.
**Blocked on:** Needs a human at the Windows keyboard — Task Manager GPU% and DevTools console require eyes on the actual screen; no browser-automation tool is wired into this session to drive it.
**Touches:** `docs/plans/lane-a-ansh.md` (P1 bullet), `docs/plans/a-p1-overlay.md` (to write), `app/src/renderer/preview.ts` (read-only — Daniel's file, do not edit without telling him)

---

## What We Worked On
Windows first-run checks (prior session, same day) only launched the stock placeholder window via `npm run dev`. That doesn't exercise Daniel's actual SDF dog rendering path, which is the thing that will actually run in the overlay. Need a second measurement pass specifically on `/preview.html?dog=sdf&spec=aussie`.

## Next Step (exact procedure)
Dev server must be running (`npm run dev` from `app/`, confirmed serving on `http://localhost:5173`).

1. Open Task Manager (Ctrl+Shift+Esc) → Details tab → find the Electron renderer process → watch its GPU column / the GPU graph in the Performance tab.
2. Open a browser to `http://localhost:5173/preview.html?dog=sdf&spec=aussie`.
3. Click **"run ↔"** a couple of times to keep worst-case animation going (idle stand under-reports cost).
4. DevTools (F12) → Console → paste:

   ```js
   (function(){
     const statusEl = document.getElementById('status');
     const times = [];
     const obs = new MutationObserver(() => {
       const m = (statusEl.textContent||'').match(/^([\d.]+) ms/);
       if (m) times.push(parseFloat(m[1]));
     });
     obs.observe(statusEl, {childList:true, characterData:true, subtree:true});
     setTimeout(() => {
       obs.disconnect();
       const n = times.length, avg = times.reduce((a,b)=>a+b,0)/n;
       const s = [...times].sort((a,b)=>a-b);
       console.log(JSON.stringify({ n, avgMs: +avg.toFixed(2), p95Ms: +s[Math.floor(n*0.95)].toFixed(2), maxMs: +s[n-1].toFixed(2), fps: +(1000/avg).toFixed(1) }));
     }, 8000);
   })();
   ```
5. Wait 8s, copy the printed JSON, note the GPU% seen in Task Manager during that window.
6. Repeat on plain `http://localhost:5173/preview.html` (placeholder dog) as the baseline to compare against.
7. Report both JSON results + GPU% readings back; write them into the P1 GPU-cost task and decide full-overlay vs. dog-following-window before CP1.

This snippet reads the page's existing per-frame status text via `MutationObserver` — no code changes to `preview.ts`, so it's safe to run without touching Daniel's lane.
