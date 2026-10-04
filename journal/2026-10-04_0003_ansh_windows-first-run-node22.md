# 2026-10-04 — ansh — Windows first run: Node 22, all checks green, .env in place

**Status:** P0 done on the Windows demo laptop. `npm install`/`typecheck`/`lint`/`test` (237/237)/`build`/`dev` all pass on Node 22.22.0. `.env` created locally with Gemini + ElevenLabs keys (gitignored, confirmed via `git check-ignore`). Working tree clean; new branch `a/p1-overlay` cut off `dev` and pushed so P1 work (and the WSL Claude session) doesn't land on `dev` directly.
**Decided:** Pin Node to 22+ on this machine — `vitest@5.0.3` requires `^22.12 || ^24`, but the Windows nvm default was still 18.18.0. Set `nvm alias default 22.22.0` so future sessions don't need `nvm use` every time.
**Spec:** Updated — `CLAUDE.md` Build-and-test section now says `npm run dev` is verified on Windows too, and states the Node 22+ requirement explicitly.
**Next:** Start P1 overlay spike (`docs/plans/a-p1-overlay.md` to write first) on `a/p1-overlay`: transparent/frameless/click-through window, Windows `OsLayer` window enumeration, overlay GPU-cost measurement (watch for Daniel's SDF dog being heavier than the placeholder — 32 shapes/ray vs 12).
**Blocked on:** Nothing.
**Touches:** `CLAUDE.md`, `.env` (local only, not committed), `app/node_modules` (fresh install)

---

## What Worked
- `npm install` succeeded cleanly once on Node 22.22.0 (nvm was already holding it, just not active/default).
- Full check suite green: typecheck (node+web), lint, 237/237 vitest, production build, and `npm run dev` launched the stock Electron window (900×670, placeholder dog) without crashing.
- `.gitignore` correctly excludes `.env`; `git status` stayed clean after creating it.

## What Didn't Work
- First `npm install` attempt ran on the machine's default Node (18.18.0) — `postinstall` (`electron-builder install-app-deps`) crashed with `ERR_REQUIRE_ESM` on `@noble/hashes/blake2.js`. Not a flaky error: vitest's own engine check had already warned Node 18 isn't supported (`^22.12 || ^24` required). Switching to `nvm use 22.22.0` before `npm install` fixed it outright — don't retry installs on Node 18 on this machine.

## Next Step
Write `docs/plans/a-p1-overlay.md` and start the overlay spike on `a/p1-overlay`.
