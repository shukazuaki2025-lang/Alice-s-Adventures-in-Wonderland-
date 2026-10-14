#!/usr/bin/env python3
"""
tools/blender/build_ch1_architecture.py
Headless Blender Python Script to procedurally build Chapter 1 ("Down the Rabbit-Hole") 3D Greybox Environment.

Metric System: 1 Blender Unit = 1.0 Meter.
Coordinates: X = East, Y = North, Z = Up.
glTF Export: +Y Up, Right-Handed (+X East, +Y Up, +Z South).
Custom Properties (`userData`): Preserved via export_custom_props=True.

Generates:
- Riverbank Meadow (S0-S1)
- Rabbit Hole Entrance & Burrow (S2)
- Long Fall Well Shaft Segment & 8 Slots (S3)
- Passage Corridor & Corner (S4)
- Great Hall of Doors & Interior Shell (S4-S7)
- Glass Three-Legged Table, Low Curtain, Little Door & Passage
- Garden Vista Diorama
- Interactive Props (Golden Key, DRINK ME Bottle, EAT ME Cake, Glass Box, Marmalade Jar, Pocket Watch, Fan & Gloves)
- Full Logic Marker Hierarchy (SPAWN_, TRG_, INT_, CAM_, PATH_, COL_, SLOT_, LAMP_, VISTA_ANCHOR)
"""

import sys
import os
import math

try:
    import bpy
    import mathutils
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False


def reset_scene():
    """Clear all default objects and prepare clean scene."""
    if not IN_BLENDER:
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def create_empty_marker(name, parent, location=(0, 0, 0), rotation=(0, 0, 0), custom_props=None):
    """Create an empty object used as a logic marker with custom properties."""
    if not IN_BLENDER:
        return None
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


def build_materials():
    """Create standard Principled BSDF materials with custom names for the engine."""
    if not IN_BLENDER:
        return {}
    mats = {}

    def new_mat(name, color, roughness=0.5, metallic=0.0, alpha=1.0):
        m = bpy.data.materials.new(name=name)
        m.use_nodes = True
        nodes = m.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Roughness'].default_value = roughness
            bsdf.inputs['Metallic'].default_value = metallic
            if alpha < 1.0 and 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = alpha
                m.blend_method = 'BLEND'
        mats[name] = m
        return m

    new_mat('M_Grass', (0.22, 0.45, 0.18, 1.0), roughness=0.8)
    new_mat('M_Dirt', (0.35, 0.25, 0.18, 1.0), roughness=0.9)
    new_mat('M_Stone', (0.40, 0.40, 0.42, 1.0), roughness=0.7)
    new_mat('M_Wood', (0.32, 0.20, 0.12, 1.0), roughness=0.6)
    new_mat('M_Glass_Table', (0.75, 0.90, 0.95, 0.25), roughness=0.1, alpha=0.25)
    new_mat('M_Glass_Bottle', (0.80, 0.95, 0.90, 0.30), roughness=0.1, alpha=0.3)
    new_mat('M_Glass_Box', (0.85, 0.95, 0.95, 0.35), roughness=0.1, alpha=0.35)
    new_mat('M_Gold_Key', (0.83, 0.66, 0.23, 1.0), roughness=0.25, metallic=0.9)
    new_mat('M_Cake', (0.85, 0.70, 0.45, 1.0), roughness=0.8)
    new_mat('M_Curtain', (0.15, 0.45, 0.22, 1.0), roughness=0.7)
    new_mat('M_Emissive_Lamp', (0.96, 0.76, 0.42, 1.0), roughness=0.2)
    return mats


