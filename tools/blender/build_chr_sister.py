"""
Build Alice's elder sister (seated under the oak, reading) -> public/assets/models/chr_sister.glb

    python3 tools/blender/build_chr_sister.py

Reuses Alice's head / hair / texture toolkit, re-skinned (chestnut hair, no freckles), with a seated body, green linen dress,
cream crochet shawl, open book, and a looping Sister_ReadIdle (breathing, reading nod, page turn).
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
from alice import hair, sister, sister_tex, skin as skin_mod, spec  # noqa: E402
from lib import meshkit as mk  # noqa: E402
from lib import rigkit  # noqa: E402
from lib.meshkit import V, lerp, smoothstep  # noqa: E402

OUT = os.environ.get('SISTER_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'chr_sister.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'chr_sister.glb')
SEG = None


def head_matrix():
    t1 = Matrix.Translation((0, 0, sister.HEAD_DZ))
    piv = sister.PIVOT
    rot = Matrix.Translation(piv) @ Matrix.Rotation(math.radians(sister.BOW_DEG), 4, 'X') @ Matrix.Translation(-piv)
    return rot @ t1


def distance_w(names):
    seg = {b.name: (b.head, b.tail) for b in sister.BONES}

    def fn(co):
        return rigkit.distance_weights(co, seg, names, power=4.0, eps=0.006)
    return fn


def main():
    mk.reset_scene()
    m = sister_tex.make_all()
    amats = {'Alice_Face': m['Sister_Face'], 'Alice_Lid': m['Sister_Lid'], 'Alice_Mouth': m['Sister_Mouth'], 'Alice_Lips': m['Sister_Lips'],
             'Alice_Brow': m['Sister_Brow'], 'Alice_Eye': m['Sister_Eye'], 'Alice_HairCap': m['Sister_HairCap'], 'Alice_Hair': m['Sister_Hair']}
    head_obj, cap_bm, info = bca.build_head(amats)
    head_obj.name = head_obj.data.name = 'Sister_Head'
    eyes = bca.build_eyes(amats)
    eyes.name = eyes.data.name = 'Sister_Eyes'
    mz = info['mouth_z']

    # ---- weights computed in the original (Alice) head frame, then the head is moved into the seated pose ----------
    def w_head(co):
        j = 0.0
        if co.y < spec.HEAD_C.y - 0.03:
            j = mk.smoothstep(mz - 0.0005, mz - 0.020, co.z) * (1.0 - mk.smoothstep(0.040, 0.075, abs(co.x)))
        return {'Head': max(0.0, 1.0 - j), 'Jaw': j}

    rng = mk.Rng(1862)
    # hair: scalp + fringe + cascading side locks + back curtain + chignon
    hbm = bmesh.new()
    hair.build_fringe(hbm, rng)
    hair.build_side_locks(hbm, rng, max_frac=0.88)
    hair.build_back_curtain(hbm, rng, max_frac=0.62)
    sister.build_bun(hbm, rng)
    clumps = bca.obj_from_bm(hbm, 'Sister_Hair', [m['Sister_Hair']])
    cap = bca.obj_from_bm(cap_bm, 'Sister_HairCap', [m['Sister_HairCap']])
    for o in (head_obj, eyes, clumps, cap):
        pass
    rigkit.apply_weights(head_obj, w_head)
    rigkit.apply_weights(eyes, skin_mod.w_eye)
    rigkit.apply_weights(clumps, skin_mod.w_head_only)
    rigkit.apply_weights(cap, skin_mod.w_head_only)
    M = head_matrix()
    for o in (head_obj, eyes, clumps, cap):
        o.data.transform(M, shape_keys=True)
        o.data.update()

    # ---- body ---------------------------------------------------------------------------------------------------
    lean = Matrix.Translation((0, 0.015, 0.24)) @ Matrix.Rotation(math.radians(sister.LEAN_DEG), 4, 'X') @ Matrix.Translation((0, -0.015, -0.24))

    def part(name, build, mat, solidify=None, lean_it=False):
        bm = bmesh.new()
        build(bm)
        o = bca.obj_from_bm(bm, name, [mat])
        if solidify:
            mk.add_solidify(o, solidify, -1.0)
            mk.apply_modifiers(o)
        if lean_it:
            o.data.transform(lean)
            o.data.update()
        return o

    skirt = part('Sister_Skirt', sister.build_skirt, m['Sister_Skirt'], 0.008)
    mk.uv_cylindrical(skirt, (0.0, -0.13), (0.0, 0.34), u_repeat=11.0)
    bodice = part('Sister_Bodice', sister.build_bodice, m['Sister_Dress'], None, True)
    mk.uv_cylindrical(bodice, (0.0, 0.015), (0.2, 0.66))
    shawl = part('Sister_Shawl', sister.build_shawl, m['Sister_Shawl'], 0.004, True)
    mk.uv_cylindrical(shawl, (0.0, -0.05), (0.08, 0.65), u_repeat=3.0)
    neck = part('Sister_Neck', sister.build_neck, m['Sister_Skin'])
    mk.uv_triplanar(neck, scale=3.0)

    def sleeves(bm):
        for s in (1, -1):
            sister.build_sleeve(bm, s)
    sl = part('Sister_Sleeves', sleeves, m['Sister_Dress'])
    mk.uv_triplanar(sl, scale=1.6)

    def arms(bm):
        for s in (1, -1):
            sister.build_forearm_hand(bm, s)
    arm = part('Sister_Arms', arms, m['Sister_Skin'])
    mk.uv_triplanar(arm, scale=3.0)
    boots = part('Sister_Boots', sister.build_boots, m['Sister_Boot'])
    mk.uv_triplanar(boots, scale=3.0)

    cbm, pbm = bmesh.new(), bmesh.new()
    sister.build_book(cbm, pbm)
    book_c = bca.obj_from_bm(cbm, 'Sister_BookCover', [m['Sister_BookCover']])
    book_p = bca.obj_from_bm(pbm, 'Sister_BookPages', [m['Sister_Pages']])
    for b in (book_c, book_p):
        for p_ in b.data.polygons:
            p_.use_smooth = False

    # ---- rig ------------------------------------------------------------------------------------------------------
    rig = rigkit.build_armature('Sister_Rig', sister.BONES)
    rigkit.bind(head_obj, rig)
    for o in (eyes, clumps, cap):
        rigkit.bind(o, rig)

    def hips_spine_chest(co):
        z = co.z
        wc = smoothstep(0.40, 0.55, z)
        wh = 1.0 - smoothstep(0.22, 0.36, z)
        return {'Chest': wc, 'Spine': max(0.0, 1.0 - wc - wh), 'Hips': wh}

    def w_neck(co):
        z = co.z
        if z < 0.64:
            return {'Chest': 1.0 - smoothstep(0.6, 0.65, z), 'Neck': smoothstep(0.6, 0.65, z)}
        t = smoothstep(0.66, 0.72, z)
        return {'Neck': 1.0 - t, 'Head': t}

    arm_names = {1: ['UpperArm_L', 'LowerArm_L', 'Hand_L'], -1: ['UpperArm_R', 'LowerArm_R', 'Hand_R']}
    for o, fn in ((skirt, lambda co: {'Hips': 1.0}), (bodice, hips_spine_chest), (shawl, lambda co: {'Chest': 0.7, 'Spine': 0.3}),
                  (neck, w_neck), (boots, lambda co: {'Hips': 1.0}), (book_c, lambda co: {'Chest': 1.0}), (book_p, lambda co: {'Chest': 1.0}),
                  (sl, lambda co: dict(distance_w(arm_names[1 if co.x >= 0 else -1][:2] + ['Chest'])(co))),
                  (arm, lambda co: distance_w(arm_names[1 if co.x >= 0 else -1])(co))):
        rigkit.apply_weights(o, fn)
        rigkit.bind(o, rig)

    rig['character'] = 'Alice_Sister'
    rig['seated_height'] = 0.95
    bpy.context.view_layer.update()
    build_anim(rig)
    export()


def build_anim(rig):
    from alice import anim as A

    P = rigkit.Poser(rig, 30)
    dur = 4.0

    def pose(t):
        p = A.Pose()
        w = 2 * math.pi * t / dur
        b = math.sin(w)
        p.r('Spine', 0.7 * b).r('Chest', 1.1 * b)
        p.r('Neck', 4 + 1.2 * math.sin(w * 0.5)).r('Head', 5 + 2.0 * math.sin(w * 0.5 + 0.4), 0, 3.2 * math.sin(w * 2 + 0.3))
        p.r('Jaw', 0.5 + 0.5 * max(0.0, math.sin(w * 3)))
        # reading: eyes scan, hands hold the book, the right hand turns a page around t = 2.4..3.5 s
        turn = smoothstep(2.3, 2.9, t) * (1.0 - smoothstep(3.0, 3.6, t))
        for side, s in (('L', 1.0), ('R', -1.0)):
            p.r(f'UpperArm_{side}', 1.5 * math.sin(w + s))
            p.r(f'LowerArm_{side}', 0.8 * b)
        p.r('LowerArm_R', -14 * turn, 0, 10 * turn).r('Hand_R', -10 * turn, 0, 16 * turn).r('UpperArm_R', -6 * turn)
        return p

    A.bake(rig, P, 'Sister_ReadIdle', dur, pose, loop=True)


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_morph=True, export_skins=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_apply=False, export_image_format='JPEG', export_jpeg_quality=88, export_yup=True)
    print(f'[build_chr_sister] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'chr_sister.glb'):
        shutil.copyfile(OUT, OUT_SRC)
        shutil.copyfile(OUT, os.path.join(ROOT, 'assets_src', 'chr_sister.glb'))


if __name__ == '__main__':
    main()
