"""Alice's skin parts (neck, arms, hands), stockings and Mary-Jane shoes."""
import math

import bmesh
from mathutils import Vector

from lib.meshkit import V, clamp, lerp, loft, ring_around, sheet, smoothstep, tube
from . import spec


def _tip(t, p=6):
    """Radius multiplier that closes a tube smoothly into a rounded tip as t -> 1."""
    return math.sqrt(max(0.0, 1.0 - t ** p))


# ---------------------------------------------------------------------------------------------------------------
# neck / arms / hands
# ---------------------------------------------------------------------------------------------------------------
def build_neck(bm):
    pts = [V(0, 0.004, 0.835), V(0, 0.006, 0.870), V(0, 0.009, 0.905), V(0, 0.012, 0.935)]
    tube(pts, rx=[0.0385, 0.0355, 0.0345, 0.0345], ry=[0.0370, 0.0345, 0.0335, 0.0335], n=14, up_hint=(0, -1, 0),
         cap_start=True, cap_end=True, bm=bm)


def build_arm(bm, side):
    a = spec.arm_points(side)
    sh, el, wr, tip = a
    pts = [
        sh + V(0.0, 0.0, 0.020),
        sh.lerp(el, 0.18),
        sh.lerp(el, 0.55),
        el,
        el.lerp(wr, 0.45),
        wr.lerp(el, 0.15),
        wr,
    ]
    rad = [0.0295, 0.0285, 0.0262, 0.0228, 0.0208, 0.0178, 0.0165]
    tube(pts, rx=rad, ry=[r * 0.96 for r in rad], n=12, up_hint=(0, -1, 0), cap_start=True, cap_end=False, bm=bm)
    build_hand(bm, side)


def build_hand(bm, side):
    a = spec.arm_points(side)
    wr, tip = a[2], a[3]
    d = (tip - wr)
    # palm: wide (front-back) and thin (inside-outside)
    ppts = [wr, wr + d * 0.30, wr + d * 0.65, wr + d * 0.98]
    tube(ppts, rx=[0.0170, 0.0215, 0.0245, 0.0240], ry=[0.0150, 0.0115, 0.0105, 0.0095], n=12,
         up_hint=(side, 0, 0), cap_start=False, cap_end=True, bm=bm)
    for i in range(4):
        ch = spec.finger_chain(side, i)
        pts = []
        for k in range(7):
            t = k / 6
            seg = t * 2
            if seg <= 1:
                p = ch[0].lerp(ch[1], seg)
            else:
                p = ch[1].lerp(ch[2], seg - 1)
            pts.append(p)
        r0 = spec.FINGER_RAD * (1.0 - 0.1 * i * (1 if i == 3 else 0))
        tube(pts, rx=lambda t, r0=r0: r0 * (1.0 - 0.28 * t) * _tip(t, 7), ry=lambda t, r0=r0: r0 * 0.92 * (1.0 - 0.28 * t) * _tip(t, 7),
             n=8, up_hint=(side, 0, 0), cap_start=False, cap_end=True, bm=bm)
    tc = spec.thumb_chain(side)
    pts = []
    for k in range(7):
        t = k / 6
        seg = t * 2
        p = tc[0].lerp(tc[1], seg) if seg <= 1 else tc[1].lerp(tc[2], seg - 1)
        pts.append(p)
    tube(pts, rx=lambda t: 0.0082 * (1 - 0.25 * t) * _tip(t, 7), ry=lambda t: 0.0078 * (1 - 0.25 * t) * _tip(t, 7),
         n=8, up_hint=(side, 0, 0), cap_start=False, cap_end=True, bm=bm)


# ---------------------------------------------------------------------------------------------------------------
# stockings (full-length tubes; hidden above the hem)
# ---------------------------------------------------------------------------------------------------------------
def build_stocking(bm, side):
    lx = spec.LEG_X * side
    zs = [0.505, 0.44, 0.365, 0.285, 0.215, 0.150, 0.100, 0.075]
    rad = [0.0345, 0.0315, 0.0285, 0.0268, 0.0275, 0.0238, 0.0212, 0.0205]
    pts = [V(lx, 0.0 - 0.003 * (1 - (z - 0.075) / 0.43), z) for z in zs]
    tube(pts, rx=rad, ry=[r * 1.02 for r in rad], n=14, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm,
         uv_u=(0.0, 3.0), uv_v=(0.0, 1.0))
    # the stockinged foot, tucked inside the shoe
    foot = [V(lx, -0.002, 0.082), V(lx, -0.030, 0.049), V(lx, -0.070, 0.036), V(lx, -0.108, 0.031), V(lx, -0.134, 0.028)]
    tube(foot, rx=[0.0205, 0.0225, 0.0245, 0.0230, 0.0140], ry=[0.0150, 0.0098, 0.0085, 0.0072, 0.0045], n=12, up_hint=(0, 0, 1),
         cap_start=False, cap_end=True, bm=bm, uv_u=(0.0, 3.0), uv_v=(0.0, 1.0))


