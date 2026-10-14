# 3D Art, Architecture, Props & Character Pipeline Specification Report (Chapter 1)

**Document Version:** 1.0  
**Author:** spec_miner_2 (Teamwork Preview 3D Art & Assets Spec Miner)  
**Target Milestone:** Chapter 1 "Down the Rabbit-Hole" (`Alice: Down the Rabbit-Hole`)  
**Authoritative Sources:**  
- `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`

---

## Executive Summary & Core Rules

1. **Aesthetic Direction:** "Moving Victorian Picture-Book" (*会动的维多利亚绘本*).
   - Character proportions: slightly exaggerated (Alice head-to-body ratio ~1:4.5; hands/feet slightly oversized for reading gestures at distance).
   - Render style: 3-tone toon ramp shading, warm-tinted purple shadows (`#2B1F2D`), ink-colored outlines (`#2B2420`), 15% screen-space paper grain overlay, soft vignette.
   - Strictly no Disney/Tim Burton/American McGee styling, no dark grotesque mutations, no realistic human faces, no cyberpunk/neon. Faithful to Lewis Carroll (1865) and John Tenniel illustrations.
2. **Metric Dimension System:**
   - Units: 1 unit = 1.0 meter (Blender Unit Scale = 1.0).
   - Orientation: In Blender: X = East, Y = North, Z = Up. Exported glTF/GLB: +Y Up, Right-Handed (standard Three.js coordinate system).
3. **Polygon & Draw Budget:**
   - Alice: ≤ 15,000 triangles.
   - White Rabbit: ≤ 12,000 triangles.
   - Sister (seated): ≤ 8,000 triangles.
   - Dinah dream phantom: ≤ 4,000 triangles.
   - Props: 200 – 3,000 triangles each.
   - Per-scene on-screen total: ≤ 300,000 triangles; draw calls ≤ 150.
4. **Logic Markers & Hierarchy:**
   - Represented as Blender Empty objects with custom properties (`userData`), preserved into glTF/GLB via Blender export option `Include -> Custom Properties`.

---

