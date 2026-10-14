"""
Build Alice (rigged, skinned, textured, animated) and export public/assets/models/chr_alice.glb.

    python3 tools/blender/build_chr_alice.py                # needs `pip install bpy`
    blender -b -P tools/blender/build_chr_alice.py          # or a desktop Blender (>= 4.2)

Deterministic: same inputs -> same GLB. Dev knobs (environment variables):
    ALICE_SKIP_ANIM=1    export the static, skinned model only (fast iteration on shape)
    ALICE_OUT=<path>     write somewhere else (e.g. public/assets/models/dev/alice.glb)
"""
import math
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))

import bpy  # noqa: E402  (must come first: it registers `bmesh` / `mathutils`)
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

from alice import body, dress, hair, head, skin, spec, textures  # noqa: E402
from lib import meshkit as mk  # noqa: E402
from lib import rigkit  # noqa: E402

OUT = os.environ.get('ALICE_OUT') or os.path.join(ROOT, 'public', 'assets', 'models', 'chr_alice.glb')
OUT_SRC = os.path.join(ROOT, 'assets_src', 'models', 'chr_alice.glb')
TEX_DIR = os.path.join(ROOT, 'assets_src', 'textures', 'alice')


# ---------------------------------------------------------------------------------------------------------------
def obj_from_bm(bm, name, mats):
    o = mk.bm_to_object(bm, name)
    for m in mats:
        o.data.materials.append(m)
    return o


def add_shape_keys(obj, keys):
    """keys: {name: fn(index, co) -> Vector delta}"""
    me = obj.data
    basis = obj.shape_key_add(name='Basis', from_mix=False)
    base_co = [v.co.copy() for v in me.vertices]
    for name, fn in keys.items():
        sk = obj.shape_key_add(name=name, from_mix=False)
        sk.value = 0.0            # glTF exports the slider value as the default morph weight: keep every key OFF
        sk.slider_min = 0.0
        sk.slider_max = 1.0
        for i, co in enumerate(base_co):
            d = fn(i, co)
            if d is not None:
                sk.data[i].co = co + d
    obj.data.shape_keys.name = 'Alice_Expressions'
    return basis


def rot_about_x(co, pivot, deg):
    a = math.radians(deg)
    p = co - pivot
    y = p.y * math.cos(a) - p.z * math.sin(a)
    z = p.y * math.sin(a) + p.z * math.cos(a)
    return pivot + Vector((p.x, y, z))


