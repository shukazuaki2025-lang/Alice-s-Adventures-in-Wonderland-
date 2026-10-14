#!/usr/bin/env python3
"""
tools/blender/build_ch1_architecture.py
Procedural 3D Environment & Prop Builder for Chapter 1 ("Down the Rabbit-Hole").
Builds high-detail subdivided Victorian props and scene GLBs with logic markers.
"""

import os
import math
import bpy
import bmesh
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUT_DIRS = [
    os.path.join(REPO_DIR, "public", "assets", "models"),
    os.path.join(REPO_DIR, "assets_src", "models"),
]
for d in OUT_DIRS:
    os.makedirs(d, exist_ok=True)


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


def make_mat(name, hex_color, roughness=0.7, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    rgba = hex_to_rgba(hex_color, alpha)
    mat.diffuse_color = rgba
    if alpha < 1.0 and hasattr(mat, 'blend_method'):
        mat.blend_method = 'BLEND'
    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        bsdf.inputs[0].default_value = rgba
        bsdf.inputs[1].default_value = metallic
        bsdf.inputs[2].default_value = roughness
        if len(bsdf.inputs) > 4:
            bsdf.inputs[4].default_value = alpha
    return mat


def create_empty_marker(name, parent, location=(0, 0, 0), rotation=(0, 0, 0), custom_props=None):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = 'PLAIN_AXES'
    empty.empty_display_size = 0.5
    empty.location = location
    empty.rotation_euler = rotation
    if parent:
        empty.parent = parent
    bpy.context.collection.objects.link(empty)
    if custom_props:
        for k, v in custom_props.items():
            empty[k] = v
    return empty


def select_hierarchy(obj):
    obj.select_set(True)
    for child in obj.children:
        select_hierarchy(child)


def export_object_as_glb(obj, name):
    bpy.ops.object.select_all(action='DESELECT')
    select_hierarchy(obj)
    for d in OUT_DIRS:
        filepath = os.path.join(d, f"{name}.glb")
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_extras=True,
            export_lights=False,
            export_cameras=False,
            export_animations=True
        )


