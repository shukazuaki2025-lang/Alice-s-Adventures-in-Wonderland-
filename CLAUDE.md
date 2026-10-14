# CLAUDE.md — Alice: Down the Rabbit-Hole

Welcome to **Alice's Adventures in Wonderland — Chapter I: Down the Rabbit-Hole** (`Alice: Down the Rabbit-Hole`). This document specifies the engineering rules, architectural conventions, canonical dimensions, visual guidelines, and Lewis Carroll text fidelity standards for all AI subagents, engineers, and contributors.

---

## 1. Project Overview & Architecture

- **Title**: *Alice's Adventures in Wonderland* / 《爱丽丝梦游仙境》（第一章：掉进兔子洞）
- **Working Title**: `Alice: Down the Rabbit-Hole`
- **Core Technology Stack**:
  - **Bundler & Dev Server**: Vite 6.x (with HTTPS support for WebGPU local testing)
  - **Language**: TypeScript 5.8+ (`strict: true`, `noImplicitAny: true`, `target: ES2022`, `moduleResolution: bundler`)
  - **3D Engine**: Three.js (`three` r174+) with dual-backend rendering:
    - Primary: `WebGPURenderer` (`three/webgpu`) with TSL (Three Shading Language)
    - Fallback: Automatic graceful degradation to `WebGL2` when WebGPU is unavailable
    - Query override: `?forceWebGL=1` forces WebGL2 path for automated headless CI and legacy devices
  - **Physics Engine**: `@dimforge/rapier3d-compat` (WASM-based Rapier 3D physics, kinematic character controller, cuboid/trimesh colliders)
  - **Validation**: `zod` for parsing and verifying i18n tables, flags, save states, and cutscene manifests
  - **Audio**: Web Audio API procedural synthesis engine with `AudioListener` and `PositionalAudio`
  - **Testing**: Playwright (`@playwright/test`) for headless E2E smoke tests and visual regression verification

---

## 2. Lewis Carroll 1865 Text Preservation & Localization Rules

