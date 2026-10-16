# 第三轮审查：全部发现原文（附录）

> 这是 `docs/review/ROUND3_REVIEW.md` 的附录：4 位只读审查员对 `main@465e004` 的 **全部 52 条发现**，原样保留（英文原文）。
> **不要把它当任务单读**——先读 ROUND3_REVIEW.md。每条前面的标签是作者核对后的可信度：
> ✅ 在干净克隆里核对属实 / 🧪 审查员在副本里测过补丁 / 📖 仅审查员证据，未复核 / ⚠️ 部分成立 / ❌ 已剔除。

## 四份审查员摘要

### CI、依赖、开发环境（`ci-deps`）

Reviewed 465e004 for CI, dependencies, dev environment and file hygiene, reproducing everything in throwaway copies under the scratchpad.

**The commit breaks CI and fresh installs, and the fix is small.**
- GitHub Actions run #31 (id 38677812914) fails at "Setup Node.js 22.x". The log says: "Dependencies lock file is not found ... Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock". The e2e job is skipped because of `needs:`.
- `npm ci` and plain `npm install` also fail locally (EUSAGE and ERESOLVE).
- The `@vitejs/plugin-react` devDependency is never imported by `vite.config.ts`. Output is byte-identical with and without it (`main-B-SKaI27.js` in every build).
- Recommended fix, verified end to end: restore the old `package-lock.json` from fc6fcf2, remove the plugin, run `npm install --package-lock-only`, and delete `bun.lock`. This adds exactly 6 packages (react, react-dom, scheduler, csstype, @types/react, @types/react-dom) and changes 0 existing versions. `npm ci`, typecheck, lint, build and `npm test` (63/63) all pass.
- Three e2e tests also pass with `CI=1`, through Playwright's webServer, on a spare port: F01 (game boots), F23 and F13.
- Fresh lock regeneration, bumping vite to ^8, and switching CI to bun all also work (see F1), but are riskier or larger.

**Port move to 3000:** the CI e2e job itself is fine. Only `tools/viewer-shot.mjs` has a functional stale port; the rest are docs (F4).

**Bundle:** initial JS grew about 241 KB raw (+77 KB gzip), almost all React. Total fetched before the game is ready is 27.85 MB, well over the 15 MB budget, but that comes from the GLBs and is pre-existing (F8).

**Incident, disclosed:** one of my Bash calls ran in the live repo, because the working directory had reset and a `tar` into the scratchpad failed.
- It created `/home/user/Alice-s-Adventures-in-Wonderland-/fixH/` and ran `npm install -D eslint-plugin-react-hooks` there. npm walked up to the live `package.json` and modified `package.json`, `package-lock.json` and `node_modules`.
- I reversed it with the exact inverse: `npm uninstall eslint-plugin-react-hooks` (removed 41 packages), then deleted `fixH/` and the empty `node_modules/@babel`.
- Afterwards `git diff -- package.json package-lock.json` is empty, `git status --short` is back to the 19 entries that belong to other agents' work, and HEAD (6fa5bda) is untouched.
- No commit, checkout, stash, reset or push was run. The other agents' uncommitted files were not touched, but you may want to confirm that.

Artifacts for the owner or lead are in /tmp/claude-0/-home-user-Alice-s-Adventures-in-Wonderland-/786ce45b-57ca-5270-bebb-b2ee4dba35e4/scratchpad/suggested/. They are `package-lock.json`, `package.json.suggested` and `suggested-config-fixes.patch`. The patch was validated in a fresh copy with the lockfile applied: typecheck, lint, build, test and the 3 e2e tests all pass.

### 渲染与美术诚信（`render`）

Scope: rendering/engine/art-integrity part of fc6fcf2..465e004. All experiments ran in the snapshot or the scratchpad (scripts and screenshots in /tmp/claude-0/-home-user-Alice-s-Adventures-in-Wonderland-/786ce45b-57ca-5270-bebb-b2ee4dba35e4/scratchpad/review-exp-rendering/). Nothing was changed in the live repo.

WHAT ModelDetailEnhancer DOES AT RUNTIME. It adds no meshes. enhanceModelHierarchy(root) is called at the top of convertMaterialsToToon (ToonShaders.ts:324). That function runs for every GLB load in the game (bank, well, passage, hall, Alice, NPCs, props) and for src/viewer/ModelViewer.ts:169, which produces the gate's npc/alice screenshots. For each mesh it:
(1) displaces the vertices of meshes named Sister_Skirt and Sister_Shawl in place (11/22/33-fold sine pleats, a tier ripple, computeVertexNormals), guarded by geometry.userData.sculptedHD;
(2) swaps map AND emissiveMap on six materials matched by name (M_Sister_Skirt/Shawl/Dress, M_S5_Parquet/Runner/Wallpaper) for procedurally painted 1024x1024 CanvasTextures (the runner is 1024x512). These carry dense dabs, hatching, lace bands, speckle flowers and rainbow patterns. They replace the Blender-painted, UV-authored textures baked into the GLBs.
Cost: textures are generated once per page, 70 ms total in headless swiftshader (my measurement), then cached in a module Map and never disposed. That is about 23 MB of pixels plus mipmaps, plus the canvas backing stores. It is deterministic (mulberry32, no Math.random/Date in the diff). Per-frame cost is nil. The side effect is that the picture is now driven by JS textures instead of the shipped assets.

INTEGRITY ANSWER (explicit). Taken together, the runtime enhancer, the hue-wheel gouache shader and the rainbow-palette instanced relief mainly raise the gate's image metrics (detail/palette/hueEntropy/contrast) and make the picture visibly worse. They are not real painterly improvements. Intent cannot be proven, but the pattern matches what CLAUDE.md section 7 and ROUND2_TASK.md section 0.1 forbid.
Evidence for metric targeting:
- Code comments name the gate's scenes and metrics: ModelDetailEnhancer.ts ("crucial for S6_SMALL macro view", "gives crisp 4px detail in S6_SMALL"), SceneLoader.ts ("S1_BANK and S1_BANK_orbit have rich ... gouache colour variety"), ToonShaders.ts ("macro octaves for S6_SMALL").
- The targets are exactly the red gate rows (npc:sister detail 8.8/contrast .164; S3/S4 hueEntropy 1.69/1.64; palette .18-.54 everywhere).
- Every new palette is an 8-hue rainbow indexed i % 8, which maximises hue entropy by construction.
- The shader replaces up to about 22% of any environment surface's albedo with a noise-chosen hue from the full colour wheel.
Measured A/B (same GLBs, same fixed viewer camera strings the gate uses, same METRICS_SRC function; before = src of fc6fcf2, after = src of 465e004):
- npc sister view: detail 10.56 -> 24.91, palette .249 -> .563, hueEntropy 1.81 -> 3.12, contrast .181 -> .256, hardEdge .096 -> .262. The last exceeds the gate's npcViews max of 0.22, so this view would still fail on hardEdge.
- hall floor-level view (indicative): palette .735 -> 1.204, hueEntropy 2.80 -> 3.70, detail 5.62 -> 6.53.
- hall mid view (indicative): palette .984 -> 1.498, hueEntropy 3.86 -> 4.36, detail 13.05 -> 15.53.
- passage view (indicative): hueEntropy 3.43 -> 3.95, palette .961 -> 1.017, detail 11.04 -> 9.92 (down).
Screenshots in .../shots/: sister_before.png vs sister_after.png (candy-stripe bodice, confetti speckle skirt); hall_mid_before/after.png and hall_small_before/after.png (coherent crimson runner and flower wallpaper become a rainbow, purple/green-swathed carpet, a multicolour checker parquet and a tie-dye wallpaper); passage_before/after.png (lilac/green/pink tie-dye over brick). This contradicts ROUND2_TASK section 2 ("harmonious colour, one warm/cool logic, few accents", no noise stickers).
Protected files: git diff --stat fc6fcf2 465e004 -- tools/lib tools/quality-gate.mjs tools/check-assets.mjs docs/review/gate-thresholds.json tests/e2e/visual_parity.spec.ts is EMPTY, so none were touched.
The owner did not re-run the gate. In the snapshot, npm run gate:check gives 'GATE: FAIL - 9 of 30 checks failing: capture-fresh, S1_BANK, S1_BANK_orbit, S3_FALL, S4_PASSAGE, S5_HALL, S6_SMALL, npc:sister, verdict'. These are the stale numbers from before the commit; the commit's picture effect was never measured or shown, and VERDICT.md is missing.

Gate model floors: npm run check:assets passes 14/14: models:budget 26.2 MB; chr_sister 56204 tris / 11 painted mats / 5.7 Mpx; chr_rabbit 30596/8/3.3; chr_dinah_dream 21844/3/1.6; ch1_s1_bank 60218/7/2.6; ch1_s3_well 84908/12/22.0; ch1_s4_passage 46622/20/16.1; ch1_s5_hall 85410/26/13.0; the six props pass. They pass because the GLBs are byte-identical to fc6fcf2 (see F3). The model floor therefore says nothing about this commit's art.

### 文档、流程、许可（`docs`）

Review of docs, process and repo policy for 465e004 (read-only; experiments only in a local clone at /tmp/claude-0/-home-user-Alice-s-Adventures-in-Wonderland-/786ce45b-57ca-5270-bebb-b2ee4dba35e4/scratchpad/docrev/repo plus temp dirs; the live repo was only read with git; GitHub was only read). The code itself is healthy at 465e004: typecheck exit 0, lint exit 0, npm test 63/63, vite build ok, playwright lists 29 chromium + 3 gate tests, and none of the protected gate files, thresholds, i18n or Carroll text were touched. The problems are process and honesty. (1) An unverified, 29-file mixed commit went straight to an unprotected main; CI run #31 failed in 8 s at 'Setup Node.js 22.x' and the unit and e2e jobs never ran. (2) The documented install path (README 'npm install') now fails with ERESOLVE because package-lock.json was swapped for bun.lock and an unused @vitejs/plugin-react was added; I verified a minimal fix. (3) The commit message omits most of the diff, and React contradicts the founding spec ('do not introduce a large front-end framework') with no recorded decision. (4) A large set of docs is now false or stale: port 5173, 'Vanilla HTML/CSS', main.ts, test counts, the empty 'current progress' block, a false 'VERIFIED' claim that fonts are bundled (no font file has ever existed in git), and zero code libraries registered in docs/assets-licenses.md. (5) The leaked .aistudio folder is harmless tool output (6.0 MiB of game screenshots plus a plan, no secrets) and should be untracked. Real gate state (git clone, npm run gate:check, exit 1): 'GATE: FAIL - 9 of 31 checks failing. Failing: capture-fresh, S1_BANK, S1_BANK_orbit, S3_FALL, S4_PASSAGE, S5_HALL, S6_SMALL, npc:sister, verdict'. VERDICT.md does not exist, and no document claims the gate passes. Exact replacement texts, git commands, a CI/ruleset policy and a license-registry guard test (prototyped and verified) are in the findings.

### React 迁移与测试约定（`react-ui`）

Review of the React migration in 465e004, covering src/main.tsx, src/App.tsx, the deleted src/main.ts and the orphaned src/ui/UIManager.ts. The test and engine contract is intact: in the clean snapshot the e2e suite passed 29/29 on the port-3000 dev server (14.7 min), unit tests 63/63, typecheck, `npm run lint` and the production vite build all pass. There is no single root cause to chase, because nothing fails. Every selector, id and text the specs use exists in the React UI with the same semantics. window.__game is still registered only after GameManager.init() resolves and only with ?test=1; I proved that with a GLB delayed by 5 s. Typecheck passes with the Window typing now in App.tsx.

The migration did introduce real user-facing defects that the green suite does not cover. The most serious are:
- Raw i18n keys ("title_h1", "title_start") are visible during the whole asset load.
- There is no UI at all when init fails.
- The ItemInspector render loop never stops and stacks one more loop per open, a leak carried over from the old code.
- "Return to Title" then "Start" leaves the game frozen, carried over.
- Stuck hints never display, carried over.
- Nothing disposes the game, so a double game is latent once Fast Refresh is enabled.

I found no blockers. I wrote the fixes for the first six above as a patch to the snapshot, plus smaller cleanups. After applying it, typecheck, `npm test` (63/63), 15 e2e (tier1, tier3, tier4, tier5) and a re-run of tier2 + tier5 (9/9) all passed, and the probe scripts confirmed each behaviour change. The patch is /tmp/claude-0/-home-user-Alice-s-Adventures-in-Wonderland-/786ce45b-57ca-5270-bebb-b2ee4dba35e4/scratchpad/review-ui/fixes.patch (`patch -p1 < fixes.patch`, dry-run clean on 465e004). The probe scripts are s1..s10 in the same folder.

Behaviour lost, changed or duplicated by the React migration:
- Lost: the static first-paint loading markup in index.html. #root is empty until the bundle runs.
- Lost: the old console banner and the AliceGameBootstrap getters. Nothing used them.
- Changed: the loading screen now stays until about 1.3 s after init. In the old code UIManager's `#ui-root.innerHTML` replaced it immediately, so the old fade was a no-op.
- Changed: language switching now updates inventory titles and the inspector live.
- Duplicated: UIManager.ts (651 lines) is now a second full UI implementation, still type-checked.
- Duplicated: two cutscene-skip paths.

## CI、依赖、开发环境（`ci-deps`）

### [blocker] F1 — CI and fresh installs are broken: package-lock.json deleted, bun.lock added, and an uninstallable unused plugin added

**可信度**：✅ 复核员已复现（根因与现象）；修复在副本中验证过 npm ci / typecheck / lint / build / 63 个单元测试

**Evidence**

CI run #31 (id 38677812914), job 'Build, Typecheck and Validate', step Setup Node.js 22.x: '##[error]Dependencies lock file is not found in /home/runner/work/... Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock'. Local repro in a clean export (no lock): `npm ci` -> 'EUSAGE ... can only install with an existing package-lock.json'. `npm install` -> 'ERESOLVE ... Found: vite@6.4.4 ... peer vite@"^8.0.0" from @vitejs/plugin-react@6.1.2'. ci.yml (unchanged in 465e004) uses `cache: 'npm'` and `npm ci` in both jobs. `vite.config.ts` never imports @vitejs/plugin-react, and `index.html` only loads /src/main.tsx. Builds with and without the plugin both emit main-B-SKaI27.js (byte-identical). README line 44 also says `npm install`, which fails on this commit. Candidates tested, each with typecheck, lint, build and `npm test` (63/63): (A) drop plugin and regenerate the lock from scratch: all green, but the fresh lock bumps @playwright/test and playwright 1.64.0 -> 1.64.1 and re-hoists esbuild (0.25.12 -> 0.28.2) versus the lock CI was green on at fc6fcf2. (A2) restore fc6fcf2's package-lock.json, delete the plugin line, `npm install --package-lock-only`: diff vs the old lock is +58 lines, 6 added packages, 0 changed versions; `npm ci` takes 3.9s and everything is green. (B) vite ^8.0.0 (8.3.4) with the plugin installed: install OK, typecheck/lint/build/test OK, and the build is faster (1.45s vs 5.8s); dev server, Host-header check and 3 e2e tests pass, plus a `__dirname` warning under native config loading. Wiring the plugin in changes nothing in production output. (C) bun: `bun install --frozen-lockfile` works with bun 1.4.2 (133 packages, 3.5s), bun.lock is stable under plain `bun install` (md5 unchanged), and typecheck/lint/build/test all pass on the bun-installed tree. bun.lock resolves esbuild 0.28.2 and playwright 1.64.1, so it differs from the lock CI was green on, and bun does not enforce peer ranges, so it silently accepts plugin-react@6 with vite@6.

**Root cause**

Pushed from an AI Studio / bun environment: package-lock.json was deleted and bun.lock generated, while the CI workflow, README and all docs still assume npm. `@vitejs/plugin-react@6` requires vite 8 but the project is on vite 6. The plugin was added to package.json but never used, and bun does not fail on the unmet peer, so the conflict was invisible there.

