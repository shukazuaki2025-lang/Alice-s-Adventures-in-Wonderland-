"""
Alice's hair: a scalp cap + ~60 tapered, wavy clumps (long loose back hair, locks in front of the shoulders, a parted
fringe), plus the Alice-band and flat bow. Everything is built from tubes with deterministic waves.
"""
import math

import bmesh
from mathutils import Vector

from lib.meshkit import Rng, V, bm_translate, clamp, lerp, smoothstep, tube
from . import spec
from .head import HC, HR, head_point

HAIR_T = 0.0065  # scalp cap thickness


# ---------------------------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------------------------
def _ell(z, keys):
    """Piecewise-linear lookup in [(z, value), ...] sorted by descending z."""
    if z >= keys[0][0]:
        return keys[0][1]
    for (z0, v0), (z1, v1) in zip(keys, keys[1:]):
        if z1 <= z <= z0:
            return lerp(v0, v1, (z0 - z) / (z0 - z1))
    return keys[-1][1]


BACK_Y = [(1.10, 0.102), (1.04, 0.121), (0.98, 0.126), (0.92, 0.113), (0.86, 0.100), (0.80, 0.090), (0.72, 0.082), (0.62, 0.080)]
SIDE_X = [(1.10, 0.098), (1.04, 0.112), (0.98, 0.119), (0.92, 0.119), (0.86, 0.113), (0.80, 0.106), (0.72, 0.100), (0.62, 0.096)]


def back_point(theta, z, extra_r=0.0):
    """Point on the hair envelope behind/around the head & shoulders. theta: 0 = centre back, +90° = left."""
    a = _ell(z, SIDE_X) + extra_r
    b = _ell(z, BACK_Y) + extra_r
    yc = 0.03
    return V(a * math.sin(theta), yc + (b - yc) * math.cos(theta), z)


def clump_tube(bm, pts, w0, thick, up_hint, n=8, root_taper=0.55, tip_taper=0.12, u_window=(0.0, 1.0)):
    def wfun(t):
        grow = smoothstep(0.0, 0.18, t)
        taper = lerp(1.0, tip_taper, smoothstep(0.35, 1.0, t) ** 1.4)
        return w0 * lerp(root_taper, 1.0, grow) * taper * 0.5

    def tfun(t):
        return max(0.0012, thick * 0.5 * (0.6 + 0.4 * smoothstep(0.0, 0.2, t)) * lerp(1.0, 0.35, smoothstep(0.5, 1.0, t)))

    tube(pts, rx=wfun, ry=tfun, n=n, up_hint=up_hint, cap_start=False, cap_end=True, bm=bm, uv_u=u_window, uv_v=(0.0, 1.0))


# ---------------------------------------------------------------------------------------------------------------
# scalp cap
# ---------------------------------------------------------------------------------------------------------------
def build_scalp(K=30, N=132):
    """
    Smooth hair cap grown from the crown outwards. Each azimuth ray stops exactly on the hairline curve (see
    head.hairline_boundary) and thins to ~3 mm there, so the edge is continuous (no stair-stepped faces).
    """
    from .head import hairline_boundary

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    for k in range(1, K + 1):
        r = k / K
        ring = []
        for i in range(N):
            phi = -2.0 * math.pi * i / N                # decreasing angle -> outward-facing normals
            a = abs(((phi + math.pi) % (2 * math.pi)) - math.pi)   # 0..pi azimuth from the front
            uz_b = clamp(hairline_boundary(a), -0.95, 0.98)
            c_max = math.acos(uz_b)
            c = r * c_max
            u = V(math.sin(c) * math.sin(phi), -math.sin(c) * math.cos(phi), math.cos(c))
            p = head_point(u)
            n = V(u.x / HR.x, u.y / HR.y, u.z / HR.z).normalized()
            thick = lerp(0.0030, HAIR_T, smoothstep(1.0, 0.80, r))
            ring.append(p + n * thick)
        rings.append(ring)
    from lib.meshkit import loft
    loft(rings, close_u=True, cap_start=True, cap_end=False, bm=bm)
    for f in bm.faces:
        f.smooth = True
        for l in f.loops:
            c = l.vert.co
            l[uvl].uv = (0.5 + (c.x - HC.x) / 0.30, 0.5 - (c.y - HC.y) / 0.30)
    return bm