def finalize_child_mesh(name, parent, bm, mat, loc=(0, 0, 0), subdiv=1, props=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    if parent:
        obj.parent = parent
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if subdiv > 0:
        mod = obj.modifiers.new("Subsurf", 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if props:
        for k, v in props.items():
            obj[k] = v
    return obj


def build_and_export_all():
    clear_scene_safe()
    m_grass = make_mat("M_Grass", "#6E9E56", roughness=0.85)
    m_stone = make_mat("M_Stone", "#706862", roughness=0.78)
    m_wood  = make_mat("M_Wood", "#5C3C24", roughness=0.68)
    m_wall  = make_mat("M_Hall_Wall", "#D8C3A5", roughness=0.75)
    m_glass_table = make_mat("M_Glass_Refractive", "#BFE8F5", roughness=0.08, alpha=0.28)
    m_glass_bottle = make_mat("M_Glass_Bottle", "#7AC7D4", roughness=0.10, alpha=0.38)
    m_glass_box = make_mat("M_Glass_Box", "#D6F0F5", roughness=0.10, alpha=0.35)
    m_gold  = make_mat("M_Gold_Key", "#D4AF37", roughness=0.25, metallic=0.90)
    m_cake  = make_mat("M_Cake", "#C99650", roughness=0.80)
    m_icing = make_mat("M_Icing", "#F7F3EA", roughness=0.65)
    m_currant = make_mat("M_Currant", "#2B2420", roughness=0.50)
    m_curtain = make_mat("M_Curtain", "#8A1C2B", roughness=0.75)
    m_lamp  = make_mat("M_Emissive_Lamp", "#FFE08A", roughness=0.20)
    m_amber = make_mat("M_Marmalade", "#E09540", roughness=0.35)

    # 1. Props
    grp_key = bpy.data.objects.new("prop_key_gold_Grp", None)
    bpy.context.collection.objects.link(grp_key)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, radius1=0.0045, radius2=0.0045, depth=0.075)
    for z_off in (-0.025, 0.018, 0.024):
        g_r = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.0075)
        for v in g_r['verts']:
            v.co.z = v.co.z * 0.45 + z_off
    for ang in (0, 2.094, 4.188):
        g_l = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=0.012)
        for v in g_l['verts']:
            v.co.y *= 0.35
            v.co += Vector((0.011 * math.cos(ang), 0.0, 0.040 + 0.011 * math.sin(ang)))
    for z_t in (-0.032, -0.024):
        g_b = bmesh.ops.create_cube(bm, size=1.0)
        for v in g_b['verts']:
            v.co.x = v.co.x * 0.008 + 0.007
            v.co.y *= 0.003
            v.co.z = v.co.z * 0.005 + z_t
    finalize_child_mesh("prop_key_gold", grp_key, bm, m_gold, subdiv=1)
    export_object_as_glb(grp_key, "prop_key_gold")

    grp_bot = bpy.data.objects.new("prop_bottle_drinkme_Grp", None)
    bpy.context.collection.objects.link(grp_bot)
    bm = bmesh.new()
    g_bd = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=0.032, radius2=0.030, depth=0.085)
    for v in g_bd['verts']:
        v.co.z += 0.0425
    g_sh = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=0.030, radius2=0.012, depth=0.025)
    for v in g_sh['verts']:
        v.co.z += 0.0975
    g_nk = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, radius1=0.012, radius2=0.014, depth=0.025)
    for v in g_nk['verts']:
        v.co.z += 0.1225
    finalize_child_mesh("prop_bottle_drinkme", grp_bot, bm, m_glass_bottle, subdiv=1, props={"Front_Label": "DRINK ME", "Back_Label": ""})

    bm_f = bmesh.new()
    bmesh.ops.create_cube(bm_f, size=1.0)
    for v in bm_f.verts:
        v.co.x *= 0.036
        v.co.y = v.co.y * 0.003 - 0.033
        v.co.z = v.co.z * 0.042 + 0.045
    finalize_child_mesh("Front_Label", grp_bot, bm_f, m_icing, subdiv=1, props={"label": "DRINK ME"})

    bm_b = bmesh.new()
    bmesh.ops.create_cube(bm_b, size=1.0)
    for v in bm_b.verts:
        v.co.x *= 0.032
        v.co.y = v.co.y * 0.003 + 0.033
        v.co.z = v.co.z * 0.038 + 0.045
    finalize_child_mesh("Back_Label", grp_bot, bm_b, m_icing, subdiv=1, props={"label": "SAFE_NO_POISON"})
    export_object_as_glb(grp_bot, "prop_bottle_drinkme")

    grp_cake = bpy.data.objects.new("prop_cake_eatme_Grp", None)
    bpy.context.collection.objects.link(grp_cake)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=0.038, radius2=0.040, depth=0.028)
    for v in bm.verts:
        ang = math.atan2(v.co.y, v.co.x)
        v.co.x *= 1.0 + 0.05 * math.cos(ang * 12)
        v.co.y *= 1.0 + 0.05 * math.cos(ang * 12)
        v.co.z += 0.014
    finalize_child_mesh("prop_cake_eatme", grp_cake, bm, m_cake, subdiv=1, props={"decal": "EAT ME"})
    bm_cr = bmesh.new()
    for i in range(12):
        ang = i * (2 * math.pi / 12)
        g_c = bmesh.ops.create_uvsphere(bm_cr, u_segments=10, v_segments=8, radius=0.0035)
        for v in g_c['verts']:
            v.co += Vector((0.024 * math.cos(ang), 0.024 * math.sin(ang), 0.029))
    finalize_child_mesh("Cake_Currants", grp_cake, bm_cr, m_currant, subdiv=0)
    export_object_as_glb(grp_cake, "prop_cake_eatme")

    grp_box = bpy.data.objects.new("prop_box_glass_Grp", None)
    bpy.context.collection.objects.link(grp_box)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.12
        v.co.y *= 0.08
        v.co.z = v.co.z * 0.06 + 0.03
    finalize_child_mesh("prop_box_glass", grp_box, bm, m_glass_box, subdiv=1)
    export_object_as_glb(grp_box, "prop_box_glass")

    grp_jar = bpy.data.objects.new("prop_jar_marmalade_Grp", None)
    bpy.context.collection.objects.link(grp_jar)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=0.045, radius2=0.042, depth=0.14)
    for v in bm.verts:
        v.co.z += 0.07
    finalize_child_mesh("prop_jar_marmalade", grp_jar, bm, m_amber, subdiv=1, props={"decal": "ORANGE MARMALADE"})
    bm_jl = bmesh.new()
    bmesh.ops.create_cone(bm_jl, cap_ends=False, cap_tris=False, segments=24, radius1=0.046, radius2=0.045, depth=0.065)
    for v in bm_jl.verts:
        v.co.z += 0.07
    finalize_child_mesh("Jar_Label", grp_jar, bm_jl, m_icing, subdiv=1)
    export_object_as_glb(grp_jar, "prop_jar_marmalade")

    grp_watch = bpy.data.objects.new("prop_watch_Grp", None)
    bpy.context.collection.objects.link(grp_watch)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=0.030, radius2=0.030, depth=0.012)
    g_ring = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=0.008)
    for v in g_ring['verts']:
        v.co += Vector((0.0, 0.034, 0.0))
    finalize_child_mesh("prop_watch", grp_watch, bm, m_gold, subdiv=1)
    export_object_as_glb(grp_watch, "prop_watch")

    # 2. Scenes
    s1_group = bpy.data.objects.new("S1_Riverbank", None)
    bpy.context.collection.objects.link(s1_group)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=16, y_segments=16, size=35.0)
    for v in bm.verts:
        v.co.z = 0.25 * math.sin(v.co.x * 0.12) * math.cos(v.co.y * 0.12)
    finalize_child_mesh("S1_Ground_Meadow", s1_group, bm, m_grass, subdiv=0)

    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=0.85, radius2=0.55, depth=3.8)
    for v in bm.verts:
        v.co.z += 1.9
    finalize_child_mesh("S1_Oak_Tree_Trunk", s1_group, bm, m_wood, loc=(-1.5, 2.0, 0), subdiv=1)

    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=14, radius=2.8)
    finalize_child_mesh("S1_Oak_Tree_Canopy", s1_group, bm, m_grass, loc=(-1.5, 2.0, 4.5), subdiv=1)

    create_empty_marker("COL_river_bank", s1_group, location=(0, 19.0, 1.0), custom_props={"collider": True, "material": "grass"})
    create_empty_marker("SPAWN_S1", s1_group, location=(2.0, -1.0, 0.0), custom_props={"targetState": "S1_BANK", "heading": "NORTH"})
    create_empty_marker("INT_sister_book", s1_group, location=(-0.2, 1.2, 0.5), custom_props={"type": "inspect", "promptKey": "UI_INSPECT", "item": "ch1_bank_book"})
    create_empty_marker("INT_daisy_1", s1_group, location=(3.6, 1.2, 0.0), custom_props={"type": "pickup", "item": "daisy_1", "promptKey": "UI_PICK"})
    create_empty_marker("INT_daisy_2", s1_group, location=(5.2, -1.1, 0.0), custom_props={"type": "pickup", "item": "daisy_2", "promptKey": "UI_PICK"})
    create_empty_marker("INT_daisy_3", s1_group, location=(7.0, 0.6, 0.0), custom_props={"type": "pickup", "item": "daisy_3", "promptKey": "UI_PICK"})
    create_empty_marker("PATH_rabbit_S1", s1_group, location=(-12.0, 3.0, 0.0), custom_props={"targetEntity": "chr_rabbit", "duration": 5.0})
    create_empty_marker("PATH_rabbit_S2", s1_group, location=(8.5, 1.8, 0.0), custom_props={"targetEntity": "chr_rabbit", "duration": 4.0})
    create_empty_marker("TRG_S2_hole", s1_group, location=(13.5, 2.0, 0.0), custom_props={"triggerId": "TRG_S2_HOLE", "oneShot": True, "bounds": [2.0, 2.0, 2.0]})
    create_empty_marker("INT_rabbit_hole", s1_group, location=(14.0, 2.0, 0.0), custom_props={"type": "trigger", "promptKey": "UI_JUMP_IN"})
    export_object_as_glb(s1_group, "ch1_s1_bank")

    s3_group = bpy.data.objects.new("S3_Well_Shaft", None)
    bpy.context.collection.objects.link(s3_group)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=32, radius1=2.3, radius2=2.3, depth=36.0)
    for v in bm.verts:
        v.co.z += 18.0
    finalize_child_mesh("S3_Well_Shaft_Mesh", s3_group, bm, m_stone, subdiv=0)
    slot_types = ["cupboard", "bookshelf", "map", "picture", "cupboard", "bookshelf", "empty", "empty"]
    for i in range(8):
        angle = i * (2 * math.pi / 8)
        create_empty_marker(f"SLOT_{i+1:02d}", s3_group, location=(2.0 * math.cos(angle), 2.0 * math.sin(angle), 18.0), rotation=(0, 0, angle + math.pi), custom_props={"slotType": slot_types[i], "index": i + 1})
    create_empty_marker("INT_jar_marmalade", s3_group, location=(0.75, -0.25, 0.75), custom_props={"type": "pickup", "item": "marmalade_jar"})
    create_empty_marker("INT_cupboard_return", s3_group, location=(-0.85, 0.35, -1.5), custom_props={"type": "trigger", "item": "cupboard_return"})
    export_object_as_glb(s3_group, "ch1_s3_well")

    s4_group = bpy.data.objects.new("S4_Passage", None)
    bpy.context.collection.objects.link(s4_group)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * 24.0 + 12.0
        v.co.y *= 2.4
        v.co.z = v.co.z * 2.4 + 1.2
    finalize_child_mesh("S4_Passage_Straight", s4_group, bm, m_stone, subdiv=0)
    create_empty_marker("SPAWN_S4", s4_group, location=(0.0, 0.0, 0.0), custom_props={"targetState": "S4_PASSAGE"})
    create_empty_marker("TRG_S4_corner", s4_group, location=(18.0, 0.0, 0.0), custom_props={"triggerId": "TRG_S4_CORNER", "oneShot": True, "bounds": [2.0, 2.0, 2.4]})
    create_empty_marker("TRG_S4_exit", s4_group, location=(22.0, 0.0, 0.0), custom_props={"triggerId": "TRG_S4_EXIT", "oneShot": True, "bounds": [2.0, 2.0, 2.4]})
    export_object_as_glb(s4_group, "ch1_s4_passage")

    s5_group = bpy.data.objects.new("S5_Great_Hall", None)
    bpy.context.collection.objects.link(s5_group)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 24.0
        v.co.y *= 7.0
        v.co.z = v.co.z * 2.85 + 1.425
    finalize_child_mesh("S5_Hall_Shell", s5_group, bm, m_wall, subdiv=0)

    door_positions = [
        (-9.0, 3.5, 0.0, "INT_door_1"), (-4.5, 3.5, 0.0, "INT_door_2"), (0.0, 3.5, 0.0, "INT_door_3"), (4.5, 3.5, 0.0, "INT_door_4"),
        (-9.0, -3.5, 0.0, "INT_door_5"), (-3.0, -3.5, 0.0, "INT_door_6"), (3.0, -3.5, 0.0, "INT_door_7"), (9.0, -3.5, 0.0, "INT_door_8"),
        (12.0, -1.5, 0.0, "INT_door_9"), (12.0, 1.5, 0.0, "INT_door_10")
    ]
    for dx, dy, dz, marker_id in door_positions:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 1.0
            v.co.y *= 0.1
            v.co.z *= 2.2
        finalize_child_mesh(f"Mesh_{marker_id}", s5_group, bm, m_wood, loc=(dx, dy, dz + 1.1), subdiv=0)
        create_empty_marker(marker_id, s5_group, location=(dx, dy, dz + 1.1), custom_props={"type": "door", "promptKey": "UI_OPEN", "requires": "prop_key_gold"})

    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=32, radius1=0.25, radius2=0.25, depth=0.035)
    finalize_child_mesh("S5_Glass_Table_Top", s5_group, bm, m_glass_table, loc=(0.85, 0.6, 0.7025), subdiv=1)
    for leg_idx in range(3):
        ang = leg_idx * (2 * math.pi / 3)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=0.02, radius2=0.02, depth=0.685)
        finalize_child_mesh(f"S5_Glass_Table_Leg_{leg_idx+1}", s5_group, bm, m_glass_table, loc=(0.85 + 0.18 * math.cos(ang), 0.6 + 0.18 * math.sin(ang), 0.3425), subdiv=1)

    create_empty_marker("INT_table", s5_group, location=(0.85, 0.6, 0.0), custom_props={"type": "table"})
    create_empty_marker("INT_table_leg", s5_group, location=(0.85, 0.6, 0.0), custom_props={"type": "climb"})
    create_empty_marker("INT_glass_box", s5_group, location=(0.88, 0.62, 0.035), custom_props={"type": "box"})

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.55
        v.co.y *= 0.03
        v.co.z *= 0.60
    finalize_child_mesh("S5_Low_Curtain", s5_group, bm, m_curtain, loc=(-0.8, 3.32, 0.30), subdiv=1)
    create_empty_marker("INT_curtain", s5_group, location=(-0.8, 3.32, 0.0), custom_props={"type": "trigger", "promptKey": "UI_PULL_CURTAIN"})

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.24
        v.co.y *= 0.05
        v.co.z *= 0.381
    finalize_child_mesh("S5_Little_Door_Mesh", s5_group, bm, m_wood, loc=(-0.8, 3.40, 0.1905), subdiv=1)
    create_empty_marker("INT_little_door", s5_group, location=(-0.8, 3.40, 0.0), custom_props={"type": "door", "requires": "prop_key_gold", "promptKey": "UI_UNLOCK_LITTLE_DOOR"})
    create_empty_marker("VISTA_ANCHOR", s5_group, location=(-0.8, 5.2, 0.0), custom_props={"vistaId": "ch1_garden_vista", "activeScene": "S5_HALL"})
    create_empty_marker("SPAWN_S5", s5_group, location=(-2.2, 0.0, 0.0), custom_props={"targetState": "S5_HALL"})
    create_empty_marker("COL_hall_floor", s5_group, location=(0.0, 0.0, -0.1), custom_props={"collider": True})

    for idx, lx in enumerate([-10.0, -6.0, -2.0, 2.0, 6.0, 10.0]):
        lamp_id = f"LAMP_{idx+1}"
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.16)
        finalize_child_mesh(f"Mesh_{lamp_id}", s5_group, bm, m_lamp, loc=(lx, 0.0, 2.65), subdiv=0)
        create_empty_marker(lamp_id, s5_group, location=(lx, 0.0, 2.85), custom_props={"lightColor": "#F5C26B", "intensity": 1.5, "range": 8.0})

    export_object_as_glb(s5_group, "ch1_s5_hall")

    bpy.ops.object.select_all(action='DESELECT')
    for grp in (s1_group, s3_group, s4_group, s5_group):
        select_hierarchy(grp)
    for d in OUT_DIRS:
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(d, "ch1_greybox.glb"),
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_extras=True,
            export_lights=False,
            export_cameras=False,
            export_animations=True
        )


if __name__ == "__main__":
    build_and_export_all()
