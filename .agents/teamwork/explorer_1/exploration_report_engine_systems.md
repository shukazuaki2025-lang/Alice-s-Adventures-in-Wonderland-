# Technical Architecture & Systems Exploration Report
## Tracks G (Gameplay & Engine), H (Rendering & Shaders), G13 (/making-of), J (Testing), and K (CI/Build)

- **Author**: Explorer 1 (`teamwork_preview_explorer`)
- **Date**: 2026-10-14
- **Working Directory**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/explorer_1`
- **Target Repository**: `/home/administrator/Alice-s-Adventures-in-Wonderland-`
- **Authoritative Specifications**:
  - `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/ORIGINAL_REQUEST.md`
  - `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`

---

## 1. Executive Summary & Existing Repository Status

### 1.1 Existing Workspace Inventory
Inspection of `/home/administrator/Alice-s-Adventures-in-Wonderland-` reveals:
- **Git Repository**: Initialized at `origin/main` (`shukazuaki2025-lang/Alice-s-Adventures-in-Wonderland-.git`).
- **Files Present**:
  - `README.md` (35 bytes minimal placeholder).
  - `PROMPTS_CHAPTER_01.md` (21 KB, an earlier dark gothic prompt draft; note: the authoritative design is defined by Carroll's 1865 text and John Tenniel illustrations specified in `ORIGINAL_REQUEST.md` and `google-doc-spec-v1.md`).
  - `docs/google-doc-spec-v1.md` (103 KB, authoritative specification for all tracks A through K).
  - `.agents/teamwork/` (orchestrator coordination, agent briefings, and original requests).
- **Files Absent**:
  - No `package.json`, `tsconfig.json`, or `vite.config.ts`.
  - No `src/` directory, engine code, or game logic.
  - No `tools/` directory (Blender generation scripts or asset optimization tools).
  - No `public/assets/` or `assets_src/` directories.
  - No test suite (`tests/` or Playwright configuration).

The entire software architecture must be scaffolded and implemented from the ground up to satisfy the authoritative specification.

### 1.2 Host & Runtime Environment Findings
- **Operating System**: Ubuntu 26.04.1 LTS (Linux kernel 6.6.87.2-microsoft-standard-WSL2 on x86_64).
- **Python**: Python 3.14.4 is installed at `/usr/bin/python3`. `uv` 0.12.13 is available at `/home/administrator/.local/bin/uv`.
- **Node.js Environment**:
  - Windows host has Node.js installed at `/mnt/c/Program Files/nodejs/node.exe`.
  - However, running Windows `.exe` directly within WSL2 bash currently blocks/hangs due to WSL binfmt configuration.
  - Native Linux Node.js (`node-v22-linux-x64` or via `nvm`/standalone tarball as seen in `/home/administrator/.npm/_logs`) must be present in `$PATH` to run `npm run dev`, `npm run build`, `npm run test`, and `npm run test:e2e`.
- **Blender Environment**:
  - Blender executable: `/mnt/d/blender.exe` (Blender 5.2).
  - Live Blender MCP server configured at `127.0.0.1:9876` (requires the Blender addon to be active for live socket queries).
  - Procedural generation scripts (`tools/blender/build_ch1_architecture.py`) can be executed headless via `/mnt/d/blender.exe --background --python <script>`.

---

## 2. Track G: Gameplay Systems & Engine Architecture

### 2.1 Core Technology Stack & Configuration
- **Build Tool**: Vite 6.x with `@vitejs/plugin-basic-ssl` (for HTTPS local development needed by WebGPU).
- **Language**: TypeScript 5.8+ with `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `moduleResolution: Bundler`.
- **3D Engine**: Three.js (`three` r170+) with dual backend support:
  - `WebGPURenderer` imported from `three/webgpu`
  - TSL (Three Shading Language) imported from `three/tsl`
  - Automatic fallback to WebGL2 if WebGPU adapter is unavailable
  - Query parameter override: `?forceWebGL=1` forces WebGL2 backend immediately
- **Physics Engine**: `@dimforge/rapier3d-compat` (WASM-based Rapier3D):
  - Kinematic character controller (`KinematicCharacterController`) for player collision and step handling.
  - World colliders: Cuboid for bounding boxes, Trimesh for static complex geometry.
  - Meshes prefixed with `COL_` or having `userData.collider === true` are automatically registered as static colliders and hidden from rendering.
