"""Wheat-yellow dress, puff sleeves, Peter-Pan collar, frilled linen apron with pockets and a back bow."""
import math

import bmesh
from mathutils import Vector

from lib.meshkit import Rng, V, clamp, lerp, loft, sheet, smoothstep, tube
from . import spec

NECK_Z = 0.862
HEM_Z = spec.HEM_Z
FOLDS = 14

# (z, a (x half-axis), b (y half-axis)) — dress outline, top (neckline) to hem
DRESS_KEYS = [
    (0.862, 0.047, 0.043),
    (0.853, 0.074, 0.050),
    (0.838, 0.108, 0.056),
    (0.806, 0.096, 0.058),
    (0.760, 0.087, 0.056),
    (0.712, 0.080, 0.052),
    (0.686, 0.088, 0.058),
    (0.640, 0.124, 0.108),
    (0.560, 0.178, 0.168),
    (0.455, 0.232, 0.224),
    (0.362, 0.274, 0.268),
    (0.318, 0.289, 0.283),
]
CY = 0.03  # y of the dress axis (the skirt is centred slightly behind the body axis)


def _key(z):
    if z >= DRESS_KEYS[0][0]:
        return DRESS_KEYS[0][1], DRESS_KEYS[0][2]
    for (z0, a0, b0), (z1, a1, b1) in zip(DRESS_KEYS, DRESS_KEYS[1:]):
        if z1 <= z <= z0:
            t = smoothstep(0, 1, (z0 - z) / (z0 - z1))
            return lerp(a0, a1, t), lerp(b0, b1, t)
    return DRESS_KEYS[-1][1], DRESS_KEYS[-1][2]


def fold_amp(z):
    return 0.052 * smoothstep(0.69, 0.33, z)


def dress_point(theta, z, off=0.0, fold_k=1.0):
    """theta: 0 = front centre, +90° = left (+X). Returns a point on (or `off` outside) the dress surface."""
    a, b = _key(z)
    f = 1.0 + fold_k * fold_amp(z) * math.sin(FOLDS * theta + 0.35 * (0.86 - z))
    # soft hem lift between folds
    zz = z
    if z < 0.34:
        zz = z + 0.010 * math.sin(FOLDS * theta + math.pi) * smoothstep(0.34, 0.312, z)
    a2 = (a + off) * f
    b2 = (b + off) * f
    return V(a2 * math.sin(theta), CY - b2 * math.cos(theta), zz)


def build_dress(bm, seg=72):
    zs = []
    # denser rings where the outline curves
    for lo, hi, n in ((0.862, 0.838, 3), (0.838, 0.712, 8), (0.712, 0.64, 5), (0.64, 0.318, 17)):
        for i in range(n):
            zs.append(lerp(lo, hi, i / n))
    zs.append(0.318)
    rings = []
    for z in zs:
        ring = []
        for i in range(seg):
            # CCW seen from +Z (path runs downwards => tangent = -Z), so walk the angle the other way
            th = 2 * math.pi * (seg - 1 - i) / seg
            ring.append(dress_point(th, z))
        rings.append(ring)
    loft(rings, close_u=True, bm=bm)


def build_sleeve(bm, side):
    a = spec.arm_points(side)
    sh, el = a[0], a[1]
    p0 = sh + V(-0.012 * side, 0.0, 0.018)
    p1 = sh.lerp(el, 0.60)
    pts = []
    steps = 9
    for k in range(steps + 1):
        t = k / steps
        pts.append(p0.lerp(p1, t))
    def prof(t):
        puff = 0.0415 + 0.026 * math.sin(math.pi * min(1.0, t * 1.15)) ** 1.2
        cuff = 1.0 - 0.18 * smoothstep(0.78, 1.0, t)
        return puff * cuff
    tube(pts, rx=prof, ry=lambda t: prof(t) * 0.97, n=20, up_hint=(0, -1, 0), cap_start=True, cap_end=False, bm=bm,
         shape=lambda th, t: 1.0 + 0.045 * smoothstep(0.55, 0.85, t) * math.sin(10 * th))
    # elastic cuff band + small frill
    cuff_pts = [p1 + (p1 - p0).normalized() * (-0.004 + 0.016 * k / 3) for k in range(4)]
    tube(cuff_pts, rx=0.0345, ry=0.0335, n=18, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm,
         shape=lambda th, t: 1.0 + 0.05 * math.sin(14 * th) * smoothstep(0.6, 1.0, t))


