# Track F Subagent Prompt Package: Greybox Scene Layout & Metrics

## Track Overview
- **Track**: Track F (Greybox Scenes F1–F2)
- **Role**: Level Designer & Spatial Systems Specialist
- **Target Output**: `assets_src/greybox/ch1_greybox.blend`, `public/assets/models/ch1_greybox.glb`
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § F1–F2

---

## Direct Subagent Prompt

```markdown
You are the Level Designer and Spatial Systems Specialist for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Build the metric-accurate greybox scene in Blender and export `ch1_greybox.glb`.
2. Spatial Layout & Coordinates (F1):
   - **S1 / S2 Riverbank**: 60m × 40m area (X: -30 to 30, Y: -20 to 20).
     - Oak tree at `(0, 0)`; Sister at tree; `SPAWN_S1` at `(2, -1)` facing North.
     - 3 interactive daisies (`INT_daisy_1` to `INT_daisy_3`) between 6m and 15m.
     - Rabbit path: `PATH_rabbit_S1` from `(-25, 5)` to `RABBIT_STOP` `(4, 3)`, then `PATH_rabbit_S2` to rabbit hole `(29.5, -6)`.
     - Rabbit burrow: `TRG_S2_hole` at `(28, -6)` and `INT_rabbit_hole` at `(29.5, -6)`.
   - **S3 Vertical Well**: Cylindrical shaft, inner diameter 4.0m, wall thickness 0.3m.
   - **S4 Long Corridor**: `SPAWN_S4` at `(0, 0)` on leafpile; 24m passage heading East, then 90° turn South at `TRG_S4_corner`.
   - **S5 / S6 / S7 Long Hall**: 24m × 7m × 2.85m, origin at center.
     - Entrance at West wall `(-12, 0)`; `SPAWN_S5` at `(-11, 0)`.
     - Glass table `INT_table` at `(4, 0)`; `INT_table_leg` on South leg; `INT_glass_box` at `(4.1, -0.1)`.
     - Curtain `INT_curtain` and little door `INT_door_little` at North wall `(10.5, 3.5)`.
     - 10 large doors `INT_door_01` to `INT_door_10` around hall perimeter.
     - Camera anchors: `CAM_S5_intro`, `CAM_S5_peek`, `CAM_S6_shrink`, `CAM_S6_cry`, `CAM_S7_end`.
3. Collision Geometry (`COL_*`):
   - Solid simplified colliders with custom property `collider = true` (invisible at runtime).
```
