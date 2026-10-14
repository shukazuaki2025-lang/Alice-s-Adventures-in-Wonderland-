"""
Build Dinah, the ginger tabby of Alice's dream-twilight at the bottom of the well -> public/assets/models/chr_dinah_dream.glb

    python3 tools/blender/build_chr_dinah.py            # env DINAH_OUT=... to write elsewhere

Painted tabby fur, green slit-pupil eyes, whiskers; 6-bone rig; clip `Dinah_Float` (a slow weightless drift: body bob, head nod, tail wave).
Axes: Blender, faces -Y, +Z up.
"""
import math
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))

import bpy  # noqa: E402
import bmesh  # noqa: E402

import build_chr_alice as bca  # noqa: E402
from alice import anim as A  # noqa: E402
from lib import meshkit as mk  # noqa: E402
from lib import paint  # noqa: E402
from lib import rigkit  # noqa: E402
from lib import solids as sol  # noqa: E402
from lib.meshkit import V, smoothstep  # noqa: E402
from lib.rigkit import Bone  # noqa: E402
from world import rabbit_tex as RT  # noqa: E402

OUT = os.environ.get('DINAH_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'chr_dinah_dream.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'chr_dinah_dream.glb')

BONES = [
    Bone('Root', (0, 0, 0), (0, 0, 0.05), None, deform=False),
    Bone('Body', (0, 0.17, 0.22), (0, -0.10, 0.23), 'Root'),
    Bone('Head', (0, -0.14, 0.25), (0, -0.26, 0.28), 'Body'),
    Bone('Tail_1', (0, 0.23, 0.26), (0, 0.33, 0.33), 'Body'),
    Bone('Tail_2', (0, 0.33, 0.33), (0, 0.38, 0.45), 'Tail_1'),
    Bone('Tail_3', (0, 0.38, 0.45), (0, 0.37, 0.56), 'Tail_2'),
]