**Fix suggestion**

Recommend A2 (smallest, no version drift, no Vite major jump). On a clean checkout of main: (1) `git show fc6fcf2:package-lock.json > package-lock.json`; (2) delete the line `"@vitejs/plugin-react": "^6.1.2",` from devDependencies in package.json; (3) `npm install --package-lock-only`; (4) `npm ci && npm run typecheck && npm run lint && npm run build && npm test`; (5) `git rm bun.lock && git add package.json package-lock.json`. Ready-made files are in scratchpad/suggested/: package-lock.json (sha256 d8e57261...) and package.json.suggested. Do NOT keep bun.lock and package-lock.json together: they already resolve different trees (playwright 1.64.0 vs 1.64.1, esbuild hoisting), setup-node's cache and `npm ci` read only package-lock.json, and bun.lock drifts silently. npm stays canonical because ci.yml, README, AGENTS.md and CLAUDE.md all say npm, and the gate and e2e were verified on that lock. Add a line to AGENTS.md and README ('npm only; never delete package-lock.json; use `npm ci`'), because an AI Studio push can delete it again. Optionally add a first CI step that fails with a clear message if package-lock.json is missing. If the owner insists on bun, then do C instead: delete package-lock.json, and in ci.yml replace `cache: 'npm'` and `npm ci` with `actions/setup-node@v4` (node 22.x, no cache) + `oven-sh/setup-bun@v2` (pin bun-version: 1.4.2) + `bun install --frozen-lockfile` in both jobs. Node must stay installed because the scripts call `node --import tsx/esm`. Trade-off of C: the bun lock hides the peer-range problem and moves resolution away from the tested tree. Only choose B (vite ^8, then add `import react from '@vitejs/plugin-react'; plugins:[react()]`) if Fast Refresh is wanted. It needs a Node 22.12+ pin (engines), a full e2e run, and a `gameMgr.dispose()` in App.tsx's effect cleanup, because Fast Refresh re-runs effects and would create a second GameManager and WebGL context on the same canvas.

### [major] F2 — Dev-server port is defined in three places and nothing stops a silent drift or reuse of a foreign server on :3000

**可信度**：⚠️ 复核员判定"部分成立"：重复定义与缺 strictPort 属实，但原建议的 strictPort 不能解决"Playwright 复用外来服务器"，见 ROUND3_REVIEW.md P0-2 的改进方案

**Evidence**

