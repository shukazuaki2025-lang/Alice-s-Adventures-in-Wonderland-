"""
Build the Chapter 1 / S4 passage — "another long passage… she was just in time to hear it say, as it turned a corner,
'Oh my ears and whiskers, how late it's getting!'" — and export public/assets/models/ch1_s4_passage.glb.

    python3 tools/blender/build_ch1_s4_passage.py        # env S4_OUT=... to write elsewhere, UG_CACHE=dir to cache painted atlases

A barrel-vaulted burrow corridor, game x in [-5, 21], 4 m wide (the SceneLoader walk bounds are +-1.5 m, so the camera can sit inside it):
ten 2.5 m BAYS between stone arch ribs, each bay skinned with ONE painted image (red brick dado / yellow stock / whitewash / blue brick up both
sides, an earth-strata vault with stones, roots, moss and toadstools above, lantern light baked in), an encaustic-tile runner between
flagstones, a stone string course, brass wall lanterns, pictures / shelves of jars on the dado, roots hanging from the crown, rain puddles that
reflect the lamps, a glowing arched doorway at the far end and a blank end wall at the near end.
The corridor is single-sided (a camera that drifts outside the wall sees straight in - the walls are a cut-away), so the whole set sits inside
a large painted earth cavern: whichever way the orbit camera looks there is painted earth, never empty background.
Axes: game (x, y-up, z) -> Blender (x, -z, y-up); the corridor runs along +X.
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
from PIL import Image  # noqa: E402

from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V, lerp  # noqa: E402
from world import painters  # noqa: E402
from world import underground_paint as UP  # noqa: E402
from world import underground_passage as PS  # noqa: E402
from world import underground_props as PR  # noqa: E402

OUT = os.environ.get('S4_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s4_passage.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'ch1_s4_passage.glb')
CACHE = os.environ.get('UG_CACHE')

X0, X1 = -5.0, 21.0
HALF_W, SPRING, RISE, BAY = PS.HALF_W, PS.SPRING, PS.RISE, PS.BAY
RIB_X = [-4.0 + BAY * k for k in range(11)]
BAY_VARIANTS = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B']                  # even bays hold a lantern (lit), odd ones do not
LAMP_X = (-3.0, 2.0, 7.0, 12.0, 17.0)
LAMP_H = 1.5
BAY_PPM = 300
SEC = PS.SECTION


def cached(name, fn):
    if CACHE:
        path = os.path.join(CACHE, name + '.npy')
        if os.path.exists(path):
            return UP.from_u8(np.load(path))
        arr = fn()
        os.makedirs(CACHE, exist_ok=True)
        np.save(path, UP.to_u8(arr))
        return arr
    return fn()


def G(x, z, h=0.0):
    return V(x, -z, h)


def sec_point(i):
    return SEC['y'][i], SEC['z'][i], SEC['ny'][i], SEC['nz'][i], SEC['s'][i]


def main():
    mk.reset_scene()
    rng = mk.Rng(1865)

    def tex(name, arr, rough=0.92, double=False):
        img = paint.to_image('T_S4_' + name, arr)
        return paint.make_material('M_S4_' + name, img, roughness=rough, double_sided=double)

    def flat(name, hexc, rough=0.8, emissive=None):
        c = paint.srgb_to_linear(paint.hex_rgb(hexc))
        em = None
        if emissive:
            e = paint.srgb_to_linear(paint.hex_rgb(emissive))
            em = (float(e[0]), float(e[1]), float(e[2]))
        return paint.make_material('M_S4_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, emissive=em)

    M = {}
    for v in 'ABCD':
        M['bay' + v] = tex('Bay' + v, PS.to_image_order(cached('bay' + v, lambda v=v: PS.bay_texture(v, ppm=BAY_PPM, seed=4000 + ord(v)))), 0.95)
    M['flag'] = tex('Flagstone', PS.to_image_order(cached('floor', lambda: PS.floor_texture(ppm=230))), 0.8)
    for kind in ('lime', 'brick', 'slate'):
        M['rib' + kind] = tex('Rib_' + kind, cached('rib_' + kind, lambda kind=kind: PS.rib_texture(kind)), 0.9)
    M['endwall'] = tex('EndWall', PS.to_image_order(cached('endwall', lambda: PS.end_wall_texture())), 0.95)
    M['endwall2'] = tex('EndWallDoor', PS.to_image_order(cached('endwall2', lambda: PS.end_wall_texture(seed=5301, door_glow=True))), 0.95)
    M['stone'] = tex('Stone', cached('stone', lambda: PR.stone_ledge(512)), 0.9)
    M['brass'] = tex('Brass', cached('metal', lambda: PR.metal_atlas(256)), 0.4)
    M['wood'] = tex('Wood', cached('wood', lambda: PR.wood_atlas(256)), 0.6)
    M['art'] = tex('Art', cached('art', lambda: PR.art_atlas(256)), 0.6)
    pres_arr, pres_idx = PR.preserves_atlas()
    M['pres'] = tex('Pres', cached('pres', lambda: np.asarray(Image.fromarray(UP.to_u8(pres_arr), 'RGB').resize((pres_arr.shape[1] // 2, pres_arr.shape[0] // 2), Image.LANCZOS), np.float32) / 255.0), 0.4)
    M['root'] = tex('Roots', cached('bark', lambda: painters.bark(512)), 0.95)
    M['water'] = tex('Puddle', cached('puddle', PS.puddle_texture), 0.15)
    M['cavwall'] = tex('CavernWall', cached('cavwall', lambda: PS.cavern_wall(1024, 512)), 0.98)
    M['cavground'] = tex('CavernGround', cached('cavground', lambda: PS.cavern_ground(1024)), 0.98)
    M['glow'] = flat('LanternGlow', '#FFE7A8', 0.2, emissive='#FFC966')
    M['door'] = flat('DoorGlow', '#FFE9B0', 0.6, emissive='#FFD27A')
    B = {k: bmesh.new() for k in M}

    WC = {n: PR.cell_rect(i, 4, 2) for n, i in PR.WOOD_CELLS.items()}
    PRC = {k: PR.cell_rect(i, 4, 4) for k, i in pres_idx.items()}
    ART = {k: PR.cell_rect(i, 4, 4) for i, k in enumerate(PR.ART_KEYS)}
    METAL = {'brass': PR.cell_rect(0, 2, 2), 'copper': PR.cell_rect(1, 2, 2), 'bronze': PR.cell_rect(2, 2, 2), 'iron': PR.cell_rect(3, 2, 2)}
    FULL = (0.0, 0.0, 1.0, 1.0)

    # ---------------------------------------------------------------------------------------- the skin: ten painted bays
    n_s = len(SEC['s'])
    step = max(1, int(round(0.09 / (SEC['s'][1] - SEC['s'][0]))))
    idxs = list(range(0, n_s, step))
    if idxs[-1] != n_s - 1:
        idxs.append(n_s - 1)
    L = PS.SEC_L

    def relief(x, s):
        """the wall surface is never proud of the nominal section, only recessed (so ribs / lanterns hung on it are never swallowed)"""
        return 0.045 * (0.5 + 0.25 * math.sin(x * 2.1 + 1.7 * math.sin(s * 3.1)) + 0.25 * math.sin(x * 0.9 - s * 4.3 + 1.0))

    def skin(bm, xa, xb, ua, ub):
        uvl = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
        rows = max(2, int(round((xb - xa) / 0.25)))
        grid = []
        for j in range(rows + 1):
            x = lerp(xa, xb, j / rows)
            row = []
            for i in idxs:
                y, z, ny, nz, s = sec_point(i)
                d = relief(x, s)
                row.append((V(x, y - ny * d, z - nz * d), s))
            grid.append(row)
        for j in range(rows):
            for k in range(len(idxs) - 1):
                p00, s0 = grid[j][k]
                p01, s1 = grid[j][k + 1]
                p10, _ = grid[j + 1][k]
                p11, _ = grid[j + 1][k + 1]
                i_mid = idxs[k]
                want = (0.0, SEC['ny'][i_mid], SEC['nz'][i_mid])
                u0 = lerp(ua, ub, j / rows)
                u1 = lerp(ua, ub, (j + 1) / rows)
                v0, v1 = s0 / L, s1 / L
                uvs = {tuple(p00): (u0, v0), tuple(p01): (u0, v1), tuple(p11): (u1, v1), tuple(p10): (u1, v0)}
                fc = UP.qface(bm, [p00, p10, p11, p01], want, lambda co, uvs=uvs: uvs[tuple(co)] if tuple(co) in uvs else (0, 0))
                if fc is None:
                    continue

    for k in range(10):
        skin(B['bay' + BAY_VARIANTS[k]], RIB_X[k], RIB_X[k + 1], 0.0, 1.0)
    skin(B['bayB'], X0, RIB_X[0], 0.6, 1.0)                                                    # lead-in before the first rib

    # ---------------------------------------------------------------------------------------- floor: one painted sheet (10 m texture repeats)
    FZ = HALF_W
    fl = B['flag']
    uvl = fl.loops.layers.uv.get('UVMap') or fl.loops.layers.uv.new('UVMap')
    n_f = 26
    verts = [[fl.verts.new(V(X0 + 26.0 * i / n_f, -FZ + 2 * FZ * j / 4, 0.0)) for j in range(5)] for i in range(n_f + 1)]
    for i in range(n_f):
        for j in range(4):
            f_ = fl.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
            if f_.normal.z < 0 if f_.normal.length else False:
                f_.normal_flip()
            for loop in f_.loops:
                co = loop.vert.co
                loop[uvl].uv = ((co.x - X0) / 10.0, (-co.y + FZ) / (2 * FZ))
    fl.normal_update()
    for f_ in fl.faces:
        if f_.normal.z < 0:
            f_.normal_flip()

    # ---------------------------------------------------------------------------------------- stone ribs (voussoirs)
    rib_kinds = ['lime', 'brick', 'lime', 'slate', 'lime', 'brick', 'lime', 'slate', 'lime', 'brick', 'lime']
    for k, rx in enumerate(RIB_X):
        bm = B['rib' + rib_kinds[k]]
        pts_w = [(sec_point(i)) for i in idxs]
        pts_i = [(y + ny * 0.15, z + nz * 0.15, ny, nz, s) for (y, z, ny, nz, s) in pts_w]
        for a in range(len(idxs) - 1):
            ya, za, nya, nza, sa = pts_i[a]
            yb, zb, nyb, nzb, sb = pts_i[a + 1]
            wa, wb = pts_w[a], pts_w[a + 1]
            uu = lambda s_: s_ / 0.97
            nrm = (0.0, (nya + nyb) / 2, (nza + nzb) / 2)
            # inner face (towards the corridor), then both side faces
            UP.qface(bm, [V(rx - 0.15, ya, za), V(rx + 0.15, ya, za), V(rx + 0.15, yb, zb), V(rx - 0.15, yb, zb)], nrm,
                     lambda co, sa=sa, sb=sb, rx=rx, ya=ya: (uu(sa if abs(co.y - ya) < 1e-6 else sb), (co.x - rx + 0.15) / 0.3))
            for sx in (-1, 1):
                UP.qface(bm, [V(rx + sx * 0.15, ya, za), V(rx + sx * 0.15, yb, zb), V(rx + sx * 0.15, wb[0], wb[1]), V(rx + sx * 0.15, wa[0], wa[1])], (sx, 0, 0),
                         lambda co, sa=sa, sb=sb, ya=ya: (uu(sa if abs(co.y - ya) < 1e-6 else sb), 0.1 + 0.8 * ((co.z * 7.0) % 1.0)))

    # ---------------------------------------------------------------------------------------- string course and plinth (stone)
    for sgn in (-1, 1):
        sol.box(B['stone'], (X0, min(sgn * (HALF_W - 0.13), sgn * HALF_W), SPRING - 0.07), (X1, max(sgn * (HALF_W - 0.13), sgn * HALF_W), SPRING + 0.07), (0.7, 0.7))
        sol.box(B['stone'], (X0, min(sgn * (HALF_W - 0.06), sgn * HALF_W), 0.0), (X1, max(sgn * (HALF_W - 0.06), sgn * HALF_W), 0.14), (0.7, 0.7))

    # ---------------------------------------------------------------------------------------- brass wall lanterns
    def basis(n3):
        ex = Vector((1, 0, 0))
        ey = Vector(n3).normalized()
        ez = ex.cross(ey)
        return Matrix(((ex.x, ey.x, ez.x, 0), (ex.y, ey.y, ez.y, 0), (ex.z, ey.z, ez.z, 0), (0, 0, 0, 1)))

    def put_brass(dst_key, profile, rect, matrix, seg=10, **kw):
        UP.alathe(B[dst_key], profile, rect, matrix, seg=seg, **kw)

    lamp_nodes = []
    for i, lx in enumerate(LAMP_X, start=1):
        for side in (-1, 1):
            s_l = PS.s_at_height(LAMP_H, side)
            idx = int(np.argmin(np.abs(SEC['s'] - s_l)))
            y_w, z_w, ny, nz, _ = sec_point(idx)
            P = Vector((lx, y_w, z_w))
            n3 = Vector((0.0, ny, nz))
            mb = Matrix.Translation(P) @ basis(n3)
            tmp = bmesh.new()
            UP.abox(tmp, (-0.05, -0.004, -0.10), (0.05, 0.012, 0.10), METAL['brass'], scale=0.4)
            UP.place(B['brass'], tmp, mb)
            horiz = Vector((0.0, ny, 0.0)).normalized()
            c = Vector((lx, y_w + horiz.y * 0.44, z_w + 0.02))
            arm = Matrix.Translation(Vector((lx, y_w, z_w))) @ Matrix.Rotation(math.radians(90), 4, 'X' if horiz.y < 0 else 'X')
            # arm: lathe along the horizontal direction pointing into the corridor
            axis = Vector((0.0, horiz.y, 0.0))
            rot = Vector((0, 0, 1)).rotation_difference(axis).to_matrix().to_4x4()
            put_brass('brass', [(0.013, 0.0), (0.015, 0.1), (0.012, 0.3), (0.012, 0.44)], METAL['brass'], Matrix.Translation(P + n3 * 0.004) @ rot, seg=8)
            m = Matrix.Translation(c)
            put_brass('brass', [(0.001, -0.17), (0.055, -0.17), (0.072, -0.15), (0.056, -0.12), (0.001, -0.12)], METAL['brass'], m, seg=12)
            UP.alathe(B['glow'], [(0.046, -0.12), (0.078, -0.07), (0.085, 0.02), (0.07, 0.11), (0.026, 0.17)], FULL, m, seg=12, cap_bottom=False)
            put_brass('brass', [(0.001, 0.16), (0.10, 0.16), (0.074, 0.20), (0.028, 0.255), (0.036, 0.27), (0.001, 0.28)], METAL['brass'], m, seg=12)
            for q in range(4):
                a_ = q * math.pi / 2 + math.pi / 4
                put_brass('brass', [(0.004, -0.12), (0.004, 0.16)], METAL['brass'], Matrix.Translation(c + Vector((math.cos(a_) * 0.082, math.sin(a_) * 0.082, 0.0))), seg=5)
            put_brass('brass', [(0.001, 0.27), (0.018, 0.27), (0.018, 0.285), (0.001, 0.31)], METAL['brass'], m, seg=8)
            if side < 0:
                pass
        e = bpy.data.objects.new(f'LAMP_{i}', None)
        bpy.context.scene.collection.objects.link(e)
        e.location = V(lx, 0.0, 2.2)
        e['lightColor'] = '#F5C26B'
        e['intensity'] = 1.2
        e['range'] = 7.0
        lamp_nodes.append(e)

    # ---------------------------------------------------------------------------------------- dado furniture: pictures, shelves of jars, coat pegs
    def wall_frame(side, x_c, z0):
        """matrix placing a UnitFrame (wall = x 0, out = -x, a along the wall, z up) on the dado at game x = x_c, height z0 (side -1 = Blender +y wall)."""
        sgn = -side                                           # side -1 -> wall at y = +HALF_W
        y_w = sgn * (HALF_W - 0.0)
        # unit frame: local -x (out of the wall) must map to -sgn * Y (towards the corridor centre); local +y (a) maps to +X
        rot = Matrix(((0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 1)))
        rot[0][1] = 1.0                                       # a (local y) -> world x
        rot[1][0] = sgn                                       # local +x (into the wall) -> world sgn*y ... (local -x is out of the wall -> -sgn*y)
        rot[2][2] = 1.0
        if sgn > 0:
            # local x -> +y ; local y -> +x ; local z -> z  =>  det = -1 (mirror): flip a so the frame stays right-handed
            rot[0][1] = -1.0
        else:
            rot[1][0] = -1.0
            rot[0][1] = 1.0
        return Matrix.Translation((x_c, y_w, z0)) @ rot

    def put_unit(T, side, x_c, z0):
        m = wall_frame(side, x_c, z0)
        for k_, bm_ in T.items():
            if len(bm_.faces):
                sol.append_bm(B[k_], bm_, m)
            bm_.free()

    def new_T():
        return {k: bmesh.new() for k in B}

    def candle(T, f, a, d, z):
        mm = Matrix.Translation(f.p(a, d, z))
        UP.alathe(T['brass'], [(0.001, 0.0), (0.045, 0.0), (0.05, 0.008), (0.018, 0.02), (0.012, 0.05), (0.02, 0.06), (0.02, 0.07), (0.013, 0.075)], METAL['brass'], mm, seg=10)
        UP.alathe(T['pres'], [(0.001, 0.075), (0.014, 0.075), (0.014, 0.14), (0.001, 0.14)], PRC['wax'], mm, seg=8)
        UP.alathe(T['glow'], [(0.001, 0.14), (0.007, 0.15), (0.005, 0.165), (0.001, 0.178)], FULL, mm, seg=6, cap_bottom=False)

    JAM = ['strawberry', 'damson', 'gooseberry', 'marmalade', 'honey', 'blackcurrant', 'quince', 'greengage']

    def jar(T, f, a, d, z, key):
        mm = Matrix.Translation(f.p(a, d, z))
        UP.alathe(T['pres'], [(0.058, 0), (0.062, 0.02), (0.062, 0.14), (0.042, 0.168), (0.040, 0.176)], PRC[key], mm, seg=10, cap_top=False, cap_bottom=False)
        UP.alathe(T['pres'], [(0.044, 0.170), (0.054, 0.190), (0.050, 0.215), (0.001, 0.222)], PRC['wax'], mm, seg=8, cap_bottom=False)

    def shelf(side, x_c, z0, wdt=0.9):
        T = new_T()
        f = UP.UnitFrame()
        f.box(T['wood'], -wdt / 2, wdt / 2, -0.10, 0.17, 0.0, 0.035, WC['oak'], scale=0.9)
        for sa in (-1, 1):
            f.box(T['brass'], sa * (wdt / 2 - 0.06) - 0.012, sa * (wdt / 2 - 0.06) + 0.012, -0.10, 0.12, -0.12, 0.0, METAL['iron'], scale=0.3)
        aa = -wdt / 2 + 0.12
        j = 0
        while aa < wdt / 2 - 0.10:
            if j == 2:
                candle(T, f, aa, 0.08, 0.035)
                aa += 0.12
            else:
                jar(T, f, aa, 0.08, 0.035, JAM[int(min(rng.range(0, 8), 7.99))])
                aa += 0.15
            j += 1
        put_unit(T, side, x_c, z0)

    def picture(side, x_c, z0, key):
        T = new_T()
        f = UP.UnitFrame()
        w_, h_ = 0.50, 0.62
        fw = 0.05
        for (a0_, a1_, zz0, zz1) in ((-w_ / 2 - fw, w_ / 2 + fw, h_, h_ + fw), (-w_ / 2 - fw, w_ / 2 + fw, -fw, 0.0), (-w_ / 2 - fw, -w_ / 2, 0.0, h_), (w_ / 2, w_ / 2 + fw, 0.0, h_)):
            f.box(T['brass'], a0_, a1_, -0.06, 0.05, zz0, zz1, METAL['brass'], scale=0.5)
        f.box(T['wood'], -w_ / 2, w_ / 2, -0.06, 0.02, 0.0, h_, WC['dark'])
        r = ART[key]
        ins = 0.012
        f.quad(T['art'], -w_ / 2, w_ / 2, 0.0, h_, 0.022, (r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins))
        put_unit(T, side, x_c, z0)

    def pegs(side, x_c, z0):
        """a coat rail with brass pegs, a top hat, a furled umbrella and a pair of white gloves - the Rabbit's things."""
        T = new_T()
        f = UP.UnitFrame()
        f.box(T['wood'], -0.45, 0.45, -0.06, 0.04, 0.0, 0.10, WC['walnut'], scale=0.9)
        hat_a = -0.28
        for a in (-0.28, 0.0, 0.28):
            UP.alathe(T['brass'], [(0.006, 0.0), (0.012, 0.0), (0.012, 0.02), (0.007, 0.06), (0.007, 0.10)],
                      METAL['brass'], Matrix.Translation(f.p(a, 0.04, 0.05)) @ Matrix.Rotation(math.radians(-90), 4, 'Y'), seg=6)
        # top hat on the first peg
        mh = Matrix.Translation(f.p(hat_a, 0.13, -0.08)) @ Matrix.Rotation(math.radians(-8), 4, 'Y')
        UP.alathe(T['wood'], [(0.001, 0.0), (0.12, 0.0), (0.125, 0.012), (0.075, 0.02), (0.073, 0.17), (0.001, 0.175)], WC['dark'], mh, seg=14)
        UP.alathe(T['pres'], [(0.074, 0.02), (0.076, 0.045)], PRC['strawberry'], mh, seg=14, cap_top=False, cap_bottom=False)
        # umbrella on the middle peg
        tb = mk.tube([f.p(0.0, 0.09, 0.02), f.p(0.0, 0.10, -0.40), f.p(0.0, 0.10, -0.62)], rx=[0.02, 0.016, 0.006], ry=[0.02, 0.016, 0.006], n=8, up_hint=(0, 1, 0), cap_start=True, cap_end=True)
        UP.uv_const(tb, (0.5, 0.5))
        UP.place(T['wood'], tb, None, WC['oxblood'])
        UP.alathe(T['brass'], [(0.003, 0.0), (0.012, 0.0), (0.012, 0.05)], METAL['brass'], Matrix.Translation(f.p(0.0, 0.10, -0.66)), seg=6)
        # gloves on the third peg
        for g_, off in ((0, 0.0), (1, 0.03)):
            UP.alathe(T['pres'], [(0.001, 0.0), (0.02, 0.0), (0.028, 0.06), (0.026, 0.12), (0.01, 0.14), (0.001, 0.14)], PRC['wax'],
                      Matrix.Translation(f.p(0.28 + off, 0.07, -0.20)), seg=6)
        put_unit(T, side, x_c, z0)

    pic_keys = ['lady', 'seascape', 'orchard', 'moon', 'cat', 'boy', 'meadow', 'still', 'gent', 'sampler', 'botanical']
    plan = {  # bay -> (side -1 = left wall (game z -), side +1) -> what hangs there
        0: ('picture', 'shelf'), 1: ('shelf', 'picture'), 2: ('picture', 'pegs'), 3: ('pegs', 'shelf'), 4: ('shelf', 'picture'), 5: ('picture', 'shelf'),
        6: ('pegs', 'picture'), 7: ('picture', 'pegs'), 8: ('shelf', 'picture'), 9: ('picture', 'shelf'),
    }
    ip = 0
    for k in range(10):
        x_c = RIB_X[k] + 1.78                                    # off the lantern (lamps sit at local 1.0)
        for side, what in zip((-1, 1), plan[k]):
            if what == 'picture':
                picture(side, x_c, 0.32, pic_keys[ip % len(pic_keys)])
                ip += 1
            elif what == 'shelf':
                shelf(side, x_c, 0.62)
            else:
                pegs(side, x_c, 0.62)

    # ---------------------------------------------------------------------------------------- roots hanging from the crown
    for _ in range(70):
        x = rng.range(X0 + 0.3, X1 - 0.3)
        s = rng.range(1.5, L - 1.5)
        i = int(np.argmin(np.abs(SEC['s'] - s)))
        y, z, ny, nz, _s = sec_point(i)
        base = V(x, y + ny * 0.02, z + nz * 0.02)
        Lr = rng.range(0.22, 0.85) * (1.0 if SEC['hh'][i] > 2.0 else 0.7)
        pts = [base + V(rng.range(-0.03, 0.03) * j / 6, rng.range(-0.03, 0.03) * j / 6, -Lr * j / 6) for j in range(7)]
        tb = mk.tube(pts, rx=lambda t: 0.022 * (1 - t) + 0.004, ry=lambda t: 0.022 * (1 - t) + 0.004, n=5, up_hint=(1, 0, 0), cap_start=False, cap_end=True)
        sol.append_bm(B['root'], tb)
        tb.free()

    # ---------------------------------------------------------------------------------------- rain puddles reflecting the lamps
    for (px, pz, rx_, ry_) in ((-3.0, 0.9, 0.55, 0.32), (-1.2, -0.6, 0.38, 0.24), (2.4, 1.0, 0.62, 0.36), (4.8, -0.9, 0.45, 0.30), (7.4, 0.6, 0.6, 0.34),
                               (9.8, -0.5, 0.36, 0.22), (12.6, 0.8, 0.52, 0.30), (15.1, -1.0, 0.42, 0.26), (17.3, 0.4, 0.58, 0.32)):
        tmp = bmesh.new()
        sol.disc_xy(tmp, (0, 0, 0), 1.0, seg=24)
        bmesh.ops.scale(tmp, vec=(rx_, ry_, 1.0), verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=(px, -pz, 0.006), verts=tmp.verts)
        sol.append_bm(B['water'], tmp)
        tmp.free()

    # ---------------------------------------------------------------------------------------- the two ends
    def end_cap(x, facing, key):
        bm = B[key]
        uvl = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
        poly = [(SEC['y'][i], SEC['z'][i]) for i in idxs] + [(-HALF_W, 0.0), (HALF_W, 0.0)]
        c = bm.verts.new(V(x, 0.0, 1.0))
        vs = [bm.verts.new(V(x, y, z)) for y, z in poly]
        for a in range(len(vs)):
            b = (a + 1) % len(vs)
            try:
                f_ = bm.faces.new((c, vs[a], vs[b]))
            except ValueError:
                continue
            f_.normal_update()
            if f_.normal.x * facing < 0:
                f_.normal_flip()
            for loop in f_.loops:
                co = loop.vert.co
                loop[uvl].uv = ((co.y + 2.0) / 4.0, co.z / 3.25)

    end_cap(X0 + 0.01, 1.0, 'endwall')
    xe = X1 - 0.01
    end_cap(xe, -1.0, 'endwall2')
    # arched doorway of warm light
    dw, dh = 1.9, 2.15
    r_d = dw / 2
    zc_ = dh - r_d
    outline = [(-r_d, 0.0), (-r_d, zc_)] + [(r_d * math.cos(math.pi - math.pi * i / 16), zc_ + r_d * math.sin(math.pi - math.pi * i / 16)) for i in range(1, 16)] + [(r_d, zc_), (r_d, 0.0)]
    bm = B['door']
    cv_ = bm.verts.new(V(xe - 0.005, 0.0, 0.9))
    vs = [bm.verts.new(V(xe - 0.005, y, z)) for y, z in outline]
    for a in range(len(vs) - 1):
        f_ = bm.faces.new((cv_, vs[a], vs[a + 1]))
        f_.normal_update()
        if f_.normal.x > 0:
            f_.normal_flip()
    bm.faces.new((cv_, vs[-1], vs[0])) if False else None
    th, dp = 0.24, 0.34
    uvf = lambda co: (0.25 + 0.1 * ((co.y * 1.3) % 1.0), 0.25 + 0.1 * ((co.z * 1.3) % 1.0))
    for sgn in (-1, 1):
        lo, hi = (r_d, r_d + th) if sgn > 0 else (-r_d - th, -r_d)
        sol.box(B['stone'], (xe - dp, lo, 0.0), (xe, hi, zc_), (0.8, 0.8))
    N = 16
    for i in range(N):
        t0, t1 = math.pi - math.pi * i / N, math.pi - math.pi * (i + 1) / N
        P = lambda rr, t: (rr * math.cos(t), zc_ + rr * math.sin(t))
        (ai0, zi0), (ao0, zo0), (ao1, zo1), (ai1, zi1) = P(r_d, t0), P(r_d + th, t0), P(r_d + th, t1), P(r_d, t1)
        UP.qface(B['stone'], [V(xe - dp, ai0, zi0), V(xe - dp, ao0, zo0), V(xe - dp, ao1, zo1), V(xe - dp, ai1, zi1)], (-1, 0, 0), uvf)
        cen = V(xe, 0.0, zc_)
        mid = (V(xe, ai0, zi0) + V(xe - dp, ai1, zi1)) / 2
        UP.qface(B['stone'], [V(xe - dp, ai0, zi0), V(xe, ai0, zi0), V(xe, ai1, zi1), V(xe - dp, ai1, zi1)], cen - mid, uvf)
    for sgn in (-1, 1):
        # inner reveal of the jambs
        x_in = r_d if sgn > 0 else -r_d
        UP.qface(B['stone'], [V(xe - dp, x_in, 0.0), V(xe, x_in, 0.0), V(xe, x_in, zc_), V(xe - dp, x_in, zc_)], (0, -sgn, 0), uvf)

    # ---------------------------------------------------------------------------------------- the cavern all round (inward-facing, so nothing but painted earth is ever behind the cut-away)
    cx0, cx1, cz, cy1 = -16.0, 34.0, 12.0, 9.0

    def cav_quad(key, pts, want, scale_u, scale_v, axes):
        a_, b_ = axes
        UP.qface(B[key], pts, want, lambda co: (co[a_] / scale_u, co[b_] / scale_v))

    cav_quad('cavground', [V(cx0, -cz, -0.14), V(cx1, -cz, -0.14), V(cx1, cz, -0.14), V(cx0, cz, -0.14)], (0, 0, 1), 6.0, 6.0, (0, 1))
    cav_quad('cavwall', [V(cx0, -cz, cy1), V(cx1, -cz, cy1), V(cx1, cz, cy1), V(cx0, cz, cy1)], (0, 0, -1), 8.0, 8.0, (0, 1))
    cav_quad('cavwall', [V(cx0, cz, -0.14), V(cx1, cz, -0.14), V(cx1, cz, cy1), V(cx0, cz, cy1)], (0, -1, 0), 8.0, 4.0, (0, 2))
    cav_quad('cavwall', [V(cx0, -cz, -0.14), V(cx1, -cz, -0.14), V(cx1, -cz, cy1), V(cx0, -cz, cy1)], (0, 1, 0), 8.0, 4.0, (0, 2))
    cav_quad('cavwall', [V(cx0, -cz, -0.14), V(cx0, cz, -0.14), V(cx0, cz, cy1), V(cx0, -cz, cy1)], (1, 0, 0), 8.0, 4.0, (1, 2))
    cav_quad('cavwall', [V(cx1, -cz, -0.14), V(cx1, cz, -0.14), V(cx1, cz, cy1), V(cx1, -cz, cy1)], (-1, 0, 0), 8.0, 4.0, (1, 2))

    # ---------------------------------------------------------------------------------------- export
    objs = []
    for key, bm in B.items():
        if len(bm.faces) == 0:
            bm.free()
            continue
        nm = {'flag': 'Flag', 'stone': 'Stone', 'brass': 'Brass', 'wood': 'Wood'}.get(key, key.capitalize())
        o = mk.bm_to_object(bm, 'S4_' + nm, M[key])
        objs.append(o)
    print('[build_ch1_s4_passage] triangles:', sum(mk.triangle_count(o) for o in objs), {o.name: mk.triangle_count(o) for o in objs})

    def marker(name, loc, **props):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        for k_, v_ in props.items():
            e[k_] = v_

    marker('SPAWN_S4', G(-2.0, 0.0, 0.0), targetState='S4_PASSAGE')
    marker('TRG_S4_exit', G(18.0, 0.0, 0.0), triggerId='TRG_S4_EXIT')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp_out = OUT + '.tmp.glb'
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=tmp_out, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=86,
                              export_yup=True, export_apply=False)
    os.replace(tmp_out, OUT)
    print(f'[build_ch1_s4_passage] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s4_passage.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'ch1_s4_passage.glb'))


if __name__ == '__main__':
    main()
