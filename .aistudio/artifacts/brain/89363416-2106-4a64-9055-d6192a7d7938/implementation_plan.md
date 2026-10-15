# Alice: Down the Rabbit-Hole — Painterly 3D Modeling & Gouache Finish Overhaul

This plan upgrades the 3D geometry, sculpted garment folds, layered environment dressing, interactive 3D Item Inspector props, and multi-scale gouache/woodcut shader finish across all of Chapter 1 to match the tactile, hand-painted visual bar of *The Little Prince: Across the Stars* (`littleprince.dev`).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Direction from Clarifying Questions**:
> - **Scope**: Comprehensive upgrade across **all characters, scenes (`S1`–`S7`), and interactive 3D props** in Chapter 1.
> - **Art & Surface Direction**: **Hand-painted gouache and Tenniel woodcut engraving detail** — rich watercolor pigment pooling, dry-brush bristle grain, cotton-rag paper tooth, and subtle walnut-ink contour hatching rather than flat polygons or plastic cel-shading.
> - **Geometric & Texture Priorities**:
>   1. **Characters**: Sculpted box pleats, linen folds, crochet lace, hair strand volumes, and facial expression morph targets (`Blink`, `Smile`, `Surprised`, `Crying`, `MouthOpen`) wired into cutscenes and interactions.
>   2. **Outdoor Riverbank (`S1` / `S2`)**: Layered oak canopy foliage clusters, gnarled bark knots and roots, mossy riverbank stones, reeds, waterlilies, and multi-hue wildflower drifts.
>   3. **Underground Well, Passage & Great Hall (`S3`–`S7`)**: Protruding masonry courses, mortar crevices, cupboard bookshelves with multi-colored leather bindings, oil-lamp volumetric halos, carved wainscot moldings, and oriental runner rug weave visible even at `0.254 m` scale.
>   4. **3D Item Inspector**: Genuine high-detail sculpted GLB prop models (glass bottle with cork/wax seal and `IM Fell English` front/back labels, filigree golden key, currant cake, marmalade jar, pocket watch) rendered inside the interactive 3D inspector modal.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms every 3D scene and character in Chapter 1 from basic low-frequency geometry into densely populated, hand-painted 3D dioramas where every surface exhibits sculpted silhouette relief, gouache brushstroke variation, and warm-to-cool split-toned lighting.
- **Target Audience / Persona**: Players and reviewers experiencing Chapter 1 both in live interactive gameplay and through the automated visual parity benchmark against `littleprince.dev`.
- **Key Value**: Eliminates flat-shaded polygon surfaces, smooth featureless garments, and primitive placeholder props while satisfying all quantitative visual richness metrics (`detail ≥ 8.0`, `palette ≥ 0.60`, `hueEntropy ≥ 2.0`, `contrast ≥ 0.20`, `dominant3 ≤ 0.30`, `npc:sister detail ≥ 12.0`) and keeping draw calls within the `≤ 150` performance budget.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Riverbank & Meadow (`S1_BANK` / `S2_CHASE`)**: Alice explores a sunlit Oxfordshire riverbank under a multi-tiered oak canopy with dappled light pools, mossy root buttresses, streamside reeds, waterlilies, and 12 species of swaying wildflowers. Sitting against the oak, her sister reads a gilded maroon book with deeply sculpted pleated skirt folds, a scalloped lace hem, and an openwork crochet shawl.
  2. **The Deep Well Shaft (`S3_FALL`)**: During the 90-second vertical descent, Alice drifts past relief-carved brick courses, damp moss streaks, protruding stone corbels, walnut cupboards, and rows of gilded leather book spines lit by warm amber lantern halos that transition into dreamy lavender twilight as Dinah floats by.
  3. **Low Arched Passage (`S4_PASSAGE`)**: Alice navigates a root-threaded earthen and stone-ribbed tunnel with glistening floor puddles, mossy masonry, hanging brass lanterns, and a warm sunlit archway beckoning at the far end.
  4. **The Great Hall & Tiny Perspective (`S5_HALL` – `S7_CAKE`)**: A 24-meter vaulted hall with herringbone parquet, a woven crimson Persian runner, damask rose wallpaper, ten paneled oak doors, and a three-legged refractive glass table. Drawing back the velvet curtain and unlocking the 15-inch door reveals a saturated sunlit garden vista with a fountain and rose beds. When Alice shrinks to 10 inches (`0.254 m`), the parquet grain, carpet fibers, and carved baseboard moldings read crisply at macro scale.
  5. **Interactive 3D Item Inspector Modal**: Opening any inventory item or picking up the `DRINK ME` bottle mounts the actual sculpted, hand-painted GLB asset in a 3-point studio-lit viewport with smooth drag-rotation and front/back normal verification (`≤ 30°`).

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Moving Victorian Picture-Book meets *The Little Prince* gouache diorama.
  - *Color Palette & Mood*: Warm cream cotton paper (`#F7F3EA`), deep walnut ink (`#2B2420`), wheat-gold dress (`#E8C66A`), sage/moss/olive greens (`#7C9B66`, `#4F6F40`), sienna brickwork (`#9B5B3A`), amber candlelight (`#FFB86C`), and cool violet-teal shadows (`#4A3B4E`).
  - *Typography & Hierarchy*: `IM Fell English` display headers and engraved labels paired with `Noto Serif SC` for bilingual subtitles, curiosity notes, and book-cover UI cards.
  - *Interactive Feedback & Motion*: Expressive facial morph targets (`Smile`, `Surprised`, `Crying`, `Blink`) synchronized with cutscene beats and interactions; gentle wind-sway on foliage cards; subtle directional Kuwahara brush-stroke and watercolor pigment-pooling shaders.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hybrid Blender GLB Rebuild + Engine-Side Instanced Architectural & Foliage Dressing**
  - *Chosen Approach*: Re-sculpt character/environment meshes (`chr_sister`, `ch1_s1_bank`, `ch1_s3_well`, `ch1_s4_passage`, `ch1_s5_hall`) and pair them with batched/instanced 3D micro-detail layers in the Three.js scene loader (foliage clusters, mossy stones, relief brick courses, book spines, tapestry/carpet weave) plus multi-scale gouache wash shaders.
  - *Why*: Purely increasing single-mesh polygon counts without multi-hue surface variation leaves `palette` and `hueEntropy` below the `0.60` / `2.0` benchmark, whereas combining sculpted geometry with instanced multi-hue dressing and object-space gouache washes raises both geometric silhouette complexity and color richness while keeping total draw calls well under `150`.
  - *Alternatives Considered*: Screen-space noise overlays alone (rejected — violates visual integrity rules and looks grainy rather than hand-painted).