1. **English Source Fidelity**:
   - The authoritative text is Lewis Carroll's *Alice's Adventures in Wonderland* (1865, Project Gutenberg #11).
   - In-game dialogue, thoughts, and narrative text (`en`) must preserve Carroll's 1865 wording verbatim.
   - Any gameplay-specific lines (e.g. repeated door tries, stuck hints, item descriptions) not present in Carroll's original text must be explicitly marked with `"note": "new"` or `"note": "adapted"`.
   - Preserve Carroll's historical wordplay verbatim: e.g., Alice's confusion between *The Antipathies* and *The Antipodes* (`S3_THOUGHT_4`), and the dream murmuring *"Do cats eat bats? / Do bats eat cats?"* (`S3_THOUGHT_5`, `S3_DOZE`).
2. **Chinese Localization Rules (`zh`)**:
   - Independent translation crafted specifically for this project; **strictly prohibited** from copying copyrighted modern printed editions.
   - Tone: A spirited, polite, but slightly pretentious and candid 7-year-old Victorian girl.
   - **Hard Length Constraint**: Every subtitle entry MUST NOT exceed **28 Chinese characters** (enforced via Zod schema validation in `npm run test`).
3. **Japanese Interface Reservation (`ja`)**:
   - Initial release includes fully completed Japanese translations for all lines, directly populated instead of falling back to English.
4. **Dialogue Types**:
   - `say`: Spoken dialogue with character nameplate.
   - `think`: Alice's inner monologue, presented in script typography without a nameplate.
   - `narr`: Objective storybook narrator voice, centered, borderless.
   - `sfx`: Stylized on-screen sound effect captions (comic/storybook style).
   - `ui`: System notifications and objective reminders.

---

## 3. Victorian Picture-Book Visual Guidelines & Copyright Boundaries

1. **Aesthetic North Star: "A Moving Victorian Picture-Book"**:
   - Soft 3-tone toon ramp shading (warm paper mid-tones, warm purple/sepia soft shadows, never harsh black).
   - Ink line work: Exterior silhouette outlines tinted `#2B2420` (warm sepia-ink), thinning with distance.
   - Paper texture: 15% screen-space tileable watercolor/parchment grain overlaid across the camera viewport.
   - Proportions: Gentle stylized proportions (Alice head-to-body ratio 1:4.5; hands and feet slightly oversized for clarity from third-person distance).
   - Lighting: Warm pools of amber candlelight and gas lamp glows in interiors; radiant saturated sunlight reserved exclusively for the Garden Vista through the little door.
2. **Strict No-Disney & Anti-Derivation Rules**:
   - **PROHIBITED**: Any color schemes, silhouettes, or naming conventions from film/animation adaptations (Disney 1951, Tim Burton 2010, American McGee, etc.).
   - **PROHIBITED**: The light-blue dress + black hairband combination.
   - **Canonical Alice**: Wheat-yellow dress (`#E9C46A`), white pinafore apron (`#F7F3EA`) with frilled shoulder straps and pockets, navy-blue hair ribbon (`#2E3F6E`), white stockings, black Mary Jane strap shoes, wavy light-blonde hair (`#E6C98F`).
   - **Canonical White Rabbit**: Soft warm-white fur (`#F4F1EC`), pink eyes (`#E88FA3`), brown-and-cream checked coat (`#9B5B3A` / `#E2C9A0`), mustard-yellow waistcoat (`#C9A24A`), and brass/gold pocket watch on a chain. Never depicted without his waistcoat.
3. **Typography**:
   - SIL OFL open-source fonts exclusively: *Noto Serif SC* (Chinese body), *LXGW WenKai* (inner thoughts), *IM Fell English* (English body, prop labels, chapter cards), *Zen Old Mincho* (Japanese reservation).
   - Font files must be subsetted to include only characters present in the game strings, keeping bundles under 1.5 MB.

---

## 4. Canonical Metric Standards (Universal Across All Tracks)

All 3D models, Blender scenes, physics colliders, and Three.js engine systems must strictly conform to these metric constants (1 unit = 1.0 meter, +Y is UP):

| Element | Metric Constant | Scale Ratio / Rationale |
|---|---|---|
| **Alice Normal Height** | `1.20 m` | Canonical 7-year-old girl height (scale factor `1.0`) |
| **Alice Small Height** | `0.254 m` | 10 inches tall (scale factor `0.2117 ≈ 0.212`) |
| **Alice Giant Height** | `2.90 m` | >9 feet tall (scale factor `2.4167 ≈ 2.417`) |
| **White Rabbit Height** | `0.75 m` (incl. ears) | ~2/3 of normal Alice height |
| **Sister Sitting Height** | `0.95 m` | Sitting under oak tree |
| **Solid Glass 3-Legged Table**| Height `0.72 m`, Top Dia `0.50 m` | Small Alice (0.254m) cannot reach tabletop (2.8x her height) |
| **Tiny Golden Key** | Length `0.05 m` (5 cm) | Sits on glass table; fits little door lock |
| **Little Door** | Height `0.381 m` (15 in), Width `0.24 m` | Low door behind velvet curtain |
| **Little Door Passage** | W `0.24 m`, H `0.33 m`, L `1.20 m` | Tunnel leading toward the Garden Vista |
| **Long Hall Shell** | Length `24.0 m`, Width `7.0 m`, Ceiling `2.85 m` | "Long, low hall" lit by suspended oil lamps |
| **Hall Doors (10 doors)** | Width `1.0 m`, Height `2.2 m` | Victorian interior wooden doors, all locked |
| **Velvet Curtain** | Width `0.80 m`, Height `0.60 m` | Conceals little door at North wall (10.5m, 3.5m) |
| **Rabbit-Hole Burrow** | Diameter `0.80 m` | Burrow opening under riverbank hedge |
| **Well Vertical Shaft** | Inner Diameter `4.0 m` | Cylindrical falling well with cupboards & shelves |
| **"DRINK ME" Bottle** | Height `0.10 m` (10 cm) | Clear glass, cork stopper, tied paper label |
| **"EAT ME" Currant Cake** | Diameter `0.05 m` (5 cm) | Sits inside miniature glass box under the table |
| **Miniature Glass Box** | `0.10 m × 0.07 m × 0.05 m` | Hinged lid with thin brass frame |

---

## 5. Blender Automation & Asset Conventions

1. **Coordinate System**:
   - Blender: X East, Y North, Z Up.
   - glTF Export: Apply Modifiers, +Y Up, unit scale 1.0.
2. **Logic Empty Prefixes**:
   - `SPAWN_`: Character and player spawn anchors (direction vector indicates facing).
   - `TRG_`: Box or sphere trigger volumes (`userData.triggerId`).
   - `INT_`: Interactive target points (`userData.type`, `userData.item`, `userData.promptKey`).
   - `CAM_`: Cinematic camera shot points (`userData.fov`, look-at target).
   - `PATH_`: Bezier curves for character motion (e.g. White Rabbit pursuit).
   - `COL_`: Physics collision geometry (`userData.collider = true`, non-rendered).
   - `SOCKET_`: Skeletal attachment anchors (e.g. `SOCKET_HandR`, `SOCKET_HandL`).
   - `SLOT_`: Procedural item distribution slots in the vertical well.
   - `LAMP_`: Suspended oil lamp anchors along the Long Hall center line.
   - `VISTA_ANCHOR`: Visual anchor for the Garden Vista at the end of the passage.
3. **Materials**:
   - Standard surfaces use PBR Principled BSDF with Base Color maps.
   - Glass surfaces must be named with prefix `M_Glass_` (e.g. `M_Glass_Table`, `M_Glass_Bottle`) so the engine can replace them with custom refractive glass shaders.
4. **Custom Properties**:
   - Ensure the "Custom Properties" checkbox is enabled during glTF / GLB export so that all logic metadata is preserved in Three.js `object.userData`.

---

## 6. Engineering Rules & Quality Workflow (G0)

1. **Plan First**:
   - Before executing code modifications, re-read `docs/bible.md` and `docs/ch1-design.md`.
   - Specify files to modify, steps, and verification procedures before making changes.
2. **Verification Discipline**:
   - After any change, run `npm run typecheck`, `npm run lint`, and `npm run test`.
   - Never report completion without running the verification commands.
   - For visual and rendering changes, capture Playwright screenshots into `docs/devlog/screens/`.
3. **Integrity Mandate**:
   - Never fabricate test logs, bypass assertions, or create dummy facade implementations.
   - Maintain real state machines, genuine physics steps, and authentic audio graph nodes.
4. **Performance Budgets**:
   - Integrated GPU / 1080p target: ≥ 50 fps on WebGPU, ≥ 40 fps on WebGL2 fallback.
   - Draw calls per frame: ≤ 150.
   - Initial page load: ≤ 15 MB; complete chapter assets ≤ 60 MB.
5. **Asset Licensing**:
   - All third-party fonts, textures, audio samples, and code libraries must be registered in `docs/assets-licenses.md` with explicit licenses (SIL OFL, CC0, MIT, etc.).
