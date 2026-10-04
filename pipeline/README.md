# Pipeline (Lane B — Daniel)

Build-time reconstruction: photo → cut-out → landmarks → SDF placement → (fitting) → coat colours → `assets/dog/*.dog.json`.
See `docs/plans/lane-b-daniel.md`.

## Setup

```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest
```

Keys come from the repo-root `.env` (`GEMINI_API_KEY`).