## 1. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Track D (Arch) | S1/S2 Riverbank Meadow | 60 m × 40 m playable terrain with oak tree at (0,0), river boundary to north, hedge and rabbit hole to east | Terrain mesh, procedural grass/daisy scattering, hedge segments | `ch1_s1_bank.glb` | Invisible boundary walls at river, soft colliders at south/west | `docs/google-doc-spec-v1.md` §D1, §F1 |
| 2 | Track D (Arch) | S2 Rabbit Hole Entrance | Diameter 0.8 m burrow entrance beneath hedgerow at (29.5, -6) | Hedgerow mesh, hollow burrow tunnel | `ch1_bank_rabbithole.glb`, `INT_rabbit_hole`, `TRG_S2_hole` | Player constrained from falling out of bounds | `docs/google-doc-spec-v1.md` §D1, §F1 |
| 3 | Track D (Arch) | S3 Long Fall Well | Infinite modular vertical shaft: inner diameter 4.0 m, wall thickness 0.3 m, height 3.0 m with 8 slots | Procedural cylinder, slot anchors, mixed wood/stone textures | `ch1_well_segment.glb`, `SLOT_01`..`08` | Runtime pool recycles 12 segments; falls seamlessly at 2.2 m/s | `docs/google-doc-spec-v1.md` §D1, §D5, §G6 |
| 4 | Track D (Arch) | S4 Corridor & Turn | 24 m long straight corridor (2.0 m W × 2.4 m H), 90° right corner connecting to S5 entrance | Arched ceiling, stone walls, dirt floor, leaf pile at origin | `ch1_s4_passage.glb`, `SPAWN_S4`, `TRG_S4_corner` | Seamless doorway occlusion transition into S5 without loading screen | `docs/google-doc-spec-v1.md` §D1, §D5, §F1 |
| 5 | Track D (Arch) | S5-S7 Great Hall Shell | 24.0 m (L) × 7.0 m (W) × 2.85 m (H) hall with 10 doorframes, 6 hanging lamps, arched west entrance | Procedural shell, hardwood floor, exposed roof beams, door cutouts | `ch1_hall_shell.glb`, `INT_door_01`..`10`, `LAMP_01`..`06` | Boundary collision prevents escaping into void; ceiling caps camera | `docs/google-doc-spec-v1.md` §D1, §D5, §F1 |
| 6 | Track D (Arch) | S5 Glass Table | 3-legged table, H=0.72 m, circular top dia=0.50 m, thickness 0.035 m with 5 mm bevel, tapered legs (dia 0.04m -> 0.025m) at (4,0) | Procedural cylinder/legs, `M_Glass_Table` material | `ch1_hall_table_glass.glb`, `INT_table`, `INT_table_leg` | Refractive/Fresnel shader ensures key visible from ground level | `docs/google-doc-spec-v1.md` §D1, §D5, §G9 |
| 7 | Track D (Arch) | S5 Low Curtain | 0.8 m (W) × 0.6 m (H) cloth curtain at (10.5, 3.5) on north wall, 0.05 m in front of little door | Baked cloth sim mesh, shape key `CurtainOpen` | `ch1_hall_curtain.glb`, `INT_curtain` | Non-interactable until `keyTriesOnDoors >= 2` | `docs/google-doc-spec-v1.md` §D5, §G4, §G8 |
| 8 | Track D (Arch) | S5 Little Door & Passage | Door: 0.24 m (W) × 0.381 m (H) with brass keyhole; passage: 0.24 m × 0.33 m × 1.2 m north | Arched frame, hinged door panel (pivot at bottom-left corner) | `ch1_hall_door_little.glb`, `ch1_hall_passage_little.glb`, `VISTA_ANCHOR` | Door auto-closes & locks after peek cutscene C5 | `docs/google-doc-spec-v1.md` §D5, §G8 |
| 9 | Track D (Arch) | S5 Garden Vista Diorama | 10.0 m × 6.0 m hyper-saturated diorama box: 2-tier fountain, rose bushes, flowerbeds, clipped hedge, sky | Tripo/Blender garden props, high-saturation color grade | `ch1_garden_vista.glb` | Rendered only via vista anchor through tunnel; bloom effect active | `docs/google-doc-spec-v1.md` §D1, §C4, §G9 |
| 10 | Track E (Props) | Golden Key | Tiny ornate golden key, length 0.05 m, origin at geometric center, ≤ 600 tris | Stylized gold metallic mesh | `prop_key_gold.glb`, `SOCKET_HandR` attachment | Automatically returns to table when picking up bottle | `docs/google-doc-spec-v1.md` §D1, §D4, §G8 |
| 11 | Track E (Props) | 'DRINK ME' Bottle | Round glass bottle with cork, H=0.10 m, origin bottom center, ≤ 800 tris. 0.5 mm decal label | `M_Glass_Bottle`, 1024×512 PNG label with `IM Fell English` | `prop_bottle_drinkme.glb` | In 3D inspector, 'Drink' button locked until both front & back viewed | `docs/google-doc-spec-v1.md` §D1, §D4, §G4 |
| 12 | Track E (Props) | 'EAT ME' Cake | Small round cake, dia 0.05 m, golden crust, pale icing, ≤ 1.2k tris. Text made of raisin ellipsoids | 3D raisin beads along text curve | `prop_cake_eatme.glb` | Eating triggers size-check monologue and chapter ending | `docs/google-doc-spec-v1.md` §D1, §D4, §G8 |
| 13 | Track E (Props) | Glass Currant Cake Box | Small rectangular glass box with hinged brass lid, 0.10 × 0.07 × 0.05 m at (4.1, -0.1) under table | `M_Glass_Box`, brass frame | `prop_box_glass.glb`, `INT_glass_box` | Discovered only after table-leg slip and crying sequence C7 | `docs/google-doc-spec-v1.md` §D1, §D4, §G8 |
| 14 | Track E (Props) | Marmalade Jar | Glass jam jar with tied paper cover, H=0.14 m, ≤ 800 tris. Decal: "ORANGE MARMALADE" | Empty jar mesh, decal | `prop_jar_marmalade.glb` | Cannot be dropped in mid-air; must be placed into open cupboard | `docs/google-doc-spec-v1.md` §D1, §D4, §G6 |
| 15 | Track E (Props) | Pocket Watch | Gold pocket watch with chain & hinged lid, dia 0.05 m, white dial, Roman numerals, ≤ 600 tris | Gold case, open lid, clock face | `prop_watch.glb`, `SOCKET_HandR` | Handled by White Rabbit during S1 cutscene C1 | `docs/google-doc-spec-v1.md` §D1, §D4 |
| 16 | Track E (Props) | Well Props & Shelves | Cupboard (open/closed, 0.8×1.0×0.4 m), Bookshelf (1.0×1.4×0.3 m), Candle (H=0.3 m), Map/Picture (0.6×0.4 m) | Modular shelf models, book instancing | `ch1_well_*.glb` | Placed at `SLOT_01`..`08` via seed 42 | `docs/google-doc-spec-v1.md` §D1, §D5 |
| 17 | Track E (Props) | Fan & Kid Gloves (Fwd) | White kid gloves and folding paper fan (Chapter 2 transition props) | 3D mesh, origin at base | `prop_fan.glb`, `prop_gloves.glb` | Pre-configured in asset pipeline for forward-compatibility | ORIGINAL_REQUEST.md Track E |
| 18 | Track F (Chr) | Alice Character Mesh | 7-year-old Victorian girl, H=1.20 m, head:body 1:4.5, ≤ 15k tris. 4 mesh parts sharing 2048 BaseColor | `Alice_Body`, `Alice_Hair`, `Alice_Dress`, `Alice_Apron` | `chr_alice.glb` | Retains rig weights across all 4 sub-meshes; A-pose export | `docs/google-doc-spec-v1.md` §D1, §D3 |
| 19 | Track F (Chr) | Alice Rigs & Sockets | Humanoid armature + secondary chains: 6 skirt chains (2 seg each), 2 hair chains (3 seg each), sockets HandR/L | Armature modifier, vertex groups | Bone hierarchy, `SOCKET_HandR`, `SOCKET_HandL` | Skirt/hair bones enable secondary physics/spring oscillation | `docs/google-doc-spec-v1.md` §D3 |
| 20 | Track F (Chr) | Alice Core Animations | 16 discrete animation clips (30 fps, in-place root motion): idle, walk, run, pick, inspect, fall, curtsey, land, tryDoor, kneelPeek, drink, shrinkReact, climbSlip, sitCry, eat | Keyframed actions in Blender NLA | Baked clips in `chr_alice.glb`, timestamps in `chr_alice.events.json` | Crossfade blending 0.2s; in-place motion (controller drives displacement) | `docs/google-doc-spec-v1.md` §E1, §E3 |
| 21 | Track F (Chr) | Alice Size Transitions | Normal (1.20 m, capsule r=0.18/h=1.20) <-> Tiny (0.254 m, scale 0.212, capsule r=0.04/h=0.254) <-> Giant (2.9 m) | 2.5s ease-in-out interpolation | SizeSystem state machine, vignette shader, 1.6x audio pitch shift | Head-space ceiling check before expansion (Ch. 2 guard) | `docs/google-doc-spec-v1.md` §G7, Consts |
| 22 | Track F (Chr) | White Rabbit Character | Anthropomorphic rabbit gentleman, H=0.75 m (with ears), ≤ 12k tris. Humanoid rig + ear/tail/coat chains | `Rabbit_Body`, `Rabbit_Jacket`, `Rabbit_Waistcoat` | `chr_rabbit.glb`, `SOCKET_HandR` | Ear chains (3 segs each), coat tail chains (2 chains) | `docs/google-doc-spec-v1.md` §D1, §D3 |
| 23 | Track F (Chr) | White Rabbit Animations | 5 animation clips: `Rabbit_Hurry` (0.6s), `Rabbit_CheckWatch` (2.5s), `Rabbit_LookBack` (1.0s), `Rabbit_JumpIn` (1.0s), `Rabbit_NervousIdle` (2.0s) | Keyframed actions | Baked clips in `chr_rabbit.glb` | Plays synchronized with timeline cutscenes C1, C2, C4 | `docs/google-doc-spec-v1.md` §E1 |
| 24 | Track F (Chr) | Sister Character | Older sister sitting beneath oak tree reading, seated height 0.95 m, ≤ 8k tris | `Sister_Body`, `Sister_Dress`, `Sister_Book` | `chr_sister.glb`, `Sister_Read` clip (6.0s) | Hand turning book page animation | `docs/google-doc-spec-v1.md` §D1, §D3, §E1 |
| 25 | Track F (Chr) | Dinah Dream Phantom | Translucent dream cat silhouette in well fall, body length 0.45 m, ≤ 4k tris | Single mesh, alpha blending | `chr_dinah_dream.glb` | Ghostly bobbing float at t=75s in fall | `docs/google-doc-spec-v1.md` §D1, §D3 |
| 26 | Pipeline | Procedural Arch Builder | Python script `tools/blender/build_ch1_architecture.py` executed via Blender batch or MCP | Parametric formulas for well, passage, hall, table, doors, curtain | Cleaned `CH1_ARCH` collection, exported GLBs in `assets_src/arch/` | Overwrites existing meshes cleanly; idempotent execution | `docs/google-doc-spec-v1.md` §D5 |
| 27 | Pipeline | Blender glTF Exporter | glTF 2.0 Binary (.glb) export with custom properties, skinned meshes, modifiers applied | Blender bpy export operator | `.glb` files with `object.userData` preservation | Cameras and lights excluded (lighting set dynamically in engine) | `docs/google-doc-spec-v1.md` §D0 |
| 28 | Pipeline | Asset Optimization Pipeline | `tools/optimize-assets.mjs` via glTF-Transform & KTX2 / Meshopt compression | `assets_src/**/*.glb` | `public/assets/**/*.glb` validated by `gltf-validator` | Halts build on glTF validation errors | `docs/google-doc-spec-v1.md` §G1, §D0 |

