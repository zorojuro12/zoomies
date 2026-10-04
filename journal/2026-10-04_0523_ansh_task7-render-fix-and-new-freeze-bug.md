# 2026-10-04 — ansh — Task 7 render-order + oscillation bugs fixed; new freeze bug blocks handoff to Daniel

**Status:** Fixed two of three bugs blocking Task 7 Checkpoint 3. (1) Render-order bug: ball now visibly falls/bounces/settles in front of the dog — manually confirmed. (2) Stuck-oscillation bug: a resting ball under a window flush with the floor now escapes upward instead of vibrating forever — fixed in code with a new passing regression test (510/510 total). (3) **New, unresolved:** shortly after restarting the app to re-verify, the ball disappeared and the dog stopped reacting to the cursor — not yet root-caused. Handing off to Daniel per Ansh's request; diagnostics are left in place in the code.
**Decided:** Commit and push the in-progress fixes plus full documentation of the open bug (with captured logs and a hypothesis) rather than keep debugging solo — Daniel will pick up the third bug. Per project convention, Checkpoint 3 Step 2/3 stay unchecked in the plan; nothing is claimed as passing that isn't.
**Spec:** No change.
**Next:** Daniel (or next session) adds `vy` and raw `frameMs`/`dt` to the `[diag]` logs in `main.ts` to confirm/refute the NaN-substep-loop hypothesis below, then fixes bug 3, then re-runs the full manual Checkpoint 3 pass (fall/bounce/settle, drag-under, drag-over) clean before ticking it off.
**Blocked on:** Bug 3 (ball/dog freeze), root cause unknown.
**Touches:** `app/src/renderer/world/{ball.ts,ball.test.ts,world-view.ts}`, `app/src/renderer/main.ts`, `app/src/main/index.ts`, `docs/plans/a-p1-overlay.md`

---

## What Worked

- **Render-order fix:** gave the ball mesh `transparent: true, depthTest: false, depthWrite: false` in `world-view.ts`, matching the pattern `SdfDog.ts` already uses for its own skeleton-debug overlay. Three.js draws opaque and transparent objects in two separate passes regardless of `renderOrder`; the dog's SDF quad is transparent, so a plain opaque ball mesh was always drawn in the earlier pass and lost regardless of its `renderOrder` value. Manually confirmed on the Windows laptop: ball visible the whole fall, settles correctly at the dog's feet.
- **Diagnosing the stuck-oscillation bug without guessing:** wrote a scratch vitest file (`_debug-repro.test.ts`, deleted after use) that called the real `createBall`/`stepBall`/`World`/`worldSolids` directly with a window rect clipped flush against the floor, logged each step, and got hard proof: the ball alternates *exactly* between two positions (790/810) forever, `resting` never latching because `contactMs` keeps getting reset by the alternation. This is the same class of "prove it with the real functions in isolation, not by guessing in the live app" technique from last session's render-order diagnosis — reusable again.
- **The fix:** in `resolveCollision` (`ball.ts`), after the normal-based push, if the ball is still penetrating (the degenerate case — a solid's edge exactly coincides with another solid/boundary, so the single nearest-edge gradient can't converge), march straight up in small fixed steps (`BALL.escapeStepPx = 4`, capped at `BALL.escapeMaxSteps = 150`) until clear. Verified against the repro: ball now climbs to rest exactly on top of the window (y=640, window top at 650, radius 10) instead of oscillating. Added as a permanent test in `ball.test.ts`.
- **Re-using the `console-message` forwarding trick** from last session (noted there as reusable) immediately once the ball/dog went unresponsive — confirmed it's still the right tool for seeing renderer console output from this unfocusable overlay.

## What Didn't Work

- **Assuming "the ball doesn't react" meant nothing happened.** The user's manual test (drag a window fully over the resting ball) actually did trigger the collision code every single substep — it just oscillated in a visually-small 20px band the eye read as "frozen," not "reacting incorrectly." Don't assume "no visible change" means "no code ran" — the automated repro proved code *was* running, just wrong.
- **The third bug is NOT root-caused yet** — don't assume it's simply "the escape march is buggy." The captured log shows the march firing once (explaining the two ~600px jumps, since `150 * 4 = 600` matches exactly), which is *expected* behavior if something at the ball's spawn point genuinely sits inside a solid taller than 600px (plausible: Lane A's own terminal/Claude Code window could easily be onscreen at that position and more than 600px tall, and isn't excluded from the real window list). What's NOT explained by the march alone is why the ball then goes **permanently inert** — frozen byte-identical in both x and y for 960+ frames (16+ seconds) with `resting: false` logged throughout. A non-resting ball should keep integrating gravity and moving every frame; freezing implies `stepBall`'s substep loop stopped doing anything, which smells like `numSubsteps` becoming `NaN` (`Math.max(1, Math.ceil(dt / substepMs))` — if `dt` is `NaN`, the `for` loop's `i < NaN` is always false, so the whole function silently no-ops forever). This has **not been confirmed** — `vy` and the raw `frameMs`/`dt` were not logged in this session's diagnostic pass. Don't re-chase "the march is wrong" without first checking this.
- Did not have time this session to add the `vy`/`dt` logging and finish root-causing bug 3 — ran out of runway before the deadline and the user wanted to hand off to Daniel instead of continuing solo.

## Test Coverage

- **Covered:** ball physics incl. the new oscillation-escape case (`ball.test.ts`, 8/8 tests). Full suite 510/510, typecheck clean.
- **Not covered, and currently broken per manual check:** the live-overlay freeze (bug 3) — no automated test exists for it yet since the root cause isn't known. Whoever picks this up should write a repro test once the cause is confirmed, same as bug 2's repro-first approach.

## Open Questions / Blockers

- Is bug 3 actually new, or was it latent and only surfaces after several `npm run dev` restarts in a row (we restarted the app ~5 times this session testing bugs 1 and 2 — possible stale/orphaned `electron.exe` processes, though `taskkill //F //IM electron.exe` was run before every restart)?
- Confirm the `NaN`-substep hypothesis: add `console.log('[diag] frameMs', frameMs, 'vy', ball.vy)` right where the existing `[diag] frame N` log is in `main.ts`, reproduce, and check whether `frameMs` or `vy` is ever `NaN`/`Infinity`.
- If the hypothesis is wrong: check whether the ball spawn point (768, 624 in the captured log) is colliding with a real on-screen window (e.g. this very terminal/editor) that's taller than 600px — that would explain the march maxing out, separately from the freeze.
- The temporary `[diag]` console.logs in `main.ts` and the `console-message` forwarder in `main/index.ts` are **left in the code on purpose** for Daniel to continue from — don't revert them as "cleanup" before this is actually fixed.

## Relevant Commits

- (this session's commit — render-order fix, oscillation fix + test, plan doc update, diagnostics left in place)
