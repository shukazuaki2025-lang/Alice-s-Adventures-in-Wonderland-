"""
Build the Chapter 1 / S4 passage — "another long passage… she was just in time to hear it say, as it turned a corner,
'Oh my ears and whiskers, how late it's getting!'" — and export public/assets/models/ch1_s4_passage.glb.

    python3 tools/blender/build_ch1_s4_passage.py        # env S4_OUT=... to write elsewhere

A barrel-vaulted burrow corridor, game x ∈ [-5, 21], 3.2 m wide (matches the SceneLoader walk bounds): brick walls up to the
spring line and packed earth above, flagstones laid slab by slab, stone arch ribs every 2.5 m, brass wall lanterns with glowing
glass, roots hanging from the vault, moss, puddles, and an arched doorway of warm light at the far end.
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
from mathutils import Vector  # noqa: E402

from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V, lerp  # noqa: E402
from world import interior as I  # noqa: E402
from world import painters  # noqa: E402

OUT = os.environ.get('S4_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s4_passage.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'ch1_s4_passage.glb')

X0, X1 = -5.0, 21.0
HALF_W = 1.6
SPRING = 1.0           # height where the vault springs from the walls
CROWN = 2.6            # crown height
T_WALL = 0.2           # section parameter ranges: [0,0.2] left wall, [0.2,0.8] vault, [0.8,1] right wall


def G(x, z, h=0.0):
    return V(x, -z, h)


def section(t):
    """Cross-section point (y_blender, z_up) for t in [0,1], and the unit inward normal (ny, nz)."""
    if t < T_WALL:
        return (HALF_W, SPRING * t / T_WALL), (-1.0, 0.0)
    if t > 1.0 - T_WALL:
        return (-HALF_W, SPRING * (1.0 - (t - (1.0 - T_WALL)) / T_WALL)), (1.0, 0.0)
    a = math.pi * (t - T_WALL) / (1.0 - 2 * T_WALL)
    y, z = HALF_W * math.cos(a), SPRING + (CROWN - SPRING) * math.sin(a)
    gy, gz = y / HALF_W ** 2, (z - SPRING) / (CROWN - SPRING) ** 2
    ln = math.hypot(gy, gz) or 1.0
    return (y, z), (-gy / ln, -gz / ln)


def lump(x, t, amp):
    return amp * (0.5 + 0.25 * math.sin(x * 2.1 + 1.7 * math.sin(t * 17.0)) + 0.25 * math.sin(x * 0.9 - t * 23.0 + 1.0))


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

    M = {
        'brick': tex('Brick', I.brick(2048, 1024, rows=14, per_row=14, seed=4, moss=0.8, damp=0.9), 0.95),
        'earth': tex('Earth', I.earth(1024, 1024), 0.98),
        'flag': tex('Flagstone', I.flagstone(1024, 1024, cells=3, joints=0.22), 0.85),
        'stone': tex('RibStone', painters.rock(512), 0.9),
        'wood': tex('Wood', I.planks(512, 512, n=4, base='#5A3822', seed=17), 0.55),
        'brass': tex('Brass', I.brass(256, 256), 0.35),
        'root': tex('Roots', painters.bark(512), 0.95),
        'moss': tex('Moss', painters.leaf(256, dark='#2F5A2E', mid='#4E8A3E', light='#93C25C', warm='#C8CF68', seed=3), 0.95, double=True),
        'water': tex('Puddle', painters.water(512), 0.15, double=True),
        'glow': flat('LanternGlow', '#FFE7A8', 0.2, emissive='#FFC966'),
        'door': flat('DoorGlow', '#FFE9B0', 0.6, emissive='#FFD27A'),
    }
    B = {k: bmesh.new() for k in M}

    # ---------------------------------------------------------------------------------------- vault skin
    cols, rows = 80, int((X1 - X0) / 0.2) + 1
    grid = []
    for j in range(rows):
        x = lerp(X0, X1, j / (rows - 1))
        row = []
        for i in range(cols):
            t = i / (cols - 1)
            (y, z), (ny, nz) = section(t)
            wall = t < T_WALL or t > 1 - T_WALL
            d = lump(x, t, 0.05 if wall else 0.14)
            row.append(V(x, y + ny * d, z + nz * d))
        grid.append(row)
    zones = {
        'brick': [i for i in range(cols) if i / (cols - 1) <= T_WALL + 0.012 or i / (cols - 1) >= 1 - T_WALL - 0.012],
        'earth': [i for i in range(cols) if T_WALL <= i / (cols - 1) <= 1 - T_WALL],
    }
    for key, idxs in zones.items():
        # brick wall pieces are two separate column runs (left / right wall)
        runs = []
        cur = [idxs[0]]
        for i in idxs[1:]:
            if i == cur[-1] + 1:
                cur.append(i)
            else:
                runs.append(cur)
                cur = [i]
        runs.append(cur)
        for run in runs:
            g = [[row[i] for i in run] for row in grid]
            bm = B[key]
            mk.sheet(g, flip=True, bm=bm)
    for key, tile in (('brick', (0.36, 0.36)), ('earth', (0.30, 0.30))):
        bm = B[key]
        uvl = bm.loops.layers.uv.active
        for f in bm.faces:
            for loop in f.loops:
                p = loop.vert.co
                arc = p.z if key == 'brick' else (math.atan2(p.z - SPRING, p.y) * 1.6)
                loop[uvl].uv = (p.x * tile[0], arc * tile[1])

    # ---------------------------------------------------------------------------------------- floor: flagstones slab by slab
    xs = X0
    while xs < X1 - 0.05:
        slab_len = rng.range(0.75, 1.2)
        xe = min(X1, xs + slab_len)
        cuts = sorted(rng.range(-HALF_W + 0.6, HALF_W - 0.6) for _ in range(2))
        edges = [-HALF_W] + cuts + [HALF_W]
        for a, b in zip(edges[:-1], edges[1:]):
            lift = rng.range(-0.012, 0.012)
            gap = 0.012
            sol.box(B['flag'], (xs + gap, a + gap, -0.05 + lift), (xe - gap, b - gap, 0.0 + lift), (0.34, 0.34), skip=('nz',))
        xs = xe

    # ---------------------------------------------------------------------------------------- stone arch ribs
    n_pts = 36
    for k in range(11):
        rx = -4.0 + 2.5 * k
        wall_pts, in_pts = [], []
        for i in range(n_pts + 1):
            t = i / n_pts
            (y, z), (ny, nz) = section(t)
            wall_pts.append((y, z))
            in_pts.append((y + ny * 0.13, z + nz * 0.13))
        def strip(xa, pa, xb, pb, flip):
            g = [[V(xa, y, z) for y, z in pa], [V(xb, y, z) for y, z in pb]]
            mk.sheet(g, flip=flip, bm=B['stone'], uv_rect=(0, 0, 8, 1))
        strip(rx - 0.15, in_pts, rx + 0.15, in_pts, True)
        strip(rx - 0.15, wall_pts, rx - 0.15, in_pts, True)
        strip(rx + 0.15, in_pts, rx + 0.15, wall_pts, True)

    # ---------------------------------------------------------------------------------------- brass lanterns on the walls
    lamp_nodes = []
    for i, lx in enumerate((-3.0, 2.0, 7.0, 12.0, 17.0), start=1):
        for sgn in (-1, 1):
            y = sgn * (HALF_W - 0.03)
            c = V(lx, y - sgn * 0.14, 1.45)
            sol.lathe(B['brass'], [(0.001, 0), (0.05, 0.0), (0.06, 0.02), (0.04, 0.05), (0.001, 0.05)], c + V(0, 0, -0.14), seg=14)
            sol.lathe(B['glow'], [(0.045, 0.0), (0.060, 0.05), (0.062, 0.12), (0.050, 0.19), (0.015, 0.24)], c + V(0, 0, -0.10), seg=14, cap_bottom=False)
            sol.lathe(B['brass'], [(0.001, 0), (0.07, 0.0), (0.05, 0.03), (0.02, 0.07), (0.001, 0.08)], c + V(0, 0, 0.15), seg=14)
            for q in range(4):
                a = q * math.pi / 2 + math.pi / 4
                sol.lathe(B['brass'], [(0.004, 0), (0.004, 0.26)], c + V(math.cos(a) * 0.058, math.sin(a) * 0.058, -0.10), seg=5)
            lo, hi = sorted((y, c.y))
            sol.box(B['brass'], (lx - 0.012, lo, 1.30), (lx + 0.012, hi, 1.32), (4, 4))             # bracket arm
            sol.box(B['brass'], (lx - 0.05, y - 0.012, 1.22), (lx + 0.05, y + 0.012, 1.46), (3, 3))
        e = bpy.data.objects.new(f'LAMP_{i}', None)
        bpy.context.scene.collection.objects.link(e)
        e.location = V(lx, 0.0, 2.2)
        e['lightColor'] = '#F5C26B'
        e['intensity'] = 1.2
        e['range'] = 7.0
        lamp_nodes.append(e)

    # ---------------------------------------------------------------------------------------- roots, moss, puddles
    for _ in range(90):
        x = rng.range(X0 + 0.3, X1 - 0.3)
        t = rng.range(0.26, 0.74)
        (y, z), (ny, nz) = section(t)
        base = V(x, y + ny * 0.03, z + nz * 0.03)
        Lr = rng.range(0.25, 0.95)
        pts = [base + V(rng.range(-0.03, 0.03) * i / 6, rng.range(-0.03, 0.03) * i / 6, -Lr * i / 6) for i in range(7)]
        mk.tube(pts, rx=lambda tt: 0.022 * (1 - tt) + 0.004, ry=lambda tt: 0.022 * (1 - tt) + 0.004, n=6, up_hint=(1, 0, 0),
                cap_start=False, cap_end=True, bm=B['root'])
    for _ in range(70):
        x = rng.range(X0 + 0.3, X1 - 0.3)
        sgn = 1 if rng.range(0, 1) > 0.5 else -1
        yb = sgn * (HALF_W - 0.045)
        z0 = rng.range(0.05, 0.9)
        r_ = rng.range(0.10, 0.28)
        g = [[V(x - r_ + 2 * r_ * i / 3, yb - sgn * (0.012 + 0.025 * math.sin(math.pi * i / 3) * math.sin(math.pi * j / 3)), z0 + 1.8 * r_ * j / 3)
              for i in range(4)] for j in range(4)]
        mk.sheet(g, flip=sgn > 0, bm=B['moss'])
    for _ in range(9):
        cx, cy = rng.range(X0 + 1.0, X1 - 1.0), rng.range(-1.0, 1.0)
        rx_, ry_ = rng.range(0.25, 0.7), rng.range(0.18, 0.4)
        rings_ = [[V(cx + math.cos(a) * rx_ * r, cy + math.sin(a) * ry_ * r, 0.004) for a in [2 * math.pi * i / 18 for i in range(18)]] for r in (0.02, 0.55, 1.0)]
        mk.loft(rings_, close_u=True, bm=B['water'])

    # ---------------------------------------------------------------------------------------- far end: arched doorway of warm light
    xe = X1 - 0.02
    sol.box(B['door'], (xe - 0.01, -0.95, 0.0), (xe, 0.95, 2.05), (1, 1), skip=('px', 'nx', 'py', 'ny', 'pz', 'nz'))
    sol.quad(B['door'], V(xe, 0.95, 0.0), V(xe, -0.95, 0.0), V(xe, -0.95, 2.05), V(xe, 0.95, 2.05))
    for sgn in (-1, 1):
        lo, hi = (0.95, 1.13) if sgn > 0 else (-1.13, -0.95)
        sol.box(B['stone'], (xe - 0.30, lo, 0.0), (xe, hi, 2.30), (0.8, 0.8))
    sol.box(B['stone'], (xe - 0.30, -1.13, 2.05), (xe, 1.13, 2.30), (0.8, 0.8))

    objs = []
    for key, bm in B.items():
        if len(bm.faces) == 0:
            bm.free()
            continue
        o = mk.bm_to_object(bm, 'S4_' + key.capitalize(), M[key])
        objs.append(o)
    print('[build_ch1_s4_passage] triangles:', sum(mk.triangle_count(o) for o in objs))

    def marker(name, loc, **props):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        for k, v in props.items():
            e[k] = v

    marker('SPAWN_S4', G(-2.0, 0.0, 0.0), targetState='S4_PASSAGE')
    marker('TRG_S4_exit', G(18.0, 0.0, 0.0), triggerId='TRG_S4_EXIT')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=86,
                              export_yup=True, export_apply=False)
    print(f'[build_ch1_s4_passage] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s4_passage.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'ch1_s4_passage.glb'))


if __name__ == '__main__':
    main()
