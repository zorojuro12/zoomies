"""Colour helpers. The model decides WHICH colour goes WHERE on the dog; the photo supplies the
exact paint: we find the photo's dominant colours (k-means in Lab space, background removed) and
snap each of the model's colours to the nearest real one, so we never use a colour that isn't on
the dog. Distances are CIE76 delta-E in Lab (0 = same, ~100 = black vs white).
"""
import re

import numpy as np
from PIL import Image

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def hex_to_rgb(value) -> tuple[int, int, int]:
    if not isinstance(value, str) or not _HEX.match(value):
        raise ValueError(f"not a #rrggbb colour: {value!r}")
    return int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16)


def rgb_to_hex(rgb) -> str:
    r, g, b = (max(0, min(255, int(round(c)))) for c in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB 0..255 (..., 3) -> CIE Lab (D65), vectorised."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def delta_e(a: str, b: str) -> float:
    la, lb = rgb_to_lab(np.array(hex_to_rgb(a))), rgb_to_lab(np.array(hex_to_rgb(b)))
    return float(np.linalg.norm(la - lb))


def foreground_mask(arr: np.ndarray, threshold: float = 12.0) -> np.ndarray:
    """True where a pixel is NOT the backdrop. The backdrop colour is the median of the image's
    border ring (studio photos have a plain backdrop)."""
    h, w = arr.shape[:2]
    t = max(2, min(h, w) // 16)
    ring = np.concatenate([arr[:t].reshape(-1, 3), arr[-t:].reshape(-1, 3), arr[:, :t].reshape(-1, 3), arr[:, -t:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    return np.linalg.norm(rgb_to_lab(arr) - rgb_to_lab(bg), axis=-1) > threshold


def _kmeans(points: np.ndarray, k: int, seed: int, iters: int = 25) -> np.ndarray:
    """Lloyd's k-means with k-means++ seeding; deterministic for a given seed. Returns labels."""
    rng = np.random.RandomState(seed)
    n = len(points)
    k = min(k, n)
    centers = [points[rng.randint(n)]]
    for _ in range(1, k):
        d2 = np.min([np.sum((points - c) ** 2, axis=1) for c in centers], axis=0)
        total = d2.sum()
        centers.append(points[rng.choice(n, p=d2 / total)] if total > 0 else points[rng.randint(n)])
    centers = np.array(centers)
    labels = np.zeros(n, dtype=int)
    for _ in range(iters):
        labels = np.argmin(((points[:, None, :] - centers[None]) ** 2).sum(-1), axis=1)
        for j in range(k):
            if np.any(labels == j):
                centers[j] = points[labels == j].mean(axis=0)
    return labels


def dominant_colors(img: Image.Image, k: int = 8, seed: int = 0) -> list[str]:
    """The photo's main colours, most common first, with the backdrop removed."""
    img = img.convert("RGB")
    img.thumbnail((160, 160))
    arr = np.asarray(img)
    mask = foreground_mask(arr)
    pixels = arr[mask] if mask.sum() >= 50 else arr.reshape(-1, 3)
    pixels = pixels.astype(np.float64)
    labels = _kmeans(rgb_to_lab(pixels), k, seed)
    clusters = [(int(np.sum(labels == j)), pixels[labels == j].mean(axis=0)) for j in range(labels.max() + 1) if np.any(labels == j)]
    clusters.sort(key=lambda c: -c[0])
    return [rgb_to_hex(c[1]) for c in clusters]


def snap_color(value: str, palette: list[str], max_delta: float = 35.0) -> str:
    """The nearest palette colour, or the original (lower-cased) if nothing is close enough."""
    original = value.lower()
    if not palette:
        return original
    best = min(palette, key=lambda p: delta_e(original, p))
    return best.lower() if delta_e(original, best) <= max_delta else original


def snap_colors(colors: dict[str, str], palette: list[str], max_delta: float = 35.0):
    """Snap every colour; returns (snapped colours, {key: (old, new)} for the ones that changed)."""
    snapped, changes = {}, {}
    for key, value in colors.items():
        new = snap_color(value, palette, max_delta)
        snapped[key] = new
        if new != value.lower():
            changes[key] = (value, new)
    return snapped, changes
