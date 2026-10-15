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
    """Gathered green skirt: a dome over the bent knees, spilling to the ground with deep box pleats and 3D tiered ruffles."""
    cx, cy = 0.0, -0.13
    N, K = 144, 40
    rows = []
    for k in range(K + 1):
        r = k / K
        row = []
        for i in range(N):
            th = -2 * math.pi * i / N      # decreasing angle -> outward normals for a loft running outwards/down
            front = max(0.0, -math.cos(th))   # 0..1 toward -Y
            R = lerp(0.37, 0.57, front ** 1.35)
            # Deep sculpted box pleats + secondary cloth crinkles
            pleat_main = math.sin(11 * th)
            pleat_box = math.copysign(abs(pleat_main) ** 0.65, pleat_main)
            fold = 1.0 + (0.115 * pleat_box + 0.048 * math.sin(22 * th + 1.5) + 0.025 * math.sin(33 * th + 0.6)) * (0.25 + 0.75 * r ** 1.15)
            rr = R * r * fold
            x = cx + rr * math.sin(-th)
            y = cy + rr * -math.cos(-th)
            dome = 0.31 * (1.0 - r ** 2.1) ** 0.68
            # Sculpted ridge relief along each pleat crest and tier flounces
            ridge_z = 0.022 * pleat_box * math.sin(math.pi * r) * (0.4 + 0.6 * front)
            tier_wave = 0.012 * math.sin(3 * math.pi * r) ** 2
            hem_lift = 0.018 * math.sin(11 * th + 1.2) * smoothstep(0.82, 1.0, r)
            z = 0.012 + dome + 0.055 * (1.0 - r) * front + ridge_z + tier_wave + hem_lift
            row.append(V(x, y, z))
        rows.append(row)
    loft(rows, close_u=True, cap_start=True, cap_end=False, bm=bm)

    # Three sculpted 3D flounce ruffles around the skirt at r = 0.46, 0.72, 0.95 so the inverted-hull ink outline draws crisp tiers
    for r_tier, amp_r, z_drop in ((0.46, 0.024, 0.032), (0.72, 0.028, 0.036), (0.95, 0.025, 0.028)):
        flounce_rows = []
        for f_step in range(5):
            ft = f_step / 4.0
            r_cur = min(1.0, r_tier + ft * 0.065)
            frow = []
            for i in range(N):
                th = -2 * math.pi * i / N
                front = max(0.0, -math.cos(th))
                R = lerp(0.37, 0.57, front ** 1.35)
                pleat_main = math.sin(11 * th)
                pleat_box = math.copysign(abs(pleat_main) ** 0.65, pleat_main)
                ruffle_wave = math.sin(33 * th + r_tier * 12.0)
                fold = 1.0 + (0.115 * pleat_box + 0.048 * math.sin(22 * th + 1.5)) * (0.25 + 0.75 * r_cur ** 1.15)
                rr = R * r_cur * fold + (0.008 + amp_r * (0.3 + 0.7 * ft) * (0.5 + 0.5 * ruffle_wave))
                x = cx + rr * math.sin(-th)
                y = cy + rr * -math.cos(-th)
                dome = 0.31 * (1.0 - r_cur ** 2.1) ** 0.68
                z = 0.014 + dome + 0.055 * (1.0 - r_cur) * front - z_drop * ft + 0.007 * ruffle_wave * ft
                frow.append(V(x, y, z))
            flounce_rows.append(frow)
        sheet(flounce_rows, flip=False, bm=bm)


