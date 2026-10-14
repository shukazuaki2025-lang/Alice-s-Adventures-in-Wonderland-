# Alice: Down the Rabbit-Hole (Chapter 1)

> **A "Moving Victorian Picture-Book" 3D Web Narrative Game** — Chapter 1 of Lewis Carroll's *Alice's Adventures in Wonderland* (1865), built with a parallel fan-out multi-agent architecture across Tracks A–K.

---

## Overview

**Alice: Down the Rabbit-Hole** brings Chapter 1 of Lewis Carroll's 1865 classic and Sir John Tenniel's woodcut illustrations to life as an interactive 3D WebGPU/WebGL2 narrative adventure:

- **Visual Direction**: Warm cream paper-grain (`#F4ECD8`), deep walnut-ink outlines (`#2B2420`), 3-tone cross-hatched toon shading, and custom Fresnel refractive glass keeping the gold key visible from beneath the three-legged table.
- **Exact Metric World**:
  - **Alice**: `1.20 m` normal height (`scale = 1.0`) ↔ `0.254 m` (10 inches, `scale = 0.212`) after drinking the potion.
  - **The Deep Well (`S3_FALL`)**: `4.0 m` inner diameter, 90-second vertical fall with cupboards, maps, pictures, the `ORANGE MARMALADE` jar (pickup + cupboard return no-drop safety invariant), 5 floating thought bubbles, mid-air curtsey easter egg (`C`), and Dinah dream cloud.
  - **The Long Low Hall (`S5_HALL` / `S6_SMALL` / `S7_CAKE`)**: `24.0 m × 7.0 m × 2.85 m` vaulted hall lit by a row of hanging lamps, 10 locked full-size doors, a `0.72 m` three-legged solid glass table, a `0.15 m` low curtain concealing the `0.381 m × 0.24 m` (15-inch) little door, garden vista peek, slippery table-leg climb attempts, and the glass box with the `EAT ME` currant cake.
- **Trilingual Narrative (`zh` / `en` / `orig_1865`)**: Full Chapter 1 dialogue, subtitles (`zh` ≤ 28 characters per line), 60s/120s contextual stuck hints, and 5 unlockable Victorian Curiosity Notes.

---

## Multi-Agent Fan-Out Architecture (Tracks A–K)

All subagent prompt packages, specifications, and handoff records are archived in the repository:

