"""
Painted (procedural) textures + small modelling helpers for the two underground sets: the S3 well shaft and the S4 passage.

Same gouache family as `painters.py` / `interior.py`, but built for *whole-surface atlases*: instead of one small tile repeated over
a 25 m wall, the shaft wall and the passage bays are painted once, at roughly 240 px per metre, as periodic wrap-around images - strata of
differently coloured masonry (red brick, yellow stock brick, chalk ashlar, ochre sandstone, slate flags, flint-in-chalk), plaster repairs,
damp streaks, moss, verdigris, roots, cobwebs, painted niches and warm lantern light pools *baked into the wall* (so a lamp lights its
own patch of brick the way a picture-book painter would paint it).

Every texture is seeded and deterministic; nothing is photographic or downloaded. Arrays are float32 (h, w, 3) sRGB in 0..1 with row 0 = TOP
(what `paint.to_image` expects) unless a function says otherwise.

Coordinates: a "grid" is two 1-D vectors, `U` (metres along the periodic horizontal direction, length W) and `V` (metres upward, length H).
Fields are generated with `rfield` (bicubic-upsampled periodic value noise) so a 6144x1536 atlas costs a fraction of a second per octave.
"""
import math

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from lib import paint
from world.painters import _rgb

TAU = 2.0 * math.pi


# ------------------------------------------------------------------------------------------------ small maths
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def pal(*hexes):
    return np.array([paint.hex_rgb(h) for h in hexes], np.float32)


def mix(a, b, t):
    """a*(1-t)+b*t with t broadcast over the trailing colour axis."""
    t = np.asarray(t, np.float32)
    if t.ndim == a.ndim - 1:
        t = t[..., None]
    return a * (1.0 - t) + b * t


def tint(img, color, amount):
    """Multiply `img` towards `color` (a hex string or rgb) by a per-pixel amount (h, w) - a glaze, not an opaque coat."""
    c = _rgb(color) if isinstance(color, str) else np.asarray(color, np.float32)
    amount = np.asarray(amount, np.float32)[..., None]
    return img * (1.0 - amount) + img * c * amount


def over(img, color, alpha):
    """Opaque-ish coat of `color` with per-pixel alpha (h, w)."""
    c = _rgb(color) if isinstance(color, str) else np.asarray(color, np.float32)
    a = np.clip(np.asarray(alpha, np.float32), 0, 1)[..., None]
    return img * (1.0 - a) + c * a


def to_u8(img):
    return (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)


def from_u8(a):
    return np.asarray(a, np.float32) / 255.0


# ------------------------------------------------------------------------------------------------ periodic fields
def rfield(W, H, nu, nv, seed):
    """Smooth periodic noise in [0,1]: `nu` lattice cells across the width and `nv` up the height, bicubic upsampled from a wrapped lattice."""
    rng = np.random.default_rng(seed)
    g = rng.random((nv, nu)).astype(np.float32)
    pad = np.pad(g, 2, mode='wrap')
    im = Image.fromarray(pad, 'F').resize((W, H), Image.BICUBIC, box=(2, 2, 2 + nu, 2 + nv))
    return np.clip(np.asarray(im, np.float32), 0.0, 1.0)


