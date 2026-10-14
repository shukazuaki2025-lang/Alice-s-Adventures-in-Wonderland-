"""Alice's elder sister: seated against the oak, reading. Geometry in Blender space, facing -Y, seat at z ≈ 0."""
import math

import bmesh
from mathutils import Matrix, Vector

from lib.meshkit import Rng, V, clamp, lerp, loft, sheet, smoothstep, tube, ellipsoid
from lib.rigkit import Bone

SEAT_Z = 0.075
SHOULDER_Z = 0.60
NECK_Z = 0.63
HEAD_DZ = -0.225           # Alice's head centre (z = 1.015) -> 0.805
BOW_DEG = 14.0             # head bowed over the book
LEAN_DEG = -7.0            # torso leans back against the trunk
PIVOT = V(0.0, 0.01, 0.665)

# arm (seated, holding the book at the lap)
SH = {1: V(0.112, 0.0, 0.595), -1: V(-0.112, 0.0, 0.595)}
EL = {1: V(0.158, -0.125, 0.395), -1: V(-0.158, -0.125, 0.395)}
WR = {1: V(0.092, -0.265, 0.325), -1: V(-0.092, -0.265, 0.325)}
TIP = {1: V(0.082, -0.325, 0.315), -1: V(-0.082, -0.325, 0.315)}
BOOK_C = V(0.0, -0.31, 0.345)

BONES = [
    Bone('Root', (0, 0, 0), (0, 0, 0.05), None, deform=False),
    Bone('Hips', (0, 0.02, 0.08), (0, 0.02, 0.30), 'Root'),
    Bone('Spine', (0, 0.02, 0.30), (0, 0.012, 0.45), 'Hips'),
    Bone('Chest', (0, 0.012, 0.45), (0, 0.0, 0.60), 'Spine'),
    Bone('Neck', (0, 0.0, 0.60), (0, 0.005, 0.665), 'Chest'),
    Bone('Head', (0, 0.005, 0.665), (0, 0.01, 0.95), 'Neck'),
    Bone('Jaw', (0, 0.0, 0.76), (0, -0.07, 0.70), 'Head'),
    Bone('Eye_L', (0.04, -0.06, 0.79), (0.04, -0.09, 0.79), 'Head'),
    Bone('Eye_R', (-0.04, -0.06, 0.79), (-0.04, -0.09, 0.79), 'Head'),
] + [b for s, sn in ((1, 'L'), (-1, 'R')) for b in (
    Bone(f'UpperArm_{sn}', SH[s], EL[s], 'Chest'),
    Bone(f'LowerArm_{sn}', EL[s], WR[s], f'UpperArm_{sn}'),
    Bone(f'Hand_{sn}', WR[s], TIP[s], f'LowerArm_{sn}'),
    Bone(f'SOCKET_Hand{sn}', TIP[s] + V(0, 0.01, 0.01), TIP[s] + V(0, -0.02, 0.01), f'Hand_{sn}', deform=False),
)]


def build_skirt(bm):
    """Gathered green skirt: a dome over the bent knees, spilling to the ground with a scalloped hem."""
    cx, cy = 0.0, -0.13
    N, K = 132, 34
    rows = []
    for k in range(K + 1):
        r = k / K
        row = []
        for i in range(N):
            th = -2 * math.pi * i / N      # decreasing angle -> outward normals for a loft running outwards/down
            front = max(0.0, -math.cos(th))   # 0..1 toward -Y
            R = lerp(0.37, 0.56, front ** 1.4)
            fold = 1.0 + (0.085 * math.sin(11 * th) + 0.035 * math.sin(23 * th + 1.7) + 0.02 * math.sin(5 * th + 0.4)) * r ** 1.3
            rr = R * r * fold
            x = cx + rr * math.sin(-th)
            y = cy + rr * -math.cos(-th)
            dome = 0.30 * (1.0 - r ** 2.2) ** 0.7
            hem_lift = 0.012 * math.sin(11 * th + 1.2) * smoothstep(0.85, 1.0, r)
            z = 0.012 + dome + 0.05 * (1.0 - r) * front + hem_lift
            row.append(V(x, y, z))
        rows.append(row)
    loft(rows, close_u=True, cap_start=True, cap_end=False, bm=bm)


