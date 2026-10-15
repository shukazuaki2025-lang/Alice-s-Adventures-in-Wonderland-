"""Painted (procedural) textures for the underground / interior sets: well, passage, long hall, garden vista.

Same gouache family as `painters.py` / Alice's textures: a `paint.wash` base for pigment pooling and brush facets, then
hand-placed marks (bricks, grain, damask, carpet medallions…) with painterly jitter. Everything is seeded and tileable in u.
All functions return float32 (h, w, 3) sRGB in 0..1.
"""
import math

import numpy as np

from lib import paint
from world.painters import _dabs, _rgb, _splat


def _grid(h, w):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return yy / h, xx / w


def _hash2(a, b, seed=0):
    """Deterministic float in [0,1) per integer cell — vectorised."""
    n = (a.astype(np.int64) * 374761393 + b.astype(np.int64) * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF).astype(np.float32) / 65535.0


def _mix(c0, c1, t):
    return c0 * (1 - t)[..., None] + c1 * t[..., None]


def _line(mask_shape, pts, width):
    """Soft polyline mask (pts in 0..1 uv) — cheap distance-to-segment brush."""
    h, w = mask_shape
    yy, xx = _grid(h, w)
    best = np.full((h, w), 9.0, np.float32)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy + 1e-9
        t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / L2, 0, 1)
        d = np.sqrt((xx - (x0 + t * dx)) ** 2 + (yy - (y0 + t * dy)) ** 2)
        best = np.minimum(best, d)
    return np.clip(1.0 - best / width, 0, 1)


# ------------------------------------------------------------------------------------------------ well
def brick(w=1024, h=512, rows=16, per_row=16, seed=1, moss=0.5, damp=0.55):
    """Running-bond brick wall: per-brick colour, chipped bevels, mortar, damp streaks and moss. Tileable in u."""
    yy, xx = _grid(h, w)
    ry = yy * rows
    row = np.floor(ry)
    fy = ry - row
    rx = xx * per_row + 0.5 * (row % 2)
    col = np.floor(rx)
    fx = rx - col
    base = paint.wash('#A9704E', h, w, seed=seed, tint_var=0.05, blotch=0.07, facets=24, facet_var=0.04, edge=0.04, grain=0.02)
    pal = [_rgb('#B9784F'), _rgb('#A5603F'), _rgb('#C98E5F'), _rgb('#8F5B45'), _rgb('#9C7A63')]
    k = (_hash2(row, col % per_row, seed) * len(pal)).astype(int) % len(pal)
    tint = np.stack([np.stack([p for p in pal])[k][..., c] for c in range(3)], -1)
    img = _mix(base * 0.55 + tint * 0.45, base, np.full((h, w), 0.35, np.float32))
    shade = 0.84 + 0.30 * _hash2(row, col % per_row, seed + 9)
    img *= shade[..., None]
    # chipped brick face: soft light/dark clouds inside each brick
    cl = paint.fbm(h, w, 12, 4, seed + 3)
    img *= (0.88 + 0.28 * cl)[..., None]
    img = _splat(img, _dabs(h, w, 240, 5.0, seed + 5, 1.4), _rgb('#5E3B2E'), 0.40)
    # bevel: light top/left edge, dark bottom/right edge
    top = np.clip(1.0 - fy / 0.10, 0, 1) * 0.30
    left = np.clip(1.0 - fx / 0.06, 0, 1) * 0.16
    bot = np.clip((fy - 0.88) / 0.12, 0, 1) * 0.34
    right = np.clip((fx - 0.94) / 0.06, 0, 1) * 0.20
    img = img * (1 + top[..., None] + left[..., None] - bot[..., None] - right[..., None])
    # mortar
    mort = ((fy < 0.075) | (fy > 0.925) | (fx < 0.035) | (fx > 0.965)).astype(np.float32)
    mort = paint.blur(mort, 1)
    mcol = paint.wash('#BDB097', h, w, seed=seed + 20, tint_var=0.05, blotch=0.10, facets=0, grain=0.04)
    img = _mix(img, mcol * 0.93, np.clip(mort * 1.2, 0, 1))
    # damp streaks running down + moss gathering low and in the mortar
    streak = paint.value_noise(h, w, 2, 48, seed + 31)
    streak = np.clip((streak - 0.55) * 3.0, 0, 1) * np.clip(0.4 + 1.4 * paint.fbm(h, w, 3, 3, seed + 33), 0, 1)
    img *= (1.0 - damp * 0.45 * streak)[..., None]
    mm = np.clip((paint.fbm(h, w, 6, 5, seed + 41) - (0.62 - 0.22 * moss)) * 6.0, 0, 1) * (0.35 + 0.65 * yy)
    img = _mix(img, _rgb('#5F8040') * (0.8 + 0.4 * paint.fbm(h, w, 40, 2, seed + 7)[..., None]), np.clip(mm * 0.9, 0, 1))
    img = _splat(img, _dabs(h, w, 140, 5.0, seed + 50, 0.6) * mm, _rgb('#98BB55'), 0.7)
    return np.clip(img, 0, 1)


