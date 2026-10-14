"""
Build the Chapter 1 / S3 well — "Down, down, down … she looked at the sides of the well, and noticed that they were filled with
cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs" — and export
public/assets/models/ch1_s3_well.glb.

    python3 tools/blender/build_ch1_s3_well.py           # env S3_OUT=... to write elsewhere

The GLB holds ONE seamless 6 m segment of the shaft (`S3_WellSegment`, z ∈ [0, 6], radius 4.0 m): brick wall with stone bands, and
shelving units standing on corbels (bookshelves with hundreds of books, cupboards, jar shelves, rolled maps, framed pictures,
hanging lanterns). The engine stacks four copies and scrolls them upward at fall speed, so every feature sits inside the segment
and the wall relief is periodic (z = 0 and z = 6 are identical).  Also `S3_ReturnCupboard` — the small open cupboard of the
marmalade-jar gag.  Axes: Blender z = game y; game (x, z) = Blender (x, -z).
"""
import math
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V, lerp  # noqa: E402
from world import interior as I  # noqa: E402
from build_ch1_s5_hall import Wall  # noqa: E402

OUT = os.environ.get('S3_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s3_well.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'ch1_s3_well.glb')

R = 4.0            # shaft radius (m): the follow camera sits ~3.2 m behind Alice, inside the shaft
SEG_H = 6.0        # one periodic segment
FRONT = {(-1, 0): 'nx'}   # unit-local frame faces -X (towards the shaft axis)


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

    M = {
        'brick': tex('Brick', I.brick(2048, 1024, rows=16, per_row=16, seed=3, moss=0.45, damp=0.6), 0.95),
        'stone': tex('Stone', I.plaster(512, 512, base='#9C978A', seed=44), 0.9),
        'wood': tex('Wood', I.planks(1024, 1024, n=6, base='#6A4326', seed=23), 0.55),
        'books': tex('Books', I.books(2048, 256), 0.7),
        'brass': tex('Brass', I.brass(256, 256), 0.35),
        'porcelain': tex('Porcelain', I.porcelain(256, 256), 0.3),
        'map': tex('Map', I.parchment_map(512, 512, seed=9), 0.9),
        'map2': tex('Map2', I.parchment_map(512, 512, seed=31), 0.9),
        'portrait': tex('Portrait', I.painting(512, 640, 'portrait', seed=14), 0.6),
        'landscape': tex('Landscape', I.painting(512, 640, 'landscape', seed=19), 0.6),
        'velvet': tex('Cloth', I.velvet(256, 256, base='#2E4A5E'), 0.9),
        'label': tex('Label', I.books(512, 128, seed=61), 0.8),
        'glow': flat('LanternGlow', '#FFE7A8', 0.2, emissive='#FFC966'),
        'jam': flat('Marmalade', '#E0892A', 0.3),
        'cork': flat('Cork', '#B98A55', 0.9),
        'dark': flat('Dark', '#1C1410', 0.9),
    }
    B = {k: bmesh.new() for k in M}

    # ------------------------------------------------------------------------------------------ the shaft wall (seamless)
    cols, rows = 128, 60
    rings = []
    for j in range(rows + 1):
        z = SEG_H * j / rows
        ring = []
        for i in range(cols):
            th = 2 * math.pi * i / cols
            # periodic lumpiness: integer cycles around and along so the segment tiles in both directions
            d = (0.045 * math.sin(7 * th + 2 * math.pi * 2 * z / SEG_H) + 0.030 * math.sin(13 * th - 2 * math.pi * 5 * z / SEG_H + 1.3)
                 + 0.020 * math.sin(29 * th + 2 * math.pi * 11 * z / SEG_H))
            r = R + d
            ring.append(V(r * math.cos(th), r * math.sin(th), z))
        rings.append(ring[::-1])                  # CW ring: faces point into the shaft
    mk.loft(rings, close_u=True, cap_start=False, cap_end=False, uv_u=(0, 9), uv_v=(0, SEG_H / 1.2), bm=B['brick'])

    # stone bands (a full ring every 3 m) and mossy corbel course at the seam
    for zb in (0.0, 3.0):
        prof = [(R - 0.02, zb), (R - 0.16, zb + 0.02), (R - 0.18, zb + 0.10), (R - 0.12, zb + 0.14), (R - 0.02, zb + 0.14)]
        rr = []
        for r_, z_ in prof:
            rr.append([V(r_ * math.cos(2 * math.pi * i / 144), r_ * math.sin(2 * math.pi * i / 144), z_) for i in range(144)][::-1])
        mk.loft(rr, close_u=True, uv_u=(0, 24), uv_v=(0, 1), bm=B['stone'])

    # ------------------------------------------------------------------------------------------ shelving units (built on a local +X wall, then rotated)
    def unit_frame():
        return Wall('U', (R, 0, 0), (-1, 0, 0))

    def commit(T, deg):
        mat = Matrix.Rotation(math.radians(-deg), 4, 'Z')
        for k, bm in T.items():
            if len(bm.faces):
                sol.append_bm(B[k], bm, mat)
            bm.free()

    def new_T():
        return {k: bmesh.new() for k in M}

    def corbels(T, w, a_c, z, depth):
        for sa in (-1, 1):
            a = a_c + sa * (w / 2 - 0.12)
            for k in range(4):                     # stepped bracket
                w_.box(T['stone'], a - 0.05, a + 0.05, 0.0, 0.10 + k * (depth - 0.10) / 3, z - 0.30 + k * 0.075, z - 0.225 + k * 0.075, tile=(1.5, 1.5))

    def shelf_unit(kind, deg, z0, w=1.25, h=1.7, depth=0.46):
        T = new_T()
        global w_
        w_ = unit_frame()
        a_c = 0.0
        a0, a1 = a_c - w / 2, a_c + w / 2
        z_base = z0 + 0.0
        # plank platform on corbels
        w_.box(T['wood'], a0 - 0.05, a1 + 0.05, 0.0, depth + 0.06, z_base, z_base + 0.06, tile=(1.0, 1.0))
        corbels(T, w, a_c, z_base, depth)
        zb = z_base + 0.06
        # carcass
        w_.box(T['wood'], a0, a0 + 0.04, 0.0, depth, zb, zb + h)
        w_.box(T['wood'], a1 - 0.04, a1, 0.0, depth, zb, zb + h)
        w_.box(T['wood'], a0 - 0.03, a1 + 0.03, 0.0, depth + 0.03, zb + h, zb + h + 0.05)
        w_.box(T['wood'], a0, a1, 0.0, 0.02, zb, zb + h)
        front = FRONT[(-1, 0)]
        if kind == 'books':
            n_shelf = 4
            for k in range(n_shelf + 1):
                zs = zb + k * h / n_shelf
                w_.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.02, zs, zs + 0.022)
                if k == n_shelf:
                    continue
                aa = a0 + 0.06
                while aa < a1 - 0.08:
                    bw = rng.range(0.022, 0.05)
                    if aa + bw > a1 - 0.06:
                        break
                    bh = rng.range(0.22, 0.36)
                    bd = rng.range(0.22, 0.34)
                    u0 = rng.range(0.0, 0.97)
                    lean = rng.range(0, 1) < 0.06
                    w_.box(T['books'], aa, aa + bw, depth - 0.05 - bd, depth - 0.05, zs + 0.022, zs + 0.022 + bh,
                           face_uv={front: (u0, 0.02, u0 + 0.03, 0.98)}, skip_back=False)
                    aa += bw + (0.012 if lean else 0.002)
        elif kind == 'cupboard':
            n = 2
            for k in range(n):
                da0 = a0 + 0.04 + k * (w - 0.08) / n
                da1 = a0 + 0.04 + (k + 1) * (w - 0.08) / n
                w_.box(T['wood'], da0 + 0.01, da1 - 0.01, depth - 0.03, depth, zb + 0.10, zb + h - 0.06, tile=(0.8, 0.8))
                w_.box(T['wood'], da0 + 0.07, da1 - 0.07, depth, depth + 0.012, zb + 0.20, zb + h - 0.16, tile=(0.8, 0.8))
                kn = (da1 - 0.055) if k == 0 else (da0 + 0.055)
                sol.lathe(T['brass'], [(0.004, 0), (0.007, 0.01), (0.011, 0.03), (0.014, 0.046), (0.004, 0.054)], w_.p(kn, depth + 0.01, zb + h * 0.5), seg=12, axis=w_.n)
            w_.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.02, zb + h * 0.5 - 0.01, zb + h * 0.5 + 0.01)
        elif kind == 'jars':
            n_shelf = 3
            for k in range(n_shelf + 1):
                zs = zb + k * h / n_shelf
                w_.box(T['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.02, zs, zs + 0.022)
                if k == n_shelf:
                    continue
                aa = a0 + 0.14
                while aa < a1 - 0.14:
                    kind_j = rng.range(0, 1)
                    base = w_.p(aa, depth * rng.range(0.42, 0.62), zs + 0.022)
                    if kind_j < 0.45:                                              # marmalade jar (orange fill, cream label, paper lid)
                        sol.lathe(T['jam'], [(0.001, 0), (0.058, 0.0), (0.062, 0.02), (0.062, 0.14), (0.056, 0.16), (0.040, 0.168), (0.040, 0.178)], base, seg=18)
                        sol.lathe(T['label'], [(0.0635, 0.045), (0.0635, 0.105)], base, seg=18, cap_bottom=False, cap_top=False, uv_u=(0, 0.2))
                        sol.lathe(T['cork'], [(0.043, 0.176), (0.043, 0.19), (0.001, 0.19)], base, seg=14)
                        aa += 0.17
                    elif kind_j < 0.75:                                            # porcelain pot
                        sol.lathe(T['porcelain'], [(0.001, 0), (0.05, 0.0), (0.07, 0.07), (0.075, 0.13), (0.05, 0.19), (0.04, 0.21), (0.05, 0.225)], base, seg=20, cap_top=False)
                        aa += 0.19
                    else:                                                          # tall bottle
                        sol.lathe(T['jam'], [(0.001, 0), (0.035, 0.0), (0.04, 0.03), (0.04, 0.17), (0.02, 0.22), (0.016, 0.30), (0.02, 0.31)], base, seg=14, cap_top=False)
                        aa += 0.12
        commit(T, deg)

    def map_hang(deg, z0, key='map', w=0.95, h=0.72):
        T = new_T()
        global w_
        w_ = unit_frame()
        za = z0 + h
        w_.box(T['wood'], -w / 2 - 0.03, w / 2 + 0.03, 0.0, 0.05, za, za + 0.04)
        w_.box(T['wood'], -w / 2 - 0.03, w / 2 + 0.03, 0.0, 0.05, z0 - 0.04, z0)
        w_.quad(T[key], -w / 2, w / 2, z0, za, 0.02, ((0, 0), (1, 0), (1, 1), (0, 1)))
        for sa in (-1, 1):
            sol.lathe(T['brass'], [(0.003, 0), (0.012, 0.0), (0.012, 0.01), (0.006, 0.03), (0.006, 0.06)], w_.p(sa * w / 2 * 0.7, 0.02, za + 0.2), seg=10, axis=w_.n)
            w_.box(T['dark'], sa * w / 2 * 0.7 - 0.004, sa * w / 2 * 0.7 + 0.004, 0.04, 0.06, za + 0.04, za + 0.20)
        commit(T, deg)

    def picture_hang(deg, z0, kind='portrait', w=0.62, h=0.78):
        T = new_T()
        global w_
        w_ = unit_frame()
        fw = 0.06
        for (a0_, a1_, zz0, zz1) in ((-w / 2 - fw, w / 2 + fw, z0 + h, z0 + h + fw), (-w / 2 - fw, w / 2 + fw, z0 - fw, z0),
                                     (-w / 2 - fw, -w / 2, z0, z0 + h), (w / 2, w / 2 + fw, z0, z0 + h)):
            w_.box(T['brass'], a0_, a1_, 0.0, 0.05, zz0, zz1, tile=(1.4, 1.4))
        w_.box(T['dark'], -w / 2, w / 2, 0.0, 0.02, z0, z0 + h)
        w_.quad(T[kind], -w / 2, w / 2, z0, z0 + h, 0.022, ((0.03, 0.03), (0.97, 0.03), (0.97, 0.97), (0.03, 0.97)))
        commit(T, deg)

    lamp_nodes = []

    def lantern(deg, z0, idx):
        T = new_T()
        global w_
        w_ = unit_frame()
        arm = [(0.012, 0.0), (0.014, 0.1), (0.012, 0.3), (0.012, 0.42)]
        sol.lathe(T['brass'], arm, w_.p(0, 0.0, z0), seg=8, axis=w_.n)
        w_.box(T['brass'], -0.05, 0.05, 0.0, 0.012, z0 - 0.07, z0 + 0.07, tile=(2, 2))
        c = w_.p(0, 0.42, z0 - 0.02)
        sol.lathe(T['brass'], [(0.001, 0), (0.05, 0.0), (0.065, 0.02), (0.05, 0.05), (0.001, 0.05)], c + V(0, 0, -0.16), seg=14)
        sol.lathe(T['glow'], [(0.045, 0.0), (0.075, 0.05), (0.08, 0.13), (0.065, 0.21), (0.02, 0.27)], c + V(0, 0, -0.11), seg=16, cap_bottom=False)
        sol.lathe(T['brass'], [(0.001, 0), (0.09, 0.0), (0.06, 0.04), (0.02, 0.09), (0.001, 0.10)], c + V(0, 0, 0.16), seg=14)
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            sol.lathe(T['brass'], [(0.004, 0), (0.004, 0.26)], c + V(math.cos(a) * 0.074, math.sin(a) * 0.074, -0.10), seg=5)
        commit(T, deg)
        e = bpy.data.objects.new(f'LAMP_{idx}', None)
        bpy.context.scene.collection.objects.link(e)
        ang = math.radians(-deg)
        e.location = V((R - 0.42) * math.cos(ang), (R - 0.42) * math.sin(ang), z0 + 0.0)
        e['lightColor'] = '#F5C26B'
        e['intensity'] = 1.0
        e['range'] = 6.0
        lamp_nodes.append(e)

    # the layout — azimuth in degrees (game: x = cos, z = sin, so 270 ≈ the far wall behind Alice), height in the 6 m segment
    #                 kind        azimuth   z0
    layout = [
        ('books',    228, 0.20), ('cupboard', 258, 0.25), ('jars', 288, 0.20), ('books', 318, 0.30),
        ('jars',     210, 2.15), ('books',    240, 2.10), ('cupboard', 272, 2.30), ('books', 302, 2.05), ('cupboard', 332, 2.20),
        ('cupboard', 222, 4.10), ('jars',     252, 4.05), ('books', 282, 4.15), ('jars', 312, 4.10), ('books', 342, 4.20),
        ('books',     18, 0.50), ('jars',      60, 1.90), ('cupboard', 110, 0.70), ('books', 150, 2.40), ('books', 186, 4.30),
        ('jars',      96, 4.0), ('cupboard', 20, 3.6),
    ]
    for kind, deg, z0 in layout:
        shelf_unit(kind, deg, z0 + rng.range(-0.05, 0.05), w=rng.range(1.05, 1.3), h=rng.range(1.45, 1.7))
    for deg, z0, key in ((241, 1.12, 'map'), (265, 1.45, 'map2'), (297, 1.25, 'map'), (232, 3.55, 'map2'), (290, 3.6, 'map'), (325, 3.3, 'map2'), (60, 3.5, 'map'),
                         (135, 1.2, 'map2'), (200, 5.0, 'map')):
        map_hang(deg, z0, key)
    for deg, z0, kind in ((246, 3.15, 'portrait'), (276, 3.3, 'landscape'), (309, 3.1, 'portrait'), (336, 1.2, 'landscape'), (216, 1.15, 'portrait'),
                          (80, 3.2, 'portrait'), (165, 3.3, 'landscape'), (300, 5.0, 'landscape')):
        picture_hang(deg, z0, kind)
    for i, (deg, z0) in enumerate(((236, 5.2), (270, 1.8), (304, 5.3), (350, 2.8), (200, 3.0), (120, 5.0), (30, 5.1), (300, 3.0)), start=1):
        lantern(deg, z0, i)

    # ------------------------------------------------------------------------------------------ small open cupboard for the jar gag
    T = new_T()
    c0, c1, ch, cd = -0.26, 0.26, 0.62, 0.30
    sol.box(T['wood'], (c0, -cd / 2, 0.0), (c1, cd / 2, 0.04), (1, 1))
    sol.box(T['wood'], (c0, -cd / 2, ch), (c1, cd / 2, ch + 0.04), (1, 1))
    sol.box(T['wood'], (c0, -cd / 2, 0.0), (c0 + 0.035, cd / 2, ch + 0.04), (1, 1))
    sol.box(T['wood'], (c1 - 0.035, -cd / 2, 0.0), (c1, cd / 2, ch + 0.04), (1, 1))
    sol.box(T['wood'], (c0, cd / 2 - 0.02, 0.0), (c1, cd / 2, ch + 0.04), (1, 1))
    sol.box(T['wood'], (c0 + 0.035, -cd / 2, 0.30), (c1 - 0.035, cd / 2 - 0.02, 0.322), (1, 1))
    sol.lathe(T['brass'], [(0.004, 0), (0.008, 0.01), (0.012, 0.03), (0.004, 0.044)], V(c1 - 0.05, -cd / 2 - 0.0, ch * 0.5), seg=10, axis=(0, -1, 0))
    for k, bm in T.items():
        if len(bm.faces):
            o = mk.bm_to_object(bm, 'S3_ReturnCupboard' if k == 'wood' else f'S3_ReturnCupboard_{k}', M[k])
        else:
            bm.free()

    objs = []
    for key, bm in B.items():
        if len(bm.faces) == 0:
            bm.free()
            continue
        o = mk.bm_to_object(bm, 'S3_WellSegment_' + key.capitalize(), M[key])
        objs.append(o)
    print('[build_ch1_s3_well] triangles:', sum(mk.triangle_count(o) for o in objs))

    for name, loc, props in (
        ('SPAWN_S3', V(0, 0, 6.0), {'targetState': 'S3_FALL'}),
    ):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        for k, v in props.items():
            e[k] = v

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=86,
                              export_yup=True, export_apply=False)
    print(f'[build_ch1_s3_well] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s3_well.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'ch1_s3_well.glb'))


if __name__ == '__main__':
    main()