def build_bodice(bm, seg=40):
    rings = []
    zs = [0.24, 0.30, 0.36, 0.42, 0.48, 0.54, 0.585, 0.612, 0.630]
    for z in zs:
        t = (z - 0.24) / (0.63 - 0.24)
        a = lerp(0.115, 0.108, t) if t < 0.85 else lerp(0.108, 0.048, (t - 0.85) / 0.15)
        a *= 1.0 + 0.04 * math.sin(t * math.pi)       # soft bust / ribcage
        b = lerp(0.075, 0.062, t) if t < 0.85 else lerp(0.062, 0.044, (t - 0.85) / 0.15)
        ring = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            ring.append(V(a * math.sin(th), 0.015 - b * math.cos(th), z))
        rings.append(ring)
    loft(rings, close_u=True, cap_start=True, cap_end=True, bm=bm)


def build_shawl(bm, seg=44):
    """Cream crochet shawl: open at the front, draping over the shoulders and down the back."""
    rows = []
    # collar: three rows that fold in against the neck so the shawl reads as a closed garment from above/behind
    collar = [(0.655, 0.050, 0.044), (0.645, 0.075, 0.062), (0.636, 0.104, 0.080)]
    zs = [0.63, 0.615, 0.59, 0.55, 0.50, 0.45, 0.405]
    for z, a, b in collar:
        row = []
        for i in range(seg):
            th = lerp(math.radians(35), math.radians(325), i / (seg - 1))
            row.append(V(a * math.sin(th), 0.015 - b * math.cos(th), z))
        rows.append(row)
    for j, z in enumerate(zs):
        t = j / (len(zs) - 1)
        row = []
        for i in range(seg):
            th = lerp(math.radians(35), math.radians(325), i / (seg - 1))
            a = 0.121 + 0.025 * smoothstep(0, 1, t) + 0.015 * math.sin(math.pi * min(1.0, t * 1.4))
            b = 0.088 + 0.02 * smoothstep(0, 1, t)
            fringe = 0.012 * math.sin(30 * th) * smoothstep(0.7, 1.0, t)
            row.append(V(a * math.sin(th), 0.015 - b * math.cos(th), z - fringe))
        rows.append(row)
    sheet(rows, flip=True, bm=bm)


def build_neck(bm):
    pts = [V(0, 0.0, 0.595), V(0, 0.003, 0.64), V(0, 0.006, 0.685), V(0, 0.008, 0.705)]
    tube(pts, rx=[0.040, 0.034, 0.032, 0.032], ry=[0.038, 0.033, 0.031, 0.031], n=14, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm)


def build_sleeve(bm, side):
    p = [SH[side] + V(-0.012 * side, 0, 0.02), SH[side].lerp(EL[side], 0.35), SH[side].lerp(EL[side], 0.75), EL[side] + (WR[side] - EL[side]).normalized() * 0.03]
    tube(p, rx=[0.046, 0.045, 0.040, 0.034], ry=[0.044, 0.043, 0.038, 0.032], n=16, up_hint=(0, -1, 0), cap_start=True, cap_end=False, bm=bm)
    # lace cuff
    c = [p[-1] + (WR[side] - EL[side]).normalized() * (0.002 + 0.016 * k / 3) for k in range(4)]
    tube(c, rx=0.034, ry=0.033, n=16, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm, shape=lambda th, t: 1.0 + 0.07 * math.sin(14 * th) * t)