def planks(w=512, h=512, n=6, base='#8B5A35', seed=3, vertical=False, stagger=0, seams=0.012):
    """Wooden boards with grain, knots and tint drift. Grain runs along u (vertical=True runs it along v instead)."""
    if vertical:
        return np.ascontiguousarray(planks(h, w, n, base, seed, False, stagger, seams).transpose(1, 0, 2))
    yy, xx = _grid(h, w)
    row = np.floor(yy * n)
    fy = yy * n - row
    img = paint.wash(base, h, w, seed=seed, tint_var=0.06, blotch=0.06, facets=0, grain=0.015)
    plank_t = 0.80 + 0.40 * _hash2(row, row * 0, seed)
    img = img * plank_t[..., None]
    grain = 0.78 + 0.26 * paint.value_noise(h, w, max(2, h // 3), 6, seed + 7) + 0.20 * paint.value_noise(h, w, h, 3, seed + 8)
    img = img * grain[..., None]
    rng = np.random.default_rng(seed + 11)
    for _ in range(max(2, n)):                                                     # knots: concentric ring dabs
        cx, cy = rng.random(), rng.random()
        d = np.sqrt((xx - cx) ** 2 + ((yy - cy) * 3.0) ** 2) / (0.012 + 0.018 * rng.random())
        ring = (0.5 + 0.5 * np.sin(d * 6.0)) * np.clip(1.0 - d / 2.2, 0, 1)
        img *= (1.0 - 0.35 * ring)[..., None]
    gap = ((fy < seams * n) | (fy > 1 - seams * n)).astype(np.float32)
    img = _mix(img, img * 0.45, paint.blur(gap, 1))
    if stagger:
        col = np.floor(xx * stagger + 0.5 * (row % 2))
        fx = xx * stagger + 0.5 * (row % 2) - col
        end = np.clip(1.0 - np.minimum(fx, 1 - fx) / 0.02, 0, 1)
        img = _mix(img, img * 0.45, end)
    return np.clip(img, 0, 1)


def books(w=1024, h=256, seed=5):
    """Strip of book spines (vertical), 20–46 px wide: leather/cloth colours, gilt bands, title labels. Tileable in u."""
    rng = np.random.default_rng(seed)
    pal = ['#7A2F34', '#2F5A45', '#27405E', '#B58B3A', '#3C6E70', '#59314F', '#8B6A45', '#A24B3B', '#33323F', '#6B7B3A']
    img = np.zeros((h, w, 3), np.float32)
    x = 0
    yy = np.arange(h, dtype=np.float32)[:, None] / h
    while x < w:
        bw = int(rng.integers(20, 46))
        if w - x < 24:
            bw = w - x
        bw = min(bw, w - x)
        c = _rgb(pal[int(rng.integers(len(pal)))]) * (0.85 + 0.3 * rng.random())
        xs = np.arange(bw, dtype=np.float32)[None, :] / max(1, bw - 1)
        round_shade = 0.70 + 0.55 * np.clip(np.sin(np.clip(xs, 0, 1) * math.pi), 0, 1) ** 0.8       # rounded spine
        blk = np.ones((h, bw, 3), np.float32) * c
        blk = blk * round_shade[..., None] * (0.92 + 0.12 * paint.value_noise(h, bw, 24, 2, int(rng.integers(1000)))[..., None])
        # gilt bands + title label
        for gy0 in (0.07, 0.11, 0.86, 0.90):
            m = np.abs(yy - gy0) < 0.006
            blk = np.where(m[..., None], _rgb('#E2BE6A') * round_shade[..., None], blk)
        ly0, ly1 = 0.22 + 0.08 * rng.random(), 0.52 + 0.1 * rng.random()
        lm = ((yy > ly0) & (yy < ly1)) & (xs > 0.18) & (xs < 0.82)
        blk = np.where(lm[..., None], _rgb('#E9DCB8') * (0.85 + 0.1 * round_shade[..., None]), blk)
        for t in range(int(rng.integers(2, 5))):
            ty = ly0 + (ly1 - ly0) * (0.2 + 0.2 * t)
            tm = (np.abs(yy - ty) < 0.007) & (xs > 0.28) & (xs < 0.72)
            blk = np.where(tm[..., None], _rgb('#3B2A20'), blk)
        img[:, x:x + bw] = blk
        x += bw
    # dust and wear
    img *= (0.94 + 0.10 * paint.fbm(h, w, 8, 4, seed + 2))[..., None]
    return np.clip(img, 0, 1)


def parchment_map(w=512, h=512, seed=7):
    """Antique world map: tea-stained parchment, wash-coloured continents with ink coastlines, compass rose, hatching."""
    img = paint.wash('#E7D6A8', h, w, seed=seed, tint_var=0.06, blotch=0.10, facets=0, grain=0.03)
    land = paint.fbm(h, w, 3, 5, seed + 1)
    mask = np.clip((land - 0.52) * 24, 0, 1)
    coast = np.clip(1.0 - np.abs(land - 0.52) * 55, 0, 1)
    tint = paint.fbm(h, w, 4, 3, seed + 4)
    land_col = _mix(_mix(np.ones((h, w, 3), np.float32) * _rgb('#9BB873'), np.ones((h, w, 3), np.float32) * _rgb('#D9A35F'), np.clip(tint * 1.6 - 0.3, 0, 1)),
                    np.ones((h, w, 3), np.float32) * _rgb('#C98A7C'), np.clip(tint * 2.0 - 1.0, 0, 1))
    img = _mix(img, land_col, mask * 0.78)
    # sea hatching
    yy, xx = _grid(h, w)
    hatch = (0.5 + 0.5 * np.sin((xx + yy) * 260)) * (1 - mask)
    img *= (1.0 - 0.07 * hatch)[..., None]
    img = _splat(img, coast, _rgb('#4A3626'), 0.8)
    # compass rose + graticule
    cx, cy = 0.78, 0.80
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ang = np.arctan2(yy - cy, xx - cx)
    star = np.clip(1.0 - r / (0.11 * (0.45 + 0.55 * np.abs(np.cos(2 * ang)) ** 6)), 0, 1)
    img = _splat(img, (star > 0).astype(np.float32), _rgb('#C9503F'), 0.7)
    img = _splat(img, np.clip(1 - np.abs(r - 0.12) / 0.004, 0, 1), _rgb('#4A3626'), 0.85)
    for g in range(1, 6):
        img = _splat(img, np.clip(1 - np.abs(yy - g / 6) / 0.0018, 0, 1), _rgb('#6B5037'), 0.35)
        img = _splat(img, np.clip(1 - np.abs(xx - g / 6) / 0.0018, 0, 1), _rgb('#6B5037'), 0.35)
    # border + foxing + edge burn
    edge = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))
    img = _splat(img, np.clip(1 - np.abs(edge - 0.035) / 0.004, 0, 1), _rgb('#4A3626'), 0.9)
    img *= (1.0 - np.clip(1.0 - edge / 0.12, 0, 1) ** 2 * 0.35)[..., None]
    img = _splat(img, _dabs(h, w, 60, 5, seed + 9), _rgb('#8A5A32'), 0.35)
    return np.clip(img, 0, 1)


