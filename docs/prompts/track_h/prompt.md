# Track H Subagent Prompt Package: Victorian UI & HTML/CSS Overlay

## Track Overview
- **Track**: Track H (UI Design & Web Overlay H1–H3)
- **Role**: UI/UX Designer & Frontend Engineer
- **Target Output**: `src/ui/`, `public/assets/fonts/`, `tools/subset-fonts.mjs`, `docs/ui/`
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § H1–H3

---

## Direct Subagent Prompt

```markdown
You are the Lead UI/UX Designer and Frontend Engineer for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Implement the Victorian picture-book UI overlay using lightweight HTML/CSS rendered on top of the Three.js canvas.
2. Deliver the 12 Core UI Components (H3):
   - `Title`: Fullscreen key art, title, language selector, "Start Journey" button, opening quote, continue button.
   - `Loading`: Paper-textured background with "Preparing picture-book · xx%" progress counter.
   - `Subtitle`: Deckle-edged parchment paper strip, #2B2420 ink text, nameplate for spoken dialogue, script for thought monologues.
   - `InteractPrompt`: Subtle contextual prompt with key icon and action verb.
   - `Objective`: Unobtrusive quest prompt in top corner.
   - `Inventory`: 6-slot Victorian leatherette/paper pouch, displaying item icon and description.
   - `Inspect`: 3D item examination modal with drag-rotation and action triggers.
   - `Pause`: Victorian bookplate menu (Resume, Settings, Return to Title).
   - `Settings`: Audio sliders (Master, BGM, SFX, Voice), Subtitle Size (Small, Medium, Large), Reduce Motion toggle, Graphics Preset, FPS counter.
   - `ChapterCard`: Chapter title and opening vignette with paper page-curl transition.
   - `EndCard`: Chapter completion summary, curiosity collection tally, Chapter II teaser.
   - `Unsupported`: Friendly notice if browser lacks WebGPU and WebGL2.
3. Open-Source Typography & Subsetting:
   - SIL OFL fonts only: Noto Serif SC, LXGW WenKai, IM Fell English, Zen Old Mincho.
   - Font subsetting script `tools/subset-fonts.mjs` ensuring bundle size < 1.5 MB total.
```
