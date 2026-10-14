## 2026-10-14T09:01:05Z
You are worker_m2, a teamwork_preview_worker.
Your working directory is: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/worker_m2`
Your parent orchestrator is: teamwork_preview_orchestrator_1 (conversation ID: 96fcdb3d-2c70-4c56-b622-1b4e5ccd5a0b).

Authoritative source documents:
- Authoritative User Request: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/ORIGINAL_REQUEST.md` (READ THIS FIRST, verbatim)
- Full Chapter Specification: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`
- Project Master Blueprint: `/home/administrator/Alice-s-Adventures-in-Wonderland-/PROJECT.md`
- Spec Miner 1 Narrative & Audio Report: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/spec_miner_1/spec_report_narrative_audio.md`
- Project Bible & GDD: `docs/bible.md` and `docs/ch1-design.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Assigned Milestone: Milestone 2 — Narrative, i18n Dataset, Victorian UI Overlay & Procedural Web Audio Engine (Tracks B, C, H3, I)
Exclusive Write Ownership:
- `public/assets/i18n/**`
- `src/ui/**`
- `src/audio/**`

Tasks:
1. Trilingual i18n Dataset (`public/assets/i18n/ch1.json`):
   - Enforce Lewis Carroll 1865 text fidelity: All English dialogue/narration lines must be verbatim from the 1865 book.
   - Chinese localization lines must be elegant, Victorian literary style, strictly <= 28 characters per subtitle line.
   - Japanese localization lines following Victorian translation conventions.
   - Include 5 historical/scientific curiosity notes (Antipathies, Earth center fall duration 42 min, Marmalade, etc.) with trigger conditions.
   - Include two-tier stuck hints (60s gentle hint, 120s explicit solution hint) for puzzle states S5-S7.
   - Provide Zod schema validation in `src/core/i18nSchema.ts` (or `src/ui/i18n.ts`) to validate `ch1.json`.
2. Victorian Picture-Book UI Overlay (`src/ui/`):
   - 12 UI components styled as Victorian book pages with paper texture, ink borders, drop capitals:
     1. Title / Start Screen (Book Cover)
     2. Chapter Header ("Chapter I: Down the Rabbit-Hole")
     3. Subtitle / Dialogue box with speaker name & avatar frame
     4. 6-slot Inventory Bar with Victorian key/bottle/cake icons
     5. 3D Item Inspector modal overlay with rotate hint and two-sided read requirement
     6. Interaction Prompt HUD ("[E] Examine", "[F] Drink", etc.)
     7. Size Indicator (Height readout in feet/inches and meters)
     8. Curiosity Note Popup with illustrated book marginalia
     9. Stuck Hint Toast
     10. Pause Menu & Settings (Audio volume, Language EN/ZH/JA, Subtitle toggle)
     11. Cutscene Skip indicator (Hold Esc / button 1.0s to skip)
     12. Chapter Complete / Transition Card
   - Pure HTML/CSS without heavy frontend frameworks. SIL OFL fonts setup (`IM Fell English`, `Noto Serif SC`).
3. Procedural Web Audio Engine (`src/audio/`):
   - Pure Web Audio API synthesis engine (zero external audio file dependency required for base game to sound great!).
   - Music tracks M1 through M7 synthesized via Web Audio nodes (chords, harp, music box, ambient drone, clock tick).
   - 30 Sound Effects (SFX-01 to SFX-30) procedurally synthesized (rustle, rabbit scurry, wind whoosh, glass clink, liquid swallow, size scale whoosh, lock click, etc.).
   - 3D spatial PositionalAudio integration for Three.js.
   - Size-scaling audio pitch modulation (higher pitch and high-pass when Alice is small 0.254m, deep low-pass when normal/giant).
4. Verification:
   - Ensure `export PATH="$HOME/.local/bin:$PATH" && npm run build` passes with zero type errors.
   - Write a unit test in `tests/unit/i18n.test.mjs` or `tests/unit/audio.test.mjs` verifying `ch1.json` validity and audio node synthesis, and run `npm test`.
