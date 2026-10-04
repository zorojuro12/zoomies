# Zoomies

One photo of a dog becomes an always-on desktop pet: an animated version of *that* dog
(photo-fitted SDF body + Gaussian-splat coat) that roams over your windows, keeps you
company while you work, and plays joystick-launched fetch across your screen.

StormHacks 2026 · Huawei Challenge #2 "Fetching Reality" · Ansh, Daniel, Abel

- **New to the repo? Start with [`GETTING_STARTED.md`](GETTING_STARTED.md).**
- What we're building: [`docs/specs/2026-10-03-zoomies-prd.md`](docs/specs/2026-10-03-zoomies-prd.md)
- Stack and team workflow: [`docs/tech-stack.md`](docs/tech-stack.md)
- Plans: [`docs/plans/`](docs/plans/) · Session journal: [`journal/`](journal/)

## Run the app

Requires Node.js LTS. **On Windows, use Windows-native Node in a Windows clone** (not WSL) —
the overlay only works as a native Windows app.

```bash
cd app
npm install
npm run dev      # launch with hot reload
npm test         # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build    # typecheck + production build
```

Copy `.env.example` to `.env` and add keys before using Gemini/ElevenLabs features.

## Repo layout

| Path | Contents | Lane |
|---|---|---|
| `app/` | Electron app (TypeScript, Three.js) | all |
| `app/src/shared/` | Contracts between lanes | all |
| `pipeline/` | Python build-time dog reconstruction | B |
| `hardware/arduino/` | Controller sketch | C |
| `scripts/` | Helper tools (landmark picker, sound generation) | C |
| `assets/` | Photo, Gemini views, dog files, sounds | B / C |
| `docs/`, `journal/` | PRD, stack, plans, session journal | all |
