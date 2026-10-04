"""Python's copy of the dog spec rules: safe ranges, key lists, defaults and normalisation.

TypeScript (app/src/renderer/dog/spec/dog-spec.ts) is the source of truth. The numbers live in
pipeline/spec-ranges.json, and a vitest test (spec-ranges.test.ts) fails if that file and the
TypeScript ever disagree. normalize_spec behaves like TypeScript's normalizeSpec: fill defaults,
clamp every number into its range, drop junk — so a model's answer can never produce a broken dog.
"""
import copy
import json
import math
import re
from pathlib import Path

_SHARED = json.loads((Path(__file__).resolve().parent.parent / "spec-ranges.json").read_text(encoding="utf-8"))

RANGES: dict[str, tuple[float, float]] = {k: (v[0], v[1]) for k, v in _SHARED["ranges"].items()}
PROPORTION_KEYS: list[str] = list(_SHARED["proportionKeys"])
EAR_TYPES: list[str] = list(_SHARED["earTypes"])
TAIL_TYPES: list[str] = list(_SHARED["tailTypes"])
COLOR_KEYS: list[str] = list(_SHARED["colorKeys"])
DEFAULT_SPEC: dict = _SHARED["default"]

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _number(value, key: str, default: float) -> float:
    """A finite number clamped into RANGES[key]; numeric strings are accepted (models do that)."""
    if isinstance(value, bool):
        return default
    if isinstance(value, str):
        try:
            value = float(value)
        except ValueError:
            return default
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        return default
    lo, hi = RANGES[key]
    return min(hi, max(lo, value))


def normalize_spec(raw) -> dict:
    """Turn anything into a complete, safe spec (fixed key order). Never mutates its input."""
    d = DEFAULT_SPEC
    r = raw if isinstance(raw, dict) else {}
    props = r.get("proportions") if isinstance(r.get("proportions"), dict) else {}
    cols = r.get("colors") if isinstance(r.get("colors"), dict) else {}
    name = r.get("name")
    photo = r.get("sourcePhoto")
    return {
        "name": name.strip() if isinstance(name, str) and name.strip() else d["name"],
        "sourcePhoto": photo if isinstance(photo, str) and photo else d["sourcePhoto"],
        "size": _number(r.get("size"), "size", d["size"]),
        "proportions": {k: _number(props.get(k), k, d["proportions"][k]) for k in PROPORTION_KEYS},
        "earType": r.get("earType") if r.get("earType") in EAR_TYPES else d["earType"],
        "tailType": r.get("tailType") if r.get("tailType") in TAIL_TYPES else d["tailType"],
        "colors": {
            k: cols[k].lower() if isinstance(cols.get(k), str) and _HEX.match(cols[k]) else d["colors"][k]
            for k in COLOR_KEYS
        },
    }


def default_spec(name: str | None = None) -> dict:
    """A fresh copy of the default spec (the template dog), optionally renamed."""
    s = copy.deepcopy(DEFAULT_SPEC)
    if name:
        s["name"] = name
    return s