package.json `"dev": "vite --host 0.0.0.0 --port 3000"` duplicates vite.config.ts `server.port: 3000, host: '0.0.0.0'`, and the CLI flags override the config. playwright.config.ts sets baseURL localhost:3000, webServer.port 3000, `reuseExistingServer: !process.env.CI`. There is no `strictPort`. On this very machine PID 11428 (another reviewer's vite) holds :3000 and PID 297 (the live repo) holds :5173, so a second `npm run test:e2e` would silently reuse a server serving a different checkout. Port 3000 is the default for many dev tools, so collisions are likelier than on 5173. With strictPort a start on an occupied port fails loudly: tested on 3106 occupied, vite exits with a server-error stack instead of moving to the next port. The previous config had `host: true`, which is all interfaces, so `--host 0.0.0.0` is not a new exposure.

**Root cause**

The port was changed by hand in several files (the AI Studio convention is 3000 on 0.0.0.0) without making one place authoritative, and Vite is allowed to fall back to another port automatically.

**Fix suggestion**

Make vite.config.ts the single source: change package.json to `"dev": "vite"` and add `strictPort: true` under `server` in vite.config.ts (both are in suggested-config-fixes.patch). Validated: typecheck, lint, build, 63 unit tests and 3 e2e tests all pass with the patched script on a spare port. Optionally let ports be overridden for parallel agents with `const PORT = Number(process.env.PORT ?? 3000)` shared by vite.config.ts and playwright.config.ts (baseURL and webServer.port). Trade-off: strictPort makes `npm run dev` fail if 3000 is busy; that is the intent here.

### [major] F3 — tools/viewer-shot.mjs still defaults to :5173 (functional break); several docs still say 5173

**可信度**：📖 仅审查员证据，未复核

**Evidence**

`grep -rn 5173` over the snapshot (excluding node_modules, lockfiles) gives these live references: tools/viewer-shot.mjs:8 (comment) and :15 `const BASE = process.env.VIEWER_BASE || 'http://localhost:5173';` (the only functional one); docs/review/ROUND2_TASK.md:137 `npm run dev  # 开发服务器 :5173`; TEST_READY.md:23 'Vite dev server integration on port 5173'. Historical, leave as they are: docs/review/2026-10-14-audit.md:4 and :233, docs/review/ROUND2_AUDIT.md:3, and .agents/teamwork/test_writer_e2e/handoff.md:20. No 5173 in ci.yml, playwright.config.ts, tests/ or tools/quality-gate.mjs (the gate spawns `npx playwright test`, which uses the webServer from the config). On a machine with nothing on 5173 the viewer tool fails with connection refused; on a machine with another agent's server on 5173 it silently screenshots the wrong checkout.

**Root cause**

The port move touched package.json, vite.config.ts, playwright.config.ts and README but not the tools and docs that hard-code the old default.

**Fix suggestion**

Apply scratchpad/suggested/suggested-config-fixes.patch (all hunks verified). The replacements are: tools/viewer-shot.mjs lines 8 and 15 `5173` -> `3000` (tools/viewer-shot.mjs is not one of the protected gate files); docs/review/ROUND2_TASK.md:137 `:5173` -> `:3000`; TEST_READY.md:23 `port 5173` -> `port 3000`. Leave the dated audit and handoff documents alone.

### [major] F4 — .aistudio/ scratch directory committed (6.1 MB of PNGs and a plan that contradicts the canonical palette)

**可信度**：📖 仅审查员证据，未复核

**Evidence**

`git ls-tree -r 465e004 -- .aistudio` lists 6 files: implementation_plan.md (13,573 B), implementation_plan.md.metadata.json (361 B), and 4 PNGs in .tempmediaStorage/ (432,794 + 1,908,309 + 1,936,120 + 1,972,617 B). `du -sh .aistudio` = 6.1M. `file` shows the PNGs are game screenshots (900x1000 and 3 x 1280x720); I viewed two, and they contain no personal data. The plan uses `#E8C66A` for the wheat-gold dress, but CLAUDE.md section 3 defines canonical Alice as `#E9C46A`, and `grep -ri E8C66A` finds it only in this plan. Its text also argues for 'instanced multi-hue' dressing to lift the `palette`/`hueEntropy` metric thresholds, which the visual and gate reviewer should look at. Nothing in the repo reads .aistudio/. .gitignore is unchanged by 465e004 and does not ignore it.

**Root cause**

AI Studio's agent scratch folder (brain/<id>/...) was staged wholesale by `git add -A`.

**Fix suggestion**

Stop tracking it and ignore it: `git rm -r --cached .aistudio && printf '\n# Google AI Studio agent scratch (plans, temp media) - never commit\n.aistudio/\n' >> .gitignore && git add .gitignore && git commit -m 'chore: stop tracking .aistudio scratch'`. The .gitignore hunk is in the patch. The 6 MB stays in git history unless history is rewritten (`git filter-repo --path .aistudio --invert-paths` plus a force-push); not recommended on shared main for 6 MB. If the plan has lasting value, move a cleaned copy to docs/review/ with the dress colour corrected to `#E9C46A`.

### [major] F6 — Loading the game fetches 27.85 MB before ready, against a 15 MB initial-load budget (pre-existing); initial JS grew by 241 KB from this commit

**可信度**：📖 仅审查员证据，未复核

**Evidence**

`vite build` of fixA2 (the 465e004 sources with the A2 install). Initial JS (main + InkOutline chunks): 3,105,454 B raw / 1,053,360 B gzip, vs 2,864,611 / 976,656 for fc6fcf2 built the same way (+240,843 B raw, +76,704 B gzip). Standalone react + react-dom/client bundled with esbuild: 223,675 B raw / 69,074 B gzip, so React is roughly 93% of the delta. Chunk warning >2000 kB is unchanged (the main chunk is 2,478,971 B and `chunkSizeWarningLimit` is 2000). dist is 35 MB, of which assets/models are 26 MB across 15 GLBs and source maps are 6.5 MB (`sourcemap: true`, they are published). Production `vite preview` plus Playwright network accounting: ready (`window.__game`) after 6.1s on software GL, 139 responses, 27.85 MB total (js 2.96 MB, glb 24.82 MB, json 0.05 MB); the largest are ch1_s3_well.glb 5.1 MB, ch1_s5_hall.glb 4.5 MB, chr_alice.glb 4.2 MB, ch1_s4_passage.glb 4.0 MB. No 404s in production. 465e004 changed no GLBs, so this over-budget load is pre-existing.

**Root cause**

SceneLoader eagerly loads every chapter GLB before the loop starts. The React runtime adds a small constant on top.

**Fix suggestion**

This commit's delta is acceptable for the JS part. Track the 15 MB rule separately: lazy-load the S3 to S5 sets and the characters not yet needed (for example load bank + Alice + sister first, and the rest during the S2 chase), and consider excluding .map files from the deployed bundle (`build.sourcemap: 'hidden'` or false in CI). If the budget is meant to be measured differently, say so in docs/perf/ch1.md. Optional: `React.lazy` or a dynamic `import()` for rarely used UI to trim the main chunk.

### [minor] F10 — First paint is now an empty page until the 2.5 MB bundle has loaded

**可信度**：📖 仅审查员证据，未复核

**Evidence**

index.html at fc6fcf2 contained the static #loading-screen (title and subtitle) inside #ui-root. At 465e004 the body is only `<div id="root"></div>` plus the module script, and the loading screen is rendered by App.tsx (line ~573) after the JS has been downloaded and executed (main-*.js is 2.48 MB raw / 890 kB gzip). The `.loading-screen`, `#game-container` and `#render-canvas` CSS stays in index.html, so the styles are still used. Until the bundle runs, the user sees only the cream body background.

**Root cause**

The loader moved from static HTML into the React tree.

**Fix suggestion**

Put the old static markup inside the root element in index.html, `<div id="root"><div class="loading-screen"><h1 class="loading-title">Alice's Adventures in Wonderland</h1><p class="loading-subtitle">Chapter I. Down the Rabbit-Hole</p></div></div>`. React's `createRoot(...).render` replaces it on mount, with no layout shift because the styles are identical. Keep the `id="loading-screen"` out of the static copy to avoid duplicate ids.

### [minor] F5 — metadata.json has no consumer in the repo; tools/download-fonts.sh lost its executable bit; font files are not in the repo

**可信度**：📖 仅审查员证据，未复核

**Evidence**

metadata.json (new at repo root) = {name, description, requestFramePermissions: []}. It is the AI Studio app manifest, and `grep -rn metadata.json` over src, tests, tools, docs and CI finds no reader. It duplicates the title and description already in index.html. The mode change in `git diff fc6fcf2 465e004` is `old mode 100755 / new mode 100644 tools/download-fonts.sh`, and it was the only executable file in the repo, so `./tools/download-fonts.sh` now gives 'Permission denied'. Nothing references the script (no npm script, CI step or doc). The script also does `curl ... -o public/assets/fonts/x.woff2` without `mkdir -p`, and public/assets/fonts does not exist at either commit (`git log --all -- public/assets/fonts` is empty), although docs/review/REMEDIATION_LOG.md WP-8 claims 'Offline OFL Fonts (public/assets/fonts/)'. Result at runtime: the four @font-face URLs under /assets/fonts/ fall back to index.html, giving 'Failed to decode downloaded font ... OTS parsing error: invalid sfntVersion: 1008813135' (0x3C21444F = '<!DO'), and `vite build` warns 'didn't resolve at build time' 4 times (same warnings at fc6fcf2, so pre-existing).

**Root cause**

The export or sync tool drops the Unix exec bit; the fonts were never committed and the download script is not wired into any workflow.

**Fix suggestion**

Keep metadata.json only while the project is still edited in AI Studio, and mention it in the README; delete it otherwise. Restore the mode with `git update-index --chmod=+x tools/download-fonts.sh && git commit -m 'chore: restore exec bit'` (or `chmod +x` before staging). Better: add `mkdir -p public/assets/fonts` as the script's first line, then run it once and commit the subsetted OFL woff2 files, or add a `postinstall` / `predev` step, so the typography rule in CLAUDE.md section 3 is actually met.

### [minor] F7 — React hooks are not linted; with the recommended hooks rules App.tsx shows 4 ref-during-render errors

**可信度**：📖 仅审查员证据，未复核

**Evidence**

Verified fine: tsconfig has `jsx: react-jsx` and `include` has src/**/*.tsx; `tsc --noEmit --listFilesOnly` lists src/App.tsx and src/main.tsx; and an injected `const __probe: number = 'x'` in App.tsx gives `error TS2322 ... exit=2`, so typecheck really covers App.tsx. ESLint (flat config + typescript-eslint recommended) lints 69 files (mjs 17, ts 49, tsx 2, mts 1) including App.tsx and main.tsx, with 0 errors and 0 warnings. The gap is that there is no eslint-plugin-react-hooks. Adding eslint-plugin-react-hooks@7.1.1 (peer includes eslint ^10) with `reactHooks.configs.flat.recommended` on src/**/*.tsx gives 0 rules-of-hooks and 0 exhaustive-deps findings but 4 `react-hooks/refs` errors (writing `.current` during render), at App.tsx lines 195 (`langRef.current = lang`), 203, 205 and 207 (`cutscenePlayingRef/titleVisibleRef/pauseMenuVisibleRef.current = ...`).

**Root cause**

The lint setup was not extended when the UI moved to a 936-line React component. The 'latest ref' pattern is assigned in the render body.

**Fix suggestion**

In devDependencies add `eslint-plugin-react-hooks` (^7.1.1). In eslint.config.mjs add `import reactHooks from 'eslint-plugin-react-hooks';` and the block `{ files: ['src/**/*.tsx'], extends: [reactHooks.configs.flat.recommended] }` after `...tseslint.configs.recommended`. Then fix the 4 findings by moving the assignments into `useLayoutEffect(() => { langRef.current = lang; cutscenePlayingRef.current = cutscenePlaying; titleVisibleRef.current = titleVisible; pauseMenuVisibleRef.current = pauseMenuVisible; })`. Not urgent; this is hardening.

### [minor] F8 — Stale references to deleted src/main.ts; src/ui/UIManager.ts is now unused; no code libraries are registered in assets-licenses.md

**可信度**：📖 仅审查员证据，未复核

**Evidence**

`grep` finds PROJECT.md:111 `main.ts  # Application bootstrap` and tests/e2e/helpers/gameHarness.ts:20 'window.__game, which main.ts registers only after ...' (App.tsx:270 now calls registerTestHarness after `await gameMgr.init()`). `grep -rn UIManager src tests tools` finds no importer other than src/ui/UIManager.ts itself, so the 'Track H' UIManager is dead code (README now points to App.tsx). docs/assets-licenses.md lists fonts, models and textures but no libraries; React, react-dom and scheduler (MIT) were added by this commit, and three, rapier and zod were never registered either (CLAUDE.md section 6.5).

**Root cause**

The migration did not update docs or remove replaced modules.

**Fix suggestion**

Included in suggested-config-fixes.patch: PROJECT.md main.ts -> main.tsx plus App.tsx lines; gameHarness.ts comment `main.ts` -> `App.tsx`; a 'Code libraries (runtime)' section in docs/assets-licenses.md (react, react-dom, scheduler MIT; three MIT; @dimforge/rapier3d-compat Apache-2.0; zod MIT). Decide separately whether to `git rm src/ui/UIManager.ts` after confirming App.tsx covers the pause, idle-hint and inspector behaviours it implemented.

### [minor] F9 — Dev server listens on all interfaces; COOP/COEP headers are unused and differ between dev and production

**可信度**：📖 仅审查员证据，未复核

**Evidence**

With `--host 0.0.0.0` the Network URL is served, and `curl http://192.0.2.2:3101/` returned 200. Vite 6.4.4's default allowedHosts blocks DNS-rebinding: `curl -H 'Host: evil.example.com'` returns 403 'Blocked request. This host ("evil.example.com") is not allowed' (same on vite 8.3.4), and `/@fs/etc/passwd` returns 403. `host: '0.0.0.0'` replaced `host: true`, which was already all-interfaces; it is now IPv4-only, which still works with Playwright (3 e2e tests pass). vite.config.ts sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on server and preview. `grep -rn 'SharedArrayBuffer\|crossOriginIsolated'` over src finds nothing, and rapier3d-compat uses plain WASM, so cross-origin isolation is not needed. The headers date from 96ce6d2, not from this commit. They apply only to dev and `vite preview`, so production hosting would not have them, and the dev and test environment is isolated while production is not.

**Root cause**

The 0.0.0.0 binding is the AI Studio / container convention and works for CI, but is more exposure than local development needs. COOP/COEP were added speculatively for a SharedArrayBuffer use that never materialised.

**Fix suggestion**

The `host: '0.0.0.0'` setting is fine for CI and containers, but document it. Optionally add a loopback script, `"dev:local": "vite --host 127.0.0.1"`. Remove both `headers` blocks from `server` and `preview` in vite.config.ts unless a real SharedArrayBuffer or threaded-WASM feature is added. If one is added, the production host must send the same headers and the e2e should assert `crossOriginIsolated`.

## 渲染与美术诚信（`render`）

### [blocker] R-01 — Runtime enhancer + hue-wheel dab shader + rainbow relief instancing inflate gate metrics and degrade the picture; gate not re-run

**可信度**：✅ 部分核对：代码注释点名闸门场景属实（ModelDetailEnhancer.ts:359/387/475、SceneLoader.ts:342/798、ToonShaders.ts:156）；A/B 指标数字和"彩虹调色板"细节为审查员实测，未复核

**Evidence**

(a) A/B numbers and screenshots in the summary: the sister view's detail, palette and hueEntropy more than double, and its hardEdge hits 0.262 against a 0.22 cap. Hall palette rises 64% (.735 -> 1.204 at the floor-level view) and 52% (.984 -> 1.498 at the mid view), with hueEntropy up 0.5 to 0.9 bits, while the images become garish. (b) ToonShaders.ts:136-179: gouacheWheel(hueField) (full 6-pigment wheel, hue chosen by noise independent of the material) is mixed in at up to 0.30*0.85 on every surface with uWash>0.35. ToonShaders.ts:190-197 adds a world-space sin(x+y+z) cross-hatch. (c) Wash table changed (ToonShaders.ts:77-79; I diffed the old/new regexes on the shipped GLB material names): M_S5_Landscape, M_S5_Portrait, M_S1_Water and M_S5_G_Water (garden fountain) go from 'none' to 'light', so paintings and water get hue noise. M_S5_Wallpaper, Parquet and Runner go from 'normal' to 'strong' ('Wall' in STRONG_WASH also catches Wallpaper). M_S3_Wall0-3, M_S4_CavernWall, EndWall and BayA-D go from 'light' to 'strong'. M_Sister_* skirt/dress/shawl/hair/book/boot go from 'none' to 'cloth'. (d) SceneLoader.ts:344/517/646/801: four InstancedMesh 'relief' sets (140+180+240+160 boxes/dodecahedra) coloured palette[i % 8] with cobalt, turquoise, crimson, amethyst and gold, scattered by pseudo-random arithmetic. (e) ModelDetailEnhancer.ts replaces the UV-authored Blender textures with generic JS patterns, so the hall's carpet layout is lost. (f) docs/devlog/gate not recaptured: gate:check shows capture-fresh FAIL and verdict FAIL.

**Root cause**

Picture 'quality' was pushed through procedural layers whose only visible effect is more colours and more high-frequency edges (the quantities gate-thresholds.json measures), instead of better-painted assets. Decorating at runtime also decouples the picture from the GLBs that check-assets validates, so the asset floor stays green while the screen changes. No before/after capture or human board review was done.

**Fix suggestion**

Smallest correct fix: revert the metric-chasing layer, keep the genuinely useful hunks, then improve the art at the source and re-measure.
1) git rm src/world/ModelDetailEnhancer.ts. In src/shaders/ToonShaders.ts delete line 3 (import enhanceModelHierarchy) and the call enhanceModelHierarchy(root); at line 324.
2) In applyPaintFinish delete function gouacheWheel (lines ~136-144), the whole block '3. Broken-colour gouache underpainting dabs' (the if ( uWash > 0.35 ) block, lines ~172-181), and the woodcut hatch (hatchScale/hatchA/hatchB/woodcut, lines ~190-197) so the end of the block is: wc *= 1.0 + stroke * 0.18 * min( wa, 1.2 ); diffuseColor.rgb = wc;
3) Restore the wash tables: add Portrait|Landscape|Map|Water back to NO_WASH; remove Wall|Bay|Cavern|Parquet|Runner from STRONG_WASH (keep Ground|Terrain|Lawn|Earth|Hedge|Leaf|Moss|Foliage). Keeping CLOTH_WASH for the sister is fine.
4) Delete addBankFoliageAndRockRelief, addWellSegmentRelief, addPassageArchitecturalRelief, addHallArchitecturalRelief and their call sites (SceneLoader.ts:336, 498, 636, 792). If extra dressing is wanted, add it in the Blender builders (tools/blender/build_ch1_*.py using tools/blender/world/painters.py) so it ships in the GLB, is counted by check-assets and uses each set's own palette, not a rainbow.
5) Keep: the M_(Alice|Sister)_Eye unlit rule, the Meadow tweaks if they look right, and the vPaintP instanceMatrix fix only if an instanced toon material remains.
Plan B (if a 'broken colour' pass is wanted): derive dabCol by rotating the surface's own hue by at most +/-0.08 turn (analogous harmony), cap the mix at 0.08, apply only when uWash > 1.2, and never replace authored textures at runtime.
Verify: re-run an A/B with the same fixed viewer views (my scripts: review-exp-rendering/viewer-ab.mjs, or tools/viewer-shot.mjs with VIEWER_BASE=http://localhost:3000), then npm run gate, and write VERDICT.md from board.png. Do not touch thresholds or tools/lib.

### [major] R-02 — build_chr_sister.py calls hair.build_back_curtain, which does not exist; the sister builder cannot run

**可信度**：✅ 已核对属实（hair.py 没有 build_back_curtain，build_chr_sister.py:70 在调用）

**Evidence**

tools/blender/build_chr_sister.py:70: hair.build_back_curtain(hbm, rng, max_frac=0.62). git grep back_curtain at 465e004 returns only that call. tools/blender/alice/hair.py defines only: _ell, back_point, clump_tube, build_scalp, build_back_hair, build_side_locks(bm,rng,max_frac), build_fringe, band_points, build_headband, build_bow.

**Root cause**

The builder edit was committed without the matching hair.py function, and no CI step imports or executes the Blender scripts, so the failure is invisible. It would raise AttributeError after the scalp/fringe/side locks are built.

**Fix suggestion**

Either add def build_back_curtain(bm, rng, max_frac=1.0) to tools/blender/alice/hair.py (reuse build_back_hair's clump loop), or change tools/blender/build_chr_sister.py:70 to hair.build_back_hair(hbm, rng) and check the signature (bm, rng). Then run python3 tools/blender/build_chr_sister.py (bpy per ROUND2_TASK s156, output redirected with SISTER_OUT first) and confirm it exits 0. Cheap guard for npm test: a node/python check that every 'hair\.(\w+)\(' / 'sister\.(\w+)\(' in tools/blender/build_*.py matches a def in the module (I could not run Blender here; the missing def is proven statically).

### [major] R-03 — Sister Blender sources changed but shipped GLB did not; a runtime patch now stands in for the rebuild

**可信度**：✅ 已核对属实（chr_sister.glb 最后一次提交是 924b654，而 sister.py 等在 465e004 被修改）

**Evidence**

git rev-parse: public/assets/models/chr_sister.glb, assets_src/chr_sister.glb and assets_src/models/chr_sister.glb are blob 4730905064c6ea4bd4a951c47189ca77f6b2109d at both fc6fcf2 and 465e004; last GLB commit is 924b654 (2026-10-14 18:26), while sister.py, sister_tex.py and build_chr_sister.py are modified in 465e004 (skirt N 132->144, pleat amplitude 0.085->0.115, three 3D flounces, apron panel, back hair, lace cuffs, new 1024px textures). The diff touches no public/assets or assets_src file. The shipped skirt is 18,480 tris and still has the old geometry (UV u 0.06..16.4, hem v=1.0).

**Root cause**

The Python edits were never run to regenerate the GLB (no Blender in the AI Studio environment). The JS enhancer was added to fake the new look at runtime, so builder, GLB and runtime now describe three different sisters, and check-assets validates only the old GLB.

**Fix suggestion**

Pick ONE source of truth. Recommended: after fixing R-02, run python3 tools/blender/build_chr_sister.py, commit the regenerated GLB to all three paths (public/assets/models/chr_sister.glb, assets_src/chr_sister.glb, assets_src/models/chr_sister.glb) in the same commit as the .py edits, then run npm run check:assets and npm run gate. Delete the runtime sculpt/texture override (R-01 step 1), otherwise a rebuilt GLB would be displaced and re-textured a second time by the enhancer, which hard-codes centre (0,0.13) and radius 0.52 (ModelDetailEnhancer.ts:578-594). If the GLB cannot be rebuilt yet, revert the .py edits so the repo describes what ships.

### [major] R-04 — Skirt 'deeper pleats' are applied in anti-phase and actually flatten the main 11-fold pleat

**可信度**：📖 仅审查员证据，未复核

**Evidence**

I decoded Sister_Skirt POSITION from public/assets/models/chr_sister.glb (9375 verts) and applied the exact enhancer formula (scratchpad skirt.mjs). Fourier amplitude of radius vs angle: hem ring k=11: 0.0374 -> 0.0318 (-15%); band y 0.10-0.14 m: 0.0282 -> 0.0177 (-37%); the 22- and 33-fold ripples rise (hem k22 .0051 -> .0162, k33 .0004 -> .0110). With the sign flipped (th = -atan2(dx,dz)) k11 rises to 0.0705 (hem) and 0.0519 (band), which confirms the diagnosis. Max vertex displacement 3.7 cm, mean 1.0 cm. The mesh is skinned (JOINTS_0/WEIGHTS_0 present).

**Root cause**

The baked loft uses th_b = -2*pi*i/N with x = rr*sin(-th), z = 0.13 + rr*cos(th), so the enhancer's th = atan2(x, z-0.13) equals -th_b. sin(11*th) in the enhancer is therefore the negative of the baked pleat crest, and it partly cancels it. The 22/33 terms are not locked to the baked 23-fold term, so they add beating instead of depth.

**Fix suggestion**

Preferred: delete the runtime sculpt (ModelDetailEnhancer.ts:573-619) and put pleat depth in sister.py/the rebuilt GLB (R-02/R-03). If a stopgap must remain, use th = -Math.atan2(dx, dz) in the skirt branch, drop the 22/33 terms or lock them to 22/33 multiples of the baked phase, and re-run the harmonic check above (k11 must go up, k22/k33 stay small).

### [major] R-05 — Canonical #4A3B4E shadow is faked in one texel to satisfy the unit test; real shadow is #30263E

**可信度**：✅ 已核对属实（ToonShaders.ts 的 shadow=[48,38,62]，并用 data[0]=74 单独改一个纹素以满足单元测试）

**Evidence**

ToonShaders.ts:14 shadow = [48,38,62] (deep indigo-plum) and lines 31-36 force texel 0 back to [74,59,78,255] with the comment 'Canonical #4A3B4E warm-purple origin at index 0'. I dumped the ramp: texel0 74,59,78; texels 1-8 48,38,62; texel 12 184,178,172; texel 31 255,253,247. tests/unit/shaders.test.mjs:34 asserts only the first four bytes equal [74,59,78,255] and passes (19/19 unit tests in shaders+m4_engine pass).

**Root cause**

The darker, cooler ramp contradicts the canonical warm purple shadow and a test that guards it. Instead of changing the design deliberately (docs + test), a single texel that is barely sampled was patched so the assertion stays green.

**Fix suggestion**

Remove the override (ToonShaders.ts:31-36) and set shadow back to [74, 59, 78] (the canonical value), moving the contrast work to the grade if desired. If darker shadows are really wanted, make it an explicit decision: update CLAUDE.md s3 and docs/bible.md, and change the test to assert every texel in the shadow band (indices 0..8) so it cannot be satisfied by one texel.

### [major] R-06 — Interior scenes lit like daylight with coloured (cyan/green/violet) point lights; fog and grade pushed to inflate detail

**可信度**：📖 仅审查员证据，未复核

**Evidence**

SceneLighting.ts: interior sunLight 0.55-0.6 -> 1.25 (S3, line 255), 1.25 (S4, 278), 1.20 (S5/6, 305) against 1.55 outdoors (238). Fog FogExp2 0.07 -> 0.014 (S3), 0.07 -> 0.011 (S4), 0.05 -> 0.010 (S5). Line 222 stainedLanternTints = [0xffcb74,0x6cc8e8,0xff9a74,0x78d8a8,0xd49eff,0xffe088] replaces LAMP_TINTS for the real point lights, while SceneLoader still tints the painted glows with the amber LAMP_TINTS (LightGlows.ts:12), so glow sprites and cast light disagree. Grades: clarity 0.35->0.58 (day), 0.5->0.92 (well), 1.0->1.05 (passage), 0.65->0.85 (hall); contrast 0.2->0.30, 0.4->0.45, 0.25->0.40; mottle 0.03->0.08.

**Root cause**

CLAUDE.md s3.1: 'warm pools of amber candlelight and gas lamp glows in interiors; radiant saturated sunlight reserved exclusively for the Garden Vista'. The new values brighten and recolour interiors and remove atmospheric depth. clarity is an unsharp mask, which directly raises the Laplacian 'detail' metric without adding painted content.

**Fix suggestion**

Restore the interior sunLight.intensity to <= 0.6 and the fog densities to the fc6fcf2 values (or tune with a rendered comparison), restore setHeightLight and ambient values from fc6fcf2 unless a captured comparison proves otherwise, and keep point-light colours warm (restore LAMP_TINTS import in SceneLighting.ts and delete stainedLanternTints). Treat clarity/contrast/mottle as a grade to be judged by eye on board.png, not as a way to move detail; revert the clarity increases unless VERDICT.md justifies them. Any change here needs a fresh npm run gate capture.

### [minor] R-07 — Relief claims '1 draw call' but tiles clone it; placement ignores keep-outs, floats, overlaps authored art

**可信度**：📖 仅审查员证据，未复核

**Evidence**

(a) SceneLoader.ts:498 adds the well InstancedMesh to the segment before segment.clone(true) at 501, so S3 gets 4 instanced draws, not 1 (measured S3_FALL 90 calls vs 89 in the last capture, still <=150). (b) Bank: 28 of 65 'canopy' blobs have centre y<3.12, below the lowest oak-canopy vertex (S1_Oak_Canopy min y=3.12 in the GLB), so they hang unattached in open air; 6 of 74 stones fall inside Meadow keepOut circles (picnic rug x3, burrow mouth x2 incl. (13.31,-1.61) 0.43 m from the hole, oak base x1), which the grass code deliberately keeps clear. (c) Well: ring r=3.68-3.82 sits on top of existing shelf geometry (S3_WellSegment_Books/Pres/Brass extents +/-3.9..4.1) and lamp anchors (r~3.5). (d) Hall: floor blocks centred y 0.006-0.012 with 0.011 height overlap the runner at y=0.01 and poke through it. (e) createToonMaterial(0xffffff) gives these meshes a white emissive floor (emissive = baseColor), which is not tinted by instanceColor, so shadows wash toward grey. (f) No new node uses INT_/TRG_/COL_/LAMP_/SPAWN_; no Raycaster in src; no physics change.

**Root cause**

Placement is arithmetic (i*0.618 % 1 etc.) with no knowledge of the scene's authored layout or tiling.

**Fix suggestion**

Moot if R-01 step 4 is applied. If kept: build the well relief once per tile only if cloned instancing is intended and fix the comment, skip positions inside the Meadow keepOut list (reuse it), lower the blob band to attach to the canopy (y>=3.2) or remove it, set emissive to 0x000000 for instanced materials (createToonMaterial(0xffffff,{emissive:0x000000,...})), and lift floor blocks above the runner (y >= 0.012) or exclude |z|<0.95.

### [minor] R-08 — Per-fragment cost +54% on all washed surfaces and reversed-edge smoothstep (undefined in GLSL ES)

**可信度**：📖 仅审查员证据，未复核

**Evidence**

pNoise calls in the map_fragment wash block: 13 (fc6fcf2) -> 20 (465e004), evaluated unconditionally (w5/w6 are computed even when macroNear=0). ToonShaders.ts uses smoothstep( 5.5, 0.35, d ), smoothstep( 0.55, 0.08, wl ) and smoothstep( 0.38, 0.05, wl ) (edge0 > edge1; GLSL ES leaves this undefined). The shader COMPILES and links with no errors under ANGLE/SwiftShader for all five wash kinds, instanced and non-instanced (my harness: 0 shader errors, glGetError 0, 2 programs; 'THREE.WebGLProgram' errors empty). Draw calls measured: S1_BANK 72, S2_CHASE 89, S3_FALL 90 (limit 150); triangles 401k/353k/485k.

**Root cause**

More noise octaves and the hue/dab/hatch passes were added without a real-GPU frame-time check; the ≥50 fps / ≥40 fps budget is untested on integrated GPUs (software GL is not representative).

**Fix suggestion**

Replace the reversed smoothstep calls with 1.0 - smoothstep( lo, hi, x ) forms (e.g. float macroNear = 1.0 - smoothstep( 0.35, 5.5, viewDist ); woodcut terms likewise). Gate the w5/w6 octaves with if ( macroNear > 0.0 ). If R-01 step 2 is taken the extra noise disappears. Measure frame time on an integrated GPU at 1080p before accepting any new per-fragment work.

### [minor] R-09 — Texture orientation, disposal, normals and hard-coded geometry assumptions

**可信度**：📖 仅审查员证据，未复核

**Evidence**

(a) CanvasTexture flipY=true (verified in the harness: flipY true) whereas GLTFLoader textures are flipY=false; the shipped skirt has hem at v=1.0 (UV v -0.09..1.0), so the canvas top row lands on the hem and the order of the flounce tiers is reversed relative to the Python texture; also RepeatWrapping makes the v<0 strip repeat. (b) Textures are created once and cached in a module Map, never disposed (~6 x 4-5 MB raw plus mips, plus canvas backing). (c) computeVertexNormals() on an indexed skinned mesh with 232 split seam vertices (skirt 9375 verts, 9143 unique positions; shawl 22) re-introduces a visible seam; bounding sphere is not recomputed after moving vertices up to 3.7 cm. (d) Skirt branch hard-codes centre (0,0.13) and radius 0.52 for one GLB version (the shipped hem centroid is (0.000,0.082)). (e) Materials are matched by name globally, so any future model reusing a name such as M_S5_Parquet is silently re-textured. (f) Dress texture's cream top/bottom bands and tiny pintucks are mapped onto sleeves that use triplanar UVs; the picture shows stripes running in unrelated directions.

**Root cause**

The enhancer was written against screenshots of a single model with no regard for the glTF conventions or the UV layouts the Blender scripts produce.

**Fix suggestion**

Moot if the enhancer is deleted (R-01). If anything is kept: set tex.flipY = false, call geometry.computeBoundingSphere()/Box() after displacement, dispose() textures on scene teardown, key textures by (model, material) instead of material name only, and take centre/radius from geometry.boundingBox instead of constants.

### [minor] R-10 — Label text and fonts break project rules; resources leak; INV-05 logic itself unchanged

**可信度**：📖 仅审查员证据，未复核

**Evidence**

INV-05 logic is untouched: checkInspectedSides still uses the identity camera quaternion, so the camera move to z=1.85 / FOV 45 does not matter; the unit test INV-05 in tests/unit/m4_engine.test.mjs passes (19/19); I did not run tier3_combinations.spec.ts (the e2e reviewer owns port 3000 and CPU). Problems: ItemInspector.ts makePaintedLabelTexture draws 'Georgia, serif' (CLAUDE.md s3.3 requires SIL OFL fonts, prop labels = IM Fell English, and Georgia is neither bundled nor registered in docs/assets-licenses.md, so rendering varies by OS). Text '~ Very Nicely Printed ~' is not Carroll (1865: 'beautifully printed on it in large letters'); 'Not marked' / 'POISON' is paraphrase; none of it comes from the i18n tables, so zh/ja users see English and the fidelity tool cannot check it (CLAUDE.md s2: new lines need "note":"new"). buildItemMesh never disposes the previous geometries/materials, and each open creates 2 CanvasTextures (256x352) plus about 9 meshes (bottle) or 12 spheres (cake fallback). open() does canvasContainer.innerHTML='' on #ui-inspector, which is a React-owned div in App.tsx:688 (its child span is removed behind React's back).

**Root cause**

The prop was redecorated at runtime with hard-coded strings and system fonts, and the cleanup path was not extended.

**Fix suggestion**

Use the IM Fell English font the game already ships (await document.fonts.load('bold 34px "IM Fell English"') before drawing), take the label strings from the i18n tables with "note":"new"/"adapted" and a Carroll-verbatim 'beautifully printed' where quoted, dispose geometries/materials/textures of the previous itemMesh in buildItemMesh() and close(), and replace innerHTML='' with removing only the old <canvas>. Re-run tests/e2e/tier3_combinations.spec.ts INV-03/INV-05 after any change.

### [minor] R-11 — Sister's whole head loses its ink hull

**可信度**：📖 仅审查员证据，未复核

**Evidence**

InkOutline.ts:57 now skips a mesh if ANY material slot matches /^M_(Alice|Sister)_(Eye|Lid|Lips|Mouth|Brow)/. In the shipped GLB, Sister_Head (17,256 tris) carries M_Sister_Face, M_Sister_Lid, M_Sister_Mouth, M_Sister_Lips and M_Sister_Brow, so the entire head, including the face skin, is skipped. The face contour visible in sister_before.png is gone in sister_after.png.

**Root cause**

The check is per mesh, not per material slot.

**Fix suggestion**

Confirm the head silhouette is intended to be un-outlined (it matches the existing Alice rule). If the outline is wanted, build the hull only from the Face-material triangle groups (use geometry.groups with the slot index) instead of returning for the whole mesh.

### [minor] R-12 — Gate cannot confirm this commit; capture tooling still points at the old port

**可信度**：📖 仅审查员证据，未复核

**Evidence**

npm run gate:check in the export reports 'thresholds-floor PASS thresholds not committed yet' because the export has no git history, so the 'may only be raised' check is vacuous there (verified instead with git diff: empty for gate-thresholds.json, tools/lib, quality-gate.mjs, check-assets.mjs, visual_parity.spec.ts). tools/viewer-shot.mjs defaults BASE to http://localhost:5173 (the dev server is now :3000), so gate screenshots taken with that tool fail to connect unless VIEWER_BASE is set. visual-metrics.json is still dated 2026-10-14T18:30 and src changed afterwards.

**Root cause**

Port migration and art changes were committed without running the capture/gate loop.

**Fix suggestion**

Change const BASE = process.env.VIEWER_BASE || 'http://localhost:5173' to 3000 in tools/viewer-shot.mjs (same for any other 5173 default), run npm run gate for a fresh capture, and only then claim any metric movement. Verify the threshold floor in the live repo (git history exists there), not in an export.

## React 迁移与测试约定（`react-ui`）

### [major] UI-1 — Raw i18n keys (title_h1, title_start, hud_height) are rendered on screen during the whole asset load; the "re-render after i18n loaded" is a no-op and the loading screen sits under the title card

**可信度**：🧪 审查员已在副本中测试补丁（react-ui-fixes.patch），未经第二位复核

**Evidence**

Screenshot /tmp/claude-0/-home-user-Alice-s-Adventures-in-Wonderland-/786ce45b-57ca-5270-bebb-b2ee4dba35e4/scratchpad/review-ui/during-load.png shows a title card reading "title_h1 / title_h2 / title_quote / ✦ title_start" and a HUD reading "hud_height", taken 2.5 s into a delayed load. s1-boot.mjs: at 2.8 s `titleH1:"title_h1", titleStart:"title_start"`; the same raw keys are still there at the moment window.__game becomes defined (`a_afterReady`). The production build also shows `h1:"title_h1"` 6 s after load (s9-prod.mjs). App.tsx:260 `setLangState(getLanguage())` does nothing because the state is already 'zh' (React bails out of identical state), so the first re-render comes only from `setLoadingFading(true)` at App.tsx:275, 500 ms after init. The CSS stacks .ui-title-screen at z-index 1000 (victorian.css) above .loading-screen at z-index 100 (index.html:75), so the loading screen never covers the title card. Because of that the Start button is clickable during loading. s7-early-click.mjs: clicking Start 2.5 s into a delayed init ends with state S1_BANK but Alice at (2,0,0), not startJourney's (2,0,-1), because init() overwrote the position. That is the teleport-to-origin race the harness-after-init fix was meant to avoid, now reachable by real users. In the old flow UIManager was created after the i18n fetch, so labels were correct from the first paint.

**Root cause**

React renders the full UI on the first commit, before ch1.json has been fetched. The only 'refresh' is a state setter that bails out. The loading overlay's z-index is below the title card's.

**Fix suggestion**

Tested in fixes.patch.
1) App.tsx: add `const [i18nReady,setI18nReady]=useState(false);`. In bootstrap, replace `setLangState(getLanguage());` with `setI18nReady(true);` (a real state flip). Use it on the root element: `<div id="ui-root" className="victorian-ui" data-i18n={i18nReady?'ready':'pending'}>`.
2) index.html: change `.loading-screen { z-index: 100 }` to `z-index: 2000`, so the overlay covers the title card (1000) until init finishes.
Trade-off: clicks are intercepted for about 1.3 s after init. Playwright auto-waits, and the 24 e2e re-run with the patch passed.
Alternative: do `await loadI18nData()` before `createRoot().render()` in main.tsx, and render nothing but the loading markup until the game is ready.
Also consider moving the loading markup and its CSS into victorian.css / #root so first paint is not blank.

### [major] UI-2 — No init-failure UI: if GameManager construction or init throws, the loading screen stays forever, the title card shows raw keys, Start does nothing, and there is no error boundary

**可信度**：🧪 审查员已在副本中测试补丁（react-ui-fixes.patch），未经第二位复核

**Evidence**

s5-nogl.mjs makes getContext('webgl'/'webgl2') return null. Result: `loadingScreenPresent:true, loadingOpacity:"1", errorUi:false, game:"undefined"`, body text "Alice's Adventures in Wonderland … title_h1 title_h2 title_quote ✦ title_start …". Console: `[pageerror] Error creating WebGL context.` (an unhandled promise rejection from bootstrap()). Screenshot: scratchpad/review-ui/nogl.png. App.tsx:252-282 has try/catch only around loadI18nData. The warning text 'Using embedded i18n data' is false, because i18n.ts has no embedded fallback: when ch1.json cannot be fetched the whole UI shows keys (s1-boot.mjs d_i18nFail: `titleH1:"title_h1"`). A GLB 404 does NOT fail init (SceneLoader.loadGreybox falls back to generated markers, verified), so this path is reached by WebGL or Rapier failure. By code reading, `useState(() => Boolean(localStorage.getItem(...)))` at App.tsx:142 runs in render, and with storage blocked it would unmount the whole tree (blank page).

**Root cause**

The bootstrap promise is fire-and-forget; there is no catch for `new GameManager()` or `init()`, and no error state or ErrorBoundary.

**Fix suggestion**

Tested in fixes.patch. Wrap the audio + GameManager + init block in try/catch. In the catch, `console.error` and `setInitError(e instanceof Error ? e.message : String(e))` (new `useState<string|null>`). In the loading screen render `{initError && <div role="alert" id="init-error"><p>The story could not be started: {initError}</p><button className="victorian-btn" onClick={()=>window.location.reload()}>Reload</button></div>}`. With the patch s5 shows the alert, and the raw keys are covered by the z-index fix from UI-1.
Also: wrap the `localStorage.getItem` in try/catch, and add a top-level ErrorBoundary around <App/> in main.tsx.
Also: fix or remove the misleading 'embedded i18n data' message (ship a small embedded fallback table in i18n.ts if offline use matters).

### [major] UI-3 — ItemInspector is never closed: its WebGL render loop keeps running after the modal is closed, and every re-open stacks another rAF loop (the bottle mesh is heavier in this commit)

**可信度**：✅ 已核对属实（除已无人引用的 UIManager.ts 外，没有任何监听 closeInspector 的代码）

**Evidence**

`git grep closeInspector` at fc6fcf2 and 465e004: App.tsx:228 (UIManager:573 before) only emits 'closeInspector' and nothing in src listens, so ItemInspector.close() (ItemInspector.ts:152) is dead code. s3-ui.mjs after clicking #btn-inspect-close: `itemInspectorStillOpen:true, canvasStillInWrapper:true`. s10-stack.mjs (rAF registrations of ItemInspector.renderLoop per game-loop frame): `ratio` 1 after first open, 1 after close (still running), 2 after second open+close, 3 after third. open() calls `this.renderLoop()` without cancelling the previous chain. Carried over from the pre-React code, but this commit made each frame costlier (36x12-segment fluted body, extra lights, antialias:true context) and App.tsx keeps emitting an event nobody handles.

**Root cause**

No GameManager listener for 'closeInspector', and open() can start a second render loop.

**Fix suggestion**

Tested in fixes.patch.
1) GameManager.setupEventListeners: after the 'drinkBottle' listener add `globalEventBus.on('closeInspector', () => { this.itemInspector.close(); });`.
2) ItemInspector.open(): just before `this.renderLoop();` add `cancelAnimationFrame(this.animationFrameId);`.
Verified: s10 ratio is 1 while open and 0 after close and after repeated open/close, s3 shows `itemInspectorStillOpen:false` and the canvas removed. The drink-button enable/disable checks (INV-05) still pass.

