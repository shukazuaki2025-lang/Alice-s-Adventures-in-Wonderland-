"""
Build the Chapter 1 / S5–S7 "long, low hall, lit by a row of lamps hanging from the roof" and export
public/assets/models/ch1_s5_hall.glb.

    python3 tools/blender/build_ch1_s5_hall.py          # env S5_OUT=... to write elsewhere (e.g. public/assets/models/dev/hall.glb)

Visual shell only (the game keeps the interactive door/table/curtain anchors): parquet floor + wine runner, damask wallpaper over a
raised-panel dado, skirting / dado rail / picture rail / cornice mouldings, coffered plaster ceiling (single-sided so the orbit camera
can rise above it), 8 six-panel doors with architraves + brass furniture on the long walls, 2 doors on the east wall, the Little
Door surround, a grand clock, a fireplace with a gilt mirror, gilt-framed pictures, console tables with porcelain and flowers,
brass wall sconces and six hanging oil lamps. Canonical metrics (CLAUDE.md §4): 24 × 7 × 2.85 m, doors 1.0 × 2.2 m.

Axes: game (x, y-up, z)  ->  Blender (x, -z, y-up) so that the glTF exporter (X,Z,-Y) round-trips. Walls are described with the
`Wall` helper: along-wall coordinate `a`, depth `d` into the room, height `z`.
"""
import math
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V, lerp  # noqa: E402
from world import interior as I  # noqa: E402
from world import painters  # noqa: E402

OUT = os.environ.get('S5_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s5_hall.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'ch1_s5_hall.glb')

HALL_X = 12.0          # half length
HALL_Y = 3.5           # half width
CEIL = 2.85
DOOR_W, DOOR_H = 1.0, 2.2
DOOR_X = (-8.0, -3.0, 2.0, 7.0)           # game x of the long-wall doors (north + south), matches SceneLoader
LITTLE_DOOR_X = -0.8
LAMP_X = (-9.0, -5.0, -1.0, 3.0, 7.0, 10.5)


def G(x, z, h=0.0):
    return V(x, -z, h)


class Wall:
    """A wall plane described from inside the room: `a` runs to the viewer's right, `d` into the room, `z` up."""

    def __init__(self, name, origin, n_in):
        self.name = name
        self.O = Vector(origin)
        self.n = Vector(n_in)
        self.r = Vector((0, 0, 1)).cross(self.n)
        self.back = {(0, -1): 'py', (0, 1): 'ny', (1, 0): 'nx', (-1, 0): 'px'}[(round(self.n.x), round(self.n.y))]

    def p(self, a, d, z):
        return self.O + self.r * a + self.n * d + Vector((0, 0, z))

    def box(self, bm, a0, a1, d0, d1, z0, z1, tile=(1.0, 1.0), skip_back=True, tile_top=None, skip=(), face_uv=None):
        p0, p1 = self.p(a0, d0, z0), self.p(a1, d1, z1)
        lo = tuple(min(p0[i], p1[i]) for i in range(3))
        hi = tuple(max(p0[i], p1[i]) for i in range(3))
        sk = tuple(skip) + ((self.back,) if skip_back else ())
        sol.box(bm, lo, hi, tile, skip=sk, tile_top=tile_top, face_uv=face_uv)

    def quad(self, bm, a0, a1, z0, z1, d, uvs=None):
        P = lambda a, z: self.p(a, d, z)
        sol.quad(bm, P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1), uvs)

    def run(self, bm, a0, a1, z, profile, tile=(1.0, 1.0)):
        sol.moulding(bm, self.p(a0, 0, z), self.p(a1, 0, z), profile, self.n, up=(0, 0, 1), tile=tile)


# a-axis conventions: N/E use +x / +zg, S/W use -x / -zg  (see Wall.r)
NORTH = Wall('N', (0, HALL_Y, 0), (0, -1, 0))       # game z = -3.5, a = x
SOUTH = Wall('S', (0, -HALL_Y, 0), (0, 1, 0))       # game z = +3.5, a = -x
WEST = Wall('W', (-HALL_X, 0, 0), (1, 0, 0))        # game x = -12,  a = -z
EAST = Wall('E', (HALL_X, 0, 0), (-1, 0, 0))        # game x = +12,  a = +z
LONG = (NORTH, SOUTH)


def ax(wall, x):
    """Along-wall coordinate for a game x on a long wall."""
    return x * wall.r.x


def gaps_free(a0, a1, gaps):
    """Intervals of [a0,a1] not covered by any (lo,hi) in gaps."""
    out, cur = [], a0
    for lo, hi in sorted(gaps):
        if hi <= cur or lo >= a1:
            continue
        if lo > cur:
            out.append((cur, lo))
        cur = max(cur, hi)
    if cur < a1:
        out.append((cur, a1))
    return out


# profiles (depth, height): CCW with the front face going up
SKIRT = [(0, 0), (0.030, 0), (0.030, 0.100), (0.024, 0.128), (0.012, 0.140), (0, 0.140)]
DADO = [(0, 0), (0.030, 0), (0.052, 0.012), (0.052, 0.034), (0.040, 0.050), (0.040, 0.075), (0.028, 0.090), (0, 0.100)]
PICRAIL = [(0, 0), (0.026, 0), (0.034, 0.014), (0.034, 0.030), (0.020, 0.040), (0, 0.040)]
CORNICE = [(0, 0), (0.030, 0), (0.030, 0.020), (0.070, 0.040), (0.070, 0.062), (0.115, 0.085), (0.115, 0.108), (0.150, 0.128),
           (0.150, 0.158), (0.095, 0.158), (0.095, 0.185), (0, 0.185)]
ARCH_CAP = [(0, 0), (0.075, 0), (0.095, 0.016), (0.095, 0.034), (0.070, 0.052), (0.070, 0.072), (0.040, 0.090), (0, 0.090)]
FRAME_PROFILE = [(0, 0), (0.060, 0), (0.060, 0.012), (0.045, 0.026), (0.045, 0.034), (0, 0.034)]


