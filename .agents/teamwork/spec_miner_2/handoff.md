# Handoff Report — 3D Art & Asset Pipeline Specifications (Tracks D, E, F)

**Agent:** `spec_miner_2` (Teamwork Preview 3D Art & Asset Spec Miner)  
**Recipient:** `teamwork_preview_orchestrator_1` (Conversation ID: `96fcdb3d-2c70-4c56-b622-1b4e5ccd5a0b`)  
**Timestamp:** 2026-10-14T08:17:00Z  
**Type:** Hard Handoff (Task Complete)

---

## 1. Observation

1. **Authoritative Specification Document:**
   - `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` (1,571 lines, 103,441 bytes):
     - Section D0 (lines 606–615): Units (meters, Unit Scale 1.0, +Y Up), pivot placement, triangle budgets (Alice ≤ 15k, Rabbit ≤ 12k, Sister ≤ 8k, props 200–3k, per-scene total ≤ 300k), texture limits (single 2048 BaseColor for characters, 1024 atlas for props, KTX2 conversion), material channels (Principled BSDF only, `M_Glass_` prefix for engine glass).
     - Section D1 (lines 616–847): Exhaustive asset inventory table listing all 28+ required models, dimensions, triangle budgets, priorities (P0–P2), and generation methods.
     - Section D3 (lines 866–911): Alice model hierarchy (`Alice_Body`, `Alice_Hair`, `Alice_Dress`, `Alice_Apron`), bone structure, secondary chains (6 skirt chains of 2 segments each; 2 hair chains of 3 segments each), and sockets (`SOCKET_HandR`, `SOCKET_HandL`).
     - Section D4 (lines 912–932): Prop dimensions, decals (1024×512 PNG, `IM Fell English`, ink `#2B2420`, paper `#EFE3C8`), 3D raisin beads on cake spelling "EAT ME".
     - Section D5 (lines 933–945): Procedural architecture script specifications for `tools/blender/build_ch1_architecture.py`.
     - Section E1–E3 (lines 957–1093): Complete animation clip catalog for Alice (16 clips, 30 fps, in-place root motion) and White Rabbit (5 clips), along with `chr_alice.events.json` keyframe event metadata.
     - Section F1–F2 (lines 1099–1134): Precise metric coordinates for all rooms and spatial markers (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `PATH_`, `COL_`, `SLOT_`, `LAMP_`, `VISTA_ANCHOR`).
     - Dimension Constants Table (lines 151–188): Alice normal (1.20 m), small (0.254 m / scale 0.212), little door (0.24 m × 0.381 m), little passage (0.24 m × 0.33 m × 1.2 m), glass table (H=0.72 m, dia=0.50 m), Great Hall (24 × 7 × 2.85 m), well shaft (inner dia 4.0 m).
2. **Authoritative Request File:**
   - `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/ORIGINAL_REQUEST.md`:
     - R2 details requirements for 3D Greybox, procedural architecture, props, characters, animations.
     - Confirms local Blender executable at `/mnt/d/blender.exe` and live Blender MCP server on `127.0.0.1:9876`.
3. **Local Toolchain & Environment Probe:**
   - Command `ls -l /mnt/d/blender.exe` confirmed presence of Blender 5.2 executable (`113,022,936 bytes`).
   - Python MCP listener process is active (`/home/administrator/.local/bin/blender-mcp`), but port `127.0.0.1:9876` is waiting for Blender addon startup.
   - Headless batch Python execution is supported via `/mnt/d/blender.exe -b <file.blend> -P <script.py>`.

---

## 2. Logic Chain

1. **From Aesthetic Directive to Shader & Asset Constraints:**
   - Observation: Spec §C0 and §G9 mandate a "moving Victorian picture-book" style with 3-tone toon ramp, ink outlines (`#2B2420`), 15% paper grain, and prohibition against dark/grotesque or modern adaptations.
   - Deduction: 3D assets must not rely on PBR metallic roughness reflections. Meshes must have clean, readable silhouettes, unified vertex normals for inverted-hull outline shaders, and standard Principled BSDF color maps compatible with Three.js custom TSL / WebGL2 toon shaders.