def build_bodice(bm, seg=48):
    rings = []
    zs = [0.24, 0.28, 0.32, 0.36, 0.40, 0.44, 0.48, 0.52, 0.56, 0.585, 0.612, 0.630]
    for z in zs:
        t = (z - 0.24) / (0.63 - 0.24)
        a = lerp(0.116, 0.110, t) if t < 0.85 else lerp(0.110, 0.048, (t - 0.85) / 0.15)
        a *= 1.0 + 0.045 * math.sin(t * math.pi)       # soft bust / ribcage
        b = lerp(0.076, 0.064, t) if t < 0.85 else lerp(0.064, 0.044, (t - 0.85) / 0.15)
        ring = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            # Subtle vertical pintuck pleats across the front bodice
            front_pleat = 1.0 + 0.022 * math.cos(16 * th) * max(0.0, -math.cos(th)) * math.sin(t * math.pi)
            ring.append(V(a * front_pleat * math.sin(th), 0.015 - b * front_pleat * math.cos(th), z))
        rings.append(ring)
    loft(rings, close_u=True, cap_start=True, cap_end=True, bm=bm)


def build_shawl(bm, seg=64):
    """Cream crochet shawl + lap pinafore apron panel: drapes over the shoulders and cascades into a scalloped lace border."""
    rows = []
    collar = [(0.658, 0.050, 0.044), (0.648, 0.078, 0.064), (0.638, 0.108, 0.082)]
    zs = [0.632, 0.615, 0.59, 0.56, 0.52, 0.48, 0.44, 0.395]
    for z, a, b in collar:
        row = []
        for i in range(seg):
            th = lerp(math.radians(24), math.radians(336), i / (seg - 1))
            row.append(V(a * math.sin(th), 0.015 - b * math.cos(th), z))
        rows.append(row)
    for j, z in enumerate(zs):
        t = j / (len(zs) - 1)
        row = []
        for i in range(seg):
            th = lerp(math.radians(24), math.radians(336), i / (seg - 1))
            rib = 0.008 * math.sin(24 * th) * smoothstep(0.15, 0.9, t)
            a = 0.123 + 0.032 * smoothstep(0, 1, t) + 0.016 * math.sin(math.pi * min(1.0, t * 1.4)) + rib
            b = 0.090 + 0.025 * smoothstep(0, 1, t) + rib
            fringe = 0.022 * math.sin(28 * th) * smoothstep(0.65, 1.0, t)
            row.append(V(a * math.sin(th), 0.015 - b * math.cos(th), z - fringe))
        rows.append(row)
    sheet(rows, flip=True, bm=bm)

    # Sculpted cream linen lap apron / overskirt panel with ruffled trim over the upper skirt
    cx, cy = 0.0, -0.13
    apron_rows = []
    K_ap, N_ap = 16, 64
    for k in range(K_ap + 1):
        r = 0.12 + 0.54 * (k / K_ap)
        arow = []
        for i in range(N_ap):
            th = lerp(-math.radians(108), math.radians(108), i / (N_ap - 1)) + math.pi
            front = max(0.0, -math.cos(th))
            R = lerp(0.37, 0.57, front ** 1.35)
            pleat_main = math.sin(11 * th)
            pleat_box = math.copysign(abs(pleat_main) ** 0.65, pleat_main)
            lace_wave = 0.016 * math.sin(26 * th) * smoothstep(0.75, 1.0, k / K_ap)
            fold = 1.0 + (0.115 * pleat_box + 0.048 * math.sin(22 * th + 1.5)) * (0.25 + 0.75 * r ** 1.15)
            rr = R * r * fold + 0.010 + lace_wave
            x = cx + rr * math.sin(-th)
            y = cy + rr * -math.cos(-th)
            dome = 0.31 * (1.0 - r ** 2.1) ** 0.68
            ridge_z = 0.022 * pleat_box * math.sin(math.pi * r) * (0.4 + 0.6 * front)
            z = 0.022 + dome + 0.055 * (1.0 - r) * front + ridge_z
            arow.append(V(x, y, z))
        apron_rows.append(arow)
    sheet(apron_rows, flip=True, bm=bm)


def build_neck(bm):
    pts = [V(0, 0.0, 0.595), V(0, 0.003, 0.64), V(0, 0.006, 0.685), V(0, 0.008, 0.705)]
    tube(pts, rx=[0.040, 0.034, 0.032, 0.032], ry=[0.038, 0.033, 0.031, 0.031], n=14, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm)


