# Chapter 1 Audit Remediation Log (`2026-10-14`)

This document records the remediation of all findings from [`docs/review/2026-10-14-audit.md`](./2026-10-14-audit.md) across Work Packages `WP-1` through `WP-9` defined in [`docs/review/ANTIGRAVITY_TASK.md`](./ANTIGRAVITY_TASK.md).

---

## 1. Work Package Summary (`WP-1` – `WP-9`)

| Work Package | Scope | Key Files Modified / Created | Verification Gate | Status |
| :--- | :--- | :--- | :--- | :--- |
| **WP-1** | Rendering, Lighting, Toon Ramp (`#4A3B4E`), SkinnedMesh Ink Outlines, Offscreen Paper Grain (`#F7F3EA`), Refractive Glass (`M_Glass_Refractive`), Responsive Resize | `src/shaders/ToonShaders.ts`, `src/shaders/InkOutline.ts`, `src/shaders/PaperGrain.ts`, `src/engine/Renderer.ts`, `src/engine/SceneLighting.ts`, `tests/unit/shaders.test.mjs` | `npm run test` (`shaders.test.mjs`), E2E resize test (`T2-B04`) | **VERIFIED** |
| **WP-2** | Alice 3D Character Model (`30,840` tris, `1.20 m`, 10 meshes, 53 bones, 4 morph targets, 15 NLA animations, 2 hand sockets) & Turnarounds via Live Blender MCP | `tools/blender/build_chr_alice.py`, `public/assets/models/chr_alice.glb`, `public/assets/models/chr_alice.events.json`, `docs/art/alice/*.png`, `src/game/entities/AliceEntity.ts` | `node tools/inspect-glb.mjs`, `view_file` turnaround & viewport renders | **VERIFIED** |
| **WP-3** | White Rabbit (`34,888` tris, 11 bones, 4 animations), Sister (`17,192` tris, 4 bones, 1 animation), Dinah (`17,816` tris, 2 bones, 1 animation) & Turnarounds via Live Blender MCP | `tools/blender/build_chr_npcs.py`, `public/assets/models/chr_rabbit.glb`, `public/assets/models/chr_sister.glb`, `public/assets/models/chr_dinah_dream.glb`, `docs/art/npcs/*.png`, `src/game/entities/RabbitEntity.ts`, `src/game/entities/NpcEntities.ts` | `node tools/inspect-glb.mjs`, `view_file` turnaround renders | **VERIFIED** |
| **WP-4** | Chapter 1 Scene GLBs (`ch1_greybox.glb`, `ch1_s1_bank.glb`, `ch1_s3_well.glb`, `ch1_s4_passage.glb`, `ch1_s5_hall.glb`), 6 Sculpted Prop GLBs & `SceneLoader.ts` | `tools/blender/build_ch1_architecture.py`, `tools/inspect-glb.mjs`, `src/engine/SceneLoader.ts`, `public/assets/models/*.glb` | `node tools/inspect-glb.mjs` (all 15 GLBs pass strict geometry/rig/marker assertions) | **VERIFIED** |
| **WP-5** | Complete Playable State Chain (`S0_TITLE` → `S1_BANK` → `S2_CHASE` → `S3_FALL` → `S4_PASSAGE` → `S5_HALL` → `S6_SMALL` → `S7_CAKE` → `END`), Cutscenes `C1`–`C8` & Save/Pause | `src/game/GameManager.ts`, `src/game/StateMachine.ts`, `src/game/CutscenePlayer.ts`, `src/engine/GameLoop.ts`, `public/assets/cutscenes/ch1/C1.json..C8.json` | `tests/e2e/tier4_playthrough.spec.ts`, `tests/e2e/tier5_adversarial.spec.ts` | **VERIFIED** |
| **WP-6** | Hall & Shrinking Puzzle Invariants (`INV-01`..`INV-07`), Genuine 3D `ItemInspector` (`<= 30°` normal check), 2.5s Smooth Shrink (`1.0 -> 0.2117`) | `src/game/PuzzleManager.ts`, `src/game/ItemInspector.ts`, `src/physics/CharacterController.ts` | `tests/e2e/tier2_boundaries.spec.ts`, `tests/e2e/tier3_combinations.spec.ts` | **VERIFIED** |
| **WP-7** | Third-Person Kinematic Controller, Capsule-vs-AABB Trigger Volumes, Spring-Arm Collision Camera & 1.0s `ESC_SKIP` | `src/core/constants.ts`, `src/physics/PhysicsWorld.ts`, `src/physics/CharacterController.ts`, `src/engine/CameraRig.ts`, `src/engine/InputManager.ts` | `tests/unit/m4_engine.test.mjs`, E2E playthrough | **VERIFIED** |
| **WP-8** | Complete Localization (`zh`/`en`/`ja`), Offline OFL Fonts (`public/assets/fonts/`), Bespoke SVG Inventory Icons, Carroll Fidelity & Gesture-Gated Web Audio | `public/assets/i18n/ch1.json`, `public/assets/i18n/ch1_notes.json`, `src/ui/UIManager.ts`, `src/ui/i18n.ts`, `src/audio/AudioManager.ts`, `tools/check-carroll-fidelity.mjs` | `node tools/check-carroll-fidelity.mjs`, `tests/e2e/tier1_features.spec.ts` | **VERIFIED** |
| **WP-9** | Real ESLint & Unit Tests, Read-Only `?test=1` Harness, Genuine Input E2E Playthrough, Unique Pixel-Verified Screenshots & Repo Hygiene | `eslint.config.mjs`, `src/testing/testHarness.ts`, `tests/unit/*.test.mjs`, `tests/e2e/*.spec.ts`, `docs/devlog/screens/e2e/*.png` | `npm run lint`, `npm run test`, `npx playwright test` (21/21 pass) | **VERIFIED** |

