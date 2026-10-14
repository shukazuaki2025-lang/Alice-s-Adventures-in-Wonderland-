# E2E Test Infrastructure & Specification Document (`TEST_INFRA.md`)
## `Alice: Down the Rabbit-Hole` — Playwright Automated Opaque-Box Test Suite

---

## 1. Testing Philosophy & Opaque-Box Methodology

### 1.1 Opaque-Box Testing Philosophy
The End-to-End (E2E) testing framework for *Alice's Adventures in Wonderland — Chapter 1: Down the Rabbit-Hole* operates strictly on an **opaque-box testing paradigm**. Rather than asserting against private internal module state, the test suite interacts with the application strictly through user-observable surfaces:
1. **DOM Elements & Canvas**: HTML/CSS Victorian picture-book overlay elements, subtitle containers, inventory slot HUDs, dialog modals, canvas presence, and interactive prompts.
2. **Deterministic Test Harness (`window.__game`)**: Publicly exposed test harness available when navigating with `?test=1` (and `?forceWebGL=1`), providing controlled state transitions (`goto`), flag inspection (`getFlag`), flag overrides (`setFlag`), inventory injection (`addItem`), scale setting (`setScale`), and snapshot inspection (`getState`).
3. **Puzzle Invariants (INV-01 to INV-07)**: Authoritative behavioral contracts specified in `PROJECT.md` and `ch1-design.md`.

### 1.2 Multi-Tier Quality Architecture
The test suite is structured into four progressive quality tiers:

- **Tier 1 — Feature Coverage (Happy Path)**:
  - Validates basic operational functionality for every feature (Features 1 through 27) in the project inventory.
  - Ensures initial runtime bootstrap, WebGL rendering context initialization, state machine state registration, i18n data accessibility, audio system readiness, state persistence, and showcase/viewer page availability.

- **Tier 2 — Boundary & Corner Case Analysis**:
  - Applies **Boundary-Value Analysis (BVA)** and extreme condition testing to physical dimensions, scale limits, inventory capacity, and timing thresholds.
  - Test cases:
    - Alice Three-State Scale: Normal (`1.20 m`, factor `1.0`), Small (`0.254 m`, factor `0.212`), Giant (`2.90 m`, factor `2.417`).
    - Inventory Capacity: Maximum 6 slots boundary enforcement.
    - Physical Reach vs Table Height: Normal Alice (`1.20 m`) reach vs Small Alice (`0.254 m`) unable to reach glass table top (`0.72 m`), triggering climb attempt failures (`climbAttempts >= 2`).
    - Door Clearance Bounds: Little door dimensions (`0.381 m` height × `0.24 m` width) blocking Normal Alice (`1.20 m`) while allowing Small Alice (`0.254 m`).
    - Stuck Hint Timers: `60s` Tier 1 thought hint trigger and `120s` Tier 2 direct guidance hint trigger.
    - Subtitle Constraint Bounds: Chinese subtitle line length verification (`≤ 28` characters).

- **Tier 3 — Cross-Feature Combinations & Invariants**:
  - Leverages **Category-Partition Method (CPM)** and **Pairwise Combinatorial Testing** to verify interaction between gameplay systems and puzzle invariants under varied sequence orderings.
  - Invariant Verification:
    - **INV-01 (Curtain Access Lock)**: Velvet curtain interaction blocked (`keyTriesOnDoors < 2`) until two door key attempts complete (`keyTriesOnDoors >= 2`).
    - **INV-02 (Table Glass Transparency)**: Glass table material transparency (`alpha <= 0.25`) ensures golden key visibility from under table while small.
    - **INV-03 (Key Auto-Return)**: Picking up "DRINK ME" bottle automatically returns golden key to glass table top and clears key from player inventory.
    - **INV-04 (Size Scaling Dynamics)**: 2.5s cubic ease-in-out interpolation changing scale, movement speed, camera distance, and audio pitch (1.6x).
    - **INV-05 (Bottle 3D Inspection)**: Dual-sided label verification (front "DRINK ME" + back no "POISON") required before unlocking "Drink" action.
    - **INV-06 (Cutscene Skip Parity)**: Holding `Esc` or clicking skip for 1.0s fast-forwards cutscene while preserving identical terminal state flags, positions, and inventory as full playback.
    - **INV-07 (Marmalade Jar No-Drop)**: Dropping marmalade jar during S3 fall is strictly blocked until stowed in cupboard.