---

## 2. Logic Markers & Hierarchy Specification

All logic markers must be created in Blender as Empty objects (or simplified collision meshes) with exact naming conventions and exported with `Include -> Custom Properties` enabled, so Three.js loads them into `mesh.userData`.

### 2.1 Marker Taxonomy & Naming Rules

| Marker Prefix | Blender Object Type | Visual Display | Custom Properties (`userData`) | Functional Role in Engine |
|---------------|---------------------|----------------|--------------------------------|---------------------------|
| `SPAWN_` | Empty | Single Arrow (`PLAIN_AXES` or `SINGLE_ARROW`), points towards forward heading | `targetState`: string (e.g. `S1_BANK`, `S5_HALL`) | Player spawn transform & orientation |
| `TRG_` | Empty | Cube (`CUBE`), size corresponds to trigger volume | `triggerId`: string, `oneShot`: bool | Trigger zone for cutscenes, zone bounds, or state transitions |
| `INT_` | Empty | Sphere or Plain Axes | `type`: `"pickup"` \| `"inspect"` \| `"door"` \| `"use"` \| `"trigger"`<br>`item`: string (e.g. `"prop_key_gold"`)<br>`promptKey`: string (i18n UI key)<br>`requires`: string (required item ID)<br>`setsFlag`: string (target state flag) | Interactable anchor; player Raycast/Proximity selection target |
| `CAM_` | Empty | Single Arrow, points along camera look vector | `fov`: float (default 55.0), `dofDistance`: float, `duration`: float | Cutscene camera anchor or director focus target |
| `PATH_` | Curve | 3D Bezier Curve | `targetEntity`: string (e.g. `"chr_rabbit"`), `duration`: float | Spline trajectory for NPC patrol / chase sequences |
| `COL_` | Mesh | Simplified geometry (Box/Convex Hull), Wireframe display | `collider`: `true`, `material`: `"wood"` \| `"stone"` \| `"grass"` \| `"leaves"` | Rapier3D static collision body. Set as unrendered at runtime |
| `SLOT_` | Empty | Single Arrow, points perpendicular out from wall towards well center | `slotType`: `"cupboard"` \| `"bookshelf"` \| `"map"` \| `"picture"` \| `"empty"` | Modular shaft decoration socket for runtime procedural spawning |
| `LAMP_` | Empty | Point / Ball | `lightColor`: hex string (e.g. `"#F5C26B"`), `intensity`: float, `range`: float | Ceiling lamp mount and point light spawn position |
| `VISTA_ANCHOR` | Empty | Coordinate Axes, oriented looking into vista | `vistaId`: `"ch1_garden_vista"`, `activeScene`: `"S5_HALL"` | Orientation and origin anchor for garden vista diorama |
| `SOCKET_` | Bone Child Empty | Plain Axes placed at palm / hand bone | `socketName`: `"SOCKET_HandR"` \| `"SOCKET_HandL"` | Attachment point for held items (key, bottle, cake, watch) |

### 2.2 Scene Marker Placement Inventory

