"""
Build the six Chapter 1 hand props with painted textures and export them to public/assets/models/prop_*.glb:

    python3 tools/blender/build_props.py            # env PROPS_OUT=<dir> to write elsewhere (default: public/assets/models)

DRINK ME bottle (10 cm, clear glass, cork, tied label front + back), EAT ME currant cake (Ø 5 cm), ORANGE MARMALADE jar,
tiny golden key (5 cm), the White Rabbit's pocket watch, and the hinged miniature glass box (10 × 7 × 5 cm).
Glass parts use the `M_Glass_` prefix so the engine swaps in the refractive shader (CLAUDE.md §5). Node names are kept from the
first generation (`Front_Label`, `Back_Label`, `Cake_Currants`, `Jar_Label`, `*_Grp`) so ItemInspector / UI code is unaffected.
Axes: glTF +Z (front, where labels face) = Blender -Y.
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
from lib.meshkit import V  # noqa: E402
from world import interior as I  # noqa: E402
from world import props_tex as PT  # noqa: E402

OUT_DIR = os.environ.get('PROPS_OUT') or os.path.join(ROOT, 'public', 'assets', 'models')
SRC_DIR = os.path.join(ROOT, 'assets_src', 'models')
REAL = os.path.abspath(OUT_DIR) == os.path.join(ROOT, 'public', 'assets', 'models')


def tex(name, arr, rough=0.6, double=False):
    return paint.make_material('M_' + name, paint.to_image('T_' + name, arr), roughness=rough, double_sided=double)


def flat(name, hexc, rough=0.4, emissive=None, alpha=None):
    c = paint.srgb_to_linear(paint.hex_rgb(hexc))
    em = None
    if emissive:
        e = paint.srgb_to_linear(paint.hex_rgb(emissive))
        em = (float(e[0]), float(e[1]), float(e[2]))
    return paint.make_material('M_' + name, None, (float(c[0]), float(c[1]), float(c[2]), 1.0), rough, emissive=em)


def obj(bm, name, mat):
    return mk.bm_to_object(bm, name, mat)


def new_bm():
    return bmesh.new()


def quad_front(bm, x0, x1, z0, z1, y, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    sol.quad(bm, V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1), uvs)      # faces -Y (glTF +Z)


def quad_back(bm, x0, x1, z0, z1, y, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    sol.quad(bm, V(x1, y, z0), V(x0, y, z0), V(x0, y, z1), V(x1, y, z1), uvs)      # faces +Y (glTF -Z)


def finish(name, group_name, objs, extras=None, node_extras=None):
    """Parent everything to an Empty `<name>_Grp`, export, mirror into assets_src."""
    grp = bpy.data.objects.new(group_name, None)
    bpy.context.scene.collection.objects.link(grp)
    for o in objs:
        o.parent = grp
    for o, ex in (node_extras or {}).items():
        for k, v in ex.items():
            o[k] = v
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f'{name}.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_extras=True, export_image_format='JPEG', export_jpeg_quality=90,
                              export_yup=True, export_apply=False)
    tris = sum(mk.triangle_count(o) for o in objs if o.type == 'MESH')
    print(f'[build_props] {name}: {tris} tris, {os.path.getsize(path) / 1024:.0f} KB')
    if REAL:
        os.makedirs(SRC_DIR, exist_ok=True)
        shutil.copyfile(path, os.path.join(SRC_DIR, f'{name}.glb'))
        shutil.copyfile(path, os.path.join(ROOT, 'assets_src', f'{name}.glb'))


# ---------------------------------------------------------------------------------------------------------------------
def bottle():
    mk.reset_scene()
    glass = flat('Glass_Bottle', '#CFEAE6', 0.05)
    liquid = flat('Bottle_Liquid', '#5FB4C4', 0.2, emissive='#2E7E92')
    cork = tex('Cork', PT.cork(256), 0.9)
    twine = flat('Twine', '#9A7A4A', 0.9)
    label_f = tex('Label_Drink', PT.drink_label(512, 384), 0.8)
    label_b = tex('Label_Back', PT.back_label(512, 384), 0.8)
    parts = []
    bm = new_bm()
    sol.lathe(bm, [(0.001, 0.0), (0.020, 0.0), (0.0225, 0.004), (0.0230, 0.030), (0.0225, 0.052), (0.019, 0.064), (0.0105, 0.075), (0.0092, 0.088), (0.0108, 0.092), (0.0108, 0.096), (0.001, 0.096)], seg=40, uv_u=(0, 1))
    parts.append(obj(bm, 'glass', glass))
    bm = new_bm()
    sol.lathe(bm, [(0.001, 0.003), (0.0195, 0.003), (0.0212, 0.006), (0.0215, 0.030), (0.0208, 0.050), (0.0172, 0.061), (0.001, 0.063)], seg=36)
    parts.append(obj(bm, 'liquid', liquid))
    bm = new_bm()
    sol.lathe(bm, [(0.0075, 0.086), (0.0098, 0.092), (0.0100, 0.100), (0.0085, 0.1015), (0.001, 0.1015)], seg=20, uv_u=(0, 2))
    parts.append(obj(bm, 'cork', cork))
    bm = new_bm()
    mk.tube([V(0.0110 * math.cos(a), 0.0110 * math.sin(a), 0.0835) for a in [2 * math.pi * i / 24 for i in range(25)]], rx=0.0007, n=6, cap_start=False, cap_end=False, bm=bm)
    parts.append(obj(bm, 'twine', twine))
    body = mk.join_objects(parts, 'prop_bottle_drinkme')
    fb, bb = new_bm(), new_bm()
    quad_front(fb, -0.0160, 0.0160, 0.026, 0.050, -0.0236, ((0.02, 0.02), (0.98, 0.02), (0.98, 0.98), (0.02, 0.98)))
    quad_back(bb, -0.0160, 0.0160, 0.026, 0.050, 0.0236, ((0.02, 0.02), (0.98, 0.02), (0.98, 0.98), (0.02, 0.98)))
    f = obj(fb, 'Front_Label', label_f)
    b = obj(bb, 'Back_Label', label_b)
    for o in (f, b):
        o.data.materials.clear()
        o.data.materials.append(label_f if o is f else label_b)
    for o in (f, b):
        o.active_material.use_backface_culling = False
    finish('prop_bottle_drinkme', 'prop_bottle_drinkme_Grp', [body, f, b],
           node_extras={body: {'Front_Label': 'DRINK ME', 'Back_Label': ''}, f: {'label': 'DRINK ME'}, b: {'label': 'SAFE_NO_POISON'}})


def cake():
    mk.reset_scene()
    side = tex('Cake_Sponge', PT.sponge(256), 0.9)
    top = tex('Cake_Icing', PT.cake_top(512), 0.7)
    currant = flat('Cake_Currant', '#3A1F28', 0.5)
    bm = new_bm()
    sol.lathe(bm, [(0.001, 0.0), (0.0235, 0.0), (0.0250, 0.004), (0.0252, 0.019), (0.0238, 0.0245), (0.0225, 0.0258), (0.001, 0.0258)], seg=40, uv_u=(0, 2), cap_top=False)
    body = obj(bm, 'prop_cake_eatme', side)
    tb = new_bm()
    sol.disc_xy(tb, (0, 0, 0), 0.0226, z_offset=0.02585, seg=48)
    topo = obj(tb, 'Cake_Top', top)
    rng = mk.Rng(3)
    cb = new_bm()
    for _ in range(34):
        a = rng.range(0, 6.28)
        zz = rng.range(0.004, 0.0215)
        mk.ellipsoid((0.0254 * math.cos(a), 0.0254 * math.sin(a), zz), (0.0017, 0.0017, 0.0012), seg=8, rings=5, bm=cb)
    cur = obj(cb, 'Cake_Currants', currant)
    body = mk.join_objects([body, topo], 'prop_cake_eatme')
    finish('prop_cake_eatme', 'prop_cake_eatme_Grp', [body, cur], node_extras={body: {'decal': 'EAT ME'}})


def jar():
    mk.reset_scene()
    glass = flat('Glass_Jar', '#D8EFEA', 0.05)
    jam = flat('Jar_Marmalade', '#E58A25', 0.25, emissive='#9A4A0E')
    lid = tex('Jar_Lid', I.parchment_map(512, 512, seed=12), 0.9)
    twine = flat('Jar_Twine', '#9A7A4A', 0.9)
    label = tex('Jar_Label', PT.jar_label(768, 384), 0.8)
    parts = []
    bm = new_bm()
    sol.lathe(bm, [(0.001, 0.0), (0.040, 0.0), (0.045, 0.010), (0.046, 0.030), (0.046, 0.115), (0.043, 0.130), (0.036, 0.138), (0.0345, 0.150)], seg=40, cap_top=False)
    parts.append(obj(bm, 'glass', glass))
    bm = new_bm()
    sol.lathe(bm, [(0.001, 0.004), (0.039, 0.004), (0.0435, 0.012), (0.0445, 0.030), (0.0445, 0.108), (0.0415, 0.121), (0.001, 0.124)], seg=36)
    parts.append(obj(bm, 'jam', jam))
    bm = new_bm()
    sol.lathe(bm, [(0.034, 0.143), (0.0395, 0.148), (0.0405, 0.160), (0.030, 0.168), (0.001, 0.171)], seg=28, uv_u=(0, 1))
    parts.append(obj(bm, 'lid', lid))
    bm = new_bm()
    mk.tube([V(0.0405 * math.cos(a), 0.0405 * math.sin(a), 0.1475) for a in [2 * math.pi * i / 28 for i in range(29)]], rx=0.0016, n=6, cap_start=False, cap_end=False, bm=bm)
    parts.append(obj(bm, 'twine', twine))
    body = mk.join_objects(parts, 'prop_jar_marmalade')
    lb = new_bm()
    grid = [[V(0.0463 * math.sin(a), -0.0463 * math.cos(a), z) for a in [(-0.85 + 1.7 * i / 16) for i in range(17)]] for z in [0.034 + 0.080 * j / 4 for j in range(5)]]
    mk.sheet(grid, flip=False, bm=lb, uv_rect=(0, 0, 1, 1))
    lab = obj(lb, 'Jar_Label', label)
    finish('prop_jar_marmalade', 'prop_jar_marmalade_Grp', [body, lab], node_extras={body: {'decal': 'ORANGE MARMALADE'}})


def key():
    mk.reset_scene()
    brass = tex('Key_Brass', I.brass(512, 512, seed=3), 0.3)
    bm = new_bm()
    # bow: a trefoil of three rings round the end of the shaft
    for k in range(3):
        ang = k * 2 * math.pi / 3 + math.pi / 2
        cx, cz = -0.0215 + math.cos(ang) * 0.0036, math.sin(ang) * 0.0036
        ring = [V(cx + 0.0036 * math.cos(a), 0.0, cz + 0.0036 * math.sin(a)) for a in [2 * math.pi * i / 32 for i in range(33)]]
        mk.tube(ring, rx=0.0012, ry=0.0012, n=16, up_hint=(0, 1, 0), cap_start=False, cap_end=False, bm=bm)
    sol.lathe(bm, [(0.0012, -0.022), (0.0021, -0.0215), (0.0023, -0.016), (0.0016, -0.0155), (0.0016, 0.0215), (0.0010, 0.0225)], seg=28, axis=(1, 0, 0))       # shaft
    for x in (-0.0155, -0.0110, 0.0):
        sol.lathe(bm, [(0.0016, x - 0.001), (0.0030, x - 0.0006), (0.0030, x + 0.0006), (0.0016, x + 0.001)], seg=24, axis=(1, 0, 0))                          # collars
    sol.box(bm, (0.0150, -0.0008, -0.0046), (0.0226, 0.0008, 0.0002), (60, 60))                                                                                 # bit
    sol.box(bm, (0.0176, -0.0009, -0.0046), (0.0186, 0.0009, -0.0022), (60, 60))
    sol.box(bm, (0.0202, -0.0009, -0.0046), (0.0212, 0.0009, -0.0014), (60, 60))
    o = obj(bm, 'prop_key_gold', brass)
    finish('prop_key_gold', 'prop_key_gold_Grp', [o])


def watch():
    mk.reset_scene()
    brass = tex('Watch_Brass', I.brass(512, 512, seed=8), 0.3)
    dial = tex('Watch_Dial', PT.watch_dial(512), 0.4)
    glass = flat('Glass_Watch', '#E6F2F0', 0.02)
    ax = Vector((0, -1, 0))
    bm = new_bm()
    sol.lathe(bm, [(0.001, 0.0), (0.0235, 0.0), (0.0252, 0.002), (0.0252, 0.0095), (0.0240, 0.0108), (0.0232, 0.0102)], seg=48, axis=ax, cap_top=False)               # case back + rim
    sol.lathe(bm, [(0.0262, 0.0070), (0.0270, 0.0085), (0.0268, 0.0098), (0.0258, 0.0108)], seg=48, axis=ax, cap_top=False, cap_bottom=False)                         # bezel
    # crown + bow
    sol.lathe(bm, [(0.001, 0.0), (0.0042, 0.0), (0.0046, 0.003), (0.0040, 0.006), (0.0030, 0.0075), (0.001, 0.0075)], seg=16, axis=(0, 0, 1), center=(0, -0.0050, 0.0252))
    ring = [V(0.0078 * math.cos(a), -0.0050, 0.0338 + 0.0078 * math.sin(a)) for a in [2 * math.pi * i / 24 for i in range(25)]]
    mk.tube(ring, rx=0.0013, n=8, up_hint=(0, 1, 0), cap_start=False, cap_end=False, bm=bm)
    o1 = obj(bm, 'case', brass)
    db = new_bm()
    # dial: disc in the XZ plane facing -Y
    c = Vector((0, -0.0097, 0))
    cv = db.verts.new(c)
    uv = db.loops.layers.uv.new('UVMap')
    ring_v = [db.verts.new(V(0.0228 * math.cos(2 * math.pi * i / 48), -0.0097, 0.0228 * math.sin(2 * math.pi * i / 48))) for i in range(48)]
    for i in range(48):
        f = db.faces.new((cv, ring_v[i], ring_v[(i + 1) % 48]))
        for loop in f.loops:
            p = loop.vert.co
            loop[uv].uv = (0.5 + p.x / 0.0456, 0.5 + p.z / 0.0456)
    o2 = obj(db, 'dial', dial)
    gb = new_bm()
    sol.lathe(gb, [(0.0228, 0.0099), (0.0225, 0.0104), (0.0165, 0.0120), (0.001, 0.0126)], seg=40, axis=Vector((0, -1, 0)), cap_bottom=False, cap_top=False)
    o3 = obj(gb, 'glass', glass)
    # chain: interlocking flat links hanging from the bow
    cb = new_bm()
    pos = V(0, -0.0050, 0.0338 + 0.0078)
    for k in range(16):
        ring = [pos + V(0.0042 * math.cos(a), 0.0, 0.0072 * math.sin(a)) * (1 if k % 2 == 0 else 1) for a in [2 * math.pi * i / 14 for i in range(15)]]
        if k % 2:
            ring = [pos + V(0.0, 0.0042 * math.cos(a), 0.0072 * math.sin(a)) for a in [2 * math.pi * i / 14 for i in range(15)]]
        mk.tube(ring, rx=0.0009, n=6, up_hint=(0, 1, 0), cap_start=False, cap_end=False, bm=cb)
        pos = pos + V(0.003 * math.sin(k * 0.5), 0.0, 0.0068)
    o4 = obj(cb, 'chain', brass)
    watch_obj = mk.join_objects([o1, o2, o3, o4], 'prop_watch')
    finish('prop_watch', 'prop_watch_Grp', [watch_obj])


def glass_box():
    mk.reset_scene()
    brass = tex('Box_Brass', I.brass(512, 512, seed=14), 0.3)
    glass = flat('Glass_Box', '#DDEFEC', 0.03)
    W, D, H = 0.10, 0.07, 0.05
    bm = new_bm()
    sol.box(bm, (-W / 2, -D / 2, 0.0), (W / 2, D / 2, H - 0.012), (20, 20))
    body = obj(bm, 'glass_body', glass)
    lb = new_bm()
    sol.box(lb, (-W / 2 - 0.0005, -D / 2 - 0.0005, H - 0.012), (W / 2 + 0.0005, D / 2 + 0.0005, H), (20, 20))
    lid = obj(lb, 'glass_lid', glass)
    fb = new_bm()
    t = 0.0028
    for (a, b) in (((-1, -1), (1, -1)), ((-1, 1), (1, 1))):                                       # frame bars along X (bottom + top rails, front + back)
        for z in (0.0, H - 0.012, H):
            sol.box(fb, (-W / 2 - 0.001, (D / 2) * a[1] - t, z - (t if z else 0)), (W / 2 + 0.001, (D / 2) * a[1] + t, z + t), (80, 80))
    for sx in (-1, 1):
        for sy in (-1, 1):
            sol.box(fb, (sx * W / 2 - t, sy * D / 2 - t, 0.0), (sx * W / 2 + t, sy * D / 2 + t, H), (80, 80))                  # corner posts
        for z in (0.0, H - 0.012, H):
            sol.box(fb, (sx * W / 2 - t, -D / 2, z - (t if z else 0)), (sx * W / 2 + t, D / 2, z + t), (80, 80))
    for sx in (-0.03, 0.03):                                                                    # hinges at the back
        sol.lathe(fb, [(0.0035, -0.006), (0.0035, 0.006)], center=(sx, D / 2 + 0.0035, H - 0.010), seg=12, axis=(1, 0, 0))
        sol.box(fb, (sx - 0.006, D / 2, H - 0.014), (sx + 0.006, D / 2 + 0.0015, H - 0.006), (80, 80))
    sol.box(fb, (-0.007, -D / 2 - 0.003, H - 0.020), (0.007, -D / 2, H - 0.006), (80, 80))                                      # clasp
    sol.lathe(fb, [(0.0025, 0.0), (0.0030, 0.003)], center=(0, -D / 2 - 0.003, H - 0.0135), seg=10, axis=(0, -1, 0))
    for sx in (-1, 1):                                                                          # little ball feet
        for sy in (-1, 1):
            mk.ellipsoid((sx * (W / 2 - 0.004), sy * (D / 2 - 0.004), -0.0025), (0.0045, 0.0045, 0.0040), seg=10, rings=6, bm=fb)
    frame = obj(fb, 'frame', brass)
    box = mk.join_objects([body, lid, frame], 'prop_box_glass')
    finish('prop_box_glass', 'prop_box_glass_Grp', [box])


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    for name, fn in (('bottle', bottle), ('cake', cake), ('jar', jar), ('key', key), ('watch', watch), ('box', glass_box)):
        if only and name not in only:
            continue
        fn()