# ---------------------------------------------------------------------------------------------------------------
# clumps
# ---------------------------------------------------------------------------------------------------------------
def build_back_hair(bm, rng):
    """Long, loose, wavy hair behind the shoulders. Returns clump descriptors for skin weighting."""
    descr = []
    n_clumps = 27
    for i in range(n_clumps):
        theta0 = math.radians(lerp(-104, 104, i / (n_clumps - 1)) + rng.range(-2.5, 2.5))
        z0 = 1.075 - 0.055 * abs(math.sin(theta0)) + rng.range(-0.008, 0.008)
        centre_bias = 1.0 - abs(math.sin(theta0)) * 0.30
        length = (rng.range(0.34, 0.47)) * centre_bias + 0.02
        phase = theta0 * 1.5 + rng.range(-0.5, 0.5)
        amp = rng.range(0.085, 0.14)
        freq = 1.25 + rng.range(-0.15, 0.2)
        steps = 24
        pts = []
        for k in range(steps + 1):
            t = k / steps
            z = z0 - length * t
            th = theta0 + (amp * math.sin(2 * math.pi * freq * t + phase) + 0.35 * amp * math.sin(2 * math.pi * 2.3 * freq * t + phase * 1.7)) * (0.2 + 0.8 * t)
            r_out = 0.004 + 0.008 * math.sin(2 * math.pi * freq * t + phase + 1.1) * t + 0.020 * smoothstep(0.72, 1.0, t)
            pts.append(back_point(th, z, r_out))
        up = V(math.sin(theta0), math.cos(theta0), 0.0)
        u0 = rng.range(0.0, 0.76)
        clump_tube(bm, pts, w0=rng.range(0.028, 0.040), thick=0.014, up_hint=up, n=8, tip_taper=0.06, u_window=(u0, u0 + 0.22))
        descr.append({'pts': pts, 'kind': 'back', 'theta': theta0})
    return descr


def build_side_locks(bm, rng, max_frac=1.0):
    descr = []
    for s in (1.0, -1.0):
        for j, (xo, yo, ln, w0) in enumerate(((0.0, 0.0, 0.36, 0.038), (0.016, -0.006, 0.28, 0.028))):
            xs = (0.100 + xo) * s
            base = [
                V(xs * 0.99, 0.000 + yo, 1.000),
                V(xs * 0.97 + 0.004 * s, -0.034 + yo, 0.935),
                V(xs * 0.92, -0.066 + yo, 0.866),
                V(xs * 0.86, -0.083 + yo, 0.790),
                V(xs * 0.82, -0.086 + yo, 0.712),
            ]
            steps = 24
            pts = []
            for k in range(steps + 1):
                t = k / steps
                seg = t * (len(base) - 1)
                i0 = min(len(base) - 2, int(seg))
                f = seg - i0
                p = base[i0].lerp(base[i0 + 1], f)
                wave = 0.010 * math.sin(2 * math.pi * 1.35 * t + s * 1.7 + j * 1.3) * (0.3 + 0.7 * t)
                curl = smoothstep(0.72, 1.0, t)
                p = p + V(wave * s + 0.020 * s * curl, -0.012 * curl, 0.0)
                pts.append(p)
            cut = int(len(pts) * (ln / 0.36))
            pts = pts[:max(8, int(cut * max_frac))]
            up = V(0.4 * s, -1.0, 0.0)
            u0 = rng.range(0.0, 0.76)
            clump_tube(bm, pts, w0=w0, thick=0.015, up_hint=up, n=8, tip_taper=0.08, u_window=(u0, u0 + 0.22))
            descr.append({'pts': pts, 'kind': 'side', 'side': s})
    return descr