- **Tier 4 — Real-World End-to-End Walkthrough**:
  - Uninterrupted end-to-end playthrough executing the complete Chapter 1 narrative arc from `S0_TITLE` to `S7_CAKE` and `END_CARD`.
  - Verifies zero uncaught console errors, seamless scene transitions, complete flag mutation lifecycle, and final curiosity statistics output.

---

## 2. Feature Inventory to Test Case Mapping Matrix (Features 1–27)

| # | Feature Name | Tier | Test File | Test Case ID / Name | Input / Condition | Expected Output / Assertion |
|---|--------------|------|-----------|--------------------|-------------------|-----------------------------|
| 1 | Workspace Scaffolding | T1 | `tier1_features.spec.ts` | `T1-F01-Scaffolding` | Page load `/?test=1` | DOM contains `#render-canvas`, Vite bundle loads without 404 |
| 2 | Project Bible & Guidelines | T1 | `tier1_features.spec.ts` | `T1-F02-BibleDocs` | File system check | `CLAUDE.md`, `docs/bible.md`, `docs/ch1-design.md` present |
| 3 | CI Workflow | T1 | `tier1_features.spec.ts` | `T1-F03-CIWorkflow` | File system check | `.github/workflows/ci.yml` present & valid YAML |
| 4 | Trilingual i18n Dataset | T1 | `tier1_features.spec.ts` | `T1-F04-i18nDataset` | `window.__game` state / i18n load | `ch1.json` loaded, valid `en`, `zh`, `ja` lines |
| 5 | Curiosity Notes & Stuck Hints | T2 | `tier2_boundaries.spec.ts` | `T2-F05-StuckHintsTimer` | `idleTime = 60s`, `120s` | Tier 1 hint fires at 60s, Tier 2 hint fires at 120s |
| 6 | Victorian UI Overlay | T1 | `tier1_features.spec.ts` | `T1-F06-UIOverlay` | UI overlay elements | Canvas and overlay containers present in DOM |
| 7 | Procedural Web Audio Engine | T1 | `tier1_features.spec.ts` | `T1-F07-WebAudioEngine` | AudioContext startup | No audio errors, user click initializes audio |
| 8 | Spatial Audio & Pitch Mod | T2 | `tier2_boundaries.spec.ts` | `T2-F08-AudioPitchMod` | `setScale(0.254)` | Audio pitch factor shifts to `1.6` |
| 9 | Procedural 3D Architecture | T1 | `tier1_features.spec.ts` | `T1-F09-3DArchitecture` | Load scenes S0-S7 | All scene states register in `window.__game` |
| 10 | Metric Dimensions & Markers | T2 | `tier2_boundaries.spec.ts` | `T2-F10-MetricDimensions` | Query markers & scale | Table height 0.72m, little door 0.381m clearance |
| 11 | Interactive 3D Props | T1 | `tier1_features.spec.ts` | `T1-F11-InteractiveProps` | Interact with key, bottle, cake | Item pick up, inspection, and usage function |
| 12 | Character Models & Rigs | T2 | `tier2_boundaries.spec.ts` | `T2-F12-CharacterScales` | Alice Normal vs Small | Scale `1.0` (1.20m) and `0.212` (0.254m) valid |
| 13 | Asset Optimization Tool | T1 | `tier1_features.spec.ts` | `T1-F13-AssetOptimizer` | `tools/optimize-assets.mjs` | Asset optimization tool runnable |
| 14 | WebGPU/WebGL2 Render Engine | T1 | `tier1_features.spec.ts` | `T1-F14-RenderEngine` | `?forceWebGL=1&test=1` | WebGLRenderer initializes without WebGL context error |
| 15 | Victorian Picture-Book Shaders| T1 | `tier1_features.spec.ts` | `T1-F15-Shaders` | Canvas rendering | Canvas frame renders smoothly without shader compile errors |
| 16 | Rapier3d Physics Integration | T1 | `tier1_features.spec.ts` | `T1-F16-PhysicsIntegration`| Physics step execution | Player position tracked in `getState()` |
| 17 | Spring-Arm Collision Camera | T1 | `tier1_features.spec.ts` | `T1-F17-CameraRig` | Camera coordinate snapshot | Camera position non-null in `getState()` |
| 18 | S0-S7 State Machine | T1 | `tier1_features.spec.ts` | `T1-F18-StateMachine` | `goto('S0')` .. `goto('S7')` | State transitions update `getState().state` |
| 19 | 3D Item Inspector | T3 | `tier3_combinations.spec.ts`| `T3-F19-INV05-Inspector` | Bottle front + back rotation | Action button unlocked only after 2-sided inspection |
| 20 | Cutscene Timeline Player | T3 | `tier3_combinations.spec.ts`| `T3-F20-INV06-CutsceneSkip` | Fast forward / skip 1.0s Esc | Terminal state flags identical to full cutscene watch |
| 21 | S0-S3 Exterior & Descent | T4 | `tier4_playthrough.spec.ts` | `T4-F21-DescentGameplay` | Walk S0 -> S1 -> S2 -> S3 | Daisy pickup, rabbit chase, well fall complete |
| 22 | S4-S7 Hall Puzzle Invariants | T3 | `tier3_combinations.spec.ts`| `T3-F22-INV01-INV03-Hall` | Key attempt -> Curtain -> Bottle | INV-01, INV-02, INV-03 invariants hold |
| 23 | /making-of Showcase Page | T1 | `tier1_features.spec.ts` | `T1-F23-MakingOfShowcase` | Navigate `/making-of.html` | Page loads, contains Mermaid diagram and stats |
| 24 | ?test=1 Test Harness | T1 | `tier1_features.spec.ts` | `T1-F24-TestHarness` | `window.__game` API call | `goto`, `setFlag`, `getFlag`, `addItem`, `setScale` work |
| 25 | E2E Testing Infrastructure | T1 | `tier1_features.spec.ts` | `T1-F25-TestInfra` | Playwright test runner | Tests execute headless in Playwright Chromium |
| 26 | E2E Test Suite (Tiers 1-4) | T1-T4| `tests/e2e/*.spec.ts` | All Tier 1-4 specs | `npm run test:e2e` | 100% test pass across Tiers 1 to 4 |
| 27 | Final Milestone: E2E Pass | T4 | `tier4_playthrough.spec.ts` | `T4-F27-FullPlaythroughPass`| Full chapter walkthrough | S0 through S7 walkthrough completes with 0 errors |