| Track | Role & Scope | Prompt & Docs |
| :--- | :--- | :--- |
| **Track A** | Project Bible, Metric Constants & Chapter 1 Design | [`CLAUDE.md`](./CLAUDE.md), [`docs/bible.md`](./docs/bible.md), [`docs/ch1-design.md`](./docs/ch1-design.md), [`docs/prompts/track_a/prompt.md`](./docs/prompts/track_a/prompt.md) |
| **Track B** | Narrative Script, Trilingual Subtitles (`ch1.json`) & Curiosity Notes | [`public/assets/i18n/ch1.json`](./public/assets/i18n/ch1.json), [`docs/prompts/track_b/prompt.md`](./docs/prompts/track_b/prompt.md) |
| **Track C** | Concept Art, Color Script & Victorian UI Design Specs | [`docs/prompts/track_c/prompt.md`](./docs/prompts/track_c/prompt.md) |
| **Track D** | Blender 3D Procedural Architecture, Greybox & Props | [`tools/blender/build_ch1_architecture.py`](./tools/blender/build_ch1_architecture.py), [`public/assets/models/`](./public/assets/models/), [`docs/prompts/track_d/prompt.md`](./docs/prompts/track_d/prompt.md) |
| **Track E** | Characters (`chr_alice`, `chr_rabbit`, `chr_sister`, `chr_dinah_dream`) & Animation Clips | [`docs/prompts/track_e/prompt.md`](./docs/prompts/track_e/prompt.md) |
| **Track F** | Scene Assembly & 52 Logic Markers (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `COL_`, `SLOT_`) | [`public/assets/models/`](./public/assets/models/), [`docs/prompts/track_f/prompt.md`](./docs/prompts/track_f/prompt.md) |
| **Track G** | Core 3D Engine (Three.js + Rapier3D), S0–S7 State Machine & C1–C8 Cutscenes | [`src/`](./src/), [`public/assets/cutscenes/ch1/`](./public/assets/cutscenes/ch1/), [`docs/prompts/track_g/prompt.md`](./docs/prompts/track_g/prompt.md) |
| **Track H** | Victorian Book-Page HTML/CSS UI (Live `zh`/`en` Toggle) | [`src/ui/UIManager.ts`](./src/ui/UIManager.ts), [`docs/prompts/track_h/prompt.md`](./docs/prompts/track_h/prompt.md) |
| **Track I** | Procedural Web Audio Synthesizer (Music & SFX) | [`src/audio/AudioManager.ts`](./src/audio/AudioManager.ts), [`docs/prompts/track_i/prompt.md`](./docs/prompts/track_i/prompt.md) |
| **Track J** | Unit Tests, Playwright E2E Playthroughs (Tiers 1–5) & Performance Docs | [`tests/`](./tests/), [`docs/tests/ch1-interactions.md`](./docs/tests/ch1-interactions.md), [`docs/perf/ch1.md`](./docs/perf/ch1.md), [`docs/prompts/track_j/prompt.md`](./docs/prompts/track_j/prompt.md) |
| **Track K** | `/making-of` Showcase Page, `/viewer.html` Asset Inspector & CI/CD | [`making-of.html`](./making-of.html), [`viewer.html`](./viewer.html), [`.github/workflows/ci.yml`](./.github/workflows/ci.yml), [`docs/prompts/track_k/prompt.md`](./docs/prompts/track_k/prompt.md) |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Server
```bash
npm run dev
```
- **Main Game**: `http://localhost:5173/` (append `?forceWebGL=1` to force WebGL2 fallback or `?test=1` to expose `window.__game`)
- **3D Asset & Animation Viewer**: `http://localhost:5173/viewer.html`
- **Making-Of Multi-Agent Showcase**: `http://localhost:5173/making-of.html`

### 3. Build & Verification
```bash
# TypeScript strict typecheck
npm run typecheck

# Production bundle build (outputs to dist/)
npm run build

# Unit & schema validation tests (18/18 tests)
npm test

# Playwright E2E full playthrough & adversarial tests (28/28 tests)
npm run test:e2e
```

---

## Key Gameplay & Puzzle Invariants Verified by E2E

1. **Curtain Lock (`INV-01`)**: The low curtain (`INT_Curtain`) remains non-interactive until Alice has tried the golden key on at least 2 full-size hall doors (`keyTriesOnDoors >= 2`).
2. **Soft-Lock Prevention (`INV-02`)**: Picking up the `DRINK ME` bottle (`INT_Bottle_DrinkMe`) while holding the golden key automatically places the key back on top of the glass table (`keyLocation = 'on_table'`), ensuring the classic puzzle state when Alice shrinks.
3. **3D Bottle Inspection (`INV-03`)**: Drinking the potion requires rotating the bottle in the 3D Item Inspector to inspect both the front (`DRINK ME` in `IM Fell English`) and the back (confirming it is **not** marked *"poison"*).
4. **Shrink Physics & Audio (`INV-04`)**: Drinking transitions Alice smoothly over `2.5s` from `1.20 m` (`scale = 1.0`) to `0.254 m` (`scale = 0.212`) with telescope vignette and `1.6×` voice/footstep pitch shift.
5. **Marmalade Jar Safety (`INV-05`)**: During the well fall (`S3_FALL`), the empty `ORANGE MARMALADE` jar cannot be dropped ("for fear of killing somebody underneath") and must be placed into a passing cupboard (`INT_WellCupboard_Return`).
6. **Cutscene Skip Parity (`INV-06`)**: Skipping any cutscene `C1`–`C8` produces the exact same `terminalFlags` and game state as watching it to completion.

---

## License

- **Code**: [MIT License](./LICENSE)
- **Original 1865 Text & Tenniel References**: Public Domain (see [`docs/assets-licenses.md`](./docs/assets-licenses.md))