def rfbm(W, H, nu, nv, octaves=4, seed=0, gain=0.55):
    tot = np.zeros((H, W), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        tot += amp * rfield(W, H, max(1, nu * 2 ** o), max(1, nv * 2 ** o), seed + 31 * o)
        norm += amp
        amp *= gain
    return tot / norm


def rband(W, H, rows, nu, nv, seed):
    """rfield restricted to a row slice (rows = (r0, r1)) of the full-height field, computed at slice size only."""
    r0, r1 = rows
    full_h = H
    f = rfield(W, full_h, nu, nv, seed)
    return f[r0:r1]


def hash2(a, b, seed=0):
    n = (np.asarray(a).astype(np.int64) * 374761393 + np.asarray(b).astype(np.int64) * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF).astype(np.float32) / 65535.0


def voronoi_slab(U, V, cell, seed, period_u, jitter=0.85):
    """Jittered-grid worley noise over the (len(V), len(U)) grid, periodic in U. Returns (F1 metres, F2-F1 metres, cell id 0..1)."""
    rng = np.random.default_rng(seed)
    ncu = max(3, int(round(period_u / cell)))
    cu = period_u / ncu
    v0 = V[0] - 2 * cell
    ncv = int(math.ceil((V[-1] - V[0]) / cell)) + 5
    pts = 0.5 + (rng.random((ncv, ncu, 2)).astype(np.float32) - 0.5) * jitter
    ids = rng.random((ncv, ncu)).astype(np.float32)
    su = U[None, :] / cu
    sv = (V[:, None] - v0) / cu
    iu = np.floor(su).astype(np.int64)
    iv = np.floor(sv).astype(np.int64)
    f1 = np.full((len(V), len(U)), 99.0, np.float32)
    f2 = np.full((len(V), len(U)), 99.0, np.float32)
    idx = np.zeros((len(V), len(U)), np.float32)
    for dv in (-1, 0, 1):
        for du in (-1, 0, 1):
            gu = (iu + du) % ncu
            gv = np.clip(iv + dv, 0, ncv - 1)
            pu = iu + du + pts[gv, gu, 0]
            pv = iv + dv + pts[gv, gu, 1]
            d = np.sqrt((su - pu) ** 2 + (sv - pv) ** 2)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            idx = np.where(closer, ids[gv, gu], idx)
            f1 = np.where(closer, d, f1)
    return f1 * cu, (f2 - f1) * cu, idx


# ------------------------------------------------------------------------------------------------ PIL brush work
class Canvas:
    """A float image (rows run UP: row 0 = z 0) plus helpers that draw soft strokes/dabs with PIL on an RGBA layer and composite
    them with premultiplied alpha. Everything wraps around in U and V so periodic atlases stay seamless."""

    def __init__(self, arr, pu, pv):
        self.img = arr
        self.H, self.W = arr.shape[:2]
        self.pu, self.pv = pu, pv
        self.layer = None

    def px(self, u, v):
        """metres -> pixel (x, y); v is metres UP and rows run up as well."""
        return u / self.pu * self.W, v / self.pv * self.H

    def begin(self):
        self.layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.layer, 'RGBA')

    def flush(self, blur=0.0, opacity=1.0):
        a = np.asarray(self.layer, np.float32) / 255.0
        self.layer = None
        al = a[..., 3]
        pre = a[..., :3] * al[..., None]
        if blur > 0:
            chans = [np.asarray(Image.fromarray(to_u8(pre[..., c]), 'L').filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255.0 for c in range(3)]
            pre = np.stack(chans, -1)
            al = np.asarray(Image.fromarray(to_u8(al), 'L').filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255.0
        self.img = self.img * (1.0 - al * opacity)[..., None] + pre * opacity

    # -- primitives (all wrap around)
    def _wraps(self, x, y, r):
        xs, ys = [0.0], [0.0]
        if x - r < 0:
            xs.append(self.W)
        if x + r >= self.W:
            xs.append(-self.W)
        if y - r < 0:
            ys.append(self.H)
        if y + r >= self.H:
            ys.append(-self.H)
        return [(dx, dy) for dx in xs for dy in ys]

    @staticmethod
    def _c(color, alpha):
        return (int(color[0] * 255), int(color[1] * 255), int(color[2] * 255), int(alpha))

    def dab(self, x, y, rx, ry, ang, color, alpha=255):
        c = self._c(color, alpha)
        ca, sa = math.cos(ang), math.sin(ang)
        pts0 = [(rx * math.cos(t) * (1.0 + 0.10 * math.sin(3 * t + rx)), ry * math.sin(t) * (1.0 + 0.10 * math.cos(2 * t + ry))) for t in np.linspace(0, TAU, 15)[:-1]]
        for dx, dy in self._wraps(x, y, max(rx, ry)):
            pts = [(x + dx + px * ca - py * sa, y + dy + px * sa + py * ca) for px, py in pts0]
            self.d.polygon(pts, fill=c)

    def line(self, pts, width, color, alpha=255):
        c = self._c(color, alpha)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        r = width + max(max(xs) - min(xs), max(ys) - min(ys))
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        for dx, dy in self._wraps(cx, cy, r):
            self.d.line([(p[0] + dx, p[1] + dy) for p in pts], fill=c, width=max(1, int(round(width))), joint='curve')

    def poly(self, pts, color, alpha=255):
        c = self._c(color, alpha)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        r = max(max(xs) - min(xs), max(ys) - min(ys))
        for dx, dy in self._wraps((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, r):
            self.d.polygon([(p[0] + dx, p[1] + dy) for p in pts], fill=c)

    def rect(self, x0, y0, x1, y1, color, alpha=255):
        c = self._c(color, alpha)
        for dx, dy in self._wraps((x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0)):
            self.d.rectangle([x0 + dx, y0 + dy, x1 + dx, y1 + dy], fill=c)

    def ellipse(self, x, y, rx, ry, color, alpha=255):
        c = self._c(color, alpha)
        for dx, dy in self._wraps(x, y, max(rx, ry)):
            self.d.ellipse([x + dx - rx, y + dy - ry, x + dx + rx, y + dy + ry], fill=c)


def blur_mask(mask, radius):
    """Gaussian blur of a (h, w) float mask via PIL (fast, 8-bit precision is plenty for soft shadows)."""
    im = Image.fromarray(to_u8(mask), 'L').filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(im, np.float32) / 255.0


def rect_mask(W, H, rects, wrap=True):
    """Union mask from pixel rects [(x0, y0, x1, y1)] drawn into an 8-bit image (wrapping horizontally)."""
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in rects:
        for dx in ((0, W, -W) if wrap else (0,)):
            for dy in ((0, H, -H) if wrap else (0,)):
                d.rectangle([x0 + dx, y0 + dy, x1 + dx, y1 + dy], fill=255)
    return np.asarray(im, np.float32) / 255.0


def radial_glow(shape, centres, radius_px, warm_falloff=2.0):
    """Sum of smooth radial pools. centres = [(x, y, r_px, strength)], wraps horizontally and vertically."""
    H, W = shape
    out = np.zeros(shape, np.float32)
    for x, y, r, s in centres:
        R = int(r * 2.2)
        yy = np.arange(int(y) - R, int(y) + R + 1)
        xx = np.arange(int(x) - R, int(x) + R + 1)
        gy, gx = np.meshgrid(yy, xx, indexing='ij')
        d = np.sqrt((gx - x) ** 2 + (gy - y) ** 2) / r
        g = s * np.exp(-(d ** warm_falloff) * 1.4) * (d < 2.2)
        out[np.ix_(yy % H, xx % W)] += g.astype(np.float32)
    return out


# ------------------------------------------------------------------------------------------------ painted masonry
def masonry(U, V, spec, seed, period_u):
    """Coursed masonry over the (len(V), len(U)) grid: running-bond blocks with per-block colour, bevelled edges and joints.

    spec keys: course (lo, hi) m, length (lo, hi) m, pal (palette array), mortar (hex), joint (m), tone (value spread),
               bevel (0..1), speckle (granulation amount), cloud (value cloud amount).
    Returns (rgb (h, w, 3), joint_mask (h, w)).
    """
    rng = np.random.default_rng(seed)
    hs, W = len(V), len(U)
    z_lo, z_hi = V[0], V[-1]
    cl, ch = spec['course']
    edges = [z_lo - rng.uniform(0, ch)]
    while edges[-1] < z_hi + ch:
        edges.append(edges[-1] + rng.uniform(cl, ch))
    edges = np.array(edges)
    ci = np.clip(np.searchsorted(edges, V, side='right') - 1, 0, len(edges) - 2)
    colors = spec['pal']
    jw = spec['joint']
    out = np.zeros((hs, W, 3), np.float32)
    jmask = np.zeros((hs, W), np.float32)
    mortar = _rgb(spec['mortar'])
    ll, lh = spec['length']
    for c in range(len(edges) - 1):
        rows = np.nonzero(ci == c)[0]
        if rows.size == 0:
            continue
        a, b = edges[c], edges[c + 1]
        n = max(3, int(round(period_u / (0.5 * (ll + lh)))))
        lens = rng.uniform(ll, lh, n)
        lens *= period_u / lens.sum()
        e = np.concatenate([[0.0], np.cumsum(lens)])
        off = rng.uniform(0, period_u)
        Us = (U - off) % period_u
        bi = np.clip(np.searchsorted(e, Us, side='right') - 1, 0, n - 1)
        bl = lens[bi]
        fx = (Us - e[bi]) / bl
        cidx = rng.integers(0, len(colors), n)
        tone = 1.0 + rng.normal(0.0, spec['tone'], n)
        base = colors[cidx][bi] * tone[bi][:, None]                       # (W, 3)
        # distance to the nearest vertical / horizontal joint (metres)
        dx = np.minimum(fx, 1 - fx) * bl                                  # (W,)
        fy = (V[rows] - a) / (b - a)
        dy = np.minimum(fy, 1 - fy) * (b - a)                             # (rows,)
        d = np.minimum(dx[None, :], dy[:, None])
        jm = 1.0 - sstep(jw * 0.55, jw * 1.45, d)
        # bevel: top edge catches the lamplight, bottom edge sits in shadow, left edge slightly lit
        top = np.exp(-((1 - fy) * (b - a))[:, None] / 0.013)
        bot = np.exp(-(fy * (b - a))[:, None] / 0.016)
        left = np.exp(-(fx * bl)[None, :] / 0.012)
        right = np.exp(-((1 - fx) * bl)[None, :] / 0.014)
        bev = spec['bevel']
        shade = 1.0 + bev * (0.34 * top + 0.12 * left - 0.36 * bot - 0.18 * right)
        # every stone carries its own little wash: warm at the top-left where the lamp-light lands, cooler and bluer low-right
        gx_ = (fx - 0.5)[None, :]
        gy_ = (fy - 0.5)[:, None]
        wash_ = (-0.55 * gx_ + 0.9 * gy_)
        gain = np.stack([1.0 + 0.14 * wash_, 1.0 + 0.03 * wash_, 1.0 - 0.16 * wash_], -1)
        blk = base[None, :, :] * shade[..., None] * gain
        out[rows] = blk * (1 - jm[..., None]) + mortar * jm[..., None] * (0.86 + 0.2 * rng.random())
        jmask[rows] = jm
    # per-pixel painterly surface: soft clouds + granulation + dry-brush streaks (all structured, none per-pixel random)
    cloud = rfbm(W, hs, int(period_u * 5), max(2, int((z_hi - z_lo) * 5)), 3, seed + 3)
    gran = rfield(W, hs, int(period_u * 38), max(2, int((z_hi - z_lo) * 38)), seed + 4)
    streak = rfield(W, hs, int(period_u * 70), max(2, int((z_hi - z_lo) * 6)), seed + 5)
    surf = 1.0 + spec['cloud'] * (cloud - 0.5) * 2 + spec['speckle'] * (gran - 0.5) * 2 + 0.05 * (streak - 0.5) * 2
    out *= surf[..., None]
    return out, jmask


def rubble(U, V, spec, seed, period_u):
    """Irregular stones (voronoi cells) with a dark mortar bed - sandstone / flint rubble."""
    f1, edge, cid = voronoi_slab(U, V, spec['cell'], seed, period_u, spec.get('jitter', 0.85))
    colors = spec['pal']
    k = np.minimum((cid * len(colors)).astype(int), len(colors) - 1)
    base = colors[k] * (0.86 + 0.28 * hash2(cid * 9769, cid * 3331, seed))[..., None]
    jw = spec['joint']
    jm = 1.0 - sstep(jw * 0.5, jw * 1.5, edge)
    # domed stones: lighter centre, darker rim; light from above
    dome = np.clip(1.0 - f1 / (spec['cell'] * 0.9), 0, 1)
    vgrad = (V - V[0]) / max(1e-3, V[-1] - V[0])
    base = base * (0.78 + 0.34 * dome[..., None]) * (1.0 + 0.10 * (vgrad[:, None, None] - 0.5))
    wsh = (vgrad[:, None] - 0.5) * 0.5 + (hash2(cid * 9973, cid * 7919, seed) - 0.5) * 0.8
    base = base * np.stack([1.0 + 0.12 * wsh, 1.0 + 0.02 * wsh, 1.0 - 0.14 * wsh], -1)
    out = mix(base, np.ones_like(base) * _rgb(spec['mortar']), jm * 0.92)
    hs, W = len(V), len(U)
    cloud = rfbm(W, hs, int(period_u * 6), max(2, int((V[-1] - V[0]) * 6)), 3, seed + 3)
    gran = rfield(W, hs, int(period_u * 40), max(2, int((V[-1] - V[0]) * 40)), seed + 4)
    surf = 1.0 + spec['cloud'] * (cloud - 0.5) * 2 + spec['speckle'] * (gran - 0.5) * 2
    out = out * surf[..., None]
    if 'rind' in spec:                                   # flint nodules: pale weathered rind round a dark glassy core
        rind = np.clip(1.0 - np.abs(f1 / (spec['cell'] * 0.5) - 0.85) * 5.0, 0, 1)
        out = mix(out, np.ones_like(out) * _rgb(spec['rind']), rind * (1 - jm) * 0.7)
    return out.astype(np.float32), jm.astype(np.float32)


# ================================================================================================ S3 WELL WALL
WELL_R = 4.0
WELL_H = 6.0

_BRICK_RED = dict(course=(0.084, 0.098), length=(0.25, 0.31), joint=0.015, bevel=0.6, tone=0.11, cloud=0.20, speckle=0.07, mortar='#D4C8AE',
                  pal=pal('#C4684F', '#B4553F', '#D4855D', '#9C4A3A', '#C8745A', '#A86050', '#D49666', '#8A4E48'))
_BRICK_STOCK = dict(course=(0.084, 0.098), length=(0.25, 0.31), joint=0.015, bevel=0.55, tone=0.10, cloud=0.24, speckle=0.07, mortar='#E4DCC8',
                    pal=pal('#D8C08A', '#CDB27A', '#E2CE98', '#B9A370', '#C6AC74', '#AE9A6C', '#98896A', '#E4D4A4'))
_CHALK = dict(course=(0.22, 0.32), length=(0.50, 0.85), joint=0.012, bevel=0.5, tone=0.045, cloud=0.14, speckle=0.05, mortar='#9E998A',
              pal=pal('#E9E1CD', '#DED4BC', '#F0E9D8', '#D5CAB2', '#E4DAC4', '#CFD0C8', '#DCD6C4'))
_SLATE = dict(course=(0.15, 0.22), length=(0.60, 1.10), joint=0.010, bevel=0.6, tone=0.07, cloud=0.16, speckle=0.06, mortar='#262B33',
              pal=pal('#62717F', '#4F5D6D', '#79879A', '#5A6678', '#6B7088', '#7C8294', '#46535F', '#6C7C86'))
_OCHRE = dict(cell=0.34, joint=0.022, mortar='#52391F', cloud=0.18, speckle=0.07,
              pal=pal('#C99C55', '#BA8946', '#D8B06C', '#A9753D', '#C98F4F', '#BFA070', '#9F7A47', '#D2B27E'))
_FLINT = dict(cell=0.20, joint=0.034, mortar='#E2D8C0', cloud=0.12, speckle=0.05, rind='#F2ECDD',
              pal=pal('#2F3640', '#424B55', '#262A31', '#566069', '#3B4450', '#8A8F8F', '#4D4A52'))


def _style_layer(name, U, V, seed, period_u):
    if name == 'brick':
        return masonry(U, V, _BRICK_RED, seed, period_u)
    if name == 'stock':
        return masonry(U, V, _BRICK_STOCK, seed, period_u)
    if name == 'chalk':
        return masonry(U, V, _CHALK, seed, period_u)
    if name == 'slate':
        return masonry(U, V, _SLATE, seed, period_u)
    if name == 'ochre':
        return rubble(U, V, _OCHRE, seed, period_u)
    if name == 'flint':
        return rubble(U, V, _FLINT, seed, period_u)
    raise KeyError(name)


# (z0, z1, style) from the floor of the segment up; the stone ledges sit at z = 0..0.14 and 3.0..3.14 and hide the zone seams
WELL_BANDS = (
    (0.0, 1.15, 'brick'), (1.15, 1.95, 'chalk'), (1.95, 3.05, 'ochre'),
    (3.05, 3.95, 'slate'), (3.95, 4.70, 'flint'), (4.70, 6.0, 'stock'),
)


def _win(canvas_W, canvas_H, x0, y0, x1, y1):
    cols = np.arange(int(x0), int(x1)) % canvas_W
    rows = np.clip(np.arange(int(y0), int(y1)), 0, canvas_H - 1)
    return rows, cols


def _plaster_patch(U, V, w, h, seed):
    """Lime-wash repair: cream plaster with trowel facets, hairline cracks, a stain bloom and a crumbling edge. Returns rgb, extra_alpha."""
    hs, ws = len(V), len(U)
    base = np.ones((hs, ws, 3), np.float32) * _rgb('#EBE2CD')
    cl = rfbm(ws, hs, 7, 5, 3, seed)
    base = base * (0.90 + 0.18 * cl)[..., None]
    base = mix(base, np.ones_like(base) * _rgb('#D5C6A4'), sstep(0.55, 0.85, rfbm(ws, hs, 5, 4, 3, seed + 3)) * 0.7)   # tea-coloured stain
    base = mix(base, np.ones_like(base) * _rgb('#B9C2B5'), sstep(0.68, 0.9, rfbm(ws, hs, 9, 6, 3, seed + 5)) * 0.45)    # cool damp bloom
    f1, edge, cid = voronoi_slab(U, V, 0.28, seed + 7, 1e4)
    base = base * (0.95 + 0.07 * cid)[..., None]
    base = base * (1.0 - 0.18 * (1.0 - sstep(0.0, 0.012, edge)))[..., None]                                   # trowel-facet seams
    return base


def _tile_patch(U, V, u0, z0, nrow, seed, kind):
    """Glazed Victorian wall tiles laid from (u0, z0): cream field, border courses, an alternating coloured course, glaze highlights."""
    hs, ws = len(V), len(U)
    ts = 0.15
    iu = np.floor((U - u0) / ts).astype(int)
    iv = np.floor((V - z0) / ts).astype(int)
    fu = ((U - u0) / ts - iu)
    fv = ((V - z0) / ts - iv)
    cols = {'green': ('#2F6B4C', '#3F8C63', '#E9E4CE'), 'blue': ('#274B8E', '#3C6FB4', '#ECE7D3'), 'mustard': ('#C9962E', '#E2B552', '#EAE3CB')}[kind]
    deep, mid, cream = (_rgb(c) for c in cols)
    ivv, iuu = np.meshgrid(iv, iu, indexing='ij')
    border = (ivv <= 0) | (ivv >= nrow - 1)
    inner = (ivv == 1) | (ivv == nrow - 2)
    checker = ((ivv + iuu) % 2 == 0)
    col = np.where(border[..., None], deep, np.where(inner[..., None], np.where(checker[..., None], mid, cream), cream))
    col = col * (0.92 + 0.14 * hash2(ivv, iuu, seed))[..., None]
    fvv, fuu = np.meshgrid(fv, fu, indexing='ij')
    glaze = 1.0 + 0.22 * np.exp(-((fvv - 0.82) ** 2 + (fuu - 0.22) ** 2) / 0.04) - 0.12 * np.exp(-((fvv - 0.12) ** 2 + (fuu - 0.85) ** 2) / 0.05)
    grout = ((fuu < 0.045) | (fuu > 0.955) | (fvv < 0.045) | (fvv > 0.955)).astype(np.float32)
    grout = blur_mask(grout, 0.8)
    out = col * glaze[..., None]
    out = mix(out, np.ones_like(out) * _rgb('#A9A28F'), grout * 0.9)
    out *= (0.95 + 0.08 * rfbm(ws, hs, 11, 5, 3, seed + 2))[..., None]
    return out


def _board_patch(U, V, seed, color):
    """Weathered vertical boards with grain, nail heads and two iron straps."""
    hs, ws = len(V), len(U)
    bw = 0.135
    iu = np.floor((U - U[0]) / bw).astype(int)
    fu = ((U - U[0]) / bw) - iu
    tone = 0.80 + 0.40 * hash2(iu, iu * 0 + 3, seed)
    base = np.ones((hs, ws, 3), np.float32) * _rgb(color) * tone[None, :, None]
    grain = rfield(ws, hs, int((U[-1] - U[0]) * 90) + 2, max(2, int((V[-1] - V[0]) * 4)), seed + 1)
    base *= (0.78 + 0.40 * grain)[..., None]
    base *= (0.92 + 0.16 * rfbm(ws, hs, 6, 4, 3, seed + 2))[..., None]
    gap = (fu < 0.05) | (fu > 0.95)
    base *= np.where(gap, 0.35, 1.0)[None, :, None]
    for fz in (0.20, 0.78):
        strap = np.abs((V - V[0]) / (V[-1] - V[0]) - fz) < 0.045
        base = np.where(strap[:, None, None], np.ones_like(base) * _rgb('#2C2A2E') * (0.8 + 0.4 * grain[..., None]), base)
        rust = sstep(0.55, 0.8, rfbm(ws, hs, 14, 3, 3, seed + 9))[..., None] * strap[:, None, None]
        base = mix(base, np.ones_like(base) * _rgb('#9A5A33'), rust[..., 0] * 0.6)
    return base


def _iron_patch(U, V, seed):
    hs, ws = len(V), len(U)
    base = np.ones((hs, ws, 3), np.float32) * _rgb('#46525E')
    base *= (0.85 + 0.30 * rfbm(ws, hs, 6, 4, 3, seed))[..., None]
    rust = sstep(0.50, 0.78, rfbm(ws, hs, 9, 5, 4, seed + 4))
    base = mix(base, np.ones_like(base) * _rgb('#A85F34'), rust * 0.75)
    base = mix(base, np.ones_like(base) * _rgb('#D69A4E'), sstep(0.72, 0.9, rfbm(ws, hs, 17, 6, 3, seed + 6)) * 0.5)
    return base


def _arch_mask(U, V, u0, z0, w, h):
    """Mask of an arched opening: rectangle with a semicircular head, plus signed edge distance (metres, + inside)."""
    cu = u0
    r = w / 2
    zc = z0 + h - r
    dx = np.abs(U[None, :] - cu)
    zz = V[:, None]
    inside_rect = (dx < r) & (zz >= z0) & (zz <= zc)
    d_circ = np.sqrt(dx ** 2 + (zz - zc) ** 2)
    inside_circ = (zz > zc) & (d_circ < r)
    inside = inside_rect | inside_circ
    d_edge = np.minimum(np.minimum(r - dx, zz - z0), np.where(zz > zc, r - d_circ, 9.0))
    return inside, d_edge


def well_wall(items, W=6144, H=1536, seed=1865, log=print):
    """The whole 360 x 6 m shaft wall as one periodic painting (rows run UP, row 0 = z 0). `items` bakes shelf shadows, niches and lantern
    pools: {'lamps': [(deg, z)], 'units': [(deg, z0, w, h)], 'niches': [(deg, z0, w, h)], 'frames': [(deg, z0, w, h)]}."""
    R, HM = WELL_R, WELL_H
    C = TAU * R
    U = (np.arange(W) + 0.5) / W * C
    Vz = (np.arange(H) + 0.5) / H * HM
    ppm_u, ppm_v = W / C, H / HM

    def X(deg):
        return (deg % 360.0) / 360.0 * W

    def Y(z):
        return z * ppm_v

    img = np.zeros((H, W, 3), np.float32)
    jmask = np.zeros((H, W), np.float32)

    # ---- 1. strata of masonry
    log('  wall: strata')
    for k, (z0, z1, style) in enumerate(WELL_BANDS):
        r0 = max(0, int((z0 - 0.32) * ppm_v))
        r1 = min(H, int((z1 + 0.32) * ppm_v))
        V = Vz[r0:r1]
        layer, jm = _style_layer(style, U, V, seed + 101 * k, C)
        if k == 0:
            m = np.ones((r1 - r0, W), np.float32)
        else:
            warp = (rfield(W, 1, 7 + k, 1, seed + 17 * k)[0] - 0.5) * 0.26                       # slow undulation of the stratum boundary
            jag = (rfield(W, r1 - r0, 150, 40, seed + 29 * k) - 0.5) * 0.05                       # ragged repair-line
            edge = (V[:, None] - (z0 + warp[None, :])) + jag
            m = sstep(-0.012, 0.012, edge)
        img[r0:r1] = img[r0:r1] * (1 - m[..., None]) + layer * m[..., None]
        jmask[r0:r1] = jmask[r0:r1] * (1 - m) + jm * m
        del layer
    # rows above the last band's slice (never happens) / safety fill
    # ---- 2. repairs: plaster, glazed tiles, boarding, iron plate (each with its own raised edge shadow)
    log('  wall: patches')
    rng = np.random.default_rng(seed + 5)
    patches = [('plaster', 12, 2.55), ('tiles_green', 62, 0.45), ('boards', 105, 1.3), ('plaster', 140, 4.05), ('iron', 178, 3.45),
               ('tiles_blue', 207, 2.2), ('plaster', 236, 0.95), ('boards', 262, 4.45), ('tiles_mustard', 296, 1.5), ('iron', 330, 5.2),
               ('plaster', 352, 3.5), ('tiles_green', 118, 5.05)]
    for kind, deg, zc in patches:
        pw = rng.uniform(1.25, 1.9)
        ph = rng.uniform(0.85, 1.25)
        if kind.startswith('tiles'):
            ph = 0.15 * round(ph / 0.15)
            pw = 0.15 * round(pw / 0.15)
        x0, x1 = X(deg) - pw * ppm_u / 2, X(deg) + pw * ppm_u / 2
        y0, y1 = Y(zc) - ph * ppm_v / 2, Y(zc) + ph * ppm_v / 2
        rows, cols = _win(W, H, x0 - 30, y0 - 30, x1 + 30, y1 + 30)
        Ul, Vl = U[cols], Vz[rows]
        # make U monotone across the wrap so slab functions can use differences
        Uc = np.where(Ul < Ul[0] - 1.0, Ul + C, Ul)
        s = seed + int(deg * 7)
        if kind == 'plaster':
            lay = _plaster_patch(Uc, Vl, pw, ph, s)
        elif kind.startswith('tiles'):
            lay = _tile_patch(Uc, Vl, X(deg) / ppm_u - pw / 2, zc - ph / 2, int(round(ph / 0.15)), s, kind.split('_')[1])
        elif kind == 'boards':
            lay = _board_patch(Uc, Vl, s, '#5A4A3A' if deg % 2 else '#4E5A4A')
        else:
            lay = _iron_patch(Uc, Vl, s)
        uc, zc_ = (X(deg) / ppm_u), zc
        # irregular rounded-rectangle footprint
        n1 = (rfield(len(cols), len(rows), max(3, int(pw * 6)), max(3, int(ph * 6)), s + 1) - 0.5) * 0.07
        dxm = np.abs(((Uc - uc + C / 2) % C) - C / 2)[None, :]
        dzm = np.abs(Vl - zc_)[:, None]
        sd = np.maximum(dxm - pw / 2, dzm - ph / 2) + n1
        if kind == 'plaster':
            sd = sd + (rfbm(len(cols), len(rows), 14, 6, 3, s + 2) - 0.5) * 0.10                    # crumbling margin
        a = 1.0 - sstep(-0.012, 0.012, sd)
        # raised-edge cast shadow (below/right) and a lit lip (top)
        sh = 1.0 - sstep(-0.01, 0.07, np.maximum(dxm - pw / 2 - 0.0, (zc_ - Vl[:, None]) - ph / 2) + n1)
        sh = sh * (Vl[:, None] < zc_ + ph * 0.1) * (1 - a)
        sub = img[np.ix_(rows, cols)]
        sub = sub * (1.0 - 0.42 * sh[..., None])
        lip = np.exp(-np.abs(sd + 0.004) / 0.006) * (Vl[:, None] > zc_)
        lay = lay * (1.0 + 0.25 * lip[..., None])
        sub = sub * (1 - a[..., None]) + lay * a[..., None]
        img[np.ix_(rows, cols)] = sub
        del lay, sub

    # ---- 3. weather: damp streaks, moss, bloom, rust, soot
    log('  wall: weather')
    zone = ((Vz - 0.14) % 2.86) / 2.86
    low = (1.0 - zone)[:, None]
    streak = rfield(W, H, 190, 5, seed + 61)
    s_damp = sstep(0.60, 0.80, streak) * (0.35 + 0.65 * rfbm(W, H, 18, 5, 3, seed + 62)) * (0.4 + 0.8 * low)
    img *= (1.0 - 0.42 * s_damp[..., None] * np.array([0.7, 0.62, 0.42], np.float32))                                  # cool, dark damp
    bloom = sstep(0.62, 0.86, rfbm(W, H, 30, 7, 4, seed + 63)) * (0.3 + 0.7 * low)
    img = mix(img, np.ones_like(img) * _rgb('#CFE0D8'), bloom * 0.34)                                                  # pale efflorescence
    mm = sstep(0.60, 0.80, rfbm(W, H, 34, 9, 4, seed + 64)) * (0.25 + 0.75 * low ** 1.5)
    mm = np.maximum(mm, 0.65 * jmask * sstep(0.45, 0.8, rfbm(W, H, 40, 10, 3, seed + 65)) * low)
    moss_col = pal('#5A7B3C', '#7D9D49', '#A5B95C', '#4C6A38')
    mi = rfbm(W, H, 120, 30, 2, seed + 66)
    mcol = moss_col[np.minimum((mi * 4).astype(int), 3)]
    img = img * (1 - 0.82 * mm[..., None]) + mcol * (0.82 * mm[..., None]) * (0.88 + 0.30 * rfield(W, H, 520, 130, seed + 67))[..., None]
    rust = sstep(0.70, 0.9, streak) * sstep(0.5, 0.8, rfbm(W, H, 20, 6, 3, seed + 68)) * (1 - low) * 0.6
    img = mix(img, np.ones_like(img) * _rgb('#A8613A'), rust * 0.5)
    del streak, bloom, mm

    # ---- 4. brush work: cracks, roots, cobwebs, tally marks, ivy sprigs
    log('  wall: brushwork')
    cv = Canvas(img, C, HM)
    rng = np.random.default_rng(seed + 77)
    cv.begin()
    for _ in range(210):                                  # hairline cracks (dark, jagged, a few lighter lips)
        x, y = rng.uniform(0, W), rng.uniform(0.2, 5.8) * ppm_v
        pts = [(x, y)]
        ang = rng.uniform(-0.4, 0.4) + (math.pi / 2 if rng.random() < 0.6 else 0.0)
        for _s in range(int(rng.integers(5, 14))):
            ang += rng.normal(0, 0.45)
            x += math.cos(ang) * rng.uniform(5, 16)
            y += math.sin(ang) * rng.uniform(5, 16)
            pts.append((x, y))
        cv.line(pts, 1.6, _rgb('#2E2420'), 150)
        cv.line([(px + 1.5, py + 1.5) for px, py in pts], 1.0, _rgb('#E4D8BC'), 70)
    cv.flush(blur=0.6)
    cv.begin()
    for _ in range(48):                                   # pale root tendrils, branching
        x, y = rng.uniform(0, W), rng.uniform(0.4, 5.9) * ppm_v
        ang = rng.uniform(math.pi * 0.2, math.pi * 0.8) * (1 if rng.random() < 0.7 else -1)
        wd = rng.uniform(2.0, 3.6)
        for _b in range(int(rng.integers(1, 4))):
            pts = [(x, y)]
            xx, yy, aa = x, y, ang + rng.normal(0, 0.5)
            for _s in range(int(rng.integers(10, 26))):
                aa += rng.normal(0, 0.28)
                xx += math.cos(aa) * 9
                yy += math.sin(aa) * 9
                pts.append((xx, yy))
            cv.line(pts, wd, _rgb('#8D6F4B'), 200)
            cv.line([(px + 1, py + 1) for px, py in pts], max(1.0, wd - 1.2), _rgb('#D8C79A'), 190)
            wd *= 0.62
    cv.flush(blur=0.7)
    cv.begin()
    for _ in range(26):                                   # ivy / pellitory sprigs on the cooler courses
        x, y = rng.uniform(0, W), rng.uniform(0.3, 5.6) * ppm_v
        ang = rng.uniform(0, TAU)
        for _s in range(int(rng.integers(5, 12))):
            ang += rng.normal(0, 0.5)
            x += math.cos(ang) * 14
            y += math.sin(ang) * 14
            col = moss_col[int(rng.integers(4))] * (0.85 + 0.3 * rng.random())
            cv.dab(x, y, rng.uniform(5, 9), rng.uniform(3, 5.5), ang + rng.normal(0, 0.8), col, 235)
    cv.flush(blur=0.5)
    img = cv.img
    img = _bake_well_light(img, items, W, H, C, ppm_u, ppm_v, Vz, U, seed, log)
    return img, dict(U=U, V=Vz, W=W, H=H, C=C, ppm_u=ppm_u, ppm_v=ppm_v)



def _bake_well_light(img, items, W, H, C, ppm_u, ppm_v, Vz, U, seed, log):
    """Shelf shadows, painted niches and lantern pools - the 'value structure' of the shaft, painted into the wall."""
    log('  wall: baked light')
    img = wander(img, seed, 0.12)
    R = WELL_R
    deg_px = W / 360.0

    def X(deg):
        return (deg % 360.0) * deg_px

    def Y(z):
        return z * ppm_v

    def dw(w):                                      # metres of wall -> degrees of azimuth
        return math.degrees(w / R)

    # ---- ambient occlusion behind and under every unit / frame
    rects, under, frames = [], [], []
    for deg, z0, w, h in items.get('units', []):
        cx, hw = X(deg), dw(w) / 2 * deg_px
        a0, a1 = cx - hw - 8, cx + hw + 8
        rects.append((a0, Y(z0 - 0.30), a1, Y(z0 + h + 0.10)))
        under.append((a0 - 12, Y(z0 - 0.62), a1 + 12, Y(z0 + 0.02)))
    for deg, z0, w, h in items.get('frames', []):
        cx, hw = X(deg), dw(w) / 2 * deg_px
        frames.append((cx - hw - 5, Y(z0 - 0.03), cx + hw + 5, Y(z0 + h + 0.03)))
    ao = 0.0
    if rects:
        ao = ao + 0.36 * blur_mask(rect_mask(W, H, rects), 26)
        ao = ao + 0.36 * blur_mask(rect_mask(W, H, under), 40)
    if frames:
        sh = [(a + 9, b - 11, c + 13, d - 11) for a, b, c, d in frames]
        ao = ao + 0.40 * blur_mask(rect_mask(W, H, sh), 11)
    ao = np.clip(ao, 0, 0.78)
    img = img * (1.0 - ao)[..., None] * np.array([1.0, 0.97, 1.06], np.float32)     # shadows lean violet, never black

    # ---- painted arched niches: dark recesses with a candle glow
    for deg, z0, w, h in items.get('niches', []):
        u0 = (deg % 360.0) / 360.0 * C
        for off in (-C, 0.0, C):
            cx0 = int((u0 + off - w) * ppm_u)
            cx1 = int((u0 + off + w) * ppm_u)
            if cx1 < 0 or cx0 > W:
                continue
            cols = np.arange(max(cx0, 0), min(cx1, W))
            rows = np.arange(max(0, int((z0 - 0.15) * ppm_v)), min(H, int((z0 + h + 0.2) * ppm_v)))
            Ul, Vl = U[cols], Vz[rows]
            inside, de = _arch_mask(Ul - off, Vl, u0, z0, w, h)
            tgrad = np.clip((Vl[:, None] - z0) / h, 0, 1)
            dark = np.ones((len(rows), len(cols), 3), np.float32) * _rgb('#1B131B')
            dark = mix(dark, np.ones_like(dark) * _rgb('#4A2C2E'), (1 - tgrad) ** 2.2 * 0.8)
            r2 = ((Ul[None, :] - off - u0) ** 2 + ((Vl[:, None] - (z0 + 0.10)) * 1.15) ** 2)
            cand = np.exp(-r2 / (2 * (0.20 * w / 0.5) ** 2))[..., None]
            lit = dark + cand * np.array([1.05, 0.62, 0.22], np.float32) * 0.95
            lit *= (0.90 + 0.2 * rfbm(len(cols), len(rows), 5, 5, 2, seed + 91))[..., None]
            edge_dark = np.clip(1.0 - de / 0.09, 0, 1)[..., None]
            lit = lit * (1 - 0.45 * edge_dark)
            ring_a = np.clip(1.0 - np.abs(de + 0.045) / 0.045, 0, 1) * (~inside)           # pale stone reveal round the opening
            a_in = sstep(-0.004, 0.004, de) * inside
            sub = img[np.ix_(rows, cols)]
            sub = sub * (1 - a_in[..., None]) + lit * a_in[..., None]
            img[np.ix_(rows, cols)] = sub

    # ---- lantern light pools (warm core, wide cool-to-warm fill)
    lamps = items.get('lamps', [])
    G = np.zeros((H, W), np.float32)
    if lamps:
        G += radial_glow((H, W), [(X(d), Y(z), 0.80 * ppm_u, 1.0) for d, z in lamps], 0.8)
        G += radial_glow((H, W), [(X(d), Y(z), 2.0 * ppm_u, 0.46) for d, z in lamps], 0.8)
    # soot plume above each lantern: a dark, slightly warm smudge that gives every light a shadow to be bright against
    if lamps:
        soot = np.zeros((H, W), np.float32)
        soot += radial_glow((H, W), [(X(d), Y(z + 0.42), 0.34 * ppm_u, 1.0) for d, z in lamps], 1.6)
        img = img * (1.0 - 0.45 * np.clip(soot, 0, 1))[..., None] * np.array([1.0, 0.95, 0.9], np.float32)
    gg = np.clip(G, 0, 1)[..., None]
    cool = np.array([1.14, 1.08, 1.18], np.float32)
    warm = np.array([1.75, 1.40, 0.98], np.float32)
    img = img * (cool * (1 - gg) + warm * gg)
    img += (np.clip(G - 0.55, 0, 1.2) ** 1.5)[..., None] * np.array([0.20, 0.10, 0.02], np.float32)
    return img


def wander(img, seed, amt=0.10):
    """Layered colour wash: three independent slow fields drift the red, green and blue gain, so every stretch of wall has its own
    temperature (a glaze of rose here, sage there, a lilac cool patch) instead of one flat tint per material."""
    H, W = img.shape[:2]
    out = img.copy()
    for c, (nu, nv) in enumerate(((11, 3), (15, 4), (9, 3))):
        f = rfbm(W, H, nu, nv, 3, seed + 400 + 17 * c)
        out[..., c] *= 1.0 + amt * (f - 0.5) * 2.0
    return out


def finish(img, blur=0.8):
    """Last pass: a hair of softening (wet-edge feel) and dry-brush modulation; returns a z-up float image."""
    H, W = img.shape[:2]
    brush = rfield(W, H, 260, 18, 7)
    img = img * (0.95 + 0.10 * brush)[..., None]
    im = Image.fromarray(to_u8(img), 'RGB').filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, np.float32) / 255.0


def atlas_slices(img, n=4, pad=16):
    """Cut a periodic z-up image into n vertical slices with `pad` px of true neighbour content each side, flipped for to_image."""
    H, W = img.shape[:2]
    sw = W // n
    out = []
    for i in range(n):
        cols = np.arange(i * sw - pad, (i + 1) * sw + pad) % W
        out.append(np.ascontiguousarray(img[:, cols][::-1]))
    return out


# ================================================================================================ modelling helpers (atlas-mapped)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import solids as sol  # noqa: E402


def _faces_table(lo, hi):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    P = lambda x, y, z: Vector((x, y, z))
    return {
        'nx': ((P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)), 1, 2),
        'px': ((P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)), 1, 2),
        'ny': ((P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)), 0, 2),
        'py': ((P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)), 0, 2),
        'nz': ((P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)), 0, 1),
        'pz': ((P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)), 0, 1),
    }


