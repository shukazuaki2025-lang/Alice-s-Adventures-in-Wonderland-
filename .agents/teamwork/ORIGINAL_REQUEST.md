# Original User Request

## Initial Request — 2026-10-14T08:00:35Z

Use a large team of parallel fan-out subagents to design and build Chapter 1 ("Down the Rabbit-Hole") of the 3D web narrative game *Alice's Adventures in Wonderland* (`Alice: Down the Rabbit-Hole`) according to the complete specification in `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`, placing all subagent prompts, documentation, 3D assets, and playable game code in the GitHub repository `/home/administrator/Alice-s-Adventures-in-Wonderland-` and pushing to `origin/main`.

Working directory: /home/administrator/Alice-s-Adventures-in-Wonderland-
Integrity mode: development

Reference material:
- Full Chapter 1 specification (fetched from `https://docs.google.com/document/d/1v_0NR3esCCIjC9SEzGaXo3E0rNNG0HFS04dcQGlRxrM/edit?usp=sharing`): `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`
- Target GitHub repository: `https://github.com/shukazuaki2025-lang/Alice-s-Adventures-in-Wonderland-.git` (`origin/main`)
- Local Blender 5.2 environment: `/mnt/d/blender.exe` and live Blender MCP server on `127.0.0.1:9876`

## Requirements

### R1. Fan-Out Subagent Prompts, Project Bible & Narrative Data (Tracks A, B, C, K1)
Organize and store the project bible (`CLAUDE.md`, `docs/bible.md`, `docs/ch1-design.md`) and structured subagent prompt packages (`docs/prompts/<track>/`) for all tracks (A–K) defined in `docs/google-doc-spec-v1.md`. Generate and validate the complete Chapter 1 trilingual subtitle/dialogue dataset (`public/assets/i18n/ch1.json`, preserving all finalized B1 lines verbatim, adding required door/hint/UI variants, and keeping `zh` lines ≤ 28 characters) and the 5 curiosity notes (`public/assets/i18n/ch1_notes.json` or integrated i18n resource), plus UI design specs (`docs/ui/`) and concept art / visual reference assets.

### R2. 3D Greybox, Procedural Architecture, Props, Characters & Animations (Tracks D, E, F)
Using the local Blender environment (`/mnt/d/blender.exe` / Blender MCP on `127.0.0.1:9876`) and procedural asset generation scripts (`tools/blender/build_ch1_architecture.py` and companion scripts), build and export all required Chapter 1 `.glb` assets to `assets_src/` and optimize/copy them into `public/assets/`:
- Exact metric dimensions and logic markers (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `PATH_`, `COL_`, `SLOT_`, `LAMP_`, `VISTA_ANCHOR`) matching F1/D1/D5 constants (Alice normal `1.20 m`, small `0.254 m`, little door `0.381 m × 0.24 m`, glass table `0.72 m` height / `0.50 m` diameter, hall `24 × 7 × 2.85 m`, well inner diameter `4.0 m`).
- Greybox (`ch1_greybox.glb`), assembled scene GLBs (`ch1_s1_bank.glb`, `ch1_s3_well.glb`, `ch1_s4_passage.glb`, `ch1_s5_hall.glb`), characters (`chr_alice.glb` with `chr_alice.events.json` and E1 animation clips, `chr_rabbit.glb`, `chr_sister.glb`, `chr_dinah_dream.glb`), and props (`prop_key_gold.glb`, `prop_bottle_drinkme.glb` with `IM Fell English` "DRINK ME" label, `prop_jar_marmalade.glb` with "ORANGE MARMALADE" label, `prop_cake_eatme.glb` with currant "EAT ME" relief, `prop_watch.glb`, `prop_box_glass.glb`, cupboards, lamps, garden vista).

