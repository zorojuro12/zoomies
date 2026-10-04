"""Combine several model answers into one robust spec.

Numbers: the MEDIAN (one wild answer cannot win). Ear/tail types: majority vote, ties go to the
first answer. Colours: per-channel median in RGB. The result is always a normalised spec.
"""
from collections import Counter

from . import spec_defs as sd
from .colors import hex_to_rgb, rgb_to_hex


def median(values: list[float]) -> float:
    if not values:
        raise ValueError("median of no values")
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2


def _vote(values: list[str]) -> str:
    counts = Counter(values)
    best = max(counts.values())
    return next(v for v in values if counts[v] == best)  # first answer among the leaders


def aggregate_specs(specs: list[dict]) -> dict:
    if not specs:
        raise ValueError("no specs to aggregate")
    specs = [sd.normalize_spec(s) for s in specs]
    out = {
        "name": specs[0]["name"],
        "sourcePhoto": specs[0]["sourcePhoto"],
        "size": round(median([s["size"] for s in specs]), 4),
        "proportions": {
            k: round(median([s["proportions"][k] for s in specs]), 4) for k in sd.PROPORTION_KEYS
        },
        "earType": _vote([s["earType"] for s in specs]),
        "tailType": _vote([s["tailType"] for s in specs]),
        "colors": {},
    }
    for k in sd.COLOR_KEYS:
        rgbs = [hex_to_rgb(s["colors"][k]) for s in specs]
        out["colors"][k] = rgb_to_hex(tuple(int(round(median([c[i] for c in rgbs]))) for i in range(3)))
    return sd.normalize_spec(out)