```
Scene 1 & 2: Riverbank (ch1_s1_bank.glb)
├── World Origin (0, 0, 0) : Oak Tree Base
├── chr_sister : (0.0, 0.0, 0.0), facing North
├── SPAWN_S1 : (2.0, -1.0, 0.0), heading North (0, 1, 0)
├── INT_sister_book : (0.3, 0.2, 0.7), type="inspect", promptKey="UI_INSPECT"
├── INT_daisy_1 : (5.2, 4.1, 0.0), type="pickup", item="daisy_1", promptKey="UI_PICK"
├── INT_daisy_2 : (-7.4, 2.8, 0.0), type="pickup", item="daisy_2", promptKey="UI_PICK"
├── INT_daisy_3 : (3.1, -8.5, 0.0), type="pickup", item="daisy_3", promptKey="UI_PICK"
├── PATH_rabbit_S1 : Curve from (-25.0, 5.0, 0.0) -> RABBIT_STOP at (4.0, 3.0, 0.0)
├── PATH_rabbit_S2 : Curve from (4.0, 3.0, 0.0) -> Hole at (29.5, -6.0, 0.0)
├── TRG_S2_hole : (28.0, -6.0, 0.0), bounds=(2.0, 2.0, 2.0), triggerId="TRG_S2_HOLE"
├── INT_rabbit_hole : (29.5, -6.0, 0.0), type="trigger", promptKey="UI_JUMP_IN"
└── COL_river_bank : Static collision box along North edge Y=18.0..20.0

Scene 3: Modular Well Shaft (ch1_well_segment.glb)
├── Origin (0, 0, 0) : Segment center base
├── Wall inner radius: 2.0 m (dia 4.0 m), outer radius: 2.3 m, height: 3.0 m
└── SLOT_01 to SLOT_08 : Evenly spaced at 45° intervals on inner wall (Z=1.5 m),
    pointing radially inward toward (0, 0, 1.5). slotType assigned via seed 42.

Scene 4: Corridor & Corner (ch1_s4_passage.glb)
├── SPAWN_S4 : (0.0, 0.0, 0.0) atop leaf pile, heading East (+X)
├── Leaf Pile : dia 2.5 m, centered at (0.0, 0.0, 0.0)
├── Straight Section : X=0.0 to X=24.0 m, W=2.0 m, H=2.4 m
├── TRG_S4_corner : (23.0, 0.0, 0.0), triggerId="TRG_S4_CORNER"
└── Corner Section : Right turn (+Y to -Y in local space) connecting directly to Hall west portal

Scene 5 to 7: Great Hall (ch1_s5_hall.glb)
├── Origin (0, 0, 0) : Center of hall floor (Total dimensions: X=[-12..12], Y=[-3.5..3.5], Z=[0..2.85])
├── Arched Portal (West) : (-12.0, 0.0, 0.0), W=2.0 m, H=2.4 m
├── SPAWN_S5 : (-11.0, 0.0, 0.0), heading East (+X)
├── CAM_S5_intro : (-11.5, 0.0, 2.0), looking towards (+X), fov=60
├── LAMP_01 to LAMP_06 : Y=0.0, Z=2.85 m, X=[-10.0, -6.0, -2.0, 2.0, 6.0, 10.0]
├── INT_door_01 to INT_door_10 :
│   ├── North Wall (Y=3.5 m) : X=[-9.0, -4.5, 0.0, 4.5] (doors 01..04)
│   ├── South Wall (Y=-3.5 m): X=[-9.0, -3.0, 3.0, 9.0] (doors 05..08)
│   └── East Wall (X=12.0 m) : Y=[-1.5, 1.5] (doors 09..10)
│   All doors: type="door", promptKey="UI_OPEN", requires="prop_key_gold"
├── Glass Table : (4.0, 0.0, 0.0), H=0.72 m, dia=0.50 m
│   ├── INT_table : (4.0, 0.0, 0.72), type="pickup", item="prop_key_gold", promptKey="UI_TAKE_KEY"
│   ├── INT_bottle_drinkme : (4.0, 0.1, 0.72), type="inspect", item="prop_bottle_drinkme" (spawns S6)
│   └── INT_table_leg : (4.0, -0.25, 0.0), type="use", promptKey="UI_CLIMB" (S6 climb attempt)
├── INT_glass_box : (4.1, -0.1, 0.0), type="pickup", item="prop_cake_eatme", promptKey="UI_OPEN_BOX" (S7)
├── Low Curtain : (10.5, 3.5, 0.0), INT_curtain: type="trigger", promptKey="UI_PULL_CURTAIN"
├── Little Door : (10.5, 3.5, 0.0), INT_door_little: type="door", requires="prop_key_gold"
├── CAM_S5_peek : (10.5, 3.0, 0.15), looking North into little passage, fov=65
├── Little Passage : (10.5, 3.5..4.7, 0.0), W=0.24 m, H=0.33 m, L=1.2 m
├── VISTA_ANCHOR : (10.5, 4.7, 0.0), heading North looking into garden diorama
├── CAM_S6_shrink : (3.2, -0.8, 0.35), looking at table, fov=70
├── CAM_S6_cry : (4.0, 0.0, 0.1), looking up from under table, fov=75
└── CAM_S7_end : (4.5, -0.4, 0.15), side angle under table, fov=65
```

---

## 3. Metric Dimensions & Spatial Constraints Table

All values are authoritative and strictly locked across engineering, physics, and 3D modeling tracks.

