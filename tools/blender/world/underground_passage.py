"""
Painted atlases for the S4 passage (the long, low burrow corridor after the fall) and the earth cavern that surrounds it.

  * `bay_texture`     one 2.5 m bay of the corridor skin, painted as a single image: brick dado up both sides, an earth-strata vault with
                      stones, roots and moss, damp, soot and a warm lantern pool - four variants (red brick / yellow stock / whitewashed /
                      blue-brick) so a 26 m corridor is a run of different-looking bays between the stone ribs
  * `floor_texture`   10 m of floor: a Victorian encaustic-tile runner between flagstones, with lantern light baked in
  * `rib_texture`     voussoir stones for the arch ribs (limestone / brick / slate)
  * `cavern_*`        the dusky earth hollow around the passage (so no empty background is ever visible past the cutaway wall)
  * `puddle_texture`  rain-water reflecting the lantern and the warm doorway
Coordinates: `section()` gives the cross-section of the vault (see `SECTION`); textures are z-up painted images (rows run along the section
arc length s, columns run along the corridor axis x) and are flipped to row-0-top by `to_image_order`.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from lib import paint
from world.painters import _rgb
from world.underground_paint import (Canvas, TAU, hash2, masonry, mix, over, pal, rfbm, rfield, sstep, tint, to_u8, voronoi_slab,
                                     blur_mask, radial_glow, rect_mask, _BRICK_RED, _BRICK_STOCK, _CHALK)

HALF_W = 2.0           # half width of the corridor (m)
SPRING = 1.0           # height where the wall turns into the vault
RISE = 1.6             # vault rise above the spring line
BAY = 2.5              # rib spacing = bay length


def build_section(step=0.01):
    """Dense cross-section samples (s, y, z, ny, nz, hh): left wall (floor -> spring), semi-elliptical vault, right wall (spring -> floor).
    y is Blender-y (left wall at +HALF_W); (ny, nz) is the unit inward normal; hh is height above the floor."""
    pts = []
    n = int(SPRING / step)
    for i in range(n):
        pts.append((HALF_W, SPRING * i / n, -1.0, 0.0))
    m = 2400
    for i in range(m + 1):
        a = math.pi * i / m
        y, z = HALF_W * math.cos(a), SPRING + RISE * math.sin(a)
        gy, gz = y / HALF_W ** 2, (z - SPRING) / RISE ** 2
        ln = math.hypot(gy, gz) or 1.0
        pts.append((y, z, -gy / ln, -gz / ln))
    for i in range(1, n + 1):
        pts.append((-HALF_W, SPRING * (1 - i / n), 1.0, 0.0))
    ys = np.array([p[0] for p in pts])
    zs = np.array([p[1] for p in pts])
    nys = np.array([p[2] for p in pts])
    nzs = np.array([p[3] for p in pts])
    d = np.hypot(np.diff(ys), np.diff(zs))
    s = np.concatenate([[0.0], np.cumsum(d)])
    L = float(s[-1])
    t = np.arange(0.0, L + 1e-9, step)
    return dict(L=L, s=t, y=np.interp(t, s, ys), z=np.interp(t, s, zs), ny=np.interp(t, s, nys), nz=np.interp(t, s, nzs), hh=np.interp(t, s, zs),
                s_wall=SPRING, s_left_end=float(np.interp(SPRING, zs[:n + 1], s[:n + 1])))


SECTION = build_section()
SEC_L = SECTION['L']


def s_at_height(h, side):
    """Arc length s of the point at height h on the left (side=-1) or right (+1) half of the section."""
    hh, s = SECTION['hh'], SECTION['s']
    mid = len(s) // 2
    if side < 0:
        return float(np.interp(h, hh[:mid], s[:mid]))
    return float(np.interp(-h, -hh[mid:], s[mid:]))


def to_image_order(img):
    """z-up painted array -> row-0-top array for paint.to_image. (Rows run along s; the image 'up' is increasing s.)"""
    return np.ascontiguousarray(img[::-1])


# ------------------------------------------------------------------------------------------------ brick dado + earth vault
_BRICK_BLUE = dict(course=(0.084, 0.098), length=(0.25, 0.31), joint=0.015, bevel=0.6, tone=0.10, cloud=0.22, speckle=0.07, mortar='#B9B6AA',
                   pal=pal('#4D5C78', '#3E4B66', '#5E6F8C', '#6B5668', '#46536E', '#7A5F68', '#58698A', '#3A4560'))
_BRICK_WASH = dict(course=(0.084, 0.098), length=(0.25, 0.31), joint=0.015, bevel=0.55, tone=0.08, cloud=0.26, speckle=0.07, mortar='#E2D9C2',
                   pal=pal('#E8DEC4', '#D9CCAA', '#EFE5CE', '#C9774F', '#D4A07A', '#E2D4B6', '#BE6A48'))

VARIANTS = {
    'A': dict(brick=_BRICK_RED, lit=True, strata=('#5E4535', '#9C6C44', '#C2B598', '#6F767A', '#4E3B2F'), edges=(1.0, 1.55, 1.95, 2.28, 2.62)),
    'B': dict(brick=_BRICK_STOCK, lit=False, strata=('#936E4C', '#5A4431', '#B49E76', '#737679', '#51402F'), edges=(1.0, 1.4, 1.85, 2.2, 2.55)),
    'C': dict(brick=_BRICK_WASH, lit=True, strata=('#533D2D', '#966439', '#CDC3A8', '#627068', '#46362B'), edges=(1.0, 1.5, 1.88, 2.25, 2.6)),
    'D': dict(brick=_BRICK_BLUE, lit=False, strata=('#684E39', '#A87F4B', '#5E686E', '#A99C7C', '#49392E'), edges=(1.0, 1.35, 1.8, 2.15, 2.5)),
}


def _earth_vault(U, S, hh, seed, strata, edges, period):
    Hs, W = len(S), len(U)
    base = [np.ones((Hs, W, 3), np.float32) * _rgb(c) for c in strata]
    img = base[0].copy()
    grain = rfield(W, Hs, max(2, int(period * 3)), max(8, Hs // 3), seed + 1)           # long horizontal brush strokes (along the corridor)
    stroke = rfield(W, Hs, max(2, int(period * 2)), max(6, Hs // 14), seed + 2)
    tex = (0.90 + 0.34 * rfbm(W, Hs, int(period * 4), 6, 4, seed + 3)) * (0.94 + 0.12 * grain) * (0.94 + 0.12 * stroke)
    h2 = hh[:, None]
    for k in range(1, len(strata)):
        warp = (rfbm(W, Hs, int(period * 2.5) + k, 4, 3, seed + 10 * k) - 0.5) * 0.30 + (rfield(W, Hs, int(period * 12), 40, seed + 77 + k) - 0.5) * 0.02
        m = sstep(-0.07, 0.07, (h2 + warp) - edges[k - 1]) if k > 1 else sstep(-0.07, 0.07, h2 + warp - edges[0])
        img = img * (1 - m[..., None]) + base[k] * m[..., None]
    img = img * tex[..., None]
    # chalk lens flecks, iron staining, damp
    img = mix(img, np.ones_like(img) * _rgb('#E9E1C9'), sstep(0.70, 0.90, rfbm(W, Hs, int(period * 9), 8, 4, seed + 20)) * 0.45)
    img = mix(img, np.ones_like(img) * _rgb('#A5522C'), sstep(0.66, 0.90, rfbm(W, Hs, int(period * 7), 6, 4, seed + 21)) * 0.45)
    img = img * (1.0 - 0.30 * sstep(0.55, 0.85, rfbm(W, Hs, int(period * 5), 5, 3, seed + 22)))[..., None] * np.array([1.0, 0.98, 1.02], np.float32)
    return img


def _draw_stones(cv, rng, n, x_rng, v_rng, scale, palette):
    """Embedded stones: irregular faceted polygons (lit upper-left facet, shaded lower-right facet), a soft contact shadow, a crack or two.
    They are partly buried: a lighter 'soil lip' is smeared over one side so they read as dug-out cobbles rather than stickers."""
    cv.begin()
    for _ in range(n):
        x = rng.uniform(*x_rng)
        v = rng.uniform(*v_rng)
        r = scale * rng.uniform(0.45, 1.25)
        k = int(rng.integers(7, 11))
        ang0 = rng.uniform(0, TAU)
        rad = [r * rng.uniform(0.72, 1.18) for _ in range(k)]
        sq = rng.uniform(0.55, 0.9)
        pts = [(x + rad[i] * math.cos(ang0 + TAU * i / k), v + rad[i] * sq * math.sin(ang0 + TAU * i / k)) for i in range(k)]
        col = palette[int(rng.integers(len(palette)))]
        cv.poly([(px + r * 0.12, py - r * 0.10) for px, py in pts], col * 0.4, 70)               # contact shadow
        cv.poly(pts, col * (0.92 + 0.12 * rng.random()), 255)
        half = [pts[i] for i in range(k // 2 + 1)]                                                   # lit facet = one side of the polygon
        cv.poly([(x, v)] + half, np.clip(col * 1.22 + 0.04, 0, 1), 120)
        rest = [pts[i] for i in range(k // 2, k)] + [pts[0]]
        cv.poly([(x, v)] + rest, col * 0.78, 110)
        if rng.random() < 0.45:
            cv.line([(x - r * 0.3, v + r * 0.1), (x + r * 0.05, v - r * 0.05), (x + r * 0.35, v - r * 0.3)], 1.1, col * 0.38, 190)
        if rng.random() < 0.6:                                                                      # soil lip over the lower side
            cv.dab(x, v - r * sq * 0.95, r * 0.9, r * 0.22, ang0 * 0.1, palette[int(rng.integers(len(palette)))] * 0.55, 120)
    cv.flush(blur=0.45)


def _roots(cv, rng, n, x_rng, v_rng, wmax, length=22):
    cv.begin()
    for _ in range(n):
        x, v = rng.uniform(*x_rng), rng.uniform(*v_rng)
        ang = rng.uniform(0, TAU)
        wd = rng.uniform(wmax * 0.5, wmax)
        for _b in range(int(rng.integers(1, 4))):
            pts = [(x, v)]
            xx, yy, aa = x, v, ang + rng.normal(0, 0.6)
            for _s in range(int(rng.integers(8, length))):
                aa += rng.normal(0, 0.3)
                xx += math.cos(aa) * 8
                yy += math.sin(aa) * 8
                pts.append((xx, yy))
            cv.line(pts, wd, _rgb('#7A5C3C'), 215)
            cv.line([(px + 1, py + 1) for px, py in pts], max(1.0, wd - 1.4), _rgb('#DCC99B'), 200)
            wd *= 0.6
    cv.flush(blur=0.6)


def bay_texture(variant, ppm=320, seed=4000, lamps=((1.0, 1.5),)):
    """One bay: width BAY (columns, corridor axis) x height SEC_L (rows, section arc length). Returns a z-up float image.
    lamps: [(x_local, height)] lantern positions; the lantern pools are baked on both sides + a soft wash on the vault."""
    spec = VARIANTS[variant]
    W, H = int(BAY * ppm), int(SEC_L * ppm)
    U = (np.arange(W) + 0.5) / W * BAY
    S = (np.arange(H) + 0.5) / H * SEC_L
    sec = SECTION
    hh_rows = np.interp(S, sec['s'], sec['hh'])
    img = np.zeros((H, W, 3), np.float32)
    rng = np.random.default_rng(seed)
    # ---- brick dado (left strip painted bottom-up, right strip painted bottom-up then flipped so light always comes from above)
    r_lo = int(SPRING * ppm)
    strip_rows = r_lo + int(0.25 * ppm)
    for side in (0, 1):
        Vs = (np.arange(strip_rows) + 0.5) / ppm
        layer, jm = masonry(U, Vs, spec['brick'], seed + 31 * side + 5, BAY)
        # moss and damp climb from the floor
        low = (1.0 - np.clip(Vs / 1.1, 0, 1))[:, None]
        mm = sstep(0.55, 0.78, rfbm(W, strip_rows, int(BAY * 6), 6, 4, seed + 40 + side)) * (0.2 + 0.9 * low ** 1.4)
        mm = np.maximum(mm, 0.7 * jm * sstep(0.5, 0.8, rfbm(W, strip_rows, int(BAY * 9), 7, 3, seed + 44 + side)) * low)
        mcol = pal('#56783A', '#7B9C48', '#A3B95D', '#486634')[np.minimum((rfbm(W, strip_rows, int(BAY * 20), 12, 2, seed + 46 + side) * 4).astype(int), 3)]
        layer = layer * (1 - 0.8 * mm[..., None]) + mcol * (0.8 * mm[..., None])
        layer = layer * (1.0 - 0.22 * sstep(0.66, 0.9, rfield(W, strip_rows, int(BAY * 12), 4, seed + 48 + side)) * (0.3 + 0.7 * low))[..., None] * np.array([0.98, 0.98, 1.04], np.float32)
        if side == 0:
            img[:r_lo] = layer[:r_lo]
        else:
            img[H - r_lo:] = layer[:r_lo][::-1]
    # ---- earth vault between the two dados
    v0, v1 = r_lo, H - r_lo
    Sv = S[v0:v1]
    vault = _earth_vault(U, Sv, hh_rows[v0:v1], seed + 200, spec['strata'], spec['edges'], BAY)
    img[v0:v1] = vault
    # a soft blend over the spring line (the stone string course hides the join anyway)
    # ---- brushwork over the vault: stones, gravel, roots, moss
    cv = Canvas(img, BAY, SEC_L)
    ppx = W / BAY
    def vpix(frac):
        return frac * (SEC_L - 2 * SPRING) * ppx
    cv.begin()
    for _ in range(420):                                           # gravel dabs
        x, y = rng.uniform(0, W), rng.uniform(v0 + 4, v1 - 4)
        c = pal('#A58A6A', '#C9B58E', '#8A7A66', '#6E5A48', '#D9CDB0', '#9C6A46')[int(rng.integers(6))]
        cv.dab(x, y, rng.uniform(1.6, 3.6), rng.uniform(1.4, 2.8), rng.uniform(0, 3), c * (0.80 + 0.25 * rng.random()), 150)
    cv.flush(blur=0.4)
    stone_pal = pal('#8F8B82', '#A39A86', '#6F7480', '#B09A78', '#7D7060', '#9A8D8A')
    _draw_stones(cv, rng, 44, (0, W), (v0 + 20, v1 - 20), 0.082 * ppm, stone_pal)
    cv.begin()
    for _ in range(520):                                           # pick-marks: short curved tool strokes, a dark edge and a lit edge
        x, y = rng.uniform(0, W), rng.uniform(v0 + 4, v1 - 4)
        ang = rng.uniform(-0.6, 0.6) + (math.pi / 2 if rng.random() < 0.35 else 0.0)
        ln = rng.uniform(10, 30)
        pts = [(x + math.cos(ang + 0.5 * t) * ln * t, y + math.sin(ang + 0.5 * t) * ln * t) for t in np.linspace(0, 1, 5)]
        cv.line(pts, 1.5, _rgb('#2A1D16'), 85)
        cv.line([(px + 1.4, py + 1.4) for px, py in pts], 1.1, _rgb('#E6D3A6'), 70)
    cv.flush(blur=0.5)
    _roots(cv, rng, 16, (0, W), (v0 + 10, v1 - 10), 3.2)
    cv.img = cv.img
    img = cv.img
    # moss pockets on the lower vault flanks and little toadstools
    hv = hh_rows[:, None]
    moss = sstep(0.62, 0.80, rfbm(W, H, int(BAY * 7), 10, 4, seed + 60)) * np.clip(1.0 - (hv - 1.0) / 0.9, 0, 1) * ((np.arange(H) >= v0) & (np.arange(H) < v1))[:, None]
    moss_col = pal('#5E8040', '#86A64C', '#AEC265', '#4C6C38')[np.minimum((rfbm(W, H, int(BAY * 22), 22, 2, seed + 61) * 4).astype(int), 3)]
    img = img * (1 - 0.8 * moss[..., None]) + moss_col * (0.8 * moss[..., None])
    cv = Canvas(img, BAY, SEC_L)
    cv.begin()
    for _ in range(7):
        x, y = rng.uniform(0, W), rng.choice([rng.uniform(40, v0 - 10), rng.uniform(v1 + 10, H - 40)])
        for k in range(int(rng.integers(2, 5))):
            xx, yy = x + rng.normal(0, 8), y + rng.normal(0, 6)
            r = rng.uniform(3, 6)
            cv.rect(xx - 1, yy - r, xx + 1, yy, _rgb('#EADFC5'), 255)
            cv.dab(xx, yy + 1, r * 1.1, r * 0.7, 0.0, _rgb('#C8503A') if rng.random() < 0.5 else _rgb('#E9D8B0'), 255)
            if rng.random() < 0.6:
                cv.dab(xx - 1, yy, r * 0.25, r * 0.2, 0.0, _rgb('#FFF6E0'), 255)
    cv.flush(blur=0.4)
    img = cv.img
    # ---- baked light: a warm pool round each lantern, a cooler shadow elsewhere, darker under the ribs' reveal
    lit = spec['lit']
    G = np.zeros((H, W), np.float32)
    px_u = W / BAY
    px_v = H / SEC_L
    for xl, hlamp in lamps:
        for side in (-1, 1):
            s_l = s_at_height(hlamp, side)
            if lit:
                G += radial_glow((H, W), [(xl * px_u, s_l * px_v, 0.95 * px_u, 1.0)], 0.8) * 1.0
                G += radial_glow((H, W), [(xl * px_u, s_l * px_v, 2.0 * px_u, 0.4)], 0.8)
        if lit:                                                    # lamp-light on the crown from the point light at the centre
            G += radial_glow((H, W), [(xl * px_u, (SEC_L / 2) * px_v, 1.8 * px_u, 0.42)], 0.8)
    gg = np.clip(G, 0, 1)[..., None]
    cool = np.array([0.88, 0.84, 0.94], np.float32)
    warm = np.array([1.35, 1.10, 0.80], np.float32)
    img = img * (cool * (1 - gg) + warm * gg)
    img += (np.clip(G - 0.5, 0, 1.2) ** 1.4)[..., None] * np.array([0.20, 0.10, 0.02], np.float32)
    # ribs' ends darken (they are hidden behind the stone ribs, so this just avoids a bright seam)
    edge = np.minimum(np.arange(W), W - 1 - np.arange(W)) / px_u
    img *= (1.0 - 0.22 * np.exp(-edge / 0.12))[None, :, None]
    # a hair of wander so neighbouring stretches never share a flat tint
    for c, (nu, nv) in enumerate(((5, 9), (7, 12), (4, 8))):
        f = rfbm(W, H, nu, nv, 3, seed + 500 + 13 * c)
        img[..., c] *= 1.0 + 0.10 * (f - 0.5) * 2
    img = np.clip(img, 0, 1)
    im = Image.fromarray(to_u8(img), 'RGB').filter(ImageFilter.GaussianBlur(0.7))
    return np.asarray(im, np.float32) / 255.0


# ------------------------------------------------------------------------------------------------ floor
_TILE_COL = {k: _rgb(v) for k, v in dict(cream='#E8DDBC', terra='#B5593D', slate='#3F5B82', ochre='#CDA14A', black='#2B2622', sage='#7F9C76', rose='#C98A7A').items()}


def _tile_pattern(kind, cu, cv, ink=0.0):
    """colour of an encaustic tile pattern at tile-local coords (cu, cv in -0.5..0.5)."""
    C = _TILE_COL
    one = np.ones(cu.shape + (3,), np.float32)
    r = np.sqrt(cu ** 2 + cv ** 2)
    if kind == 0:                                                   # diamond in a diamond
        d = np.abs(cu) + np.abs(cv)
        img = one * C['terra']
        img = mix(img, one * C['cream'], (d < 0.40).astype(np.float32))
        img = mix(img, one * C['slate'], (d < 0.21).astype(np.float32))
        img = mix(img, one * C['black'], ((d > 0.40) & (d < 0.43)).astype(np.float32))
    elif kind == 1:                                                 # eight-point star
        img = one * C['cream']
        cross = ((np.abs(cu) < 0.09) | (np.abs(cv) < 0.09)) & (r < 0.46)
        diag = ((np.abs(cu - cv) < 0.10) | (np.abs(cu + cv) < 0.10)) & (r < 0.40)
        img = mix(img, one * C['slate'], cross.astype(np.float32))
        img = mix(img, one * C['rose'], diag.astype(np.float32))
        img = mix(img, one * C['ochre'], (r < 0.13).astype(np.float32))
    elif kind == 2:                                                 # quarter fans from the corners
        img = one * C['ochre']
        dc = np.minimum.reduce([np.sqrt((np.abs(cu) - 0.5) ** 2 + (np.abs(cv) - 0.5) ** 2)])
        ring = (np.floor(dc / 0.12) % 2 == 0)
        img = mix(img, one * C['cream'], (ring & (dc < 0.5)).astype(np.float32))
        img = mix(img, one * C['black'], ((dc > 0.47) & (dc < 0.52)).astype(np.float32) * 0.0)
        img = mix(img, one * C['terra'], (r < 0.10).astype(np.float32))
    else:                                                           # bordered square, sage field
        img = one * C['sage']
        edge = np.maximum(np.abs(cu), np.abs(cv))
        img = mix(img, one * C['black'], ((edge > 0.40) & (edge < 0.47)).astype(np.float32))
        img = mix(img, one * C['cream'], (edge < 0.30).astype(np.float32))
        img = mix(img, one * C['terra'], (r < 0.12).astype(np.float32))
    return img


def floor_texture(ppm=256, seed=5100, period=10.0, width=4.0, lamp_x=(2.0, 7.0)):
    """z-up painted floor: image columns = x (periodic over `period` m), rows = z across the corridor (0..width)."""
    W, H = int(period * ppm), int(width * ppm)
    U = (np.arange(W) + 0.5) / W * period
    Z = (np.arange(H) + 0.5) / H * width
    f1, edge, cid = voronoi_slab(U, Z, 0.95, seed, period, 0.75)
    slabs = pal('#9B968B', '#8A8D92', '#A59C86', '#868A80', '#B2A78F', '#7D8590', '#A3958A', '#8F9A8C')
    k = np.minimum((cid * len(slabs)).astype(int), len(slabs) - 1)
    img = slabs[k] * (0.84 + 0.30 * hash2(cid * 811, cid * 233, seed))[..., None]
    img = img * (0.86 + 0.28 * rfbm(W, H, int(period * 3), 10, 4, seed + 1))[..., None]
    # slabs: lit rim, dark joints, a pale worn centre-line
    img = img * (1.0 + 0.16 * np.clip(1.0 - np.abs(edge - 0.06) / 0.05, 0, 1))[..., None]
    joint = 1.0 - sstep(0.012, 0.032, edge)
    img = mix(img, np.ones_like(img) * _rgb('#2D2924'), joint * 0.9)
    jm = sstep(0.55, 0.8, rfbm(W, H, int(period * 8), 10, 3, seed + 3)) * joint
    img = mix(img, np.ones_like(img) * _rgb('#667F42'), jm * 0.8)
    # ---- central encaustic runner
    zc = width / 2
    run_half = 0.75
    ts = 0.15
    inside = np.abs(Z - zc) < run_half + 0.05
    iu = np.floor(U / ts).astype(int)
    iv = np.floor((Z - (zc - run_half)) / ts).astype(int)
    fu = U / ts - iu
    fv = (Z - (zc - run_half)) / ts - iv
    IV, IU = np.meshgrid(iv, iu, indexing='ij')
    FV, FU = np.meshgrid(fv, fu, indexing='ij')
    kind = np.array([[0, 1], [2, 0]])[IV % 2, IU % 2]
    tiles = np.zeros((H, W, 3), np.float32)
    for kd in range(4):
        sel = kind == kd
        if sel.any():
            tiles[sel] = _tile_pattern(kd, (FU - 0.5)[sel], (FV - 0.5)[sel])
    border = (IV < 1) | (IV >= int(2 * run_half / ts) - 1)
    bcol = np.where(((IU // 2) % 2 == 0)[..., None], _TILE_COL['black'], _TILE_COL['terra'])
    tiles = np.where(border[..., None], bcol, tiles)
    glaze = 1.0 + 0.10 * np.exp(-((FV - 0.8) ** 2 + (FU - 0.25) ** 2) / 0.06)
    tiles = tiles * glaze[..., None] * (0.90 + 0.14 * hash2(IV, IU, seed))[..., None]
    gr = ((FU < 0.04) | (FU > 0.96) | (FV < 0.04) | (FV > 0.96))
    tiles = np.where(gr[..., None], np.array([0.58, 0.55, 0.48], np.float32), tiles)
    # worn centre line + crazing
    wear = np.exp(-((Z - zc) / 0.5) ** 2)[:, None] * rfbm(W, H, int(period * 6), 8, 3, seed + 9)
    tiles = tiles * (1.0 - 0.28 * sstep(0.45, 0.8, rfbm(W, H, int(period * 10), 9, 4, seed + 10)))[..., None]
    tiles = mix(tiles, np.ones_like(tiles) * _rgb('#D8CBA6'), wear * 0.18)
    m_run = sstep(-0.02, 0.02, (run_half + 0.03) - np.abs(Z - zc))[:, None] * np.ones((1, W), np.float32)
    img = img * (1 - m_run[..., None]) + tiles * m_run[..., None]
    # dark fillet either side of the runner
    fil = np.exp(-np.abs(np.abs(Z - zc) - (run_half + 0.06)) / 0.015)
    img = img * (1.0 - 0.5 * fil)[:, None, None]
    # damp / puddle stains and dust
    img = img * (1.0 - 0.40 * sstep(0.62, 0.85, rfbm(W, H, int(period * 4), 6, 4, seed + 12)))[..., None] * np.array([0.95, 0.97, 1.03], np.float32)
    cv = Canvas(img, period, width)
    rng = np.random.default_rng(seed + 20)
    cv.begin()
    for _ in range(260):                                             # straw, grit, a stray leaf
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        c = pal('#D3B97A', '#B89A5A', '#8F7B4A', '#C9A04A', '#9C6A3A', '#6E7F45')[int(rng.integers(6))]
        cv.dab(x, y, rng.uniform(3, 9), rng.uniform(0.8, 1.8), rng.uniform(0, 3.14), c, 225)
    cv.flush(blur=0.4)
    img = cv.img
    # ---- baked lantern light: a warm pool under the central lamp, smaller pools below each wall lantern, ambient dim near the walls
    G = np.zeros((H, W), np.float32)
    px_u, px_v = W / period, H / width
    for lx in lamp_x:
        G += radial_glow((H, W), [(lx * px_u, zc * px_v, 1.9 * px_u, 0.95)], 0.8)
        for zz in (0.55, width - 0.55):
            G += radial_glow((H, W), [(lx * px_u, zz * px_v, 1.1 * px_u, 0.5)], 0.8)
    gg = np.clip(G, 0, 1)[..., None]
    img = img * (np.array([0.86, 0.83, 0.94], np.float32) * (1 - gg) + np.array([1.32, 1.08, 0.80], np.float32) * gg)
    img += (np.clip(G - 0.55, 0, 1.2) ** 1.4)[..., None] * np.array([0.18, 0.09, 0.02], np.float32)
    wall_d = np.minimum(Z, width - Z)
    img *= (1.0 - 0.38 * np.exp(-wall_d / 0.28))[:, None, None]
    img = np.clip(img, 0, 1)
    im = Image.fromarray(to_u8(img), 'RGB').filter(ImageFilter.GaussianBlur(0.6))
    return np.asarray(im, np.float32) / 255.0


# ------------------------------------------------------------------------------------------------ ribs
def rib_texture(kind, w=768, h=256, seed=5200):
    """Voussoirs seen along the arch: 3 stones per repeat (limestone / slate) or 6 bricks (brick rib). u runs along the arc."""
    spec = {
        'lime': dict(n=3, pal=pal('#DDD2B6', '#CDC1A0', '#E8DFC8', '#C2B692', '#D6CBAF'), mortar='#8C8570', tone=0.06),
        'brick': dict(n=6, pal=pal('#B9553D', '#A24734', '#C97A56', '#8A4034', '#BC6A4A'), mortar='#D4C8AC', tone=0.08),
        'slate': dict(n=3, pal=pal('#6E7886', '#5C6673', '#7F8996', '#58606C', '#767F8C'), mortar='#23272E', tone=0.06),
    }[kind]
    rng = np.random.default_rng(seed)
    n = spec['n']
    img = np.zeros((h, w, 3), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sw = w / n
    idx = np.minimum((xx / sw).astype(int), n - 1)
    fx = (xx - idx * sw) / sw
    fy = yy / h
    cols = spec['pal'][rng.integers(0, len(spec['pal']), n)] * (1 + rng.normal(0, spec['tone'], n))[:, None]
    img = cols[idx]
    img = img * (0.84 + 0.30 * rfbm(w, h, 6, 3, 4, seed + 1))[..., None]
    img = img * (0.94 + 0.12 * rfield(w, h, 90, 5, seed + 2))[..., None]
    jw = 0.03 if kind != 'brick' else 0.05
    dj = np.minimum(fx, 1 - fx)
    jm = 1.0 - sstep(jw * 0.5, jw * 1.4, dj)
    img = mix(img, np.ones_like(img) * _rgb(spec['mortar']), jm * 0.92)
    img = img * (1.0 + 0.18 * np.exp(-np.abs(fx - 0.08) / 0.04) - 0.20 * np.exp(-np.abs(1 - fx - 0.02) / 0.04))[..., None]
    img = img * (1.0 - 0.30 * np.exp(-fy / 0.06) - 0.30 * np.exp(-(1 - fy) / 0.06))[..., None]            # rounded edges
    img = mix(img, np.ones_like(img) * _rgb('#6F8A4A'), sstep(0.66, 0.84, rfbm(w, h, 10, 4, 4, seed + 3)) * 0.55 * (fy[..., None][..., 0] > 0.0))
    return np.clip(img, 0, 1)


# ------------------------------------------------------------------------------------------------ end wall
def end_wall_texture(w=1024, h=832, seed=5300, door_glow=False):
    """The blank end of the corridor, seen planar: y across (4 m), z up (0..3.25 m): brick with mortar, damp, roots, moss and cracks."""
    ppm = w / 4.0
    U = (np.arange(w) + 0.5) / w * 4.0
    V = (np.arange(h) + 0.5) / h * (h / ppm)
    img, jm = masonry(U, V, _BRICK_STOCK if not door_glow else _BRICK_RED, seed, 4.0)
    low = np.clip(1.0 - V / 1.6, 0, 1)[:, None]
    mm = sstep(0.55, 0.78, rfbm(w, h, 12, 8, 4, seed + 1)) * (0.25 + 0.85 * low)
    mcol = pal('#56783A', '#7B9C48', '#A3B95D', '#486634')[np.minimum((rfbm(w, h, 40, 28, 2, seed + 2) * 4).astype(int), 3)]
    img = img * (1 - 0.8 * mm[..., None]) + mcol * (0.8 * mm[..., None])
    img = img * (1.0 - 0.36 * sstep(0.62, 0.84, rfield(w, h, 70, 5, seed + 3)))[..., None]
    cv = Canvas(img, 4.0, h / ppm)
    rng = np.random.default_rng(seed)
    cv.begin()
    for _ in range(90):
        x, y = rng.uniform(0, w), rng.uniform(0.1, 0.95) * h
        pts = [(x, y)]
        a = rng.uniform(0, TAU)
        for _s in range(int(rng.integers(5, 14))):
            a += rng.normal(0, 0.5)
            x += math.cos(a) * 9
            y += math.sin(a) * 9
            pts.append((x, y))
        cv.line(pts, 1.5, _rgb('#2E2420'), 150)
    cv.flush(blur=0.5)
    img = cv.img
    _roots(cv, rng, 14, (0, w), (0.4 * h, h), 3.0)
    img = cv.img
    gx = np.exp(-((U[None, :] - 2.0) ** 2) / (2 * 1.4 ** 2)) * np.exp(-((V[:, None] - 1.0) ** 2) / (2 * 0.9 ** 2))
    if door_glow:
        img = img * (np.array([0.78, 0.72, 0.84], np.float32) * (1 - gx[..., None]) + np.array([1.4, 1.12, 0.78], np.float32) * gx[..., None])
    else:
        img = img * np.array([0.80, 0.76, 0.88], np.float32)
    return np.clip(img, 0, 1)


# ------------------------------------------------------------------------------------------------ cavern
def cavern_wall(w=1536, h=768, seed=5400):
    """Tileable dusky earth wall for the hollow around the passage (cool, low-contrast, so it recedes behind the warm corridor)."""
    img = np.ones((h, w, 3), np.float32) * _rgb('#43343C')
    img *= (0.80 + 0.40 * rfbm(w, h, 6, 4, 4, seed))[..., None]
    for k, (lo, hi, col) in enumerate(((0.12, 0.30, '#5A4448'), (0.38, 0.52, '#33303C'), (0.60, 0.74, '#5E4E46'), (0.82, 0.95, '#3A3040'))):
        yy = (np.arange(h) / h)[:, None]
        warp = (rfbm(w, h, 4, 3, 2, seed + 10 + k) - 0.5) * 0.18
        m = sstep(-0.02, 0.02, yy + warp - lo) * (1 - sstep(-0.02, 0.02, yy + warp - hi))
        img = mix(img, np.ones_like(img) * _rgb(col) * (0.85 + 0.3 * rfbm(w, h, 8, 5, 3, seed + 20 + k))[..., None], m * 0.8)
    cv = Canvas(img, 1.0, 1.0)
    rng = np.random.default_rng(seed)
    _draw_boulders(cv, rng, 34, w, h)
    _roots(cv, rng, 26, (0, w), (0, h), 6.0, 30)
    img = cv.img
    cv = Canvas(img, 1.0, 1.0)
    cv.begin()
    for _ in range(46):                                              # little luminous toadstool colonies (teal / violet), far-away colour accents
        x, y = rng.uniform(0, w), rng.uniform(0.05, 0.95) * h
        col = pal('#7FD4C0', '#B79BE8', '#E8A0B8', '#9AD08A')[int(rng.integers(4))]
        for _k in range(int(rng.integers(3, 8))):
            cv.dab(x + rng.normal(0, 10), y + rng.normal(0, 6), rng.uniform(2.5, 5), rng.uniform(1.6, 3), 0.0, col, 230)
    cv.flush(blur=1.6, opacity=0.9)
    cv.begin()
    for _ in range(46):
        x, y = rng.uniform(0, w), rng.uniform(0.05, 0.95) * h
        cv.dab(x, y, 3.0, 2.0, 0.0, pal('#EFFFF5')[0], 255)
    cv.flush(blur=0.4, opacity=0.6)
    img = cv.img
    img = np.clip(img * np.array([0.95, 0.92, 1.05], np.float32), 0, 1)
    return img


def _draw_boulders(cv, rng, n, w, h):
    pal_ = pal('#6C6A76', '#7A6E70', '#585A6A', '#867A72', '#605468')
    cv.begin()
    for _ in range(n):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(20, 70)
        ry = r * rng.uniform(0.55, 0.9)
        c = pal_[int(rng.integers(len(pal_)))]
        cv.dab(x + r * 0.08, y - ry * 0.10, r * 1.08, ry * 1.1, 0.0, c * 0.35, 200)
        cv.dab(x, y, r, ry, rng.uniform(-0.3, 0.3), c, 255)
        cv.dab(x - r * 0.2, y + ry * 0.25, r * 0.65, ry * 0.5, 0.0, np.clip(c * 1.3 + 0.04, 0, 1), 220)
    cv.flush(blur=1.0)


def cavern_ground(size=1024, seed=5500):
    img = np.ones((size, size, 3), np.float32) * _rgb('#4A3B33')
    img *= (0.78 + 0.44 * rfbm(size, size, 5, 5, 4, seed))[..., None]
    img = mix(img, np.ones_like(img) * _rgb('#6A5A44'), sstep(0.55, 0.8, rfbm(size, size, 7, 7, 4, seed + 1)) * 0.5)
    img = mix(img, np.ones_like(img) * _rgb('#4A6038'), sstep(0.62, 0.8, rfbm(size, size, 6, 6, 4, seed + 2)) * 0.55)       # moss
    cv = Canvas(img, 1.0, 1.0)
    rng = np.random.default_rng(seed)
    cv.begin()
    for _ in range(420):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        r = rng.uniform(3, 9)
        c = pal('#7C7468', '#6A5E54', '#8C8070', '#58505A', '#9A8E78')[int(rng.integers(5))]
        cv.dab(x + 1, y - 1, r, r * 0.8, rng.uniform(0, 3), c * 0.4, 180)
        cv.dab(x, y, r, r * 0.8, rng.uniform(0, 3), c, 245)
    cv.flush(blur=0.4)
    img = cv.img
    return np.clip(img, 0, 1)


def puddle_texture(size=512, seed=5600):
    """Wet flagstone water: a pale sky-blue sheen over deep teal, a warm column of reflected lantern/doorway light, ripple rings and a soft rim."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    base = np.ones((size, size, 3), np.float32) * _rgb('#4A7488')
    base = base * (0.85 + 0.30 * rfbm(size, size, 4, 4, 3, seed))[..., None]
    sky = np.clip(1.0 - yy * 1.2, 0, 1)
    base = mix(base, np.ones_like(base) * _rgb('#A9BCD8'), sky * 0.45)
    refl = np.exp(-((xx - 0.5) / 0.12) ** 2) * np.clip(1.0 - yy * 0.7, 0, 1) * (0.75 + 0.25 * np.sin(yy * 50))
    base = base + refl[..., None] * np.array([1.0, 0.74, 0.30], np.float32) * 0.95
    base = base + (np.exp(-(((xx - 0.5) / 0.06) ** 2 + ((yy - 0.20) / 0.06) ** 2)))[..., None] * np.array([1.0, 0.97, 0.78], np.float32)
    rr = np.sqrt((xx - 0.62) ** 2 + (yy - 0.62) ** 2)
    ring = np.clip(1.0 - np.abs(((rr * 24) % 1.0) - 0.5) * 6, 0, 1) * np.exp(-rr * 3.5)
    base = base + ring[..., None] * 0.30
    rim = np.clip((np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2) - 0.38) / 0.12, 0, 1)
    base = mix(base, np.ones_like(base) * _rgb('#9AA5A8'), rim * 0.65)
    return np.clip(base, 0, 1)
