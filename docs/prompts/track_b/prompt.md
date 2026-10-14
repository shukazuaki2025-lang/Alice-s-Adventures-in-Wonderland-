# Track B Subagent Prompt Package: Narrative Beats, Dialogue & Localization

## Track Overview
- **Track**: Track B (Story Beats B1, Dialogue Table B2, Curiosity Notes B3, Proofreading B4)
- **Role**: Narrative Writer & Trilingual Localization Lead
- **Target Output**: `public/assets/i18n/ch1.json`, `docs/ch1-design.md`, curiosity notes schema
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § B1–B4

---

## Direct Subagent Prompt

```markdown
You are the Narrative Scriptwriter and Localization Lead for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Generate the complete, valid trilingual dialogue and subtitle dataset at `public/assets/i18n/ch1.json`.
2. Follow strict localization and text preservation rules:
   - English (`en`): Preserve Lewis Carroll's 1865 text verbatim. Lines created for game mechanics must be labeled with `"note": "new"` or `"note": "adapted"`.
   - Chinese (`zh`): Independent translation tailored to a 7-year-old Victorian girl (plucky, polite, slightly formal). Do NOT copy copyrighted modern printed editions.
   - **Hard Rule**: Every `zh` line MUST be <= 28 characters.
   - Japanese (`ja`): Interface reserved; initialize as empty strings `""`.
3. Provide comprehensive coverage:
   - All finalized B1 beats (S0 to S7).
   - Variations for repeated interactions (e.g., doors 2 through 10 locked: at least 3 distinct variants).
   - Two-tier stuck hint dialogue (Tier 1 at 60s idle, Tier 2 at 120s idle) for each scene S1 to S7.
   - Complete UI and inventory strings (daisy, key, bottle, cake, jar, inspect, drink, eat).
4. Provide the 5 Curiosity Notes (`ch1_note_1` to `ch1_note_5`) corresponding to S3 thoughts:
   - Origin of Wonderland & Thames trip (1862).
   - Carroll's Oxford mathematical background & Earth radius 4,000 miles.
   - Victorian education & Latitude/Longitude grand words.
   - The "Antipathies" pun for Antipodes.
   - Dinah and Victorian house cats.

### Verification Criteria:
- `public/assets/i18n/ch1.json` parses cleanly as JSON.
- Zod schema validation in `npm run test` passes with zero errors:
  - All trigger IDs are unique and present.
  - No `zh` subtitle line exceeds 28 characters.
  - Required fields: `id`, `scene`, `trigger`, `speaker`, `type`, `zh`, `en`, `ja`, `dur`, `note`.
```