def build_head(mats):
    m = [mats['Alice_Face'], mats['Alice_Lid'], mats['Alice_Mouth'], mats['Alice_Lips'], mats['Alice_Brow']]
    bm, info = head.build_head_bm(m)
    # extract scalp faces for the hair cap before the bmesh is consumed
    cap_bm = hair.build_scalp()
    obj = obj_from_bm(bm, 'Alice_Head', m)
    me = obj.data

    hw = 0.0215
    mz = info['mouth_z']
    lip_all = set(info['upper_lip']) | set(info['lower_lip']) | set(info['mouth_top']) | set(info['mouth_bot'])
    lower_set = set(info['lower_lip']) | set(info['mouth_bot'])
    up_lid = {s: set(v) for s, v in info['upper_lid'].items()}
    lo_lid = {s: set(v) for s, v in info['lower_lid'].items()}
    brow_all = set(info['brow'][1]) | set(info['brow'][-1])

    def eye_c(s):
        return Vector((spec.EYE_X * s, spec.EYE_Y, spec.EYE_C_Z))

    def lid_delta(i, co, up_deg, lo_deg):
        for s in (1.0, -1.0):
            if i in up_lid[s]:
                return rot_about_x(co, eye_c(s), up_deg) - co
            if i in lo_lid[s]:
                return rot_about_x(co, eye_c(s), lo_deg) - co
        return None

    def mouth_shape(co, corner_dz, open_dz, widen, upper_dz=0.0, is_lower=False):
        x = co.x
        xf = clamp_abs(x / hw)
        dz = corner_dz * xf * xf + (open_dz if is_lower else upper_dz)
        return Vector((x * (widen - 1.0), -0.0004 * (1 if corner_dz > 0 else 0), dz))

    def clamp_abs(v):
        return min(1.0, abs(v))

    def cheek_g(co):
        # smooth falloff around the apples of the cheeks (front of the face only)
        dx = abs(co.x) - 0.056
        dz = co.z - (mz + 0.026)
        front = 1.0 if co.y < spec.HEAD_C.y - 0.05 else 0.0
        return math.exp(-(dx * dx + dz * dz) / (2 * 0.020 ** 2)) * front

    def brow_t(co):
        return mk.clamp((abs(co.x) - (spec.EYE_X - 0.0255)) / 0.054)

    def chin_j(co):
        if co.y > spec.HEAD_C.y - 0.03:
            return 0.0
        return mk.smoothstep(mz - 0.001, mz - 0.020, co.z) * (1.0 - mk.smoothstep(0.040, 0.075, abs(co.x)))

    def key_smile(i, co):
        if i in lip_all:
            return mouth_shape(co, 0.0052, -0.0015, 1.07, 0.0004, i in lower_set)
        if i in info['skin'] and cheek_g(co) > 0.002:
            g = cheek_g(co)
            return Vector((0, -0.0022 * g, 0.0030 * g))
        d = lid_delta(i, co, 0.0, -5.0)
        if d is not None:
            return d
        if i in brow_all:
            return Vector((0, 0, -0.0008))
        return None

    def key_surprised(i, co):
        if i in lip_all:
            if i in lower_set:
                return Vector((-co.x * 0.18, -0.0010, -0.0120))
            return Vector((-co.x * 0.18, 0, 0.0016))
        d = lid_delta(i, co, -13.0, 4.0)
        if d is not None:
            return d
        if i in brow_all:
            return Vector((0, 0, 0.0075 - 0.0020 * brow_t(co)))
        if i in info['skin']:
            j = chin_j(co)
            if j > 0.001:
                return Vector((0, 0.0012 * j, -0.0034 * j))
        return None

    def key_crying(i, co):
        if i in lip_all:
            d = mouth_shape(co, -0.0058, -0.0042, 0.97, 0.0, i in lower_set)
            return d
        d = lid_delta(i, co, 20.0, -9.0)
        if d is not None:
            return d
        if i in brow_all:
            t = brow_t(co)
            return Vector((0.0006 * (1 - t) * (1 if co.x > 0 else -1) * -1, 0, 0.0062 * (1 - t) - 0.0030 * t))
        if i in info['skin'] and cheek_g(co) > 0.002:
            g = cheek_g(co)
            return Vector((0, -0.0012 * g, 0.0018 * g))
        return None

    def key_mouth_open(i, co):
        if i in lip_all:
            if i in lower_set:
                return Vector((-co.x * 0.06, -0.0008, -0.0100))
            return Vector((-co.x * 0.06, 0, 0.0010))
        if i in info['skin']:
            j = chin_j(co)
            if j > 0.001:
                return Vector((0, 0.0010 * j, -0.0030 * j))
        return None

    keys = {
        'Neutral': lambda i, co: None,
        'Blink': lambda i, co: lid_delta(i, co, 47.0, -6.0),
        'Smile': key_smile,
        'Surprised': key_surprised,
        'Crying': key_crying,
        'MouthOpen': key_mouth_open,
    }
    add_shape_keys(obj, keys)
    obj['mouth_z'] = mz
    return obj, cap_bm, info


def build_eyes(mats):
    objs = []
    bm_all = bmesh.new()
    for s in (1.0, -1.0):
        eb = head.eye_geometry(s)
        tmp = bpy.data.meshes.new('tmp')
        eb.to_mesh(tmp)
        eb.free()
        bm_all.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    return obj_from_bm(bm_all, 'Alice_Eyes', [mats['Alice_Eye']])