def main():
    mk.reset_scene()

    def tex(name, arr, rough=0.95):
        return paint.make_material('M_Dinah_' + name, paint.to_image('T_Dinah_' + name, arr), roughness=rough)

    def flat(name, hexc, rough=0.5):
        c = paint.srgb_to_linear(paint.hex_rgb(hexc))
        return paint.make_material('M_Dinah_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough)

    M = {'fur': tex('Fur', RT.tabby(1024)), 'eye': tex('Eyes', RT.cat_eye(512), 0.3), 'nose': flat('Nose', '#E58A9A'), 'ear': tex('EarInner', RT.ear_inner(512, 5)),
         'dark': flat('Dark', '#2A1A14')}

    def part(name, build, mat):
        bm = bmesh.new()
        build(bm)
        return bca.obj_from_bm(bm, name, [M[mat]])

    objs = {}

    def build_body(bm):
        mk.ellipsoid((0, 0.045, 0.225), (0.092, 0.205, 0.100), seg=26, rings=16, bm=bm)                  # barrel
        mk.ellipsoid((0, -0.095, 0.235), (0.090, 0.095, 0.095), seg=22, rings=14, bm=bm)                 # chest
        mk.ellipsoid((0, 0.17, 0.215), (0.095, 0.100, 0.100), seg=22, rings=14, bm=bm)                   # haunch
        for s in (1, -1):
            mk.tube([V(0.058 * s, -0.115, 0.19), V(0.060 * s, -0.130, 0.10), V(0.058 * s, -0.138, 0.028)], rx=[0.032, 0.026, 0.020], ry=[0.032, 0.026, 0.020], n=12, up_hint=(0, -1, 0), cap_start=False, cap_end=True, bm=bm)
            mk.ellipsoid((0.058 * s, -0.150, 0.018), (0.027, 0.036, 0.020), seg=12, rings=8, bm=bm)      # front paw
            mk.ellipsoid((0.075 * s, 0.17, 0.12), (0.050, 0.075, 0.075), seg=14, rings=9, bm=bm)         # thigh
            mk.tube([V(0.068 * s, 0.18, 0.09), V(0.062 * s, 0.215, 0.05), V(0.058 * s, 0.185, 0.022)], rx=[0.028, 0.022, 0.018], ry=[0.028, 0.022, 0.018], n=10, up_hint=(0, -1, 0), cap_start=False, cap_end=True, bm=bm)
            mk.ellipsoid((0.058 * s, 0.165, 0.016), (0.026, 0.048, 0.017), seg=12, rings=8, bm=bm)       # hind paw
    body = part('Dinah_Body', build_body, 'fur')
    mk.uv_triplanar(body, scale=2.2)
    mk.add_subsurf(body, 1)
    mk.apply_modifiers(body)
    objs['body'] = (body, lambda co: {'Body': 1.0})

    def build_head(bm):
        mk.ellipsoid((0, -0.195, 0.285), (0.078, 0.070, 0.066), seg=24, rings=16, bm=bm)                 # skull
        mk.ellipsoid((0, -0.248, 0.268), (0.038, 0.032, 0.028), seg=16, rings=10, bm=bm)                 # muzzle
        for s in (1, -1):
            mk.ellipsoid((0.040 * s, -0.232, 0.262), (0.030, 0.030, 0.026), seg=14, rings=9, bm=bm)      # cheeks
            sol.lathe(bm, [(0.034, 0.0), (0.030, 0.020), (0.018, 0.046), (0.001, 0.068)], center=(0.050 * s, -0.188, 0.325), seg=6, axis=(0.28 * s, 0.06, 1.0))   # ears
    head = part('Dinah_Head', build_head, 'fur')
    mk.uv_triplanar(head, scale=3.0)
    mk.add_subsurf(head, 1)
    mk.apply_modifiers(head)
    objs['head'] = (head, lambda co: {'Head': 1.0})

    def build_ear_in(bm):
        for s in (1, -1):
            sol.lathe(bm, [(0.022, 0.004), (0.018, 0.022), (0.010, 0.042), (0.001, 0.058)], center=(0.050 * s, -0.1925, 0.327), seg=6, axis=(0.28 * s, 0.06, 1.0))
    ear_in = part('Dinah_EarInner', build_ear_in, 'ear')
    mk.uv_triplanar(ear_in, scale=6.0)
    objs['ear_in'] = (ear_in, lambda co: {'Head': 1.0})

    def build_nose(bm):
        mk.ellipsoid((0, -0.277, 0.274), (0.011, 0.008, 0.008), seg=10, rings=6, bm=bm)
        for s in (1, -1):
            mk.tube([V(0, -0.276, 0.266), V(0.008 * s, -0.275, 0.256), V(0.020 * s, -0.268, 0.254)], rx=0.0011, n=5, up_hint=(0, 0, 1), cap_start=True, cap_end=True, bm=bm)
    nose = part('Dinah_Nose', build_nose, 'nose')
    objs['nose'] = (nose, lambda co: {'Head': 1.0})

    def build_whiskers(bm):
        for s in (1, -1):
            for k in range(3):
                z = 0.268 + (k - 1) * 0.012
                mk.tube([V(0.034 * s, -0.262, z), V(0.075 * s, -0.275, z + 0.002 * (1 - k)), V(0.120 * s, -0.268, z - 0.012 * (k - 1) - 0.006)], rx=lambda t: 0.0008 * (1 - 0.7 * t), n=4, up_hint=(0, 0, 1), cap_start=True, cap_end=True, bm=bm)
    wh = part('Dinah_Whiskers', build_whiskers, 'dark')
    objs['wh'] = (wh, lambda co: {'Head': 1.0})

    for s in (1, -1):
        bm = bmesh.new()
        cx, cy, cz, rx, ry, rz = 0.036 * s, -0.247, 0.296, 0.0165, 0.0085, 0.0165
        mk.ellipsoid((cx, cy, cz), (rx, ry, rz), seg=18, rings=10, bm=bm)
        e = bca.obj_from_bm(bm, f'Dinah_Eye_{"L" if s > 0 else "R"}', [M['eye']])
        uvl = e.data.uv_layers.get('UVMap') or e.data.uv_layers.new(name='UVMap')
        for poly in e.data.polygons:
            for li in poly.loop_indices:
                co = e.data.vertices[e.data.loops[li].vertex_index].co
                uvl.data[li].uv = (0.5 + (co.x - cx) / (2 * rx), 0.5 + (co.z - cz) / (2 * rz))
        objs[f'eye{s}'] = (e, lambda co: {'Head': 1.0})

    def build_tail(bm):
        pts = [V(0, 0.22, 0.25), V(0, 0.30, 0.30), V(0, 0.355, 0.38), V(0, 0.385, 0.47), V(0, 0.380, 0.56), V(0, 0.350, 0.615)]
        mk.tube(pts, rx=[0.030, 0.028, 0.026, 0.024, 0.024, 0.020], ry=[0.030, 0.028, 0.026, 0.024, 0.024, 0.020], n=12, up_hint=(1, 0, 0), cap_start=True, cap_end=True, bm=bm)
    tail = part('Dinah_Tail', build_tail, 'fur')
    mk.uv_triplanar(tail, scale=3.0)
    mk.add_subsurf(tail, 1)
    mk.apply_modifiers(tail)
    objs['tail'] = (tail, lambda co: rigkit.distance_weights(co, {b.name: (b.head, b.tail) for b in BONES if b.name.startswith('Tail') or b.name == 'Body'}, ['Body', 'Tail_1', 'Tail_2', 'Tail_3']))

    rig = rigkit.build_armature('Dinah_Rig', BONES)
    for o, fn in objs.values():
        rigkit.apply_weights(o, fn)
        rigkit.bind(o, rig)
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for p in o.data.polygons:
                p.use_smooth = True

    P = rigkit.Poser(rig, 30)
    dur = 1.875

    def pose(t):
        p = A.Pose()
        w = 2 * math.pi * t / dur
        p.t('Root', 0, 0, 0.045 * math.sin(w))
        p.r('Body', 2.5 * math.sin(w + 0.6), 0, 5 * math.sin(w))
        p.r('Head', 4 * math.sin(w + 1.2), 0, 7 * math.sin(w * 0.5))
        for i, bone in enumerate(('Tail_1', 'Tail_2', 'Tail_3')):
            p.r(bone, 6 * math.sin(w - 0.7 * i), 0, 14 * math.sin(w - 0.9 * (i + 1)))
        return p
    A.bake(rig, P, 'Dinah_Float', dur, pose, loop=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_skins=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_apply=False, export_image_format='JPEG', export_jpeg_quality=88, export_yup=True)
    print(f'[build_chr_dinah] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'chr_dinah_dream.glb'):
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'chr_dinah_dream.glb'))


if __name__ == '__main__':
    main()
