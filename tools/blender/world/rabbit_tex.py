"""Painted textures for the White Rabbit (fur strokes, plaid coat, mustard waistcoat, cream silk, pink eye)."""
import math

import numpy as np

from lib import paint
from world.painters import _dabs, _rgb, _splat


def _strokes(h, w, count, length, width, seed, angle=math.pi / 2, jitter=0.5):
    """Mask of many thin fur strokes (tileable by wrapping)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    mask = np.zeros((h, w), np.float32)
    for _ in range(count):
        cx, cy = rng.random() * w, rng.random() * h
        a = angle + (rng.random() - 0.5) * jitter
        ca, sa = math.cos(a), math.sin(a)
        L = length * (0.6 + 0.8 * rng.random())
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                if abs(cx + ox - w / 2) > w / 2 + L or abs(cy + oy - h / 2) > h / 2 + L:
                    continue
                dx, dy = xx - (cx + ox), yy - (cy + oy)
                u = (dx * ca + dy * sa) / L
                v = (-dx * sa + dy * ca) / width
                d = u * u + v * v
                mask = np.maximum(mask, np.clip(1.0 - d, 0, 1))
    return mask


def fur(size=1024, seed=1):
    """Soft warm-white rabbit fur: pooled grey-cream wash with layered directional strokes."""
    img = paint.wash('#F1EDE4', size, size, seed=seed, tint_var=0.03, blotch=0.05, facets=14, facet_var=0.02, edge=0.02, grain=0.03)
    img = _splat(img, _strokes(size, size, 900, 26, 1.6, seed + 1), _rgb('#FFFFFF'), 0.75)
    img = _splat(img, _strokes(size, size, 700, 22, 1.5, seed + 2), _rgb('#D9D1C2'), 0.50)
    img = _splat(img, _strokes(size, size, 400, 30, 1.8, seed + 3), _rgb('#E9DFCE'), 0.45)
    img = _splat(img, np.clip((paint.fbm(size, size, 4, 4, seed + 9) - 0.6) * 3, 0, 1), _rgb('#E6C9C0'), 0.25)      # faint pink under-tone
    return np.clip(img, 0, 1)


def ear_inner(size=512, seed=2):
    img = paint.wash('#EDA0B0', size, size, seed=seed, tint_var=0.05, blotch=0.07, facets=0, grain=0.03)
    img = _splat(img, _strokes(size, size, 260, 40, 1.6, seed + 1, angle=math.pi / 2, jitter=0.2), _rgb('#F8D3DA'), 0.7)
    img = _splat(img, _strokes(size, size, 90, 60, 1.2, seed + 2, angle=math.pi / 2, jitter=0.15), _rgb('#C9708A'), 0.55)    # veins
    return np.clip(img, 0, 1)


def coat_check(size=1024, seed=3):
    """Brown-and-cream plaid wool: broad cream bands both ways over russet, dark pin-stripes, woven grain."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    img = paint.wash('#9B5B3A', size, size, seed=seed, tint_var=0.04, blotch=0.06, facets=0, grain=0.05)
    cells = 4
    band = ((np.floor(xx * cells * 2) % 2 == 0) | (np.floor(yy * cells * 2) % 2 == 0)).astype(np.float32)
    cream = ((np.floor(xx * cells * 2) % 2 == 0) & (np.floor(yy * cells * 2) % 2 == 0)).astype(np.float32)
    img = img * (1 - 0.30 * band[..., None]) + _rgb('#E2C9A0') * 0.30 * band[..., None] * 1.3
    img = img * (1 - cream[..., None]) + _rgb('#E2C9A0') * cream[..., None] * 0.92
    for k in range(cells):
        img = _splat(img, np.clip(1 - np.abs(xx - (k + 0.5) / cells) / 0.004, 0, 1), _rgb('#4E2A1B'), 0.7)
        img = _splat(img, np.clip(1 - np.abs(yy - (k + 0.5) / cells) / 0.004, 0, 1), _rgb('#4E2A1B'), 0.7)
    img *= (0.92 + 0.10 * np.sin(xx * size * 1.2) * np.sin(yy * size * 1.2))[..., None]                       # weave
    img *= (0.86 + 0.14 * paint.fbm(size, size, 10, 4, seed + 4))[..., None]
    img *= np.array([0.92, 0.88, 0.86], np.float32)                                                           # deepen towards russet
    return np.clip(img, 0, 1)


