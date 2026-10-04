# 2026-10-03 — daniel — Step B (part 1): Aussie spec, blaze/nose/eye fixes

**Status:** `assets/dog/aussie.spec.json` written from `assets/photo/dog.jpeg` and rendering via `?spec=aussie`: black coat, white blaze/chest/paws, cream muzzle, copper cheeks/brows/legs, semi-pricked black ears, fluffy tail. Builder fixes: blaze is now a flush forehead marking (was a bump), nose sits at the snout tip (was buried), eyes face forward (were on the extreme sides behind the cheeks). 119/119 tests, lint, Prettier, typecheck green. Committed on `b/sdf-spike`, not pushed.
**Decided:** The hand-written Aussie spec is the baseline and the fallback; the Gemini spec step (F) comes afterwards and its output is compared against it. Daniel is unsure he likes the Aussie as the demo dog — the system is photo-agnostic, so a different dog is just another spec.
**Spec:** No change to contracts or PRD.
**Next:** Daniel's verdict on the look (keep the Aussie / change dog / tune), then step C (a second, very different spec) and PR 1.
**Blocked on:** Daniel's call on the dog (not blocking step C).
**Touches:** `assets/dog/aussie.spec.json`, `app/src/renderer/dog/spec/{build-dog.ts,build-dog.test.ts}`

---

## What Worked
- Rendering the Aussie from the front exposed three real builder bugs that no earlier test covered; each got a failing test first, then a fix (73 spec/builder tests now).
  - **Nose buried:** nose centre was 26.9 but the snout tip was at 31 → invisible. Now `snoutTipX − 0.4·noseRadius`, poking ~60% of its radius past the tip.
  - **Eyes on the extreme sides:** `z = 12.8` put them behind the cheeks. Now `[12.1, −3.2, ±10]·headSize`: on the front of the head, facing forward.
  - **Blaze bump:** reach was 26.9 vs head radius 17. Now a thin plate that stays within 2px of the head surface.
- Tuned proportions after the first render (head 1.05→1.25, chest width 1.15→1.3, tail thickness 1.0→0.85).

## Test Coverage
- **Covered:** blaze flushness (2 head sizes), nose past the snout tip, eyes on the head surface and facing forward (2 face configurations), plus all earlier spec/builder tests.
- **Not covered:** overall likeness (by eye).

## Honest assessment of the look
Reads as a black tri-colour dog from the side and the front, with a real face. Not yet "this Aussie": the body is a smooth sausage with stiff straight legs, there is no fluffy coat, and the placeholder poses/gait are stiff. Those are motion (step D) and fur (step G) issues, not spec issues.

## Open Questions / Blockers
- Does Daniel want to keep the Aussie as the demo dog? Alternatives: another photo (Abel to check Huawei's Drive for a mandated photo or a larger original) → new spec only.

## Next Step
Step C, then PR 1.
