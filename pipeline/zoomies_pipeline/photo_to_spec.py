"""photo -> dog spec. Show Gemini a dog photo, get back a spec (proportions, ear/tail type, colours).

For robustness it asks several times IN PARALLEL (the wait is the slowest call, not the sum), gives
each call a timeout, takes the MEDIAN answer, snaps the colours to the photo's real colours, and
ALWAYS ends with a valid spec — if every call fails you get the default template dog.

    python -m zoomies_pipeline.photo_to_spec assets/photo/dog.jpeg --name aussie-gemini

Needs GEMINI_API_KEY (repo-root .env). The key is never printed or written anywhere.
"""
import argparse
import json
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from . import spec_defs as sd
from .aggregate import aggregate_specs
from .colors import dominant_colors, snap_colors

# Verified against the live model list: "gemini-2.5-flash" is listed but 404s for new keys ("no longer
# available to new users"); the API itself recommends gemini-3.8-flash.
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

_PROPORTION_HELP = {
    "bodyLength": "Torso length. 1.0 = typical; 0.7 = short and compact; 1.4 = long (dachshund-like).",
    "bodyDepth": "Chest depth, top to bottom. 1.0 = typical; 0.8 = lean (greyhound); 1.3 = deep chested.",
    "bodyWidth": "Body width / fluffiness of the torso. 1.0 = typical; 0.7 = slim; 1.3 = stocky or very fluffy.",
    "legLength": "Leg length. 1.0 = typical; 0.55 = very short legs (corgi, basset); 1.6 = very long (greyhound).",
    "legThickness": "Leg thickness. 1.0 = typical; 0.75 = slender; 1.4 = sturdy.",
    "neckLength": "Neck length. 1.0 = typical; 0.8 = short, thick neck; 1.4 = long, elegant neck.",
    "headSize": "Head size relative to the body. 1.0 = typical; 0.85 = small head; 1.25 = large head.",
    "snoutLength": "Muzzle length. 1.0 = typical; 0.6 = flat-faced (pug, bulldog); 1.6 = long (collie, greyhound).",
    "snoutWidth": "Muzzle width. 1.0 = typical; 0.7 = narrow; 1.3 = broad.",
    "earSize": "Ear size. 1.0 = typical; 0.7 = small; 1.5 = large.",
    "tailLength": "Tail length. 1.0 = typical; 0.3 = bobbed or very short; 1.5 = long.",
    "tailThickness": "Tail thickness / fluffiness. 1.0 = typical; 0.7 = thin; 1.5 = very bushy.",
}

_COLOR_HELP = {
    "coat": "main body colour",
    "chest": "chest / front of the body",
    "blaze": "stripe down the forehead (use the coat colour if there is none)",
    "muzzle": "snout / muzzle",
    "cheeks": "cheeks (use the coat colour if no markings)",
    "brows": "eyebrow spots (use the coat colour if none)",
    "legs": "legs above the paws",
    "paws": "paws",
    "ears": "ears",
    "tail": "tail",
    "tailTip": "tip of the tail",
    "eyes": "iris colour",
    "nose": "nose",
}

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "size": {
            "type": "number",
            "description": "Overall size of the dog. 1.0 = a typical medium dog; 0.6 = toy dog; 1.5 = giant breed.",
        },
        "proportions": {
            "type": "object",
            "properties": {k: {"type": "number", "description": _PROPORTION_HELP[k]} for k in sd.PROPORTION_KEYS},
            "required": sd.PROPORTION_KEYS,
        },
        "earType": {
            "type": "string",
            "enum": sd.EAR_TYPES,
            "description": "pointy = stand straight up; semi = stand up with tips folding forward; floppy = hang down.",
        },
        "tailType": {
            "type": "string",
            "enum": sd.TAIL_TYPES,
            "description": "long = ordinary; fluffy = long and bushy; stub = bobbed or very short; curled = carried curled up over the back.",
        },
        "colors": {
            "type": "object",
            "properties": {
                k: {"type": "string", "description": f"sRGB hex like #1a2b3c: {_COLOR_HELP[k]}"} for k in sd.COLOR_KEYS
            },
            "required": sd.COLOR_KEYS,
        },
    },
    "required": ["size", "proportions", "earType", "tailType", "colors"],
}

PROMPT = (
    "You are describing the dog in this photo so a 3D model of it can be built.\n"
    "Return ONLY JSON matching the schema. Every number is relative to a TYPICAL medium dog, where "
    "1.0 means 'typical'; use the guidance in each field description and be decisive (do not answer "
    "1.0 for everything — judge this dog's real breed and build).\n"
    "If the photo is front-facing, estimate side proportions (body length, leg length) from the "
    "breed and what you can see. If the tail is hidden, infer it from the breed.\n"
    "Colours must be sRGB hex values (#rrggbb) of what you actually SEE on each part, as seen in "
    "this photo (not generic breed colours)."
)

_MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def ask_gemini(image_bytes: bytes, mime: str, *, api_key: str, model: str = DEFAULT_MODEL, timeout_s: float = 15.0) -> dict:
    """One real Gemini call; returns the parsed JSON answer. (Imported lazily: tests never need it.)"""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000)))
    response = client.models.generate_content(
        model=model,
        contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime), PROMPT],
        config=types.GenerateContentConfig(
            response_mime_type="application/json", response_json_schema=RESPONSE_SCHEMA, temperature=0.2
        ),
    )
    return json.loads(response.text)


