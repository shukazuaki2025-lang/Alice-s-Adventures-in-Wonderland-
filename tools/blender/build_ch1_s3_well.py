"""
Build the Chapter 1 / S3 well — "Down, down, down … she looked at the sides of the well, and noticed that they were filled with
cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs" — and export
public/assets/models/ch1_s3_well.glb.

    python3 tools/blender/build_ch1_s3_well.py           # env S3_OUT=... to write elsewhere, UG_CACHE=dir to cache painted atlases

The GLB holds ONE seamless 6 m segment of the shaft (`S3_WellSegment_*`, z in [0, 6], radius 4.0 m). The engine stacks four copies and
scrolls them upward at fall speed, so every feature sits inside the segment and the wall relief is periodic (z = 0 and z = 6 are
identical). Also `S3_ReturnCupboard` — the small open cupboard of the marmalade-jar gag.

The wall is ONE painted wrap-around image (world/underground_paint.well_wall, cut into four 90-degree atlases): strata of red brick,
chalk ashlar, ochre rubble, slate flags, flint-in-chalk and yellow stock brick, plaster / tile / board / iron repairs, damp, moss, cracks,
roots, painted arched niches, the cast shadow under every shelf and a warm pool of lantern light round every lamp. Three tiers of wall
units stand on corbels (books, cupboards painted in enamel colours, jam shelves, blue-and-white china), with hung maps and pictures,
arched candle niches and brass lanterns between them. Everything samples a handful of painted atlases (wood, books, preserves, art,
metal, stone), so a whole shaft is ~14 materials. Axes: game (x, z) = Blender (x, -z); game azimuth deg -> Blender angle -deg.
"""
import math
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))

import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V  # noqa: E402
from world import underground_paint as UP  # noqa: E402
from world import underground_props as PR  # noqa: E402

