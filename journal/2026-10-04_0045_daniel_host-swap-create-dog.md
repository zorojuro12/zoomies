# 2026-10-04 — daniel — Our dog is in the app host: `createDog` + a 6-line `main.ts` swap (needs Ansh's OK)

**Status:** `b/host-swap` (off `dev`, which has PRs #5–#8): a factory `createDog(ctx, specName = 'aussie')` in `app/src/renderer/dog/create-dog.ts` (Lane B) and a small change to `app/src/renderer/main.ts` (**Lane A's file**: 6 lines added, 12 removed) so the real app host shows our Aussie instead of Ansh's `PlaceholderDog`. Verified on the actual host page (`index.html`): the dog appears, a click sends it running there and it sits facing the click. 263 TypeScript tests, lint, typecheck green. Committed locally; PR to follow, flagged for Ansh's approval of the `main.ts` change.
**Decided:** The host must never end up without a dog: (1) a missing/broken spec file → the default template dog (and the reason is reported); (2) if the SDF dog fails to start (e.g. a GPU that cannot compile the shader) → fall back to Ansh's placeholder. Both go through an `onFallback` callback (default: `console.error`).
**Spec:** No change.
**Next:** PR the swap for Ansh; real Gemini run of step F (the key is now in the gitignored `.env`); then x-ray "shapes" view; splat coat only after that, with a hard stop around 2 AM.
**Blocked on:** Ansh approving the `main.ts` change; Windows run of the host with our dog (his RTX 2060).
**Touches:** `app/src/renderer/dog/create-dog.ts` (+test), `app/src/renderer/main.ts` (Lane A, flagged)

---

## What Worked
- Test-first (`create-dog.test.ts`, 7 tests, loader injected so no browser): asks for `./dog/<name>.spec.json`; builds the dog from the loaded spec; always a valid dog file; falls back to the default dog and calls `onFallback` when the load fails; junk loader results (null, string, number, array) never throw; no fallback call when loading works. Mutation checks: swallowing the error silently broke 1 test, a wrong file-name pattern broke 1; restored identical.
- Real-host check with the screenshot harness against the bare `vite` server (port 5199, throw-away config outside the repo): the host shows the Aussie standing; `--eval "window.dispatchEvent(new MouseEvent('click', {clientX:120, clientY:300}))"` makes it run to the click and sit facing left, shadow included. No app errors in the log.

## Notes
- The Gemini API key was pasted in chat by Daniel and written to the repo-root `.env` (gitignored, `chmod 600`, never printed or committed). It is in this chat's transcript: **rotate it if the conversation is ever shared.**
- `main.ts` is Ansh's lane; the README says to tell the owner before editing another lane's files. The PR is that notice; his approval is the gate.
- The splat coat (PRD Must #2) remains unbuilt; pitch wording must stay honest ("SDF body, photo-coloured; splat coat not shipped") unless it lands.

## Test Coverage
- **Covered:** `loadDogFile` (all paths above).
- **Not covered:** `createDog`'s SDF → placeholder fallback (needs a GPU failure; checked only by reading the code) and the visual result (by eye, screenshot above).

## Next Step
Open the PR; run the real Gemini call.
