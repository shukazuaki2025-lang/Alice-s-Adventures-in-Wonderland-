## 2026-10-14T08:27:42Z
You are worker_m1, a teamwork_preview_worker.
Your working directory is: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/worker_m1`
Your parent orchestrator is: teamwork_preview_orchestrator_1 (conversation ID: 96fcdb3d-2c70-4c56-b622-1b4e5ccd5a0b).

Authoritative source documents:
- Authoritative User Request: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/ORIGINAL_REQUEST.md` (READ THIS FIRST, verbatim)
- Full Chapter Specification: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`
- Project Master Blueprint: `/home/administrator/Alice-s-Adventures-in-Wonderland-/PROJECT.md`
- Explorer 1 Technical Report: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/explorer_1/exploration_report_engine_systems.md`
- Spec Miner 1 Narrative & Bible Report: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/spec_miner_1/spec_report_narrative_audio.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Assigned Milestone: Milestone 1 — Scaffolding, Build Pipeline & Project Bible (Tracks A, K1)
Exclusive Write Ownership:
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `src/main.ts`
- `CLAUDE.md`
- `docs/bible.md`
- `docs/ch1-design.md`
- `docs/prompts/**`
- `.github/workflows/ci.yml`

Tasks:
1. Environment & Scaffolding:
   - Check Node and npm availability in the environment (e.g. use available node/npm, install dependencies if network/packages permit, or create robust standard `package.json` with scripts: "dev", "build", "lint", "test:e2e", "preview").
   - Dependencies: `three`, `@types/three`, `@dimforge/rapier3d-compat`, `zod`, `vite`, `typescript`, `@playwright/test`.
   - Strict `tsconfig.json` ("strict": true, "noImplicitAny": true, target ES2022, moduleResolution bundler).
   - `vite.config.ts` supporting WebGPU / WebGL assets, static public/assets/ serving.
   - Minimal valid `index.html` and `src/main.ts` so Vite can build cleanly without errors.
2. Project Bible & Design Documentation:
   - Create `CLAUDE.md` at root: project architecture, conventions, Lewis Carroll 1865 text preservation rules, Victorian picture-book visual guidelines, metric standards, Blender tools usage.
   - Create `docs/bible.md`: World setting, character profiles (Alice in wheat-yellow dress #E9C46A with white pinafore apron #F7F3EA, White Rabbit with waistcoat and pocket watch), environment lore, strict no-Disney rules.
   - Create `docs/ch1-design.md`: Full Chapter 1 game design document covering S0 through S7, puzzle invariants (curtain lock, table transparency, golden key return, size scaling), cameras, cutscenes C1-C8.
   - Create `docs/prompts/<track>/`: Subagent prompt packages for all tracks (Track A through Track K).
3. CI Workflow:
   - Create `.github/workflows/ci.yml` with jobs for lint, typecheck (`tsc --noEmit`), build (`vite build`), and Playwright test stub.
4. Verification:
   - Execute verification commands (e.g. install, typecheck / build test) and record results in your handoff.

Output Requirements:
- Write your 5-component handoff report (`handoff.md`) in `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/worker_m1/handoff.md`.
- Keep `progress.md` updated with liveness timestamps.
- When complete, notify parent orchestrator via `send_message`.