def build_collar(bm):
    """Flat Peter-Pan collar with two round front lobes, open at the back."""
    rows, cols = 7, 49
    grid = []
    for r in range(rows):
        s = r / (rows - 1)
        row = []
        for c in range(cols):
            th = lerp(-math.radians(158), math.radians(158), c / (cols - 1))
            front = max(0.0, math.cos(th))
            L = 0.034 + 0.032 * front ** 1.5     # lobe length
            a = 0.047 + s * L
            b = 0.043 + s * (L * 1.05)
            scallop = 0.0012 * math.sin(26 * th) * s ** 3
            z = NECK_Z + 0.0055 - 0.0160 * s ** 1.4 - 0.003 * front * s + scallop
            row.append(V(a * math.sin(th), CY * 0.3 - b * math.cos(th) * 1.0 + 0.012, z))
        grid.append(row)
    # grid rows go neck -> outside; flip so the normal faces up/out
    sheet(grid, flip=True, bm=bm)


# ---------------------------------------------------------------------------------------------------------------
# apron
# ---------------------------------------------------------------------------------------------------------------
APRON_TOP_Z = 0.812
APRON_HEM_Z = 0.372


def _apron_half_angle(z):
    # bib is narrow, widens into the skirt panel that wraps round the hips
    if z > 0.72:
        return math.radians(lerp(30.0, 40.0, smoothstep(0.812, 0.72, z)))
    return math.radians(lerp(40.0, 100.0, smoothstep(0.72, 0.60, z)))


def build_apron(bm, seg=58):
    zs = []
    for lo, hi, n in ((APRON_TOP_Z, 0.72, 6), (0.72, 0.60, 7), (0.60, APRON_HEM_Z, 14)):
        for i in range(n):
            zs.append(lerp(lo, hi, i / n))
    zs.append(APRON_HEM_Z)
    rows = []
    for z in zs:
        hm = _apron_half_angle(z)
        row = []
        for i in range(seg):
            th = lerp(hm, -hm, i / (seg - 1))     # walk the angle so the sheet's normal faces outwards
            off = 0.0055 + 0.0035 * math.sin(math.pi * clamp((0.812 - z) / 0.1)) * 0.0
            row.append(dress_point(th, z, off=off, fold_k=0.72))
        rows.append(row)
    sheet(rows, flip=False, bm=bm)


def build_apron_frill(bm, seg=150):
    """Gathered ruffle along the apron hem."""
    rows = []
    n_rows = 5
    for r in range(n_rows):
        t = r / (n_rows - 1)
        row = []
        for i in range(seg):
            th = lerp(math.radians(100), -math.radians(100), i / (seg - 1))
            z = APRON_HEM_Z + 0.026 - 0.034 * t
            wave = math.sin(34 * th)
            off = 0.0090 + 0.0100 * wave * (0.2 + 0.8 * t) + 0.004 * t
            zz = z + 0.004 * math.cos(34 * th + 1.0) * t
            p = dress_point(th, zz, off=off, fold_k=0.72)
            row.append(p)
        rows.append(row)
    sheet(rows, flip=False, bm=bm)