def build_forearm_hand(bm, side):
    el, wr, tip = EL[side], WR[side], TIP[side]
    pts = [el + (wr - el).normalized() * 0.03, el.lerp(wr, 0.5), wr]
    tube(pts, rx=[0.026, 0.022, 0.0175], ry=[0.025, 0.021, 0.0165], n=12, up_hint=(0, 0, 1), cap_start=True, cap_end=False, bm=bm)
    d = (tip - wr)
    palm = [wr, wr + d * 0.5, wr + d * 0.98]
    tube(palm, rx=[0.0175, 0.0225, 0.0230], ry=[0.0115, 0.0105, 0.0095], n=12, up_hint=(0, 0, 1), cap_start=False, cap_end=True, bm=bm)
    dd = d.normalized()
    across = Vector((1, 0, 0))
    for i, off in enumerate((-0.0165, -0.0055, 0.0055, 0.0155)):
        f0 = tip + across * off * side
        f1 = f0 + dd * 0.022 + V(0, 0, -0.004)
        f2 = f1 + dd * 0.018 + V(0, 0, -0.012)
        pts = [f0, f0.lerp(f1, 0.5), f1, f1.lerp(f2, 0.5), f2]
        tube(pts, rx=lambda t: 0.0066 * (1 - 0.3 * t) * math.sqrt(max(0.0, 1 - t ** 7)), ry=lambda t: 0.0062 * (1 - 0.3 * t) * math.sqrt(max(0.0, 1 - t ** 7)),
             n=8, up_hint=(0, 0, 1), cap_start=False, cap_end=True, bm=bm)
    th = [wr + V(0.010 * side, -0.012, 0.012), wr + V(0.022 * side, -0.036, 0.016), wr + V(0.028 * side, -0.058, 0.010)]
    tube(th, rx=lambda t: 0.0078 * math.sqrt(max(0.0, 1 - t ** 7)), ry=lambda t: 0.0072 * math.sqrt(max(0.0, 1 - t ** 7)), n=8, up_hint=(0, 0, 1), cap_start=False, cap_end=True, bm=bm)


def build_book(bm_cover, bm_pages):
    """Open book tilted toward her eyes: two covers + a curved page block."""
    tilt = math.radians(-38)
    rot = Matrix.Rotation(tilt, 3, 'X')
    for sgn in (-1, 1):
        rows = []
        for j in range(5):
            row = []
            for i in range(7):
                x = sgn * (0.004 + 0.105 * i / 6)
                y = lerp(-0.075, 0.075, j / 4)
                z = 0.014 - 0.006 * (i / 6) ** 2 + 0.0
                p = rot @ V(x, y, z)
                row.append(BOOK_C + p)
            rows.append(row)
        sheet(rows, flip=(sgn < 0), bm=bm_cover)
        # covers have thickness via a second sheet slightly below (read as the cloth edge)
        rows2 = [[BOOK_C + rot @ V(sgn * (0.004 + 0.108 * i / 6), lerp(-0.078, 0.078, j / 4), -0.002 - 0.006 * (i / 6) ** 2) for i in range(7)] for j in range(5)]
        sheet(rows2, flip=(sgn >= 0), bm=bm_cover)
    for sgn in (-1, 1):
        rows = []
        for j in range(7):
            row = []
            for i in range(9):
                x = sgn * (0.003 + 0.100 * i / 8)
                y = lerp(-0.072, 0.072, j / 6)
                z = 0.020 - 0.010 * (i / 8) ** 2 + 0.003 * math.sin(math.pi * j / 6) * (i / 8)
                row.append(BOOK_C + rot @ V(x, y, z))
            rows.append(row)
        sheet(rows, flip=(sgn > 0), bm=bm_pages, uv_rect=((0.0, 0.0, 0.5, 1.0) if sgn < 0 else (0.5, 0.0, 1.0, 1.0)))


def build_boots(bm):
    for s in (1, -1):
        cx = 0.11 * s
        pts = [V(cx, -0.44, 0.038), V(cx, -0.50, 0.040), V(cx, -0.56, 0.035)]
        tube(pts, rx=[0.034, 0.039, 0.030], ry=[0.032, 0.036, 0.024], n=12, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)


def build_bun(bm, rng):
    """Low chignon at the back of the head, in the (un-bowed) Alice head frame."""
    c = V(0.0, 0.118, 1.03)
    for k, (dx, dz, r) in enumerate(((0.0, 0.0, 0.045), (0.028, 0.012, 0.030), (-0.026, 0.014, 0.030), (0.0, -0.028, 0.030))):
        ellipsoid((c.x + dx, c.y, c.z + dz), (r, r * 0.9, r * 0.85), seg=14, rings=9, bm=bm)