def painting(w=512, h=640, kind='landscape', seed=11):
    """Small framed picture content: a pastoral landscape or a dark-ground portrait, painterly."""
    yy, xx = _grid(h, w)
    if kind == 'portrait':
        img = paint.wash('#3A2E2A', h, w, seed=seed, tint_var=0.10, blotch=0.12, facets=10, facet_var=0.05, grain=0.03)
        glow = np.clip(1 - np.sqrt((xx - 0.5) ** 2 + (yy - 0.40) ** 2) / 0.55, 0, 1)
        img = _splat(img, glow, _rgb('#8A6A48'), 0.55)
        body = np.clip(1 - np.sqrt(((xx - 0.5) / 0.34) ** 2 + ((yy - 0.95) / 0.38) ** 2), 0, 1)
        img = _splat(img, (body > 0).astype(np.float32), _rgb('#2E3A55'), 0.95)
        img = _splat(img, np.clip(1 - np.sqrt(((xx - 0.5) / 0.12) ** 2 + ((yy - 0.66) / 0.10) ** 2), 0, 1) > 0, _rgb('#EADFC8'), 0.95)    # collar
        face = np.clip(1 - np.sqrt(((xx - 0.5) / 0.15) ** 2 + ((yy - 0.42) / 0.20) ** 2), 0, 1)
        img = _splat(img, (face > 0).astype(np.float32), _rgb('#E4B896'), 0.97)
        img = _splat(img, np.clip(1 - np.sqrt(((xx - 0.5) / 0.19) ** 2 + ((yy - 0.31) / 0.12) ** 2), 0, 1) > 0, _rgb('#4A3022'), 0.9)     # hair
        for ex in (0.44, 0.56):
            img = _splat(img, np.clip(1 - np.sqrt(((xx - ex) / 0.018) ** 2 + ((yy - 0.42) / 0.010) ** 2), 0, 1) > 0, _rgb('#3A2A22'), 0.95)
        img = _splat(img, np.clip(1 - np.sqrt(((xx - 0.5) / 0.035) ** 2 + ((yy - 0.52) / 0.010) ** 2), 0, 1) > 0, _rgb('#B5645A'), 0.9)
        img = _splat(img, _dabs(h, w, 220, 5, seed + 3, 0.6), _rgb('#D3B27C'), 0.18)
    else:
        sky = _mix(np.ones((h, w, 3), np.float32) * _rgb('#CFE3E8'), np.ones((h, w, 3), np.float32) * _rgb('#F6E3B9'), np.clip(yy * 1.8, 0, 1))
        img = sky * (0.95 + 0.1 * paint.fbm(h, w, 4, 4, seed))[..., None]
        for k, (col, y0, amp) in enumerate((('#9AB4A4', 0.50, 0.07), ('#7FA06A', 0.58, 0.06), ('#5E8A4C', 0.68, 0.05))):
            ridge = y0 + amp * np.sin(xx * (5 + 3 * k) + k * 2.0) + amp * 0.6 * (paint.value_noise(1, w, 1, 9, seed + k)[0][None, :] - 0.5)
            img = _mix(img, np.ones((h, w, 3), np.float32) * _rgb(col) * (0.92 + 0.14 * paint.fbm(h, w, 10, 3, seed + 20 + k)[..., None]), (yy > ridge).astype(np.float32))
        for tx, ty, tr in ((0.22, 0.58, 0.06), (0.74, 0.60, 0.075), (0.60, 0.63, 0.045)):
            img = _splat(img, np.clip(1 - np.sqrt(((xx - tx) / tr) ** 2 + ((yy - ty) / (tr * 1.25)) ** 2), 0, 1) > 0, _rgb('#3F6A38'), 0.92)
            img = _splat(img, _line((h, w), [(tx, ty + tr), (tx, ty + tr * 2.4)], 0.008), _rgb('#4B3A2C'), 0.9)
        img = _splat(img, _dabs(h, w, 400, 4, seed + 7, 0.5), _rgb('#F4EBC8'), 0.18)
    # craquelure + varnish yellowing
    cr = np.clip(1.0 - paint.voronoi(h, w, 18, seed + 13)[1] * 12, 0, 1) ** 4
    img *= (1.0 - 0.18 * cr)[..., None]
    img *= np.array([1.04, 1.0, 0.88], np.float32)
    return np.clip(img, 0, 1)