- **Decision 2: Genuine Painted GLB Models in the 3D Item Inspector**
  - *Chosen Approach*: Load and clone the sculpted `/assets/models/prop_*.glb` assets (`prop_bottle_drinkme`, `prop_key_gold`, `prop_cake_eatme`, `prop_jar_marmalade`, `prop_watch`, `prop_box_glass`) inside `ItemInspector` with a procedural painted studio backdrop and 3-point rim lighting, preserving the exact `+Z` / `-Z` normal vector checks for `INV-05`.
  - *Why*: Replaces the primitive cylinder/box stand-ins in the inspector modal with the real sculpted and hand-lettered props without breaking any E2E puzzle invariants.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        React Application Shell (App.tsx)                   │
│  ┌──────────────────────┐  ┌────────────────────────┐  ┌────────────────┐  │
│  │ Book-Cover Title &   │  │ 6-Slot Inventory &     │  │ Subtitle Box & │  │
│  │ Pause / Settings HUD │  │ 3D ItemInspector Modal │  │ Curiosity Note │  │
│  └──────────┬───────────┘  └───────────┬────────────┘  └────────┬───────┘  │
└─────────────┼──────────────────────────┼────────────────────────┼──────────┘
              │                          │                        │
              ▼                          ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     Core 3D Narrative Engine (GameManager)                 │