### [major] UI-4 — "Return to Title" leaves the game loop paused; pressing Start afterwards starts S1_BANK on a frozen world

**可信度**：✅ 部分核对：App.tsx 只在暂停菜单的"继续"按钮里发 resumeGame，开始/继续旅程不发

**Evidence**

s6-misc.mjs: after Esc -> #btn-pause-title -> #btn-start-journey, `window.__lab.gm.gameLoop.isPaused` is true and state is S1_BANK (`pausedAfterStartAgain:{paused:true,state:"S1_BANK"}`); s3 shows Alice does not move with D held for 1.5 s (`moved:0`). App.tsx:860-866 only does `setPauseMenuVisible(false); setTitleVisible(true)`, never emitting 'resumeGame' (identical to UIManager.ts:309-312, so carried over). The player escapes only by pressing Esc twice (open, then Resume).

**Root cause**

'pauseGame' is emitted when the pause menu opens, but the title/continue buttons never emit the matching 'resumeGame'.

**Fix suggestion**

Tested in fixes.patch. Smallest correct fix is to leave the world frozen behind the title card, as before, and unpause when a run actually starts. In handleStartJourney and handleContinueJourney add `globalEventBus.emit('resumeGame');` before the 'startJourney' / 'continueJourney' emit. s6 then shows `pausedAfterPauseToTitle:true` (frozen under the card) and `pausedAfterStartAgain.paused:false`.
Do not resume inside btn-pause-title: the story would keep running (timers, cutscenes) behind the title card.
Better long term: a 'returnToTitle' event that GameManager answers with stateMachine.goto('S0_TITLE') plus resume.