| Entity / Asset | Metric Dimension (W × D × H or Dia × H) | Origin / Pivot Rule | Functional Constraint & Spec Origin |
|----------------|-----------------------------------------|---------------------|-------------------------------------|
| **Alice (Normal)** | 0.40 m × 0.25 m × **1.20 m** | Ground center between feet `(0, 0, 0)` | 7-year-old Victorian girl height. Kinematic capsule: r=0.18 m, h=1.20 m |
| **Alice (Small)** | 0.08 m × 0.05 m × **0.254 m** | Ground center between feet `(0, 0, 0)` | Exactly 10 inches tall (scale 0.212). Kinematic capsule: r=0.04 m, h=0.254 m |
| **Alice (Giant/Ch2)** | 0.95 m × 0.60 m × **2.85 m – 3.0 m** | Ground center between feet `(0, 0, 0)` | Over 9 feet tall; head hits 2.85 m ceiling in Chapter 2 |
| **White Rabbit** | 0.35 m × 0.25 m × **0.75 m** | Ground center between feet | Incl. ears; approx 2/3 Alice's height |
| **Sister (Seated)** | 0.60 m × 0.70 m × **0.95 m** | Hip ground center `(0, 0, 0)` | Seated under oak tree reading book |
| **Great Hall Shell** | **24.0 m (L) × 7.0 m (W) × 2.85 m (H)** | Center of floor `(0, 0, 0)` | Long, low ceiling hall per novel text |
| **Great Hall Large Doors** | **1.0 m (W) × 2.2 m (H)** | Hinge bottom corner | 10 doors total; lock too large for gold key |
| **Glass Three-Legged Table** | Dia **0.50 m**, Height **0.72 m** | Bottom center of legs | 0.72 m is ~2.8× Alice's small height (unreachable) |
| **Tabletop Slab** | Dia 0.50 m, Thickness **0.035 m** | Slab bottom center | 5 mm beveled rim; glass material |
| **Table Legs (3x)** | Top dia **0.04 m**, Bottom dia **0.025 m** | Base of foot | Tapered slippery glass legs |
| **Little Door** | **0.24 m (W) × 0.381 m (H)** | Hinge bottom corner | Exactly 15 inches high per Carroll's novel |
| **Little Passage** | **0.24 m (W) × 0.33 m (H) × 1.2 m (L)** | South entrance bottom center | Tiny passage connecting Great Hall to Garden |
| **Low Curtain** | **0.80 m (W) × 0.60 m (H)** | Center of top hanging rod | Mounted 0.05 m in front of little door |
| **Golden Key** | Length **0.05 m** (5 cm) | Geometric center | Tiny brass key fitting only little door |
| **'DRINK ME' Bottle** | Dia **0.04 m**, Height **0.10 m** | Base bottom center | Round glass bottle with cork & string label |
| **'EAT ME' Cake** | Dia **0.05 m**, Height **0.025 m** | Base bottom center | Currant letters spelling "EAT ME" |
| **Glass Box** | **0.10 m (L) × 0.07 m (W) × 0.05 m (H)** | Base bottom center | Rectangular box with hinged brass lid under table |
| **Well Inner Diameter** | Dia **4.0 m**, Wall thickness **0.3 m** | Cylinder axis at base | Horizontal falling movement radius locked to 1.4 m |
| **Well Segment Height** | Height **3.0 m** | Cylinder bottom center | 12 pooled segments cycling at 2.2 m/s |
| **Well Cupboard** | **0.80 m (W) × 0.40 m (D) × 1.0 m (H)** | Midpoint of back bottom edge | Snaps cleanly to well wall slot |
| **Well Bookshelf** | **1.0 m (W) × 0.30 m (D) × 1.4 m (H)** | Midpoint of back bottom edge | Instanced books on shelves |
| **Marmalade Jar** | Dia **0.08 m**, Height **0.14 m** | Base bottom center | Empty glass jar with tied paper lid |
| **Rabbit Hole Burrow** | Dia **0.80 m**, Length ~4.0 m | Entrance ground center | Burrow tunnel under hedge |
| **Corridor Module** | **2.0 m (W) × 2.4 m (H)**, Length **4.0 m** | Entrance bottom-left corner | Arched passage with stone wall & dirt floor |
| **Garden Vista Box** | **10.0 m (W) × 6.0 m (D) × 5.0 m (H)** | South doorway threshold | High-saturation exterior diorama vista |

---

## 4. Track E: 3D Props & Interactive Objects Specification

### 4.1 Complete Prop Asset Manifest

| Asset ID | Target File | Tri Budget | Materials / Textures | Visual Details & Decal Specs | Gameplay Invariant |
|----------|-------------|------------|----------------------|------------------------------|--------------------|
| `prop_key_gold` | `assets_src/props/prop_key_gold.glb` | ≤ 600 | `M_Gold_Key` (Metallic 0.9, Roughness 0.25, Color `#D4A93A`) | Looped ornate bow, simple key teeth, polished brass sheen | Fits only little door. Drops onto table when bottle picked up |
| `prop_bottle_drinkme` | `assets_src/props/prop_bottle_drinkme.glb` | ≤ 800 | `M_Glass_Bottle` (translucent, Roughness 0.1), cork stopper, paper label | Decal 1024×512 PNG: text "DRINK ME" in `IM Fell English`, ink `#2B2420`, paper `#EFE3C8`. Blank reverse side | 3D inspection requires viewing both sides to verify no "POISON" before drinking |
| `prop_cake_eatme` | `assets_src/props/prop_cake_eatme.glb` | ≤ 1,200 | `M_Cake_Crust` (golden crust), `M_Cake_Icing` (pale cream icing), `M_Currant` | 3D currant ellipsoids (~4 mm, deep purple `#24141E`, wrinkly surface) spelling "EAT ME" along curves | Eating triggers size monologue and chapter end |
| `prop_box_glass` | `assets_src/props/prop_box_glass.glb` | ≤ 400 | `M_Glass_Box` (translucent), `M_Brass_Trim` (hinges & rim) | Hinged glass lid slightly ajar, rests on floor under glass table | Contains `prop_cake_eatme`; revealed after weeping sequence |
| `prop_jar_marmalade` | `assets_src/props/prop_jar_marmalade.glb` | ≤ 800 | `M_Glass_Jar`, tied paper cover, label decal | Decal: "ORANGE MARMALADE" in `IM Fell English`. Empty inside | Grabbed during S3 fall; cannot drop into void; placed into open cupboard |
| `prop_watch` | `assets_src/props/prop_watch.glb` | ≤ 600 | `M_Gold_Watch`, enamel dial `T_Watch_Dial` | Open hinged lid, Roman numeral dial, small gold chain | Checked by White Rabbit during S1 C1 cutscene |
| `ch1_bank_book` | `assets_src/props/ch1_bank_book.glb` | ≤ 300 | `M_Book_Cover` (dark leather), `M_Pages` | Open book lying on sister's lap, no pictures or dialogues | Inspecting triggers Alice's opening thought monologue |
| `ch1_bank_daisy` | `assets_src/props/ch1_bank_daisy.glb` | ≤ 300 | `M_Daisy_Petals` (white), `M_Daisy_Core` (yellow), stem | Single English daisy with 2 small leaves; 0.12 m height | Picking 2nd daisy triggers White Rabbit's entrance |
| `ch1_well_candle` | `assets_src/props/ch1_well_candle.glb` | ≤ 600 | `M_Brass_Candle`, half-melted wax, emissive flame | Candle holder with yellow flame quad + point light | Ambient lighting in falling shaft |
| `ch1_hall_lamp` | `assets_src/props/ch1_hall_lamp.glb` | ≤ 1,500 | `M_Brass_Lamp`, glass chimney, warm emissive wick | Victorian hanging oil lamp with brass frame & suspension chain | 6 lamps illuminate Great Hall along centerline |