def build_hair(cap_bm, mats):
    rng = mk.Rng(1865)
    # clumps are built into a single bmesh; descriptors carry the path for weighting
    bm = bmesh.new()
    descr = []
    descr += hair.build_back_hair(bm, rng)
    descr += hair.build_side_locks(bm, rng)
    descr += hair.build_fringe(bm, rng)
    clumps = obj_from_bm(bm, 'Alice_Hair', [mats['Alice_Hair']])
    cap = obj_from_bm(cap_bm, 'Alice_HairCap', [mats['Alice_HairCap']])
    return clumps, cap, descr


def build_ribbon(mats):
    bm = bmesh.new()
    pts = hair.build_headband(bm)
    anchor = pts[int(len(pts) * 0.70)]
    hair.build_bow(bm, anchor, mk.Rng(7))
    return obj_from_bm(bm, 'Alice_Ribbon', [mats['Alice_Ribbon']])


def build_body(mats):
    bm = bmesh.new()
    body.build_neck(bm)
    for s in (1.0, -1.0):
        body.build_arm(bm, s)
    return obj_from_bm(bm, 'Alice_Body', [mats['Alice_Skin']])


def build_legs(mats):
    bm = bmesh.new()
    for s in (1.0, -1.0):
        body.build_stocking(bm, s)
    return obj_from_bm(bm, 'Alice_Stockings', [mats['Alice_Stockings']])


def build_shoes(mats):
    bm = bmesh.new()
    for s in (1.0, -1.0):
        body.build_shoe(bm, s)
        body.build_strap(bm, s)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    return obj_from_bm(bm, 'Alice_Shoes', [mats['Alice_Shoes']])


def build_dress(mats):
    bm = bmesh.new()
    dress.build_dress(bm)
    obj = obj_from_bm(bm, 'Alice_Dress', [mats['Alice_Dress']])
    mk.add_solidify(obj, 0.006, -1.0)
    mk.apply_modifiers(obj)
    mk.uv_cylindrical(obj, axis_xy=(0.0, dress.CY), v_range=(0.30, 0.87), u_repeat=1.0)
    # sleeves are separate so their UVs stay tube-like
    bm2 = bmesh.new()
    for s in (1.0, -1.0):
        dress.build_sleeve(bm2, s)
    sl = obj_from_bm(bm2, 'Alice_Sleeves', [mats['Alice_Dress']])
    return obj, sl


def build_collar(mats):
    bm = bmesh.new()
    dress.build_collar(bm)
    obj = obj_from_bm(bm, 'Alice_Collar', [mats['Alice_Collar']])
    mk.add_solidify(obj, 0.0035, 0.0)
    mk.apply_modifiers(obj)
    return obj


def build_apron(mats):
    bm = bmesh.new()
    dress.build_apron(bm)
    dress.build_apron_frill(bm)
    dress.build_pockets(bm)
    dress.build_waistband(bm)
    obj = obj_from_bm(bm, 'Alice_Apron', [mats['Alice_Apron']])
    mk.add_solidify(obj, 0.0035, -1.0)
    mk.apply_modifiers(obj)
    bm2 = bmesh.new()
    dress.build_straps(bm2)
    rng = mk.Rng(11)
    dress.build_sash_bow(bm2, rng)
    obj2 = obj_from_bm(bm2, 'Alice_ApronStraps', [mats['Alice_Apron']])
    return obj, obj2


# ---------------------------------------------------------------------------------------------------------------
def weight_all(rig, objs):
    SEG = skin.SEG
    wmap = {
        'Alice_Body': lambda co: skin.w_arms(co) if co.z < 0.855 and abs(co.x) > 0.02 else skin.w_neck(co),
        'Alice_Stockings': skin.w_leg,
        'Alice_Shoes': skin.w_shoe,
        'Alice_Dress': skin.w_dress_body,
        'Alice_Sleeves': skin.w_sleeve,
        'Alice_Collar': skin.w_collar,
        'Alice_Apron': skin.w_dress_body,
        'Alice_Eyes': skin.w_eye,
        'Alice_HairCap': skin.w_head_only,
        'Alice_Ribbon': lambda co: skin.w_head_only(co) if abs(co.x) < 0.2 else skin.w_bow(co),
    }
    for name, fn in wmap.items():
        rigkit.apply_weights(objs[name], fn)
        rigkit.bind(objs[name], rig)
    return