# ------------------------------------------------------------------------------------------------ hall
def wallpaper(w=512, h=512, seed=21, base='#2F5A4F', motif='#D6B766'):
    """Victorian trellis-and-rose wallpaper: a gold diagonal lattice, a six-petal bloom with leaves in every diamond and a small
    rosette at each crossing — a 4×4 repeat per tile so the pattern stays fine-grained on a 24 m wall. Tileable both ways."""
    yy, xx = _grid(h, w)
    img = paint.wash(base, h, w, seed=seed, tint_var=0.05, blotch=0.07, facets=0, grain=0.03)
    one = np.ones_like(img)
    gx, gy = np.round(xx * 4), np.round(yy * 4)
    dx, dy = xx * 4 - gx, yy * 4 - gy                                   # cell units, ±0.5
    centre = ((gx - gy) % 2 == 0)
    r = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dy, dx)
    # lattice
    t1 = np.abs((xx + yy) * 2 % 1.0 - 0.5)
    t2 = np.abs((xx - yy) * 2 % 1.0 - 0.5)
    lat = np.clip(1 - np.minimum(t1, t2) / 0.010, 0, 1)
    lat = np.where(np.minimum(t1, t2) < 0.010, 1.0, 0.0).astype(np.float32)
    # bloom in the diamond centres
    petal_r = 0.30 * (0.60 + 0.40 * np.abs(np.cos(3 * th)))
    bloom = ((r < petal_r) & centre).astype(np.float32)
    core = ((r < 0.075) & centre).astype(np.float32)
    ring = ((np.abs(r - 0.37) < 0.014) & centre).astype(np.float32)
    leaf_a = np.abs(((th + math.pi / 4) % (math.pi / 2)) - math.pi / 4)
    leaf = ((r > 0.30) & (r < 0.46) & (leaf_a < 0.20 * (1 - (r - 0.30) / 0.17) + 0.02) & centre).astype(np.float32)
    # rosette at each lattice crossing
    rose = ((r < 0.11 * (0.75 + 0.25 * np.cos(5 * th))) & ~centre).astype(np.float32)
    rose_core = ((r < 0.04) & ~centre).astype(np.float32)
    shadow = np.maximum(np.roll(np.roll(np.maximum(bloom, rose), 2, 0), 2, 1), np.roll(np.roll(lat, 2, 0), 2, 1))
    gold = _rgb(motif) * (0.86 + 0.28 * paint.fbm(h, w, 16, 3, seed + 3))[..., None]
    img = _mix(img, img * 0.60, np.clip(shadow, 0, 1) * 0.55)
    img = _mix(img, one * _rgb('#6F9A6C'), paint.blur(leaf, 1) * 0.9)
    img = _mix(img, gold, paint.blur(lat, 1) * 0.85)
    img = _mix(img, gold, paint.blur(np.maximum(bloom, ring), 1) * 0.92)
    img = _mix(img, one * _rgb('#B84F6A'), paint.blur(core, 1) * 0.95)
    img = _mix(img, one * _rgb('#E8D8A0'), paint.blur(rose, 1) * 0.95)
    img = _mix(img, one * _rgb('#B84F6A'), paint.blur(rose_core, 1) * 0.9)
    img *= (1.0 - 0.10 * np.clip(paint.fbm(h, w, 5, 4, seed + 9) - 0.55, 0, 1) * 3)[..., None]          # age stains
    return np.clip(img, 0, 1)


def carpet(w=1024, h=1024, seed=31):
    """Persian-style runner: wine field with a lozenge medallion lattice, navy/cream/gold borders, worn pile."""
    yy, xx = _grid(h, w)
    img = paint.wash('#7B2431', h, w, seed=seed, tint_var=0.07, blotch=0.10, facets=40, facet_var=0.05, edge=0.04, grain=0.03)
    ex = np.minimum(xx, 1 - xx)
    ey = np.minimum(yy, 1 - yy)
    e = np.minimum(ex, ey)
    def band(lo, hi):
        return ((e >= lo) & (e < hi)).astype(np.float32)
    img = _mix(img, np.ones_like(img) * _rgb('#22385E'), band(0.02, 0.075))
    img = _mix(img, np.ones_like(img) * _rgb('#E8D8AE'), band(0.085, 0.100))
    img = _mix(img, np.ones_like(img) * _rgb('#1E3254'), band(0.105, 0.150))
    img = _mix(img, np.ones_like(img) * _rgb('#CDA85A'), band(0.155, 0.165))
    # border vine rhythm
    t = np.where(ex < ey, yy, xx)
    rh = (0.5 + 0.5 * np.sin(t * 2 * math.pi * 22)) * band(0.032, 0.066)
    img = _mix(img, np.ones_like(img) * _rgb('#D9B968'), np.clip(rh - 0.35, 0, 1) * 1.4)
    # central lozenge lattice
    cx, cy = xx - 0.5, yy - 0.5
    inner = (np.abs(cx) < 0.33) & (np.abs(cy) < 0.45)
    for k, (s, col, wd) in enumerate(((0.30, '#E1CFA3', 0.018), (0.22, '#22385E', 0.03), (0.14, '#D9B968', 0.02), (0.06, '#7B2431', 0.03))):
        d = np.abs(cx) / 0.75 + np.abs(cy) / 1.0
        m = (np.abs(d - s) < wd).astype(np.float32) * inner
        img = _mix(img, np.ones_like(img) * _rgb(col), paint.blur(m, 1))
    lat = (0.5 + 0.5 * np.cos(xx * 2 * math.pi * 9)) * (0.5 + 0.5 * np.cos(yy * 2 * math.pi * 12))
    img = _mix(img, np.ones_like(img) * _rgb('#B8566B'), np.clip(lat - 0.72, 0, 1) * 2.0 * inner * (np.abs(cx) / 0.75 + np.abs(cy) > 0.33))
    # pile wear and weave
    img *= (0.92 + 0.10 * np.sin(xx * w * 0.8) * np.sin(yy * h * 0.8))[..., None]
    img *= (0.94 + 0.12 * paint.fbm(h, w, 6, 5, seed + 4))[..., None]
    return np.clip(img, 0, 1)