### 4.2 3D Inspector Mechanics & Physics Constraints

1. **Inspector Orbiting Controller:**
   - Triggered when inspecting `prop_bottle_drinkme` or `prop_cake_eatme`.
   - Prop is rendered in front of a blurred scene backdrop (depth of field).
   - Mouse drag / touch swipe provides 360° pitch and yaw rotation with inertia.
2. **Bottle "No-Poison" Verification Puzzle:**
   - The label decal is attached only to the front face.
   - The back face of the bottle is blank.
   - Yaw angle tracking: The game registers `front_inspected = true` when `abs(yaw) < 30°` and `back_inspected = true` when `abs(yaw - 180°) < 30°`.
   - The "Drink" (`UI_DRINK`) button appears **only** when both `front_inspected && back_inspected` evaluate to `true`.
3. **Table Under-View Refraction Invariant:**
   - When Alice shrinks to 0.254 m and stands under the glass table, she must look upward toward the tabletop.
   - Three.js custom glass material (`M_Glass_Table`) uses a low opacity (0.20–0.25) with a slight blue-green Fresnel rim tint (`#BFE6EA`) and minimal screen-space distortion so that `prop_key_gold` is unmistakably visible through the glass tabletop from below.
4. **Table Leg Climbing Collision:**
   - The table legs feature custom physics colliders tagged with `surface="glass_slippery"`.
   - Interacting with `INT_table_leg` locks player controls and triggers the `Alice_ClimbSlip` animation.

---

## 5. Track F: Characters, Rigging, & Animation Matrix

### 5.1 Alice Character Specification (`chr_alice.glb`)

- **Proportions:** Height = 1.20 m (Normal), head-to-body ratio 1:4.5, stylized Victorian storybook girl.
- **Costume:** Wheat-yellow knee-length dress (`#E9C46A`), white ruffled pinafore apron (`#F7F3EA`) with two front patch pockets and rear tie bow, light-blonde wavy hair (`#E6C98F`) to mid-back with navy-blue ribbon bow (`#2E3F6E`), white stockings, black strap Mary Jane shoes.
- **Sub-meshes:** Split into 4 distinct objects:
  1. `Alice_Body`: Head, neck, arms, legs, shoes.
  2. `Alice_Hair`: Main hair volume, fringe, back hair, ribbon.
  3. `Alice_Dress`: Yellow dress body, puffy sleeves, skirt hem.
  4. `Alice_Apron`: Pinafore bib, frills, straps, pockets, rear bow.
- **Texture:** Single shared 2048×2048 texture atlas (`T_Alice_BaseColor.png` / converted to `T_Alice_BaseColor.ktx2`), Principled BSDF, Roughness 0.85, Metallic 0.0.
- **Armature Hierarchy & Secondary Bones:**
  - Base: Standard humanoid biped armature (Hips, Spine, Chest, Neck, Head, Clavicle L/R, UpperArm L/R, Forearm L/R, Hand L/R, Thigh L/R, Shin L/R, Foot L/R).
  - Skirt Rig: 6 radial bone chains around skirt circumference (`skirt_front_L`, `skirt_front_R`, `skirt_side_L`, `skirt_side_R`, `skirt_back_L`, `skirt_back_R`), 2 segments per chain.
  - Hair Rig: 2 bone chains for back hair (`hair_L`, `hair_R`), 3 segments per chain.
  - Sockets: `SOCKET_HandR` (attached to right hand palm bone), `SOCKET_HandL` (attached to left hand palm bone).

### 5.2 Complete Animation Clip Inventory (30 FPS, In-Place)

| # | Action Name | Source | Duration | Loop | Keyframe Beats & Event Metadata |
|---|-------------|--------|----------|------|----------------------------------|
| 1 | `Alice_Idle` | Tripo / Blend | 3.5 s | Yes | Subtle breathing, idle weight shifts, occasional apron tidy |
| 2 | `Alice_Walk` | Tripo / Blend | 1.0 s | Yes | Stride length ~0.50 m, footfalls at 0.25 s and 0.75 s |
| 3 | `Alice_Run` | Tripo / Blend | 0.7 s | Yes | Hurried run, arms pumping, footfalls at 0.18 s and 0.52 s |
| 4 | `Alice_Pick` | Tripo / Blend | 1.2 s | No | Bends down to grass; hand touches ground at 0.6 s (`{"grab": 0.6}`) |
| 5 | `Alice_Inspect` | Blender Custom | 2.0 s | No | Lifts item with both hands to chest, tilts head curiously |
| 6 | `Alice_FallFloat` | Blender Custom | 4.0 s | Yes | Weightless descent; arms outspread waving gently, skirt/hair billow upward |
| 7 | `Alice_CurtseyAir` | Blender Custom | 1.5 s | No | Mid-air curtsey (Easter egg): gathers skirt, steps back in mid-air, bows head |
| 8 | `Alice_Land` | Blender Custom | 1.0 s | No | Hits leaf pile, deep knee cushion, springs upright rapidly |
| 9 | `Alice_TryDoor` | Blender Custom | 1.2 s | No | Grasp door knob, rattles twice (0.3s, 0.7s), releases in frustration |
| 10 | `Alice_KneelPeek_In`| Blender Custom | 1.5 s | No | Drops to knees, leans torso forward, lowers cheek close to ground |
| 11 | `Alice_KneelPeek_Loop`| Blender Custom | 3.0 s | Yes | Peeking through tunnel; gentle breathing and subtle head shifts |
| 12 | `Alice_Drink` | Blender Custom | 2.0 s | No | Right hand holds bottle, left hand uncorks, tips head back (1.0s), wipes mouth |
| 13 | `Alice_ShrinkReact` | Blender Custom | 1.5 s | No | Hands hug shoulders, looks left and right in wonder/dismay |
| 14 | `Alice_ClimbSlip` | Blender Custom | 2.5 s | No | Hugs glass table leg, climbs up 2 paces (0.8s), slips down, lands on bottom |
| 15 | `Alice_SitCry` | Blender Custom | 3.0 s | Yes | Sits on floor rubbing eyes with fists, shoulders shuddering rhythmically |
| 16 | `Alice_Eat` | Blender Custom | 2.0 s | No | Right hand brings cake to mouth, takes bite (0.7s), left hand presses head |

