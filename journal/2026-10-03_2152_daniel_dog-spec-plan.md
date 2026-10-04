# 2026-10-03 — daniel — Photo-agnostic plan: dog spec + generic builder, ordered next steps

**Status:** T1–T4 of `b-p1-sdf-spike.md` done and committed. New phase plan `docs/plans/b-p2-spec-and-motion.md` written; T5 in `b-p1` marked as moved. No new code this entry.
**Decided:** Nothing in the code knows it is an Aussie. A dog's identity lives in a **dog spec** (JSON); a generic **TypeScript builder** turns spec → `DogFile`; Gemini (Python) later fills the spec for any photo; the Aussie spec is hand-written first. Demo-level accuracy is enough.
**Spec:** No change to PRD or contracts. Lane B plan files updated: new `b-p2-spec-and-motion.md`; `b-p1` T5 note. This revises the earlier choice of a Python builder → TypeScript builder (instant preview, Vitest-testable); Python only produces the spec.
**Next:** Step A — spec type + defaults/clamping + `buildDog(spec)` with eyes/nose/brows/cheeks/paws, tests first; preview switch `?dog=sdf&spec=<name>`.
**Blocked on:** Nothing. The photo exists at `assets/photo/dog.jpeg` (380×466, black tri-colour Aussie, sitting, facing camera); Abel is checking Huawei's Drive for a larger original.
**Touches:** `docs/plans/b-p2-spec-and-motion.md`, `docs/plans/b-p1-sdf-spike.md`

---

## Decisions Made
- **Photo-agnostic by design** (Daniel's rule) — a second, very different spec (short legs, floppy ears, golden) is the generality proof; spots/patches and non-dog bodies are out of scope.
- **Order:** A spec+builder → B Aussie spec + look check (old T5) → C second spec → PR 1 into `dev` → D own skeleton/gait/IK/poses → E pose & shape editor → F Gemini spec pipeline → G splat fur (first cut) → H polish.
- **T5 moved** — the on-screen dog is the unfitted placeholder, so a likeness check before step B would be meaningless.
- **Constraint:** until step D, the builder keeps the placeholder's 10 bone names and adds detail via extra shapes, because `SdfDog` still borrows the placeholder's motion.
- **Time budget:** ~11 h to the 9 AM feature freeze; cut order is G → reduced F → reduced E; never cut A–D.

## Open Questions / Blockers
- Abel: larger photo from Huawei's Drive? (not blocking)
- Tell Ansh when PR 1 lands so he can swap `PlaceholderDog` → `SdfDog` in the host.

## Next Step
Step A.