### R3. Complete Playable 3D WebGPU/WebGL2 Game & Cutscenes (Track G: G1–G12, Track H, Track I)
Implement the full playable Chapter 1 game in Vite + TypeScript (`strict`) + Three.js (`WebGPURenderer` with automatic fallback to `WebGL2` and `?forceWebGL=1` support) + `@dimforge/rapier3d-compat` + `zod`:
- State machine (`S0_TITLE` → `S1_BANK` → `S2_CHASE` → `S3_FALL` → `S4_PASSAGE` → `S5_HALL` → `S6_SMALL` → `S7_CAKE` → `END`), typed `Flags`, `localStorage` save/continue (`alice.save.v1`), debug console (`` ` `` key), and `/viewer.html` model/animation viewer.
- Third-person controller (normal `1.20 m` / small `0.254 m` configurations), spring-arm collision camera, interaction system (`INT_` markers, 6-slot inventory, 3D rotatable item inspector requiring front/back label inspection on the bottle, 60s/120s stuck hints), and `SizeSystem` (2.5s smooth transition, telescope vignette, 1.6x pitch shift).
- All S0–S7 gameplay beats and 8 JSON timeline cutscenes (`C1`–`C8` in `public/assets/cutscenes/ch1/`): riverbank daisy picking & White Rabbit chase, 90s floating-origin well fall (marmalade jar pickup/no-drop/cupboard return, 5 thought bubbles, mid-air curtsey easter egg on `C`, Dinah doze), long hall locked doors & `keyTriesOnDoors >= 2` curtain reveal, little door garden vista peek, bottle pickup auto-returning key to table, shrinking, slippery table-leg climb attempts, glass box & `EAT ME` cake ending.
- "Moving Victorian picture-book" rendering (3-tone toon shading, `#2B2420` ink outlines, 15% screen-space paper grain, per-scene color grading, custom refractive/Fierce Fresnel glass material keeping the key clearly visible from under the table, High/Medium/Low quality presets), book-page HTML/CSS UI (12 components in H3, zh/en live switching), and Web Audio system (`AudioListener` / `PositionalAudio` with synthesized/procedural `.ogg`/`.wav` music tracks M1–M7 and ~30 sound effects so audio plays out-of-the-box without errors).

### R4. Showcase Page, Automated Verification, Build & GitHub Delivery (Tracks G13, J, K)
- Implement the `/making-of` showcase page (K2) driven by real files in `docs/` (`docs/devlog/stats.json`, `docs/prompts/`, Mermaid toolchain diagram, asset stage comparisons, bilingual UI).
- Implement `?test=1` test mode exposing `window.__game` (`goto`, `flag`, `interact`, `getState`) and automated Playwright E2E smoke tests (`npm run test:e2e`) that play through S0 to S7, capture screenshots into `docs/devlog/screens/e2e/`, and verify cutscene skipping and state flags, along with `.github/workflows/` CI configuration, `docs/perf/ch1.md`, `docs/tests/ch1-interactions.md`, `docs/assets-licenses.md`, `LICENSE`, and `README.md`.
- Commit all source code, assets, documentation, and subagent records cleanly to `/home/administrator/Alice-s-Adventures-in-Wonderland-` and push to `origin/main`.

## Acceptance Criteria

### Type Safety, Schema Validation & Build
- [ ] `npm run typecheck` (`tsc --noEmit` with `strict: true`) passes with zero errors
- [ ] `npm run test` passes, including Zod schema validation of `public/assets/i18n/ch1.json` (verifying non-empty `zh`/`en`, `zh` length ≤ 28 chars for subtitle lines, unique IDs, all required B2 trigger IDs present, and negative test confirming invalid triggers fail validation)
- [ ] `npm run build` succeeds and outputs hashed production bundles in `dist/`

### Asset & Pipeline Verification
- [ ] `tools/blender/build_ch1_architecture.py` and asset generation/optimization scripts (`npm run assets`) run cleanly and produce valid `.glb` files in `assets_src/` and `public/assets/`
- [ ] All required scene, character, and prop `.glb` files listed in D1 exist, have valid glTF 2.0 structure (zero errors in glTF validation), and preserve custom properties (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `COL_`, `SLOT_`)

### End-to-End Gameplay & Rendering Verification
- [ ] `npm run test:e2e` (Playwright headless Chromium with `?forceWebGL=1&test=1`) passes a full playthrough from `S0_TITLE` through `S1_BANK` → `S2_CHASE` → `S3_FALL` → `S4_PASSAGE` → `S5_HALL` → `S6_SMALL` → `S7_CAKE` → `END` with zero uncaught page/console errors
- [ ] E2E test verifies key puzzle invariants: curtain cannot be interacted with before `keyTriesOnDoors >= 2`; picking up the `DRINK ME` bottle automatically places the gold key back on the glass table; shrinking sets Alice scale to `0.212` (`0.254 m`); skipping any cutscene `C1`–`C8` results in the exact same state flags as watching it
- [ ] Automated E2E screenshots for each scene (`S0`–`S7`), `/viewer.html`, and `/making-of` are generated in `docs/devlog/screens/` and verified non-blank

### Repository & GitHub Delivery
- [ ] All subagent prompt records (`docs/prompts/`), design docs (`CLAUDE.md`, `docs/bible.md`, `docs/ch1-design.md`), test/perf reports (`docs/tests/ch1-interactions.md`, `docs/perf/ch1.md`, `docs/assets-licenses.md`), and code/assets are committed in `/home/administrator/Alice-s-Adventures-in-Wonderland-` and pushed to `origin/main`
