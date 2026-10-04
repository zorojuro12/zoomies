# 2026-10-03 — daniel — Step C done: three very different dogs from one builder

**Status:** Step C of `docs/plans/b-p2-spec-and-motion.md` complete. `assets/dog/golden.spec.json` (short-legged, long-bodied, floppy-eared golden) and `assets/dog/greyhound.spec.json` (tall, slim, long-snouted grey, curled tail) render through the same `buildDog` with **zero code changes**, next to the Aussie and the default. New regression test checks every `*.spec.json` in `assets/dog/`. 132/132 tests, lint, Prettier, typecheck green. Committed on `b/sdf-spike`, not pushed.
**Decided:** The photo-agnostic claim is now demonstrated, not just designed. Every checked-in spec must (a) build a valid dog with the paws on the ground, (b) contain no number that gets clamped, (c) contain no colour that gets replaced — this is also the safety net for Gemini-generated specs.
**Spec:** No change to contracts or PRD.
**Next:** PR 1 into `dev` (merge `origin/dev`, run checks, push, PR with a merge commit), then tell Ansh he can swap `PlaceholderDog` → `SdfDog`. Then step D (own motion).
**Blocked on:** Daniel's go to push; Daniel still undecided on keeping the Aussie as the demo dog (not blocking).
**Touches:** `assets/dog/{golden,greyhound}.spec.json`, `app/src/renderer/dog/spec/spec-files.test.ts`

---

## What Worked
- Golden: long low body, short legs, one large floppy ear, golden colours — reads as a clearly different dog. Greyhound: tall legs, long neck and snout, curled tail held high, grey colours.
- **Mutation check:** an out-of-range `legLength: 9` and an invalid colour `"goldish"` each made exactly 1 test fail; the file was restored identical.

## What Didn't Work / Limits
- The greyhound extreme looks stilted (very long legs and neck, thin body); the ranges allow it but it is not pretty. Consider narrowing `legLength` max (1.7) and `neckLength` max (1.6) later if Gemini produces odd dogs.
- Still no fluffy coat and the motion is the placeholder's (step D / G).

## Test Coverage
- **Covered:** all `assets/dog/*.spec.json` build valid dogs; paws on the ground; nothing clamped; colours valid; required demo files exist.
- **Not covered:** how the dogs look (by eye).

## Next Step
PR 1, then step D.