@dataclass
class SpecResult:
    spec: dict
    report: dict = field(default_factory=dict)


def _run_parallel(ask, image_bytes: bytes, mime: str, calls: int, timeout_s: float):
    """Run `calls` asks in daemon threads (a hung network call can never block exit). Returns a
    list of (ok, value_or_error_text), in call order."""
    results: list = [None] * calls

    def work(i: int) -> None:
        try:
            results[i] = (True, ask(image_bytes, mime))
        except Exception as e:  # noqa: BLE001 - any failure of one call must not stop the others
            results[i] = (False, f"{type(e).__name__}: {e}")

    threads = [threading.Thread(target=work, args=(i,), daemon=True) for i in range(calls)]
    for t in threads:
        t.start()
    deadline = time.monotonic() + timeout_s
    for i, t in enumerate(threads):
        t.join(max(0.0, deadline - time.monotonic()))
        if results[i] is None:
            results[i] = (False, f"timeout after {timeout_s:g}s")
    return results


def photo_to_spec(
    photo_path,
    name: str,
    *,
    ask,
    calls: int = 3,
    timeout_s: float = 15.0,
    snap: bool = True,
    snap_delta: float = 10.0,
    source_photo: str | None = None,
) -> SpecResult:
    """Photo -> robust spec. `ask(image_bytes, mime) -> dict` is the model call (injectable)."""
    path = Path(photo_path)
    image_bytes = path.read_bytes()
    mime = _MIME.get(path.suffix.lower(), "image/jpeg")

    answers, errors = [], []
    for ok, value in _run_parallel(ask, image_bytes, mime, calls, timeout_s):
        if ok and isinstance(value, dict):
            answers.append(value)
        else:
            errors.append(value if not ok else f"invalid answer: {type(value).__name__}")

    report: dict = {
        "calls_ok": len(answers),
        "calls_failed": calls - len(answers),
        "errors": errors,
        "fallback": not answers,
        "snapped": {},
        "palette": [],
    }
    spec = aggregate_specs(answers) if answers else sd.default_spec()

    if snap and answers:
        try:
            palette = dominant_colors(Image.open(path))
            # Only TINY corrections: a real run showed Gemini's colours were already right, and a
            # wide snap dulled the copper (the photo's small copper areas blend with black fur).
            spec["colors"], report["snapped"] = snap_colors(spec["colors"], palette, max_delta=snap_delta)
            report["palette"] = palette
        except Exception as e:  # noqa: BLE001 - snapping is a refinement; never lose the spec over it
            report["errors"].append(f"colour snap skipped: {type(e).__name__}: {e}")

    spec["name"] = name
    if source_photo:
        spec["sourcePhoto"] = source_photo
    return SpecResult(sd.normalize_spec(spec), report)


# ---- command line ---------------------------------------------------------------------------


def _load_env(repo_root: Path) -> None:
    """Read KEY=value lines from the repo-root .env into os.environ (without overriding)."""
    env = repo_root / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def _tidy(value):
    """Whole-number floats as ints, so the file matches what the editor writes (1 not 1.0)."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: _tidy(v) for k, v in value.items()}
    return value


def main(argv=None) -> int:
    repo_root = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser(description="Turn a dog photo into a dog spec with Gemini.")
    ap.add_argument("photo", help="path to the dog photo")
    ap.add_argument("--name", required=True, help="name of the spec, e.g. aussie-gemini")
    ap.add_argument("--out", help="where to write it (default: assets/dog/<name>.spec.json)")
    ap.add_argument("--calls", type=int, default=5, help="parallel Gemini calls to take the median of")
    ap.add_argument("--timeout", type=float, default=15.0, help="seconds to wait for the calls")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--snap-delta", type=float, default=10.0, help="largest colour change (CIE delta-E) the photo may make; 0 = never snap")
    ap.add_argument("--source-photo", help="path recorded in the spec, relative to assets/ (e.g. photo/dog.jpeg)")
    args = ap.parse_args(argv)

    _load_env(repo_root)
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("GEMINI_API_KEY is not set. Put it in the repo-root .env (GEMINI_API_KEY=...).", file=sys.stderr)
        return 2

    result = photo_to_spec(
        args.photo,
        args.name,
        ask=lambda b, m: ask_gemini(b, m, api_key=key, model=args.model, timeout_s=args.timeout),
        calls=args.calls,
        timeout_s=args.timeout,
        source_photo=args.source_photo,
        snap=args.snap_delta > 0,
        snap_delta=args.snap_delta,
    )
    out = Path(args.out) if args.out else repo_root / "assets" / "dog" / f"{args.name}.spec.json"
    out.write_text(json.dumps(_tidy(result.spec), indent=2) + "\n", encoding="utf-8")

    r = result.report
    print(f"model {args.model}: {r['calls_ok']}/{args.calls} calls ok" + ("  -> FELL BACK to the default dog" if r["fallback"] else ""))
    for e in r["errors"]:
        print(f"  ! {e}")
    for k, (old, new) in r["snapped"].items():
        print(f"  colour {k}: {old} -> {new} (snapped to the photo)")
    print(f"wrote {out}")
    return 0 if not r["fallback"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
