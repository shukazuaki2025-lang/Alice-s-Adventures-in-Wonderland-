# Chapter 1 Asset Licensing & Rights Attestation

## 1. Overview & Rights Attestation

This repository contains the production-grade 3D web game implementation of Chapter 1 ("Down the Rabbit-Hole") of *Alice's Adventures in Wonderland*. All assets, source code, shaders, text, and audio included in this project strictly comply with open-source and public domain licensing standards.

---

## 2. Component Licensing Breakdown

### A. Literary Text & Narrative Lines
- **Source**: Lewis Carroll, *Alice's Adventures in Wonderland* (1865 edition, illustrated by John Tenniel).
- **Status**: **Public Domain** (Global).
- **Attestation**: All narrative text lines in `public/assets/i18n/ch1.json` and in-game dialogues preserve Lewis Carroll's original 1865 text verbatim without unauthorized modification. Chinese translations are original open translations bounded to <= 28 characters per line.

### B. 3D Models & Geometry Assets (`.glb`)
- **Source**: Original procedural glTF 2.0 binary asset pipelines (`tools/generate-procedural-assets.mjs` & `tools/blender/build_ch1_architecture.py`).
- **Files**:
  - `public/assets/models/ch1_greybox.glb`
  - `public/assets/models/ch1_s1_bank.glb`
  - `public/assets/models/ch1_s3_well.glb`
  - `public/assets/models/ch1_s4_passage.glb`
  - `public/assets/models/ch1_s5_hall.glb`
  - `public/assets/models/chr_alice.glb`
  - `public/assets/models/chr_rabbit.glb`
  - `public/assets/models/chr_sister.glb`
  - `public/assets/models/chr_dinah_dream.glb`
  - `public/assets/models/prop_key_gold.glb`
  - `public/assets/models/prop_bottle_drinkme.glb`
  - `public/assets/models/prop_jar_marmalade.glb`
  - `public/assets/models/prop_cake_eatme.glb`
  - `public/assets/models/prop_watch.glb`
  - `public/assets/models/prop_box_glass.glb`
- **License**: **CC0 1.0 Universal / MIT License** (100% original generated work).

### C. Audio & Music
- **Source**: Real-time Web Audio API procedural synthesis (`src/audio/ProceduralSynth.ts` & `src/audio/AudioManager.ts`).
- **Tracks**: 7 BGMs (M1-M7) and 30 SFX generated dynamically using oscillator nodes, gain envelopes, and white noise filters. Zero external audio samples or copyrighted recordings are used.
- **License**: **MIT License / CC0 1.0 Universal**.

### D. Source Code, Engine & Shaders
- **Source**: Original TypeScript codebase, Three.js custom shaders (`PaperGrain.ts`, `InkOutline.ts`, `GlassRefraction.ts`), Rapier3D physics wrapper, and Vite scaffolding.
- **License**: **MIT License**.

### E. Fonts & Typography
- **Source**: System serif stack with fallback to Google Fonts (`Cinzel Decorative`, `EB Garamond`).
- **License**: **SIL Open Font License 1.1 / Public Domain**.