def parquet(w=1024, h=1024, seed=41):
    """Polished oak boards, staggered, with a warm varnish sheen gradient."""
    img = planks(w, h, n=12, base='#9A7048', seed=seed, stagger=4, seams=0.008)
    yy, xx = _grid(h, w)
    sheen = 0.9 + 0.18 * np.sin(yy * 3.0 + xx * 1.2) ** 2
    img = img * sheen[..., None]
    img = _splat(img, _dabs(h, w, 40, 14, seed + 5, 3.0), _rgb('#E8C98B'), 0.18)               # light scuffs
    return np.clip(img, 0, 1)


def door(w=512, h=1024, seed=51, base='#5B3A22'):
    """Six-panel Victorian door: stiles/rails, bevelled recessed panels, grain; brass hardware is modelled separately."""
    img = planks(w, h, n=18, base=base, seed=seed, vertical=True, seams=0.0)
    yy, xx = _grid(h, w)
    out = np.zeros((h, w), np.float32)
    shade = np.ones((h, w), np.float32)
    panels = [(x0, x1, y0, y1) for (x0, x1) in ((0.12, 0.47), (0.53, 0.88)) for (y0, y1) in ((0.06, 0.30), (0.34, 0.60), (0.64, 0.94))]
    for x0, x1, y0, y1 in panels:
        inside = ((xx > x0) & (xx < x1) & (yy > y0) & (yy < y1))
        d = np.minimum(np.minimum(xx - x0, x1 - xx), np.minimum(yy - y0, y1 - yy))
        bevel = np.clip(d / 0.035, 0, 1)
        face = np.where(inside, 0.80 + 0.16 * bevel, 1.0)
        lit = np.where(inside & (d < 0.035), np.where((xx - x0 < yy - y0) | (yy - y0 < xx - x0), 1.18, 0.62), 1.0)
        shade *= face * lit
    img = img * shade[..., None]
    img = _splat(img, _dabs(h, w, 120, 8, seed + 3, 2.5), _rgb('#2E1C10'), 0.22)
    return np.clip(img, 0, 1)