def build_ch1_architecture():
    """Procedurally create all Chapter 1 architecture and objects in Blender."""
    if not IN_BLENDER:
        print("[build_ch1_architecture] Not running inside Blender, skipping bpy generation.")
        return

    reset_scene()
    mats = build_materials()

    # Create Root Collection and Root Empty
    root_coll = bpy.context.collection
    root_obj = bpy.data.objects.new("CH1_GREYBOX_ROOT", None)
    root_coll.objects.link(root_obj)

    # -------------------------------------------------------------------------
    # 1. Riverbank Meadow (S0 - S1)
    # -------------------------------------------------------------------------
    s1_group = bpy.data.objects.new("S1_Riverbank", None)
    s1_group.parent = root_obj
    root_coll.objects.link(s1_group)

    # Ground Plane (60m x 40m)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "S1_Ground_Meadow"
    ground.scale = (60.0, 40.0, 1.0)
    ground.parent = s1_group
    if 'M_Grass' in mats:
        ground.data.materials.append(mats['M_Grass'])

    # Oak Tree Trunk at (0, 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.8, depth=4.0, location=(0, 0, 2.0))
    oak_trunk = bpy.context.active_object
    oak_trunk.name = "S1_Oak_Tree_Trunk"
    oak_trunk.parent = s1_group
    if 'M_Wood' in mats:
        oak_trunk.data.materials.append(mats['M_Wood'])

    # Oak Tree Canopy
    bpy.ops.mesh.primitive_ico_sphere_add(radius=3.5, location=(0, 0, 5.0))
    oak_canopy = bpy.context.active_object
    oak_canopy.name = "S1_Oak_Tree_Canopy"
    oak_canopy.parent = s1_group
    if 'M_Grass' in mats:
        oak_canopy.data.materials.append(mats['M_Grass'])

    # River Collider & Boundary (Y = 18.0 to 20.0)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 19.0, 1.0))
    river_col = bpy.context.active_object
    river_col.name = "COL_river_bank"
    river_col.scale = (60.0, 2.0, 2.0)
    river_col.parent = s1_group
    river_col["collider"] = True
    river_col["material"] = "grass"

    # Hedgerow and Rabbit Hole Burrow at (29.5, -6.0)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(29.5, -6.0, 1.0))
    hedge = bpy.context.active_object
    hedge.name = "S1_Hedgerow"
    hedge.scale = (1.0, 6.0, 2.0)
    hedge.parent = s1_group
    if 'M_Grass' in mats:
        hedge.data.materials.append(mats['M_Grass'])

    # S1 Markers
    create_empty_marker("SPAWN_S1", s1_group, location=(2.0, -1.0, 0.0), custom_props={
        "targetState": "S1_BANK",
        "heading": "NORTH"
    })
    create_empty_marker("INT_sister_book", s1_group, location=(0.3, 0.2, 0.7), custom_props={
        "type": "inspect",
        "promptKey": "UI_INSPECT",
        "item": "ch1_bank_book"
    })
    create_empty_marker("INT_daisy_1", s1_group, location=(5.2, 4.1, 0.0), custom_props={
        "type": "pickup", "item": "daisy_1", "promptKey": "UI_PICK"
    })
    create_empty_marker("INT_daisy_2", s1_group, location=(-7.4, 2.8, 0.0), custom_props={
        "type": "pickup", "item": "daisy_2", "promptKey": "UI_PICK"
    })
    create_empty_marker("INT_daisy_3", s1_group, location=(3.1, -8.5, 0.0), custom_props={
        "type": "pickup", "item": "daisy_3", "promptKey": "UI_PICK"
    })
    create_empty_marker("PATH_rabbit_S1", s1_group, location=(-25.0, 5.0, 0.0), custom_props={
        "targetEntity": "chr_rabbit", "duration": 5.0
    })
    create_empty_marker("PATH_rabbit_S2", s1_group, location=(4.0, 3.0, 0.0), custom_props={
        "targetEntity": "chr_rabbit", "duration": 4.0
    })
    create_empty_marker("TRG_S2_hole", s1_group, location=(28.0, -6.0, 0.0), custom_props={
        "triggerId": "TRG_S2_HOLE", "oneShot": True, "bounds": [2.0, 2.0, 2.0]
    })
    create_empty_marker("INT_rabbit_hole", s1_group, location=(29.5, -6.0, 0.0), custom_props={
        "type": "trigger", "promptKey": "UI_JUMP_IN"
    })

    # -------------------------------------------------------------------------
    # 2. Long Fall Shaft Well Segment (S3)
    # -------------------------------------------------------------------------
    s3_group = bpy.data.objects.new("S3_Well_Shaft", None)
    s3_group.parent = root_obj
    root_coll.objects.link(s3_group)

    # Well Shaft Wall (Inner dia 4.0m, thickness 0.3m -> Outer dia 4.6m, height 3.0m)
    bpy.ops.mesh.primitive_cylinder_add(radius=2.3, depth=3.0, vertices=32, location=(0, 0, 1.5))
    well_mesh = bpy.context.active_object
    well_mesh.name = "S3_Well_Shaft_Mesh"
    well_mesh.parent = s3_group
    if 'M_Stone' in mats:
        well_mesh.data.materials.append(mats['M_Stone'])

    # 8 Slots evenly spaced around well wall
    slot_types = ["cupboard", "bookshelf", "map", "picture", "cupboard", "bookshelf", "empty", "empty"]
    for i in range(8):
        angle = i * (2 * math.pi / 8)
        rx = 2.0 * math.cos(angle)
        ry = 2.0 * math.sin(angle)
        slot_name = f"SLOT_{i+1:02d}"
        create_empty_marker(slot_name, s3_group, location=(rx, ry, 1.5), rotation=(0, 0, angle + math.pi), custom_props={
            "slotType": slot_types[i],
            "index": i + 1
        })

    # Marmalade Jar Prop
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.14, location=(0.0, 1.8, 1.5))
    jar_mesh = bpy.context.active_object
    jar_mesh.name = "prop_jar_marmalade"
    jar_mesh.parent = s3_group
    jar_mesh["decal"] = "ORANGE MARMALADE"
    if 'M_Glass_Bottle' in mats:
        jar_mesh.data.materials.append(mats['M_Glass_Bottle'])

    # -------------------------------------------------------------------------
    # 3. Corridor & Turn (S4)
    # -------------------------------------------------------------------------
    s4_group = bpy.data.objects.new("S4_Passage", None)
    s4_group.parent = root_obj
    root_coll.objects.link(s4_group)

    # Passage Straight (24m L x 2.0m W x 2.4m H)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(12.0, 0.0, 1.2))
    passage_mesh = bpy.context.active_object
    passage_mesh.name = "S4_Passage_Straight"
    passage_mesh.scale = (24.0, 2.0, 2.4)
    passage_mesh.parent = s4_group
    if 'M_Stone' in mats:
        passage_mesh.data.materials.append(mats['M_Stone'])

    # S4 Markers
    create_empty_marker("SPAWN_S4", s4_group, location=(0.0, 0.0, 0.0), custom_props={
        "targetState": "S4_PASSAGE"
    })
    create_empty_marker("TRG_S4_corner", s4_group, location=(23.0, 0.0, 0.0), custom_props={
        "triggerId": "TRG_S4_CORNER", "oneShot": True, "bounds": [2.0, 2.0, 2.4]
    })

    # -------------------------------------------------------------------------
    # 4. Great Hall of Doors (S4 - S7)
    # -------------------------------------------------------------------------
    s5_group = bpy.data.objects.new("S5_Great_Hall", None)
    s5_group.parent = root_obj
    root_coll.objects.link(s5_group)

    # Hall Shell (24.0m L x 7.0m W x 2.85m H)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 1.425))
    hall_shell = bpy.context.active_object
    hall_shell.name = "S5_Hall_Shell"
    hall_shell.scale = (24.0, 7.0, 2.85)
    hall_shell.parent = s5_group
    if 'M_Wood' in mats:
        hall_shell.data.materials.append(mats['M_Wood'])

    # Floor Collider
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, -0.1))
    hall_floor = bpy.context.active_object
    hall_floor.name = "COL_hall_floor"
    hall_floor.scale = (24.0, 7.0, 0.2)
    hall_floor.parent = s5_group
    hall_floor["collider"] = True
    hall_floor["material"] = "wood"

    # Wall Colliders
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 1.425))
    hall_walls = bpy.context.active_object
    hall_walls.name = "COL_hall_walls"
    hall_walls.scale = (24.0, 7.0, 2.85)
    hall_walls.parent = s5_group
    hall_walls["collider"] = True
    hall_walls["material"] = "stone"

    # 10 Locked Doors (1.0m W x 2.2m H)
    door_positions = [
        # North wall (Y=3.5)
        (-9.0, 3.5, 0.0, "INT_door_01"),
        (-4.5, 3.5, 0.0, "INT_door_02"),
        (0.0, 3.5, 0.0, "INT_door_03"),
        (4.5, 3.5, 0.0, "INT_door_04"),
        # South wall (Y=-3.5)
        (-9.0, -3.5, 0.0, "INT_door_05"),
        (-3.0, -3.5, 0.0, "INT_door_06"),
        (3.0, -3.5, 0.0, "INT_door_07"),
        (9.0, -3.5, 0.0, "INT_door_08"),
        # East wall (X=12.0)
        (12.0, -1.5, 0.0, "INT_door_09"),
        (12.0, 1.5, 0.0, "INT_door_10")
    ]
    for dx, dy, dz, marker_id in door_positions:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(dx, dy, dz + 1.1))
        dmesh = bpy.context.active_object
        dmesh.name = f"Mesh_{marker_id}"
        dmesh.scale = (1.0, 0.1, 2.2)
        dmesh.parent = s5_group
        if 'M_Wood' in mats:
            dmesh.data.materials.append(mats['M_Wood'])

        create_empty_marker(marker_id, s5_group, location=(dx, dy, dz + 1.1), custom_props={
            "type": "door", "promptKey": "UI_OPEN", "requires": "prop_key_gold"
        })

    # Glass Three-Legged Table at (4.0, 0.0, 0.0)
    # Height = 0.72m, top dia = 0.50m, slab thickness = 0.035m
    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.035, location=(4.0, 0.0, 0.7025))
    table_top = bpy.context.active_object
    table_top.name = "S5_Glass_Table_Top"
    table_top.parent = s5_group
    if 'M_Glass_Table' in mats:
        table_top.data.materials.append(mats['M_Glass_Table'])

    # 3 Tapered Legs
    for leg_idx in range(3):
        ang = leg_idx * (2 * math.pi / 3)
        lx = 4.0 + 0.18 * math.cos(ang)
        ly = 0.0 + 0.18 * math.sin(ang)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.685, location=(lx, ly, 0.3425))
        leg = bpy.context.active_object
        leg.name = f"S5_Glass_Table_Leg_{leg_idx+1}"
        leg.parent = s5_group
        if 'M_Glass_Table' in mats:
            leg.data.materials.append(mats['M_Glass_Table'])

    # Table Colliders & Markers
    create_empty_marker("COL_table", s5_group, location=(4.0, 0.0, 0.36), custom_props={
        "collider": True, "material": "glass"
    })
    create_empty_marker("INT_table", s5_group, location=(4.0, 0.0, 0.72), custom_props={
        "type": "pickup", "item": "prop_key_gold", "promptKey": "UI_TAKE_KEY"
    })
    create_empty_marker("INT_bottle_drinkme", s5_group, location=(4.0, 0.1, 0.72), custom_props={
        "type": "inspect", "item": "prop_bottle_drinkme", "promptKey": "UI_INSPECT_BOTTLE"
    })
    create_empty_marker("INT_table_leg", s5_group, location=(4.0, -0.25, 0.0), custom_props={
        "type": "use", "promptKey": "UI_CLIMB"
    })
    create_empty_marker("INT_glass_box", s5_group, location=(4.1, -0.1, 0.0), custom_props={
        "type": "pickup", "item": "prop_cake_eatme", "promptKey": "UI_OPEN_BOX"
    })

    # Low Green Curtain at (10.5, 3.5, 0.0)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(10.5, 3.45, 0.3))
    curtain = bpy.context.active_object
    curtain.name = "S5_Low_Curtain"
    curtain.scale = (0.8, 1.0, 0.6)
    curtain.parent = s5_group
    if 'M_Curtain' in mats:
        curtain.data.materials.append(mats['M_Curtain'])

    create_empty_marker("INT_curtain", s5_group, location=(10.5, 3.5, 0.0), custom_props={
        "type": "trigger", "promptKey": "UI_PULL_CURTAIN"
    })

    # Little Door (0.24m x 0.381m) & Passage (0.24m x 0.33m x 1.2m)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(10.5, 3.5, 0.1905))
    ldoor = bpy.context.active_object
    ldoor.name = "S5_Little_Door_Mesh"
    ldoor.scale = (0.24, 0.05, 0.381)
    ldoor.parent = s5_group
    if 'M_Wood' in mats:
        ldoor.data.materials.append(mats['M_Wood'])

    create_empty_marker("INT_door_little", s5_group, location=(10.5, 3.5, 0.0), custom_props={
        "type": "door", "requires": "prop_key_gold", "promptKey": "UI_UNLOCK_LITTLE_DOOR"
    })

    # Passage Tunnel leading to Garden Vista
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(10.5, 4.1, 0.165))
    lpassage = bpy.context.active_object
    lpassage.name = "S5_Little_Passage_Mesh"
    lpassage.scale = (0.24, 1.2, 0.33)
    lpassage.parent = s5_group
    if 'M_Stone' in mats:
        lpassage.data.materials.append(mats['M_Stone'])

    create_empty_marker("VISTA_ANCHOR", s5_group, location=(10.5, 4.7, 0.0), custom_props={
        "vistaId": "ch1_garden_vista", "activeScene": "S5_HALL"
    })

    # Garden Vista Diorama Box (10m x 6m x 5m)
    v_group = bpy.data.objects.new("Garden_Vista", None)
    v_group.parent = root_obj
    root_coll.objects.link(v_group)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(10.5, 7.7, 2.5))
    vista_box = bpy.context.active_object
    vista_box.name = "Garden_Vista_Box"
    vista_box.scale = (10.0, 6.0, 5.0)
    vista_box.parent = v_group

    # 6 Hanging Ceiling Lamps
    lamp_x_coords = [-10.0, -6.0, -2.0, 2.0, 6.0, 10.0]
    for idx, lx in enumerate(lamp_x_coords):
        lamp_id = f"LAMP_{idx+1:02d}"
        bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.3, location=(lx, 0.0, 2.7))
        lmesh = bpy.context.active_object
        lmesh.name = f"Mesh_{lamp_id}"
        lmesh.parent = s5_group
        if 'M_Emissive_Lamp' in mats:
            lmesh.data.materials.append(mats['M_Emissive_Lamp'])

        create_empty_marker(lamp_id, s5_group, location=(lx, 0.0, 2.85), custom_props={
            "lightColor": "#F5C26B", "intensity": 1.5, "range": 8.0
        })

    # Camera Anchors
    create_empty_marker("CAM_S5_intro", s5_group, location=(-11.5, 0.0, 2.0), custom_props={
        "fov": 60.0, "duration": 3.0
    })
    create_empty_marker("CAM_S5_peek", s5_group, location=(10.5, 3.0, 0.15), custom_props={
        "fov": 65.0, "duration": 2.5
    })
    create_empty_marker("CAM_S6_shrink", s5_group, location=(3.2, -0.8, 0.35), custom_props={
        "fov": 70.0, "duration": 2.5
    })
    create_empty_marker("CAM_S6_cry", s5_group, location=(4.0, 0.0, 0.1), custom_props={
        "fov": 75.0, "duration": 3.0
    })
    create_empty_marker("CAM_S7_end", s5_group, location=(4.5, -0.4, 0.15), custom_props={
        "fov": 65.0, "duration": 4.0
    })

    create_empty_marker("SPAWN_S5", s5_group, location=(-11.0, 0.0, 0.0), custom_props={
        "targetState": "S5_HALL"
    })

    # -------------------------------------------------------------------------
    # 5. Interactive Props
    # -------------------------------------------------------------------------
    props_group = bpy.data.objects.new("Props_Interactive", None)
    props_group.parent = root_obj
    root_coll.objects.link(props_group)

    # Little Golden Key (length 0.05m)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.005, depth=0.05, location=(4.0, 0.0, 0.725))
    key_mesh = bpy.context.active_object
    key_mesh.name = "prop_key_gold"
    key_mesh.parent = props_group
    if 'M_Gold_Key' in mats:
        key_mesh.data.materials.append(mats['M_Gold_Key'])

    # 'DRINK ME' Bottle (H=0.10m, dia 0.04m)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.10, location=(4.0, 0.1, 0.77))
    bottle_mesh = bpy.context.active_object
    bottle_mesh.name = "prop_bottle_drinkme"
    bottle_mesh.parent = props_group
    bottle_mesh["decal"] = "DRINK ME"
    if 'M_Glass_Bottle' in mats:
        bottle_mesh.data.materials.append(mats['M_Glass_Bottle'])

    # 'EAT ME' Cake (dia 0.05m, height 0.025m)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.025, location=(4.1, -0.1, 0.0125))
    cake_mesh = bpy.context.active_object
    cake_mesh.name = "prop_cake_eatme"
    cake_mesh.parent = props_group
    cake_mesh["decal"] = "EAT ME"
    if 'M_Cake' in mats:
        cake_mesh.data.materials.append(mats['M_Cake'])

    # Glass Currant Cake Box (0.10m x 0.07m x 0.05m)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(4.1, -0.1, 0.025))
    box_mesh = bpy.context.active_object
    box_mesh.name = "prop_box_glass"
    box_mesh.scale = (0.10, 0.07, 0.05)
    box_mesh.parent = props_group
    if 'M_Glass_Box' in mats:
        box_mesh.data.materials.append(mats['M_Glass_Box'])

    # White Rabbit's Pocket Watch
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.01, location=(0, 0, 0))
    watch_mesh = bpy.context.active_object
    watch_mesh.name = "prop_watch"
    watch_mesh.parent = props_group
    if 'M_Gold_Key' in mats:
        watch_mesh.data.materials.append(mats['M_Gold_Key'])

    # White Rabbit's Fan & Kid Gloves
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    fan_mesh = bpy.context.active_object
    fan_mesh.name = "prop_fan"
    fan_mesh.scale = (0.15, 0.02, 0.10)
    fan_mesh.parent = props_group

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    gloves_mesh = bpy.context.active_object
    gloves_mesh.name = "prop_gloves"
    gloves_mesh.scale = (0.10, 0.08, 0.02)
    gloves_mesh.parent = props_group

    print("[build_ch1_architecture] Scene procedural generation complete.")


def export_gltf(output_file):
    """Export scene to GLB format with custom properties enabled."""
    if not IN_BLENDER:
        return
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_file,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_custom_props=True,
        export_lights=False,
        export_cameras=False,
        export_animations=True,
        export_current_frame=False
    )
    print(f"[export_gltf] Exported GLB to {output_file}")


def main():
    """Script entry point."""
    out_path = "public/assets/models/ch1_greybox.glb"
    out_src_path = "assets_src/greybox/ch1_greybox.glb"

    if len(sys.argv) > 1 and sys.argv[-1].endswith(".glb"):
        out_path = sys.argv[-1]

    build_ch1_architecture()
    export_gltf(out_path)
    export_gltf(out_src_path)


if __name__ == "__main__":
    main()