---

## 2. Detailed Audit ID Mapping (`A-01` – `G-04`)

### Section A — Visual & 3D Asset Quality
- **`A-01` (Alice 3D Model Quality)**: Rebuilt `public/assets/models/chr_alice.glb` via `tools/blender/build_chr_alice.py` and live Blender 5.2 MCP (`30,840` triangles, exact `1.20 m` height, 10 named mesh parts, 53 bones, 4 facial shape keys `Neutral`/`Surprised`/`Crying`/`Smile`, 2 hand sockets `SOCKET_HandR`/`SOCKET_HandL`, and all 15 skeletal NLA animations). Rendered `1600×1600` turnarounds in `docs/art/alice/`.
- **`A-02` (NPC & Prop 3D Models)**: Rebuilt `chr_rabbit.glb` (`34,888` tris, 11 bones, 4 animations), `chr_sister.glb` (`17,192` tris, 4 bones, `Sister_ReadIdle`), `chr_dinah_dream.glb` (`17,816` tris, 2 bones, `Dinah_Float`), and all 6 standalone prop GLBs (`prop_key_gold.glb`, `prop_bottle_drinkme.glb` with `Front_Label` & `Back_Label`, `prop_cake_eatme.glb`, `prop_jar_marmalade.glb`, `prop_box_glass.glb`, `prop_watch.glb`).
- **`A-03` (Scene Lighting & Per-State Atmosphere)**: Added `SceneLightingManager` (`src/engine/SceneLighting.ts`) and per-state directional, hemisphere, ambient, and chandelier point lighting so `ToonShaders` and `MeshStandardMaterial` render with warm picture-book lighting instead of silhouette-black meshes.
- **`A-04` (3-Band Toon Ramp `#4A3B4E` & Refractive Glass)**: Updated `src/shaders/ToonShaders.ts` to use warm purple shadow tone `#4A3B4E` (`74, 59, 78, 255`), cached the gradient `DataTexture`, and added `createRefractiveGlassMaterial()` (`transmission: 0.92`, `ior: 1.52`) so the gold key remains clearly visible through the glass table from underneath (`0.254 m` eye height).
- **`A-05` (Ink Outline Support for `SkinnedMesh` & Morph Targets)**: Updated `src/shaders/InkOutline.ts` to instantiate `THREE.SkinnedMesh` outlines bound to the character's `skeleton` and `morphTargetInfluences` while skipping transparent/glass materials.
- **`A-06` (Screen-Space Paper Grain Post-Processing)**: Updated `src/engine/Renderer.ts` and `src/shaders/PaperGrain.ts` to render the 3D scene into an offscreen `WebGLRenderTarget` and composite through `PaperGrainShader` (`#F7F3EA`, 15% intensity, telescope vignette, and scene color grade).
- **`A-07` (`export_extras=True` for Blender 5.2 glTF Exporter)**: Replaced invalid `export_custom_props=True` with `export_extras=True` across all Blender scripts (`build_ch1_architecture.py`, `build_chr_alice.py`, `build_chr_npcs.py`).