### [major] UI-5 — 60 s / 120 s stuck hints can never display: the UI looks hints up by 'S1_BANK' but ch1.json keys are 'S1'..'S7'

**可信度**：✅ 已核对属实（getStuckHint 用 S1_BANK 查，ch1.json 的键是 S1..S7；App 传入的是完整状态 id）

**Evidence**

s3-ui.mjs, via the app's own i18n module: `getStuckHint('S1_BANK',1,'zh') -> null`, `getStuckHint('S1',1,'zh') -> "姐姐看得好入神啊……河边的花开得真好看。"`, `getStuckHint('S0',1,'zh') -> null`. `node -e` shows `Object.keys(ch1.json.stuckHints) = S1..S7`. App.tsx:368 stores the full state id (`currentGameStateRef.current = to`) and App.tsx:527/533 pass it to getStuckHint. Same as UIManager.ts:373/623 and the 2026-10-14-audit finding, still unfixed. The tier2 T2-B05 test only exercises PuzzleManager's timer (whose 'showStuckHint' event nobody listens to), so CI cannot see it. Also 'continueJourney' emits no stateChanged, so after Continue the ref still says 'S0'.

**Root cause**

Key-format mismatch between engine state ids and the i18n table; the continue path does not publish the restored state.

**Fix suggestion**

In i18n.ts getStuckHint, normalise before lookup: `const key = (state.match(/^S\d/) ?? [state])[0];` and use `stuckHints[key]` (S1_BANK->S1, S0_TITLE/END->none).
In GameManager's 'continueJourney' handler emit `globalEventBus.emit(GAME_EVENTS.STATE_CHANGED, { from: 'S0_TITLE', to: this.stateMachine.currentState })` after restoring, or have App read the state from the same snapshot, so the timer knows the restored state.
Add a unit test in tests/unit: every `STATE_ID` returns a hint for tier 1 and 2.
Not applied in fixes.patch; the lookup result is from the probe above.

### [major] UI-6 — GameManager, AudioManager, ItemInspector and InputManager are created inside a React effect with no disposal path; a Fast-Refresh/remount would build a second game on the same canvas

**可信度**：📖 仅审查员证据，未复核

**Evidence**

App.tsx:249-292: the effect cleanup only sets `mounted=false` and clears the typewriter interval. GameManager has no dispose/destroy (grep): its constructor registers 11 globalEventBus listeners plus a window 'resize' listener (GameManager.ts:93-247), AudioManager.bindEvents adds window click/keydown plus 8 bus listeners (AudioManager.ts:94-127), InputManager adds many window listeners. If `mounted` turns false during `await gameMgr.init()`, the code at line 269 returns with the loop already running and never registers the harness. Probed with `?strict=1` (main.tsx StrictMode switch, s2-strict.mjs): exactly 1 game results (`gmInitLogs:1, harnessLogs:1, canvases:1`, bus listener counts identical to normal mode: startJourney 2, stateChanged 3, inspectItem 2). That is by timing luck: the first effect's bootstrap bails at the `if(!mounted) return` after `await loadI18nData`, before anything is constructed. Currently there is no HMR double game because vite.config.ts does not use the React plugin: s8-hmr.mjs, vite log "[vite] (client) page reload src/App.tsx" (a full reload). But package.json pulls in @vitejs/plugin-react, and once the plugin is enabled Fast Refresh re-runs `[]` effects on every edit of App.tsx.

**Root cause**

Game bootstrap is an effect side effect rather than a module-level singleton; none of the engine classes can be torn down.

**Fix suggestion**

Not tested; design suggestion. Move the boot out of React: `src/bootstrap.ts` exporting `bootGame(canvas): Promise<GameManager>` backed by a module-level `let booting: Promise<GameManager> | null`, so a second call returns the same promise. The effect becomes `bootGame(canvas).then(...).catch(setInitError)`. Optionally add `import.meta.hot?.dispose(() => location.reload())` so HMR can never stack games.
If real teardown is wanted, add `GameManager.dispose()` that unsubscribes the bus listeners (keep the unsub functions returned by `on`), cancels the rAF loop, removes the window listeners and disposes the renderers (Renderer, ItemInspector), plus `AudioManager.dispose()` that closes the AudioContext and unsubscribes.
At minimum, guard the effect with `if (gameManagerRef.current) return;` and make the cleanup stop the loop (`gameManagerRef.current?.gameLoop.stop()`).

### [minor] UI-10 — Nested setState calls inside state-updater functions and a redundant drinkUnlocked state

**可信度**：🧪 审查员已在副本中测试补丁（react-ui-fixes.patch），未经第二位复核

**Evidence**

App.tsx:401-419: `setInspectedFront(_prev => { setInspectedBack(prevBack => { if (prevBack) setDrinkUnlocked(true); return prevBack; }); return true; })` and the mirror for 'back'. Updater functions must be pure; React may call them twice (StrictMode) and they are order-sensitive. No React warning appeared in the console capture of the bottle flow (s3 consoleProblems contains only the missing-font warnings), and the e2e INV-05 test passes, so it works today. There is also a divergence: `onBottleSideInspected` is applied even when no item is open, whereas the old code guarded on activeInspectItem.

**Root cause**

drinkUnlocked is stored state instead of being derived from the two inspected flags.

**Fix suggestion**

Tested in fixes.patch. Delete `drinkUnlocked` state; add `const drinkUnlocked = inspectedFront && inspectedBack;`. `onBottleSideInspected = side => side==='front' ? setInspectedFront(true) : setInspectedBack(true)`. `onItemFullyInspected` sets both to true for the bottle. Remove the `setDrinkUnlocked(front && back)` line in onInspectItem.

### [minor] UI-11 — The whole 900-line App re-renders for every typewriter character

**可信度**：📖 仅审查员证据，未复核

**Evidence**

s3-ui.mjs over the first 6.5 s of S1 (one narr line): `commits:86, totalActualMs:623.7, avgMs:7.25, max:31.86` (dev build, software GPU, with Profiler overhead). The typewriter calls `setDialogue(prev => ({...prev, text: prev.text + ch}))` at 18-28 ms intervals (App.tsx:339-346) on the root component, which re-renders ~40 `getUIText` calls and the full tree each time.

**Root cause**

All UI state lives in one component.

**Fix suggestion**

Not tested. Extract `<SubtitleBox>` (dialogue state and typewriter interval inside it, subscribing to 'dialogueTrigger' itself) so only that subtree updates, or write the text through a ref/textContent. Optionally split the title card, inspector and pause menu into React.memo components keyed on `lang`. In production this is cheaper than the dev measurement, but it competes with the 3D loop for the main thread on low-end machines.

### [minor] UI-12 — No ARIA or focus management; arrow keys cannot operate the volume sliders; html lang is static

**可信度**：📖 仅审查员证据，未复核

**Evidence**

s3-ui.mjs a11y probe: `roleDialogCount:0, ariaAttrs:0, focusableSlots:0` (inventory slots and the interact prompt are clickable <div>s, tabIndex -1), `htmlLang:"en"` while the UI default is zh and it still reads "en" after clicking 日本語. s6-misc.mjs: focus #slider-vol-master, press Home -> value 0, then ArrowRight -> still 0, because InputManager.ts:100-101 calls `e.preventDefault()` on every Arrow/Space keydown at window level. There is no focus move/restore when modals open or close. eslint.config.mjs has no react-hooks or jsx-a11y plugins, so lint cannot catch any of this.

**Root cause**

The imperative DOM was copied 1:1 into JSX with no accessibility pass; InputManager swallows keys even when the target is a form control.

**Fix suggestion**

Not tested; concrete edits.
(a) InputManager keydown: only preventDefault when `!this.isUiTarget(e.target)` (the method and INTERACTIVE_SELECTOR already exist in that file).
(b) changeLanguage in App.tsx: `document.documentElement.lang = newLang === 'zh' ? 'zh-Hans' : newLang;`.
(c) Give the five modal containers `role="dialog" aria-modal="true" aria-labelledby=<h2/h3 id>`; render inventory slots as `<button type="button" aria-label={title}>`; give the interact prompt `role="status"`; add `aria-pressed` on the language buttons; focus the dialog's primary button on open and restore focus on close.
(d) Add `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y` to eslint.config.mjs.

### [minor] UI-13 — Pressing E on the title screen starts S1_BANK underneath a still-visible title card, and Esc then cannot open the pause menu

**可信度**：🧪 审查员已在副本中测试补丁（react-ui-fixes.patch），未经第二位复核

**Evidence**

s4-misc.mjs on 465e004: after KeyE on the title, `eOnTitle:{state:"S1_BANK",titleVisible:true}` and `escWhileTitleStuckVisible:{pauseVisible:false}`. GameManager.handleInteraction has `if (state==='S0_TITLE') { this.stateMachine.goto('S1_BANK'); return; }` and App decides title visibility only from its own local state (App.tsx:141/237-246) rather than from stateChanged. Carried over from UIManager.

**Root cause**

Title visibility is UI-local, not derived from the engine state.

**Fix suggestion**

Tested in fixes.patch: in `onStateChanged` add `if (to !== 'S0_TITLE') setTitleVisible(false);`. After this s4 shows `titleVisible:false` and Esc opens the pause menu. Better: remove the S0 branch from handleInteraction so only the Start/Continue buttons start the game, because that path skips startJourney's spawn position and opening narration.

### [minor] UI-14 — English leakage and hard-coded strings remain in the live-toggle UI

**可信度**：📖 仅审查员证据，未复核

**Evidence**

Language switching itself works and the tier1 D-01 test passes. Leaks: s3 with English selected, the interaction prompt reads "[E] 采摘河畔雏菊 · Pick Daisy" (hard-coded strings in GameManager.updatePromptForState, GameManager.ts:~140-175, unchanged by this commit). App.tsx size indicator literals `'0.254 m (10 in)'`, `'2.90 m (9 ft 6 in)'`, `'1.20 m (4 ft)'`. `<option>中文 (Victorian)</option>` / `English (1865)` (App.tsx:843-845). Loading screen title is English only. Fallback texts 'Item Name', 'Item description', 'Curiosity Note', '[E] Examine'. The curiosity note and the dialogue box keep the language they were opened in when the user toggles.

**Root cause**

Copied from UIManager; GameManager emits prose, not keys.

**Fix suggestion**

Not tested. getUIText(key) already returns the key when missing, so App can call `getUIText(interactPrompt.text, lang)` safely. Add `prompt.*` keys to public/assets/i18n/ch1.json (3 languages) and have GameManager emit keys instead of Chinese sentences. Move the size strings and the option labels into ch1.json `ui` entries. Keep a `new`/`adapted` note per the Carroll-fidelity rules for any new gameplay lines.

### [minor] UI-15 — Orphaned UIManager.ts, write-only refs, 16 inline style objects, duplicate cutscene-skip path, leftover CSS in index.html

**可信度**：✅ 部分核对：UIManager.ts 确实无人引用

**Evidence**