---

## 3. Test Suite Architecture & Directory Layout

```
Alice-s-Adventures-in-Wonderland-/
├── TEST_INFRA.md                   # Authoritative E2E Test Specification (This document)
├── playwright.config.ts            # Playwright browser runner configuration
└── tests/
    └── e2e/
        ├── helpers/
        │   └── gameHarness.ts      # Typed Playwright helper wrappers for window.__game
        ├── tier1_features.spec.ts  # Tier 1: Happy-path feature coverage (Features 1-27)
        ├── tier2_boundaries.spec.ts# Tier 2: Boundary value analysis & corner cases
        ├── tier3_combinations.spec.ts # Tier 3: Cross-feature combinations & puzzle invariants (INV-01..07)
        └── tier4_playthrough.spec.ts  # Tier 4: Real-world S0-S7 full chapter walkthrough
```

---

## 4. Execution & CI Integration Instructions

### 4.1 Running Tests Locally
```bash
# Typecheck test files and codebase
npm run typecheck

# Run Playwright E2E test suite in headless Chromium mode
npm run test:e2e
```

### 4.2 CI Workflow (`.github/workflows/ci.yml`) Integration
The Playwright test suite is configured to launch the Vite development server automatically via `webServer` block in `playwright.config.ts`. In CI environments (`CI=true`), Playwright runs headlessly with WebGL2 forced (`?forceWebGL=1&test=1`) and fails on any uncaught console error or failed assertion.