def main():
    mk.reset_scene()
    rng = mk.Rng(1865)

    def tex(name, arr, rough=0.9, double=False):
        img = paint.to_image('T_S5_' + name, arr)
        return paint.make_material('M_S5_' + name, img, roughness=rough, double_sided=double)

    def flat(name, hexc, rough=0.8, emissive=None):
        c = paint.srgb_to_linear(paint.hex_rgb(hexc))
        em = None
        if emissive:
            e = paint.srgb_to_linear(paint.hex_rgb(emissive))
            em = (float(e[0]), float(e[1]), float(e[2]))
        return paint.make_material('M_S5_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, emissive=em)

    M = {
        'parquet': tex('Parquet', I.parquet(2048, 2048), 0.45),
        'runner': tex('Runner', I.runner(3072, 256, aspect=22.4 / 1.9), 0.95),
        'paper': tex('Wallpaper', I.wallpaper(1024, 1024), 0.95),
        'wood': tex('Wood', I.planks(512, 512, n=4, base='#5A3822', seed=17), 0.55),
        'door': tex('Door', I.door(512, 1024), 0.6),
        'brass': tex('Brass', I.brass(256, 256), 0.35),
        'plaster': tex('Plaster', I.plaster(512, 512), 0.95),
        'marble': tex('Marble', I.plaster(512, 512, base='#D9D4C7', seed=97), 0.4),
        'portrait': tex('Portrait', I.painting(512, 640, 'portrait'), 0.6),
        'landscape': tex('Landscape', I.painting(512, 640, 'landscape'), 0.6),
        'clock': tex('ClockFace', I.clock_face(256, 256), 0.4),
        'porcelain': tex('Porcelain', I.porcelain(256, 256), 0.3),
        'glass': flat('LampGlow', '#FFE7A8', 0.2, emissive='#FFC966'),
        'fire': flat('Fire', '#FF9A3C', 0.5, emissive='#FF7A1F'),
        'dark': flat('Dark', '#1C1410', 0.9),
        'leaf': tex('Foliage', I.painters_leaf(256, 256, 7), 0.9, double=True),
        'velvet': tex('Velvet', I.velvet(256, 256), 0.8, double=True),
        'books': tex('Books', I.books(1024, 256), 0.7),
        'earth': tex('Earth', I.earth(512, 512), 0.98),
        'g_lawn': tex('G_Lawn', painters.ground(1024), 0.95),
        'g_hedge': tex('G_Hedge', painters.leaf(dark='#2F5A2E', mid='#477C3B', light='#7FB35A', warm='#C8CF68', seed=7), 0.95),
        'g_gravel': tex('G_Gravel', I.gravel(512, 512), 0.95),
        'g_stone': tex('G_Stone', painters.rock(512), 0.9),
        'g_water': tex('G_Water', painters.water(512), 0.2),
        'g_bark': tex('G_Bark', painters.bark(512), 0.95),
        'g_leaf': tex('G_Leaf', painters.leaf(seed=2), 0.95),
        'g_bloom': tex('G_Bloom', I.rose_bush(512, 512, 9), 0.95),
        'g_sky': tex('G_Sky', I.vista(1536, 768), 1.0),
        'bloom': tex('Blooms', I.rose_bush(256, 256, 5), 0.9),
    }
    B = {k: bmesh.new() for k in M}

    wall_sizes = {'N': 2 * HALL_X, 'S': 2 * HALL_X, 'W': 2 * HALL_Y, 'E': 2 * HALL_Y}
    tiling_paper = (0.8, 0.8)

    # ------------------------------------------------------------------------------------------ floor, runner, ceiling
    sol.box(B['parquet'], (-HALL_X, -HALL_Y, -0.06), (HALL_X, HALL_Y, 0.0), (0.5, 0.5), skip=('nz', 'px', 'nx', 'py', 'ny'))
    rl, rw, rh = 11.2, 0.95, 0.014
    sol.quad(B['runner'], V(-rl, -rw, rh), V(rl, -rw, rh), V(rl, rw, rh), V(-rl, rw, rh), ((0, 0), (1, 0), (1, 1), (0, 1)))
    sol.box(B['runner'], (-rl, -rw, 0), (rl, rw, rh), (0.4, 0.4), skip=('pz', 'nz'))
    # ceiling: faces down only (invisible from above so the orbit camera can rise over it)
    sol.box(B['plaster'], (-HALL_X, -HALL_Y, CEIL), (HALL_X, HALL_Y, CEIL + 0.1), (0.5, 0.5), skip=('pz', 'px', 'nx', 'py', 'ny'))
    for bx in range(-11, 12, 3):                                                # cross beams
        sol.box(B['wood'], (bx - 0.14, -HALL_Y, CEIL - 0.16), (bx + 0.14, HALL_Y, CEIL), (1.0, 1.0), skip=('pz',))
        for sgn in (-1, 1):
            sol.box(B['wood'], (bx + sgn * 0.14 - 0.02, -HALL_Y, CEIL - 0.19), (bx + sgn * 0.14 + 0.02, HALL_Y, CEIL - 0.16), (1.0, 1.0), skip=('pz',))
    for sy in (-1.75, 1.75):                                                    # long beams (coffering)
        sol.box(B['wood'], (-HALL_X, sy - 0.10, CEIL - 0.12), (HALL_X, sy + 0.10, CEIL), (1.0, 1.0), skip=('pz',))

    # ------------------------------------------------------------------------------------------ wall shells + mouldings
    LA = ax(NORTH, LITTLE_DOOR_X)
    OPEN_W, OPEN_H = 0.24, 0.381
    for w in (NORTH, SOUTH, WEST, EAST):
        L = wall_sizes[w.name]
        keep = {(0, -1): 'ny', (0, 1): 'py', (1, 0): 'px', (-1, 0): 'nx'}[(round(w.n.x), round(w.n.y))]
        only = tuple(f for f in ('px', 'nx', 'py', 'ny', 'pz', 'nz') if f != keep)
        if w is NORTH:                                                       # wall with the 0.24 x 0.381 m opening of the Little Door
            segs = [(-L / 2 - 0.2, LA - OPEN_W / 2, -0.06, CEIL + 0.1), (LA + OPEN_W / 2, L / 2 + 0.2, -0.06, CEIL + 0.1),
                    (LA - OPEN_W / 2, LA + OPEN_W / 2, OPEN_H, CEIL + 0.1)]
            for a0_, a1_, z0_, z1_ in segs:
                w.box(B['paper'], a0_, a1_, -0.20, 0.0, z0_, z1_, tile=tiling_paper, skip_back=False, skip=only)
        else:
            w.box(B['paper'], -L / 2 - 0.2, L / 2 + 0.2, -0.20, 0.0, -0.06, CEIL + 0.1, tile=tiling_paper, skip_back=False, skip=only)
    # door spans (along-wall coordinates) so panels / rails stop at them
    door_gaps = {w.name: [] for w in (NORTH, SOUTH, WEST, EAST)}
    for w in LONG:
        for x in DOOR_X:
            door_gaps[w.name].append((ax(w, x) - 0.70, ax(w, x) + 0.70))
    door_gaps['N'].append((ax(NORTH, LITTLE_DOOR_X) - 0.42, ax(NORTH, LITTLE_DOOR_X) + 0.42))
    for zg in (-1.5, 1.5):
        door_gaps['E'].append((zg - 0.70, zg + 0.70))
    door_gaps['W'].append((-0.95, 0.95))                                            # fireplace
    door_gaps['E'].append((-0.40, 0.40))                                            # clock

    for w in (NORTH, SOUTH, WEST, EAST):
        L = wall_sizes[w.name] / 2
        gaps = sorted(door_gaps[w.name])
        for lo, hi in gaps_free(-L, L, gaps):
            w.run(B['wood'], lo, hi, 0.0, SKIRT)
            w.run(B['wood'], lo, hi, 1.00, DADO)
            # raised dado panels (bay ≈ 1.25 m)
            n = max(1, int((hi - lo) // 1.25))
            bay = (hi - lo) / n
            for k in range(n):
                a0, a1 = lo + k * bay + 0.10, lo + (k + 1) * bay - 0.10
                w.box(B['wood'], a0, a1, 0.0, 0.016, 0.20, 0.92, tile=(0.9, 0.9))
                w.box(B['wood'], a0 + 0.07, a1 - 0.07, 0.016, 0.030, 0.28, 0.84, tile=(0.9, 0.9))
                for zz in (0.20, 0.92 - 0.018):                                            # bevel rails
                    w.box(B['wood'], a0 - 0.01, a1 + 0.01, 0.016, 0.026, zz, zz + 0.018, tile=(0.9, 0.9))
        w.run(B['wood'], -L, L, 2.42, PICRAIL)
        w.run(B['plaster'], -L, L, CEIL - 0.185, CORNICE, tile=(0.6, 0.6))
        n_d = int((2 * L - 0.2) / 0.12)
        for k in range(n_d):                                                       # dentil course under the cornice
            ac = -L + 0.1 + k * 0.12
            w.box(B['plaster'], ac - 0.024, ac + 0.024, 0.0, 0.040, CEIL - 0.185 - 0.048, CEIL - 0.185, tile=(2.0, 2.0))

    # ------------------------------------------------------------------------------------------ doors
    def door(w, a_c, hinge=1.0):
        # architrave: jambs + head + pediment cap
        for sgn in (-1, 1):
            lo, hi = (a_c + 0.50, a_c + 0.62) if sgn > 0 else (a_c - 0.62, a_c - 0.50)
            w.box(B['wood'], lo, hi, 0.0, 0.058, 0.0, DOOR_H + 0.14)
        w.box(B['wood'], a_c - 0.70, a_c + 0.70, 0.0, 0.066, DOOR_H, DOOR_H + 0.14)
        w.run(B['wood'], a_c - 0.76, a_c + 0.76, DOOR_H + 0.14, ARCH_CAP)
        # leaf (painted six-panel door), recessed behind the architrave
        w.box(B['door'], a_c - 0.5, a_c + 0.5, 0.0, 0.030, 0.0, DOOR_H, skip=('px', 'nx', 'py', 'ny', 'pz', 'nz'))
        w.quad(B['door'], a_c - 0.5, a_c + 0.5, 0.0, DOOR_H, 0.030, ((0, 0), (1, 0), (1, 1), (0, 1)))
        for (fx0, fx1) in ((0.12, 0.47), (0.53, 0.88)):                                             # raised panels (match the painted door)
            for (fy0, fy1) in ((0.06, 0.30), (0.34, 0.60), (0.64, 0.94)):
                w.box(B['wood'], a_c - 0.5 + fx0, a_c - 0.5 + fx1, 0.030, 0.036, DOOR_H * (1 - fy1), DOOR_H * (1 - fy0), tile=(0.9, 0.9))
                w.box(B['wood'], a_c - 0.5 + fx0 + 0.04, a_c - 0.5 + fx1 - 0.04, 0.036, 0.040, DOOR_H * (1 - fy1) + 0.04, DOOR_H * (1 - fy0) - 0.04, tile=(0.9, 0.9))
        w.box(B['brass'], a_c - 0.52, a_c + 0.52, 0.0, 0.070, 0.0, 0.016, tile=(1.0, 1.0))         # threshold
        # furniture: backplate, knob (lathe along the wall normal), keyhole
        ka = a_c + hinge * -0.38
        w.box(B['brass'], ka - 0.032, ka + 0.032, 0.030, 0.036, 0.90, 1.14, tile=(2.0, 2.0))
        knob = [(0.006, 0.0), (0.010, 0.012), (0.012, 0.040), (0.026, 0.056), (0.030, 0.074), (0.024, 0.092), (0.006, 0.100)]
        sol.lathe(B['brass'], knob, w.p(ka, 0.036, 1.04), seg=16, axis=w.n, uv_u=(0, 1))
        w.box(B['dark'], ka - 0.006, ka + 0.006, 0.036, 0.040, 0.93, 0.975)
        # hinges
        for hz in (0.30, 1.10, 1.90):
            ha = a_c + hinge * 0.485
            w.box(B['brass'], ha - 0.015, ha + 0.015, 0.030, 0.034, hz - 0.06, hz + 0.06)

    for w in LONG:
        for x in DOOR_X:
            door(w, ax(w, x), hinge=1.0 if x < 0 else -1.0)
    for zg in (-1.5, 1.5):
        door(EAST, zg, hinge=1.0)

    # the Little Door (15 in = 0.381 m): a real opening through the wall into a 1.2 m passage, a hinged leaf the game can swing open,
    # and a small architrave. The interactive anchor (INT_little_door) is still created by the game.
    la = LA
    for sgn in (-1, 1):
        NORTH.box(B['wood'], la + sgn * (OPEN_W / 2) - (0.06 if sgn < 0 else 0.0), la + sgn * (OPEN_W / 2) + (0.0 if sgn < 0 else 0.06), 0.0, 0.045, 0.0, OPEN_H + 0.06)
    NORTH.box(B['wood'], la - OPEN_W / 2 - 0.06, la + OPEN_W / 2 + 0.06, 0.0, 0.050, OPEN_H, OPEN_H + 0.06)
    # passage behind the wall: floor / ceiling / sides in packed earth, 1.3 m long (0.2 wall + 1.1 beyond)
    TL = 1.3
    NORTH.box(B['earth'], la - OPEN_W / 2 - 0.05, la + OPEN_W / 2 + 0.05, -TL, 0.0, -0.06, 0.0, tile=(3.0, 3.0), skip_back=False)
    NORTH.box(B['earth'], la - OPEN_W / 2 - 0.05, la + OPEN_W / 2 + 0.05, -TL, 0.0, OPEN_H, OPEN_H + 0.06, tile=(3.0, 3.0), skip_back=False)
    for sgn in (-1, 1):
        NORTH.box(B['earth'], la + sgn * OPEN_W / 2 - (0.05 if sgn < 0 else 0.0), la + sgn * OPEN_W / 2 + (0.0 if sgn < 0 else 0.05), -TL, 0.0, 0.0, OPEN_H, tile=(3.0, 3.0), skip_back=False)
    # hinged leaf: separate objects parented to an Empty at the hinge so the engine can rotate one node
    hinge = NORTH.p(la - OPEN_W / 2, 0.0, 0.0)
    leaf_parts = {k: bmesh.new() for k in ('door', 'brass', 'dark')}
    NORTH.box(leaf_parts['door'], la - OPEN_W / 2, la + OPEN_W / 2, 0.0, 0.036, 0.0, OPEN_H - 0.004, skip=('ny',), skip_back=False)
    NORTH.quad(leaf_parts['door'], la - OPEN_W / 2, la + OPEN_W / 2, 0.0, OPEN_H - 0.004, 0.036, ((0.10, 0.06), (0.90, 0.06), (0.90, 0.40), (0.10, 0.40)))
    NORTH.box(leaf_parts['brass'], la + OPEN_W / 2 - 0.075, la + OPEN_W / 2 - 0.025, 0.036, 0.040, OPEN_H * 0.40, OPEN_H * 0.60, tile=(3, 3))
    sol.lathe(leaf_parts['brass'], [(0.003, 0), (0.007, 0.006), (0.010, 0.018), (0.012, 0.030), (0.004, 0.038)], NORTH.p(la + OPEN_W / 2 - 0.05, 0.040, OPEN_H * 0.5), seg=12, axis=NORTH.n)
    NORTH.box(leaf_parts['dark'], la + OPEN_W / 2 - 0.054, la + OPEN_W / 2 - 0.046, 0.040, 0.043, OPEN_H * 0.40 + 0.01, OPEN_H * 0.40 + 0.04)
    for hz in (OPEN_H * 0.25, OPEN_H * 0.78):
        NORTH.box(leaf_parts['brass'], la - OPEN_W / 2, la - OPEN_W / 2 + 0.035, 0.036, 0.039, hz - 0.022, hz + 0.022, tile=(3, 3))
    hinge_empty = bpy.data.objects.new('Hall_LittleDoor', None)
    bpy.context.scene.collection.objects.link(hinge_empty)
    hinge_empty.location = hinge
    bpy.context.view_layer.update()
    for k, bm in leaf_parts.items():
        o = mk.bm_to_object(bm, f'Hall_LittleDoor_{k}', M[k] if k in M else M['dark'])
        o.parent = hinge_empty
        o.matrix_parent_inverse = hinge_empty.matrix_world.inverted()

    # the low velvet curtain (0.8 x 0.6 m): origin at its centre so the game can slide it aside
    cw_, ch_ = 0.80, 0.60
    cols_, rows_ = 48, 10
    grid = []
    for jr in range(rows_ + 1):
        zt = ch_ / 2 - ch_ * jr / rows_
        row = []
        for ic in range(cols_ + 1):
            xt = -cw_ / 2 + cw_ * ic / cols_
            fold = 0.034 * math.sin(xt / cw_ * 2 * math.pi * 6.0 + 0.4 * math.sin(zt * 5.0)) * (0.75 + 0.25 * (jr / rows_))
            row.append(V(xt + 0.006 * math.sin(zt * 9), 0.0 - 0.035 - fold, zt))
        grid.append(row)
    cur = bmesh.new()
    mk.sheet(grid, flip=False, bm=cur, uv_rect=(0, 0, 2.0, 1.0))
    curtain = mk.bm_to_object(cur, 'Hall_Curtain', M['velvet'])
    rod = bmesh.new()
    sol.lathe(rod, [(0.012, -0.44), (0.012, 0.44)], V(0, -0.06, ch_ / 2 + 0.03), seg=10, axis=(1, 0, 0), cap_bottom=True, cap_top=True)
    for sgn in (-1, 1):
        sol.lathe(rod, [(0.002, 0), (0.02, 0.01), (0.026, 0.03), (0.018, 0.05), (0.002, 0.06)], V(sgn * 0.44, -0.06, ch_ / 2 + 0.03), seg=12, axis=(sgn, 0, 0))
    rod_o = mk.bm_to_object(rod, 'Hall_CurtainRod', M['brass'])
    rod_o.parent = curtain
    curtain['isCurtain'] = True

    # ------------------------------------------------------------------------------------------ pictures, consoles, sconces
    def picture(w, a_c, kind, zc=1.72, pw=0.92, ph=1.12):
        z0, z1 = zc - ph / 2, zc + ph / 2
        fw = 0.085
        for (aa0, aa1, zz0, zz1) in ((a_c - pw / 2 - fw, a_c + pw / 2 + fw, z1, z1 + fw), (a_c - pw / 2 - fw, a_c + pw / 2 + fw, z0 - fw, z0),
                                     (a_c - pw / 2 - fw, a_c - pw / 2, z0, z1), (a_c + pw / 2, a_c + pw / 2 + fw, z0, z1)):
            w.box(B['brass'], aa0, aa1, 0.0, 0.050, zz0, zz1, tile=(1.4, 1.4))
        w.box(B['brass'], a_c - pw / 2 - 0.02, a_c + pw / 2 + 0.02, 0.040, 0.056, z1 - 0.004, z1 + 0.012)
        w.box(B['dark'], a_c - pw / 2, a_c + pw / 2, 0.0, 0.020, z0, z1, skip=())
        key = 'portrait' if kind == 'portrait' else 'landscape'
        w.quad(B[key], a_c - pw / 2, a_c + pw / 2, z0, z1, 0.022, ((0.03, 0.03), (0.97, 0.03), (0.97, 0.97), (0.03, 0.97)))
        # tiny brass nameplate + cord
        w.box(B['brass'], a_c - 0.06, a_c + 0.06, 0.046, 0.056, z0 - fw - 0.05, z0 - fw - 0.025)

    def sconce(w, a_c, zc=1.9):
        arm = [(0.010, 0.0), (0.016, 0.02), (0.012, 0.06), (0.022, 0.10), (0.030, 0.13), (0.010, 0.15)]
        sol.lathe(B['brass'], arm, w.p(a_c, 0.0, zc), seg=14, axis=w.n)
        w.box(B['brass'], a_c - 0.040, a_c + 0.040, 0.0, 0.012, zc - 0.07, zc + 0.07, tile=(2, 2))
        sol.lathe(B['brass'], [(0.010, 0.0), (0.030, 0.012), (0.036, 0.030), (0.020, 0.038)], w.p(a_c, 0.15, zc - 0.02 + 0.0), seg=16, axis=Vector((0, 0, 1)))
        sol.lathe(B['glass'], [(0.022, 0.0), (0.034, 0.025), (0.036, 0.060), (0.028, 0.095), (0.004, 0.115)], w.p(a_c, 0.15, zc + 0.0), seg=16, axis=Vector((0, 0, 1)))

    def vase(w, a_c, d, ztop, kind=0):
        prof = [(0.001, 0.0), (0.050, 0.004), (0.060, 0.030), (0.080, 0.075), (0.074, 0.120), (0.044, 0.158), (0.034, 0.178), (0.046, 0.204), (0.052, 0.214)]
        if kind:
            prof = [(0.001, 0.0), (0.040, 0.004), (0.046, 0.04), (0.062, 0.10), (0.052, 0.17), (0.030, 0.22), (0.036, 0.25), (0.044, 0.26)]
        base = w.p(a_c, d, ztop)
        sol.lathe(B['porcelain'], prof, base, seg=24, cap_top=False)
        # a bunch of flowers
        for k in range(7):
            ang = rng.range(0, 6.28)
            rr = rng.range(0.0, 0.07)
            top = base + V(math.cos(ang) * rr, math.sin(ang) * rr, prof[-1][1] + rng.range(0.07, 0.20))
            mk.ellipsoid((top.x, top.y, top.z), (0.04, 0.04, 0.032), seg=10, rings=6, bm=B['bloom'])
            sol.lathe(B['leaf'], [(0.002, 0.0), (0.003, 0.05), (0.004, 0.10)], base + V(0, 0, prof[-1][1] - 0.01), seg=5, axis=(top - (base + V(0, 0, prof[-1][1]))))

    def console(w, a_c, vase_kind=0):
        cw, cd, ch = 1.15, 0.42, 0.82
        w.box(B['marble'], a_c - cw / 2, a_c + cw / 2, 0.0, cd, ch - 0.035, ch, tile=(1.2, 1.2), skip_back=False)
        w.box(B['wood'], a_c - cw / 2 + 0.03, a_c + cw / 2 - 0.03, 0.02, cd - 0.03, ch - 0.16, ch - 0.035)
        for sa in (-1, 1):
            for sd in (0.05, cd - 0.05):
                leg = [(0.016, 0.0), (0.020, 0.05), (0.030, 0.16), (0.020, 0.30), (0.026, 0.46), (0.022, 0.60), (0.028, 0.66)]
                sol.lathe(B['wood'], leg, w.p(a_c + sa * (cw / 2 - 0.05), sd, 0.0), seg=12, cap_bottom=True, cap_top=True)
        w.box(B['brass'], a_c - 0.06, a_c + 0.06, cd - 0.03, cd - 0.015, ch - 0.12, ch - 0.09)
        vase(w, a_c, cd * 0.5, ch, vase_kind)
        # candlestick pair
        for sa in (-1, 1):
            sol.lathe(B['brass'], [(0.001, 0), (0.030, 0.004), (0.030, 0.012), (0.012, 0.03), (0.016, 0.07), (0.010, 0.11), (0.020, 0.125), (0.020, 0.15)],
                      w.p(a_c + sa * 0.36, cd * 0.5, ch), seg=14)

    pic_x = (-10.5, -5.5, 4.5, 9.5)
    for i, x in enumerate(pic_x):
        for wi, w in enumerate(LONG):
            kind = 'portrait' if (i + wi) % 2 == 0 else 'landscape'
            picture(w, ax(w, x), kind)
            for sgn in (-1, 1):
                sconce(w, ax(w, x) + sgn * 0.90)
    picture(SOUTH, ax(SOUTH, -0.5), 'landscape', pw=1.3, ph=0.85)
    console(NORTH, ax(NORTH, -5.5), 0)
    console(NORTH, ax(NORTH, 9.5), 1)
    console(SOUTH, ax(SOUTH, 4.5), 1)
    console(SOUTH, ax(SOUTH, -10.5), 0)
    console(SOUTH, ax(SOUTH, -0.5), 0)

    # ------------------------------------------------------------------------------------------ east wall: grand clock
    ca = 0.0
    cw_, cd_ = 0.62, 0.36
    EAST.box(B['wood'], ca - cw_ / 2, ca + cw_ / 2, 0.0, cd_, 0.0, 0.32)
    EAST.box(B['wood'], ca - cw_ / 2 + 0.05, ca + cw_ / 2 - 0.05, 0.0, cd_ - 0.04, 0.32, 1.70)
    EAST.box(B['dark'], ca - 0.12, ca + 0.12, cd_ - 0.04, cd_ - 0.03, 0.55, 1.30)                              # pendulum glass
    EAST.box(B['wood'], ca - cw_ / 2 - 0.03, ca + cw_ / 2 + 0.03, 0.0, cd_ + 0.02, 1.70, 1.78)
    EAST.box(B['wood'], ca - cw_ / 2, ca + cw_ / 2, 0.0, cd_, 1.78, 2.34)
    EAST.box(B['brass'], ca - 0.012, ca + 0.012, cd_ - 0.04, cd_ - 0.025, 0.55, 1.30)                           # pendulum rod
    sol.lathe(B['brass'], [(0.001, 0), (0.07, 0.004), (0.075, 0.016), (0.001, 0.02)], EAST.p(ca, cd_ - 0.03, 0.62), seg=24, axis=EAST.n)   # bob
    cbm = B['clock']
    EAST.quad(cbm, ca - 0.24, ca + 0.24, 1.82, 2.30, cd_ + 0.001, ((0, 0), (1, 0), (1, 1), (0, 1)))
    sol.lathe(B['wood'], [(0.001, 0.0), (0.05, 0.0), (0.045, 0.1), (0.02, 0.15), (0.001, 0.20)], EAST.p(ca, cd_ * 0.5, 2.34), seg=12)   # finial

    # ------------------------------------------------------------------------------------------ west wall: fireplace + mirror
    wa = 0.0
    WEST.box(B['marble'], wa - 0.85, wa + 0.85, 0.0, 0.36, 1.22, 1.30, tile=(1.2, 1.2))                           # mantel shelf
    WEST.box(B['marble'], wa - 0.75, wa - 0.55, 0.0, 0.30, 0.0, 1.22, tile=(1.2, 1.2))
    WEST.box(B['marble'], wa + 0.55, wa + 0.75, 0.0, 0.30, 0.0, 1.22, tile=(1.2, 1.2))
    WEST.box(B['dark'], wa - 0.55, wa + 0.55, 0.0, 0.012, 0.0, 0.95)                                               # firebox
    WEST.box(B['marble'], wa - 0.75, wa + 0.75, 0.0, 0.30, 0.95, 1.22, tile=(1.2, 1.2))
    WEST.box(B['dark'], wa - 0.55, wa + 0.55, 0.012, 0.050, 0.0, 0.95)
    for k in range(5):                                                                                             # logs + flames
        la_ = wa - 0.34 + k * 0.17
        sol.lathe(B['wood'], [(0.001, 0), (0.05, 0.01), (0.05, 0.40), (0.001, 0.41)], WEST.p(la_, 0.05, 0.07), seg=8, axis=WEST.n)
        sol.lathe(B['fire'], [(0.001, 0), (0.07, 0.03), (0.055, 0.14), (0.02, 0.26), (0.001, 0.32)], WEST.p(la_, 0.20, 0.10), seg=10)
    sol.lathe(B['brass'], [(0.012, 0.0), (0.012, 0.18)], WEST.p(wa - 0.58, 0.30, 0.0), seg=8)
    mw, mh = 1.35, 1.25
    WEST.box(B['brass'], wa - mw / 2 - 0.10, wa + mw / 2 + 0.10, 0.0, 0.07, 1.50 + mh, 1.50 + mh + 0.10, tile=(1.4, 1.4))
    WEST.box(B['brass'], wa - mw / 2 - 0.10, wa + mw / 2 + 0.10, 0.0, 0.07, 1.40, 1.50, tile=(1.4, 1.4))
    for sgn in (-1, 1):
        WEST.box(B['brass'], wa + sgn * (mw / 2 + 0.05) - 0.05, wa + sgn * (mw / 2 + 0.05) + 0.05, 0.0, 0.07, 1.50, 1.50 + mh, tile=(1.4, 1.4))
    WEST.quad(B['landscape'], wa - mw / 2, wa + mw / 2, 1.50, 1.50 + mh, 0.03, ((0.04, 0.2), (0.96, 0.2), (0.96, 0.8), (0.04, 0.8)))

    # ------------------------------------------------------------------------------------------ bookcases, settees, ferns
    FRONT = {(0, -1): 'ny', (0, 1): 'py', (1, 0): 'px', (-1, 0): 'nx'}

    def bookcase(w, a_c, width=1.1, depth=0.38, height=2.3):
        a0, a1 = a_c - width / 2, a_c + width / 2
        w.box(B['wood'], a0, a1, 0.0, depth + 0.02, 0.0, 0.12)                                                  # plinth
        w.box(B['wood'], a0, a0 + 0.04, 0.0, depth, 0.12, height)
        w.box(B['wood'], a1 - 0.04, a1, 0.0, depth, 0.12, height)
        w.box(B['wood'], a0 - 0.03, a1 + 0.03, 0.0, depth + 0.03, height, height + 0.05)
        w.run(B['wood'], a0 - 0.03, a1 + 0.03, height + 0.05, CORNICE[:8] + [(0, 0.128)], tile=(0.6, 0.6))
        front = FRONT[(round(w.n.x), round(w.n.y))]
        for k in range(6):
            z = 0.12 + k * 0.42
            w.box(B['wood'], a0 + 0.04, a1 - 0.04, 0.0, depth - 0.015, z, z + 0.022)
            if k == 5:
                continue
            aa = a0 + 0.05
            while aa < a1 - 0.07:
                bw = rng.range(0.020, 0.046)
                if aa + bw > a1 - 0.05:
                    break
                bh = rng.range(0.22, 0.36)
                bd = rng.range(0.20, 0.30)
                u0 = rng.range(0.0, 0.96)
                w.box(B['books'], aa, aa + bw, depth - 0.045 - bd, depth - 0.045, z + 0.022, z + 0.022 + bh, tile=(1.0, 1.0),
                      face_uv={front: (u0, 0.02, u0 + 0.04, 0.98)}, skip_back=False)
                aa += bw + 0.002

    bookcase(EAST, 2.85)
    bookcase(EAST, -2.85)

    def settee(w, a_c, length=1.7):
        for sa in (-1, 1):
            for sd in (0.08, 0.56):
                leg = [(0.018, 0.0), (0.022, 0.04), (0.030, 0.10), (0.022, 0.17), (0.026, 0.22)]
                sol.lathe(B['wood'], leg, w.p(a_c + sa * (length / 2 - 0.05), sd, 0.0), seg=12)
        w.box(B['wood'], a_c - length / 2, a_c + length / 2, 0.04, 0.62, 0.22, 0.32)
        w.box(B['wood'], a_c - length / 2, a_c + length / 2, 0.02, 0.10, 0.32, 0.98)                              # back
        w.run(B['wood'], a_c - length / 2 - 0.02, a_c + length / 2 + 0.02, 0.98, [(0, 0), (0.12, 0), (0.12, 0.03), (0.09, 0.07), (0.03, 0.07), (0, 0.05)])
        for sa in (-1, 1):                                                                                          # scroll arms
            aa = a_c + sa * (length / 2 - 0.035)
            w.box(B['wood'], aa - 0.035, aa + 0.035, 0.04, 0.62, 0.32, 0.60)
            sol.lathe(B['wood'], [(0.001, 0), (0.05, 0.0), (0.045, 0.03), (0.05, 0.06), (0.001, 0.06)], w.p(aa, 0.62, 0.60), seg=12)
        cs = w.p(a_c, 0.34, 0.385)
        mk.ellipsoid((cs.x, cs.y, cs.z), (length / 2 - 0.07, 0.27, 0.085), seg=24, rings=10, bm=B['velvet'])
        cb = w.p(a_c, 0.155, 0.64)
        mk.ellipsoid((cb.x, cb.y, cb.z), (length / 2 - 0.10, 0.075, 0.27), seg=24, rings=10, bm=B['velvet'])
        for row in range(2):                                                                                      # tufting buttons
            for col in range(-3, 4):
                bp = w.p(a_c + col * (length / 8.5), 0.228, 0.54 + row * 0.20)
                mk.ellipsoid((bp.x, bp.y, bp.z), (0.012, 0.012, 0.012), seg=8, rings=5, bm=B['brass'])
    settee(NORTH, ax(NORTH, 4.5))
    settee(SOUTH, ax(SOUTH, -5.5))

    def fern(x, y, sc=1.0):
        pot = [(0.001, 0.0), (0.11, 0.0), (0.14, 0.05), (0.16, 0.20), (0.19, 0.29), (0.17, 0.32), (0.15, 0.30), (0.13, 0.28)]
        sol.lathe(B['porcelain'], [(r * sc, h * sc) for r, h in pot], V(x, y, 0.0), seg=24, cap_top=False)
        for k in range(15):
            ang = k * 2 * math.pi / 15 + rng.range(-0.2, 0.2)
            L = rng.range(0.55, 0.9) * sc
            lift = rng.range(0.25, 0.55) * sc
            droop = rng.range(0.25, 0.55) * sc
            d = V(math.cos(ang), math.sin(ang), 0)
            side = V(-d.y, d.x, 0)
            rows = []
            for i in range(9):
                t = i / 8
                centre = V(x, y, 0.29 * sc) + d * (0.05 + L * t) + V(0, 0, lift * math.sin(math.pi * min(1.0, t * 1.25)) - droop * t * t)
                wd = (0.075 * math.sin(math.pi * (0.1 + 0.9 * t)) ** 0.7 + 0.008) * sc
                rows.append([centre - side * wd, centre + V(0, 0, 0.012 * sc), centre + side * wd])
            mk.sheet(rows, flip=False, bm=B['leaf'], uv_rect=(0, 0, 1, 1))

    for wl, xx_ in ((NORTH, -10.5), (SOUTH, 9.5)):
        a = ax(wl, xx_)
        p0 = wl.p(a, 0.30, 0.0)
        fern(p0.x, p0.y)
    for fy in (-2.95, 2.95):
        fern(-11.35, fy, 0.9)

    # ------------------------------------------------------------------------------------------ hanging lamps
    lamp_nodes = []
    for i, lx in enumerate(LAMP_X, start=1):
        base = V(lx, 0.0, 0.0)
        sol.lathe(B['brass'], [(0.001, 0), (0.12, 0.0), (0.12, 0.012), (0.08, 0.03), (0.04, 0.05), (0.02, 0.065), (0.001, 0.065)], base + V(0, 0, CEIL - 0.065), seg=24, cap_bottom=False)  # ceiling rose
        for k in range(9):                                                                                          # chain links
            z = CEIL - 0.07 - k * 0.055
            sol.lathe(B['brass'], [(0.001, 0), (0.014, 0.01), (0.014, 0.04), (0.001, 0.05)], base + V(0, 0, z - 0.05), seg=8, scale=(1.0 if k % 2 else 0.4, 0.4 if k % 2 else 1.0))
        zc = CEIL - 0.07 - 9 * 0.055
        sol.lathe(B['brass'], [(0.001, 0), (0.02, 0.0), (0.04, 0.02), (0.07, 0.05), (0.12, 0.09), (0.13, 0.11), (0.115, 0.115)], base + V(0, 0, zc - 0.115), seg=28, cap_bottom=False, cap_top=False)   # smoke bell
        sol.lathe(B['glass'], [(0.115, 0.0), (0.14, 0.04), (0.20, 0.12), (0.215, 0.20), (0.20, 0.28), (0.15, 0.34), (0.10, 0.37)], base + V(0, 0, zc - 0.115 - 0.37), seg=32, cap_bottom=False, cap_top=False)   # globe
        sol.lathe(B['brass'], [(0.10, 0.0), (0.08, 0.02), (0.06, 0.05), (0.04, 0.12), (0.06, 0.15), (0.001, 0.15)], base + V(0, 0, zc - 0.115 - 0.52), seg=24, cap_bottom=True, cap_top=False)       # oil font
        e = bpy.data.objects.new(f'LAMP_{i}', None)
        bpy.context.scene.collection.objects.link(e)
        e.location = base + V(0, 0, zc - 0.115 - 0.20)
        e['lightColor'] = '#F5C26B'
        e['intensity'] = 1.5
        e['range'] = 8.0
        lamp_nodes.append(e)

    # ------------------------------------------------------------------------------------------ the Garden Vista beyond the Little Door
    # "…the loveliest garden you ever saw. How she longed to get out of that dark hall, and wander about among those beds of
    # bright flowers and those cool fountains." Lit by the only full-saturation sunshine in the chapter (engine: M_S5_G_* glow).
    GX = LITTLE_DOOR_X
    Z0 = -(HALL_Y + TL + 0.0)            # game z where the passage ends

    def gx_(x, z, h=0.0):
        return V(x, -z, h)

    lawn = [[gx_(GX + dx, -4.8 - dz, 0.0) for dx in (-70, 0, 70)] for dz in (0, 20, 70)]
    mk.sheet(lawn, flip=False, bm=B['g_lawn'], uv_rect=(0, 0, 36, 36))
    # gravel path: straight from the passage mouth to a round plaza, then on
    path_rows = []
    for k in range(13):
        zz = -4.8 - k * 1.25
        half = 0.75 if zz > -17.0 else 3.4 * math.sin(math.pi * min(1.0, (-zz - 17.0) / 8.0)) + 0.75
        path_rows.append([gx_(GX - half, zz, 0.012), gx_(GX, zz, 0.012), gx_(GX + half, zz, 0.012)])
    mk.sheet(path_rows, flip=False, bm=B['g_gravel'], uv_rect=(0, 0, 3, 12))
    # hedge walls flanking the path (rounded tops from stacked boxes), with a gap for the plaza
    def hedge(x0, x1, z0, z1, h=1.7):
        for k in range(3):
            inset = k * 0.07
            sol.box(B['g_hedge'], (x0 + inset, -z0 + inset, k * h / 3), (x1 - inset, -z1 - inset, (k + 1) * h / 3 + 0.05), (0.8, 0.8), skip=('nz',))
    for sgn in (-1, 1):
        hedge(GX + sgn * 1.75 - 0.55, GX + sgn * 1.75 + 0.55, -5.2, -15.0)
        hedge(GX + sgn * 6.0 - 0.55, GX + sgn * 6.0 + 0.55, -9.0, -26.0)
        hedge(GX + sgn * 6.0 - 3.0, GX + sgn * 6.0 + 0.55, -26.0, -27.1, 1.9)
    # flower beds + rose bushes
    for sgn in (-1, 1):
        for k in range(9):
            zz = -6.0 - k * 1.6
            cx = GX + sgn * (2.5 + 0.2 * math.sin(k))
            mk.ellipsoid((cx, -zz, 0.0), (rng.range(0.55, 0.85), rng.range(0.45, 0.7), rng.range(0.28, 0.42)), seg=14, rings=8, bm=B['g_bloom'])
    for k in range(14):
        ang = 2 * math.pi * k / 14
        mk.ellipsoid((GX + math.cos(ang) * 4.1, -(-17.0 + math.sin(ang) * 4.1), 0.0), (0.7, 0.7, rng.range(0.55, 0.85)), seg=14, rings=8, bm=B['g_bloom'])
    # fountain: three stone basins, a rising column, a water surface and a spray of droplets
    fz = -17.0
    fc = gx_(GX, fz, 0.0)
    sol.lathe(B['g_stone'], [(0.001, 0), (1.9, 0.0), (2.0, 0.08), (2.0, 0.42), (1.82, 0.46), (1.82, 0.34), (0.001, 0.34)], fc, seg=40, cap_bottom=False, cap_top=False)
    sol.lathe(B['g_water'], [(1.80, 0.30), (0.001, 0.30)], fc, seg=40, cap_bottom=False, cap_top=True)
    sol.lathe(B['g_stone'], [(0.001, 0.30), (0.45, 0.30), (0.40, 0.8), (0.18, 1.0), (0.16, 1.7), (0.52, 1.78), (0.58, 1.92), (0.50, 2.02), (0.001, 2.02)], fc, seg=24, cap_bottom=False, cap_top=False)
    sol.lathe(B['g_water'], [(0.50, 1.96), (0.001, 1.96)], fc, seg=24, cap_bottom=False, cap_top=True)
    sol.lathe(B['g_stone'], [(0.001, 1.98), (0.07, 2.0), (0.06, 2.35), (0.001, 2.55)], fc, seg=12)
    for k in range(18):
        a_ = 2 * math.pi * k / 18
        pts = [fc + V(math.cos(a_) * 0.05 * t * 12, math.sin(a_) * 0.05 * t * 12, 2.45 + 0.35 * math.sin(math.pi * t * 0.9) - 0.12 * t * t * 3) for t in [i / 8 for i in range(9)]]
        mk.tube(pts, rx=0.012, n=5, up_hint=(0, 0, 1), cap_start=False, cap_end=True, bm=B['g_water'])
    # topiary + garden trees (trunk + three canopy lobes)
    for k in range(16):
        tx = GX + rng.range(-34, 34)
        tz = -rng.range(22, 55)
        trunk_h = rng.range(2.2, 3.4)
        pts = [gx_(tx, tz, trunk_h * i / 5) for i in range(6)]
        mk.tube(pts, rx=lambda t: 0.30 * (1 - 0.5 * t), ry=lambda t: 0.30 * (1 - 0.5 * t), n=10, up_hint=(1, 0, 0), cap_start=False, cap_end=True, bm=B['g_bark'], uv_u=(0, 2), uv_v=(0, 2))
        for j in range(4):
            off = V(rng.range(-0.9, 0.9), rng.range(-0.9, 0.9), rng.range(-0.2, 0.9))
            c = gx_(tx, tz, trunk_h + 1.1) + off
            mk.ellipsoid((c.x, c.y, c.z), (rng.range(1.6, 2.3),) * 2 + (rng.range(1.2, 1.7),), seg=16, rings=9, bm=B['g_leaf'])
    for k in range(8):                                                                             # clipped topiary cones
        tx = GX + (-1 if k % 2 else 1) * (2.2 + (k // 2) * 0.0)
        tz = -6.5 - (k // 2) * 2.4
        sol.lathe(B['g_hedge'], [(0.001, 0.0), (0.42, 0.0), (0.46, 0.35), (0.34, 0.75), (0.22, 1.05), (0.001, 1.35)], gx_(tx, tz, 0.0), seg=14, cap_bottom=False)
    # sky backdrop: the painted vista (sun, clouds, far hedgerows)
    mk.sheet([[gx_(GX - 90, -80, 0.0 - 4), gx_(GX + 90, -80, 0.0 - 4)], [gx_(GX - 90, -80, 80), gx_(GX + 90, -80, 80)]], flip=False, bm=B['g_sky'], uv_rect=(0, 0, 1, 1))
    mk.sheet([[gx_(GX - 90, -80, 0.0 - 4), gx_(GX - 90, -2, 0.0 - 4)], [gx_(GX - 90, -80, 80), gx_(GX - 90, -2, 80)]], flip=True, bm=B['g_sky'], uv_rect=(0, 0, 1, 1))
    mk.sheet([[gx_(GX + 90, -2, 0.0 - 4), gx_(GX + 90, -80, 0.0 - 4)], [gx_(GX + 90, -2, 80), gx_(GX + 90, -80, 80)]], flip=True, bm=B['g_sky'], uv_rect=(0, 0, 1, 1))

    # ------------------------------------------------------------------------------------------ objects
    objs = []
    for key, bm in B.items():
        if len(bm.faces) == 0:
            bm.free()
            continue
        o = mk.bm_to_object(bm, 'S5_' + key.capitalize(), M[key])
        objs.append(o)
    print('[build_ch1_s5_hall] triangles:', sum(mk.triangle_count(o) for o in objs))

    def marker(name, loc, **props):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        for k, v in props.items():
            e[k] = v
        return e

    marker('SPAWN_S5', G(-2.2, 0.0, 0.0), targetState='S5_HALL')
    marker('VISTA_ANCHOR', G(LITTLE_DOOR_X, -5.2, 0.0), vistaId='ch1_garden_vista', activeScene='S5_HALL')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=86,
                              export_yup=True, export_apply=False)
    print(f'[build_ch1_s5_hall] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s5_hall.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'ch1_s5_hall.glb'))


if __name__ == '__main__':
    main()