def velvet(w=256, h=256, seed=61, base='#7E2236'):
    """Deep velvet curtain: vertical fold shading with nap noise and a soft sheen."""
    yy, xx = _grid(h, w)
    img = paint.wash(base, h, w, seed=seed, tint_var=0.05, blotch=0.06, facets=0, grain=0.04)
    folds = 0.5 + 0.5 * np.sin(xx * 2 * math.pi * 5 + 0.7 * np.sin(yy * 6))
    img *= (0.62 + 0.62 * folds)[..., None]
    img = _mix(img, np.ones_like(img) * _rgb('#C2506A'), np.clip(folds - 0.78, 0, 1) * 1.6 * 0.5)       # sheen on the ridges
    img *= (0.95 + 0.10 * paint.value_noise(h, w, h, w // 2, seed + 7))[..., None]
    return np.clip(img, 0, 1)


def brass(w=256, h=256, seed=71, base='#C9A24A'):
    """Brushed, slightly tarnished brass / gilt."""
    img = paint.wash(base, h, w, seed=seed, tint_var=0.08, blotch=0.10, facets=0, grain=0.02)
    br = paint.value_noise(h, w, h, 4, seed + 3)
    img *= (0.82 + 0.40 * br)[..., None]
    img = _splat(img, _dabs(h, w, 30, 10, seed + 5, 3.0), _rgb('#FFF1B0'), 0.55)
    img = _splat(img, _dabs(h, w, 40, 8, seed + 6, 2.0), _rgb('#6B4E1C'), 0.35)
    return np.clip(img, 0, 1)


def plaster(w=512, h=512, seed=81, base='#E4D3B2'):
    """Warm lime-plaster ceiling / cornice with trowel facets and faint smoke staining."""
    img = paint.wash(base, h, w, seed=seed, tint_var=0.04, blotch=0.08, facets=18, facet_var=0.03, edge=0.03, grain=0.03)
    img *= (1.0 - 0.18 * np.clip(paint.fbm(h, w, 4, 5, seed + 3) - 0.5, 0, 1) * 2.2)[..., None]
    return np.clip(img, 0, 1)


def glass_tint(w=64, h=64):
    return np.ones((h, w, 3), np.float32) * _rgb('#CFE6E4')


# ------------------------------------------------------------------------------------------------ passage / garden
def earth(w=512, h=512, seed=91):
    """Root-woven dirt wall of the passage: packed earth, pebbles, white rootlets, damp moss, a few pale mushrooms."""
    img = paint.wash('#6B4C35', h, w, seed=seed, tint_var=0.08, blotch=0.12, facets=22, facet_var=0.06, edge=0.05, grain=0.04)
    n = paint.fbm(h, w, 5, 5, seed + 2)
    img = _splat(img, np.clip((n - 0.55) * 4, 0, 1), _rgb('#8C6A48'), 0.55)
    img = _splat(img, np.clip((0.40 - n) * 4, 0, 1), _rgb('#3F2D21'), 0.60)
    img = _splat(img, _dabs(h, w, 260, 7, seed + 4, 1.1), _rgb('#A58A6A'), 0.55)             # pebbles
    img = _splat(img, _dabs(h, w, 200, 5, seed + 5, 1.1), _rgb('#2E2018'), 0.45)
    rng = np.random.default_rng(seed + 6)
    roots = np.zeros((h, w), np.float32)
    for _ in range(26):
        x0, y0 = rng.random(), rng.random()
        ang = rng.random() * math.pi * 2
        pts = [(x0, y0)]
        for _s in range(7):
            ang += (rng.random() - 0.5) * 1.1
            x0, y0 = x0 + 0.07 * math.cos(ang), y0 + 0.07 * math.sin(ang)
            pts.append((x0, y0))
        roots = np.maximum(roots, _line((h, w), pts, 0.006 + 0.004 * rng.random()))
    img = _mix(img, np.ones_like(img) * _rgb('#CDB78F'), np.clip(roots, 0, 1) * 0.85)
    img = _splat(img, np.clip((paint.fbm(h, w, 7, 4, seed + 9) - 0.68) * 6, 0, 1), _rgb('#5F8040'), 0.8)
    img = _splat(img, _dabs(h, w, 14, 5, seed + 11, 1.0), _rgb('#E9E0CB'), 0.9)                 # mushrooms
    return np.clip(img, 0, 1)


def gravel(w=512, h=512, seed=101):
    img = paint.wash('#D7C9A6', h, w, seed=seed, tint_var=0.05, blotch=0.08, facets=40, facet_var=0.06, edge=0.05, grain=0.04)
    img = _splat(img, _dabs(h, w, 500, 4.5, seed + 1, 1.2), _rgb('#B9A683'), 0.55)
    img = _splat(img, _dabs(h, w, 300, 4.0, seed + 2, 1.2), _rgb('#F2E8CE'), 0.55)
    img = _splat(img, _dabs(h, w, 260, 4.0, seed + 3, 1.2), _rgb('#8D7B5C'), 0.45)
    return np.clip(img, 0, 1)


def rose_bush(w=512, h=512, seed=111):
    """Dark foliage with red/pink/white roses — hedge-rose atlas for the garden vista."""
    img = painters_leaf(w, h, seed)
    for col, cnt in (('#D8434E', 60), ('#F29BB0', 45), ('#FBEFD8', 40), ('#F6C65B', 25)):
        m = _dabs(h, w, cnt, 6.5, seed + cnt, 1.0)
        img = _splat(img, m, _rgb(col), 0.97)
        img = _splat(img, _dabs(h, w, cnt, 2.4, seed + cnt + 1, 1.0) * m, _rgb('#7D1C2C'), 0.55)
    return np.clip(img, 0, 1)


def painters_leaf(w, h, seed):
    from world import painters
    return painters.leaf(w, dark='#2F5A32', mid='#4D8A44', light='#8FC15B', warm='#C9D468', seed=seed)


def vista(w=1536, h=768, seed=121):
    """The Garden Vista seen through the little door: a radiant, saturated afternoon — sky, far trees, hedge maze,
    flower beds, a fountain and a sunlit gravel path. This is the only place the chapter allows full-saturation sun."""
    yy, xx = _grid(h, w)
    sky_top, sky_bot = _rgb('#5FB5E8'), _rgb('#FFF1C8')
    img = _mix(np.ones((h, w, 3), np.float32) * sky_top, np.ones((h, w, 3), np.float32) * sky_bot, np.clip((yy / 0.52) ** 1.3, 0, 1))
    cl = np.clip((paint.fbm(h, w, 4, 6, seed) - 0.55) * 4.0, 0, 1) * np.clip(1 - yy / 0.5, 0, 1)
    img = _mix(img, np.ones_like(img) * _rgb('#FFFFFF'), cl * 0.85)
    horizon = 0.50
    # far tree line
    ridge = horizon - 0.02 - 0.05 * paint.fbm(1, w, 1, 12, seed + 3, 0.55)[0][None, :] - 0.02 * np.sin(xx * 40)
    far = (yy > ridge) & (yy < horizon + 0.02)
    img = _mix(img, np.ones_like(img) * _rgb('#4F8A5B') * (0.85 + 0.30 * paint.fbm(h, w, 40, 3, seed + 4))[..., None], far.astype(np.float32))
    # lawn
    lawn = yy >= horizon
    lg = _rgb('#6FBF4A') * (0.82 + 0.35 * paint.fbm(h, w, 14, 5, seed + 5))[..., None]
    lg = _splat(lg, _dabs(h, w, 900, 5, seed + 6, 0.4), _rgb('#B6E064'), 0.6)
    img = _mix(img, lg, lawn.astype(np.float32))
    # sunlit gravel path converging to the horizon
    persp = np.clip((yy - horizon) / (1 - horizon), 0, 1)
    half = 0.012 + 0.20 * persp
    path = lawn & (np.abs(xx - 0.5) < half)
    img = _mix(img, np.ones_like(img) * _rgb('#F0DDA8') * (0.9 + 0.18 * paint.fbm(h, w, 30, 3, seed + 7))[..., None], path.astype(np.float32))
    # flower beds either side of the path
    for side in (-1, 1):
        for k in range(8):
            t = 0.08 + 0.115 * k
            by = horizon + (1 - horizon) * t
            sc = 0.04 + 0.30 * t
            bx = 0.5 + side * (0.012 + 0.20 * t + sc * 0.9)
            blob = np.clip(1 - np.sqrt(((xx - bx) / (sc * 0.8)) ** 2 + ((yy - by) / (sc * 0.30)) ** 2), 0, 1) > 0
            img = _mix(img, np.ones_like(img) * _rgb('#3C8A3F'), blob.astype(np.float32) * 0.95)
            rng = np.random.default_rng(seed + 100 + k + (0 if side < 0 else 50))
            for _ in range(9):
                fx, fy = bx + (rng.random() - 0.5) * sc * 1.4, by + (rng.random() - 0.5) * sc * 0.4
                r = sc * (0.05 + 0.04 * rng.random())
                fl = np.clip(1 - np.sqrt(((xx - fx) / r) ** 2 + ((yy - fy) / (r * 0.8)) ** 2), 0, 1) > 0
                img = _mix(img, np.ones_like(img) * _rgb(['#E5384F', '#F7A8C0', '#FFD84D', '#FFFFFF', '#8E5BD1'][int(rng.integers(5))]), fl.astype(np.float32) * 0.97)
    # hedge-maze walls at the sides, fountain in the middle distance
    for side, x0 in ((-1, 0.0), (1, 1.0)):
        hx = np.abs(xx - x0)
        hedge = (hx < 0.22 - 0.12 * np.clip((yy - horizon) * 3, 0, 1)) & (yy > horizon - 0.06) & (yy < horizon + 0.30)
        hedge &= (yy < 0.95)
        hc = _rgb('#2F7A3A') * (0.78 + 0.40 * paint.fbm(h, w, 28, 4, seed + 8 + int(side)))[..., None]
        img = _mix(img, hc, hedge.astype(np.float32))
    fx0, fy0 = 0.5, horizon + 0.06
    basin = np.clip(1 - np.sqrt(((xx - fx0) / 0.085) ** 2 + ((yy - fy0) / 0.028) ** 2), 0, 1) > 0
    img = _mix(img, np.ones_like(img) * _rgb('#B8C3C6'), basin.astype(np.float32))
    img = _mix(img, np.ones_like(img) * _rgb('#7FD1E8'), (np.clip(1 - np.sqrt(((xx - fx0) / 0.07) ** 2 + ((yy - fy0) / 0.020) ** 2), 0, 1) > 0).astype(np.float32))
    jet = (np.abs(xx - fx0) < 0.0035) & (yy < fy0) & (yy > fy0 - 0.11)
    img = _mix(img, np.ones_like(img) * _rgb('#FFFFFF'), jet.astype(np.float32) * 0.9)
    # sun bloom
    sun = np.clip(1 - np.sqrt((xx - 0.72) ** 2 + ((yy - 0.16) * 1.4) ** 2) / 0.35, 0, 1) ** 2
    img = np.clip(img + sun[..., None] * np.array([1.0, 0.9, 0.55], np.float32) * 0.45, 0, 1)
    img *= (0.96 + 0.08 * paint.value_noise(h, w, h // 2, w // 2, seed + 12))[..., None]
    return np.clip(img, 0, 1)


def runner(w=3072, h=256, aspect=11.8, seed=33):
    """Long hall runner: wine field, navy/cream/gold borders and one lozenge medallion per rug-width of length."""
    yy, xx = _grid(h, w)
    X = xx * aspect                                   # metres-ish: 1.0 == rug width
    img = paint.wash('#7B2431', h, w, seed=seed, tint_var=0.07, blotch=0.10, facets=int(24 * aspect), facet_var=0.05, edge=0.04, grain=0.03)
    ex = np.minimum(X, aspect - X)
    ey = np.minimum(yy, 1 - yy)
    e = np.minimum(ex, ey)
    one = np.ones_like(img)
    def band(lo, hi):
        return ((e >= lo) & (e < hi)).astype(np.float32)
    img = _mix(img, one * _rgb('#22385E'), band(0.02, 0.075))
    img = _mix(img, one * _rgb('#E8D8AE'), band(0.085, 0.100))
    img = _mix(img, one * _rgb('#1E3254'), band(0.105, 0.150))
    img = _mix(img, one * _rgb('#CDA85A'), band(0.155, 0.165))
    t = np.where(ex < ey, yy, X)
    rh = (0.5 + 0.5 * np.sin(t * 2 * math.pi * 22)) * band(0.032, 0.066)
    img = _mix(img, one * _rgb('#D9B968'), np.clip(rh - 0.35, 0, 1) * 1.4)
    cx = (X % 1.0) - 0.5
    cy = yy - 0.5
    field = (e > 0.175)
    for s_, col, wd in ((0.30, '#E1CFA3', 0.02), (0.22, '#22385E', 0.03), (0.14, '#D9B968', 0.02), (0.06, '#7B2431', 0.03)):
        d = np.abs(cx) + np.abs(cy) * 1.15
        m = (np.abs(d - s_) < wd).astype(np.float32) * field
        img = _mix(img, one * _rgb(col), paint.blur(m, 1))
    lat = (0.5 + 0.5 * np.cos(X * 2 * math.pi * 6)) * (0.5 + 0.5 * np.cos(yy * 2 * math.pi * 6))
    img = _mix(img, one * _rgb('#B8566B'), np.clip(lat - 0.74, 0, 1) * 2.0 * field)
    img *= (0.92 + 0.10 * np.sin(xx * w * 0.8) * np.sin(yy * h * 0.8))[..., None]
    img *= (0.94 + 0.12 * paint.fbm(h, w, 8, 5, seed + 4))[..., None]
    return np.clip(img, 0, 1)


def clock_face(w=256, h=256, seed=131):
    """Ivory enamel dial with roman-numeral ticks, brass bezel and blued hands."""
    yy, xx = _grid(h, w)
    cx, cy = xx - 0.5, yy - 0.5
    r = np.sqrt(cx * cx + cy * cy)
    ang = np.arctan2(cy, cx)
    img = np.ones((h, w, 3), np.float32) * _rgb('#B08A3A')
    img = _mix(img, np.ones_like(img) * _rgb('#F2E8CF') * (0.95 + 0.06 * paint.fbm(h, w, 6, 3, seed))[..., None], (r < 0.44).astype(np.float32))
    for k in range(12):
        a = k * math.pi / 6
        px, py = 0.5 + 0.36 * math.cos(a), 0.5 + 0.36 * math.sin(a)
        d = np.sqrt((xx - px) ** 2 + (yy - py) ** 2)
        img = _mix(img, np.ones_like(img) * _rgb('#2B2420'), np.clip(1 - d / (0.028 if k % 3 == 0 else 0.016), 0, 1) > 0)
    for ln, hh in ((0.24, 0.35), (0.34, 0.70)):
        a = hh * 2 * math.pi - math.pi / 2
        img = _mix(img, np.ones_like(img) * _rgb('#22345A'), _line((h, w), [(0.5, 0.5), (0.5 + ln * math.cos(a), 0.5 + ln * math.sin(a))], 0.012) > 0.5)
    img = _mix(img, np.ones_like(img) * _rgb('#2B2420'), (np.abs(r - 0.44) < 0.006).astype(np.float32))
    return np.clip(img, 0, 1)


def porcelain(w=256, h=256, seed=141):
    """Cream porcelain painted with cobalt bands and little sprigs (vases / jars)."""
    yy, xx = _grid(h, w)
    img = paint.wash('#EFE9DA', h, w, seed=seed, tint_var=0.03, blotch=0.04, facets=0, grain=0.02)
    for y0 in (0.18, 0.5, 0.82):
        img = _mix(img, np.ones_like(img) * _rgb('#2B4C8C'), (np.abs(yy - y0) < 0.025).astype(np.float32))
    sprig = (0.5 + 0.5 * np.sin(xx * 2 * math.pi * 9)) * (np.abs(yy - 0.34) < 0.09)
    img = _mix(img, np.ones_like(img) * _rgb('#3E65A8'), np.clip(sprig - 0.55, 0, 1) * 2)
    sprig2 = (0.5 + 0.5 * np.sin(xx * 2 * math.pi * 9 + 1.5)) * (np.abs(yy - 0.66) < 0.09)
    img = _mix(img, np.ones_like(img) * _rgb('#3E65A8'), np.clip(sprig2 - 0.55, 0, 1) * 2)
    return np.clip(img, 0, 1)


def flagstone(w=1024, h=1024, seed=151, cells=6, joints=0.85):
    """Big irregular flagstones (voronoi slabs) with dark joints, per-slab tint, wear and moss in the cracks."""
    f1, edgew, cid = paint.voronoi(h, w, cells, seed, 0.85)
    img = paint.wash('#8E8A7E', h, w, seed=seed + 1, tint_var=0.05, blotch=0.10, facets=0, grain=0.04)
    pal = [_rgb('#8F8C82'), _rgb('#7E8186'), _rgb('#9A8F78'), _rgb('#76796F'), _rgb('#A19A88')]
    k = np.minimum((cid * len(pal)).astype(int), len(pal) - 1)
    tint = np.stack([np.stack(pal)[k][..., c] for c in range(3)], -1)
    img = img * 0.55 + tint * 0.45
    img *= (0.88 + 0.24 * paint.fbm(h, w, 10, 4, seed + 2))[..., None]
    joint = np.clip(1.0 - edgew * 5.0, 0, 1) ** 2
    img = _mix(img, np.ones_like(img) * _rgb('#2C2823'), joint * joints)
    rim = np.clip(1.0 - np.abs(edgew - 0.12) * 14, 0, 1)
    img *= (1.0 + 0.12 * rim)[..., None]
    moss = np.clip((paint.fbm(h, w, 7, 5, seed + 5) - 0.56) * 6, 0, 1) * np.clip(joint * 1.6 + 0.12, 0, 1)
    img = _mix(img, np.ones_like(img) * _rgb('#5F8040'), moss * 0.85)
    img = _splat(img, _dabs(h, w, 260, 4, seed + 7, 2.2), _rgb('#D3B97A'), 0.55)                   # scattered straw
    img = _splat(img, _dabs(h, w, 120, 10, seed + 8, 1.6), _rgb('#4E463C'), 0.30)                   # damp patches
    return np.clip(img, 0, 1)
