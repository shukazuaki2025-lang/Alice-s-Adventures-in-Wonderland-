#!/usr/bin/env python3
"""
Procedural 3D NPC Builder for Alice: Down the Rabbit-Hole (Chapter 1)
Builds high-detail subdivided/sculpted, rigged, and animated GLBs:
  - chr_rabbit.glb (0.75 m height, 8 mesh parts, 4 skeletal animations)
  - chr_sister.glb (0.95 m seated height, 5 mesh parts, Sister_ReadIdle)
  - chr_dinah_dream.glb (translucent golden-amber cat, Dinah_Float)
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MODELS_PUB = os.path.join(REPO_DIR, "public", "assets", "models")
MODELS_SRC = os.path.join(REPO_DIR, "assets_src", "models")
RENDER_DIR = os.path.join(REPO_DIR, "docs", "art", "npcs")
os.makedirs(MODELS_PUB, exist_ok=True)
os.makedirs(MODELS_SRC, exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)


def clear_scene_safe():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act, do_unlink=True)
    for arm in list(bpy.data.armatures):
        bpy.data.armatures.remove(arm, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_rgba(hex_str, alpha=1.0):
    h = hex_str.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def make_mat(name, hex_color, roughness=0.75, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    rgba = hex_to_rgba(hex_color, alpha)
    mat.diffuse_color = rgba
    if alpha < 1.0:
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'HASHED'
        if hasattr(mat, 'use_backface_culling'):
            mat.use_backface_culling = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        bsdf.inputs[0].default_value = rgba
        bsdf.inputs[1].default_value = metallic
        bsdf.inputs[2].default_value = roughness
        if len(bsdf.inputs) > 4:
            bsdf.inputs[4].default_value = alpha
    return mat


def assign_verts_mat(bm, verts, mat_idx):
    vset = set(verts)
    for f in bm.faces:
        if all(v in vset for v in f.verts):
            f.material_index = mat_idx


def finalize_mesh(name, bm, mats, subdiv=1):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        obj.data.materials.append(m)
    if subdiv > 0:
        mod = obj.modifiers.new("Subsurf", 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def setup_studio_and_render(prefix, target_z=0.38, dist=1.55, views=('front', 'side', 'back')):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE'
    scn.render.resolution_x = 1200
    scn.render.resolution_y = 1200
    scn.render.film_transparent = False
    if not scn.world:
        scn.world = bpy.data.worlds.new("StudioWorld")
    scn.world.use_nodes = True
    bg = next((n for n in scn.world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg:
        bg.inputs[0].default_value = (0.93, 0.90, 0.84, 1.0)
        bg.inputs[1].default_value = 1.0

    cam_data = bpy.data.cameras.new("TurnCam")
    cam_data.lens = 65
    cam = bpy.data.objects.new("TurnCam", cam_data)
    bpy.context.collection.objects.link(cam)
    scn.camera = cam

    key_d = bpy.data.lights.new("Key", type='AREA')
    key_d.energy = 120.0
    key_d.size = 2.0
    key_d.color = (1.0, 0.96, 0.90)
    key_l = bpy.data.objects.new("Key", key_d)
    key_l.location = (1.6, -2.0, 1.6)
    key_l.rotation_euler = (math.radians(55), 0, math.radians(35))
    bpy.context.collection.objects.link(key_l)

    fill_d = bpy.data.lights.new("Fill", type='AREA')
    fill_d.energy = 65.0
    fill_d.size = 2.5
    fill_d.color = (0.90, 0.94, 1.0)
    fill_l = bpy.data.objects.new("Fill", fill_d)
    fill_l.location = (-1.8, -1.6, 1.2)
    fill_l.rotation_euler = (math.radians(65), 0, math.radians(-40))
    bpy.context.collection.objects.link(fill_l)

    target = Vector((0, 0, target_z))
    configs = {
        'front': (Vector((0, -dist, target_z + 0.04)), target),
        'side':  (Vector((dist, 0, target_z + 0.04)), target),
        'back':  (Vector((0, dist, target_z + 0.04)), target),
    }
    for v in views:
        loc, look = configs[v]
        cam.location = loc
        cam.rotation_euler = (look - loc).to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(RENDER_DIR, f"{prefix}_{v}.png")
        bpy.ops.render.render(write_still=True)

    for o in [cam, key_l, fill_l]:
        bpy.data.objects.remove(o, do_unlink=True)


def build_white_rabbit():
    clear_scene_safe()
    m_fur = make_mat("M_Rabbit_Fur", "#F4F1EC", roughness=0.78)
    m_ear = make_mat("M_Rabbit_EarInner", "#F4C2C2", roughness=0.72)
    m_eye = make_mat("M_Rabbit_Eyes", "#E88FA3", roughness=0.15)
    m_coat = make_mat("M_Rabbit_Coat", "#9B5B3A", roughness=0.80)
    m_waist = make_mat("M_Rabbit_Waistcoat", "#D4A338", roughness=0.65)
    m_bow = make_mat("M_Rabbit_BowTie", "#7A2332", roughness=0.60)
    m_brass = make_mat("M_Rabbit_Brass", "#D4AF37", roughness=0.28, metallic=0.85)
    m_dark = make_mat("M_Rabbit_Dark", "#2B2420", roughness=0.35)

    # 1. Rabbit_Body
    bm = bmesh.new()
    g_pel = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.105)
    for v in g_pel['verts']:
        v.co.x *= 0.96
        v.co.y *= 0.90
        v.co.z = v.co.z * 0.85 + 0.175
    g_tail = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=12, radius=0.052)
    for v in g_tail['verts']:
        v.co += Vector((0.0, 0.135, 0.175))
    for sx in (-1.0, 1.0):
        g_th = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.052)
        for v in g_th['verts']:
            v.co.x *= 0.78
            v.co.z *= 1.30
            v.co += Vector((sx * 0.062, 0.01, 0.125))
        g_sh = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=0.025, radius2=0.034, depth=0.10)
        for v in g_sh['verts']:
            v.co += Vector((sx * 0.062, 0.01, 0.060))
        g_ft = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.034)
        for v in g_ft['verts']:
            v.co.x *= 0.75
            v.co.y *= 1.85
            v.co.z = max(0.0, v.co.z * 0.65 + 0.018)
            v.co += Vector((sx * 0.062, -0.035, 0.0))
        g_hd = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.026)
        for v in g_hd['verts']:
            v.co.y *= 1.20
            v.co += Vector((sx * 0.142, -0.075, 0.285))
    obj_body = finalize_mesh("Rabbit_Body", bm, m_fur, subdiv=1)

    # 2. Rabbit_Waistcoat
    bm = bmesh.new()
    g_ws = bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=18, radius=0.118)
    for v in g_ws['verts']:
        z_t = (v.co.z + 0.118) / 0.236
        scale_xy = 1.05 - 0.25 * z_t
        v.co.x *= scale_xy
        v.co.y *= scale_xy * 0.92
        v.co.z = v.co.z * 1.05 + 0.285
    assign_verts_mat(bm, g_ws['verts'], 0)
    for bz, by in ((0.225, -0.108), (0.262, -0.112), (0.300, -0.110), (0.338, -0.102)):
        g_b = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.009)
        for v in g_b['verts']:
            v.co += Vector((0.0, by, bz))
        assign_verts_mat(bm, g_b['verts'], 1)
    obj_waist = finalize_mesh("Rabbit_Waistcoat", bm, [m_waist, m_brass], subdiv=1)

    # 3. Rabbit_Coat
    bm = bmesh.new()
    g_jk = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=32, radius1=0.134, radius2=0.106, depth=0.22)
    for v in g_jk['verts']:
        if v.co.y < -0.04 and abs(v.co.x) < 0.075:
            v.co.y = -0.045
        else:
            v.co.x *= 1.06
            v.co.y *= 1.04
        if v.co.y > 0.04 and v.co.z < -0.06:
            v.co.z -= 0.055
            v.co.y += 0.025
        v.co.z += 0.285
    for sx in (-1.0, 1.0):
        g_sl = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=0.032, radius2=0.042, depth=0.135)
        rot_m = Euler((math.radians(32), sx * math.radians(-28), 0)).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_m, verts=g_sl['verts'])
        for v in g_sl['verts']:
            v.co += Vector((sx * 0.118, -0.040, 0.325))
    g_col = bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=24, radius1=0.088, radius2=0.095, depth=0.032)
    for v in g_col['verts']:
        v.co.z += 0.398
    obj_coat = finalize_mesh("Rabbit_Coat", bm, m_coat, subdiv=1)

    # 4. Rabbit_Head
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=18, radius=0.092)
    for v in bm.verts:
        if v.co.z < 0.01 and abs(v.co.x) > 0.04:
            v.co.x *= 1.18
        if v.co.y < -0.03 and abs(v.co.z) < 0.045:
            v.co.y *= 1.25
        v.co += Vector((0.0, -0.01, 0.475))
    for sx in (-1.0, 1.0):
        g_mz = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.026)
        for v in g_mz['verts']:
            v.co += Vector((sx * 0.024, -0.102, 0.458))
    obj_head = finalize_mesh("Rabbit_Head", bm, m_fur, subdiv=1)

    # 5. Rabbit_Eyes
    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        g_ey = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=0.021)
        for v in g_ey['verts']:
            v.co.y *= 0.65
            v.co += Vector((sx * 0.043, -0.094, 0.495))
        assign_verts_mat(bm, g_ey['verts'], 0)
        g_pu = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.010)
        for v in g_pu['verts']:
            v.co.y *= 0.45
            v.co += Vector((sx * 0.043, -0.106, 0.495))
        assign_verts_mat(bm, g_pu['verts'], 1)
        g_hi = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.0045)
        for v in g_hi['verts']:
            v.co += Vector((sx * 0.047, -0.110, 0.500))
        assign_verts_mat(bm, g_hi['verts'], 2)
        g_br = bmesh.ops.create_cube(bm, size=1.0)
        for v in g_br['verts']:
            v.co.x *= 0.015
            v.co.y *= 0.004
            v.co.z *= 0.0035
            v.co += Vector((sx * 0.043, -0.092, 0.520))
        assign_verts_mat(bm, g_br['verts'], 1)
    g_ns = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.015)
    for v in g_ns['verts']:
        v.co.x *= 1.2
        v.co.z *= 0.85
        v.co += Vector((0.0, -0.125, 0.472))
    assign_verts_mat(bm, g_ns['verts'], 0)
    obj_eyes = finalize_mesh("Rabbit_Eyes", bm, [m_eye, m_dark, m_fur], subdiv=1)

    # 6. Rabbit_Ears
    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        g_ear = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=16, radius=0.032)
        for v in g_ear['verts']:
            z_norm = (v.co.z + 0.032) / 0.064
            width = 0.55 + 0.65 * math.sin(z_norm * math.pi)
            v.co.x *= width
            v.co.y *= 0.42
            v.co.z = z_norm * 0.205
            v.co.x += sx * (0.038 + 0.018 * z_norm)
            v.co.y += -0.005 + 0.012 * (z_norm ** 2)
            v.co.z += 0.545
    obj_ears = finalize_mesh("Rabbit_Ears", bm, [m_ear, m_fur], subdiv=1)
    for poly in obj_ears.data.polygons:
        if poly.normal.y > -0.15:
            poly.material_index = 1

    # 7. Rabbit_BowTie
    bm = bmesh.new()
    g_knot = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.014)
    for v in g_knot['verts']:
        v.co += Vector((0.0, -0.098, 0.388))
    for sx in (-1.0, 1.0):
        g_wing = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=0.008, radius2=0.024, depth=0.042)
        rot_w = Euler((0, sx * math.radians(90), 0)).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_w, verts=g_wing['verts'])
        for v in g_wing['verts']:
            v.co.y *= 0.45
            v.co += Vector((sx * 0.024, -0.099, 0.388))
    obj_bow = finalize_mesh("Rabbit_BowTie", bm, m_bow, subdiv=1)

    # 8. Rabbit_Watch
    bm = bmesh.new()
    g_wc = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, radius1=0.036, radius2=0.036, depth=0.014)
    rot_wc = Euler((math.radians(75), 0, math.radians(-15))).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=rot_wc, verts=g_wc['verts'])
    for v in g_wc['verts']:
        v.co += Vector((-0.145, -0.105, 0.295))
    g_cr = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.008)
    for v in g_cr['verts']:
        v.co += Vector((-0.145, -0.108, 0.334))
    obj_watch = finalize_mesh("Rabbit_Watch", bm, m_brass, subdiv=1)

    parts = [obj_body, obj_head, obj_ears, obj_eyes, obj_waist, obj_coat, obj_bow, obj_watch]
    bpy.context.view_layer.update()
    min_z = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in parts)
    max_z = max(max((o.matrix_world @ v.co).z for v in o.data.vertices) for o in parts)
    scale_f = 0.75 / (max_z - min_z)
    for o in parts:
        for v in o.data.vertices:
            v.co.z = (v.co.z - min_z) * scale_f
            v.co.x *= scale_f
            v.co.y *= scale_f
        o.data.update()

    arm_data = bpy.data.armatures.new("Rabbit_Rig_Data")
    rig = bpy.data.objects.new("Rabbit_Rig", arm_data)
    bpy.context.collection.objects.link(rig)
    rig["height"] = 0.75
    rig["character"] = "WhiteRabbit"

    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def add_b(name, head, tail, parent=None):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = eb[parent]
        return b

    add_b("Root", (0, 0, 0), (0, 0, 0.12))
    add_b("Pelvis", (0, 0, 0.15), (0, 0, 0.25), "Root")
    add_b("Spine", (0, 0, 0.25), (0, 0, 0.38), "Pelvis")
    add_b("Head", (0, -0.01, 0.38), (0, -0.01, 0.54), "Spine")
    add_b("Ear.L", (0.04, 0, 0.54), (0.05, 0, 0.74), "Head")
    add_b("Ear.R", (-0.04, 0, 0.54), (-0.05, 0, 0.74), "Head")
    add_b("Arm.L", (0.09, -0.01, 0.35), (0.145, -0.08, 0.28), "Spine")
    add_b("Arm.R", (-0.09, -0.01, 0.35), (-0.145, -0.10, 0.29), "Spine")
    add_b("Leg.L", (0.065, 0.01, 0.16), (0.065, -0.02, 0.02), "Pelvis")
    add_b("Leg.R", (-0.065, 0.01, 0.16), (-0.065, -0.02, 0.02), "Pelvis")
    add_b("Tail", (0, 0.10, 0.18), (0, 0.16, 0.20), "Pelvis")
    bpy.ops.object.mode_set(mode='OBJECT')

    for o in parts:
        o.parent = rig
        mod = o.modifiers.new("Armature", 'ARMATURE')
        mod.object = rig
        for b in arm_data.bones:
            if b.name not in o.vertex_groups:
                o.vertex_groups.new(name=b.name)
        for v in o.data.vertices:
            z = v.co.z
            x = v.co.x
            if o.name == "Rabbit_Watch":
                o.vertex_groups["Arm.R"].add([v.index], 1.0, 'REPLACE')
            elif o.name == "Rabbit_Ears":
                bname = "Ear.L" if x >= 0 else "Ear.R"
                o.vertex_groups[bname].add([v.index], 1.0, 'REPLACE')
            elif o.name in ("Rabbit_Head", "Rabbit_Eyes", "Rabbit_BowTie"):
                o.vertex_groups["Head"].add([v.index], 1.0, 'REPLACE')
            elif z < 0.16:
                bname = "Leg.L" if x >= 0 else "Leg.R"
                o.vertex_groups[bname].add([v.index], 1.0, 'REPLACE')
            elif abs(x) > 0.105 and z > 0.24:
                bname = "Arm.L" if x >= 0 else "Arm.R"
                o.vertex_groups[bname].add([v.index], 1.0, 'REPLACE')
            else:
                o.vertex_groups["Spine"].add([v.index], 1.0, 'REPLACE')

    rig.animation_data_create()
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'XYZ'

    def key_pose(act, frame, mapping):
        rig.animation_data.action = act
        for b in pb:
            b.location = (0, 0, 0)
            b.rotation_euler = (0, 0, 0)
        for bname, (loc, rot_deg) in mapping.items():
            if loc:
                pb[bname].location = Vector(loc)
            if rot_deg:
                pb[bname].rotation_euler = Euler([math.radians(a) for a in rot_deg], 'XYZ')
        for bname in ["Root", "Pelvis", "Spine", "Head", "Ear.L", "Ear.R", "Arm.L", "Arm.R", "Leg.L", "Leg.R", "Tail"]:
            pb[bname].keyframe_insert(data_path="location", frame=frame)
            pb[bname].keyframe_insert(data_path="rotation_euler", frame=frame)

    act_hurry = bpy.data.actions.new("Rabbit_Hurry")
    act_hurry.use_fake_user = True
    key_pose(act_hurry, 1, {})
    key_pose(act_hurry, 7, {"Pelvis": ((0,0,0.015), (8,0,0)), "Leg.L": (None, (28,0,0)), "Leg.R": (None, (-28,0,0)), "Arm.R": (None, (25,0,-10)), "Ear.L": (None, (-12,0,0)), "Ear.R": (None, (-8,0,0))})
    key_pose(act_hurry, 13, {"Pelvis": ((0,0,0), (6,0,0)), "Head": (None, (10,0,-8)), "Arm.R": (None, (30,0,-15))})
    key_pose(act_hurry, 19, {"Pelvis": ((0,0,0.015), (8,0,0)), "Leg.L": (None, (-28,0,0)), "Leg.R": (None, (28,0,0)), "Arm.L": (None, (22,0,0)), "Ear.L": (None, (-8,0,0)), "Ear.R": (None, (-14,0,0))})
    key_pose(act_hurry, 25, {})

    act_scurry = bpy.data.actions.new("Rabbit_Scurry")
    act_scurry.use_fake_user = True
    key_pose(act_scurry, 1, {})
    key_pose(act_scurry, 6, {"Pelvis": ((0,0,0.035), (15,0,0)), "Leg.L": (None, (38,0,0)), "Leg.R": (None, (38,0,0)), "Ear.L": (None, (-22,0,0)), "Ear.R": (None, (-22,0,0))})
    key_pose(act_scurry, 12, {"Pelvis": ((0,0,-0.01), (10,0,0)), "Leg.L": (None, (-30,0,0)), "Leg.R": (None, (-30,0,0)), "Ear.L": (None, (8,0,0)), "Ear.R": (None, (8,0,0))})
    key_pose(act_scurry, 18, {})

    act_watch = bpy.data.actions.new("Rabbit_CheckWatch")
    act_watch.use_fake_user = True
    key_pose(act_watch, 1, {})
    key_pose(act_watch, 10, {"Arm.R": (None, (48, 0, -22)), "Head": (None, (18, 0, -14)), "Ear.L": (None, (12, 0, 5))})
    key_pose(act_watch, 20, {"Arm.R": (None, (50, 0, -24)), "Head": (None, (16, 0, -6)), "Ear.R": (None, (14, 0, -5))})
    key_pose(act_watch, 30, {})

    act_look = bpy.data.actions.new("Rabbit_LookBack")
    act_look.use_fake_user = True
    key_pose(act_look, 1, {})
    key_pose(act_look, 12, {"Spine": (None, (0, 0, 22)), "Head": (None, (-6, 0, 48)), "Ear.L": (None, (-10, 0, 12)), "Ear.R": (None, (-10, 0, 12))})
    key_pose(act_look, 24, {"Spine": (None, (0, 0, 20)), "Head": (None, (-4, 0, 45))})
    key_pose(act_look, 36, {})

    bpy.context.scene.frame_set(1)
    rig.animation_data.use_nla = False
    rig.animation_data.action = act_hurry
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    for out_dir in (MODELS_PUB, MODELS_SRC):
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(out_dir, "chr_rabbit.glb"),
            export_format='GLB',
            export_extras=True,
            export_skins=True,
            export_animations=True,
            export_animation_mode='ACTIONS',
            export_force_sampling=True,
            export_lights=False,
            export_cameras=False
        )

    setup_studio_and_render("rabbit", target_z=0.36, dist=1.55, views=('front', 'side', 'back'))


def build_sister():
    clear_scene_safe()
    m_skin = make_mat("M_Sister_Skin", "#FCE0D2", roughness=0.65)
    m_dress = make_mat("M_Sister_Dress", "#556B2F", roughness=0.82)
    m_shawl = make_mat("M_Sister_Shawl", "#E8DEC8", roughness=0.85)
    m_hair = make_mat("M_Sister_Hair", "#4A3B32", roughness=0.72)
    m_book = make_mat("M_Sister_Book", "#6B3E26", roughness=0.75)
    m_pages = make_mat("M_Sister_Pages", "#F7F3EA", roughness=0.85)
    m_dark = make_mat("M_Sister_Dark", "#2B2420", roughness=0.40)
    m_lip = make_mat("M_Sister_Lip", "#DE8282", roughness=0.55)

    bm = bmesh.new()
    g_sk = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=0.28, radius2=0.145, depth=0.44)
    for v in g_sk['verts']:
        if v.co.y < 0:
            v.co.y *= 1.32
        angle = math.atan2(v.co.y, v.co.x)
        v.co.x *= 1.0 + 0.04 * math.sin(angle * 10)
        v.co.z += 0.22
    g_bd = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.135)
    for v in g_bd['verts']:
        v.co.x *= 0.95
        v.co.y *= 0.80
        v.co.z = v.co.z * 1.35 + 0.50
    for sx in (-1.0, 1.0):
        g_sl = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=0.035, radius2=0.048, depth=0.22)
        rot_s = Euler((math.radians(52), sx * math.radians(-18), 0)).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_s, verts=g_sl['verts'])
        for v in g_sl['verts']:
            v.co += Vector((sx * 0.135, -0.075, 0.54))
    obj_dress = finalize_mesh("Sister_Dress", bm, m_dress, subdiv=1)

    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=0.185, radius2=0.095, depth=0.20)
    for v in bm.verts:
        angle = math.atan2(v.co.y, v.co.x)
        if v.co.z < 0:
            v.co.z -= 0.03 * abs(math.sin(angle))
        v.co.y *= 0.88
        v.co.z += 0.61
    obj_shawl = finalize_mesh("Sister_Shawl", bm, m_shawl, subdiv=1)

    bm = bmesh.new()
    g_nk = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=0.045, radius2=0.040, depth=0.09)
    for v in g_nk['verts']:
        v.co += Vector((0.0, -0.01, 0.70))
    assign_verts_mat(bm, g_nk['verts'], 0)
    g_hd = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=18, radius=0.098)
    for v in g_hd['verts']:
        v.co.x *= 0.90
        v.co += Vector((0.0, -0.02, 0.82))
    assign_verts_mat(bm, g_hd['verts'], 0)
    g_ns = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.014)
    for v in g_ns['verts']:
        v.co += Vector((0.0, -0.118, 0.812))
    assign_verts_mat(bm, g_ns['verts'], 0)
    for sx in (-1.0, 1.0):
        g_hn = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.028)
        for v in g_hn['verts']:
            v.co.x *= 0.75
            v.co.y *= 1.35
            v.co += Vector((sx * 0.095, -0.175, 0.455))
        assign_verts_mat(bm, g_hn['verts'], 0)
        g_ey = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.014)
        for v in g_ey['verts']:
            v.co.y *= 0.35
            v.co.z *= 0.55
            v.co += Vector((sx * 0.036, -0.114, 0.825))
        assign_verts_mat(bm, g_ey['verts'], 1)
        g_br = bmesh.ops.create_cube(bm, size=1.0)
        for v in g_br['verts']:
            v.co.x *= 0.016
            v.co.y *= 0.004
            v.co.z *= 0.003
            v.co += Vector((sx * 0.036, -0.112, 0.844))
        assign_verts_mat(bm, g_br['verts'], 1)
    g_lp = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.014)
    for v in g_lp['verts']:
        v.co.x *= 1.35
        v.co.y *= 0.35
        v.co.z *= 0.45
        v.co += Vector((0.0, -0.114, 0.785))
    assign_verts_mat(bm, g_lp['verts'], 2)
    obj_head = finalize_mesh("Sister_Head", bm, [m_skin, m_dark, m_lip], subdiv=1)

    bm = bmesh.new()
    g_cr = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=18, radius=0.104)
    for v in g_cr['verts']:
        if v.co.y < -0.025 and v.co.z < 0.035:
            v.co.y += 0.055
        v.co.x *= 0.92
        v.co += Vector((0.0, -0.010, 0.835))
    g_bn = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=0.055)
    for v in g_bn['verts']:
        v.co += Vector((0.0, 0.095, 0.785))
    obj_hair = finalize_mesh("Sister_Hair", bm, m_hair, subdiv=1)

    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        g_pg = bmesh.ops.create_cube(bm, size=1.0)
        for v in g_pg['verts']:
            v.co.x = v.co.x * 0.095 + sx * 0.048
            v.co.y *= 0.135
            v.co.z *= 0.018
        rot_b = Euler((math.radians(28), sx * math.radians(-18), 0)).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_b, verts=g_pg['verts'])
        for v in g_pg['verts']:
            v.co += Vector((0.0, -0.195, 0.465))
    obj_book = finalize_mesh("Sister_Book", bm, [m_book, m_pages], subdiv=1)
    for poly in obj_book.data.polygons:
        if poly.normal.z > 0.3:
            poly.material_index = 1

    parts = [obj_dress, obj_shawl, obj_head, obj_hair, obj_book]
    bpy.context.view_layer.update()
    min_z = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in parts)
    max_z = max(max((o.matrix_world @ v.co).z for v in o.data.vertices) for o in parts)
    scale_f = 0.95 / (max_z - min_z)
    for o in parts:
        for v in o.data.vertices:
            v.co.z = (v.co.z - min_z) * scale_f
            v.co.x *= scale_f
            v.co.y *= scale_f
        o.data.update()

    arm_data = bpy.data.armatures.new("Sister_Rig_Data")
    rig = bpy.data.objects.new("Sister_Rig", arm_data)
    bpy.context.collection.objects.link(rig)
    rig["height"] = 0.95
    rig["character"] = "Sister"

    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    b_root = eb.new("Root")
    b_root.head = Vector((0, 0, 0))
    b_root.tail = Vector((0, 0, 0.35))
    b_spine = eb.new("Spine")
    b_spine.head = Vector((0, 0, 0.35))
    b_spine.tail = Vector((0, 0, 0.68))
    b_spine.parent = b_root
    b_head = eb.new("Head")
    b_head.head = Vector((0, -0.01, 0.68))
    b_head.tail = Vector((0, -0.02, 0.92))
    b_head.parent = b_spine
    b_book = eb.new("BookHold")
    b_book.head = Vector((0, -0.10, 0.50))
    b_book.tail = Vector((0, -0.22, 0.45))
    b_book.parent = b_spine
    bpy.ops.object.mode_set(mode='OBJECT')

    for o in parts:
        o.parent = rig
        mod = o.modifiers.new("Armature", 'ARMATURE')
        mod.object = rig
        for b in arm_data.bones:
            o.vertex_groups.new(name=b.name)
        for v in o.data.vertices:
            if o.name == "Sister_Book":
                o.vertex_groups["BookHold"].add([v.index], 1.0, 'REPLACE')
            elif o.name in ("Sister_Head", "Sister_Hair") and v.co.z > 0.60:
                o.vertex_groups["Head"].add([v.index], 1.0, 'REPLACE')
            elif v.co.z > 0.35:
                o.vertex_groups["Spine"].add([v.index], 1.0, 'REPLACE')
            else:
                o.vertex_groups["Root"].add([v.index], 1.0, 'REPLACE')

    rig.animation_data_create()
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'XYZ'
    act = bpy.data.actions.new("Sister_ReadIdle")
    act.use_fake_user = True
    rig.animation_data.action = act

    for f, h_rot, s_rot in [(1, (0,0,0), (0,0,0)), (20, (-4,0,3), (2,0,0)), (40, (-3,0,-3), (1,0,0)), (60, (0,0,0), (0,0,0))]:
        pb["Head"].rotation_euler = Euler([math.radians(a) for a in h_rot], 'XYZ')
        pb["Spine"].rotation_euler = Euler([math.radians(a) for a in s_rot], 'XYZ')
        for b in pb:
            b.keyframe_insert(data_path="location", frame=f)
            b.keyframe_insert(data_path="rotation_euler", frame=f)

    bpy.context.scene.frame_set(1)
    rig.animation_data.use_nla = False
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    for out_dir in (MODELS_PUB, MODELS_SRC):
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(out_dir, "chr_sister.glb"),
            export_format='GLB',
            export_extras=True,
            export_skins=True,
            export_animations=True,
            export_animation_mode='ACTIONS',
            export_force_sampling=True,
            export_lights=False,
            export_cameras=False
        )

    setup_studio_and_render("sister", target_z=0.46, dist=1.85, views=('front',))


def build_dinah():
    clear_scene_safe()
    m_dinah = make_mat("M_Dinah_Dream", "#F5B041", roughness=0.35, alpha=0.80)
    m_eye = make_mat("M_Dinah_Eyes", "#4E9A51", roughness=0.15)
    m_nose = make_mat("M_Dinah_Nose", "#F4C2C2", roughness=0.50)

    bm = bmesh.new()
    g_bd = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.105)
    for v in g_bd['verts']:
        v.co.x *= 0.82
        v.co.y *= 1.35
        v.co.z = v.co.z * 0.88 + 0.21
    assign_verts_mat(bm, g_bd['verts'], 0)
    g_hd = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=16, radius=0.082)
    for v in g_hd['verts']:
        v.co += Vector((0.0, -0.145, 0.305))
    assign_verts_mat(bm, g_hd['verts'], 0)
    for sx in (-1.0, 1.0):
        g_er = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=0.028, radius2=0.003, depth=0.065)
        for v in g_er['verts']:
            v.co += Vector((sx * 0.046, -0.140, 0.385))
        assign_verts_mat(bm, g_er['verts'], 0)
    for i in range(10):
        t = i / 9.0
        g_tl = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.020 * (1.0 - 0.3 * t))
        for v in g_tl['verts']:
            v.co += Vector((0.07 + 0.05 * t, 0.13 + 0.08 * t, 0.22 + 0.15 * (t ** 1.3)))
        assign_verts_mat(bm, g_tl['verts'], 0)
    for sx in (-1.0, 1.0):
        for sy in (-0.09, 0.08):
            g_pw = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.030)
            for v in g_pw['verts']:
                v.co.z *= 1.5
                v.co += Vector((sx * 0.065, sy, 0.12))
            assign_verts_mat(bm, g_pw['verts'], 0)
    for sx in (-1.0, 1.0):
        g_ey = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.015)
        for v in g_ey['verts']:
            v.co.y *= 0.45
            v.co += Vector((sx * 0.032, -0.224, 0.315))
        assign_verts_mat(bm, g_ey['verts'], 1)
    g_ns = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.010)
    for v in g_ns['verts']:
        v.co += Vector((0.0, -0.229, 0.295))
    assign_verts_mat(bm, g_ns['verts'], 2)
    obj_body = finalize_mesh("Dinah_Body", bm, [m_dinah, m_eye, m_nose], subdiv=1)

    arm_data = bpy.data.armatures.new("Dinah_Rig_Data")
    rig = bpy.data.objects.new("Dinah_Rig", arm_data)
    bpy.context.collection.objects.link(rig)
    rig["character"] = "DinahDream"

    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    b_root = eb.new("Root")
    b_root.head = Vector((0, 0, 0.22))
    b_root.tail = Vector((0, -0.14, 0.30))
    b_tail = eb.new("Tail")
    b_tail.head = Vector((0, 0.14, 0.23))
    b_tail.tail = Vector((0, 0.27, 0.37))
    b_tail.parent = b_root
    bpy.ops.object.mode_set(mode='OBJECT')

    obj_body.parent = rig
    mod = obj_body.modifiers.new("Armature", 'ARMATURE')
    mod.object = rig
    for b in arm_data.bones:
        obj_body.vertex_groups.new(name=b.name)
    for v in obj_body.data.vertices:
        if v.co.y > 0.12:
            obj_body.vertex_groups["Tail"].add([v.index], 1.0, 'REPLACE')
        else:
            obj_body.vertex_groups["Root"].add([v.index], 1.0, 'REPLACE')

    rig.animation_data_create()
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'XYZ'
    act = bpy.data.actions.new("Dinah_Float")
    act.use_fake_user = True
    rig.animation_data.action = act

    for f, dz, rot_r, rot_t in [(1, 0.0, (0,0,0), (0,0,0)), (15, 0.035, (6,0,4), (12,0,18)), (30, 0.0, (-4,0,-4), (-10,0,-18)), (45, 0.0, (0,0,0), (0,0,0))]:
        pb["Root"].location = Vector((0, 0, dz))
        pb["Root"].rotation_euler = Euler([math.radians(a) for a in rot_r], 'XYZ')
        pb["Tail"].rotation_euler = Euler([math.radians(a) for a in rot_t], 'XYZ')
        for b in pb:
            b.keyframe_insert(data_path="location", frame=f)
            b.keyframe_insert(data_path="rotation_euler", frame=f)

    bpy.context.scene.frame_set(1)
    rig.animation_data.use_nla = False
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    for out_dir in (MODELS_PUB, MODELS_SRC):
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(out_dir, "chr_dinah_dream.glb"),
            export_format='GLB',
            export_extras=True,
            export_skins=True,
            export_animations=True,
            export_animation_mode='ACTIONS',
            export_force_sampling=True,
            export_lights=False,
            export_cameras=False
        )

    setup_studio_and_render("dinah", target_z=0.26, dist=1.25, views=('front',))


if __name__ == "__main__":
    build_white_rabbit()
    build_sister()
    build_dinah()
