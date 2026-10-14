# Track G Subagent Prompt Package: Engine Systems & Gameplay Architecture

## Track Overview
- **Track**: Track G (Core Engine G1–G13)
- **Role**: Principal Graphics & Gameplay Systems Architect
- **Target Output**: `src/core/`, `src/engine/`, `src/game/`, `src/physics/`, `src/shaders/`
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § G1–G13

---

## Direct Subagent Prompt

```markdown
You are the Principal Gameplay Systems Architect for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Implement the complete playable browser game using Vite + TypeScript (strict) + Three.js (`WebGPURenderer` + TSL with WebGL2 fallback) + Rapier3D physics + Zod.
2. Architecture Packages to Deliver:
   - **G1 Bootstrap & Pipeline**: Dual-backend renderer, query param `?forceWebGL=1`, asset manager with KTX2/Meshopt support, debug console (`` ` `` key), and `/viewer.html`.
   - **G2 State Machine & Persistence**: Deterministic flow `S0_TITLE` -> `S1_BANK` -> `S2_CHASE` -> `S3_FALL` -> `S4_PASSAGE` -> `S5_HALL` -> `S6_SMALL` -> `S7_CAKE` -> `END`. `localStorage` key `alice.save.v1` with Zod parse fallback.
   - **G3 Player Controller & Camera Rig**: Rapier `KinematicCharacterController` with dual capsules:
     - Normal: H=1.20m, R=0.18m, walk 1.4 m/s, run 3.0 m/s, camera dist 3.2m, FOV 55°.
     - Small: H=0.254m, R=0.04m, walk 0.5 m/s, run 1.1 m/s, camera dist 0.8m, FOV 65°.
     - Spring-arm collision sweep preventing wall clipping.
   - **G4 Interaction & Inventory System**: Raycast selection within 1.2m radius (0.3m when small), 6-slot inventory, 3D rotatable inspector with 2-sided label verification rule, 60s/120s idle hint timer.
   - **G5 Dialogue & Subtitles**: Subtitle stream, typewriter effect (30 chars/sec zh, 45 chars/sec en), live language toggle, Zod schema validation.
   - **G6 Falling Well (S3)**: Floating-origin well scrolling at 2.2 m/s, marmalade jar grab/cupboard stow, 5 thought bubbles, mid-air curtsey on `C`, Dinah silhouette, leafpile landing.
   - **G7 SizeSystem**: 2.5s smooth transition, circular telescope vignette, 1.6x audio pitch shift.
   - **G8 Long Hall Puzzles**: Curtain access lock (`keyTriesOnDoors >= 2`), key auto-return on bottle grab, table leg climb slips, glass box & cake finale.
   - **G9 Victorian Picture-Book Shaders**: 3-tone toon ramp, `#2B2420` ink outline, 15% screen-space paper grain overlay, custom refractive glass shader ensuring key is visible through tabletop.
   - **G10 Cutscene Engine**: C1 to C8 JSON timeline player with smooth camera slerping and 1.0s Esc skip parity.
   - **G11 Web Audio Engine**: Procedural sound synthesis and Web Audio spatial nodes.
   - **G12 Performance & Accessibility**: Draw calls <= 150, memory disposal verification, subtitle font sizing.
   - **G13 Showcase & Production Build**: Production bundle optimization and `/making-of` integration.
```
