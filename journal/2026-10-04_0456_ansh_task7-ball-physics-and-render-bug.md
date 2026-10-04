# 2026-10-04 — ansh — Task 7 ball physics done; Checkpoint 3 blocked on a render-order bug

**Status:** Task 7 Checkpoints 1&2 (ball physics math, via a fork) fully done: `createBall`/`stepBall` against the `World` SDF, 509/509 tests, committed (`b199839`, `c43d706`). Checkpoint 3 (ball visible in the live overlay) is **not done** — physics is confirmed correct by direct measurement, but the ball doesn't render visibly: invisible while falling, appears behind the dog's feet once it settles. WIP code committed as `3a86b87` with the bug documented in `docs/plans/a-p1-overlay.md` rather than silently claiming the checkpoint passed.
**Decided:** Don't fake the checkpoint as done. Left Checkpoint 3's Step 2/3 unchecked in the plan with a detailed bug note and a concrete next step to try, so whoever picks this up (me next session, or Daniel/Abel if I hand it off) doesn't have to re-diagnose from scratch.
**Spec:** No change.
**Next:** Fix the ball's render-order/depth-test interaction with the dog's SDF material (see Open Questions), re-verify Checkpoint 3 by hand, then Task 8 (mouse slingshot) and Task 9 (CP1 wrap-up).
**Blocked on:** Nothing externally — just needs the render-order bug fixed.
**Touches:** `app/src/renderer/world/{ball.ts,world-view.ts}`, `app/src/renderer/main.ts`, `docs/plans/a-p1-overlay.md`

---

## What Worked

- **Forking Task 7 Checkpoints 1&2** (ball physics math) worked the same way Task 6's fork did: clean TDD, 7/7 new tests, one judgment call it flagged itself (reflection math written as an equivalent single-pass decomposition rather than literally subtract-then-scale — verified by hand against the vertical and horizontal test cases before trusting it).
- **Diagnosing "the ball disappeared" without guessing:** renderer `console.log` doesn't reach the terminal running `npm run dev` (it only goes to DevTools, which the unfocusable overlay can't easily show). Fixed by temporarily adding `win.webContents.on('console-message', (_e, _level, message) => console.log('[renderer]', message))` in `main/index.ts` — forwards every renderer console line into the terminal I can actually read. This turned "I don't see it, did it disappear?" into hard data in under a minute: logged `ball.x/y/vy/resting` once a second, saw it fall, bounce, and settle at `y:834` (right at the taskbar edge) with `resting: true`. **This is a reusable technique for this project** — re-add that one line whenever a renderer-side bug needs console output and DevTools isn't practical (the overlay can't take focus, so F12 doesn't work there either; `ZOOMIES_DEVTOOLS=1` opens a detached DevTools window as the other option).
- That diagnostic conclusively separated two hypotheses: "physics bug (ball falls forever)" vs. "render bug (ball exists but isn't visible)". It's the second one — worth remembering so nobody re-chases a physics explanation here.

## What Didn't Work

- **Ball invisible while falling, visible behind the dog once settled** — not a physics bug (confirmed by the logs above). Root cause not yet fixed. Hypothesis: `renderOrder = 10` on the ball's `MeshBasicMaterial` mesh isn't enough to guarantee it draws over the dog, because Three.js renders the **opaque** and **transparent** material buckets in a fixed sequence (opaque first, then transparent) — `renderOrder` only orders objects *within* the same bucket. The ball's material is opaque by default; the dog's SDF quad (`app/src/renderer/dog/sdf/SdfDog.ts`) is very likely transparent (alpha-blended ray-march), which would render it in the *second* bucket regardless of the ball's `renderOrder` value, visually on top of or occluding the ball depending on depth-test behavior.
- **Next things to try, in order of how cheap they are:**
  1. Set `depthTest: false` on the ball's material (keep high `renderOrder`) — forces it to always draw last/on top regardless of bucket.
  2. If that's not enough, check `SdfDog.ts`'s actual material flags (`transparent`, `depthWrite`, `depthTest`) and match the ball's bucket/depth settings to whatever makes the dog's own debug overlay (`renderOrder = 5`) reliably draw on top of the dog body — the ball just needs the same treatment at a higher number.
- My first hypothesis before the diagnostic (that the ball was still falling forever, and that `dog.lookAt(ball)` while `!ball.resting` was fighting the mouse-based `lookAt` every frame) **was wrong** — don't re-chase it. The ball does rest correctly.

## Test Coverage

- **Covered:** ball physics (`ball.test.ts`, 7 tests: falls/settles, bounce restitution ratio, apex-height loss, horizontal case, window-lands-on-resting-ball wake, dt-clamp tunnelling guard, no-energy-gain-at-rest).
- **Not covered, manual-only per policy, and currently failing:** the actual visual rendering of the ball in the live overlay — this is exactly the "visuals checked by eye" category from `CLAUDE.md`'s testing policy, and right now it fails that eye check.

## Relevant Commits

- `b199839` — feat: ball physics against the world SDF
- `c43d706` — docs: tick off Task 7 checkpoints 1-2 in the P1 plan
- `3a86b87` — wip: ball rendered in the overlay (known bug: renders behind the dog, z-order unresolved)
- `4dea4d1` — docs: record Task 7 Checkpoint 3 render-order bug in the P1 plan