def _clamp_uv(u, v, rect, eps=0.0015):
    return (min(max(u, rect[0] + eps), rect[2] - eps), min(max(v, rect[1] + eps), rect[3] - eps))


def abox(bm, lo, hi, rect, scale=1.8, skip=(), grain_long=True, face_rect=None, face_rot=(), uv_name='UVMap'):
    """Axis-aligned box whose faces sample the atlas cell `rect` = (u0, v0, u1, v1): one isotropic scale (`scale` metres per cell), anchored
    at each face's own corner, grain running along the face's long side. `face_rect` maps a face name to its own (u0, v0, u1, v1) window
    (stretched over the whole face) - used for book spines."""
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    for name, (pts, ua, va) in _faces_table(lo, hi).items():
        if name in skip:
            continue
        try:
            f = bm.faces.new([bm.verts.new(p) for p in pts])
        except ValueError:
            continue
        amin = min(p[ua] for p in pts)
        bmin = min(p[va] for p in pts)
        da = max(p[ua] for p in pts) - amin
        db = max(p[va] for p in pts) - bmin
        if face_rect and name in face_rect:
            fr = face_rect[name]
            for loop, p in zip(f.loops, pts):
                a = (p[ua] - amin) / max(da, 1e-6)
                b = (p[va] - bmin) / max(db, 1e-6)
                if name in face_rot:
                    a, b = b, a
                loop[uvl].uv = (fr[0] + a * (fr[2] - fr[0]), fr[1] + b * (fr[3] - fr[1]))
            continue
        swap = grain_long and db > da
        for loop, p in zip(f.loops, pts):
            a, b = p[ua] - amin, p[va] - bmin
            if swap:
                a, b = b, a
            u = rect[0] + (a / scale) * (rect[2] - rect[0])
            v = rect[1] + (b / scale) * (rect[3] - rect[1])
            loop[uvl].uv = _clamp_uv(u, v, rect)
    return bm


