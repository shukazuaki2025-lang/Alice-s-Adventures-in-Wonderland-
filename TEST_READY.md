# Playwright E2E Test Suite Ready (`TEST_READY.md`)
## `Alice: Down the Rabbit-Hole` — Opaque-Box Automated Playwright Test Suite (Tiers 1-4)

---

## 1. Test Suite Status Overview

The Playwright End-to-End (E2E) Test Suite for *Alice's Adventures in Wonderland — Chapter 1: Down the Rabbit-Hole* is complete, fully typed, and verified.

- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) passes cleanly with **ZERO errors**.
- **Features Covered**: 100% mapping of all 27 inventoried features in `PROJECT.md`.
- **Testing Tiers**:
  - **Tier 1 (Feature Coverage)**: Happy-path validation for all features 1–27 (`tests/e2e/tier1_features.spec.ts`).
  - **Tier 2 (Boundary & Corner Cases)**: BVA for Alice scale factors (1.20m -> 0.254m -> 2.90m), 6-slot inventory capacity, table reach vs height, door clearance (0.381m), and stuck hint timers (60s/120s) (`tests/e2e/tier2_boundaries.spec.ts`).
  - **Tier 3 (Cross-Feature Combinations & Puzzle Invariants)**: Cross-system interaction and verification of puzzle invariants INV-01 through INV-07 (`tests/e2e/tier3_combinations.spec.ts`).
  - **Tier 4 (Real-World Application Scenario)**: Uninterrupted walkthrough from `S0_TITLE` through `S1_BANK` → `S2_CHASE` → `S3_FALL` → `S4_PASSAGE` → `S5_HALL` → `S6_SMALL` → `S7_CAKE` → `END_CARD` (`tests/e2e/tier4_playthrough.spec.ts`).

---

## 2. Artifact Directory & File Inventory

1. `TEST_INFRA.md` — Authoritative E2E Test Specification & Category-Partition / BVA Mapping Matrix.
2. `playwright.config.ts` — Playwright runner configuration (headless Chromium, Vite dev server integration on port 5173, viewport 1280x720, `?forceWebGL=1&test=1` test harness support).
3. `tests/e2e/helpers/gameHarness.ts` — Strongly-typed helper wrapper for `window.__game` test harness API.
4. `tests/e2e/tier1_features.spec.ts` — Tier 1 Feature Coverage spec.
5. `tests/e2e/tier2_boundaries.spec.ts` — Tier 2 Boundary & Corner Case spec.
6. `tests/e2e/tier3_combinations.spec.ts` — Tier 3 Cross-Feature Combinations & Invariants spec.
7. `tests/e2e/tier4_playthrough.spec.ts` — Tier 4 Full Chapter 1 Playthrough spec.

---

## 3. How to Execute Tests

```bash
# 1. Verify TypeScript type safety across codebase and test suite
npm run typecheck

# 2. Run Playwright E2E Test Suite
npm run test:e2e
```