OUT = os.environ.get('S3_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s3_well.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'ch1_s3_well.glb')
CACHE = os.environ.get('UG_CACHE')

R = 4.0            # shaft radius (m): the follow camera sits ~3.2 m behind Alice, inside the shaft
SEG_H = 6.0        # one periodic segment
PAD = 16           # px of true neighbour content on each side of a wall atlas slice
ATLAS_W = 1536     # px per 90-degree slice
WALL_W, WALL_H = 4 * ATLAS_W, 1536


def cached(name, fn):
    """Paint-or-load: with UG_CACHE set, painted atlases are kept as uint8 .npy files (delete the folder after editing a painter)."""
    if CACHE:
        path = os.path.join(CACHE, name + '.npy')
        if os.path.exists(path):
            return UP.from_u8(np.load(path))
        arr = fn()
        os.makedirs(CACHE, exist_ok=True)
        np.save(path, UP.to_u8(arr))
        return arr
    return fn()


def main():
    mk.reset_scene()
    rng = mk.Rng(1865)

    def tex(name, arr, rough=0.9, double=False):
        img = paint.to_image('T_S3_' + name, arr)
        return paint.make_material('M_S3_' + name, img, roughness=rough, double_sided=double)

    def flat(name, hexc, rough=0.8, emissive=None):
        c = paint.srgb_to_linear(paint.hex_rgb(hexc))
        em = None
        if emissive:
            e = paint.srgb_to_linear(paint.hex_rgb(emissive))
            em = (float(e[0]), float(e[1]), float(e[2]))
        return paint.make_material('M_S3_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, emissive=em)

    # ------------------------------------------------------------------------------------------ layout (shared by geometry and the painted wall)
    TIERS = (0.26, 2.20, 4.12)
    TIER_OFF = (6.0, 24.0, 15.0)
    N_SLOT = 10
    kinds_cycle = (['books', 'cupboard', 'jars', 'china', 'books', 'cupboard', 'jars', 'books', 'china', 'cupboard'],
                   ['jars', 'books', 'cupboard', 'china', 'books', 'jars', 'cupboard', 'books', 'china', 'jars'],
                   ['cupboard', 'books', 'china', 'jars', 'cupboard', 'books', 'jars', 'china', 'books', 'cupboard'])
    gap_cycle = (['lantern', 'picture', 'map', 'niche', 'lantern', 'picture', 'niche', 'map', 'lantern', 'picture'],
                 ['picture', 'lantern', 'niche', 'map', 'lantern', 'picture', 'map', 'niche', 'lantern', 'picture'],
                 ['map', 'niche', 'lantern', 'picture', 'map', 'lantern', 'picture', 'niche', 'lantern', 'map'])
    WOOD_PICK = ['walnut', 'oak', 'sage', 'teal', 'cream', 'oxblood', 'mustard', 'walnut', 'sage', 'teal', 'oxblood', 'oak']
    units, gaps = [], []
    for t, z0 in enumerate(TIERS):
        for i in range(N_SLOT):
            deg = (TIER_OFF[t] + 36.0 * i) % 360.0
            w = rng.range(1.05, 1.28)
            h = rng.range(1.40, 1.68)
            units.append(dict(kind=kinds_cycle[t][i], deg=deg, z0=z0 + rng.range(-0.04, 0.04), w=w, h=h, wood=WOOD_PICK[int(min(rng.range(0, len(WOOD_PICK)), len(WOOD_PICK) - 0.001))],
                              tier=t, idx=i))
            gaps.append(dict(kind=gap_cycle[t][i], deg=(deg + 18.0) % 360.0, z0=z0 + rng.range(0.30, 0.50), tier=t, idx=i))

    # ------------------------------------------------------------------------------------------ painted atlases
    paint_items = dict(lamps=[], units=[(u['deg'], u['z0'], u['w'], u['h']) for u in units], niches=[], frames=[])
    lantern_sites, niche_sites, picture_sites, map_sites = [], [], [], []
    for g in gaps:
        if g['kind'] == 'lantern':
            lantern_sites.append((g['deg'], g['z0'] + 0.62))
        elif g['kind'] == 'niche':
            niche_sites.append((g['deg'], g['z0'] - 0.02))
        elif g['kind'] == 'picture':
            picture_sites.append((g['deg'], g['z0']))
        else:
            map_sites.append((g['deg'], g['z0']))
    paint_items['lamps'] = [(d, z) for d, z in lantern_sites] + [(d, z + 0.36) for d, z in niche_sites]
    paint_items['niches'] = [(d, z, 0.50, 0.74) for d, z in niche_sites]
    paint_items['frames'] = [(d, z, 0.62, 0.78) for d, z in picture_sites] + [(d, z, 0.95, 0.72) for d, z in map_sites]

    wall_img = cached('well_wall', lambda: UP.finish(UP.well_wall(paint_items, W=WALL_W, H=WALL_H)[0]))
    slices = UP.atlas_slices(wall_img, 4, PAD)
    del wall_img
    M = {}
    for k, s in enumerate(slices):
        M['wall%d' % k] = tex('Wall%d' % k, s, 0.95)
    M['wood'] = tex('Wood', cached('wood', PR.wood_atlas), 0.6)
    books_arr, spines, paper_u = None, None, None

    def _books():
        a, sp, pu = PR.books_atlas()
        return a, sp, pu
    books_arr, spines, paper_u = _books()                              # tiny; spines list is needed even when the image is cached
    M['books'] = tex('Books', cached('books', lambda: books_arr), 0.7)
    pres_arr, pres_idx = PR.preserves_atlas()
    M['pres'] = tex('Pres', cached('pres', lambda: pres_arr), 0.35)
    M['art'] = tex('Art', cached('art', PR.art_atlas), 0.6)
    M['brass'] = tex('Brass', cached('metal', PR.metal_atlas), 0.4)
    M['stone'] = tex('Stone', cached('stone', PR.stone_ledge), 0.9)
    M['glow'] = flat('LanternGlow', '#FFE7A8', 0.2, emissive='#FFC966')
    B = {k: bmesh.new() for k in M}

    WC = {n: PR.cell_rect(i, 4, 2) for n, i in PR.WOOD_CELLS.items()}
    PRC = {k: PR.cell_rect(i, 4, 4) for k, i in pres_idx.items()}
    ART = {k: PR.cell_rect(i, 4, 4) for i, k in enumerate(PR.ART_KEYS)}
    METAL = {'brass': PR.cell_rect(0, 2, 2), 'copper': PR.cell_rect(1, 2, 2), 'bronze': PR.cell_rect(2, 2, 2), 'iron': PR.cell_rect(3, 2, 2)}
    FULL = (0.0, 0.0, 1.0, 1.0)

    # ------------------------------------------------------------------------------------------ the shaft wall (seamless), four atlas quarters
    cols_q = 40
    rows = 40

    def wall_point(deg, z):
        th = math.radians(deg)
        d = (0.045 * math.sin(7 * th + 2 * math.pi * 2 * z / SEG_H) + 0.030 * math.sin(13 * th - 2 * math.pi * 5 * z / SEG_H + 1.3)
             + 0.020 * math.sin(29 * th + 2 * math.pi * 11 * z / SEG_H))
        r = R + (d + 0.095) * 0.55            # always recessed behind R, so nothing hung at R is ever swallowed by a bulge
        return V(r * math.cos(-th), r * math.sin(-th), z)

    for q in range(4):
        grid = [[wall_point(90.0 * q + 90.0 * i / cols_q, SEG_H * j / rows) for i in range(cols_q + 1)] for j in range(rows + 1)]
        u0 = PAD / (ATLAS_W + 2 * PAD)
        u1 = (PAD + ATLAS_W) / (ATLAS_W + 2 * PAD)
        mk.sheet(grid, flip=False, bm=B['wall%d' % q], uv_rect=(u0, 0.0, u1, 1.0))

    # stone ledges (a full ring at z = 0 and z = 3 — they hide the stratum seams and the tile joint)
    for zb in (0.0, 3.0):
        prof = [(R - 0.02, zb), (R - 0.16, zb + 0.02), (R - 0.18, zb + 0.10), (R - 0.12, zb + 0.14), (R - 0.02, zb + 0.14)]
        rr = []
        for r_, z_ in prof:
            rr.append([V(r_ * math.cos(2 * math.pi * i / 144), r_ * math.sin(2 * math.pi * i / 144), z_) for i in range(144)][::-1])
        mk.loft(rr, close_u=True, uv_u=(0, 12), uv_v=(0, 1), bm=B['stone'])

    # ------------------------------------------------------------------------------------------ helpers for placing things
    def new_T():
        return {k: bmesh.new() for k in M}

    def commit(T, deg, z0):
        mat = UP.mat_unit(R, deg, z0)
        for k, bm in T.items():
            if len(bm.faces):
                sol.append_bm(B[k], bm, mat)
            bm.free()

    def mat_at(f, a, d, z, yaw=0.0, tilt=0.0):
        m = Matrix.Translation(f.p(a, d, z)) @ Matrix.Rotation(yaw, 4, 'Z')
        if tilt:
            m = m @ Matrix.Rotation(tilt, 4, 'Y')
        return m

    def candle(T, f, a, d, z):
        """brass chamber-stick + wax candle with a tiny flame (flame joins the emissive lantern material)."""
        m = mat_at(f, a, d, z)
        UP.alathe(T['brass'], [(0.001, 0.0), (0.045, 0.0), (0.05, 0.008), (0.018, 0.02), (0.012, 0.05), (0.02, 0.06), (0.02, 0.07), (0.013, 0.075)],
                  METAL['brass'], m, seg=14, height_v=True)
        UP.alathe(T['pres'], [(0.001, 0.075), (0.014, 0.075), (0.014, 0.14), (0.001, 0.14)], PRC['wax'], m, seg=10)
        UP.alathe(T['glow'], [(0.001, 0.14), (0.007, 0.15), (0.005, 0.165), (0.001, 0.178)], FULL, m, seg=8, cap_bottom=False)

    # ---------- shelf contents
    JAM = ['strawberry', 'damson', 'gooseberry', 'marmalade', 'honey', 'blackcurrant', 'quince', 'greengage']

    def jam_jar(T, f, a, d, z, key, yaw):
        m = mat_at(f, a, d, z, yaw)
        UP.alathe(T['pres'], [(0.058, 0), (0.062, 0.02), (0.062, 0.14), (0.042, 0.168), (0.040, 0.176)], PRC[key], m, seg=10, cap_top=False, cap_bottom=False)
        UP.alathe(T['pres'], [(0.044, 0.170), (0.054, 0.190), (0.050, 0.215), (0.001, 0.222)], PRC['wax'], m, seg=8, cap_bottom=False)

    def bottle(T, f, a, d, z, key, yaw, tall=0.30):
        m = mat_at(f, a, d, z, yaw)
        UP.alathe(T['pres'], [(0.034, 0.0), (0.040, 0.03), (0.040, tall * 0.55), (0.022, tall * 0.85), (0.020, tall)], PRC[key], m, seg=8, cap_top=False, cap_bottom=False)
        UP.alathe(T['pres'], [(0.019, tall - 0.002), (0.022, tall + 0.006), (0.020, tall + 0.03), (0.001, tall + 0.032)], PRC['terracotta'], m, seg=8, cap_bottom=False)

    def pot(T, f, a, d, z, key, yaw, s=1.0):
        m = mat_at(f, a, d, z, yaw)
        UP.alathe(T['pres'], [(0.05 * s, 0.0), (0.072 * s, 0.07 * s), (0.075 * s, 0.13 * s), (0.05 * s, 0.19 * s), (0.04 * s, 0.21 * s), (0.05 * s, 0.225 * s)],
                  PRC[key], m, seg=10, cap_top=False, cap_bottom=False)

    def tin(T, f, a, d, z, key, yaw):
        m = mat_at(f, a, d, z, yaw)
        UP.alathe(T['pres'], [(0.05, 0.0), (0.052, 0.01), (0.052, 0.13), (0.05, 0.14), (0.001, 0.14)], PRC[key], m, seg=10, cap_bottom=False)

    def teapot(T, f, a, d, z, key, yaw):
        m = mat_at(f, a, d, z, yaw)
        UP.alathe(T['pres'], [(0.001, 0.0), (0.05, 0.0), (0.075, 0.04), (0.08, 0.08), (0.065, 0.12), (0.045, 0.135), (0.03, 0.14), (0.034, 0.15), (0.001, 0.16)], PRC[key], m, seg=12)
        sp = bmesh.new()                                         # spout
        sol.lathe(sp, [(0.014, 0.0), (0.020, 0.03), (0.012, 0.09), (0.008, 0.12)], (0, 0, 0), seg=8, cap_top=False, cap_bottom=False)
        UP.uv_const(sp, (0.5, 0.5))
        UP.place(T['pres'], sp, m @ Matrix.Translation((-0.065, 0.0, 0.05)) @ Matrix.Rotation(math.radians(-62), 4, 'Y'), PRC[key])
        hd = mk.tube([V(0.07, 0, 0.12), V(0.12, 0, 0.115), V(0.13, 0, 0.07), V(0.085, 0, 0.03)], rx=0.008, ry=0.008, n=6, up_hint=(0, 1, 0), cap_start=True, cap_end=True)
        UP.place(T['pres'], hd, m, PRC[key])

    def plate(T, f, a, d, z, key, tilt_deg=14):
        """a dinner plate standing on its rim against the back rail, face forward."""
        tmp = bmesh.new()
        sol.lathe(tmp, [(0.001, 0.0), (0.075, 0.0), (0.112, 0.012), (0.118, 0.022), (0.108, 0.022), (0.075, 0.008), (0.001, 0.008)], (0, 0, 0), seg=16)
        uvl = tmp.loops.layers.uv.active
        for fc in tmp.faces:
            for loop in fc.loops:
                p = loop.vert.co
                loop[uvl].uv = (0.25 + 0.5 * (p.x / 0.236 + 0.5), 0.12 + 0.76 * (p.y / 0.236 + 0.5))
        # lathe axis +Z -> face front (-X): rotate -90deg about Y, rest on the rim
        m = Matrix.Translation(f.p(a, d, z + 0.118)) @ Matrix.Rotation(math.radians(-90 + tilt_deg), 4, 'Y')
        UP.place(T['pres'], tmp, m, PRC[key])

    def small_stack(T, f, a, d, z, rects, wlen):
        """a couple of books lying flat (spine out)."""
        zz = z
        for sp in rects:
            th = rng.range(0.035, 0.06)
            f.box(T['books'], a - wlen / 2, a + wlen / 2, d - 0.20, d, zz, zz + th, FULL, skip=('px', 'nz'),
                  face_rect={'nx': (sp[0], 0.04, sp[1], 0.96), 'ny': (sp[0], 0.45, sp[1], 0.55), 'py': (sp[0], 0.45, sp[1], 0.55), 'pz': (paper_u, 0.1, 0.99, 0.9)},
                  face_rot=('nx',))
            zz += th
            wlen *= rng.range(0.88, 1.0)

    # ---------- the wall units
    def shelf_unit(spec):
        kind, deg, z0, w, h = spec['kind'], spec['deg'], spec['z0'], spec['w'], spec['h']
        depth = 0.46 if kind != 'china' else 0.38
        T = new_T()
        f = UP.UnitFrame()
        a0, a1 = -w / 2, w / 2
        wood = WC[spec['wood']]
        oak, dark = WC['oak'], WC['dark']
        BK = -0.13                                                                                           # sink into the (recessed) wall
        f.box(T['wood'], a0 - 0.05, a1 + 0.05, BK, depth + 0.06, 0.0, 0.06, oak)                              # platform
        for sa in (-1, 1):                                                                                   # stepped stone corbels
            a = sa * (w / 2 - 0.12)
            for k in range(4):
                f.box(T['stone'], a - 0.05, a + 0.05, BK, 0.10 + k * (depth - 0.10) / 3, -0.30 + k * 0.075, -0.225 + k * 0.075, (0, 0, 1, 1), scale=0.7)
        zb = 0.06
        f.box(T['wood'], a0, a0 + 0.04, BK, depth, zb, zb + h, wood)                                          # carcass
        f.box(T['wood'], a1 - 0.04, a1, BK, depth, zb, zb + h, wood)
        f.box(T['wood'], a0 - 0.03, a1 + 0.03, BK, depth + 0.03, zb + h, zb + h + 0.05, wood)
        f.box(T['wood'], a0 + 0.04, a1 - 0.04, BK, 0.025, zb, zb + h, dark)                                    # dark back panel
        if kind == 'books':
            n_shelf = 4
            for k in range(n_shelf + 1):
                zs = zb + k * h / n_shelf
                f.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.02, zs, zs + 0.022, oak)
                if k == n_shelf:
                    continue
                aa = a0 + 0.07
                stack_end = rng.next() < 0.35
                limit = a1 - 0.07 - (0.26 if stack_end else 0.0)
                while aa < limit - 0.03:
                    bw = rng.range(0.024, 0.05)
                    if aa + bw > limit:
                        break
                    bh = rng.range(0.22, 0.36)
                    bd = rng.range(0.20, 0.32)
                    sp = spines[int(min(rng.range(0, len(spines)), len(spines) - 0.01))]
                    mid = (sp[0] + sp[1]) / 2
                    f.box(T['books'], aa, aa + bw, depth - 0.05 - bd, depth - 0.05, zs + 0.022, zs + 0.022 + bh, FULL, skip=('px', 'nz'),
                          face_rect={'nx': (sp[0], 0.03, sp[1], 0.97), 'ny': (mid - 0.002, 0.4, mid + 0.002, 0.6), 'py': (mid - 0.002, 0.4, mid + 0.002, 0.6),
                                     'pz': (paper_u, 0.1, 0.99, 0.9)})
                    aa += bw + (0.02 if rng.next() < 0.05 else 0.002)
                if stack_end:
                    small_stack(T, f, limit + 0.13, depth - 0.05, zs + 0.022, [spines[int(min(rng.range(0, len(spines)), len(spines) - 0.01))] for _ in range(int(rng.range(2, 4)))], 0.24)
                elif rng.next() < 0.25:
                    candle(T, f, a1 - 0.12, depth * 0.55, zs + 0.022)
        elif kind == 'cupboard':
            n = 2
            panel = wood
            # shelves + a few jars behind the doors
            for k in (1, 2):
                zs = zb + k * h / 3
                f.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.04, zs, zs + 0.02, oak)
            for k in range(2 if spec['idx'] % 3 == 0 else 0):                                   # contents only where a door stands ajar
                zs = zb + k * h / 3 + 0.02 if k else zb
                aa = a0 + 0.14
                while aa < a1 - 0.14:
                    jam_jar(T, f, aa, depth * 0.5, zs, JAM[int(min(rng.range(0, 8), 7.99))], rng.range(-0.4, 0.4))
                    aa += 0.17
            ajar = spec['idx'] % 3 == 0
            for k in range(n):
                da0 = a0 + 0.04 + k * (w - 0.08) / n
                da1 = a0 + 0.04 + (k + 1) * (w - 0.08) / n
                Td = new_T()
                fd = UP.UnitFrame()
                fd.box(Td['wood'], da0 + 0.005, da1 - 0.005, depth - 0.03, depth, zb + 0.04, zb + h - 0.03, wood)
                fd.box(Td['wood'], da0 + 0.06, da1 - 0.06, depth, depth + 0.014, zb + 0.16, zb + h * 0.5 - 0.04, wood)
                fd.box(Td['wood'], da0 + 0.06, da1 - 0.06, depth, depth + 0.014, zb + h * 0.5 + 0.04, zb + h - 0.14, wood)
                kn = (da1 - 0.05) if k == 0 else (da0 + 0.05)
                UP.alathe(Td['brass'], [(0.004, 0), (0.007, 0.01), (0.011, 0.03), (0.014, 0.046), (0.004, 0.054)], METAL['brass'],
                          Matrix.Translation(fd.p(kn, depth + 0.012, zb + h * 0.5)) @ Matrix.Rotation(math.radians(-90), 4, 'Y'), seg=12)
                for zh in (0.28, 0.72):                                                             # hinge straps
                    hx = da0 + 0.0 if k == 0 else da1 - 0.0
                    fd.box(Td['brass'], min(hx, hx + (0.14 if k == 0 else -0.14)), max(hx, hx + (0.14 if k == 0 else -0.14)), depth + 0.0, depth + 0.006,
                           zb + h * zh - 0.012, zb + h * zh + 0.012, METAL['iron'], scale=0.4)
                if ajar and k == 0:                                                                  # the left door stands ajar
                    hinge = fd.p(da0, depth, 0)
                    mm = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(48), 4, 'Z') @ Matrix.Translation(-hinge)
                else:
                    mm = Matrix.Identity(4)
                for key_, bm_ in Td.items():
                    if len(bm_.faces):
                        sol.append_bm(T[key_], bm_, mm)
                    bm_.free()
        elif kind == 'jars':
            n_shelf = 3
            for k in range(n_shelf + 1):
                zs = zb + k * h / n_shelf
                f.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.02, zs, zs + 0.022, oak)
                if k == n_shelf:
                    continue
                aa = a0 + 0.12
                while aa < a1 - 0.12:
                    r_ = rng.next()
                    dd = depth * rng.range(0.40, 0.58)
                    zz = zs + 0.022
                    yaw = rng.range(-0.5, 0.5)
                    if r_ < 0.56:
                        jam_jar(T, f, aa, dd, zz, JAM[int(min(rng.range(0, 8), 7.99))], yaw)
                        aa += 0.165
                    elif r_ < 0.70:
                        bottle(T, f, aa, dd, zz, 'medicine', yaw, rng.range(0.24, 0.34))
                        aa += 0.105
                    elif r_ < 0.84:
                        pot(T, f, aa, dd, zz, ('willow', 'rose', 'green', 'terracotta')[int(min(rng.range(0, 4), 3.99))], yaw, rng.range(0.85, 1.15))
                        aa += 0.17
                    else:
                        tin(T, f, aa, dd, zz, 'tin_tea', yaw)
                        aa += 0.13
        else:                                                                                        # china dresser
            for k in range(4):
                zs = zb + k * h / 3.2 if k < 3 else zb + h - 0.02
                f.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.02, zs, zs + 0.022, oak)
                if k == 3:
                    continue
                zz = zs + 0.022
                f.box(T['wood'], a0 + 0.04, a1 - 0.04, depth - 0.07, depth - 0.045, zz, zz + 0.03, oak)        # plate rail
                if k == 2:
                    aa = a0 + 0.12
                    pk = ('willow', 'rose')
                    while aa < a1 - 0.12:
                        plate(T, f, aa, depth - 0.11, zz + 0.012, pk[int(min(rng.range(0, 2), 1.99))], rng.range(10, 18))
                        aa += 0.24
                else:
                    aa = a0 + 0.12
                    while aa < a1 - 0.12:
                        r_ = rng.next()
                        dd = depth * 0.5
                        if r_ < 0.35:
                            teapot(T, f, aa, dd, zz, ('willow', 'rose', 'green')[int(min(rng.range(0, 3), 2.99))], rng.range(-0.6, 0.6))
                            aa += 0.22
                        elif r_ < 0.65:
                            pot(T, f, aa, dd, zz, ('willow', 'rose')[int(min(rng.range(0, 2), 1.99))], 0.0, 0.8)
                            aa += 0.15
                        else:
                            tin(T, f, aa, dd, zz, 'tin_tea', rng.range(-0.4, 0.4))
                            aa += 0.13
        commit(T, deg, z0)

    for u in units:
        shelf_unit(u)

    # ---------- between the units: pictures, maps, niches, lanterns
    def hang_cords(T, f, w_, z_top, peg_z):
        for sa in (-1, 1):
            tb = mk.tube([f.p(sa * w_ / 2 * 0.9, 0.05, z_top), f.p(sa * w_ / 4, 0.045, (z_top + peg_z) / 2), f.p(0, 0.05, peg_z)], rx=0.003, ry=0.003, n=4, up_hint=(1, 0, 0),
                         cap_start=False, cap_end=False)
            UP.uv_const(tb, (METAL['iron'][0] + 0.1, METAL['iron'][1] + 0.1))
            sol.append_bm(T['brass'], tb)
            tb.free()
        UP.alathe(T['brass'], [(0.003, 0), (0.010, 0.0), (0.010, 0.012), (0.004, 0.03), (0.004, 0.05)], METAL['brass'],
                  Matrix.Translation(f.p(0, 0.0, peg_z)) @ Matrix.Rotation(math.radians(-90), 4, 'Y'), seg=8)

    def picture(g, key):
        T = new_T()
        f = UP.UnitFrame()
        w_, h_ = 0.62, 0.78
        fw = 0.06
        gold = METAL['brass']
        for (a0_, a1_, zz0, zz1) in ((-w_ / 2 - fw, w_ / 2 + fw, h_, h_ + fw), (-w_ / 2 - fw, w_ / 2 + fw, -fw, 0.0), (-w_ / 2 - fw, -w_ / 2, 0.0, h_), (w_ / 2, w_ / 2 + fw, 0.0, h_)):
            f.box(T['brass'], a0_, a1_, -0.13, 0.05, zz0, zz1, gold, scale=0.5)
        f.box(T['wood'], -w_ / 2, w_ / 2, -0.13, 0.02, 0.0, h_, WC['dark'])
        r = ART[key]
        ins = 0.012
        f.quad(T['art'], -w_ / 2, w_ / 2, 0.0, h_, 0.022, (r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins))
        hang_cords(T, f, w_ + 0.12, h_ + fw, h_ + 0.34)
        commit(T, g['deg'], g['z0'])

    def map_hang(g, key):
        T = new_T()
        f = UP.UnitFrame()
        w_, h_ = 0.95, 0.72
        f.box(T['wood'], -w_ / 2 - 0.03, w_ / 2 + 0.03, -0.13, 0.05, h_, h_ + 0.04, WC['oak'])
        f.box(T['wood'], -w_ / 2 - 0.03, w_ / 2 + 0.03, -0.13, 0.05, -0.04, 0.0, WC['oak'])
        f.box(T['wood'], -w_ / 2, w_ / 2, -0.13, 0.015, 0.0, h_, WC['dark'])
        r = ART[key]
        ins = 0.012
        f.quad(T['art'], -w_ / 2, w_ / 2, 0.0, h_, 0.02, (r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins))
        for sa in (-1, 1):
            UP.alathe(T['brass'], [(0.003, 0), (0.012, 0.0), (0.012, 0.01), (0.006, 0.03), (0.006, 0.06)], METAL['brass'],
                      Matrix.Translation(f.p(sa * (w_ / 2 + 0.03), 0.025, h_ + 0.02)) @ Matrix.Rotation(math.radians(-90), 4, 'Y') @ Matrix.Rotation(0, 4, 'Z'), seg=8)
        hang_cords(T, f, w_ + 0.06, h_ + 0.04, h_ + 0.30)
        commit(T, g['deg'], g['z0'])

    def lantern(g, idx):
        T = new_T()
        f = UP.UnitFrame()
        z_c = 0.62
        brass = METAL['brass']
        f.box(T['brass'], -0.05, 0.05, -0.13, 0.014, z_c - 0.09, z_c + 0.09, brass, scale=0.4)                         # back plate
        UP.alathe(T['brass'], [(0.013, 0.0), (0.015, 0.1), (0.012, 0.3), (0.012, 0.4)], brass, Matrix.Translation(f.p(0, -0.02, z_c)) @ Matrix.Rotation(math.radians(-90), 4, 'Y'), seg=8)
        c = f.p(0, 0.43, z_c)
        m = Matrix.Translation(c)
        UP.alathe(T['brass'], [(0.001, -0.16), (0.05, -0.16), (0.068, -0.14), (0.052, -0.11), (0.001, -0.11)], brass, m, seg=10)
        UP.alathe(T['glow'], [(0.044, -0.11), (0.075, -0.06), (0.082, 0.02), (0.068, 0.10), (0.024, 0.16)], FULL, m, seg=10, cap_bottom=False)
        UP.alathe(T['brass'], [(0.001, 0.15), (0.095, 0.15), (0.07, 0.19), (0.026, 0.24), (0.034, 0.255), (0.001, 0.265)], brass, m, seg=10)
        for k in range(4):
            a_ = k * math.pi / 2 + math.pi / 4
            UP.alathe(T['brass'], [(0.004, -0.11), (0.004, 0.15)], brass, Matrix.Translation(c + Vector((math.cos(a_) * 0.078, math.sin(a_) * 0.078, 0.0))), seg=5)
        UP.alathe(T['brass'], [(0.001, 0.26), (0.016, 0.26), (0.016, 0.275), (0.001, 0.29)], brass, m, seg=8)      # ring
        commit(T, g['deg'], g['z0'])
        e = bpy.data.objects.new('LAMP_%d' % idx, None)
        bpy.context.scene.collection.objects.link(e)
        ang = math.radians(-g['deg'])
        e.location = V((R - 0.43) * math.cos(ang), (R - 0.43) * math.sin(ang), g['z0'] + z_c)
        e['lightColor'] = '#F5C26B'
        e['intensity'] = 1.0
        e['range'] = 6.0

    def niche(g):
        """arched stone surround, a stone sill and a candle burning in the recess painted on the wall."""
        T = new_T()
        f = UP.UnitFrame()
        w_, h_ = 0.50, 0.74
        r = w_ / 2
        zc = h_ - r
        th, dp = 0.07, 0.055
        st = (0, 0, 1, 1)
        f.box(T['stone'], -r - th, -r, -0.13, dp, 0.0, zc, st, scale=0.8)
        f.box(T['stone'], r, r + th, -0.13, dp, 0.0, zc, st, scale=0.8)
        f.box(T['stone'], -r - th - 0.03, r + th + 0.03, -0.13, 0.17, -0.05, 0.0, st, scale=0.8)                  # sill
        N = 12
        uvf = lambda p_: (0.25 + 0.1 * ((p_.y * 1.7) % 1.0), 0.25 + 0.1 * ((p_.z * 1.7) % 1.0))
        for i in range(N):
            t0, t1 = math.pi - math.pi * i / N, math.pi - math.pi * (i + 1) / N
            P = lambda rr, t: (rr * math.cos(t), zc + rr * math.sin(t))
            (a_i0, z_i0), (a_o0, z_o0), (a_o1, z_o1), (a_i1, z_i1) = P(r, t0), P(r + th, t0), P(r + th, t1), P(r, t1)
            UP.qface(T['stone'], [f.p(a_i0, dp, z_i0), f.p(a_o0, dp, z_o0), f.p(a_o1, dp, z_o1), f.p(a_i1, dp, z_i1)], (-1, 0, 0), uvf)
            # inner reveal faces the niche centre
            cen = f.p(0.0, 0.0, zc)
            mid = (f.p(a_i0, 0.0, z_i0) + f.p(a_i1, dp, z_i1)) / 2
            UP.qface(T['stone'], [f.p(a_i0, 0.0, z_i0), f.p(a_i0, dp, z_i0), f.p(a_i1, dp, z_i1), f.p(a_i1, 0.0, z_i1)], (cen - mid), uvf)
        candle(T, f, 0.0, 0.10, 0.0)
        # a couple of little bottles beside the candle
        bottle(T, f, -0.12, 0.09, 0.0, 'medicine', 0.4, 0.16)
        pot(T, f, 0.13, 0.09, 0.0, 'willow', 0.3, 0.55)
        commit(T, g['deg'], g['z0'])

    pic_keys = ['lady', 'gent', 'meadow', 'seascape', 'orchard', 'still', 'moon', 'cat', 'boy', 'botanical', 'sampler']
    map_keys = ['county', 'sea', 'star', 'treasure', 'world']
    lamp_i = 0
    ip = im = 0
    for g in gaps:
        if g['kind'] == 'picture':
            picture(g, pic_keys[ip % len(pic_keys)])
            ip += 1
        elif g['kind'] == 'map':
            map_hang(g, map_keys[im % len(map_keys)])
            im += 1
        elif g['kind'] == 'lantern':
            lamp_i += 1
            gg = dict(g)
            gg['z0'] = g['z0'] + 0.0
            lantern(g, lamp_i)
        else:
            niche(g)

    # ------------------------------------------------------------------------------------------ small open cupboard for the jar gag
    T = new_T()
    c0, c1, ch, cd = -0.26, 0.26, 0.62, 0.30
    wood = WC['oak']
    sol_box = lambda lo, hi: UP.abox(T['wood'], lo, hi, wood, scale=0.8)
    sol_box((c0, -cd / 2, 0.0), (c1, cd / 2, 0.04))
    sol_box((c0, -cd / 2, ch), (c1, cd / 2, ch + 0.04))
    sol_box((c0, -cd / 2, 0.0), (c0 + 0.035, cd / 2, ch + 0.04))
    sol_box((c1 - 0.035, -cd / 2, 0.0), (c1, cd / 2, ch + 0.04))
    UP.abox(T['wood'], (c0, cd / 2 - 0.02, 0.0), (c1, cd / 2, ch + 0.04), WC['dark'], scale=0.8)
    sol_box((c0 + 0.035, -cd / 2, 0.30), (c1 - 0.035, cd / 2 - 0.02, 0.322))
    UP.alathe(T['brass'], [(0.004, 0), (0.008, 0.01), (0.012, 0.03), (0.004, 0.044)], METAL['brass'],
              Matrix.Translation((c1 - 0.05, -cd / 2, ch * 0.5)) @ Matrix.Rotation(math.radians(90), 4, 'X'), seg=10)
    for k, bm in T.items():
        if len(bm.faces):
            mk.bm_to_object(bm, 'S3_ReturnCupboard' if k == 'wood' else f'S3_ReturnCupboard_{k}', M[k])
        else:
            bm.free()

    objs = []
    for key, bm in B.items():
        if len(bm.faces) == 0:
            bm.free()
            continue
        o = mk.bm_to_object(bm, 'S3_WellSegment_' + key.capitalize(), M[key])
        objs.append(o)
    print('[build_ch1_s3_well] triangles:', sum(mk.triangle_count(o) for o in objs), 'objects:', len(objs), {o.name.replace('S3_WellSegment_', ''): mk.triangle_count(o) for o in objs})

    for name, loc, props in (('SPAWN_S3', V(0, 0, 6.0), {'targetState': 'S3_FALL'}),):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        for k, v in props.items():
            e[k] = v

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp_out = OUT + '.tmp.glb'
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=tmp_out, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=86,
                              export_yup=True, export_apply=False)
    os.replace(tmp_out, OUT)
    print(f'[build_ch1_s3_well] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s3_well.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'ch1_s3_well.glb'))


if __name__ == '__main__':
    main()
