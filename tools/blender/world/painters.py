"""Painted (procedural) textures for the outdoor sets — same watercolour/gouache family as Alice's textures."""
import math

import numpy as np

from lib import paint


def _rgb(h):
    return paint.hex_rgb(h)


def _splat(img, mask, color, alpha):
    m = (np.clip(mask, 0, 1) * alpha)[..., None]
    return img * (1 - m) + np.asarray(color, np.float32) * m


def _dabs(h, w, count, size, seed, aspect=1.0):
    """Mask of many small soft elliptical dabs (tileable by wrapping)."""
    rng = np.random.default_rng(seed)
    mask = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for _ in range(count):
        cx, cy = rng.random() * w, rng.random() * h
        ang = rng.random() * math.pi
        r = size * (0.5 + rng.random())
        ca, sa = math.cos(ang), math.sin(ang)
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                if abs(cx + ox - w / 2) > w / 2 + r * 2 or abs(cy + oy - h / 2) > h / 2 + r * 2:
                    continue
                dx, dy = xx - (cx + ox), yy - (cy + oy)
                u = (dx * ca + dy * sa) / (r * aspect)
                v = (-dx * sa + dy * ca) / r
                d = u * u + v * v
                mask = np.maximum(mask, np.clip(1.0 - d, 0, 1))
    return mask


def ground(size=1024):
    img = paint.wash('#86B04F', size, size, seed=101, tint_var=0.06, blotch=0.09, facets=30, facet_var=0.07, edge=0.06, grain=0.02)
    n = paint.fbm(size, size, 4, 4, 11)
    img = _splat(img, np.clip((n - 0.55) * 3, 0, 1), _rgb('#C9C660'), 0.55)          # sun-bleached patches
    img = _splat(img, np.clip((0.42 - n) * 3, 0, 1), _rgb('#5E8F3E'), 0.50)           # lush clover shade
    # grass dabs: light and dark strokes
    img = _splat(img, _dabs(size, size, 700, 6.0, 3, 0.35), _rgb('#A8CC63'), 0.7)
    img = _splat(img, _dabs(size, size, 600, 5.0, 4, 0.35), _rgb('#4F7F34'), 0.55)
    # tiny meadow flowers
    img = _splat(img, _dabs(size, size, 120, 2.6, 5), _rgb('#FFF8E6'), 0.95)
    img = _splat(img, _dabs(size, size, 80, 2.4, 6), _rgb('#F4D35A'), 0.95)
    img = _splat(img, _dabs(size, size, 45, 2.4, 7), _rgb('#F2A3B8'), 0.9)
    return np.clip(img, 0, 1)


def leaf(size=512, dark='#3F6E34', mid='#5B8F45', light='#9CC45E', warm='#D8D56B', seed=0):
    img = paint.wash(dark, size, size, seed=201 + seed, tint_var=0.05, blotch=0.07, facets=0, grain=0.02)
    for k, (col, cnt, sz, a) in enumerate(((mid, 520, 11.0, 0.85), (light, 330, 9.0, 0.85), (warm, 90, 8.0, 0.7))):
        img = _splat(img, _dabs(size, size, cnt, sz, 210 + k + seed, 0.45), _rgb(col), a)
    img = _splat(img, _dabs(size, size, 260, 6.5, 230 + seed, 0.5), _rgb(dark), 0.55)     # dark gaps between leaves
    return np.clip(img, 0, 1)


def bark(size=512):
    img = paint.wash('#5B4633', size, size, seed=301, tint_var=0.06, blotch=0.08, facets=0, grain=0.02)
    u = np.arange(size, dtype=np.float32)[None, :].repeat(size, 0) / size
    n = paint.value_noise(1, 1024, 1, 36, 5)[0]
    cols = ((u * 1023).astype(int)) % 1024
    streak = n[cols]
    img = img * (0.78 + 0.5 * streak)[..., None]
    img = _splat(img, _dabs(size, size, 150, 8, 7, 3.0), _rgb('#7A6049'), 0.45)
    img = _splat(img, _dabs(size, size, 110, 12, 8, 1.6), _rgb('#7F9A4C'), 0.55)            # moss
    return np.clip(img, 0, 1)


def water(size=512):
    img = paint.wash('#5FA6B6', size, size, seed=401, tint_var=0.06, blotch=0.08, facets=18, facet_var=0.04, edge=0.05, grain=0.02)
    n = paint.fbm(size, size, 3, 4, 41)
    img = _splat(img, np.clip((n - 0.5) * 3, 0, 1), _rgb('#8FD0D4'), 0.55)
    img = _splat(img, _dabs(size, size, 120, 10, 42, 3.5), _rgb('#F4FBFA'), 0.7)             # glints
    img = _splat(img, _dabs(size, size, 90, 14, 43, 4.0), _rgb('#3E7C93'), 0.45)
    return np.clip(img, 0, 1)


def rock(size=512):
    img = paint.wash('#8F8B82', size, size, seed=501, tint_var=0.05, blotch=0.09, facets=12, facet_var=0.06, edge=0.07, grain=0.02)
    img = _splat(img, _dabs(size, size, 100, 14, 52, 1.4), _rgb('#6E7A47'), 0.55)           # moss
    img = _splat(img, _dabs(size, size, 80, 10, 53, 1.8), _rgb('#B8B2A3'), 0.5)
    return np.clip(img, 0, 1)


def rug(size=512):
    img = paint.wash('#F3EAD5', size, size, seed=601, tint_var=0.02, blotch=0.03, facets=0, grain=0.02)
    u, v = np.meshgrid(np.arange(size) / size, np.arange(size) / size)
    cells = 6
    chk = ((np.floor(u * cells) + np.floor(v * cells)) % 2).astype(np.float32)
    img = _splat(img, chk, _rgb('#B8423C'), 0.80)
    img = img * (0.94 + 0.06 * np.sin(u * size * 0.9)[..., None] * np.sin(v * size * 0.9)[..., None])
    return np.clip(img, 0, 1)