def build_pockets(bm):
    for sgn in (1.0, -1.0):
        th0 = sgn * math.radians(31)
        rows = []
        cols = 9
        nr = 7
        for r in range(nr):
            t = r / (nr - 1)
            z = 0.586 - 0.112 * t
            row = []
            for c in range(cols):
                u = (c / (cols - 1) - 0.5)
                w = 0.062 * (1.0 - 0.18 * t * t * 0.0)
                th = th0 + u * 0.30 * (1.0 - 0.22 * t)
                # rounded bottom corners
                z2 = z + (0.014 * (2 * abs(u)) ** 3) * t
                row.append(dress_point(th, z2, off=0.0078, fold_k=0.5))
            rows.append(row)
        sheet(rows, flip=False, bm=bm)


def build_straps(bm):
    """Frilled shoulder straps from the bib, over the shoulders, down the back."""
    for sgn in (1.0, -1.0):
        pts = [
            V(0.040 * sgn, -0.060, 0.800),
            V(0.050 * sgn, -0.056, 0.832),
            V(0.064 * sgn, -0.020, 0.862),
            V(0.066 * sgn, 0.020, 0.862),
            V(0.052 * sgn, 0.054, 0.832),
            V(0.044 * sgn, 0.062, 0.800),
        ]
        tube(pts, rx=0.0105, ry=0.0016, n=6, up_hint=(0.3 * sgn, 0, 1), cap_start=True, cap_end=True, bm=bm)
        # ruffle on the outer edge
        outer = []
        for p in pts:
            outer.append(p + V(0.012 * sgn, 0.0, 0.0))
        tube(outer, rx=lambda t: 0.0075 + 0.0035 * math.sin(2 * math.pi * 9 * t), ry=0.0025, n=6, up_hint=(0.3 * sgn, 0, 1),
             cap_start=True, cap_end=True, bm=bm)


def build_waistband(bm):
    rows = []
    for r in range(3):
        t = r / 2
        z = 0.722 - 0.026 * t
        row = []
        for i in range(61):
            th = lerp(math.radians(172), -math.radians(172), i / 60)
            row.append(dress_point(th, z, off=0.0072, fold_k=0.0))
        rows.append(row)
    sheet(rows, flip=False, bm=bm)


def build_sash_bow(bm, rng):
    """Back bow: two loops, a knot and two long tails (the tails are skinned to SashTail_* bones)."""
    c = V(0.0, CY + 0.052 + 0.016, 0.708)
    for sgn in (1.0, -1.0):
        pts = []
        for k in range(10):
            t = k / 9
            pts.append(c + V(sgn * (0.008 + 0.050 * t), 0.014 * math.sin(math.pi * t), 0.016 * math.sin(math.pi * t) * (1 if sgn > 0 else 0.8)))
        tube(pts, rx=lambda t: 0.0150 * (0.3 + 0.7 * math.sin(math.pi * min(1, 0.1 + 0.9 * t)) ** 0.8), ry=lambda t: 0.0030,
             n=8, up_hint=(0, 1, 0), cap_start=False, cap_end=True, bm=bm)
    knot = [c + V(-0.007 + 0.014 * k / 5, 0.004, 0.0) for k in range(6)]
    tube(knot, rx=0.0075, ry=0.0070, n=8, up_hint=(0, 1, 0), cap_start=True, cap_end=True, bm=bm)
    tails = []
    for name, chain in spec.SASH_CHAINS.items():
        sgn = 1.0 if name.endswith('L') else -1.0
        pts = []
        base = [Vector(p) for p in chain]
        steps = 12
        for k in range(steps + 1):
            t = k / steps
            seg = t * (len(base) - 1)
            i0 = min(len(base) - 2, int(seg))
            p = base[i0].lerp(base[i0 + 1], seg - i0)
            pts.append(p + V(0.012 * sgn * math.sin(2 * math.pi * 1.2 * t) * t, 0.010, 0.0))
        tube(pts, rx=lambda t: 0.0115 * (1 - 0.18 * t), ry=0.0022, n=6, up_hint=(0, 1, 0), cap_start=True, cap_end=True, bm=bm)
        tails.append(pts)
    return tails
