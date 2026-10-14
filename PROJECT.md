# Project: Alice's Adventures in Wonderland - Chapter 1: Down the Rabbit-Hole

## Architecture
- **Rendering & Display**: Dual backend WebGPU (`WebGPURenderer`) with automatic WebGL2 fallback (`?forceWebGL=1`) via Three.js node materials / custom shaders (3-tone toon ramp, `#2B2420` ink outline, 15% screen-space paper grain overlay, refractive glass table material).
- **Physics & Player Controller**: `@dimforge/rapier3d-compat` running fixed 60Hz step. KinematicCharacterController with dual scale capsules (Normal: H=1.20m, R=0.25m; Small: H=0.254m, R=0.06m). Spring-arm collision camera with spherical sweep against level colliders.
- **Game State & Scene Management**: S0 through S7 state machine with deterministic event dispatch, flags dictionary, inventory manager (6 slots with 3D rotatable inspector), and cutscene timeline player (C1-C8 JSON format).
- **UI & Presentation**: Vanilla HTML/CSS responsive overlay styled as an authentic Victorian picture book. SIL OFL typography (Noto Serif SC, LXGW WenKai, IM Fell English, Zen Old Mincho).
- **Audio Engine**: Zero-dependency Web Audio API procedural synthesis engine generating M1-M7 music loops and 30 SFX procedurally (with spatial PositionalAudio and pitch modulation on size scaling).
- **Asset Pipeline**: Blender 5.2 headless automation scripts (`tools/blender/build_ch1_architecture.py`) generating metric-accurate greybox environments with exact logic markers (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `PATH_`, `COL_`, `SLOT_`, `LAMP_`, `VISTA_ANCHOR`) exported to `public/assets/models/ch1_greybox.glb`.
- **Testing & Quality Assurance**: Dual track opaque-box E2E testing framework, `?test=1` test harness exposing `window.__game`, and automated Playwright smoke tests (`npm run test:e2e`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Workspace Scaffolding | Vite, TypeScript (strict), package.json, tsconfig.json, CSS | M1 | explorer_1 |
| 2 | Project Bible & Guidelines | CLAUDE.md, docs/bible.md, docs/ch1-design.md, docs/prompts/<track>/ | M1 | spec_miner_1 |
| 3 | CI Workflow | GitHub Action .github/workflows/ci.yml, build and lint checks | M1 | explorer_1 |
| 4 | Trilingual i18n Dataset | public/assets/i18n/ch1.json (Carroll 1865 verbatim en, zh <= 28 chars, ja) | M2 | spec_miner_1 |
| 5 | Curiosity Notes & Stuck Hints | 5 historical curiosity notes, 60s/120s two-tier stuck hint system | M2 | spec_miner_1 |
| 6 | Victorian UI Overlay | 12 HTML/CSS UI components, picture-book styling, dialogue, HUD | M2 | spec_miner_1 |
| 7 | Procedural Web Audio Engine | Web Audio procedural synthesis of M1-M7 music and SFX 01-30 | M2 | spec_miner_1 |
| 8 | Spatial Audio & Pitch Mod | 3D PositionalAudio nodes and size-scaling audio pitch modulation | M2 | spec_miner_1 |
| 9 | Procedural 3D Architecture | tools/blender/build_ch1_architecture.py generating S0-S7 rooms | M3 | spec_miner_2 |
| 10 | Metric Dimensions & Markers | SPAWN_, TRG_, INT_, CAM_, PATH_, COL_, SLOT_, LAMP_, VISTA_ANCHOR | M3 | spec_miner_2 |
| 11 | Interactive 3D Props | Golden Key, Drink Me bottle, Eat Me cake, Glass Table, Doors | M3 | spec_miner_2 |
| 12 | Character Models & Rigs | Alice (1.2m normal, 0.254m small), White Rabbit, animations | M3 | spec_miner_2 |
| 13 | Asset Optimization Tool | tools/optimize-assets.mjs glTF/GLB compression & validation | M3 | spec_miner_2 |
| 14 | WebGPU/WebGL2 Render Engine | Three.js renderer, dual fallback, post-processing, paper grain | M4 | explorer_1 |
| 15 | Victorian Picture-Book Shaders | 3-tone toon ramp, #2B2420 ink outline, refractive glass shader | M4 | explorer_1 |
| 16 | Rapier3d Physics Integration | Rapier physics world, kinematic player controller, dual capsule scales | M4 | explorer_1 |
| 17 | Spring-Arm Collision Camera | Third-person camera with spherical obstacle avoidance | M4 | explorer_1 |
| 18 | S0-S7 State Machine | S0 Riverbank to S7 Cake Consumption state machine & flags | M4 | explorer_1 |
| 19 | 3D Item Inspector | 3D rotatable modal inspector with 2-sided verification rule | M4 | explorer_1 |
| 20 | Cutscene Timeline Player | C1-C8 JSON cutscenes, actor animation sync, 1.0s Esc skip parity | M4 | spec_miner_1 |
| 21 | S0-S3 Exterior & Descent Gameplay| Riverbank pursuit, rabbit hole entry, 90s floating origin well fall | M5 | spec_miner_1 |
| 22 | S4-S7 Hall Puzzle Invariants | Curtain access lock, key auto-return, table glass transparency | M5 | spec_miner_2 |
| 23 | /making-of Showcase Page | devlog stats.json, Mermaid diagram, 4-stage asset comparison slider | M5 | explorer_1 |
| 24 | ?test=1 Test Harness | window.__game exposing state, warp, flags, item injection | M5 | explorer_1 |
| 25 | E2E Testing Infrastructure | Dual track test harness, TEST_INFRA.md, opaque-box test runner | E2E Track | Project Pattern |
| 26 | E2E Test Suite (Tiers 1-4) | Feature coverage, boundary, combinatorial, real-world tests | E2E Track | Project Pattern |
| 27 | Final Milestone: E2E Test Pass | 100% E2E test suite passing + Tier 5 adversarial hardening | M6 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Scaffolding, Build & Bible | Features 1, 2, 3 | none | DONE |
| M2 | Narrative, i18n, UI & Audio | Features 4, 5, 6, 7, 8 | M1 | DONE |
| M3 | 3D Assets & Blender Greybox | Features 9, 10, 11, 12, 13 | M1 | DONE |
| M4 | Core Engine, Physics & Shaders | Features 14, 15, 16, 17, 18, 19, 20 | M1 | DONE |
| M5 | Gameplay Integration & Showcase | Features 21, 22, 23, 24 | M2, M3, M4 | DONE |
| E2E | E2E Testing Track | Features 25, 26 (TEST_INFRA.md & Tiers 1-4) | M1 | DONE |
| M6 | Final Milestone: E2E Pass & Tier 5 | Feature 27 (100% E2E test pass + adversarial) | M5, E2E | DONE |

## Interface Contracts

### Game State Machine (`src/game/state/`) ↔ UI Overlay (`src/ui/`)
- `interface GameState`:
  - `state: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7'`
  - `aliceScale: 1.0 | 0.2117 | 2.417`
  - `inventory: InventoryItem[]` (max 6 items)
  - `flags: Record<string, boolean | number | string>`
- `eventBus.emit('stateChanged', { from, to })`
- `eventBus.emit('dialogueTrigger', { id, speaker, text: { en, zh, ja }, audioSfx })`
- `eventBus.emit('inspectItem', { item: InventoryItem, onVerified: () => void })`

### Engine (`src/engine/`) ↔ 3D Asset Loader (`src/world/`)
- `interface WorldScene`:
  - `root: THREE.Group`
  - `spawns: Map<string, THREE.Vector3>`
  - `triggers: Map<string, TriggerVolume>`
  - `interactives: Map<string, InteractiveObject>`
  - `colliders: Rapier.RigidBody[]`
- Level Glb must contain nodes prefixed with `SPAWN_`, `TRG_`, `INT_`, `CAM_`, `COL_`, `LAMP_`, `VISTA_ANCHOR`.

### Test Harness Contract (`src/testing/testHarness.ts`)
- `window.__game`:
  - `goto(state: string): void`
  - `setFlag(flag: string, value: any): void`
  - `getFlag(flag: string): any`
  - `addItem(itemId: string): void`
  - `setScale(scale: number): void`
  - `getState(): GameStateSnapshot`
  - `triggerInteraction(id: string): void`

## Code Layout
```
/home/administrator/Alice-s-Adventures-in-Wonderland-/
├── .agents/teamwork/             # Teamwork orchestrator & subagent metadata
├── .github/workflows/ci.yml     # Automated CI pipeline
├── CLAUDE.md                    # Project guidance & rules
├── docs/
│   ├── bible.md                 # World, characters, tone, Victorian rules
│   ├── ch1-design.md            # Detailed gameplay & puzzle spec
│   ├── devlog/stats.json        # Asset & development statistics
│   └── prompts/<track>/         # Subagent prompt packages
├── public/
│   ├── assets/
│   │   ├── i18n/ch1.json        # Trilingual dialogue, notes, stuck hints
│   │   └── models/ch1_greybox.glb # 3D procedural architecture
│   ├── fonts/                   # Noto Serif SC, IM Fell English
│   └── index.html               # Main entry HTML
├── src/
│   ├── audio/                   # Web Audio synth & spatial sound
│   ├── core/                    # Event bus, math, types, constants
│   ├── engine/                  # Renderer, loop, camera, input
│   ├── game/                    # S0-S7 state machine, player controller, cutscenes
│   ├── physics/                 # Rapier3d world & character controller
│   ├── shaders/                 # Toon ramp, ink outline, paper grain
│   ├── testing/                 # window.__game test harness
│   ├── ui/                      # Victorian HTML/CSS overlay
│   └── main.ts                  # Application bootstrap
├── tests/
│   ├── e2e/                     # Playwright E2E smoke tests
│   └── unit/                    # Vitest unit tests
├── tools/
│   ├── blender/                 # Blender Python scripts
│   └── optimize-assets.mjs      # Asset validation and compression
├── index.html                   # Game entry
├── package.json                 # Node dependencies and scripts
├── tsconfig.json                # TypeScript strict config
└── vite.config.ts               # Vite build config
```
