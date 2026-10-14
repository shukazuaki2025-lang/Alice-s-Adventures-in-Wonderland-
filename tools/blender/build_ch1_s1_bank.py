"""
Build the Chapter 1 / S1 riverbank set ("a sunny afternoon") and export public/assets/models/ch1_s1_bank.glb.

    python3 tools/blender/build_ch1_s1_bank.py

Contents: painted terrain with a carved river channel, flowing-water strip, the ancient oak (trunk, roots, branches,
~70 leaf-cluster canopy), a hedgerow with the rabbit-hole burrow, rocks, toadstools, the picnic rug and three pickable
daisies. Logic markers follow CLAUDE.md §5 (INT_*, SPAWN_*, TRG_*) so SceneLoader can bind them.

Axes: the game uses three.js (x, y-up, z). Blender is Z-up with the glTF exporter mapping Blender (X, Y, Z) -> glTF (X, Z, -Y),
so a game point (x, z) lives at Blender (x, -z) — see `G()`.
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
from lib.meshkit import V, clamp, lerp, smoothstep  # noqa: E402
from world import painters  # noqa: E402

OUT = os.environ.get('S1_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s1_bank.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'ch1_s1_bank.glb')


def G(x, z, h=0.0):
    """Game (x, z, height) -> Blender world."""
    return V(x, -z, h)


# ---------------------------------------------------------------------------------------------------------------
# terrain & water
# ---------------------------------------------------------------------------------------------------------------
RIVER_Z = -9.6


def river_center(x):
    return RIVER_Z + 0.9 * math.sin(x * 0.11) + 0.4 * math.sin(x * 0.27 + 1.0)


def terrain_height(x, z):
    """Game-space height. Exactly 0 on the walkable meadow (z in [-6, 24], |x| <= 34); hills and the channel outside."""
    # river channel
    zc = river_center(x)
    dz = abs(z - zc)
    channel = -0.55 * (1.0 - smoothstep(1.6, 3.3, dz))
    far_bank = smoothstep(-13.0, -34.0, z) * (5.5 + 3.0 * math.sin(x * 0.05 + 0.6) + 1.5 * math.sin(x * 0.13))
    far_bank *= smoothstep(-12.0, -16.0, z)
    north = smoothstep(24.0, 52.0, z) * (4.5 + 2.0 * math.sin(x * 0.06))
    side = smoothstep(34.0, 66.0, abs(x)) * (4.0 + 1.5 * math.sin(z * 0.08 + 1.0))
    levee = 0.12 * math.exp(-((z - (zc + 3.6)) / 0.8) ** 2)
    h = channel + far_bank + north + side + levee
    # keep the walkable meadow perfectly flat
    inside = (1.0 - smoothstep(-5.9, -6.9, z)) * 0.0
    if -6.0 <= z <= 24.0 and abs(x) <= 34.0:
        h = 0.0
    del inside
    return h


def build_terrain(mats):
    xs = [lerp(-72, 72, i / 120) for i in range(121)]
    zs = [lerp(-62, 66, j / 104) for j in range(105)]
    # Blender y = -z; rows run along +Y => z decreasing
    grid = []
    for z in zs[::-1]:
        grid.append([G(x, z, terrain_height(x, z)) for x in xs])
    bm = mk.sheet(grid, flip=False)
    obj = mk.bm_to_object(bm, 'S1_Terrain', mats['ground'])
    mk.uv_planar(obj, ('x', 'y'), scale=(0.25, 0.25), offset=(0.0, 0.0))
    # vertex tint: blue-green aerial perspective in the distance, warm near the play space
    return obj


def build_water(mats):
    cols = 71
    rows = 7
    grid = []
    for r in range(rows):
        t = r / (rows - 1)
        row = []
        for i in range(cols):
            x = lerp(-72, 72, i / (cols - 1))
            zc = river_center(x)
            row.append(G(x, zc + lerp(-3.0, 3.0, t) * 1.0, -0.10))
        grid.append(row)
    bm = mk.sheet(grid[::-1], flip=False)
    obj = mk.bm_to_object(bm, 'Water_River', mats['water'])
    mk.uv_planar(obj, ('x', 'y'), scale=(0.14, 0.14), offset=(0.0, 0.0))
    return obj


# ---------------------------------------------------------------------------------------------------------------
# the oak
# ---------------------------------------------------------------------------------------------------------------
OAK = (-1.5, -2.0)   # game x, z


def build_oak(mats, rng):
    cx, cy = OAK[0], -OAK[1]
    base = V(cx, cy, 0.0)
    # trunk
    bm = bmesh.new()
    pts = []
    n = 14
    for k in range(n):
        t = k / (n - 1)
        z = -0.25 + 3.7 * t
        pts.append(base + V(0.14 * math.sin(z * 1.1), 0.10 * math.cos(z * 0.9), z))
    def tr(t):
        return lerp(0.56, 0.38, t) + 0.34 * math.exp(-t * 7.5)
    mk.tube(pts, rx=tr, ry=tr, n=20, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm,
            uv_u=(0, 3), uv_v=(0, 2.5),
            shape=lambda th, t: 1.0 + 0.10 * math.sin(5 * th + 2.1 * t) + 0.45 * math.exp(-t * 11) * (0.5 + 0.5 * math.cos(5 * th + 0.6)) ** 1.5)
    # root buttresses crawling over the ground
    for k in range(6):
        a = k * math.pi * 2 / 6 + rng.range(-0.2, 0.2)
        d = V(math.cos(a), math.sin(a), 0)
        wob = rng.range(0.15, 0.4)
        side = V(-d.y, d.x, 0)
        rp = [base + d * (0.25 + 2.1 * (i / 10)) + side * (wob * math.sin(i * 0.9 + k)) * (i / 10) + V(0, 0, 0.16 * (1 - i / 10) ** 2 - 0.05) for i in range(11)]
        mk.tube(rp, rx=lambda t: 0.30 * (1 - t) ** 0.8 + 0.045, ry=lambda t: 0.20 * (1 - t) ** 0.8 + 0.04, n=10, up_hint=(0, 0, 1),
                cap_start=False, cap_end=True, bm=bm, uv_u=(0, 1), uv_v=(0, 1))
    # branches
    ends = []
    top = base + V(0.12 * math.sin(3.5 * 1.1), 0.10 * math.cos(3.5 * 0.9), 3.35)
    for k in range(6):
        yaw = math.radians(k * 60 + rng.range(-14, 14))
        elev = math.radians(rng.range(22, 42))
        length = rng.range(2.4, 3.4)
        d = V(math.cos(yaw) * math.cos(elev), math.sin(yaw) * math.cos(elev), math.sin(elev))
        start = top + V(0, 0, rng.range(-0.35, 0.05))
        bp = []
        for i in range(11):
            t = i / 10
            bp.append(start + d * (length * t) + V(0, 0, 0.55 * math.sin(math.pi * t * 0.9)) + V(0.12 * math.sin(7 * t + k), 0.12 * math.cos(6 * t + k), 0))
        mk.tube(bp, rx=lambda t: 0.27 * (1 - t) + 0.05, ry=lambda t: 0.25 * (1 - t) + 0.045, n=9, up_hint=(0, 0, 1),
                cap_start=False, cap_end=True, bm=bm, uv_u=(0, 1), uv_v=(0, 1.2))
        ends.append((bp[-1], bp[len(bp) // 2], d))
        # a fork
        fork_start = bp[6]
        fd = (d * 0.8 + V(-d.y, d.x, 0.45) * (0.5 if k % 2 else -0.5)).normalized()
        fp = [fork_start + fd * (1.5 * i / 7) + V(0, 0, 0.3 * math.sin(math.pi * i / 7)) for i in range(8)]
        mk.tube(fp, rx=lambda t: 0.11 * (1 - t) + 0.03, ry=lambda t: 0.10 * (1 - t) + 0.028, n=8, up_hint=(0, 0, 1),
                cap_start=False, cap_end=True, bm=bm, uv_u=(0, 1), uv_v=(0, 1))
        ends.append((fp[-1], fp[4], fd))
    trunk = mk.bm_to_object(bm, 'S1_Oak_Trunk', mats['bark'])
    mk.uv_triplanar(trunk, scale=0.8)

    # canopy: lumpy leaf clusters, umbrella-shaped, with extra weight over the branch ends
    centres = []
    for (e, mid, d) in ends:
        for j in range(5):
            centres.append((e + V(rng.range(-1.1, 1.1), rng.range(-1.1, 1.1), rng.range(-0.3, 1.2)), rng.range(0.95, 1.5)))
        centres.append((mid + V(rng.range(-0.6, 0.6), rng.range(-0.6, 0.6), rng.range(0.4, 1.3)), rng.range(0.9, 1.3)))
    for j in range(16):
        a = rng.range(0, math.tau)
        r = rng.range(0.0, 2.6)
        centres.append((top + V(math.cos(a) * r, math.sin(a) * r, rng.range(1.0, 2.8)), rng.range(1.0, 1.55)))
    canopy = lumpy_blobs('S1_Oak_Canopy', centres, mats['leaf'], rng, seg=14, rings=9, squash=0.78, uv_scale=0.55)
    return trunk, canopy, centres


def lumpy_blobs(name, centres, material, rng, seg=12, rings=8, squash=0.8, lump=0.16, uv_scale=0.6):
    """Merged lumpy ellipsoids (leaf masses, bushes, rocks). centres: [(Vector, radius)]."""
    bm = bmesh.new()
    for (c, R) in centres:
        ph = [rng.range(0, 6.28) for _ in range(3)]
        before = set(bm.verts)
        mk.ellipsoid((c.x, c.y, c.z), (R, R, R * squash), seg=seg, rings=rings, bm=bm)
        for v in [q for q in bm.verts if q not in before]:
            rel = v.co - c
            n_ = rel.normalized() if rel.length > 1e-6 else V(0, 0, 1)
            d_ = lump * R * (math.sin(3.1 * rel.x / R + ph[0]) * math.sin(2.7 * rel.y / R + ph[1]) + 0.6 * math.sin(4.3 * rel.z / R + ph[2]))
            v.co = v.co + n_ * d_
    obj = mk.bm_to_object(bm, name, material)
    mk.uv_triplanar(obj, scale=uv_scale)
    return obj


# ---------------------------------------------------------------------------------------------------------------
# hedge + burrow, rocks, toadstools, rug, daisies
# ---------------------------------------------------------------------------------------------------------------
HOLE = (14.0, -2.0)


def build_hedge(mats, rng):
    centres = []
    x0 = 15.3
    for k in range(18):
        z = lerp(-6.4, 3.4, k / 17)
        if -3.7 < z < -0.3:
            # leave the burrow mouth clear at ground level, keep foliage above it
            centres.append((G(x0 + rng.range(-0.3, 0.3), z, 1.55 + rng.range(-0.1, 0.2)), rng.range(0.95, 1.25)))
            continue
        centres.append((G(x0 + rng.range(-0.4, 0.4), z, 0.75 + rng.range(-0.1, 0.15)), rng.range(1.0, 1.35)))
        centres.append((G(x0 + rng.range(-0.4, 0.4), z + rng.range(-0.3, 0.3), 1.65 + rng.range(-0.15, 0.25)), rng.range(0.9, 1.2)))
    return lumpy_blobs('S1_Hedge', centres, mats['hedge'], rng, seg=12, rings=8, squash=0.85, lump=0.14, uv_scale=0.6)


def build_burrow(mats, rng):
    """INT_rabbit_hole: root-framed arch + dark mouth, facing -X (towards the meadow)."""
    empty = bpy.data.objects.new('INT_rabbit_hole', None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = G(HOLE[0], HOLE[1], 0.0)
    empty['type'] = 'trigger'
    empty['promptKey'] = 'UI_JUMP_IN'
    bm = bmesh.new()
    pts = []
    for k in range(17):
        a = math.pi * k / 16
        pts.append(V(0.0, math.cos(a) * 0.50, math.sin(a) * 0.52 + 0.02))
    mk.tube(pts, rx=lambda t: 0.10 + 0.04 * math.sin(math.pi * t * 3), ry=0.075, n=9, up_hint=(1, 0, 0), cap_start=True, cap_end=True,
            bm=bm, uv_u=(0, 2), uv_v=(0, 2))
    for sgn in (-1, 1):
        rp = [V(-0.05 * i / 6, sgn * (0.5 + 0.30 * i / 6), 0.03 + 0.06 * math.sin(i)) for i in range(7)]
        mk.tube(rp, rx=lambda t: 0.06 * (1 - t) + 0.015, ry=lambda t: 0.05 * (1 - t) + 0.012, n=7, up_hint=(1, 0, 0), cap_start=False,
                cap_end=True, bm=bm, uv_u=(0, 1), uv_v=(0, 1))
    arch = mk.bm_to_object(bm, 'S1_Burrow_Arch', mats['bark'])
    mk.uv_triplanar(arch, scale=1.2)
    arch.parent = empty
    # dark mouth (recessed disc + soft rim)
    bm2 = bmesh.new()
    ring = lambda r, x: [V(x, math.cos(a) * r, math.sin(a) * r * 1.04 + 0.02) for a in [math.pi * i / 20 for i in range(21)]]
    mk.loft([ring(0.50, 0.02)[::-1], ring(0.46, 0.30)[::-1], ring(0.36, 0.7)[::-1], ring(0.2, 1.1)[::-1]], close_u=False, bm=bm2)
    inner = mk.bm_to_object(bm2, 'S1_Burrow_Mouth', mats['hole'])
    inner.parent = empty
    return empty


def build_rocks(mats, rng):
    spots = [(5.5, -5.3, 0.55), (9.0, -4.7, 0.40), (-4.2, 2.6, 0.45), (20.5, 6.0, 0.62), (-10.5, -4.9, 0.7), (24.0, -4.6, 0.5), (1.0, 13.0, 0.5), (-13.0, 9.0, 0.38), (8.0, 9.5, 0.33)]
    centres = []
    for (x, z, R) in spots:
        centres.append((G(x, z, R * 0.30), R))
        centres.append((G(x + rng.range(-0.5, 0.5), z + rng.range(-0.4, 0.4), R * 0.18), R * 0.6))
    return lumpy_blobs('S1_Rocks', centres, mats['rock'], rng, seg=10, rings=7, squash=0.62, lump=0.22, uv_scale=0.9)


def build_toadstools(mats, rng):
    bm = bmesh.new()
    cbm = bmesh.new()
    spots = [(-3.4, -0.2), (-3.0, -0.9), (-2.7, 0.5), (-3.9, -1.5), (-3.2, -3.4), (1.8, -3.3)]
    for (x, z) in spots:
        h = rng.range(0.10, 0.18)
        r = rng.range(0.055, 0.095)
        stem = [G(x, z, 0.0), G(x, z, h * 0.5), G(x, z, h)]
        mk.tube(stem, rx=r * 0.38, ry=r * 0.36, n=8, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)
        mk.ellipsoid((x, -z, h + 0.01), (r * 1.6, r * 1.6, r * 0.9), seg=12, rings=7, bm=cbm)
    stems = mk.bm_to_object(bm, 'S1_Toadstool_Stems', mats['stem'])
    caps = mk.bm_to_object(cbm, 'S1_Toadstool_Caps', mats['cap'])
    return stems, caps


def build_rug(mats):
    cx, cz = -0.9, -0.1
    hw, hd = 0.95, 0.70
    g = [[G(cx + lerp(-hw, hw, i / 4), cz + lerp(-hd, hd, j / 4), 0.012) for i in range(5)] for j in range(5)]
    bm = mk.sheet(g[::-1], flip=False)
    return mk.bm_to_object(bm, 'S1_PicnicRug', mats['rug'])


def build_daisy(name, x, z, mats, rng):
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = G(x, z, 0.0)
    empty['type'] = 'pickup'
    empty['item'] = name.replace('INT_', '')
    empty['promptKey'] = 'UI_PICK'
    bm = bmesh.new()
    stem = [V(0.0, 0.0, 0.0), V(0.02, 0.01, 0.12), V(0.015, 0.0, 0.26), V(0.0, 0.0, 0.36)]
    mk.tube(stem, rx=0.010, ry=0.010, n=7, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)
    for sgn in (-1, 1):
        lp = [V(0.0, 0.0, 0.07), V(sgn * 0.05, 0.0, 0.10), V(sgn * 0.10, 0.0, 0.09)]
        mk.tube(lp, rx=lambda t: 0.012 * (1 - t) + 0.003, ry=0.003, n=6, up_hint=(0, 1, 0), cap_start=False, cap_end=True, bm=bm)
    st = mk.bm_to_object(bm, name.replace('INT_', '') + '_Stem', mats['stem_green'])
    st.parent = empty
    pbm = bmesh.new()
    top = V(0.0, 0.0, 0.372)
    for k in range(14):
        a = math.tau * k / 14
        d = V(math.cos(a), math.sin(a), 0.0)
        pp = [top + d * 0.012 + V(0, 0, 0.0), top + d * 0.045 + V(0, 0, 0.006), top + d * 0.080 + V(0, 0, 0.004)]
        mk.tube(pp, rx=lambda t: 0.011 * (1 - 0.35 * t), ry=0.0035, n=6, up_hint=(0, 0, 1), cap_start=False, cap_end=True, bm=pbm)
    petals = mk.bm_to_object(pbm, name.replace('INT_', '') + '_Petals', mats['petal'])
    petals.parent = empty
    cbm = bmesh.new()
    mk.ellipsoid((0, 0, 0.378), (0.026, 0.026, 0.018), seg=12, rings=7, bm=cbm)
    centre = mk.bm_to_object(cbm, name.replace('INT_', '') + '_Centre', mats['yellow'])
    centre.parent = empty
    return empty


def add_marker(name, loc, **props):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    for k, v in props.items():
        e[k] = v
    return e


# ---------------------------------------------------------------------------------------------------------------
def main():
    mk.reset_scene()
    rng = mk.Rng(1865)

    def tex(name, arr, rough=0.92):
        img = paint.to_image('T_S1_' + name, arr)
        return paint.make_material('M_S1_' + name, img, roughness=rough)

    def flat(name, hexc, rough=0.8):
        c = paint.srgb_to_linear(paint.hex_rgb(hexc))
        return paint.make_material('M_S1_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough)

    mats = {
        'ground': tex('Ground', painters.ground()),
        'water': tex('Water', painters.water(), 0.25),
        'bark': tex('Bark', painters.bark()),
        'leaf': tex('OakLeaf', painters.leaf(seed=0)),
        'hedge': tex('Hedge', painters.leaf(dark='#2F5A2E', mid='#477C3B', light='#7FB35A', warm='#C8CF68', seed=7)),
        'rock': tex('Rock', painters.rock()),
        'rug': tex('Rug', painters.rug()),
        'hole': flat('BurrowDark', '#1A1210'),
        'stem': flat('ToadstoolStem', '#F1E7D0'),
        'cap': flat('ToadstoolCap', '#C8453B'),
        'stem_green': flat('DaisyStem', '#5B9A45'),
        'petal': flat('DaisyPetal', '#FFFDF4', 0.6),
        'yellow': flat('DaisyCentre', '#F2C230', 0.6),
    }
    build_terrain(mats)
    build_water(mats)
    build_oak(mats, rng)
    build_hedge(mats, rng)
    build_burrow(mats, rng)
    build_rocks(mats, rng)
    build_toadstools(mats, rng)
    build_rug(mats)
    for i, (x, z) in enumerate(((3.6, -1.2), (5.2, 1.1), (7.0, -0.6)), start=1):
        build_daisy(f'INT_daisy_{i}', x, z, mats, rng)
    add_marker('SPAWN_S1', G(2.0, -1.0, 0.0), targetState='S1_BANK', heading='NORTH')
    add_marker('TRG_S2_hole', G(13.5, -2.0, 0.0), triggerId='TRG_S2_HOLE', oneShot=True)
    add_marker('INT_sister_book', G(-0.2, -1.2, 0.5), type='inspect', promptKey='UI_INSPECT', item='ch1_bank_book')
    add_marker('PATH_rabbit_S1', G(-12.0, -3.0, 0.0), targetEntity='chr_rabbit', duration=5)
    add_marker('PATH_rabbit_S2', G(8.5, -1.8, 0.0), targetEntity='chr_rabbit', duration=4)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=86,
                              export_yup=True, export_apply=False)
    print(f'[build_ch1_s1_bank] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'ch1_s1_bank.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'ch1_s1_bank.glb'))


if __name__ == '__main__':
    main()
