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
    """Smooth periodic noise in [0,1], `nu` lattice cells across the width and `nv` down the height (bicubic upsample)."""
    rng = np.random.default_rng(seed)
    g = rng.random((nv, nu)).astype(np.float32)
    t = np.tile(g, (3, 3))
    im = Image.fromarray(t, 'F').resize((3 * W, 3 * H), Image.BICUBIC)
    a = np.asarray(im, np.float32)[H:2 * H, W:2 * W]
    return np.clip(a, 0.0, 1.0)


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
    """A float image plus helpers that draw soft strokes/dabs with PIL on an RGBA layer and composite them (wraps around in U and V)."""

    def __init__(self, arr, pu, pv):
        self.img = arr
        self.H, self.W = arr.shape[:2]
        self.pu, self.pv = pu, pv
        self.layer = None

    def px(self, u, v):
        """metres -> pixel (x, y); v is metres UP, row 0 is the top (z = pv)."""
        return u / self.pu * self.W, (1.0 - v / self.pv) * self.H

    def begin(self):
        self.layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.layer, 'RGBA')

    def flush(self, blur=0.0, opacity=1.0):
        lay = self.layer
        if blur > 0:
            lay = lay.filter(ImageFilter.GaussianBlur(blur))
        a = np.asarray(lay, np.float32) / 255.0
        al = a[..., 3:4] * opacity
        # un-premultiply is unnecessary: PIL draws straight alpha into an empty layer, blurred RGB bleeds towards black at edges
        if blur > 0:
            rgb = a[..., :3] / np.maximum(a[..., 3:4], 1e-3)
        else:
            rgb = a[..., :3]
        self.img = self.img * (1.0 - al) + np.clip(rgb, 0, 1) * al
        self.layer = None

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

    def dab(self, x, y, rx, ry, ang, color, alpha=255):
        c = (int(color[0] * 255), int(color[1] * 255), int(color[2] * 255), int(alpha))
        ca, sa = math.cos(ang), math.sin(ang)
        pts0 = [(rx * math.cos(t) , ry * math.sin(t)) for t in np.linspace(0, TAU, 9)[:-1]]
        for dx, dy in self._wraps(x, y, max(rx, ry)):
            pts = [(x + dx + px * ca - py * sa, y + dy + px * sa + py * ca) for px, py in pts0]
            self.d.polygon(pts, fill=c)

    def line(self, pts, width, color, alpha=255):
        c = (int(color[0] * 255), int(color[1] * 255), int(color[2] * 255), int(alpha))
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        r = width + max(max(xs) - min(xs), max(ys) - min(ys))
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        for dx, dy in self._wraps(cx, cy, r):
            self.d.line([(p[0] + dx, p[1] + dy) for p in pts], fill=c, width=max(1, int(round(width))), joint='curve')

    def rect(self, x0, y0, x1, y1, color, alpha=255):
        c = (int(color[0] * 255), int(color[1] * 255), int(color[2] * 255), int(alpha))
        for dx, dy in self._wraps((x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0)):
            self.d.rectangle([x0 + dx, y0 + dy, x1 + dx, y1 + dy], fill=c)


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
            d.rectangle([x0 + dx, y0, x1 + dx, y1], fill=255)
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
        blk = base[None, :, :] * shade[..., None]
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
    base = colors[k] * (0.86 + 0.28 * hash2(cid * 977, cid * 331, seed))[..., None]
    jw = spec['joint']
    jm = 1.0 - sstep(jw * 0.5, jw * 1.5, edge)
    # domed stones: lighter centre, darker rim; light from above
    dome = np.clip(1.0 - f1 / (spec['cell'] * 0.9), 0, 1)
    vgrad = (V - V[0]) / max(1e-3, V[-1] - V[0])
    base = base * (0.78 + 0.34 * dome[..., None]) * (1.0 + 0.10 * (vgrad[:, None, None] - 0.5))
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
