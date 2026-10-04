# 2026-10-03 — daniel — Mac verified, P1 SDF spike planned

**Status:** `b/sdf-spike` is current with `dev` (PR #1 contracts merged). Checks on Daniel's Mac: `npm install`, 18/18 tests, typecheck, lint all green; `npm run dev` launches Electron; `/preview.html` works (pose buttons, mouse look-at, ~17 ms/frame = 60 FPS cap). Phase plan written: `docs/plans/b-p1-sdf-spike.md`. No dog code yet. Nothing pushed.
**Decided:** First chunk = a new `SdfDog` (ray-marched SDF body) behind `DogView`/`DogController`, rendered in a three-quarter view, with yaw following direction of travel (incl. up/down the screen). Keep the 2D desktop stage; the dog itself is true 3D.
**Spec:** No change to PRD or contracts. Lane B plan gains a phase file (`b-p1-sdf-spike.md`).
**Next:** Daniel says go → T1 screenshot harness (so Claude can see renders), T2 SDF maths + tests, T3 `SdfDog` first light.
**Blocked on:** Nothing. `npm run dev` picked port 5174 because 5173 was already in use by another process.
**Touches:** `docs/plans/b-p1-sdf-spike.md`, `app/src/renderer/dog/` (planned)

---

## What Worked
- First Mac run of the app (CP0 item): Electron window opens, placeholder dog visible, preview page controls work. Safe to tell Ansh to update the "not yet verified on Mac" line in `CLAUDE.md` (his file).
- Screenshot from Daniel shows: dog ~110 px tall, flat-shaded, only two legs visible in the pure side view.

## Decisions Made
- **Three-quarter view** — reason: a pure side view hides the far legs/ear and looks flat; ~25° yaw reads as 3D.
- **Direction → yaw, no scale-by-height** — reason: Daniel wants the dog to look like it runs away from/toward the viewer for the ball; scaling by screen y would shrink a dog standing on a high window.
- **Temporary bridge to `PlaceholderDog` motion** — reason: reuse poses/walk/jump now, replace with our own skeleton + gait next phase, no edits to Ansh's files.
- Contract question to settle at T3: how to toggle placeholder/SDF in the preview page (`preview.ts` is Ansh's).

## Test Coverage
- **Covered:** existing 18 contract tests only.
- **Not covered yet:** all of Lane B's new code. T2 adds SDF-maths tests first.

## Next Step
T1 screenshot harness → T2 → T3 (see `b-p1-sdf-spike.md`).