2. **From Narrative Beats to Metric Architecture & Invariants:**
   - Observation: In S5/S6, Alice shrinks to 10 inches (0.254 m), at which point the glass table (0.72 m) is 2.8× her height and unreachable, yet Carroll's text states she sees the key through the glass.
   - Deduction: The procedural architecture script `build_ch1_architecture.py` must construct the glass table with exact height 0.72 m, circular top diameter 0.50 m, tabletop thickness 0.035 m with a 5 mm bevel, and material name `M_Glass_Table`. The game engine replaces `M_Glass_*` with a refractive/Fresnel glass material whose opacity and refraction index allow unobstructed visibility of `prop_key_gold` from floor level.
3. **From Interaction Mechanics to Logic Marker Hierarchy:**
   - Observation: Spec §D0, §D5, §F1, §F2 and §G4 require all interactables to be discoverable without hardcoded scene coordinate lists.
   - Deduction: Blender scenes must place Empty objects with standard prefixes (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `PATH_`, `COL_`, `SLOT_`, `LAMP_`, `VISTA_ANCHOR`) and export with `Include -> Custom Properties`. When loaded into Three.js, `object.userData` directly configures interaction type, required item, target flag, and prompt key.
4. **From Animation & Rigging Requirements to Export Standards:**
   - Observation: Spec §E1, §E3, and §G3 require 16 in-place clips at 30 fps for Alice and 5 clips for White Rabbit, with keyframe events recorded in `chr_alice.events.json`.
   - Deduction: Locomotion displacement must be driven by Rapier3D KinematicCharacterController, not bone root motion. All keyframed actions must be pushed to Blender NLA strips before export to `chr_alice.glb` and `chr_rabbit.glb`.

---

## 3. Caveats

1. **Blender MCP Socket Connection:**
   - The MCP bridge process is running (`blender-mcp`), but port 9876 connection requires Blender GUI or addon to be actively listening on Windows host. However, all procedural architecture and asset conversion tasks can execute fully headlessly via `/mnt/d/blender.exe -b -P <script.py>`.
2. **Forward-Compatibility Props:**
   - White Rabbit's umbrella and fan/gloves are referenced in general materials for Chapter 2 continuity. Chapter 1 gameplay exclusively requires the pocket watch (`prop_watch.glb`), golden key (`prop_key_gold.glb`), 'DRINK ME' bottle (`prop_bottle_drinkme.glb`), 'EAT ME' cake (`prop_cake_eatme.glb`), glass box (`prop_box_glass.glb`), and marmalade jar (`prop_jar_marmalade.glb`). Both Chapter 1 and forward props have been documented.

---

## 4. Conclusion

The 3D art, environment greybox, procedural architecture, props, character rigs/animations, and asset optimization pipeline specifications are fully mined, rigorously verified against authoritative documents, and compiled into:
`/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/spec_miner_2/spec_report_3d_art.md`

All dimensions, marker hierarchies, polygon budgets, animation clip inventories, and edge-case invariants are fully specified and ready for immediate implementation by Track D, E, and F subagents.

---

## 5. Verification Method

1. **Verify Report Integrity:**
   - Inspect the compiled specification report:
     ```bash
     cat /home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/spec_miner_2/spec_report_3d_art.md
     ```
2. **Verify Metric Constants Alignment:**
   - Cross-check dimensions in Section 3 against `docs/google-doc-spec-v1.md` lines 151–188:
     - Alice normal height: 1.20 m
     - Alice small height: 0.254 m (scale 0.212)
     - Little door: 0.24 m × 0.381 m
     - Glass table: H = 0.72 m, Dia = 0.50 m
     - Great Hall: 24.0 m × 7.0 m × 2.85 m
     - Well inner diameter: 4.0 m
3. **Verify Script Readiness:**
   - Verify that `tools/blender/build_ch1_architecture.py` specifications match Section 6.3 parameters.