### Section B — Gameplay, State Machine & Puzzle Progression
- **`B-01` (Title Screen Start / Continue Journey Flow)**: Wired `startJourney` and `continueJourney` in `GameManager.ts` and `StateMachine.ts` so the game starts cleanly on `S0_TITLE` and restores saved state only when `#btn-continue-journey` is clicked.
- **`B-02` & `B-03` (3D Scene Loading, Colliders & Spatial Interactions)**: Updated `SceneLoader.ts` and `GameManager.ts` to load the Chapter 1 GLB geometry, register static colliders in `PhysicsWorld`, and perform spatial distance checks against `INT_*` markers with localized `[E]` prompts.
- **`B-04` (Cutscene Timeline Execution & 1.0s Skip Parity `INV-06`)**: Rewrote `src/game/CutscenePlayer.ts` to execute `C1.json`–`C8.json` frame-by-frame (`camera`, `animation`, `dialogue`, `audio`, `flag`, `scale`, `state`), require a 1.0s hold on `Escape` to skip, and fast-forward remaining events on skip so final state and flags match watching to completion (`INV-06`). Removed unearned flag gifting (`jarStored` is never gifted by `C3`).
- **`B-05` & `B-06` (S3 90s Well Fall, Marmalade Jar `INV-07` & Mid-Air Curtsey)**: Implemented the S3 well fall in `GameManager.ts` and `PuzzleManager.ts`, including `INT_jar_marmalade` pickup, `INV-07` drop prevention (`tryDropJar()` keeps jar and triggers `S3_JAR_DROP_TRY`), `INT_cupboard_return` storage (`jarStored=true`), 5 thought bubbles, mid-air curtsey on `C`, and Dinah lavender twilight.
- **`B-07` (Genuine 3D Bottle Inspector `INV-05`)**: Rewrote `src/game/ItemInspector.ts` with a dedicated Three.js `<canvas>` viewport inside `#ui-inspect-modal`, mouse-drag rotation, dot-product normal verification (`<= 30°`, `cos >= 0.866`) for both front (`+Z`) and back (`-Z`) labels, and `drinkButtonUnlocked` gating.
- **`B-08` (2.5s Cubic Ease-In-Out Shrinking to `0.2117`)**: Implemented 2.5s cubic ease-in-out scale transition (`1.0 -> 0.2117`, `1.20 m -> 0.254 m`) in `CharacterController.ts` with synchronized telescope vignette and camera profile transition.
- **`B-09` (Key Auto-Return on Bottle Pickup `INV-03`)**: Enforced `INV-03` in `PuzzleManager.ts` and `GameManager.ts`: picking up `drink_me_bottle` while holding `gold_key` removes the key from inventory, sets `keyOnTable=true`, restores the 3D key mesh on the glass table, and plays `sfx_key_down`.
- **`B-10` (Unified 60s / 120s Stuck-Hint Timer)**: Unified stuck-hint timing in `PuzzleManager.ts` and `UIManager.ts` (paused on `S0_TITLE` and `END`, emitting Tier 1 at 60s and Tier 2 at 120s).
- **`B-11` (Zod Save Schema Validation & Boundary-Only Saves)**: Added `SaveDataSchema` validation in `StateMachine.ts` and restricted `localStorage` writes to `goto()` state transitions.
- **`B-12` (Pause Menu Freezes Simulation)**: Connected `pauseGame` and `resumeGame` events in `UIManager.ts`, `GameManager.ts`, and `GameLoop.ts` so opening `#ui-pause-menu` halts simulation updates.

### Section C — Physics, Controller & Camera
- **`C-01` (Spec-Exact Scale & Capsule Constants)**: Updated `src/core/constants.ts` (`ALICE_SCALES.SMALL = 0.2117`, normal height `1.20 m`, small height `0.254 m`).
- **`C-02` & `C-03` (Physics step `dt`, Capsule-vs-AABB Triggers & Collision Resolution)**: Updated `PhysicsWorld.ts` and `CharacterController.ts`.
- **`C-04` (Frame-Rate-Independent Camera Damping & Orbit)**: Updated `CameraRig.ts` to use `1 - Math.exp(-lambda * dt)` damping and spring-arm collision sweep.
- **`C-05` (Responsive Window Resize)**: Wired `window.addEventListener('resize', ...)` in `GameManager.ts` and `Renderer.ts` (`T2-B04` verified).