def build_sleeve(bm, side):
    p = [
        SH[side] + V(-0.012 * side, 0, 0.02),
        SH[side].lerp(EL[side], 0.25),
        SH[side].lerp(EL[side], 0.55),
        SH[side].lerp(EL[side], 0.82),
        EL[side] + (WR[side] - EL[side]).normalized() * 0.03,
    ]
    tube(
        p,
        rx=[0.050, 0.054, 0.048, 0.042, 0.035],
        ry=[0.048, 0.052, 0.046, 0.040, 0.033],
        n=20,
        up_hint=(0, -1, 0),
        cap_start=True,
        cap_end=False,
        bm=bm,
        shape=lambda th, t: 1.0 + 0.055 * math.sin(12 * th) * math.sin(math.pi * t),
    )
    # Double scalloped lace cuff
    c = [p[-1] + (WR[side] - EL[side]).normalized() * (0.002 + 0.022 * k / 4) for k in range(5)]
    tube(c, rx=0.036, ry=0.035, n=20, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm, shape=lambda th, t: 1.0 + 0.095 * math.sin(16 * th) * t)


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
    """Open book tilted toward her eyes: two covers with raised spine ribs + a curved multi-layer page block."""
    tilt = math.radians(-38)
    rot = Matrix.Rotation(tilt, 3, 'X')
    for sgn in (-1, 1):
        rows = []
        for j in range(6):
            row = []
            for i in range(8):
                x = sgn * (0.004 + 0.112 * i / 7)
                y = lerp(-0.080, 0.080, j / 5)
                z = 0.014 - 0.006 * (i / 7) ** 2
                p = rot @ V(x, y, z)
                row.append(BOOK_C + p)
            rows.append(row)
        sheet(rows, flip=(sgn < 0), bm=bm_cover)
        rows2 = [[BOOK_C + rot @ V(sgn * (0.004 + 0.115 * i / 7), lerp(-0.082, 0.082, j / 5), -0.004 - 0.006 * (i / 7) ** 2) for i in range(8)] for j in range(6)]
        sheet(rows2, flip=(sgn >= 0), bm=bm_cover)
    for sgn in (-1, 1):
        for layer_dz in (0.0, 0.0035):
            rows = []
            for j in range(8):
                row = []
                for i in range(10):
                    x = sgn * (0.003 + 0.105 * i / 9)
                    y = lerp(-0.075, 0.075, j / 7)
                    z = 0.021 + layer_dz - 0.011 * (i / 9) ** 2 + 0.004 * math.sin(math.pi * j / 7) * (i / 9)
                    row.append(BOOK_C + rot @ V(x, y, z))
                rows.append(row)
            sheet(rows, flip=(sgn > 0), bm=bm_pages, uv_rect=((0.0, 0.0, 0.5, 1.0) if sgn < 0 else (0.5, 0.0, 1.0, 1.0)))


def build_boots(bm):
    for s in (1, -1):
        cx = 0.11 * s
        pts = [V(cx, -0.44, 0.038), V(cx, -0.50, 0.042), V(cx, -0.56, 0.035), V(cx, -0.59, 0.028)]
        tube(pts, rx=[0.035, 0.040, 0.032, 0.024], ry=[0.033, 0.038, 0.026, 0.020], n=14, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)


def build_bun(bm, rng):
    """Braided low chignon at the back of the head with coiled locks, in the (un-bowed) Alice head frame."""
    c = V(0.0, 0.118, 1.03)
    for k, (dx, dz, r) in enumerate((
        (0.0, 0.0, 0.046),
        (0.030, 0.014, 0.032),
        (-0.030, 0.014, 0.032),
        (0.0, -0.030, 0.032),
        (0.024, -0.022, 0.026),
        (-0.024, -0.022, 0.026),
    )):
        ellipsoid((c.x + dx, c.y, c.z + dz), (r, r * 0.9, r * 0.85), seg=16, rings=10, bm=bm)

