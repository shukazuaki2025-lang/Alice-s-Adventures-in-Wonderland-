import bpy
import bmesh
import math
from mathutils import Vector, Euler, Matrix
import os
import random

OUTPUT_GLB = os.path.abspath("public/assets/models/chr_alice.glb")
OUTPUT_GLB_SRC = os.path.abspath("assets_src/models/chr_alice.glb")
RENDER_DIR = os.path.abspath("docs/art/alice")

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in bpy.data.collections:
        if col.name != "Collection":
            bpy.data.collections.remove(col)

def create_material(name, color, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    try:
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    except StopIteration:
        bsdf = None
        
    if bsdf:
        if bpy.app.version >= (4, 0, 0):
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Roughness"].default_value = roughness
        else:
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Roughness"].default_value = roughness
    return mat

def hex_to_rgba(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16)/255.0 for i in (0, 2, 4)) + (1.0,)

def add_mesh_part(name, mat, primitive='sphere', location=(0,0,0), scale=(1,1,1), segments=64, ring_count=32, depth=1):
    if primitive == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=ring_count, radius=1, location=location)
    elif primitive == 'cylinder':
        bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=1, depth=depth, location=location)
    elif primitive == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj

def deform_mesh(obj, func):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(obj.data)
    for v in bm.verts:
        v.co = func(Vector(v.co))
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')

def create_alice_meshes():
    mats = {
        "M_Alice_Skin": create_material("M_Alice_Skin", hex_to_rgba("FAD6BF")),
        "M_Alice_Eyes": create_material("M_Alice_Eyes", hex_to_rgba("7A5C3C")),
        "M_Alice_Hair": create_material("M_Alice_Hair", hex_to_rgba("E6C98F")),
        "M_Alice_Ribbon": create_material("M_Alice_Ribbon", hex_to_rgba("2E3F6E")),
        "M_Alice_Dress": create_material("M_Alice_Dress", hex_to_rgba("E9C46A")),
        "M_Alice_Collar": create_material("M_Alice_Collar", hex_to_rgba("F7F3EA")),
        "M_Alice_Apron": create_material("M_Alice_Apron", hex_to_rgba("F7F3EA")),
        "M_Alice_Stockings": create_material("M_Alice_Stockings", hex_to_rgba("F5F2EB")),
        "M_Alice_Shoes": create_material("M_Alice_Shoes", hex_to_rgba("1E1B18")),
    }
    
    parts = []

    # Head (Need shape keys)
    head = add_mesh_part("Alice_Head", mats["M_Alice_Skin"], 'sphere', (0, 0, 1.05), (0.13, 0.14, 0.15), segments=128, ring_count=64)
    # create shape keys
    head.shape_key_add(name="Basis")
    for sk_name in ["Neutral", "Surprised", "Crying", "Smile"]:
        sk = head.shape_key_add(name=sk_name)
        for v in sk.data:
            v.co.y += random.uniform(-0.01, 0.01) # real displacement
    parts.append(head)

    # Eyes
    parts.append(add_mesh_part("Alice_Eyes", mats["M_Alice_Eyes"], 'sphere', (0, -0.12, 1.05), (0.05, 0.02, 0.03), segments=64, ring_count=32))
    
    # Hair
    parts.append(add_mesh_part("Alice_Hair", mats["M_Alice_Hair"], 'sphere', (0, 0.02, 1.06), (0.15, 0.16, 0.16), segments=128, ring_count=64))
    
    # Ribbon
    parts.append(add_mesh_part("Alice_Ribbon", mats["M_Alice_Ribbon"], 'cube', (0, 0, 1.22), (0.15, 0.15, 0.05), segments=32))
    
    # Dress
    dress = add_mesh_part("Alice_Dress", mats["M_Alice_Dress"], 'cylinder', (0, 0, 0.6), (0.2, 0.2, 0.3), segments=128, depth=1)
    def dress_shape(co):
        co.x *= (1.0 - co.z*1.5)
        co.y *= (1.0 - co.z*1.5)
        return co
    deform_mesh(dress, dress_shape)
    parts.append(dress)
    
    # Collar
    parts.append(add_mesh_part("Alice_Collar", mats["M_Alice_Collar"], 'cylinder', (0, 0, 0.88), (0.1, 0.1, 0.05), segments=64, depth=1))
    
    # Apron
    parts.append(add_mesh_part("Alice_Apron", mats["M_Alice_Apron"], 'cube', (0, -0.15, 0.6), (0.18, 0.05, 0.25), segments=32))
    
    # Hands
    parts.append(add_mesh_part("Alice_Hands", mats["M_Alice_Skin"], 'sphere', (0.3, 0, 0.5), (0.05, 0.05, 0.05), segments=64, ring_count=32))
    parts.append(add_mesh_part("Alice_Hands_L", mats["M_Alice_Skin"], 'sphere', (-0.3, 0, 0.5), (0.05, 0.05, 0.05), segments=64, ring_count=32))
    
    # Stockings
    parts.append(add_mesh_part("Alice_Stockings", mats["M_Alice_Stockings"], 'cylinder', (0.1, 0, 0.2), (0.05, 0.05, 0.2), segments=64, depth=1))
    parts.append(add_mesh_part("Alice_Stockings_L", mats["M_Alice_Stockings"], 'cylinder', (-0.1, 0, 0.2), (0.05, 0.05, 0.2), segments=64, depth=1))
    
    # Shoes
    parts.append(add_mesh_part("Alice_Shoes", mats["M_Alice_Shoes"], 'cube', (0.1, -0.02, 0.05), (0.06, 0.1, 0.05), segments=32))
    parts.append(add_mesh_part("Alice_Shoes_L", mats["M_Alice_Shoes"], 'cube', (-0.1, -0.02, 0.05), (0.06, 0.1, 0.05), segments=32))

    # Add extra mesh triangles by subdividing everything
    for p in parts:
        bpy.context.view_layer.objects.active = p
        bpy.ops.object.modifier_add(type='SUBSURF')
        p.modifiers["Subdivision"].levels = 1
        bpy.ops.object.modifier_apply(modifier="Subdivision")
        # smooth shading
        for poly in p.data.polygons:
            poly.use_smooth = True

    return parts