`grep -rn UIManager` in src/tools/tests: only src/ui/UIManager.ts itself; docs (REMEDIATION_LOG.md, 2026-10-14-audit.md, .agents/*) and README history still point at it, and it is still compiled by tsc. App.tsx:134-135 `gameManagerRef` / `audioManagerRef` are assigned and never read. 16 `style={{…}}` objects (App.tsx:575-895) copied from innerHTML strings. Skip: App.tsx:481-492 emits 'skipCutscene' after a 1 s timer (CutscenePlayer.ts:45 listens), while InputManager.ts:120-126 emits ESC_SKIP at 1.0 s as well. By code reading, App's handler re-stamps `skipHoldStartTimeRef` on every key repeat, so its own timer rarely fires (not run). index.html keeps the .loading-screen / #game-container / #render-canvas CSS although the markup is now in React, and #root is empty at first paint.

**Root cause**

Migration by copy without removing the old implementation.

**Fix suggestion**

`git rm src/ui/UIManager.ts` and update README/docs references to src/App.tsx; delete the two refs (or use them for UI-6 disposal); move the inline styles into victorian.css classes; delete App's skip timer and keep only the progress-bar visual (InputManager already performs the 1.0 s skip, INV-06 test passes); move loading CSS into victorian.css and put the loading markup inside #root in index.html (or accept a blank first paint).

### [minor] UI-16 — @vitejs/plugin-react is a dependency but unused (no Fast Refresh) and its pinned major cannot be installed with vite 6; React libs are not in the license registry

**可信度**：📖 仅审查员证据，未复核

**Evidence**

vite.config.ts has no `plugins`. s8-hmr.mjs / vite-3000.log: `[vite] (client) page reload src/App.tsx` (full reload, JSX compiled by esbuild via tsconfig `jsx: react-jsx`). `npm view @vitejs/plugin-react@6.1.2 peerDependencies` -> `vite: '^8.0.0'`; `npm view @vitejs/plugin-react@4.7.0 peerDependencies` -> `{ vite: '^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0' }`. docs/assets-licenses.md lists no code libraries at all, so react, react-dom (MIT) and the plugin are unregistered, against CLAUDE.md rule 6.5.

**Root cause**

Dependency added without wiring or compatibility check.

**Fix suggestion**

Either remove `@vitejs/plugin-react` from devDependencies (the app builds and runs without it; production build verified at 2.48 MB main chunk, 890 kB gzip) or pin `"@vitejs/plugin-react": "^4.7.0"` and add `import react from '@vitejs/plugin-react'; … plugins: [react()]` — but only after UI-6, otherwise Fast Refresh will stack games. Add a 'Code libraries' section to docs/assets-licenses.md (react, react-dom, three, zod, rapier: MIT/Apache-2.0).

### [minor] UI-7 — Leftover React Profiler / ?strict=1 probe: pushes every commit into an unbounded window.__renders global, outside the ?test=1 gate

**可信度**：❌ 已剔除：main@465e004 的 src/main.tsx 没有 Profiler / ?strict / __renders，那是审查员给自己快照插的探针

**Evidence**

main.tsx:5-12: `<Profiler id="app" onRender={(_id,phase,actual)=>{((window as any).__renders ??= []).push([phase,actual])}}>` and `?strict=1` toggles StrictMode, neither documented. s1-boot.mjs b_noTest (no ?test=1): `game:"undefined"` but `renders:2` with entries `["mount",26.04…]`. During the first 6.5 s of S1 dialogue the array grew by 86 entries (s3). In the production build it is a no-op (`renders:null`, s9-prod.mjs), so this is a dev-server-only leak, but the dev server is what README and CI run.

**Root cause**

A debugging probe from the migration was committed.

**Fix suggestion**

Tested in fixes.patch. main.tsx becomes `import { createRoot } from 'react-dom/client'; import { App } from './App'; createRoot(document.getElementById('root')!).render(<App />);`. If StrictMode is wanted, make it unconditional in dev. If a profiler is still wanted, gate it behind `?test=1` and cap the buffer.

### [minor] UI-8 — Window.__game type lives in the UI component file; the harness object is neither frozen nor non-configurable

**可信度**：📖 仅审查员证据，未复核

**Evidence**

`declare global { interface Window { __game?: … } }` moved from the deleted main.ts into App.tsx:10-53. testHarness.ts:11 assigns window.__game relying on that declaration. It typechecks only because tsconfig includes all of src. s1-boot.mjs: `Object.getOwnPropertyDescriptor(window,'__game')` is `{writable:true, enumerable:true, configurable:true}`, `Object.isFrozen(window.__game)` is false. This is unchanged from fc6fcf2, so no regression. The harness registration itself is correct: only with ?test=1, only after init (verified); T5-ADV-04 passes.

**Root cause**

The typing was relocated, not designed; the read-only requirement is by convention only.

**Fix suggestion**

Typing: move the `declare global` block (verbatim) into src/testing/testHarness.ts above `registerTestHarness` (done in fixes.patch, typecheck and tests green), and drop the now-unused `GameStateSnapshot` import from App.tsx.
Read-only (not tested, only read/call usage by the specs): replace the assignment with `Object.defineProperty(window, '__game', { value: Object.freeze(api), writable: false, configurable: false })`, where `api` is the object literal.
Note the mutating helpers (setTimeScale, fastForward, movePlayerTo, lookAtBottleSide) already existed; they are test-only controls, not state backdoors.

### [minor] UI-9 — Inspector canvas is sized 320x240 inside a 274x274 wrapper because the modal is still display:none when ItemInspector.open() reads clientWidth

**可信度**：🧪 审查员已在副本中测试补丁（react-ui-fixes.patch），未经第二位复核

**Evidence**

s3-ui.mjs: right after `globalEventBus.emit('inspectItem')`, `modalHiddenSync:true`, `wrapperW:0`, canvas `320px x 240px` (the `|| 320 / || 240` fallbacks in ItemInspector.ts:86-87); 400 ms later `wrapperW:274, wrapperH:274, canvasClientW:320, canvasClientH:240`. In the old UIManager the modal was un-hidden synchronously by its own listener, which was registered before ItemInspector's, so the box was measured at 274x274. React batches the state update, so the box is still hidden when ItemInspector's listener runs. The bottle ends up smaller and cropped (screenshot scratchpad/review-ui/inspector-open.png).

**Root cause**

Imperative engine code assumes synchronous DOM visibility; React commits one tick later.

**Fix suggestion**

Tested in fixes.patch. In ItemInspector add a `fitToContainer()` that, when `canvasContainer.clientWidth/clientHeight` are > 0 and changed, calls `renderer.setSize(w,h)` and updates `camera.aspect` + `updateProjectionMatrix()`, and call it at the top of `renderLoop`. Verified: canvas becomes 274x274. A ResizeObserver on the container is an equivalent alternative.
Also: App.tsx:688-691 puts a React-owned `<span id="inspect-item-icon">` inside #ui-inspector, but ItemInspector does `innerHTML=''` on that node. It is harmless only because the span's props never change; remove the span so React owns no children there.

## 文档、流程、许可（`docs`）

### [blocker] INST-01 — README, AGENTS.md and CI say npm (npm install / npm ci) but the repo ships only bun.lock; plain npm install fails with ERESOLVE and npm ci cannot run

**可信度**：📖 仅审查员证据，未复核

**Evidence**

git ls-tree 465e004: bun.lock present, package-lock.json absent (deleted: -3042 lines; bun.lock +445). README.md:44 'npm install'; .github/workflows/ci.yml:25 and :54 'npm ci' with cache: npm. In a bare dir holding only 465e004's package.json: npm install --package-lock-only -> 'npm error code ERESOLVE ... Found: vite@6.4.4 ... peer vite@"^8.0.0" from @vitejs/plugin-react@6.1.2 ... Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps'. @vitejs/plugin-react is not imported anywhere (vite.config.ts has no import of it) and vite build works without it: 'vite build' in the clone = built in 4.76 s, main-B-SKaI27.js 2,478.97 kB (JSX works through tsconfig "jsx": "react-jsx" and Vite's built-in esbuild). Verified fix: with fc6fcf2's package-lock.json restored and plugin-react deleted from package.json, npm install --package-lock-only -> 'found 0 vulnerabilities', npm ci --dry-run exit 0 ('added 205 packages'), lock resolves react 19.3.1, react-dom 19.3.1, @types/react 19.3.0, @types/react-dom 19.3.0, vite 6.4.4. Spec docs/google-doc-spec-v1.md:1152 also says dependency versions are pinned; with no lockfile every npm user resolves fresh caret ranges.

**Root cause**

Dependencies were added with bun (which ignores peer conflicts) and the npm lockfile was deleted; docs and CI were not updated.

**Fix suggestion**

Smallest correct fix (new branch + PR, never push main):
git switch -c fix/restore-npm-lockfile origin/main
git rm bun.lock
git checkout fc6fcf2 -- package-lock.json
# edit package.json: delete the line  "@vitejs/plugin-react": "^6.1.2",
npm install --package-lock-only
npm ci && npm run typecheck && npm run lint && npm test
git add package.json package-lock.json && git commit -m 'build: restore npm lockfile (CI uses npm ci); drop unused @vitejs/plugin-react (peer vite ^8)'
Trade-offs: (a) upgrading to vite 8 to keep the plugin is a larger, untested change; (b) --legacy-peer-deps in CI only masks the conflict; (c) keeping both lockfiles lets them drift, so pick one manager. If the owner insists on bun, then change ci.yml to oven-sh/setup-bun + bun install --frozen-lockfile and say so in README.
README.md replacement for section '### 1. Install Dependencies': 'npm ci   # Node 22.x; uses the committed package-lock.json. Use npm install only when you change package.json, then commit package-lock.json. Do not add bun.lock/yarn.lock/pnpm-lock.yaml.'
AGENTS.md: add under 'Where things are': '* Package manager is npm. package-lock.json is the only lockfile (CI runs npm ci). Never delete it or add another lockfile.'

### [blocker] PROC-01 — Unverified mixed commit pushed straight to an unprotected main; CI red; hard rules (verify first, no hand-over while the gate fails, screenshots for rendering changes) not followed

**可信度**：📖 仅审查员证据，未复核

**Evidence**

GitHub Actions (read-only): run #31 id 38677812914, event=push, head_sha 465e004, branch main, conclusion=failure, 03:44:18Z to 03:44:26Z (8 s). Job 'Build, Typecheck and Validate': step 3 'Setup Node.js 22.x' = failure, steps 4-8 (Install, Typecheck, Lint, Build, Unit) = skipped; job 'Playwright E2E Validation' = skipped. Earlier runs #24-#29 (event=pull_request) = success (~13 min each) and merge run #30 = success. list_branches: main, claude/fervent-brahmagupta-4qe1y9 and claude/great-allen-nbbxsb all protected:false; repo visibility=public (so rulesets are available on the free plan). Commit 465e004 (author Christian ju, 11:44+08:00, 83 min after merge fc6fcf2) changes 29 files but 0 files under docs/ (git diff --name-only fc6fcf2 465e004 | grep ^docs/ is empty): no REMEDIATION_LOG entry (ROUND2_TASK WP-H requires one per change), no docs/devlog/screens capture (CLAUDE.md 6.2 requires it for rendering changes), no verification statement in the message. npm run gate:check on the commit: exit 1, 9 of 31 failing, 'capture-fresh' FAIL because the last capture (docs/devlog/gate/visual-metrics.json capturedAt 2026-10-14T18:30:44Z) predates 12+ src/GLB commits including this one, so the visual effect of 465e004 is unmeasured. CLAUDE.md 7.1 / AGENTS.md: do not hand over until gate exits 0 with VERDICT PASS.

**Root cause**

No branch protection or required status checks, so a tool that pushes to the default branch (the commit carries Google AI Studio artifacts: .aistudio/, metadata.json, port 3000 / host 0.0.0.0) can bypass CI. AGENTS.md and GEMINI.md address Antigravity only and say nothing about branches, lockfiles or ports, so another agent tool had no rule to follow. ci.yml already triggers on pull_request and push for main/master, but nothing forces the PR run to happen first.

**Fix suggestion**

A) Ruleset (owner runs it; I did not): gh api -X POST repos/shukazuaki2025-lang/Alice-s-Adventures-in-Wonderland-/rulesets --input - <<'JSON'
{"name":"protect-main","target":"branch","enforcement":"active","conditions":{"ref_name":{"include":["refs/heads/main"],"exclude":[]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":true,"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":false}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":true,"required_status_checks":[{"context":"Build, Typecheck and Validate"},{"context":"Playwright E2E Validation"}]}}],"bypass_actors":[]}
JSON
(0 approvals because the owner is solo, but a PR is mandatory so CI runs before the merge; 'strict' forces the branch to be up to date. Trade-off: AI Studio's 'commit to main' will be rejected; point it at a feature branch and merge by PR.)
B) Keep CI on both push and pull_request (do NOT make it PR-only: the push run validates the merge result and catches admin or bypass pushes). Add to ci.yml: concurrency: {group: ci-${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true}; permissions: {contents: read}; and a first step in both jobs, before setup-node, so the failure is readable: - name: Lockfile guard
  run: |
    test -f package-lock.json || { echo 'package-lock.json missing (npm ci needs it)'; exit 1; }
    ! ls bun.lock bun.lockb yarn.lock pnpm-lock.yaml 2>/dev/null || { echo 'foreign lockfile committed'; exit 1; }
C) Add an informational job (continue-on-error: true, NOT a required check until the gate can pass): checkout with fetch-depth: 0 (the gate reads the threshold floor from git history), setup-node 22.x cache npm, npm ci, npm run gate:check | tee gate-check.txt, upload gate-check.txt and docs/devlog/gate/REPORT.md as an artifact. Later require only the integrity part.
D) Add .github/pull_request_template.md with checkboxes: npm ci/typecheck/lint/test pass; e2e pass or 'not run: why'; npm run gate:check output pasted (failing list); rendering change => fresh docs/devlog/screens capture or 'NOT MEASURED'; package.json change => package-lock.json updated and docs/assets-licenses.md updated; REMEDIATION_LOG entry added. Optionally a CI step that fails a PR touching tools/quality-gate.mjs, tools/lib/image-metrics.mjs, tools/check-assets.mjs or tests/e2e/visual_parity.spec.ts unless it carries a 'gate-change-approved' label (CODEOWNERS review does not work for a solo owner, GitHub forbids self-approval).
E) Recovery for the current main: do not force-push or rewrite main; land fixes as PRs (see INST-01, LEAK-01, COMMIT-01) so main becomes green again.

### [major] ART-01 — ModelDetailEnhancer patches GLB geometry and textures at runtime by hard-coded names and coordinates, outside the Blender pipeline the gate and docs describe; undocumented, unmeasured, and likely to double-deform the sister model being rebuilt in parallel

**可信度**：📖 仅审查员证据，未复核

**Evidence**

src/world/ModelDetailEnhancer.ts:565-671 (enhanceModelHierarchy, called from ToonShaders.convertMaterialsToToon): for mesh name 'Sister_Skirt' it displaces vertices around a hard-coded centre (z=0.13, radius 0.52) with sin() pleats and flounces; for 'Sister_Shawl' it adds ribs; for materials M_Sister_Skirt/Shawl/Dress and M_S5_Parquet/Runner/Wallpaper it replaces map AND sets emissiveMap = same texture (self-lit, ignores the lighting rules in CLAUDE.md 3.5). The guard is only geom.userData.sculptedHD (per geometry instance). No GLB changed in the commit, so the committed chr_sister.glb still has the smooth skirt that ROUND2_TASK WP-G / gate item npc:sister targets, while the picture now shows pleats. The live working tree of other agents has uncommitted changes to chr_sister.glb, ch1_s5_hall.glb, SceneLighting.ts, SceneLoader.ts, ToonShaders.ts, sister.py, sister_tex.py, build_chr_sister.py (git status in /home/user/Alice-s-Adventures-in-Wonderland-) and a new tools/blender/alice/sister_paint.py: once their GLB has real pleats, the name-matched runtime displacement is applied on top. git merge-tree of the committed in-flight branch tip 6fa5bda with 465e004 is conflict-free (tree cb64730), so the clash would be semantic, not textual. Nothing in README, PROJECT.md or assets-licenses.md mentions this second texture/geometry source; gate check-assets measures the GLB while the gate screenshots measure the patched picture.

**Root cause**

Quick route to a better-looking screenshot by overriding assets in TypeScript instead of fixing the Blender generators that the gate's model checks (check-assets) are meant to hold accountable.

**Fix suggestion**

Treat it as a policy question for the owner: (1) preferred: move the sculpt and textures into the Blender scripts (tools/blender/alice/sister.py, sister_tex.py, world hall painters), regenerate the GLBs, delete ModelDetailEnhancer.ts; (2) if kept as a runtime layer, remove emissiveMap = t (lighting must apply), guard each patch with an explicit version flag stored in the GLB extras (e.g. userData.detailBakedInGlb) so rebuilt GLBs skip it, document it in PROJECT.md 'Asset Pipeline' and in assets-licenses.md (see LIC-01), and require a fresh npm run gate -- --quick capture in the same PR; never count the runtime layer as evidence that npm run check:assets model floors are met. Until decided, record in REMEDIATION_LOG: 'S1 picture and npc:sister now depend on runtime overrides in ModelDetailEnhancer.ts; GLB-level skirt still smooth.' I did not judge the visual quality or performance of this code (other reviewers' area).

### [major] COMMIT-01 — Commit message describes about a third of the diff; one commit mixes seven unrelated changes

**可信度**：📖 仅审查员证据，未复核

**Evidence**

Message (3 bullets): React 19 UI; 'Update Vite development server settings and port configuration'; 'adjusted color grading parameters and additional instanced foliage'. Diff (git show --stat 465e004): +3065/-3439 over 29 files. Not mentioned: package-lock.json deleted + bun.lock added; .aistudio/artifacts/brain/89363416-.../ (implementation_plan.md, .metadata.json, 4 PNGs = 6,249,840 bytes); root metadata.json; tsconfig.json (jsx + include .tsx); index.html (title shortened, og: tags, loading screen moved into React); deletion of src/main.ts (94 lines, whose boot-order comment about registerTestHarness-after-init moved into App.tsx); new src/world/ModelDetailEnhancer.ts (671 lines) hooked into ToonShaders.convertMaterialsToToon; SceneLoader.ts (272), SceneLighting.ts (211), ItemInspector.ts (182), ToonShaders.ts (136) rewrites; tools/blender/alice/sister.py (+183), sister_tex.py (+121), build_chr_sister.py edits with NO regenerated .glb in the commit (git diff --name-only | grep .glb is empty), so chr_sister.glb no longer matches its generator; tools/download-fonts.sh mode 100755 -> 100644. 'Enhance scene visual fidelity with adjusted color grading ... instanced foliage' understates the biggest rendering change (runtime vertex and texture overrides, see ART-01).

**Root cause**

Whole working tree of an AI-Studio session committed in one go; no commit discipline, no PR review.

**Fix suggestion**

What should have been separate commits/PRs (suggested messages): 1) build: restore package-lock.json, drop unused @vitejs/plugin-react (INST-01). 2) feat(ui): migrate overlay to React 19 (src/main.tsx, src/App.tsx, index.html, tsconfig jsx/include, react/react-dom/@types in package.json, README Track H row) - only after the decision record in DEC-01, plus PROJECT.md/CLAUDE.md/TEST_INFRA edits in the same PR and removal or marking of src/ui/UIManager.ts. 3) build(dev): fixed dev port 3000 in package.json, vite.config.ts, playwright.config.ts, README, tools/viewer-shot.mjs, TEST_READY.md, ROUND2_TASK.md in one change. 4) feat(render): lighting/grade/toon/meadow/ink-outline changes with a fresh npm run gate -- --quick capture and screenshots in docs/devlog/screens. 5) feat(art): ModelDetailEnhancer only if kept (ART-01). 6) feat(assets): sister Blender script changes together with the regenerated chr_sister.glb (python3 tools/blender/build_chr_sister.py) so source and asset match. 7) chore: nothing from .aistudio/ or metadata.json (LEAK-01); restore the exec bit: git update-index --chmod=+x tools/download-fonts.sh. Also append a REMEDIATION_LOG entry (problem -> commit -> verification command + real output -> screenshots) as ROUND2_TASK WP-H demands. Suggested message trailer for unverified work (the agents' own wip commits already do this): 'Not yet verified by the gate capture or e2e.' Do not rewrite 465e004 on main; split by follow-up PRs.

### [major] DEC-01 — React migration contradicts the project's founding UI rule ('no large front-end framework') with no recorded decision; CLAUDE.md tech stack omits React

**可信度**：📖 仅审查员证据，未复核

**Evidence**

docs/google-doc-spec-v1.md:1361 'Task H3: ... implement the UI layer in HTML/CSS over the canvas, do not introduce a large front-end framework' (Chinese original: 不引入大型前端框架); :200 tech stack lists no UI framework; docs/prompts/track_h/prompt.md:17 'lightweight HTML/CSS'; PROJECT.md:7 'Vanilla HTML/CSS'. CLAUDE.md:12-21 (Core Technology Stack) has no React entry and line 12 still says 'Vite 6.x (with HTTPS support for WebGPU local testing)' although vite.config.ts has no https option. Measured cost (vite build of fc6fcf2 vs 465e004 in the clone): main JS 2,252,086 B -> 2,478,971 B (+226,885 B, +10%), gzip 817.96 kB -> 890.01 kB (+72 kB); within the 15 MB budget, so this is a spec/process issue, not a budget one.

**Root cause**

Framework swap decided inside a tool session; neither the spec owner nor the docs were consulted or updated.

**Fix suggestion**

Owner decision, then record it. Option A (accept React; the owner authored the commit): add docs/decisions/0001-react-ui.md (Status: accepted 2026-10-15; Context: spec H3 said no large framework; Decision: React 19 for the overlay only, engine stays framework-free and talks through globalEventBus; Consequences: +72 kB gzip, react-hooks lint needed, UIManager.ts retired) and apply the doc edits in DOC-02. Exact CLAUDE.md edit: replace line 12 with:
  - **Bundler & Dev Server**: Vite 6.x; dev server http://localhost:3000 (npm run dev, host 0.0.0.0, plain HTTP: localhost is a secure context so WebGPU works; no HTTPS config exists)
  - **UI**: React 19 (react, react-dom) renders the Victorian picture-book overlay (src/main.tsx -> src/App.tsx, styles src/ui/styles/victorian.css). JSX uses the automatic runtime (tsconfig "jsx": "react-jsx", Vite's esbuild); @vitejs/plugin-react is not used. The 3D engine (src/engine, src/game, src/world, src/shaders) stays framework-free.
  - **Package manager**: npm with a committed package-lock.json (CI runs npm ci); no other lockfile.
Option B (reject): revert only the UI part: git revert -n on the React hunks (src/App.tsx, src/main.tsx, index.html, tsconfig, package.json deps) in a PR, restore src/main.ts from fc6fcf2. Either way also update docs/prompts/track_h/prompt.md line 1 and 17 ('Victorian UI & React overlay') so future Track H agents are not told the opposite.

### [major] DOC-01 — Port 5173 still documented and hard-coded in places after the move to 3000; viewer-shot.mjs default now points at the wrong server

**可信度**：📖 仅审查员证据，未复核

**Evidence**

grep -rnI 5173 (excluding .agents): TEST_READY.md:23 'Vite dev server integration on port 5173'; tools/viewer-shot.mjs:8 'Needs the dev server (npm run dev) on :5173' and :15 const BASE = process.env.VIEWER_BASE || 'http://localhost:5173' (functional: after npm run dev (3000) the documented viewer-shot step fails or hits another process); docs/review/ROUND2_TASK.md:137 'npm run dev  # 开发服务器 :5173'; ROUND2_AUDIT.md:3 and 2026-10-14-audit.md (historical, fine). Updated correctly: package.json dev, vite.config.ts, playwright.config.ts (baseURL and webServer.port), README (3 URLs). Risk: package.json passes --port 3000 without strictPort; with 3000 taken Vite moves to 3001 while Playwright (reuseExistingServer: !CI) silently reuses whatever already answers on 3000.

**Root cause**

Port change applied to config and README only, not grepped repo-wide.

**Fix suggestion**

tools/viewer-shot.mjs line 8: ' * Needs the dev server (npm run dev) on :3000 - set VIEWER_BASE to override.' and line 15: const BASE = process.env.VIEWER_BASE || 'http://localhost:3000';
TEST_READY.md:23: '2. playwright.config.ts - Playwright runner configuration (headless Chromium, Vite dev server integration on port 3000, viewport 1280x720, ?forceWebGL=1&test=1 test harness support).'
ROUND2_TASK.md:137: 'npm run dev                                   # dev server :3000 (viewer: /viewer.html)'
README.md, under the dev-server bullets, add: 'The dev server is fixed to port 3000 (npm run dev); Playwright and tools/viewer-shot.mjs use the same port. Free port 3000 first: if it is busy, Vite would pick another port and Playwright would reuse whatever answers on 3000.' Optional hardening (config owner): add strictPort: true to vite.config.ts server and make the port single-sourced (const PORT = Number(process.env.PORT) || 3000 in vite.config.ts and playwright.config.ts, dev script just 'vite') so the --host/--port flags do not duplicate the config.

### [major] DOC-02 — PROJECT.md, TEST_INFRA.md, Track H prompt, AGENTS.md and a test helper still describe the vanilla-HTML UI and src/main.ts

**可信度**：✅ 部分核对：PROJECT.md:111 与 gameHarness.ts:20 仍写 main.ts

**Evidence**

PROJECT.md:7 'Vanilla HTML/CSS responsive overlay'; :20 '12 HTML/CSS UI components'; :101 'public/index.html # Main entry HTML' (never true: index.html is at the root); :110-111 'ui/ # Victorian HTML/CSS overlay' and 'main.ts # Application bootstrap' (main.ts deleted); :87 absolute path '/home/administrator/...'. TEST_INFRA.md:10 'HTML/CSS Victorian picture-book overlay elements'. docs/prompts/track_h/prompt.md:1,17 'HTML/CSS Overlay'. tests/e2e/helpers/gameHarness.ts:20 comment 'which main.ts registers only after every model is loaded' (now App.tsx:270 calls registerTestHarness). AGENTS.md:3 'Vite + TypeScript + Three.js' (no React). README Track H row was updated correctly. src/ui/UIManager.ts (651 lines) is referenced by nothing but itself (grep UIManager src), yet REMEDIATION_LOG B-10/B-12/D-01/D-03 cite it as the implementation.

**Root cause**

Docs edited only in README; nothing else grepped.

**Fix suggestion**

PROJECT.md:7 -> '- **UI & Presentation**: React 19 overlay (src/main.tsx mounts src/App.tsx; styles in src/ui/styles/victorian.css) styled as an authentic Victorian picture book. The 3D engine stays framework-free and talks to the UI through globalEventBus. SIL OFL typography (Noto Serif SC, LXGW WenKai, IM Fell English, Zen Old Mincho).'
PROJECT.md:20 -> '| 6 | Victorian UI Overlay | React components in src/App.tsx + victorian.css: title, dialogue, HUD, inventory, inspector, pause/settings, chapter/end cards | M2 | spec_miner_1 |'
PROJECT.md tree: delete the 'public/index.html' line; replace lines 110-111 with '│   ├── App.tsx                  # React UI shell (title, HUD, inspector, pause, end card)' / '│   ├── main.tsx                 # React entry: mounts <App/>' and '│   ├── ui/                      # i18n.ts, styles/victorian.css (UIManager.ts is legacy/unused)'; add 'package-lock.json' and 'index.html # <div id=root> + /src/main.tsx' at root; line 87 -> 'Alice-s-Adventures-in-Wonderland-/'.
TEST_INFRA.md:10 -> '1. **DOM Elements & Canvas**: the React-rendered Victorian picture-book overlay (stable element ids such as #render-canvas, #btn-start-journey, #ui-inventory-bar, #ui-inspect-modal are part of the test contract), subtitle containers, inventory slot HUDs, dialog modals and interactive prompts.'
tests/e2e/helpers/gameHarness.ts:20 -> '... which App.tsx registers (via registerTestHarness) only after every model is loaded and the loop runs.' (comment-only change)
AGENTS.md line 3 -> '(Vite + TypeScript + Three.js, React 19 UI overlay, Blender/bpy asset pipeline)'.
Delete src/ui/UIManager.ts in the same PR as DEC-01 (or add a header comment 'LEGACY - not imported; kept for reference') and in REMEDIATION_LOG add one line under the Round-2 heading: 'UI layer moved from src/ui/UIManager.ts to React (src/App.tsx) in 465e004; entries above that cite UIManager.ts describe the earlier implementation.'

### [major] DOC-03 — Stale or false status statements: README test counts, REMEDIATION_LOG round-2 progress left as placeholder, 'rabbit and Dinah still flat', committed gate REPORT, making-of '100%', stats.json

**可信度**：📖 仅审查员证据，未复核

**Evidence**

README.md: '# Unit & schema validation tests (18/18 tests)' and '(28/28 tests)'; reality at 465e004: npm test = '# tests 63 # pass 63 # fail 0'; npx playwright test --list --project=chromium = 'Total: 29 tests in 7 files' (+3 in the separate gate project). README.md:16 says 'Trilingual Narrative (zh / en / orig_1865)' while the same README Track H row now says zh/en/ja and ch1.json has no orig_1865 (grep count 0). README INV list (INV-02 soft-lock, INV-03 bottle inspection, INV-05 marmalade) disagrees with the tests/TEST_INFRA/REMEDIATION numbering (INV-02 glass transparency, INV-03 key auto-return, INV-05 bottle 3D inspection, INV-07 marmalade; tests grep: 'INV-07: Marmalade Jar No-Drop'), and docs/tests/ch1-interactions.md uses a third scheme. docs/review/REMEDIATION_LOG.md:112-114 'Round 2 - current progress (update this block whenever you stop for any reason)' still contains the placeholder 'Failing checks: run npm run gate -- --no-run and paste the Failing: line here.'; ROUND2_TASK.md:16 refers to the subsection by its Chinese title '第二轮 · 当前进度', which does not exist. REMEDIATION_LOG:101-103 and ROUND2_TASK.md:58 say White Rabbit and Dinah are 'still flat-colour' but the gate now passes model:chr_rabbit (8 painted mats, 3.3 Mpx), model:chr_dinah_dream (3, 1.6 Mpx) and npc:rabbit; ROUND2_AUDIT.md A4 already says they were redone (internal contradiction). Committed docs/devlog/gate/REPORT.md is from 2026-10-14T21:14 and shows S3 well 69046 tris / s4 37232 tris / 21.6 MB, while the committed GLBs measure 84908 / 46622 tris / 26.2 MB; every gate:check rewrites REPORT.md and result.json (git status shows them modified). making-of.html:142 hard-codes 'Unit & E2E Pass Rate: 100%' (main CI was red on this commit); docs/devlog/stats.json says unitTestsCount 7, e2eTestSuites 4, dialogueLines 64, assetModelsCount 12 (actual: 63 tests, 7 e2e files, 54 dialogue entries, 14 model checks). No document claims the gate passes; docs/devlog/gate/VERDICT.md does not exist; VERDICT_TEMPLATE.md ends 'Verdict: FAIL'.

**Root cause**

Numbers were typed by hand once and never refreshed; the progress block was a template; gate artefacts are committed from an older run.

**Fix suggestion**

README.md: replace the two count comments with '# unit + GLB/rig/Carroll-fidelity checks (must all pass)' and '# Playwright E2E, chromium project (must all pass; the visual_parity specs run only under the gate project)' - or, if numbers stay, '63 tests' and '29 tests'. Replace README:16 with '- **Trilingual Narrative (zh / en / ja)**: ... (zh <= 28 characters per subtitle line) ...'. Replace the README invariant list with: '1. Curtain Lock (INV-01) ... 2. Glass-table transparency (INV-02): alpha <= 0.25 so the key stays visible from underneath. 3. Key auto-return (INV-03): picking up DRINK ME while holding the key puts it back on the table. 4. Shrink physics & audio (INV-04). 5. 3D bottle inspection (INV-05). 6. Cutscene skip parity (INV-06). 7. Marmalade jar no-drop (INV-07).' (keep each sentence from the current text under its new number).
REMEDIATION_LOG.md: rename the heading to '### 第二轮 · 当前进度 / Round 2 - current progress (update this block whenever you stop for any reason)' and replace its body with the real, reproducible output:
'* Measured with npm run gate:check on commit 465e004 (full git clone): GATE: FAIL - 9 of 31 checks failing. Failing: capture-fresh, S1_BANK, S1_BANK_orbit, S3_FALL, S4_PASSAGE, S5_HALL, S6_SMALL, npc:sister, verdict.
* The screenshots behind these numbers were captured 2026-10-14T18:30Z, BEFORE the later lighting/grade/ModelDetailEnhancer/React commits; the current picture is NOT measured. Re-capture first: npm run gate -- --quick.
* Last measured picture numbers: S1_BANK detail 7.795 / palette 0.532 / contrast 0.195; S1_BANK_orbit palette 0.538; S3_FALL detail 5.226 / palette 0.226 / hueEntropy 1.69 / contrast 0.083 / saturation 0.866; S4_PASSAGE detail 3.033 / palette 0.176 / hueEntropy 1.642 / contrast 0.113 / dominant3 0.341; S5_HALL palette 0.383 / contrast 0.177; S6_SMALL detail 6.322 / palette 0.36 / contrast 0.158; npc:sister detail 8.839 / contrast 0.164.
* All 14 model floors pass; alice:front/threeQuarter/face/walk and npc:rabbit pass. docs/devlog/gate/VERDICT.md does not exist.
* Next step: re-capture, then WP-A (S3) -> WP-C (hall) -> WP-B (passage) -> WP-F (S1) -> WP-G (sister skirt in the Blender model).'
REMEDIATION_LOG:101-103 'Not done' -> 'White Rabbit and Dinah were repainted later in this round (gate: model:chr_rabbit 8 painted mats / 3.3 Mpx, model:chr_dinah_dream 3 / 1.6 Mpx, npc:rabbit PASS).' ROUND2_TASK.md item 1 of section 1 -> delete or mark '(done, see REMEDIATION_LOG current progress)'. R2-4 'State at hand-over: 16 of 30' -> append '(historical; current state in the block below)'.
Stop committing generated gate outputs from partial runs: commit docs/devlog/gate/* only together with a full or --quick capture, and add the line 'Gate run: <commit hash>' (VERDICT_TEMPLATE already has it) to REPORT.md.
making-of.html:142 -> remove the hard-coded 100% or fill it from CI (e.g. 'Unit tests: see CI badge'); docs/devlog/stats.json -> unitTestsCount 63, e2eTestSuites 7, dialogueLines 54, assetModelsCount 14, or generate it with a small script and add it to npm test so it cannot rot.

### [major] FONT-01 — 'Offline OFL fonts bundled' is recorded as VERIFIED but no font file has ever been committed; tools/download-fonts.sh cannot produce them and lost its exec bit in this commit

**可信度**：✅ 已核对属实（git ls-files 里没有任何字体文件）

**Evidence**

git ls-files | grep -iE '\.(woff2?|ttf|otf)$' is empty at fc6fcf2 and 465e004; git log --all -- public/assets/fonts is empty; ls public/assets = cutscenes i18n models. src/ui/styles/victorian.css:6-28 declares @font-face for /assets/fonts/{im-fell-english,noto-serif-sc,lxgw-wenkai,zen-old-mincho}.woff2. Vite on a spare port (3199, stopped afterwards): curl /assets/fonts/im-fell-english.woff2 -> '200 text/html 2544B' (SPA fallback = index.html), same for noto-serif-sc.woff2, while /favicon.svg -> 200 image/svg+xml and /assets/i18n/ch1.json -> 200 application/json; so the browser gets HTML instead of fonts and silently falls back to system fonts (CJK glyphs then depend on the player's OS). REMEDIATION_LOG:18 (WP-8 'Offline OFL Fonts (public/assets/fonts/)') and :55 (D-04 'Bundled offline fonts in public/assets/fonts/') are marked VERIFIED. tools/download-fonts.sh: no mkdir -p public/assets/fonts; curl is called without a User-Agent: running the same request it uses (fonts.googleapis.com css2?family=Noto+Serif+SC:wght@400;600;700) returned 'http=200' with 3 urls, all format('truetype') and 0 woff2 urls, so grep woff2 matches nothing and no file is written; even a woff2 hit would be one unicode-range slice (head -n 1) and the TTF would exceed the 1.5 MB budget; tools/subset-fonts.mjs (spec H3 task 3, Track H prompt) does not exist. git diff --summary: 'mode change 100755 => 100644 tools/download-fonts.sh'. Positive: no remote Google Fonts link or @import remains in src/, index.html, viewer.html (grep).

**Root cause**

The WP-8 claim was written from intent, not from a check; the script was never run successfully; nothing tests that the declared font files exist. (Pre-existing; 465e004 only changed the file mode.)

**Fix suggestion**

Docs first (honesty): REMEDIATION_LOG:18 and :55 -> '**D-04 (Offline OFL fonts) - NOT DONE.** victorian.css declares local @font-face rules for /assets/fonts/*.woff2 but no font file exists in the repository, tools/subset-fonts.mjs does not exist and tools/download-fonts.sh cannot produce the files; text currently falls back to system fonts.' Then do it for real: write tools/subset-fonts.mjs (pyftsubset over the characters in public/assets/i18n/*.json + src/App.tsx strings, woff2 output, license text files next to the fonts), commit public/assets/fonts/*.woff2 (< 1.5 MB total), register each font with its copyright holder/license file in docs/assets-licenses.md, and add a unit test that every url(...) in victorian.css resolves to an existing file under public/. Restore the exec bit: git update-index --chmod=+x tools/download-fonts.sh (or delete the script once subset-fonts.mjs exists). In the font table of docs/assets-licenses.md add the file name, the source URL and 'OFL 1.1' for each font.

### [major] LIC-01 — docs/assets-licenses.md registers no code library at all; the 5 libraries added by this commit (react, react-dom, @types/react, @types/react-dom, @vitejs/plugin-react) are unregistered, and one of them is unused

**可信度**：📖 仅审查员证据，未复核

**Evidence**

docs/assets-licenses.md (20 lines) has sections Fonts, 3D Models, Textures; no npm package appears. CLAUDE.md 6.5: 'All third-party fonts, textures, audio samples, and code libraries must be registered'; LICENSE footer says the same. A prototype guard test (tests/unit/licenses.test.mjs, run in the clone) fails on the real file: 'not registered in docs/assets-licenses.md: @dimforge/rapier3d-compat, react, react-dom, three, zod, @eslint/js, @playwright/test, @types/node, @types/react, @types/react-dom, @types/three, @vitejs/plugin-react, eslint, tsx, typescript, typescript-eslint, vite' (17 of 17 direct dependencies). Licenses verified from the installed node_modules/*/package.json in the snapshot: react 19.3.1 MIT, react-dom 19.3.1 MIT, scheduler 0.28.0 MIT, @types/react 19.3.0 MIT, @types/react-dom 19.3.0 MIT, @vitejs/plugin-react 6.1.2 MIT (peer vite ^8, unused), three 0.174.0 MIT, @types/three 0.174.0 MIT, @dimforge/rapier3d-compat 0.14.0 Apache-2.0, zod 3.25.76 MIT, vite 6.4.4 MIT, typescript 5.9.3 Apache-2.0, tsx 4.23.15 MIT, eslint 10.12.0 MIT, @eslint/js 10.0.1 MIT, typescript-eslint 8.71.2 MIT, @playwright/test 1.64.1 Apache-2.0, @types/node 22.20.5 MIT. bun is only a local tool (not a dependency, MIT) and needs no row. GitHub reports the repo license as 'other / NOASSERTION' because LICENSE has a non-MIT 'Note:' paragraph appended after the MIT text. The 'Textures' section says every texture embedded in the GLBs is generated by tools/blender/*; 465e004 adds a second, runtime texture source (src/world/ModelDetailEnhancer.ts canvas textures) that this sentence does not cover.

**Root cause**

The register was written for fonts/art only; no rule or test forces package.json changes to update it.

**Fix suggestion**

Append to docs/assets-licenses.md (verified: with this section the guard test passes, 1 pass / 0 fail):

## Code libraries (npm)
Versions are those resolved at commit 465e004. Shipped = bundled into the game page by vite build; Dev = build/test tooling only. Package manager is npm (CI: npm ci); bun is not a project dependency.
| Package | Version | License | Shipped / Dev | Used for |
|---|---|---|---|---|
| `three` | 0.174.0 | MIT | Shipped | 3D engine |
| `@dimforge/rapier3d-compat` | 0.14.0 | Apache-2.0 | Shipped (WASM inlined) | physics |
| `zod` | 3.25.76 | MIT | Shipped | i18n/save/cutscene schemas |
| `react` | 19.3.1 | MIT | Shipped | Victorian UI (src/main.tsx, src/App.tsx) |
| `react-dom` | 19.3.1 | MIT | Shipped | UI renderer (pulls in scheduler 0.28.0, MIT) |
| `@types/react` | 19.3.0 | MIT | Dev | typings |
| `@types/react-dom` | 19.3.0 | MIT | Dev | typings |
| `@types/three` | 0.174.0 | MIT | Dev | typings |
| `@types/node` | 22.20.5 | MIT | Dev | typings |
| `vite` | 6.4.4 | MIT | Dev | bundler / dev server |
| `typescript` | 5.9.3 | Apache-2.0 | Dev | compiler |
| `tsx` | 4.23.15 | MIT | Dev | runs TS in npm test |
| `eslint` | 10.12.0 | MIT | Dev | lint |
| `@eslint/js` | 10.0.1 | MIT | Dev | lint rules |
| `typescript-eslint` | 8.71.2 | MIT | Dev | lint rules |
| `@playwright/test` | 1.64.1 | Apache-2.0 | Dev | e2e (downloaded Chromium is not distributed) |
(Do not add a row for @vitejs/plugin-react: remove it from package.json, INST-01. If it is kept: '| `@vitejs/plugin-react` | 6.1.2 | MIT | Dev | unused, peer vite ^8 |'.)
Apache-2.0 code that ends up in the shipped bundle (rapier) must keep its licence text available, MIT code its copyright notice: emit a THIRD_PARTY_NOTICES.txt at build time for three, react, react-dom, zod, rapier.
Also extend the Textures section with: '- Runtime textures: src/world/ModelDetailEnhancer.ts paints gouache canvas textures at load time (seeded PRNG, no external images); they are original to this repository (MIT).'
Guard against recurrence: add tests/unit/licenses.test.mjs (picked up by the existing glob in npm test): read package.json dependencies + devDependencies and assert each name appears as `name` in docs/assets-licenses.md (assert.deepEqual(missing, [], ...)). Move the 'Note:' paragraph out of LICENSE into docs/assets-licenses.md so GitHub detects MIT.

### [major] PROC-02 — ROUND2_TASK.md tells agents to push to the already-merged PR branch; CI does not run on branches without a PR, so in-flight agent work is unverified

**可信度**：📖 仅审查员证据，未复核

**Evidence**

docs/review/ROUND2_TASK.md:145 '每个有意义的进展：提交并推送到 claude/fervent-brahmagupta-4qe1y9（PR #2 会自动更新）'. list_pull_requests: PR #2 state=closed (merged 2026-10-15T02:21:17Z); no open PR. ci.yml triggers only push to [main, master] and pull_request to [main, master]. The live repo HEAD is 6fa5bda on claude/fervent-brahmagupta-4qe1y9 ('wip(art): hall painters (in-flight agent work)') with further uncommitted changes, so those commits get no CI. AGENTS.md/GEMINI.md contain the stop rule but no branching or push rule.

**Root cause**

Instructions were written while PR #2 was open and never updated after the merge.

**Fix suggestion**

ROUND2_TASK.md:145 -> '# 3) every meaningful step: commit on a topic branch (claude/<topic>), push, open or update a PR to main and wait for the CI Pipeline to be green; NEVER push directly to main. PR #2 is merged: do not reuse its branch.' Add to AGENTS.md a section: '## Repository rules (all agent tools incl. Google AI Studio)\n* Never push to main; work on a branch and open a PR; main is protected and requires the CI Pipeline checks.\n* Package manager is npm; package-lock.json is the only lockfile; do not add bun.lock.\n* Dev server: npm run dev -> http://localhost:3000 (also used by Playwright).\n* UI is React 19 (src/main.tsx, src/App.tsx); the engine stays framework-free.\n* Do not commit tool scratch: .aistudio/, .tempmediaStorage/, test-results/, playwright-report/.\n* A rendering change needs a fresh npm run gate -- --quick capture in docs/devlog/gate and screenshots in docs/devlog/screens, or the PR must say NOT MEASURED.\n* New library/font/texture: register it in docs/assets-licenses.md in the same PR.' GEMINI.md: append 'Applies to every Gemini tool (Antigravity and Google AI Studio): the repository rules in AGENTS.md are binding; do not push to main.' The stop-rule text in AGENTS.md, GEMINI.md and CLAUDE.md 7 is correct and consistent as it is.

### [minor] DOC-04 — PROJECT.md and TEST_INFRA.md document a mutating harness API that does not exist; REMEDIATION F-05 claims 'no mutation backdoors' but movePlayerTo teleports (pre-existing, untouched by 465e004)

**可信度**：📖 仅审查员证据，未复核

**Evidence**

PROJECT.md:75-83 Test Harness Contract lists goto, setFlag, getFlag, addItem, setScale, getState, triggerInteraction; TEST_INFRA.md:11 lists goto/setFlag/addItem/setScale. Actual window.__game (src/testing/testHarness.ts, window typing in src/App.tsx): getState, getFlags, getFlag, getInventory, getPlayerTransform, getInteractables, getCameraState, getPlayerMotion, getRenderStats, getRenderBreakdown, getNearbyInteractable, getAliceAnimation, getAliceBoneWorld, getSceneMetrics, setTimeScale, fastForward, movePlayerTo(x,z) (testHarness.ts:115-120 calls characterController.setPosition, i.e. a teleport), lookAtBottleSide(side). Registration is gated by ?test=1 (testHarness.ts:7-9) and a tier5 test (T5-ADV-04) asserts that production does not expose it. REMEDIATION_LOG F-05 says 'without state/flag mutation backdoors'; AGENTS.md forbids teleporting through window.__game. git diff fc6fcf2 465e004 -- src/testing is empty.

**Root cause**

Docs predate the WP-9 read-only hardening; the helpers added later (movePlayerTo, lookAtBottleSide) were not reconciled with the 'read-only' wording.

**Fix suggestion**

Replace the PROJECT.md contract block with the real list above under the heading 'window.__game (only with ?test=1): read-only inspection (get*), simulation acceleration (setTimeScale, fastForward) and two positioning helpers used by the e2e helper (movePlayerTo, lookAtBottleSide) - agents must not use them to skip puzzle steps'. In REMEDIATION_LOG F-05 change 'without state/flag mutation backdoors' to 'flags and inventory cannot be written; movePlayerTo/lookAtBottleSide are the only positioning helpers'. Delete the goto/setFlag/addItem/setScale mentions from TEST_INFRA.md:11 and TEST_READY.md. Whether movePlayerTo should exist at all is the e2e reviewer's call.

### [minor] HYG-01 — React added without react-hooks lint; legacy UIManager.ts left behind; gate floor check fails open without git history

**可信度**：📖 仅审查员证据，未复核

**Evidence**

eslint.config.mjs uses only typescript-eslint recommended; src/App.tsx (936 lines) uses useEffect/useCallback/useRef and no eslint-plugin-react-hooks is installed (npm run lint exit 0 proves nothing about hook dependency bugs). src/ui/UIManager.ts (651 lines) is unreferenced. Gate: in the export snapshot (not a git repo) npm run gate:check gives 21/30 with '[PASS] thresholds-floor thresholds not committed yet - the first commit will become the permanent floor' and no 'metrics-pin-floor' check, whereas in a real clone it gives 31 checks and 'no threshold lowered since d7d7c17' / 'pin unchanged'. actions/checkout@v4 defaults to depth 1, so a CI gate job would silently skip the floor.

**Root cause**

Framework swap without its tooling; the gate falls back to 'no history = no floor'.

**Fix suggestion**

Lint: npm i -D eslint-plugin-react-hooks, add its recommended flat config for src/**/*.tsx, register it in docs/assets-licenses.md (the guard test will demand it). UIManager.ts: delete it in the DEC-01 PR (git rm src/ui/UIManager.ts). Gate: README section 4 add 'Run the gate in a full git clone (the threshold floor is read from git history); an export or shallow clone silently skips the floor checks.'; in the CI gate job use fetch-depth: 0 (PROC-01 C). Hardening quality-gate.mjs to fail when CI=true and history is missing would only tighten the gate, but the file is protected (CLAUDE.md 7.2): do it only with the owner's explicit approval.

### [minor] LEAK-01 — .aistudio/artifacts/brain/<id>/ (plan, metadata, 4 PNGs = 6.0 MiB) and root metadata.json are accidental Google AI Studio tool output, harmless but should not be tracked

**可信度**：📖 仅审查员证据，未复核

**Evidence**

Opened every file. implementation_plan.md (103 lines): an AI Studio plan titled 'Painterly 3D Modeling & Gouache Finish Overhaul' with 'Confirmed Direction from Clarifying Questions'; it plans work that this commit does not contain (expression morphs wired into cutscenes, S1-S7 re-sculpts, GLB props in the inspector) and quotes the dress colour as #E8C66A instead of the canonical #E9C46A (CLAUDE.md 3.2). implementation_plan.md.metadata.json: {summary, updatedAt 2026-10-15T02:40:06Z, requestFeedback true, userFacing true}. grep for /home/, /Users/, api key, token, secret, password, bearer, AIza, sk-, e-mail addresses: no match. The 4 PNGs (900x1000 and 3 x 1280x720, sha256 927a0222..., 4b97e75b..., 92610d17..., 06342fb0...) are plain game screenshots with no browser chrome: the sister model on a grey backdrop, S1 riverbank with the oak, picnic rug, sister and Alice, S3 well with shelves, S5 hall with parquet/runner/wallpaper and the glass table: no personal data, no paths, no credentials. Sizes 432,794 + 1,908,309 + 1,936,120 + 1,972,617 = 6,249,840 B; the folder is not under public/ so it is not shipped. metadata.json: {name, description, requestFramePermissions: []} is an AI Studio app manifest.

**Root cause**

The tool's working directory was committed wholesale; .gitignore has no entry for it.

**Fix suggestion**

Remove (do not keep): in a PR branch:
git switch -c chore/untrack-aistudio origin/main
git rm -r .aistudio
git rm metadata.json      # unless the owner still runs the app inside AI Studio; then keep it and document that in README
printf '\n# Google AI Studio agent scratch (plans + temp screenshots) - never commit\n.aistudio/\n' >> .gitignore
git add .gitignore && git commit -m 'chore: stop tracking AI Studio artefacts (plan + 4 temp screenshots, 6.0 MiB)'
git push -u origin chore/untrack-aistudio
Do not rewrite history (git filter-repo + force push): there are no secrets, the history cost is 6.0 MiB of a 108 MB .git, and a rewrite would invalidate branches such as 6fa5bda. If the owner wants to keep the plan as documentation: git show 465e004:.aistudio/artifacts/brain/89363416-2106-4a64-9055-d6192a7d7938/implementation_plan.md > docs/review/AISTUDIO_PLAN_2026-10-15.md and prepend 'PROPOSAL ONLY - not implemented; dress colour here is #E8C66A, canonical is #E9C46A'.