def build_fringe(bm, rng):
    """Centre-parted fringe swept across the forehead towards the temples."""
    descr = []
    for s in (1.0, -1.0):
        count = 6
        for k in range(count):
            f = k / (count - 1)
            ux0 = 0.04 + 0.13 * f
            uz0 = 0.80 - 0.10 * f
            psi_end = math.radians(52 + 24 * f)
            el_end = math.radians(26 + 22 * (1 - f))
            pts = []
            steps = 12
            for q in range(steps + 1):
                t = q / steps
                # interpolate on the unit sphere between start (near the parting) and end (temple)
                psi0 = math.asin(clamp(ux0 / math.sqrt(max(1e-4, 1 - uz0 * uz0)), -1, 1))
                el0 = math.asin(uz0)
                psi = lerp(psi0, psi_end, smoothstep(0, 1, t))
                el = lerp(el0, el_end, t ** 0.9)
                u = V(math.sin(psi) * math.cos(el) * s, -math.cos(psi) * math.cos(el), math.sin(el))
                p = head_point(u)
                n = V(u.x / HR.x, u.y / HR.y, u.z / HR.z).normalized()
                lift = HAIR_T + 0.004 + 0.003 * math.sin(math.pi * t)
                pts.append(p + n * lift)
            # extend the tip downwards a little past the temple
            tip = pts[-1] + V(0.006 * s, -0.004, -0.030)
            pts.append(tip)
            n_out = V(s * 0.5, -1.0, 0.3)
            clump_tube(bm, pts, w0=0.026 - 0.004 * f, thick=0.010, up_hint=n_out, n=7, root_taper=0.9, tip_taper=0.08)
            descr.append({'pts': pts, 'kind': 'fringe', 'side': s})
    return descr


# ---------------------------------------------------------------------------------------------------------------
# headband + bow
# ---------------------------------------------------------------------------------------------------------------
def band_points(n=26, beta_deg=20.0, lift=0.0, a0=-93.0, a1=93.0):
    beta = math.radians(beta_deg)
    pts = []
    for i in range(n):
        a = math.radians(lerp(a0, a1, i / (n - 1)))
        u = V(math.sin(a), -math.cos(a) * math.sin(beta), math.cos(a) * math.cos(beta)).normalized()
        p = head_point(u)
        nrm = V(u.x / HR.x, u.y / HR.y, u.z / HR.z).normalized()
        pts.append((p + nrm * (HAIR_T + 0.0045 + lift), nrm))
    return pts


def build_headband(bm):
    pp = band_points()
    pts = [p for p, _n in pp]
    up = sum((n for _p, n in pp), V(0, 0, 0)).normalized()
    tube(pts, rx=0.0062, ry=0.0030, n=8, up_hint=(0, 0.2, 1), cap_start=True, cap_end=True, bm=bm, uv_v=(0, 1))
    return pts


def build_bow(bm, anchor, rng):
    """Flat satin bow: two folded loops, a knot and two short tails, sitting at the left of the Alice-band."""
    c = anchor
    out = V(0.45, -0.25, 0.85).normalized()      # outward from the crown
    side = V(0.8, 0.35, -0.25).normalized()      # along the band
    up = out.cross(side).normalized()
    centre = c + out * 0.006

    for sgn in (1.0, -1.0):
        pts = []
        steps = 12
        for k in range(steps + 1):
            t = k / steps
            lift = 0.010 * math.sin(math.pi * t) ** 0.8
            pts.append(centre + side * (sgn * (0.006 + 0.052 * t)) + out * lift + up * (0.004 * t * sgn * 0.0))
        tube(pts, rx=lambda t: 0.0145 * (0.35 + 0.65 * math.sin(math.pi * min(1, 0.12 + 0.88 * t)) ** 0.8),
             ry=lambda t: 0.0032 + 0.0012 * math.sin(math.pi * t), n=8, up_hint=up, cap_start=False, cap_end=True, bm=bm)
    # knot
    knot = []
    for k in range(7):
        t = k / 6
        knot.append(centre + side * (-0.0075 + 0.015 * t) + out * 0.003)
    tube(knot, rx=0.0075, ry=0.0065, n=8, up_hint=up, cap_start=True, cap_end=True, bm=bm)
    # tails
    for sgn, ang in ((1.0, 0.5), (-1.0, -0.4)):
        pts = []
        for k in range(8):
            t = k / 7
            d = (side * (0.25 * sgn) + (-up) * 0.9 + out * (-0.2)).normalized()
            pts.append(centre + d * (0.004 + 0.038 * t) + side * (sgn * 0.004 * t) + out * 0.003)
        tube(pts, rx=lambda t: 0.0075 * (0.9 - 0.25 * t), ry=0.0025, n=6, up_hint=out, cap_start=False, cap_end=True, bm=bm)