│  ┌──────────────────────┐  ┌────────────────────────┐  ┌────────────────┐  │
│  │ Character Entities   │  │ SceneLoader & World    │  │ CutscenePlayer │  │
│  │ • Alice (Morphs+IK)  │  │ • S1 Oak/Reed/Meadow   │  │ • C1–C8 Tracks │  │
│  │ • Sister (Pleated)   │  │ • S3 Brick/Book Relief │  │ • Facial Morph │  │
│  │ • Rabbit & Dinah     │  │ • S4 Roots/Cobbles/Rim │  │   Keyframes    │  │
│  │ • Sculpted Prop GLBs │  │ • S5 Wainscot/Rug/Door │  │ • Camera Rig   │  │
│  └──────────┬───────────┘  └───────────┬────────────┘  └────────┬───────┘  │
└─────────────┼──────────────────────────┼────────────────────────┼──────────┘
              │                          │                        │
              ▼                          ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            Painterly Gouache & Woodcut Rendering Pipeline                  │
│  ┌───────────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ Object-Space Toon & Gouache Wash  │ │ PostProcessor (PaperGrain.ts)  │  │
│  │ • 3-Tone Warm Purple Shadow Ramp  │ │ • Directional Brush Clarity    │  │
│  │ • Multi-Octave Pigment Drift      │ │ • Split-Tone Grade & Halation  │  │
│  │ • Bristle Cross-Grain & Wet Edge  │ │ • Cotton Paper Tooth & Mottle  │  │
│  └───────────────────────────────────┘ └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & Scene Mapping

1. **Elder Sister (`chr_sister`) Sculpt & Texture Overhaul**:
   - Deepen the radial pleat geometry and secondary cloth folds on `build_skirt` and `build_shawl`, add sculpted hair locks and ribbon bow detail, and enrich `Sister_Skirt`, `Sister_Dress`, and `Sister_Shawl` textures with stronger gouache fold contrast, woven linen cross-hatching, and floral border embroidery so `npc:sister` exceeds `detail ≥ 12.0` and `contrast ≥ 0.20`.
2. **Alice & Cutscene Facial Expressions**:
   - Wire Alice's morph targets (`Surprised`, `Crying`, `Smile`, `MouthOpen`, `Blink`) in `AliceEntity` and `CutscenePlayer` so dialogue triggers and cutscenes (`C1`–`C8`) animate her facial expressions dynamically.
3. **Riverbank (`S1_BANK` / `S2_CHASE`) Richness & Canopy Layering**:
   - Enhance the riverbank environment with multi-hue foliage clusters, gnarled bark/root relief, streamside reeds, waterlilies, and richer ground pigment washes so `S1_BANK` and `S1_BANK_orbit` exceed `detail ≥ 8.0`, `palette ≥ 0.60`, and `contrast ≥ 0.20` while keeping `drawCalls ≤ 150`.
4. **Underground Environments (`S3_FALL`, `S4_PASSAGE`, `S5_HALL`, `S6_SMALL`)**:
   - Calibrate the object-space gouache pigment drift, woodcut cross-hatching, height-based lighting contrast, and polychrome prop/masonry dressing across the well shaft (`S3_FALL`), arched passage (`S4_PASSAGE`), and Great Hall (`S5_HALL` / `S6_SMALL`) so every underground scene has distinct warm-amber vs. cool-violet tonal separation (`contrast ≥ 0.20`), rich multi-hue bookshelves/brickwork/tapestries (`palette ≥ 0.60`, `hueEntropy ≥ 2.0`, `dominant3 ≤ 0.30`), and crisp close-up detail (`detail ≥ 8.0`).
5. **3D Item Inspector (`ItemInspector.ts`)**:
   - Load and display the high-detail painted GLB models (`prop_bottle_drinkme.glb`, `prop_key_gold.glb`, `prop_cake_eatme.glb`, `prop_jar_marmalade.glb`, `prop_watch.glb`) inside the inspector viewport with detailed fallback geometry and preserved front/back label inspection logic.