*Note: All animation event timestamps are stored in `assets_src/characters/chr_alice.events.json`.*

### 5.3 White Rabbit Specification (`chr_rabbit.glb`)

- **Dimensions:** Height = 0.75 m (including upright ears), standing upright on two feet like an anxious Victorian gentleman.
- **Costume & Fur:** Soft warm-white fur (`#F4F1EC`), pink eyes (`#E88FA3`), pink inner ears, brown-and-cream checked coat (`#9B5B3A` & `#E2C9A0`) with short tails, mustard waistcoat (`#C9A24A`) with gold watch chain, small bow tie.
- **Sub-meshes:** `Rabbit_Body`, `Rabbit_Jacket`, `Rabbit_Waistcoat`.
- **Armature:** Humanoid biped + 3 bones per ear, 2 bones per coat tail, `SOCKET_HandR` in right paw.
- **Animations:**
  1. `Rabbit_Hurry`: 0.6 s, Loop. Quick scurry steps, torso leaning forward, ears pinned back.
  2. `Rabbit_CheckWatch`: 2.5 s, Non-loop. Pulls watch from waistcoat pocket (0.5s), pops lid (0.8s), checks time anxiously (1.5s), pockets watch (2.2s).
  3. `Rabbit_LookBack`: 1.0 s, Non-loop. Glances back over shoulder while continuing to jog.
  4. `Rabbit_JumpIn`: 1.0 s, Non-loop. Dives head-first into rabbit hole burrow.
  5. `Rabbit_NervousIdle`: 2.0 s, Loop. Taps foot impatiently, twitches ears and whiskers.

### 5.4 Secondary Characters

- **Sister (`chr_sister.glb`):** Seated height 0.95 m, ≤ 8,000 tris. Sub-meshes: `Sister_Body`, `Sister_Dress`, `Sister_Book`. Animation: `Sister_Read` (6.0 s loop, reading, blinking, turning page at 3.5 s).
- **Dinah Dream Cat (`chr_dinah_dream.glb`):** Body length 0.45 m, ≤ 4,000 tris. Translucent material (Alpha 0.6), gentle floating bobbing animation.

---

## 6. Blender Tooling & Asset Pipeline

### 6.1 Toolchain Environment & Connectivity

```
[Local Host Environment]
├── Blender Binary: /mnt/d/blender.exe (Blender 5.2 Windows executable accessed via WSL2)
├── Blender MCP Server: /home/administrator/.local/bin/blender-mcp (Python listener)
├── Blender MCP Addon Target: 127.0.0.1:9876
└── Headless CLI Invocation:
    /mnt/d/blender.exe -b <optional_file.blend> -P <script.py> -- <args>
```

### 6.2 Asset Pipeline Directory Layout

```
Alice-s-Adventures-in-Wonderland-/
├── assets_src/                      # Source assets (Uncompressed GLBs, Blend files)
│   ├── tripo_raw/                   # Raw exports from Tripo Studio
│   │   ├── characters/
│   │   └── props/
│   ├── characters/                  # Cleaned rigged characters + animation GLBs
│   │   ├── chr_alice.glb
│   │   ├── chr_alice.events.json
│   │   ├── chr_rabbit.glb
│   │   ├── chr_sister.glb
│   │   └── chr_dinah_dream.glb
│   ├── props/                       # Individual prop GLBs
│   │   ├── prop_key_gold.glb
│   │   ├── prop_bottle_drinkme.glb
│   │   ├── prop_cake_eatme.glb
│   │   ├── prop_box_glass.glb
│   │   ├── prop_jar_marmalade.glb
│   │   └── prop_watch.glb
│   ├── arch/                        # Procedural architectural modules
│   │   ├── ch1_well_segment.glb
│   │   ├── ch1_passage_straight.glb
│   │   ├── ch1_passage_corner.glb
│   │   ├── ch1_hall_shell.glb
│   │   ├── ch1_hall_table_glass.glb
│   │   ├── ch1_hall_door_little.glb
│   │   ├── ch1_hall_passage_little.glb
│   │   └── ch1_hall_curtain.glb
│   ├── greybox/                     # Greybox test scenes
│   │   ├── ch1_greybox.blend
│   │   └── ch1_greybox.glb
│   └── scenes/                      # Assembled production scene GLBs
│       ├── ch1_s1_bank.glb          # Riverbank & chase scene
│       ├── ch1_s3_well.glb          # Well shaft modular scene
│       ├── ch1_s4_passage.glb       # S4 corridor scene
│       └── ch1_s5_hall.glb          # Great Hall scene
│
├── tools/
│   ├── blender/
│   │   ├── build_ch1_architecture.py # Procedural bpy builder script
│   │   ├── batch_export_props.py     # Prop cleanup and decal script
│   │   └── assemble_scenes.py        # Scene assembler and marker validator
│   └── optimize-assets.mjs           # Node.js glTF-Transform + KTX2 optimizer
│
└── public/assets/                   # Runtime production assets (Engine-ready)
    ├── characters/
    ├── props/
    └── scenes/
```

### 6.3 Procedural Architecture Script Specification (`build_ch1_architecture.py`)