def waistcoat(size=512, seed=4):
    """Mustard-yellow silk waistcoat with a tiny diamond brocade and darker stitched seams."""
    img = paint.wash('#C9A24A', size, size, seed=seed, tint_var=0.05, blotch=0.07, facets=0, grain=0.03)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    d = (np.abs(((xx + yy) * 16) % 1.0 - 0.5) + np.abs(((xx - yy) * 16) % 1.0 - 0.5))
    img = _splat(img, np.clip(1 - np.abs(d - 0.5) / 0.08, 0, 1), _rgb('#A98433'), 0.5)
    img *= (0.94 + 0.12 * paint.fbm(size, size, 8, 4, seed + 2))[..., None]
    return np.clip(img, 0, 1)


def silk(size=256, seed=5, base='#F0E6CC'):
    img = paint.wash(base, size, size, seed=seed, tint_var=0.03, blotch=0.04, facets=0, grain=0.03)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    img *= (0.94 + 0.08 * np.sin((xx + 0.3 * yy) * 30))[..., None]
    return np.clip(img, 0, 1)


def eye(size=256, seed=6):
    """Pink iris with a dark ring, round pupil and a catch-light (unlit in-game so it stays crisp)."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    img = np.ones((size, size, 3), np.float32) * _rgb('#F7ECEE')
    iris = np.clip((0.44 - r) * 60, 0, 1)
    ang = np.arctan2(yy - 0.5, xx - 0.5)
    ir_col = _rgb('#E88FA3') * (0.85 + 0.30 * (0.5 + 0.5 * np.sin(ang * 14)))[..., None]
    img = img * (1 - iris[..., None]) + ir_col * iris[..., None]
    img = img * (1 - np.clip((r - 0.37) * 40, 0, 1)[..., None] * iris[..., None]) + _rgb('#B04A68') * np.clip((r - 0.37) * 40, 0, 1)[..., None] * iris[..., None]
    pupil = np.clip((0.17 - r) * 80, 0, 1)
    img = img * (1 - pupil[..., None]) + _rgb('#2A1520') * pupil[..., None]
    for cx, cy, rr, a in ((0.38, 0.36, 0.065, 1.0), (0.60, 0.60, 0.030, 0.8)):
        hl = np.clip((rr - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)) * 160, 0, 1) * a
        img = img * (1 - hl[..., None]) + np.ones(3, np.float32) * hl[..., None]
    return np.clip(img, 0, 1)


def tabby(size=1024, seed=11):
    """Ginger tabby fur: warm wash, layered strokes, wavy dark stripes and soft cream blotches (Dinah, in the dream)."""
    img = paint.wash('#E39A4B', size, size, seed=seed, tint_var=0.05, blotch=0.08, facets=14, facet_var=0.025, edge=0.02, grain=0.04)
    img = _splat(img, _strokes(size, size, 900, 26, 1.7, seed + 1), _rgb('#F4C688'), 0.65)
    img = _splat(img, _strokes(size, size, 800, 24, 1.6, seed + 2), _rgb('#B8702E'), 0.55)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    warp = paint.fbm(size, size, 4, 4, seed + 5) * 1.6
    stripe = (np.sin(2 * math.pi * (xx * 7 + warp)) > 0.45).astype(np.float32)
    stripe = paint.blur(stripe, 1)
    img = _splat(img, stripe, _rgb('#7E3F18'), 0.75)
    img = _splat(img, np.clip((paint.fbm(size, size, 5, 4, seed + 8) - 0.62) * 5, 0, 1), _rgb('#F8EEDD'), 0.85)
    return np.clip(img, 0, 1)


def cat_eye(size=256, seed=12):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    img = np.ones((size, size, 3), np.float32) * _rgb('#F4F0DE')
    iris = np.clip((0.46 - r) * 60, 0, 1)
    ang = np.arctan2(yy - 0.5, xx - 0.5)
    col = _rgb('#A5D55F') * (0.82 + 0.3 * (0.5 + 0.5 * np.sin(ang * 16)))[..., None]
    col = col * (1 - np.clip((r - 0.34) * 9, 0, 1)[..., None] * 0.55)
    img = img * (1 - iris[..., None]) + col * iris[..., None]
    slit = np.clip((0.065 - np.abs(xx - 0.5)) * 120, 0, 1) * np.clip((0.40 - np.abs(yy - 0.5)) * 40, 0, 1)
    img = img * (1 - slit[..., None]) + _rgb('#1B120E') * slit[..., None]
    hl = np.clip((0.06 - np.sqrt((xx - 0.38) ** 2 + (yy - 0.36) ** 2)) * 150, 0, 1)
    img = img * (1 - hl[..., None]) + hl[..., None]
    return np.clip(img, 0, 1)