### Section D — UI, Localization, Fonts & Carroll Text Fidelity
- **`D-01` & `D-02` (100% Localized UI Strings Across `zh`/`en`/`ja`)**: Replaced all hardcoded English/Chinese strings in `UIManager.ts` and `ch1.json` with `data-ui` attributes and `getUIText()` lookups, including Title Screen, Chapter Header, Speaker Names, Item Inspector titles/descriptions, Interaction Prompts, Pause Menu, and Chapter Complete stats.
- **`D-03` (Bespoke SVG Inventory Icons & Daisy Deduplication)**: Added distinct SVG icons (`icon-daisy`, `icon-key`, `icon-bottle`, `icon-jar`, `icon-cake`, `icon-watch`) in `UIManager.ts` and deduplicated picked daisies into a single inventory slot in `PuzzleManager.ts`.
- **`D-04` (Offline OFL Fonts)**: Bundled offline fonts in `public/assets/fonts/` and replaced remote `@import` rules in `src/ui/styles/victorian.css` with local `@font-face` declarations.
- **`D-05` & `D-06` (Carroll Text Fidelity & `note` Annotations)**: Annotated non-verbatim gameplay lines with `"note": "new" | "adapted"` in `public/assets/i18n/ch1.json` and verified via `tools/check-carroll-fidelity.mjs`.

### Section E — Web Audio
- **`E-01` & `E-02` (User-Gesture AudioContext Unlock, Music `M1`–`M7` & SFX)**: Updated `src/audio/AudioManager.ts` to defer `AudioContext` creation/resume until a user gesture, switch music tracks `M1`–`M7` on `stateChanged`, duck music during dialogue, and synthesize all Chapter 1 SFX with `1.6x` pitch shift when Alice is small.

### Section F & G — Testing, Harness Security & Repository Hygiene
- **`F-01` & `F-02` (Real ESLint & Real Unit Tests)**: Configured `eslint.config.mjs` and rewrote `tests/unit/*.test.mjs` (`27/27` real unit tests importing `src/` modules + `tools/inspect-glb.mjs` + `tools/check-carroll-fidelity.mjs`).
- **`F-03` & `F-04` (Genuine Input E2E Playthrough & Unique Screenshots)**: Rewrote `tests/e2e/*.spec.ts` (`21/21` passing) using real UI clicks, keyboard movement/interaction, and simulation stepping—capturing 7 visually verified screenshots in `docs/devlog/screens/e2e/` with 7 unique MD5 hashes.
- **`F-05` (Read-Only `?test=1` Harness)**: Restricted `window.__game` (`src/testing/testHarness.ts`) to `?test=1` mode only, exposing read-only inspection and simulation acceleration helpers without state/flag mutation backdoors.
- **`G-01` – `G-04` (Repository Hygiene & Documentation)**: Removed duplicate lowercase `public/assets/cutscenes/ch1/c1.json..c8.json`, added `public/assets/i18n/ch1_notes.json`, `docs/ui/ch1-ui-spec.md`, `LICENSE`, updated `README.md` and `CLAUDE.md`, and added the audit notice to `.agents/teamwork/prompts/teamwork_preview_victory_auditor_1/handoff.md`.

---

# Round 2 — controls, locomotion, painted rebuild, and the hard quality gate (`2026-10-14`)

Reported by the user: the mouse cannot orbit/turn the camera, press-and-drag does not adjust the view, character animation is very stiff, the Blender modelling is poor.
Then: *match the Little Prince (littleprince.dev) in painting style, finish and modelling — and do not let the follow-up agent stop until it does.*
The follow-up brief is [`ROUND2_TASK.md`](./ROUND2_TASK.md); the machine-enforced stop condition is `npm run gate`.