def remap_uv(bm, rect, uv_name='UVMap'):
    """Scale every UV of `bm` (assumed in 0..1) into the atlas cell `rect`."""
    uvl = bm.loops.layers.uv.get(uv_name)
    if uvl is None:
        return bm
    for f in bm.faces:
        for loop in f.loops:
            u, v = loop[uvl].uv
            loop[uvl].uv = _clamp_uv(rect[0] + u * (rect[2] - rect[0]), rect[1] + v * (rect[3] - rect[1]), rect)
    return bm


def place(dst, tmp, matrix=None, rect=None):
    """Copy `tmp` into `dst` (optionally remapping its UVs into an atlas cell and transforming), then free it."""
    if rect is not None:
        remap_uv(tmp, rect)
    sol.append_bm(dst, tmp, matrix)
    tmp.free()
    return dst


def alathe(dst, profile, rect, matrix=None, seg=18, cap_bottom=True, cap_top=True, scale=(1.0, 1.0), height_v=True):
    """Lathe about +Z whose UV is u around (front = -X at u 0.5) and v = true height along the profile, mapped into atlas cell `rect`."""
    tmp = bmesh.new()
    sol.lathe(tmp, profile, (0, 0, 0), seg=seg, cap_bottom=cap_bottom, cap_top=cap_top, scale=scale)
    uvl = tmp.loops.layers.uv.active
    z_lo = min(h for _r, h in profile)
    z_hi = max(h for _r, h in profile)
    span = max(z_hi - z_lo, 1e-6)
    for f in tmp.faces:
        capped = abs(f.normal.z) > 0.9
        for loop in f.loops:
            u, _v = loop[uvl].uv
            if capped:
                loop[uvl].uv = (0.5, 0.5)
            elif height_v:
                loop[uvl].uv = (u, (loop.vert.co.z - z_lo) / span)
    place(dst, tmp, matrix, rect)


