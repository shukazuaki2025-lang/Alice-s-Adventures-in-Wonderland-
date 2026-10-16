# GEMINI.md

Read `AGENTS.md` (repo root) and `CLAUDE.md` before doing anything. The stop rule is non-negotiable:
**do not stop until `npm run gate` exits 0 and `docs/devlog/gate/VERDICT.md` says `Verdict: PASS`.**
Brief and work packages: `docs/review/ROUND2_TASK.md`.

**Current priority (2026-10-16): `main` is red — start with `docs/review/ROUND3_REVIEW.md` (PR-1 `fix/restore-npm-lockfile` first).**
Never push to `main`; use a topic branch + PR and wait for CI. npm only (`package-lock.json`), no `bun.lock`.