- **Validation**: `zod` for parsing and validating dialogues, save games, cutscene timelines, and level manifests.
- **Debug / Diagnostics**: `lil-gui` for live tuning, `stats-gl` for frame time and memory profiling, custom console opened with backtick (`` ` ``).

### 2.2 Global State Machine & Scene Flow (G2)
The game is structured as an explicit state machine with the following states:
```
S0_TITLE -> S1_BANK -> S2_CHASE -> S3_FALL -> S4_PASSAGE -> S5_HALL -> S6_SMALL -> S7_CAKE -> END
```
- **Scene Partitioning**:
  - `S1_BANK` and `S2_CHASE` share the same bank scene (`s1_bank.ts`).
  - `S3_FALL` runs in an isolated procedural floating-origin well (`s3_fall.ts`).
  - `S4_PASSAGE` runs in the corridor scene (`s4_passage.ts`).
  - `S5_HALL`, `S6_SMALL`, and `S7_CAKE` share the Long Hall scene (`s5_hall.ts`), switching internal logic states without unloading or reloading geometry.
- **Transitions**: 0.6s black screen fade (`fade.ts`). Transition from S4 to S5 is seamless using corner occlusion (S5 assets preloaded in background during S3).
- **Memory Lifecycle**:
  - `SceneManager` explicitly calls `.dispose()` on geometries, materials, and textures when unloading scenes.
  - Monitored via `renderer.info.memory.geometries` and `renderer.info.memory.textures` to guarantee no memory leaks across scene loops.
- **Save / Continue (`alice.save.v1`)**:
  - Stored in `localStorage` under key `alice.save.v1`.
  - Auto-saved at the start of each scene.
  - Safe parsing via Zod with fallback if corrupted.
  - "Continue" button appears on Title screen when a valid save exists.

### 2.3 Player Controller & Camera Rig (G3)
- **Controller**:
  - Rapier `KinematicCharacterController` with capsule collider.
  - Slope climbing and step offsets:
    - **Normal mode (1.20 m)**: Capsule radius `0.18 m`, height `1.20 m`, walk speed `1.4 m/s`, run speed `3.0 m/s`, max step height `0.25 m`.
    - **Small mode (0.254 m)**: Capsule radius `0.04 m`, height `0.254 m`, walk speed `0.5 m/s`, run speed `1.1 m/s`, max step height `0.05 m`.
- **Input System (`Input.ts`)**:
  - Multi-input abstraction mapping raw inputs to logical game actions: `move` (Vector2), `look` (Vector2), `run` (bool), `interact` (bool), `inventory` (bool), `pause` (bool), `curtsey` (bool).
  - Hardware support: Keyboard & Mouse (WASD + Shift + Mouse + E + Tab + Esc + C), Gamepad (dual sticks + A/X), Touch screen (left virtual joystick + right swipe camera + touch action buttons).
- **Camera Rig (`CameraRig.ts`)**:
  - Third-person spring-arm with spherical coordinates (distance, azimuth, elevation).
  - Raycast wall collision detection against world geometry to prevent clipping.
  - Parameter profiles:
    - **Normal**: distance `3.2 m`, height `1.4 m`, FOV `55°`.
    - **Small**: distance `0.8 m`, height `0.3 m`, FOV `65°`.
  - Script takeover: Smoothly transitions (minimum 0.3s slerp) to predefined `CAM_` anchors during cutscenes and interactions.
  - S1 "Afternoon Drowsiness" effect: walk speed multiplied by `0.85x`, subtle breathing camera sway (disabled when "Reduce Motion" setting is on).

### 2.4 Interaction & Stuck Hint System (G4)
- **Target Detection**:
  - Scans objects prefixed with `INT_` or containing `userData.interactable`.
  - Selection criteria: Distance ≤ `1.2 m` (Normal) or ≤ `0.3 m` (Small), inside `100°` forward horizontal cone of Alice, closest to screen center.
  - Displays Victorian book-styled prompt with icon and i18n text.
- **Interaction Types**:
  - `pickup`: Adds item to inventory (e.g. daisy, key).
  - `inspect`: Opens full-screen 3D inspect overlay.
  - `door`: Triggers door rattling or opening.
  - `use`: Uses active inventory item on target.
  - `trigger`: Initiates cutscene.
- **Stuck Hints (`StuckHintSystem.ts`)**:
  - Monitors player objective progress in each scene.
  - If player remains on current objective for > 60s, triggers Hint Line 1 (subtle thought).
  - If player remains stuck for > 120s, triggers Hint Line 2 (direct guidance).

### 2.5 Inventory & 3D Inspect System (G4)
- **Inventory (`Inventory.ts`)**:
  - 6 item slots.
  - Items in Chapter 1: Daisies (`item_daisies`), Marmalade Jar (`item_jar`), Golden Key (`item_key_gold`), DRINK ME Bottle (`item_bottle`), EAT ME Cake (`item_cake`).
  - Item selection and contextual use on world targets.
- **3D Inspect Modal (`InspectUI.ts`)**:
  - Renders inspected item in an isolated 3D viewport with touch/mouse rotation and zoom.
  - **Critical Puzzle Mechanism**: Inspecting `prop_bottle_drinkme` requires the player to rotate both the front label ("DRINK ME") and the back side (confirming there is no "POISON" label) past the camera before the "Drink" action button unlocks.

### 2.6 Size Scaling System (G7)
- **Scale Configurations**:
  - `normal`: Scale `1.0x` (Alice height `1.20 m`).
  - `small`: Scale `0.212x` (Alice height `0.254 m` / 10 inches).
  - `large`: Reserved interface for Chapter 2 (`2.417x` / `2.90 m`).
- **Transition Dynamics**:
  - 2.5-second smooth interpolation (cubic ease-in-out).
  - Interpolates: mesh scale, camera distance/height/FOV, movement speed.
  - Collider is rebuilt upon transition completion.
  - Ceiling clearance raycast check (prevents growing into obstacles).
- **Sensory Effects**:
  - Visual: Ring vignette shrinking effect mimicking telescope collapse (`TelescopeVignettePass`), radial blur.
  - Audio: Footstep and voice sound pitch shifted by `1.6x` when small; ambient audio low-pass filtered.
  - Held items dynamically scale with Alice.

### 2.7 Scene Mechanics: S3 Well Fall & S5-S7 Hall Puzzles (G6, G8)
- **S3 Rabbit-Hole Fall (`s3_fall.ts`)**:
  - **Floating Origin System**: Alice remains near world origin `(0, 0, 0)` while the well moves upwards at a constant fall speed of `2.2 m/s` (total fall duration ~90s).
  - **12-Segment Recycling Pool**: Reusable cylindrical well segments (`ch1_well_segment`, 4m inner diameter, 3m height) recycle from top to bottom.
  - **Procedural Props**: Slots populate cupboards, bookshelves (InstancedMesh books), maps, framed pictures, and candles (max 4 active dynamic lights; emissive materials + billboards).
  - **Horizontal Motion**: Alice can glide within a `1.4 m` radius with inertia.
  - **Timeline Script**:
    - `05s`: Narrator "Either the well was very deep...".
    - `15s`: Glowing marmalade jar shelf. Pick up empty jar (`S3_JAR_PICK`). Attempting to drop triggers "I mustn't drop it...".
    - `25s - 65s`: Open cupboards appear every ~8s. Placing the jar stores it safely (`S3_JAR_STORED`).
    - `10s, 30s, 45s, 58s, 70s`: 5 glowing Thought Bubbles spawn. Touching triggers `S3_THOUGHT_1` to `5`. Missed bubbles respawn within 10s.
    - During Thought 4: Pressing `C` triggers mid-air curtsey (`Alice_CurtseyAir`) and secret narrative callback (`curtsey: true`).
    - `75s`: Drowsiness begins. Soft focus, desaturation, semi-transparent Dinah cat ghost silhouette fades in.
    - `88s`: Hard cut to black, "THUMP! THUMP!" sound and subtitle, landing on leaves pile (`S4`).
- **S5-S7 Hall Puzzles (`s5_hall.ts`)**:
  - **Doors & Key Invariant**:
    - 10 locked hall doors. Rattling increment `doorsTried`. When `doorsTried >= 4`, triggers "How am I ever to get out?".
    - Pick up Golden Key from glass table (`keyTaken: true`).
    - Using key on large doors fails (`keyTriesOnDoors++`).
    - **Curtain Lock Invariant**: `INT_curtain` is completely unselectable and non-interactive until `keyTriesOnDoors >= 2`.
  - **Little Door & Garden Peek**:
    - Opening curtain reveals little door (`0.24 m x 0.381 m`).
    - Unlocking little door triggers cutscene `C5` (`Alice_KneelPeek`): camera glides along miniature passage to reveal sunny high-saturation garden vista (`ch1_garden_vista`).
    - Little door automatically shuts and locks (`peekDone: true`).
  - **Key Return Invariant**:
    - Upon `peekDone`, DRINK ME bottle appears on the glass table.
    - Picking up bottle automatically places the golden key back onto the glass table with a quiet clink (`sfx_key_down`).
  - **Shrinking & Slippery Leg**:
    - Drinking bottle shrinks Alice to `0.254 m`.
    - Approaching little door prompts "The key! I've left it on the table!".
    - Looking up from under the table reveals the key clearly through the transparent glass tabletop.
    - Interacting with table leg triggers climb attempt (`Alice_ClimbSlip`, `climbAttempts++`).
    - Second attempt triggers cutscene `C7` (`Alice_SitCry`): Alice scolds herself, camera pans to reveal glass box under table.
  - **EAT ME Cake & Ending**:
    - Opening glass box reveals cake with currant lettering "EAT ME".
    - Eating cake triggers cutscene `C8` ("Which way?"), screen fades to Chapter 1 End Card with curiosity statistics and Chapter 2 preview.

### 2.8 Cutscene Playback Engine (G10)
- **JSON Timeline Schema**: Cutscenes `C1` through `C8` stored in `public/assets/cutscenes/ch1/*.json`:
  - `tracks`:
    - `camera`: Waypoint path, lookAt target, FOV interpolation.
    - `anim`: Character clip playback, blending, looping.
    - `line`: Dialogue trigger ID dispatch.
    - `sfx`: Audio effect playback.
    - `fade`: Screen fade in/out durations.
    - `letterbox`: Cinematic black bars animation.
    - `wait`: Timeline pauses.
- **Skip Guarantees**:
  - Long-pressing `Esc` or clicking UI "Skip" for 1.0s skips any cutscene.
  - **Invariant**: Skipping a cutscene immediately applies the exact terminal state flags, character positions, and inventory changes that would have resulted from watching to completion.

---

## 3. Track H: Rendering, Shaders & UI Architecture

### 3.1 "Moving Victorian Picture-Book" Art Direction (G9)
- **Toon Shading**:
  - 3-tone discrete stepped ramp (Highlight, Midtone, Shadow).
  - Warm purple shadow tint (`#3D2A45`) rather than harsh black, evoking Victorian ink washes.
- **Contour Outlines**:
  - Characters and props: Inverted hull back-face vertex extrusion with `#2B2420` ink color; stroke width scales inversely with camera distance.
  - Environment: Screen-space depth/normal edge detection pass (toggleable in quality settings).
- **Paper Grain Overlay**:
  - Screen-space tileable paper texture at `15%` opacity, overlaid additively/multiply in screen coordinates to simulate aged parchment.
- **Glass Shaders (`materials/GlassMaterial.ts`)**:
  - Custom refractive glass material for table, bottle, and cake box.
  - Base opacity `0.25`, strong Fresnel rim brightening, and screen-space refraction distortion (gracefully simplified in WebGL2 fallback).
  - Transparent sorting priority ensures the gold key is sharp and distinct when viewed from below the table.
- **Quality Presets**:
  - `High`: Full screen-space outlines, 2048 shadow maps, pixel ratio up to 2.0, multi-pass bloom for chandelier & garden vista.
  - `Medium`: Mesh-only outlines, 1024 shadow maps, pixel ratio 1.5.
  - `Low`: Simple paper grain and vignette, 512 shadow maps, pixel ratio 1.0.

### 3.2 HTML/CSS Book-Page UI System (H1–H3)
- **Aesthetic**: Aged Victorian paper strips with ragged edges, ink-wash borders, and gold leaf accents (`#2B2420` ink, `#F3E9D2` paper, `#D4A93A` gold).
- **Typography (SIL OFL Open Source)**:
  - English: `IM Fell English`
  - Chinese Body: `Source Han Serif` (思源宋体)
  - Chinese Inner Monologue: `LXGW WenKai` (霞鹜文楷)
  - Japanese (pre-configured): `Zen Old Mincho`
  - Subset generation script (`tools/subset-fonts.mjs`) keeps font payload < 1.5 MB.
- **12 Managed UI Modules**:
  1. `Title`: Full-screen key art, title, language toggle, "Click to Begin", "Continue" button.
  2. `Loading`: Victorian percentage dial / progress text.
  3. `Subtitle`: Book-page paper strip banner with typewriter effect (zh 30 char/s, en 45 char/s), speaker badges.
  4. `InteractPrompt`: Contextual button icon + action verb.
  5. `Objective`: Subtle header displaying current quest note.
  6. `Inventory`: 6-slot parchment ribbon overlay.
  7. `Inspect`: Isolated 3D inspection modal.
  8. `Pause`: Esc menu with Resume, Settings, Return to Title.
  9. `Settings`: Audio sliders (Master, Music, SFX, Voice), Subtitle Size (Small, Med, Large), Invert Y, Reduce Motion, Quality.
  10. `ChapterCard`: Chapter I opening card with page-flip animation.
  11. `EndCard`: Chapter I completion stats (thoughts collected, curtsey discovered, Chapter 2 preview).
  12. `Unsupported`: Clean error fallback for legacy non-WebGL2 browsers with desktop client instructions.

---

## 4. Track G13: /making-of Showcase & /viewer.html

### 4.1 /making-of Showcase Page
- **Purpose**: Interactive presentation highlighting the end-to-end AI toolchain and development pipeline.
- **Key Components**:
  1. **Toolchain Flow Diagram**: Mermaid SVG diagram illustrating: Claude (Story & Design) → Image Gen (Concept Art) → Tripo (3D Generation & Rigging) → Blender MCP (Architecture & Assembly) → Claude Code / Teamwork (Engine & Shaders) → Web/Desktop Deploy.
  2. **Interactive Asset Stage Comparison Slider**: 4-stage comparison cards (Concept Art → Tripo Raw → Blender Cleaned → In-Game Render) with split-view drag slider.
  3. **Live Metrics Dashboard**: Real data pulled from `docs/devlog/stats.json`: total prompts, asset count, lines of code, and development timeline.
  4. **Prompt Archive Viewer**: Expandable cards displaying exact prompts from `docs/prompts/`.
  5. **Bilingual UI**: Full EN / ZH toggle matching the main game design.

### 4.2 /viewer.html Model & Animation Viewer
- Standalone Three.js tool allowing instant inspection of any `.glb` in `public/assets/`:
  - Wireframe, unlit, and toon shading modes.
  - Bone hierarchy & skinning display.
  - Dropdown to select and play all embedded animation clips (`Alice_Idle`, `Alice_Walk`, `Rabbit_CheckWatch`, etc.) with speed and loop toggles.

---

## 5. Track J: Testing, Verification & ?test=1 Test Mode

### 5.1 Test Mode (`?test=1`) & `window.__game` Test Harness
When launched with `?test=1`:
- Randomness is seeded and deterministic.
- Cutscene auto-skip option enabled.
- Animation speed boosted to `4.0x`.
- `window.__game` interface exposed to the global scope:
  ```typescript
  interface GameTestHarness {
    goto(state: SceneState, checkpoint?: string): Promise<void>;
    flag(name: keyof GameFlags, value: any): void;
    getFlag<K extends keyof GameFlags>(name: K): GameFlags[K];
    interact(targetName: string): Promise<boolean>;
    getState(): {
      state: SceneState;
      flags: GameFlags;
      playerPos: [number, number, number];
      aliceScale: number;
      inventory: string[];
      cameraPos: [number, number, number];
    };
    inspectEntity(name: string): any;
  }
  ```

### 5.2 Playwright Automated E2E Smoke Tests (`npm run test:e2e`)
- Headless Chromium browser automation running `?forceWebGL=1&test=1`.
- Step-by-step playthrough test:
  1. `S0_TITLE`: Loads title, clicks start, awaits S1.
  2. `S1_BANK`: Inspects sister's book, picks daisies 1 & 2, triggers rabbit cutscene C1.
  3. `S2_CHASE`: Follows rabbit path to burrow, triggers jump cutscene C2.
  4. `S3_FALL`: Simulates fall, collects thought bubbles, picks marmalade jar, stores in cupboard, performs curtsey, triggers C3 landing.
  5. `S4_PASSAGE`: Runs to corner, catches rabbit dialogue, transitions into S5.
  6. `S5_HALL`: Tries doors, grabs key, attempts door unlock (proves curtain locked), tries door again, unlocks curtain, unlocks little door, inspects garden vista.
  7. `S6_SMALL`: Picks bottle (asserts key auto-returned to table), inspects bottle labels front and back, drinks, shrinks to 0.254m, verifies little door cannot be unlocked without key, attempts table leg climb twice, triggers crying cutscene C7.
  8. `S7_CAKE`: Opens glass box, eats cake, triggers C8, reaches Chapter End Card.
- **Assertion of Invariants**:
  - Curtain cannot be interacted with when `keyTriesOnDoors < 2`.
  - Picking up the bottle places the golden key on the glass table.
  - Shrinking sets Alice's scale to `0.212` (`0.254 m`).
  - Skipping cutscenes results in the identical final state flags.
- **Visual Artifacts**:
  - Automated screenshots taken at each scene transition (`S0` through `S7`), `/viewer.html`, and `/making-of`, saved to `docs/devlog/screens/e2e/`.

---

## 6. Track K: Build, CI & Deployment

### 6.1 Package Scripts Specification (`package.json`)
```json
{
  "name": "alice-down-the-rabbit-hole",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/ --ext .ts",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "assets": "node tools/optimize-assets.mjs",
    "fonts": "node tools/subset-fonts.mjs"
  }
}
```

### 6.2 CI Workflow (`.github/workflows/ci.yml`)
1. Checkout repository.
2. Setup Node.js (v22).
3. Install dependencies (`npm ci`).
4. Run `npm run typecheck` (`tsc --noEmit` with `strict: true`).
5. Run `npm run test` (Vitest unit tests including Zod schema validation of `ch1.json`).
6. Run `npm run build` (production Vite build with asset hashes).
7. Run `npm run test:e2e` (Playwright E2E smoke tests on Chromium with WebGL2 fallback).

---

## 7. File Tree & Module Architecture

### 7.1 Complete Project File Layout (Target State)
```
/home/administrator/Alice-s-Adventures-in-Wonderland-/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
├── index.html
├── viewer.html
├── making-of.html
├── CLAUDE.md
├── README.md
├── LICENSE
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── bible.md
│   ├── ch1-design.md
│   ├── google-doc-spec-v1.md
│   ├── assets-licenses.md
│   ├── devlog/
│   │   ├── stats.json
│   │   └── screens/
│   ├── perf/
│   │   └── ch1.md
│   ├── tests/
│   │   └── ch1-interactions.md
│   └── prompts/
├── tools/
│   ├── blender/
│   │   └── build_ch1_architecture.py
│   ├── optimize-assets.mjs
│   └── subset-fonts.mjs
├── public/
│   ├── favicon.ico
│   └── assets/
│       ├── i18n/
│       │   ├── ch1.json
│       │   └── ch1_notes.json
│       ├── cutscenes/
│       │   └── ch1/
│       │       ├── c1_rabbit_run.json
│       │       ├── c2_burrow_jump.json
│       │       ├── c3_well_landing.json
│       │       ├── c4_passage_hall.json
│       │       ├── c5_garden_peek.json
│       │       ├── c6_shrink_drink.json
│       │       ├── c7_cry_box.json
│       │       └── c8_cake_end.json
│       ├── audio/
│       │   ├── music.json
│       │   └── tracks/
│       ├── fonts/
│       ├── scenes/
│       ├── characters/
│       └── props/
├── src/
│   ├── main.ts
│   ├── core/
│   │   ├── Game.ts
│   │   ├── Loop.ts
│   │   ├── Time.ts
│   │   ├── Input.ts
│   │   └── Events.ts
│   ├── render/
│   │   ├── Renderer.ts
│   │   ├── PostFX.ts
│   │   └── materials/
│   │       ├── ToonMaterial.ts
│   │       ├── GlassMaterial.ts
│   │       └── OutlineMaterial.ts
│   ├── world/
│   │   ├── SceneManager.ts
│   │   ├── LevelLoader.ts
│   │   ├── Physics.ts
│   │   └── AssetManager.ts
│   ├── gameplay/
│   │   ├── PlayerController.ts
│   │   ├── CameraRig.ts
│   │   ├── InteractionManager.ts
│   │   ├── Inventory.ts
│   │   ├── SizeSystem.ts
│   │   ├── Flags.ts
│   │   └── StuckHintSystem.ts
│   ├── narrative/
│   │   ├── DialogueSystem.ts
│   │   ├── Subtitles.ts
│   │   └── i18n.ts
│   ├── cutscenes/
│   │   ├── CutsceneEngine.ts
│   │   └── CutsceneTracks.ts
│   ├── audio/
│   │   └── AudioController.ts
│   ├── scenes/
│   │   └── ch1/
│   │       ├── s0_title.ts
│   │       ├── s1_bank.ts
│   │       ├── s2_chase.ts
│   │       ├── s3_fall.ts
│   │       ├── s4_passage.ts
│   │       ├── s5_hall.ts
│   │       ├── s6_small.ts
│   │       └── s7_cake.ts
│   ├── ui/
│   │   ├── UIManager.ts
│   │   ├── TitleUI.ts
│   │   ├── LoadingUI.ts
│   │   ├── SubtitleUI.ts
│   │   ├── InteractPromptUI.ts
│   │   ├── ObjectiveUI.ts
│   │   ├── InventoryUI.ts
│   │   ├── InspectUI.ts
│   │   ├── PauseUI.ts
│   │   ├── SettingsUI.ts
│   │   ├── ChapterCardUI.ts
│   │   ├── EndCardUI.ts
│   │   └── UnsupportedUI.ts
│   └── test/
│       └── TestHarness.ts
└── tests/
    ├── unit/
    │   ├── i18n.test.ts
    │   ├── flags.test.ts
    │   └── size_system.test.ts
    └── e2e/
        └── ch1_playthrough.spec.ts
```

---

## 8. Precise TypeScript Module Interfaces

### 8.1 Flags & State Types (`src/gameplay/Flags.ts`)
```typescript
import { z } from 'zod';

export type SceneState =
  | 'S0_TITLE'
  | 'S1_BANK'
  | 'S2_CHASE'
  | 'S3_FALL'
  | 'S4_PASSAGE'
  | 'S5_HALL'
  | 'S6_SMALL'
  | 'S7_CAKE'
  | 'END';

export interface GameFlags {
  daisiesPicked: number;      // 0..3
  rabbitSeen: boolean;
  jarTaken: boolean;
  jarStored: boolean;
  thoughts: [boolean, boolean, boolean, boolean, boolean];
  curtsey: boolean;
  doorsTried: number;
  keyTaken: boolean;
  keyTriesOnDoors: number;
  curtainFound: boolean;
  littleDoorOpened: boolean;
  peekDone: boolean;
  bottleInspected: boolean;
  drank: boolean;
  climbAttempts: number;
  boxOpened: boolean;
  ate: boolean;
}

export const GameSaveSchema = z.object({
  version: z.literal(1),
  timestamp: z.number(),
  scene: z.enum([
    'S0_TITLE', 'S1_BANK', 'S2_CHASE', 'S3_FALL',
    'S4_PASSAGE', 'S5_HALL', 'S6_SMALL', 'S7_CAKE', 'END'
  ]),
  flags: z.object({
    daisiesPicked: z.number().int().min(0).max(3),
    rabbitSeen: z.boolean(),
    jarTaken: z.boolean(),
    jarStored: z.boolean(),
    thoughts: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
    curtsey: z.boolean(),
    doorsTried: z.number().int().min(0),
    keyTaken: z.boolean(),
    keyTriesOnDoors: z.number().int().min(0),
    curtainFound: z.boolean(),
    littleDoorOpened: z.boolean(),
    peekDone: z.boolean(),
    bottleInspected: z.boolean(),
    drank: z.boolean(),
    climbAttempts: z.number().int().min(0),
    boxOpened: z.boolean(),
    ate: z.boolean(),
  }),
  inventory: z.array(z.string()),
  language: z.enum(['zh', 'en', 'ja'])
});

export type GameSave = z.infer<typeof GameSaveSchema>;
```

### 8.2 Dialogue & Subtitle Schema (`src/narrative/i18n.ts`)
```typescript
import { z } from 'zod';

export const DialogueLineSchema = z.object({
  id: z.string(),
  scene: z.string(),
  trigger: z.string(),
  speaker: z.enum(['alice', 'rabbit', 'sister', 'narrator', 'system']),
  type: z.enum(['say', 'think', 'narr', 'sfx', 'ui']),
  zh: z.string().max(28, { message: 'Chinese subtitle lines must be <= 28 characters' }),
  en: z.string().min(1),
  ja: z.string().default(''),
  dur: z.number().min(1.5),
  note: z.string().optional()
});

export const DialogueManifestSchema = z.object({
  chapter: z.literal('ch1'),
  lines: z.array(DialogueLineSchema)
});

export type DialogueLine = z.infer<typeof DialogueLineSchema>;
export type DialogueManifest = z.infer<typeof DialogueManifestSchema>;
```

### 8.3 SizeSystem Specification (`src/gameplay/SizeSystem.ts`)
```typescript
export type SizeMode = 'normal' | 'small' | 'large';

export interface SizeConfig {
  height: number;
  capsuleRadius: number;
  walkSpeed: number;
  runSpeed: number;
  maxStepHeight: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraFOV: number;
  audioPitch: number;
}

export const SIZE_PRESETS: Record<SizeMode, SizeConfig> = {
  normal: {
    height: 1.20,
    capsuleRadius: 0.18,
    walkSpeed: 1.4,
    runSpeed: 3.0,
    maxStepHeight: 0.25,
    cameraDistance: 3.2,
    cameraHeight: 1.4,
    cameraFOV: 55,
    audioPitch: 1.0,
  },
  small: {
    height: 0.254,
    capsuleRadius: 0.04,
    walkSpeed: 0.5,
    runSpeed: 1.1,
    maxStepHeight: 0.05,
    cameraDistance: 0.8,
    cameraHeight: 0.3,
    cameraFOV: 65,
    audioPitch: 1.6,
  },
  large: {
    height: 2.90,
    capsuleRadius: 0.40,
    walkSpeed: 2.0,
    runSpeed: 4.5,
    maxStepHeight: 0.60,
    cameraDistance: 6.0,
    cameraHeight: 3.2,
    cameraFOV: 50,
    audioPitch: 0.7,
  }
};
```

### 8.4 Cutscene Timeline Schema (`src/cutscenes/CutsceneEngine.ts`)
```typescript
export interface CutsceneTrack {
  type: 'camera' | 'anim' | 'line' | 'sfx' | 'fade' | 'letterbox' | 'wait';
  time: number;
  duration?: number;
  params: Record<string, any>;
}

export interface CutsceneDefinition {
  id: string;
  duration: number;
  tracks: CutsceneTrack[];
  endState: {
    flags?: Partial<GameFlags>;
    playerPosition?: [number, number, number];
    playerRotationY?: number;
    sizeMode?: SizeMode;
    inventoryAdd?: string[];
    inventoryRemove?: string[];
  };
}
```

---

## 9. Conclusion & Implementation Recommendations

1. **Clean Foundation First**: Prioritize scaffolding `package.json`, `tsconfig.json`, `vite.config.ts`, and core entry points so TypeScript validation (`npm run typecheck`) and unit tests (`npm run test`) can run immediately.
2. **Decouple Logic from 3D Assets**: Implement the greybox meshes / geometric primitives alongside the state machine so the full game flow (S0 through S7) is playable immediately without waiting for final textured assets.
3. **Rigorous Invariant Verification**: Ensure test mode (`?test=1`) and Playwright E2E smoke tests are wired early to continuously verify the key puzzle invariants (curtain access lock, golden key auto-return, size scaling, and cutscene skip parity).