# ---------------------------------------------------------------------------------------------------------------
def main():
    mk.reset_scene()
    mats = textures.make_all(TEX_DIR if os.environ.get('ALICE_SAVE_TEX') else None)

    head_obj, cap_bm, info = build_head(mats)
    eyes = build_eyes(mats)
    clumps, cap, descr = build_hair(cap_bm, mats)
    ribbon = build_ribbon(mats)
    bodyo = build_body(mats)
    legs = build_legs(mats)
    shoes = build_shoes(mats)
    dress_o, sleeves = build_dress(mats)
    collar = build_collar(mats)
    apron, straps = build_apron(mats)

    rig = rigkit.build_armature('Alice_Rig', spec.BONES)
    objs = {
        'Alice_Head': head_obj, 'Alice_Eyes': eyes, 'Alice_Hair': clumps, 'Alice_HairCap': cap, 'Alice_Ribbon': ribbon,
        'Alice_Body': bodyo, 'Alice_Stockings': legs, 'Alice_Shoes': shoes, 'Alice_Dress': dress_o, 'Alice_Sleeves': sleeves,
        'Alice_Collar': collar, 'Alice_Apron': apron, 'Alice_ApronStraps': straps,
    }
    # --- weights
    mz = info['mouth_z']

    def w_head_full(co):
        z = co.z
        j = 0.0
        if co.y < spec.HEAD_C.y - 0.03:
            j = mk.smoothstep(mz - 0.0005, mz - 0.020, z) * (1.0 - mk.smoothstep(0.040, 0.075, abs(co.x)))
        # neck blend at the very bottom of the skull
        return {'Head': max(0.0, 1.0 - j), 'Jaw': j}

    rigkit.apply_weights(head_obj, w_head_full)
    rigkit.bind(head_obj, rig)
    # hair clumps: each clump has its own path; weight by nearest clump path
    def w_clumps(co):
        best, bd = None, 1e9
        for d in descr:
            for p in d['pts'][::3]:
                dd = (co - p).length_squared
                if dd < bd:
                    bd, best = dd, d
        return skin.w_hair_clump(best['pts'], best['kind'], best.get('side', 1.0))(co)

    rigkit.apply_weights(clumps, w_clumps)
    rigkit.bind(clumps, rig)
    weight_all(rig, objs)
    rigkit.apply_weights(straps, lambda co: skin.w_sash_tail(co) if co.z < 0.78 and co.y > 0.04 and abs(co.x) < 0.2 and co.z < 0.69 else skin.w_dress_body(co))
    rigkit.bind(straps, rig)

    rig['height'] = spec.ARM_ANGLES and 1.2
    rig['character'] = 'Alice'
    rig['source'] = 'tools/blender/build_chr_alice.py'

    if not os.environ.get('ALICE_SKIP_ANIM'):
        from alice import anim
        anim.build_all(rig)

    export(rig)


def export(rig):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        use_selection=False,
        export_extras=True,
        export_morph=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_apply=False,
        export_image_format='JPEG',
        export_jpeg_quality=88,
        export_yup=True,
    )
    size = os.path.getsize(OUT)
    print(f'[build_chr_alice] wrote {OUT} ({size / 1024:.0f} KB)')
    if os.path.abspath(OUT) == os.path.join(ROOT, 'public', 'assets', 'models', 'chr_alice.glb'):
        os.makedirs(os.path.dirname(OUT_SRC), exist_ok=True)
        shutil.copyfile(OUT, OUT_SRC)
        legacy = os.path.join(ROOT, 'assets_src', 'chr_alice.glb')
        shutil.copyfile(OUT, legacy)


if __name__ == '__main__':
    main()