def uv_const(bm, uv, uv_name='UVMap'):
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    for f in bm.faces:
        for loop in f.loops:
            loop[uvl].uv = uv


class UnitFrame:
    """Local frame of a wall-hung unit: the wall surface is x = 0 and the unit stands out towards -x (the shaft axis); `a` runs along the
    wall, `d` is depth out of the wall and `z` is height above the unit's base. The front face of a box is therefore its 'nx' face."""

    def p(self, a, d, z):
        return Vector((-d, a, z))

    def box(self, bm, a0, a1, d0, d1, z0, z1, rect, scale=1.8, skip=(), face_rect=None, grain_long=True, face_rot=()):
        lo = (-max(d0, d1), min(a0, a1), min(z0, z1))
        hi = (-min(d0, d1), max(a0, a1), max(z0, z1))
        abox(bm, lo, hi, rect, scale=scale, skip=skip, face_rect=face_rect, grain_long=grain_long, face_rot=face_rot)

    def quad(self, bm, a0, a1, z0, z1, d, rect):
        """Front-facing (toward -x) rectangle with the cell `rect` stretched across it."""
        uvl = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
        pts = (self.p(a1, d, z0), self.p(a0, d, z0), self.p(a0, d, z1), self.p(a1, d, z1))
        f = bm.faces.new([bm.verts.new(p) for p in pts])
        uvs = ((rect[0], rect[1]), (rect[2], rect[1]), (rect[2], rect[3]), (rect[0], rect[3]))
        for loop, uv in zip(f.loops, uvs):
            loop[uvl].uv = _clamp_uv(uv[0], uv[1], rect, 0.002)


def mat_unit(R, deg, z0):
    """Place a unit built in `UnitFrame` coordinates at game azimuth `deg`, base height z0, on a shaft of radius R."""
    return Matrix.Rotation(math.radians(-deg), 4, 'Z') @ Matrix.Translation((R, 0.0, z0))


def qface(bm, pts, want, uvs=None, uv_name='UVMap', uv_list=None):
    """One face from 3-D points, flipped if needed so that its normal points along `want`. UVs come from `uvs(co)` (a function of the vertex
    position) or `uv_list` (one (u, v) per input point)."""
    uvl = bm.loops.layers.uv.get(uv_name) or bm.loops.layers.uv.new(uv_name)
    verts = [bm.verts.new(p) for p in pts]
    try:
        fc = bm.faces.new(verts)
    except ValueError:
        return None
    fc.normal_update()
    if fc.normal.dot(Vector(want)) < 0:
        fc.normal_flip()
    if uv_list is not None:
        uvmap = {v: uv for v, uv in zip(verts, uv_list)}
        for loop in fc.loops:
            loop[uvl].uv = uvmap[loop.vert]
    elif uvs:
        for loop in fc.loops:
            loop[uvl].uv = uvs(loop.vert.co)
    return fc