## R2-1 Camera / mouse controls (user report #1, #2) — **VERIFIED**
Root cause: `InputManager` never handled pointer drag (only keyboard), `CameraRig` had a fixed follow offset, and movement was world-relative.
Fix: pointer-event drag-orbit (any button), wheel zoom, touch drag + pinch, `M` pointer-lock, camera-relative WASD, Shift sprint, blur clears keys
(`src/engine/InputManager.ts`, `src/engine/CameraRig.ts`, `src/engine/GameLoop.ts`, `src/physics/CharacterController.ts`).
Evidence: `tests/e2e/controls.spec.ts` CTRL-01…08 drive **real** mouse/keyboard events and read the camera/player through the read-only `?test=1` harness (8/8);
`tests/unit/controls.test.mjs` (19 unit tests).

## R2-2 Stiff animation (user report #3) — **VERIFIED (numbers) / needs a real-GPU eyeball**
Fix: exponential velocity smoothing, weight-blended Idle/Walk/Run from model-space speed with one shared gait phase, smoothed turning, lean/bank, blinking
(`src/game/entities/AliceEntity.ts`); the clips themselves were re-authored with analytic 2-bone leg IK so feet plant (`tools/blender/alice/anim.py`).
Evidence: `tools/check-alice-rig.mjs` (17 checks: amplitude floors, anti-phase legs, half-cycle gait symmetry, loop closure, 73 joints, no stacked bones).

## R2-3 Modelling (user report #4) — **PARTIAL**
Done (new loft/bmesh toolkit in `tools/blender/lib/`, generators in `tools/blender/alice/`, `tools/blender/world/`):
* Alice: 73 k tris, 73 bones, 15 clips, 6 morph targets, 12 painted textures (4.8 Mpx), 1.20 m, canonical palette. 
* Sister: seated reading pose, 44 k tris, `Sister_ReadIdle` (viewer-verified; in-game placement verified in `docs/devlog/gate/screens`).
* S1 riverbank: painted terrain/oak/hedge/rocks/rug (1.9 MB).
* Rendering: texture-preserving toon + wet-edge finish, HDR linear target + paper grain + neutral tone-map, painted sky dome, instanced wind-swept grass/flowers, pollen.

Also delivered later in the same round (all via `tools/blender/*`, painted procedural textures, no third-party assets):
* S3 well (69 k tris, 11 painted materials, 5.3 Mpx), S4 passage (37 k tris), S5–S7 hall (85 k tris, 26 painted materials, 13 Mpx) including a real Little Door →
  1.2 m passage → sunlit garden (the C5 peek now has camera work and the leaf swings open), six painted props with lettered labels.
* Engine fixes found on the way: ink-hull shader failed to compile on static meshes, double-sided materials were flattened to single-sided,
  authored emissive was dropped, transmissive glass doubled the draw calls (hall 174 → 101), favicon 404 broke the zero-console-error test,
  `screenshots.spec` needed a longer timeout (it is one long software-GL playthrough).

**Not done (this is what the gate now measures — see `ROUND2_TASK.md` §1):**
White Rabbit and Dinah are still flat-colour, every scene's *picture* metrics are still below the Little Prince bar (S1 7.8/0.53/0.195 detail/palette/contrast, S3 5.3/0.22/0.08,
S4 3.0/0.18, S5 palette 0.39, S6 6.3/0.36), the sister's skirt is a smooth dome, facial expressions are not yet wired into the cutscenes.

## R2-4 Hard quality gate — **DELIVERED**
* `tools/quality-gate.mjs` (`npm run gate`, `gate:quick`, `gate:check`), `tools/check-assets.mjs`, `tools/lib/image-metrics.mjs`, `tools/lib/board.mjs`,
  thresholds in `docs/review/gate-thresholds.json` (ratcheted against git history), benchmark numbers in `docs/art/benchmark/`.
* Honest limitation: the benchmark game never rendered past its loading screen in the headless software-GPU browser available here,
  so only its **key art** was measured; **no in-game footage of the benchmark was captured or compared** (see `docs/art/benchmark/README.md`).
* State at hand-over: `npm run gate -- --no-run` → **16 of 30 checks failing** (rabbit, Dinah, 6 scenes' picture metrics, `npc:sister`, the human verdict; the props and the three Blender environments now pass their model floors). That is intentional: it is the work list.

### Round 2 — current progress (update this block whenever you stop for any reason)
* Failing checks: run `npm run gate -- --no-run` and paste the "Failing:" line here.
* Next step: WP-A (S3 well) → WP-C (hall) → WP-B (passage) → WP-D (rabbit) → WP-E (props) → WP-F (S1 up to the bar) → WP-G.
