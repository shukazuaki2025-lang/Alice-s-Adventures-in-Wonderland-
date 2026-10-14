"""
Hand-painted (procedural) texture set for Alice — gouache / watercolour look with brush facets and paper grain.
All paint is placed in the same metric space as the geometry (see head.py UV conventions), so painted features line
up with the mesh by construction.
"""
import math

import numpy as np

from lib import paint
from . import spec

HC = spec.HEAD_C
P = spec.PALETTE


def _rgb(hexstr):
    return paint.hex_rgb(hexstr)


def _blend(img, mask, color, alpha=1.0):
    """img[h,w,3] = lerp(img, color, mask*alpha) with mask in [0,1]."""
    m = (np.clip(mask, 0, 1) * alpha)[..., None]
    c = np.asarray(color, np.float32)
    return img * (1 - m) + c * m


def _grid(h, w):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return (xx + 0.5) / w, (yy + 0.5) / h   # u, v in 0..1 (v up is handled by callers)


def _ellipse(u, v, cu, cv, ru, rv, soft=0.5):
    d = np.sqrt(((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2)
    return np.clip(1.0 - d, 0, 1) ** (1.0 + soft) if soft else (d < 1).astype(np.float32)


def _gaussian2(u, v, cu, cv, su, sv):
    return np.exp(-(((u - cu) / su) ** 2 + ((v - cv) / sv) ** 2) * 0.5)


def _grain(img, seed, amount=0.02):
    h, w = img.shape[:2]
    n = paint.value_noise(h, w, h // 2, w // 2, seed)
    return np.clip(img * (1.0 + (n - 0.5)[..., None] * amount * 2), 0, 1)


# ---------------------------------------------------------------------------------------------------------------
def skin(size=512):
    img = paint.wash(P['skin'], size, size, seed=3, tint_var=0.025, blotch=0.03, facets=10, facet_var=0.012, edge=0.02, grain=0.012)
    u, v = _grid(size, size)
    n = paint.fbm(size, size, 3, 3, 77)
    img = _blend(img, n, _rgb(P['blush']), 0.10)
    return img


def head(size=1024, freckles=True, blush_amt=0.62, lip_tint=None):
    img = paint.wash(P['skin'], size, size, seed=11, tint_var=0.02, blotch=0.025, facets=14, facet_var=0.012, edge=0.018, grain=0.012)
    u, v = _grid(size, size)
    X = (u - 0.5) * 0.25            # metres from the head centre line
    Z = HC.z + (0.5 - v) * 0.30     # image row 0 is the top (we flip when storing)
    # forehead / nose-bridge warm light
    img = _blend(img, _gaussian2(X, Z, 0, 1.06, 0.045, 0.030), _rgb('#FFE2C8'), 0.30)
    # blush
    for s in (1, -1):
        img = _blend(img, _gaussian2(X, Z, 0.058 * s, 0.940, 0.026, 0.017), _rgb(P['blush']), blush_amt)
        img = _blend(img, _gaussian2(X, Z, 0.058 * s, 0.940, 0.016, 0.010), _rgb('#E8826F'), 0.30)
    # nose tip + under-nose shadow + nostrils
    img = _blend(img, _gaussian2(X, Z, 0, 0.962, 0.010, 0.007), _rgb('#F0A08E'), 0.45)
    img = _blend(img, _gaussian2(X, Z, 0, 0.950, 0.018, 0.006), _rgb(P['skin_shadow']), 0.40)
    for s in (1, -1):
        img = _blend(img, _gaussian2(X, Z, 0.0085 * s, 0.9545, 0.0030, 0.0020), _rgb('#9A5A48'), 0.55)
    # soft eye-socket shading + lower lid crease
    for s in (1, -1):
        img = _blend(img, _gaussian2(X, Z, spec.EYE_X * s, spec.EYE_C_Z + 0.030, 0.026, 0.010), _rgb('#E3AC92'), 0.30)
        img = _blend(img, _gaussian2(X, Z, spec.EYE_X * s, spec.EYE_C_Z - 0.036, 0.022, 0.006), _rgb('#E9A38E'), 0.28)
    # chin & jaw shadow, temples
    img = _blend(img, _gaussian2(X, Z, 0, 0.893, 0.060, 0.012), _rgb(P['skin_shadow']), 0.45)
    for s in (1, -1):
        img = _blend(img, _gaussian2(X, Z, 0.105 * s, 1.0, 0.012, 0.09), _rgb(P['skin_shadow']), 0.40)
    # ears: pink inner ear (ears sit at x=+-0.0955)
    for s in (1, -1):
        img = _blend(img, _gaussian2(X, Z, 0.0955 * s, HC.z - 0.012, 0.004, 0.012), _rgb('#E58E80'), 0.55)
    # faint freckles over the nose bridge (very light — Tenniel's Alice is fair)
    rng = np.random.default_rng(5)
    for _ in range(14 if freckles else 0):
        fx = rng.normal(0, 0.020)
        fz = 0.982 + rng.normal(0, 0.006)
        if abs(fx) < 0.003:
            continue
        img = _blend(img, _gaussian2(X, Z, fx, fz, 0.0017, 0.0017), _rgb('#C98A6A'), 0.25)
    img = _grain(img, 91, 0.012)
    return img


def lid(size=256):
    """Upper lid in v∈[0,0.5] (edge at v=0), lower lid in v∈[0.5,1] (edge at v=0.5)."""
    img = paint.wash('#F1BB9F', size, size, seed=21, tint_var=0.02, blotch=0.02, facets=0, grain=0.012)
    u, v = _grid(size, size)
    up = v < 0.5
    vu = np.where(up, v / 0.5, 0.0)
    # upper lash line: dark band right at the edge, thick at the outer corner
    az = (u - 0.5)
    thick = 0.075 + 0.05 * np.clip(az * 2, -1, 1)   # thicker toward +u (outer corner after mirroring is handled in UV)
    lash = np.clip(1.0 - vu / np.maximum(thick, 1e-3), 0, 1) ** 0.6 * up
    img = _blend(img, lash, _rgb('#2F1B12'), 0.96)
    # crease
    crease = np.exp(-((vu - 0.30) / 0.05) ** 2) * up
    img = _blend(img, crease, _rgb('#D88F78'), 0.45)
    # lower lid: delicate warm line
    lo = ~up
    vl = np.where(lo, (v - 0.5) / 0.5, 0.0)
    ll = np.clip(1.0 - vl / 0.05, 0, 1) ** 0.8 * lo
    img = _blend(img, ll, _rgb('#B8705E'), 0.55)
    return img


def eye(size=512):
    """Front-projected eyeball: u,v 0..1 span the globe's diameter."""
    u, v = _grid(size, size)
    x = (u - 0.5) * 2.0
    y = (0.5 - v) * 2.0
    r = np.sqrt(x * x + y * y)
    ang = np.arctan2(y, x)
    img = np.ones((size, size, 3), np.float32) * _rgb('#FBF7F0')
    # sclera shading: bluish-grey toward the rim, a touch of pink at the corners
    img = _blend(img, np.clip((r - 0.55) / 0.5, 0, 1) ** 1.4, _rgb('#D9D6DC'), 0.9)
    img = _blend(img, np.clip(np.abs(x) - 0.55, 0, 1) * 2.0, _rgb('#F0C9C0'), 0.35)
    # iris
    ri = 0.60
    iris = np.clip((ri - r) / 0.025, 0, 1)
    n_streaks = 0.5 + 0.5 * np.sin(ang * 46.0 + 3.0 * paint.fbm(size, size, 4, 3, 4))
    base = _rgb('#8C5E36')
    inner = _rgb('#C48A4E')
    outer = _rgb('#3E2616')
    t = np.clip(r / ri, 0, 1)
    col = base[None, None, :] * (1 - t[..., None]) + outer[None, None, :] * (t[..., None] ** 2.2)
    col = col * (0.88 + 0.22 * n_streaks[..., None])
    col = col + (inner - base)[None, None, :] * np.exp(-((t - 0.45) / 0.22) ** 2)[..., None] * 0.55
    # darker upper half (shadow of the lid)
    col = col * (1.0 - 0.28 * np.clip(y * 1.4, 0, 1)[..., None])
    img = img * (1 - iris[..., None]) + col * iris[..., None]
    # limbal ring
    ring = np.exp(-((r - ri + 0.02) / 0.03) ** 2)
    img = _blend(img, ring, _rgb('#2A170D'), 0.75)
    # pupil
    pupil = np.clip((0.26 - r) / 0.03, 0, 1)
    img = _blend(img, pupil, _rgb('#140B07'), 1.0)
    # catch-lights: big soft upper-right, small lower-left, + faint rim light
    c1 = np.clip((0.15 - np.sqrt((x - 0.25) ** 2 + (y - 0.30) ** 2)) / 0.04, 0, 1)
    c2 = np.clip((0.065 - np.sqrt((x + 0.22) ** 2 + (y + 0.26) ** 2)) / 0.03, 0, 1)
    img = _blend(img, c1, _rgb('#FFFFFF'), 0.97)
    img = _blend(img, c2, _rgb('#FFFFFF'), 0.85)
    rim = np.exp(-((r - 0.52) / 0.04) ** 2) * np.clip(-(x * 0.5 + y * 0.9), 0, 1)
    img = _blend(img, rim, _rgb('#E7B77C'), 0.35)
    img[0:6, 0:6, :] = _rgb('#FBF7F0')    # parked UV corner used for the back of the globe
    return np.clip(img, 0, 1)


def hair_cap(size=1024):
    """Top-projected scalp: radial strokes from the crown, a centre parting towards the front (+v), soft halo."""
    u, v = _grid(size, size)
    X = (u - 0.5) * 0.30
    Y = (0.5 - v) * 0.30          # +Y here = towards the front of the head (image top)
    r = np.sqrt(X * X + Y * Y)
    ang = np.arctan2(X, Y)         # 0 = front
    base = paint.wash(P['hair'], size, size, seed=31, tint_var=0.03, blotch=0.04, facets=18, facet_var=0.02, edge=0.03, grain=0.015)
    # radial streak field
    strokes = np.zeros((size, size), np.float32)
    for k, (freq, amp) in enumerate(((60, 0.5), (130, 0.35), (260, 0.25))):
        n1 = paint.value_noise(1, 512, 1, freq, 50 + k)[0]
        idx = ((ang + math.pi) / (2 * math.pi) * 511).astype(int) % 512
        strokes += (n1[idx] - 0.5) * amp
    base = base * (1.0 + (strokes * 0.30)[..., None])
    # radial gradient: darker at the crown, bright halo ring, darker at the hairline
    rn = r / 0.15
    base = _blend(base, np.exp(-(rn / 0.18) ** 2), _rgb(P['hair_dark']), 0.55)
    halo_dir = np.clip(np.cos(ang - 0.7), 0, 1)   # light from the front-right
    base = _blend(base, np.exp(-((rn - 0.52) / 0.10) ** 2) * (0.35 + 0.65 * halo_dir), _rgb(P['hair_light']), 0.75)
    base = _blend(base, np.clip((rn - 0.80) / 0.2, 0, 1), _rgb(P['hair_dark']), 0.55)
    # centre parting
    part = np.exp(-(np.abs(ang) / 0.020) ** 2) * (rn > 0.12) * (rn < 0.62) * (Y > 0)
    base = _blend(base, part, _rgb('#8F6A3A'), 0.80)
    return np.clip(base, 0, 1)


def hair_clump(w=512, h=1024):
    """Vertical strand streaks (u across the clump, v along it): root dark -> golden -> pale tips."""
    u, v = _grid(h, w)
    img = paint.wash(P['hair'], h, w, seed=41, tint_var=0.03, blotch=0.03, facets=0, grain=0.014)
    # long thin strands
    s = np.zeros((h, w), np.float32)
    for k, (cu, amp) in enumerate(((46, 0.6), (110, 0.4), (220, 0.25))):
        wave = 0.012 * np.sin(v * 9.0 + k * 2.0)
        n = paint.value_noise(1, 2048, 1, cu, 60 + k)[0]
        idx = (((u + wave) % 1.0) * 2047).astype(int)
        s += (n[idx] - 0.5) * amp
    img = img * (1.0 + (s * 0.36)[..., None])
    # along-length colouring
    img = _blend(img, np.clip(1.0 - v / 0.22, 0, 1), _rgb(P['hair_dark']), 0.60)
    img = _blend(img, np.exp(-((v - 0.30) / 0.09) ** 2), _rgb(P['hair_light']), 0.55)
    img = _blend(img, np.clip((v - 0.78) / 0.22, 0, 1), _rgb(P['hair_light']), 0.40)
    # warm darker edges of each clump
    img = _blend(img, np.clip(np.abs(u - 0.5) * 2 - 0.65, 0, 1) * 2.0, _rgb(P['hair_dark']), 0.35)
    return np.clip(img, 0, 1)


def dress(size=1024):
    img = paint.wash(P['dress'], size, size, seed=51, tint_var=0.035, blotch=0.05, facets=22, facet_var=0.025, edge=0.04, grain=0.016)
    u, v = _grid(size, size)
    # tiny cream sprigs in a staggered lattice
    cell = 1.0 / 34.0
    gx = u / cell
    gy = v / (cell * 1.0)
    row = np.floor(gy)
    gx2 = gx + 0.5 * (row % 2)
    fx = gx2 - np.floor(gx2) - 0.5
    fy = gy - row - 0.5
    d = np.sqrt(fx * fx + fy * fy)
    dot = np.clip((0.12 - d) / 0.05, 0, 1)
    petals = np.clip((0.20 - d) / 0.05, 0, 1) * (np.abs(np.sin(np.arctan2(fy, fx) * 2.5)) ** 3) * 0.7
    img = _blend(img, np.maximum(dot, petals * 0.6), _rgb('#FFF1C9'), 0.55)
    return img


def apron(size=512):
    img = paint.wash(P['apron'], size, size, seed=61, tint_var=0.015, blotch=0.025, facets=8, facet_var=0.008, edge=0.012, grain=0.012)
    u, v = _grid(size, size)
    weave = 0.5 + 0.25 * np.sin(u * size * 0.95 * math.pi) * np.sin(v * size * 0.95 * math.pi)
    img = img * (1.0 - 0.025 * (1.0 - weave)[..., None])
    img = _blend(img, paint.fbm(size, size, 3, 3, 9), _rgb('#E3E7EE'), 0.20)   # cool washed-linen blotches
    return np.clip(img, 0, 1)


def stocking(size=256):
    img = paint.wash(P['stocking'], size, size, seed=71, tint_var=0.012, blotch=0.02, facets=0, grain=0.014)
    u, v = _grid(size, size)
    ribs = 0.5 + 0.5 * np.sin(u * size * 0.5 * math.pi * 2 * 0.5)
    img = img * (1.0 - 0.050 * (1.0 - ribs)[..., None])
    img = _blend(img, paint.fbm(size, size, 3, 3, 8), _rgb('#E5E3E6'), 0.20)
    return np.clip(img, 0, 1)


def shoe(size=256):
    img = paint.wash(P['shoe'], size, size, seed=81, tint_var=0.05, blotch=0.07, facets=8, facet_var=0.04, edge=0.04, grain=0.02)
    u, v = _grid(size, size)
    gloss = np.exp(-((v - 0.35) / 0.10) ** 2) * (0.5 + 0.5 * paint.fbm(size, size, 5, 3, 3))
    img = _blend(img, gloss, _rgb('#6B5649'), 0.55)
    return np.clip(img, 0, 1)


def ribbon(size=256):
    img = paint.wash(P['ribbon'], size, size, seed=91, tint_var=0.04, blotch=0.05, facets=6, facet_var=0.02, edge=0.03, grain=0.014)
    u, v = _grid(size, size)
    sheen = 0.5 + 0.5 * np.sin(u * 7.0 + 1.2 * paint.fbm(size, size, 2, 3, 12)) ** 3
    img = _blend(img, sheen, _rgb('#5668A6'), 0.45)
    return np.clip(img, 0, 1)


def make_all(out_dir=None):
    """Create images + Blender materials. Returns {slot_name: material}."""
    mats = {}

    def mk(name, arr, rough=0.9):
        # arrays are painted with row 0 = top; paint.to_image flips into Blender's bottom-left origin
        img = paint.to_image('T_' + name, np.ascontiguousarray(arr), out_dir)
        mats[name] = paint.make_material('M_' + name, img, roughness=rough)

    mk('Alice_Skin', skin())
    mk('Alice_Face', head())
    mk('Alice_Lid', lid())
    mk('Alice_Eye', eye(), rough=0.25)
    mk('Alice_HairCap', hair_cap(), rough=0.6)
    mk('Alice_Hair', hair_clump(), rough=0.6)
    mk('Alice_Dress', dress())
    mk('Alice_Collar', apron(256))
    mk('Alice_Apron', apron())
    mk('Alice_Stockings', stocking())
    mk('Alice_Shoes', shoe(), rough=0.45)
    mk('Alice_Ribbon', ribbon(), rough=0.4)

    def flat(name, hexc, rough=0.8, metal=0.0):
        c = paint.srgb_to_linear(_rgb(hexc))
        mats[name] = paint.make_material('M_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, metal)

    flat('Alice_Brow', '#8B6A3A')
    flat('Alice_Lips', P['lip'], 0.5)
    flat('Alice_Mouth', '#5A2323', 0.6)
    flat('Alice_Buckle', P['brass'], 0.35, 0.8)
    return mats


class palette:
    """Context manager: temporarily override palette entries (used to re-skin the shared head/hair painters)."""

    def __init__(self, **kw):
        self.kw = kw

    def __enter__(self):
        self.old = dict(P)
        P.update(self.kw)

    def __exit__(self, *a):
        P.clear()
        P.update(self.old)