# ---------------------------------------------------------------------------------------------------------------
# Mary-Jane shoe (+ strap, buckle)
# ---------------------------------------------------------------------------------------------------------------
def _make_shoe_profile():
    """(y, half-width, height) rings heel->toe; the toe cap is a true rounded cap (circle of radius 0.037)."""
    pts = []
    toe_c, toe_r = -0.121, 0.036
    for k in range(9):
        a = (k / 8) * (math.pi / 2)                      # 0 = start of the cap, pi/2 = the very tip
        y = toe_c - math.sin(a) * toe_r
        w = 0.0385 * math.cos(a) ** 0.85
        h = 0.0300 * math.cos(a) ** 0.70
        pts.append((y, max(0.0035, w), max(0.0045, h)))
    pts = pts[::-1]                                       # tip first
    tail = [(-0.095, 0.0402, 0.0360), (-0.065, 0.0380, 0.0415), (-0.036, 0.0330, 0.0455), (-0.012, 0.0305, 0.0490),
            (0.014, 0.0295, 0.0505), (0.036, 0.0275, 0.0470), (0.049, 0.0235, 0.0355), (0.054, 0.0150, 0.0180)]
    return pts[:-1] + [(-0.121, 0.0385, 0.0300)] + tail


SHOE_PROFILE = _make_shoe_profile()
SOLE_Z = 0.014


def build_shoe(bm, side):
    lx = spec.LEG_X * side
    rings = []
    n = 20
    for (y, w, h) in SHOE_PROFILE:
        cz = SOLE_Z + h * 0.5
        # the throat opens towards the ankle (y > -0.03) so the stocking shows
        opening = smoothstep(-0.050, -0.010, y)
        span = math.radians(180.0 - 78.0 * opening)   # half-angle measured from the bottom
        pts = []
        for i in range(n):
            t = i / (n - 1)
            th = lerp(-span, span, t)
            x = lx + math.sin(th) * w * (1.0 + 0.05 * math.cos(th))
            z = cz - math.cos(th) * (h * 0.5)
            pts.append(V(x, y, z))
        rings.append(pts)
    rings = rings[::-1]          # heel -> toe so normals face outwards
    loft(rings, close_u=False, bm=bm)

    # welt / sole: a slim ring around the shoe, slightly proud of the upper
    sole_rings = []
    prof = [(-0.160, 0.004), (-0.152, 0.017), (-0.138, 0.030), (-0.115, 0.0405), (-0.090, 0.0440), (-0.060, 0.0405),
            (-0.030, 0.0350), (0.0, 0.0325), (0.030, 0.0305), (0.048, 0.0260), (0.058, 0.0155), (0.061, 0.004)]
    for (y, w) in prof:
        ring = []
        for i in range(16):
            th = 2 * math.pi * i / 16
            x = lx + math.cos(th) * w
            z = SOLE_Z * 0.5 + math.sin(th) * SOLE_Z * 0.5
            ring.append(V(x, y, z))
        sole_rings.append(ring)
    loft(sole_rings[::-1], close_u=True, cap_start=True, cap_end=True, bm=bm)

    # short block heel
    hp = [V(lx, 0.036, 0.0), V(lx, 0.042, 0.007), V(lx, 0.046, 0.012)]
    tube(hp, rx=0.0250, ry=0.0090, n=10, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)


def build_strap(bm, side):
    """Instep strap sweeping over the top of the foot (the classic Mary-Jane bar)."""
    lx = spec.LEG_X * side
    y = -0.030
    prof = None
    for (py, w, h) in SHOE_PROFILE:
        if py >= y:
            prof = (py, w, h)
            break
    _y, w, h = prof
    cz = SOLE_Z + h * 0.5
    pts = []
    n = 12
    for i in range(n):
        t = i / (n - 1)
        th = lerp(-math.radians(72), math.radians(72), t) + math.pi  # over the top of the foot
        x = lx + math.sin(th) * (w + 0.0015)
        z = cz - math.cos(th) * (h * 0.5 + 0.0015)
        pts.append(V(x, y, z))
    tube(pts, rx=0.0052, ry=0.0020, n=8, up_hint=(0, 1, 0), cap_start=True, cap_end=True, bm=bm)
    # buckle plate + button on the outer side of the foot
    ox = lx + (-1 if side > 0 else 1) * 0.0  # inner/outer is irrelevant visually; put on the outer side
    outer = 1.0 if side > 0 else -1.0
    bp = pts[0] if outer > 0 else pts[-1]
    del ox
    return bp