The script must be executable both inside Blender (via MCP / interactive Text Editor) and via CLI (`blender -b -P tools/blender/build_ch1_architecture.py`).
1. **Idempotence:** Always clears or creates collection `CH1_ARCH` on execution.
2. **Coordinate & Unit Standard:** `scene.unit_settings.system = 'METRIC'`, `scale_length = 1.0`. All transforms applied (`bpy.ops.object.transform_apply()`).
3. **Module Generation Procedures:**
   - `build_well_segment()`: Inner radius 2.0 m, outer radius 2.3 m, height 3.0 m, 32 circumferential subdivisions. Spawns 8 `SLOT_01`..`08` empties at radius 2.0 m, Z=1.5 m pointing toward center.
   - `build_passage_modules()`: Straight (4.0 m L × 2.0 m W × 2.4 m H) and Corner (90° right bend). Arched ceiling defined by semicircular top profile (radius 1.0 m above 1.4 m wall height).
   - `build_hall_shell()`: 24.0 m × 7.0 m × 2.85 m interior box. Cuts west portal (2.0 × 2.4 m) and 10 large door openings (1.0 × 2.2 m). Places 6 `LAMP_` empties along roof centerline.
   - `build_glass_table()`: Cylindrical slab (dia 0.50 m, thickness 0.035 m, 5 mm bevel) + 3 tapered cylinder legs (top dia 0.04 m, bottom 0.025 m, height 0.685 m). Assigns `M_Glass_Table`.
   - `build_little_door()`: Arch frame + hinged panel (0.24 m W × 0.381 m H). Pivot placed at bottom hinge corner `(0.0, 0.0, 0.0)`.
   - `build_curtain()`: Plane grid (0.8 m W × 0.6 m H), cloth simulation draped over rod, pinned at top vertices, baked to shape key `CurtainOpen`.
4. **glTF Export Invocation:**
   ```python
   bpy.ops.export_scene.gltf(
       filepath=output_path,
       export_format='GLB',
       use_selection=True,
       export_apply=True,
       export_yup=True,
       export_custom_props=True,
       export_lights=False,
       export_cameras=False,
       export_animations=True,
       export_current_frame=False
   )
   ```

### 6.4 Shader, Material & Optimization Pipeline

1. **Material Channel Constraints:**
   - Only standard Principled BSDF channels permitted in GLB: `Base Color`, `Roughness`, `Metallic`, `Normal`, `Alpha`.
   - Custom engine materials are flagged via naming conventions:
     - `M_Glass_*`: Replaced at runtime by Three.js refractive / Fresnel shader.
     - `M_Water_*`: Replaced by procedural river surface shader.
     - `M_Emissive_*`: Bloom-enabled materials (lamps, candles, garden sunlight).
2. **Decal & Label Baking:**
   - 1024×512 PNG label textures generated programmatically with SIL OFL `IM Fell English` font.
   - Attached as separate thin polygon meshes offset 0.5 mm from bottle/jar surfaces with Alpha blend mode, avoiding texture distortion on organic bottles.
3. **Runtime Asset Optimization (`tools/optimize-assets.mjs`):**
   - `@gltf-transform/functions`: `dedup()`, `prune()`, `resample()`.
   - Texture compression via KTX-Software: BaseColor / Diffuse maps -> ETC1S (compact web download); Normal maps -> UASTC (high-fidelity surface normals).
   - Mesh compression: Meshopt encoder enabled (`--meshopt`).
   - Validation gate: `gltf-validator` checks all outputs in `public/assets/`. Any validation warning/error causes pipeline build failure.

---

## 7. Edge Cases & Invariant Verification Matrix

| # | Feature / System | Input / Condition | Authoritative Observed / Expected Behavior |
|---|------------------|-------------------|-------------------------------------------|
| 1 | Great Hall Curtain | Player interacts with `INT_curtain` before `keyTriesOnDoors >= 2` | Inactive: curtain cannot be selected, highlighted, or interacted with. Alice ignores it |
| 2 | Great Hall Little Door | Player approaches little door before unlocking | Door is locked; interaction says "It's locked, and the keyhole is much too small for the doors around the room" |
| 3 | Great Hall Key & Bottle | Player picks up `prop_bottle_drinkme` while holding `prop_key_gold` | Key is automatically returned to glass table with soft clink audio (`sfx_key_down`). Hands emptied without warning prompt |
| 4 | Glass Table Transparency | Alice shrinks to 0.254 m and looks up through table | Gold key resting on table top remains clearly visible through refractive Fresnel glass slab |
| 5 | Table Leg Climb Attempt | Alice interacts with `INT_table_leg` in small state | Plays `Alice_ClimbSlip` animation; slides down after 2 steps. On 2nd attempt, triggers weeping sequence and reveals glass box |
| 6 | Well Fall Marmalade Jar | Player attempts to discard `prop_jar_marmalade` during fall | Alice refuses: "I mustn't drop it. I might kill somebody underneath!" Jar remains in hand until open cupboard is reached |
| 7 | Well Fall Cupboard Miss | Player misses first open cupboard at t=25s | A new open cupboard respawns every 8 seconds until the jar is safely placed |
| 8 | Mid-Air Curtsey | Player presses `C` key while thought monologue 4 ("Antipathies") is active | Alice performs `Alice_CurtseyAir` animation in mid-fall; unlocks secret narrator line and chapter end easter-egg stat |
| 9 | Hall Size Ceiling Check | SizeSystem attempts to restore normal/giant height in low room | Raycast upward checks head clearance; if clearance < required height, expansion is halted at ceiling |
| 10 | Scene Transition Occlusion | Player moves from S4 corridor corner into S5 Great Hall | Seamless transition through arched doorway without loading screen (S5 preloaded in background during S3/S4) |
| 11 | Cutscene Skipping State | Player skips any cutscene C1–C8 by holding Esc / skip button | Skip immediately assigns all terminal state flags, positions player at ending marker, and sets exact item states |
| 12 | Subtitle Typography | Chinese subtitle line generated | Hard constraint: maximum 28 Chinese characters per line; overflow splits into sequential lines |