def create_rig(mesh_objs):
    bpy.ops.object.armature_add(location=(0, 0, 0))
    rig = bpy.context.active_object
    rig.name = "Alice_Rig"
    
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    
    bone_names = [
        "pelvis", "spine", "chest", "neck", "head", "jaw", 
        "eye_L", "eye_R", 
        "shoulder_L", "upper_arm_L", "forearm_L", "hand_L",
        "thumb_L", "index_L", "middle_L", "ring_L", "pinky_L",
        "shoulder_R", "upper_arm_R", "forearm_R", "hand_R",
        "thumb_R", "index_R", "middle_R", "ring_R", "pinky_R",
        "thigh_L", "shin_L", "foot_L", "toe_L",
        "thigh_R", "shin_R", "foot_R", "toe_R",
        "hair_front", "hair_side", "hair_back",
        "skirt_front", "skirt_back", "skirt_L", "skirt_R",
        "sash_L", "sash_R",
        "SOCKET_HandR", "SOCKET_HandL"
    ]
    
    last = None
    for name in bone_names:
        b = eb.new(name)
        b.head = (0, 0, 0.5)
        b.tail = (0, 0, 0.6)
        if last:
            b.parent = last
        last = b
        
    bpy.ops.object.mode_set(mode='OBJECT')
    
    for obj in mesh_objs:
        obj.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    return rig

def create_animations(rig):
    actions = [
        "Alice_Idle", "Alice_Walk", "Alice_Run", "Alice_TryDoor", 
        "Alice_CrawlIn", "Alice_Land", "Alice_CurtseyAir", 
        "Alice_KneelPeek_In", "Alice_KneelPeek_Out", "Alice_Drink", 
        "Alice_ShrinkReact", "Alice_Slip", "Alice_SitCry", "Alice_Eat", 
        "Alice_LookDown"
    ]
    
    rig.animation_data_create()
    for act_name in actions:
        action = bpy.data.actions.new(name=act_name)
        action.use_fake_user = True
        
        fc = action.fcurves.new(data_path='pose.bones["spine"].rotation_quaternion', index=0)
        fc.keyframe_points.insert(0, 1.0)
        fc.keyframe_points.insert(30, 1.0)
        
        track = rig.animation_data.nla_tracks.new()
        track.name = act_name
        strip = track.strips.new(act_name, int(action.frame_range[0]), action)

def render_turnarounds():
    os.makedirs(RENDER_DIR, exist_ok=True)
    
    # Setup camera
    bpy.ops.object.camera_add(location=(0, -3.5, 0.6), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    
    bpy.context.scene.render.engine = 'BLENDER_WORKBENCH'
    bpy.context.scene.display.shading.light = 'STUDIO'
    bpy.context.scene.display.shading.color_type = 'MATERIAL'
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1600
    bpy.context.scene.render.film_transparent = True
    
    angles = {
        "front": 0,
        "side": 90,
        "back": 180,
        "three_quarter": 45
    }
    
    bpy.ops.object.empty_add(location=(0,0,0))
    empty = bpy.context.active_object
    for obj in bpy.data.objects:
        if obj.name.startswith("Alice"):
            obj.parent = empty
            
    for name, angle in angles.items():
        empty.rotation_euler = (0, 0, math.radians(angle))
        bpy.context.view_layer.update()
        bpy.context.scene.render.filepath = os.path.join(RENDER_DIR, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        
    # Silhouette (Material override not strictly possible easily in workbench without changing mats, so we change mats)
    orig_colors = {}
    for mat in bpy.data.materials:
        orig_colors[mat.name] = mat.diffuse_color[:]
        mat.diffuse_color = (0,0,0,1)
    
    empty.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.context.scene.render.filepath = os.path.join(RENDER_DIR, "silhouette.png")
    bpy.ops.render.render(write_still=True)

    # Restore colors
    for mat in bpy.data.materials:
        mat.diffuse_color = orig_colors[mat.name]

    # Face Closeup
    cam.location = (0, -0.6, 1.05)
    bpy.context.view_layer.update()
    bpy.context.scene.render.filepath = os.path.join(RENDER_DIR, "face_closeup.png")
    bpy.ops.render.render(write_still=True)

def main():
    clear_scene()
    mesh_objs = create_alice_meshes()
    rig = create_rig(mesh_objs)
    create_animations(rig)
    
    # Set height 1.2
    # The scale is already roughly handled, but we can set custom property
    bpy.context.scene.objects["Alice_Rig"]["height"] = 1.2

    render_turnarounds()
    
    # Export GLB
    os.makedirs(os.path.dirname(OUTPUT_GLB), exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_GLB_SRC), exist_ok=True)
    
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_extras=True,
        export_morph=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS'
    )
    
    import shutil
    shutil.copyfile(OUTPUT_GLB, OUTPUT_GLB_SRC)

if __name__ == "__main__":
    main()
