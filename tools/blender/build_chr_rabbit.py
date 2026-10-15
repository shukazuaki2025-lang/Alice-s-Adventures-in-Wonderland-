"""
Build the White Rabbit (0.75 m including ears, upright, brown-and-cream checked coat, mustard waistcoat — never without it — brass pocket
watch on a chain, pink eyes) -> public/assets/models/chr_rabbit.glb

    python3 tools/blender/build_chr_rabbit.py            # env RABBIT_OUT=... to write elsewhere

Painted fur / plaid / brocade textures (procedural), 31-bone rig, clips: Rabbit_Scurry, Rabbit_Hurry, Rabbit_CheckWatch, Rabbit_LookBack.
Axes: Blender, the character faces -Y, his left is +X, +Z up (glTF: faces +Z).
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

import build_chr_alice as bca  # noqa: E402
from alice import anim as A  # noqa: E402
from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import rigkit  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V, lerp, smoothstep  # noqa: E402
from lib.rigkit import Bone  # noqa: E402
from world import interior as I  # noqa: E402
from world import props_tex as PT  # noqa: E402
from world import rabbit_tex as RT  # noqa: E402

OUT = os.environ.get('RABBIT_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'chr_rabbit.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'chr_rabbit.glb')


def side_bones(s, sn):
    return [
        Bone(f'Ear_{sn}_1', (0.028 * s, 0.0, 0.585), (0.041 * s, 0.014, 0.650), 'Head'),
        Bone(f'Ear_{sn}_2', (0.041 * s, 0.014, 0.650), (0.040 * s, 0.040, 0.745), f'Ear_{sn}_1'),
        Bone(f'UpperArm_{sn}', (0.082 * s, 0.0, 0.425), (0.108 * s, -0.030, 0.345), 'Chest'),
        Bone(f'LowerArm_{sn}', (0.108 * s, -0.030, 0.345), (0.098 * s, -0.075, 0.282), f'UpperArm_{sn}'),
        Bone(f'Hand_{sn}', (0.098 * s, -0.075, 0.282), (0.095 * s, -0.108, 0.246), f'LowerArm_{sn}'),
        Bone(f'SOCKET_Hand{sn}', (0.095 * s, -0.108, 0.246), (0.095 * s, -0.12, 0.236), f'Hand_{sn}', deform=False),
        Bone(f'Thigh_{sn}', (0.042 * s, 0.020, 0.230), (0.050 * s, -0.010, 0.130), 'Hips'),
        Bone(f'Calf_{sn}', (0.050 * s, -0.010, 0.130), (0.050 * s, 0.015, 0.045), f'Thigh_{sn}'),
        Bone(f'Foot_{sn}', (0.050 * s, 0.015, 0.045), (0.050 * s, -0.050, 0.020), f'Calf_{sn}'),
        Bone(f'Toe_{sn}', (0.050 * s, -0.050, 0.020), (0.050 * s, -0.088, 0.014), f'Foot_{sn}'),
    ]


BONES = [
    Bone('Root', (0, 0, 0), (0, 0, 0.05), None, deform=False),
    Bone('Hips', (0, 0.020, 0.230), (0, 0.020, 0.300), 'Root'),
    Bone('Spine', (0, 0.020, 0.300), (0, 0.015, 0.375), 'Hips'),
    Bone('Chest', (0, 0.015, 0.375), (0, 0.010, 0.445), 'Spine'),
    Bone('Neck', (0, 0.010, 0.445), (0, -0.005, 0.485), 'Chest'),
    Bone('Head', (0, -0.005, 0.485), (0, -0.012, 0.600), 'Neck'),
    Bone('Tail', (0, 0.075, 0.205), (0, 0.105, 0.215), 'Hips'),
] + side_bones(1, 'L') + side_bones(-1, 'R')


def distance_w(names=None, bones=BONES):
    seg = {b.name: (b.head, b.tail) for b in bones if b.deform}
    use = names or list(seg)

    def fn(co):
        return rigkit.distance_weights(co, seg, use)
    return fn


def torso_w(co):
    z = co.z
    wc = smoothstep(0.35, 0.40, z)
    wh = 1.0 - smoothstep(0.26, 0.31, z)
    return {'Chest': wc, 'Spine': max(0.0, 1.0 - wc - wh), 'Hips': wh}


def main():
    mk.reset_scene()
    rng = mk.Rng(1865)

    def tex(name, arr, rough=0.9, double=False):
        return paint.make_material('M_Rabbit_' + name, paint.to_image('T_Rabbit_' + name, arr), roughness=rough, double_sided=double)

    def flat(name, hexc, rough=0.5, emissive=None):
        c = paint.srgb_to_linear(paint.hex_rgb(hexc))
        em = None
        if emissive:
            e = paint.srgb_to_linear(paint.hex_rgb(emissive))
            em = (float(e[0]), float(e[1]), float(e[2]))
        return paint.make_material('M_Rabbit_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, emissive=em)

    M = {
        'fur': tex('Fur', RT.fur(1024), 0.95),
        'ear': tex('EarInner', RT.ear_inner(512), 0.9),
        'coat': tex('Coat', RT.coat_check(1024), 0.95, double=True),
        'vest': tex('Waistcoat', RT.waistcoat(512), 0.6),
        'silk': tex('BowTie', RT.silk(256), 0.5, double=True),
        'eye': tex('Eyes', RT.eye(256), 0.3),
        'brass': tex('Brass', I.brass(512, 512, seed=21), 0.3),
        'dial': tex('WatchDial', PT.watch_dial(512), 0.4),
        'nose': flat('Nose', '#E88FA3', 0.4),
        'dark': flat('Dark', '#2A1A1E', 0.7),
    }

    def part(name, build, mat, solidify=None):
        bm = bmesh.new()
        build(bm)
        o = bca.obj_from_bm(bm, name, [M[mat]])
        if solidify:
            mk.add_solidify(o, solidify, -1.0)
            mk.apply_modifiers(o)
        return o

    objs = {}

    # ------------------------------------------------------------------------------------------ waistcoat (torso) + coat
    def build_vest(bm):
        rings = []
        for z, rx, ry, cy in ((0.235, 0.074, 0.062, 0.022), (0.27, 0.078, 0.068, 0.018), (0.31, 0.080, 0.070, 0.012), (0.35, 0.079, 0.066, 0.012),
                              (0.39, 0.074, 0.060, 0.012), (0.425, 0.064, 0.052, 0.010), (0.447, 0.046, 0.040, 0.008)):
            rings.append(mk.ring_around(V(0, cy, z), V(1, 0, 0), V(0, 1, 0), rx, ry, 32))
        mk.loft(rings, True, True, True, bm=bm, uv_u=(0, 1), uv_v=(0, 1))
    vest = part('Rabbit_Waistcoat', build_vest, 'vest')
    mk.uv_triplanar(vest, scale=6.0)
    objs['vest'] = (vest, torso_w)

    def build_coat(bm):
        rows = []
        zs = [0.452, 0.44, 0.415, 0.385, 0.35, 0.315, 0.28, 0.25, 0.22, 0.195, 0.17]
        cols = 56
        for j, z in enumerate(zs):
            row = []
            for i in range(cols):
                th = lerp(math.radians(26), math.radians(334), i / (cols - 1))
                flare = smoothstep(0.38, 0.17, z)
                a = lerp(0.088, 0.118, flare)
                b = lerp(0.073, 0.098, flare)
                zz = z
                # swallow-tails: the back hem drops a further 3-4 cm, split by a centre vent
                back = math.exp(-((math.degrees(th) - 180.0) / 40.0) ** 2)
                zz = z - 0.04 * back * smoothstep(0.30, 0.17, z)
                if abs(math.degrees(th) - 180.0) < 1.7 and z < 0.27:
                    zz = 0.27 + (z - 0.27) * 0.2
                ruffle = 0.006 * math.sin(11 * th) * flare
                row.append(V((a + ruffle) * math.sin(th), 0.016 - (b + ruffle) * math.cos(th), zz))
            rows.append(row)
        mk.sheet(rows, flip=True, bm=bm)
    coat = part('Rabbit_Coat', build_coat, 'coat', 0.007)
    mk.uv_triplanar(coat, scale=8.0)
    objs['coat'] = (coat, lambda co: {'Hips': 1.0 - smoothstep(0.24, 0.33, co.z), 'Spine': smoothstep(0.24, 0.33, co.z) * (1 - smoothstep(0.36, 0.42, co.z)),
                                      'Chest': smoothstep(0.36, 0.42, co.z)})

    def build_collar(bm):
        rings = []
        for z, r, ry, cy in ((0.436, 0.062, 0.052, 0.008), (0.448, 0.058, 0.049, 0.006), (0.458, 0.056, 0.047, 0.004), (0.462, 0.064, 0.055, 0.0)):
            rings.append(mk.ring_around(V(0, cy, z), V(1, 0, 0), V(0, 1, 0), r, ry, 28))
        mk.loft(rings, True, False, False, bm=bm)
    collar = part('Rabbit_Collar', build_collar, 'coat', 0.004)
    mk.uv_triplanar(collar, scale=8.0)
    objs['collar'] = (collar, lambda co: {'Chest': 0.6, 'Neck': 0.4})

    # sleeves (checked) + cream cuffs + fur forearms/paws
    def build_sleeves(bm):
        for s in (1, -1):
            pts = [V(0.082 * s, 0.0, 0.428), V(0.095 * s, -0.012, 0.395), V(0.108 * s, -0.030, 0.345), V(0.104 * s, -0.052, 0.310), V(0.099 * s, -0.070, 0.292)]
            mk.tube(pts, rx=[0.032, 0.030, 0.027, 0.025, 0.024], ry=[0.030, 0.029, 0.026, 0.024, 0.023], n=16, up_hint=(0, 1, 0), cap_start=True, cap_end=False, bm=bm)
    sleeves = part('Rabbit_Sleeves', build_sleeves, 'coat')
    mk.uv_triplanar(sleeves, scale=8.0)
    objs['sleeves'] = (sleeves, lambda co: distance_w(['UpperArm_L' if co.x >= 0 else 'UpperArm_R', 'LowerArm_L' if co.x >= 0 else 'LowerArm_R', 'Chest'])(co))

    def build_cuffs(bm):
        for s in (1, -1):
            pts = [V(0.099 * s, -0.068, 0.294), V(0.098 * s, -0.076, 0.282), V(0.097 * s, -0.083, 0.271)]
            mk.tube(pts, rx=[0.028, 0.029, 0.028], ry=[0.026, 0.027, 0.026], n=16, up_hint=(0, 1, 0), cap_start=False, cap_end=False, bm=bm)
    cuffs = part('Rabbit_Cuffs', build_cuffs, 'silk', 0.003)
    objs['cuffs'] = (cuffs, lambda co: {'LowerArm_L' if co.x >= 0 else 'LowerArm_R': 1.0})

    # ------------------------------------------------------------------------------------------ fur body parts
    def build_fur(bm):
        # neck
        mk.tube([V(0, 0.010, 0.44), V(0, 0.002, 0.468), V(0, -0.006, 0.495)], rx=[0.036, 0.032, 0.034], ry=[0.034, 0.030, 0.034], n=18, up_hint=(0, -1, 0), cap_start=True, cap_end=True, bm=bm)
        # forearms + paws
        for s in (1, -1):
            mk.tube([V(0.099 * s, -0.070, 0.292), V(0.097 * s, -0.090, 0.268), V(0.095 * s, -0.106, 0.250)], rx=[0.017, 0.015, 0.015], ry=[0.016, 0.014, 0.014], n=12, up_hint=(0, 1, 0), cap_start=False, cap_end=True, bm=bm)
            mk.ellipsoid((0.095 * s, -0.112, 0.242), (0.0185, 0.022, 0.026), seg=14, rings=9, bm=bm)
            for k, off in enumerate((-0.009, 0.0, 0.009)):
                mk.ellipsoid((0.095 * s + off, -0.128, 0.234), (0.0068, 0.012, 0.0072), seg=8, rings=5, bm=bm)
        # legs (hind legs: stout thighs, long calves, big feet)
        for s in (1, -1):
            mk.tube([V(0.042 * s, 0.020, 0.235), V(0.046 * s, 0.005, 0.185), V(0.050 * s, -0.010, 0.135)], rx=[0.034, 0.032, 0.026], ry=[0.034, 0.032, 0.026], n=14, up_hint=(0, -1, 0), cap_start=True, cap_end=False, bm=bm)
            mk.tube([V(0.050 * s, -0.010, 0.135), V(0.050 * s, 0.004, 0.090), V(0.050 * s, 0.014, 0.045)], rx=[0.026, 0.020, 0.017], ry=[0.026, 0.020, 0.017], n=12, up_hint=(0, -1, 0), cap_start=False, cap_end=False, bm=bm)
            mk.ellipsoid((0.050 * s, -0.028, 0.020), (0.021, 0.064, 0.0185), seg=16, rings=10, bm=bm)
            for k, off in enumerate((-0.011, 0.0, 0.011)):
                mk.ellipsoid((0.050 * s + off, -0.086, 0.014), (0.0075, 0.014, 0.0078), seg=8, rings=5, bm=bm)
        # tail puff
        mk.ellipsoid((0, 0.086, 0.205), (0.030, 0.032, 0.030), seg=16, rings=10, bm=bm)
    body = part('Rabbit_Body', build_fur, 'fur')
    mk.uv_triplanar(body, scale=2.4)
    mk.add_subsurf(body, 1)
    mk.apply_modifiers(body)
    objs['body'] = (body, lambda co: distance_w(None)(co))

    def build_head(bm):
        mk.ellipsoid((0, -0.012, 0.535), (0.058, 0.062, 0.062), seg=28, rings=18, bm=bm)               # skull
        mk.ellipsoid((0, -0.066, 0.508), (0.033, 0.040, 0.032), seg=20, rings=12, bm=bm)               # muzzle
        mk.ellipsoid((0, -0.056, 0.474), (0.027, 0.030, 0.020), seg=14, rings=9, bm=bm)                # chin
        for s in (1, -1):
            mk.ellipsoid((0.030 * s, -0.070, 0.500), (0.028, 0.030, 0.026), seg=16, rings=10, bm=bm)    # cheeks
            mk.ellipsoid((0.042 * s, -0.034, 0.585), (0.020, 0.020, 0.026), seg=12, rings=8, bm=bm)     # ear roots
    head = part('Rabbit_Head', build_head, 'fur')
    mk.uv_triplanar(head, scale=3.0)
    mk.add_subsurf(head, 1)
    mk.apply_modifiers(head)
    objs['head'] = (head, lambda co: {'Head': 1.0})

    def build_nose(bm):
        mk.ellipsoid((0, -0.101, 0.514), (0.012, 0.009, 0.009), seg=12, rings=8, bm=bm)
    nose = part('Rabbit_Nose', build_nose, 'nose')
    objs['nose'] = (nose, lambda co: {'Head': 1.0})

    def build_mouth(bm):
        for s in (1, -1):
            mk.tube([V(0.0, -0.098, 0.505), V(0.010 * s, -0.099, 0.497), V(0.022 * s, -0.092, 0.494), V(0.030 * s, -0.084, 0.497)], rx=0.0012, n=5, up_hint=(0, 0, 1), cap_start=True, cap_end=True, bm=bm)
        mk.tube([V(0.0, -0.101, 0.510), V(0.0, -0.100, 0.500)], rx=0.0012, n=5, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)
    mouth = part('Rabbit_Mouth', build_mouth, 'dark')
    objs['mouth'] = (mouth, lambda co: {'Head': 1.0})

    def build_whiskers(bm):
        for s in (1, -1):
            for k in range(3):
                z = 0.506 + (k - 1) * 0.011
                droop = -0.004 * (k - 1)
                mk.tube([V(0.034 * s, -0.086, z), V(0.065 * s, -0.095, z + droop + 0.004), V(0.100 * s, -0.090, z + droop - 0.004)],
                        rx=lambda t: 0.0008 * (1 - 0.7 * t), n=4, up_hint=(0, 0, 1), cap_start=True, cap_end=True, bm=bm)
    whisk = part('Rabbit_Whiskers', build_whiskers, 'fur')
    objs['whisk'] = (whisk, lambda co: {'Head': 1.0})

    def build_teeth(bm):
        for s in (1, -1):
            sol.box(bm, (0.0015 if s > 0 else -0.0105, -0.1005, 0.4625), (0.0105 if s > 0 else -0.0015, -0.0975, 0.4745), (80, 80))
    teeth = part('Rabbit_Teeth', build_teeth, 'silk')
    objs['teeth'] = (teeth, lambda co: {'Head': 1.0})

    def build_brows(bm):
        for s in (1, -1):
            mk.tube([V(0.020 * s, -0.062, 0.575), V(0.036 * s, -0.066, 0.580), V(0.050 * s, -0.058, 0.576)], rx=lambda t: 0.0045 * (1 - 0.5 * t), n=8, up_hint=(0, 0, 1), cap_start=True, cap_end=True, bm=bm)
    brows = part('Rabbit_BrowTufts', build_brows, 'fur')
    objs['brows'] = (brows, lambda co: {'Head': 1.0})

    def build_pockets(bm):
        for s in (1, -1):
            sol.box(bm, (0.040 * s - 0.022, -0.1015, 0.235), (0.040 * s + 0.022, -0.0915, 0.262), (8, 8))
            sol.box(bm, (0.040 * s - 0.025, -0.1045, 0.262), (0.040 * s + 0.025, -0.0925, 0.270), (8, 8))
    pockets = part('Rabbit_PocketFlaps', build_pockets, 'coat')
    objs['pockets'] = (pockets, torso_w)

    # eyes (planar-UV discs of painted iris) — big, round, pink
    eye_objs = []
    for s in (1, -1):
        bm = bmesh.new()
        cx, cy, cz = 0.036 * s, -0.060, 0.552
        rx, ry, rz = 0.0165, 0.0095, 0.019
        mk.ellipsoid((cx, cy, cz), (rx, ry, rz), seg=20, rings=12, bm=bm)
        e = bca.obj_from_bm(bm, f'Rabbit_Eye_{"L" if s > 0 else "R"}', [M['eye']])
        uvl = e.data.uv_layers.get('UVMap') or e.data.uv_layers.new(name='UVMap')
        for poly in e.data.polygons:
            for li in poly.loop_indices:
                co = e.data.vertices[e.data.loops[li].vertex_index].co
                uvl.data[li].uv = (0.5 + (co.x - cx) / (2 * rx), 0.5 + (co.z - cz) / (2 * rz))
        e.data.materials.clear()
        e.data.materials.append(M['eye'])
        objs[f'eye{s}'] = (e, lambda co: {'Head': 1.0})
        eye_objs.append(e)

    # ears: flat tapered ribbons leaning back and slightly out, with a pink inner face
    def ear_path(s):
        return [V(0.028 * s, 0.0, 0.585), V(0.036 * s, 0.008, 0.625), V(0.041 * s, 0.016, 0.668), V(0.043 * s, 0.028, 0.710), V(0.040 * s, 0.046, 0.745)]

    def build_ears(bm):
        for s in (1, -1):
            wid = [0.022, 0.026, 0.026, 0.021, 0.008]
            mk.tube(ear_path(s), rx=wid, ry=[0.0075, 0.0075, 0.0075, 0.006, 0.004], n=14, up_hint=(0, 1, 0), cap_start=True, cap_end=True, bm=bm)
    ears = part('Rabbit_Ears', build_ears, 'fur')
    mk.uv_triplanar(ears, scale=3.0)
    mk.add_subsurf(ears, 1)
    mk.apply_modifiers(ears)
    objs['ears'] = (ears, lambda co: distance_w(['Head', 'Ear_L_1' if co.x >= 0 else 'Ear_R_1', 'Ear_L_2' if co.x >= 0 else 'Ear_R_2'])(co))

    def build_ear_inner(bm):
        for s in (1, -1):
            path = ear_path(s)
            widths = [0.016, 0.020, 0.020, 0.0155, 0.004]
            grid = []
            for p, wd in zip(path, widths):
                grid.append([p + V(-wd * k * 1.0, -0.0102, 0.0) for k in (1, 0.5, 0, -0.5, -1)])
            mk.sheet(grid, flip=(s > 0), bm=bm, uv_rect=(0, 0, 1, 1))
    ear_in = part('Rabbit_EarInner', build_ear_inner, 'ear')
    objs['ear_in'] = (ear_in, lambda co: distance_w(['Head', 'Ear_L_1' if co.x >= 0 else 'Ear_R_1', 'Ear_L_2' if co.x >= 0 else 'Ear_R_2'])(co))
    ear_in.data.materials[0].use_backface_culling = False

    # cravat + buttons
    def build_cravat(bm):
        mk.ellipsoid((0, -0.046, 0.462), (0.016, 0.012, 0.012), seg=14, rings=8, bm=bm)
        for s in (1, -1):
            g = [[V(0.0 + 0.012 * s * (i / 3.0), -0.050 - 0.004 * i, 0.462 + 0.016 * (j - 1)) for i in range(4)] for j in range(3)]
            mk.sheet(g, flip=(s > 0), bm=bm, uv_rect=(0, 0, 1, 1))
            g2 = [[V(0.012 * s + 0.020 * s * (i / 3.0), -0.054 - 0.004 * i, 0.462 + 0.022 * (j - 1) * (1 + i / 3.0)) for i in range(4)] for j in range(3)]
            mk.sheet(g2, flip=(s > 0), bm=bm, uv_rect=(0, 0, 1, 1))
    cravat = part('Rabbit_Cravat', build_cravat, 'silk')
    objs['cravat'] = (cravat, lambda co: {'Chest': 0.5, 'Neck': 0.5})

    def build_buttons(bm):
        front = lambda z: 0.012 - (0.066 + 0.006 * math.sin(math.pi * min(1.0, max(0.0, (z - 0.24) / 0.20))))
        for k in range(5):
            z = 0.262 + k * 0.034
            sol.lathe(bm, [(0.001, 0), (0.0085, 0.0), (0.0095, 0.002), (0.0070, 0.0045), (0.001, 0.0050)], center=(0.0, front(z) - 0.001, z), seg=14, axis=(0, -1, 0))
        for s in (1, -1):
            for z in (0.395, 0.335):
                sol.lathe(bm, [(0.001, 0), (0.0095, 0.0), (0.011, 0.002), (0.0085, 0.005), (0.001, 0.0056)], center=(0.040 * s, -0.0535, z), seg=14, axis=(0, -1, 0))
    buttons = part('Rabbit_Buttons', build_buttons, 'brass')
    objs['buttons'] = (buttons, torso_w)

    # pocket watch in the right hand + chain to the waistcoat
    def build_watch(bm):
        axv = Vector((0, -1, 0))
        c = V(-0.097, -0.128, 0.222)
        sol.lathe(bm, [(0.001, 0.0), (0.0205, 0.0), (0.0220, 0.002), (0.0220, 0.0085), (0.0210, 0.0095), (0.0200, 0.0088)], center=c, seg=36, axis=axv, cap_top=False)
        sol.lathe(bm, [(0.001, 0.0), (0.0036, 0.0), (0.0040, 0.003), (0.0034, 0.006), (0.001, 0.0066)], center=c + V(0, 0.0, 0.022), seg=12, axis=(0, 0, 1))
        ring = [c + V(0.0065 * math.cos(a), 0.0, 0.0285 + 0.0065 * math.sin(a)) for a in [2 * math.pi * i / 20 for i in range(21)]]
        mk.tube(ring, rx=0.0011, n=6, up_hint=(0, 1, 0), cap_start=False, cap_end=False, bm=bm)
    watch = part('Rabbit_Watch', build_watch, 'brass')
    objs['watch'] = (watch, lambda co: {'Hand_R': 1.0})

    def build_watch_face(bm):
        c = V(-0.097, -0.1385, 0.222)
        cv = bm.verts.new(c)
        uv = bm.loops.layers.uv.new('UVMap')
        rv = [bm.verts.new(c + V(0.0192 * math.cos(2 * math.pi * i / 36), 0.0, 0.0192 * math.sin(2 * math.pi * i / 36))) for i in range(36)]
        for i in range(36):
            f = bm.faces.new((cv, rv[i], rv[(i + 1) % 36]))
            for loop in f.loops:
                p = loop.vert.co
                loop[uv].uv = (0.5 + (p.x - c.x) / 0.0384, 0.5 + (p.z - c.z) / 0.0384)
    face = part('Rabbit_WatchDial', build_watch_face, 'dial')
    objs['face'] = (face, lambda co: {'Hand_R': 1.0})

    def build_chain(bm):
        pts = [V(-0.097, -0.128, 0.256), V(-0.080, -0.122, 0.285), V(-0.058, -0.108, 0.300), V(-0.040, -0.092, 0.322), V(-0.032, -0.083, 0.362)]
        smooth = []
        for a, b in zip(pts[:-1], pts[1:]):
            for k in range(4):
                smooth.append(a.lerp(b, k / 4) + V(0, 0, -0.006 * math.sin(math.pi * k / 4)))
        smooth.append(pts[-1])
        mk.tube(smooth, rx=0.0012, n=6, up_hint=(0, 1, 0), cap_start=True, cap_end=True, bm=bm)
    chain = part('Rabbit_Chain', build_chain, 'brass')
    objs['chain'] = (chain, lambda co: {'Hand_R': smoothstep(0.30, 0.25, co.z), 'Chest': 1.0 - smoothstep(0.30, 0.25, co.z)})

    # ------------------------------------------------------------------------------------------ rig
    rig = rigkit.build_armature('Rabbit_Rig', BONES)
    for key, (o, fn) in objs.items():
        rigkit.apply_weights(o, fn)
        rigkit.bind(o, rig)
    rig['character'] = 'White_Rabbit'
    rig['height'] = 0.75
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for p in o.data.polygons:
                p.use_smooth = True
    build_anim(rig)
    export()


# ---------------------------------------------------------------------------------------------------------------------
def build_anim(rig):
    P = rigkit.Poser(rig, 30)

    def gait(dur, swing, calf, lean, arm, bob, ear):
        def fn(t):
            p = A.Pose()
            w = 2 * math.pi * t / dur
            for s, ph in (('L', 0.0), ('R', math.pi)):
                th = swing * math.sin(w + ph)
                p.r(f'Thigh_{s}', -th)
                bend = calf * (0.55 + 0.45 * math.sin(w + ph - 1.1))
                p.r(f'Calf_{s}', bend)
                p.r(f'Foot_{s}', th * 0.35 - bend * 0.55)
                p.r(f'Toe_{s}', 10 + 12 * max(0.0, math.sin(w + ph + 0.8)))
                sgn = 1.0 if s == 'L' else -1.0
                p.r(f'UpperArm_{s}', arm * math.sin(w + ph + math.pi), 0, 4 * sgn)
                p.r(f'LowerArm_{s}', -(24 + 18 * (0.5 + 0.5 * math.sin(w + ph + math.pi))))
            p.r('Hips', lean, 0, 3.5 * math.sin(w)).t('Hips', 0, 0, bob * abs(math.sin(w)))
            p.r('Spine', lean * 0.4, 0, -2.0 * math.sin(w)).r('Chest', lean * 0.3, 0, -1.5 * math.sin(w))
            p.r('Neck', -lean * 0.5 + 2 * math.sin(2 * w)).r('Head', -lean * 0.4 + 2 * math.sin(2 * w + 0.5))
            for s in ('L', 'R'):
                p.r(f'Ear_{s}_1', -ear - 6 * math.sin(2 * w - 0.8), 0, 4 if s == 'L' else -4)
                p.r(f'Ear_{s}_2', -ear * 1.2 - 9 * math.sin(2 * w - 1.6))
            p.r('Tail', 0, 0, 10 * math.sin(2 * w))
            return p
        return fn

    A.bake(rig, P, 'Rabbit_Scurry', 0.48, gait(0.48, 44, 52, 13, 48, 0.028, 18), loop=True)
    A.bake(rig, P, 'Rabbit_Hurry', 0.72, gait(0.72, 30, 36, 7, 32, 0.014, 8), loop=True)

    base = A.Pose()
    base.r('LowerArm_L', -22).r('LowerArm_R', -22).r('UpperArm_L', -4).r('UpperArm_R', -4)
    for s in ('L', 'R'):
        base.r(f'Ear_{s}_1', -6).r(f'Ear_{s}_2', -9)

    def watch_pose(lift, head_down, ear_droop, tremble=0.0, t=0.0):
        p = base.copy()
        p.r('UpperArm_R', -78 * lift, 0, -6 * lift).r('LowerArm_R', -88 * lift).r('Hand_R', -20 * lift, 0, 8 * lift)
        p.r('Chest', 4 * lift).r('Neck', 12 * head_down).r('Head', 22 * head_down, 0, 3 * math.sin(t * 40) * tremble)
        for s in ('L', 'R'):
            p.r(f'Ear_{s}_1', 14 * ear_droop + 4 * math.sin(t * 30 + (0 if s == 'L' else 1)) * tremble)
            p.r(f'Ear_{s}_2', 26 * ear_droop)
        return p

    def check_watch(t):
        dur = 2.6
        lift = A.ease(min(1.0, t / 0.55)) * (1.0 - A.ease(max(0.0, (t - 2.15) / 0.45)))
        down = A.ease(min(1.0, max(0.0, (t - 0.3) / 0.5)))
        alarm = smoothstep(1.45, 1.75, t) * (1.0 - smoothstep(2.05, 2.4, t))
        p = watch_pose(lift, down * (1.0 - alarm), down * (1.0 - alarm), tremble=0.6 * smoothstep(0.9, 1.3, t) * (1 - alarm), t=t)
        p.r('Head', -14 * alarm).r('Neck', -6 * alarm).r('Chest', -5 * alarm)
        for s in ('L', 'R'):
            p.r(f'Ear_{s}_1', -22 * alarm).r(f'Ear_{s}_2', -26 * alarm)
        p.r('Hips', 0, 0, 2.5 * math.sin(t * 5.0) * alarm)
        return p
    A.bake(rig, P, 'Rabbit_CheckWatch', 2.6, check_watch, loop=False)

    def look_back(t):
        dur = 1.6
        k = smoothstep(0.0, 0.45, t) * (1.0 - smoothstep(1.1, 1.55, t))
        p = base.copy()
        p.r('Head', 6 * k, 0, 64 * k).r('Neck', 0, 0, 20 * k).r('Chest', 0, 0, 14 * k).r('Spine', 0, 0, 8 * k).r('Hips', 0, 0, 5 * k)
        p.r('UpperArm_R', -18 * k).r('LowerArm_R', -30 * k).r('UpperArm_L', 10 * k)
        for s in ('L', 'R'):
            p.r(f'Ear_{s}_1', -10 * k + 3 * math.sin(t * 22) * k).r(f'Ear_{s}_2', -14 * k)
        p.r('Thigh_L', -8 * k).r('Thigh_R', 6 * k).r('Calf_L', 10 * k)
        return p
    A.bake(rig, P, 'Rabbit_LookBack', 1.6, look_back, loop=False)


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_morph=True, export_skins=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_apply=False, export_image_format='JPEG', export_jpeg_quality=88, export_yup=True)
    print(f'[build_chr_rabbit] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'chr_rabbit.glb'):
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'chr_rabbit.glb'))


if __name__ == '__main__':
    main()
