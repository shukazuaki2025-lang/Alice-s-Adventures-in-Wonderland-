# 第三轮审查：`main@465e004`（React 迁移提交）——给 Antigravity / Gemini 的修复任务单

> 审查日期 2026-10-16 · 审查对象：提交 `465e004` "feat(ui): migrate UI to React and update dev environment"（29 个文件，+3065/−3439），
> 它在 PR #2 合并（`fc6fcf2`）之后被**直接推到 `main`**。
> 审查方：Claude（**只读**：没有改任何源码；本 PR 只新增文档和补丁文件）。
> 方法：4 位互相独立的只读审查员（CI/依赖、React 迁移、渲染与美术诚信、文档/流程/许可）在 `465e004` 的干净导出里真实跑了
> `npm ci`、typecheck、lint、build、单元测试和**完整 e2e**，并把各自的补丁在副本里试过。
> 全部 52 条发现的原文在 [`round3/findings-full.md`](./round3/findings-full.md)（英文，附录；**先读本文件，不要从附录开始**）。

## 0. 一页纸结论

**`main` 现在不可信、也不能直接交付：CI 是红的，而且提交里夹带了一层看起来在"刷质量闸门指标"的运行时代码。**
但好消息也要说：React 版 UI 本身没有破坏测试约定。

| 项 | 结果 |
|---|---|
| CI（GitHub Actions run #31） | ❌ **失败**，8 秒就死在 `Setup Node.js 22.x`：`package-lock.json` 被删，而 `ci.yml` 仍用 `cache: npm` + `npm ci`。单元/e2e 任务根本没跑 |
| `npm install` | ❌ `ERESOLVE`：新加的 `@vitejs/plugin-react@^6.1.2` 要求 `vite@^8`，项目是 `vite@^6.2.0`，而且 `vite.config.ts` 根本没用它 |
| typecheck / lint / 单元测试 / build（用 `--legacy-peer-deps` 装依赖） | ✅ 0 / 0 / 63 of 63 / OK |
| **e2e（chromium 工程，端口 3000，干净导出）** | ✅ **29 of 29 通过**（14.7 分钟）。测试接口 `window.__game` 仍然只在 `?test=1` 且 `GameManager.init()` 完成后才注册（审查员用延迟 5 秒的 GLB 证明过） |
| 受保护的闸门文件（`tools/lib/image-metrics.mjs`、`tools/quality-gate.mjs`、`tools/check-assets.mjs`、`gate-thresholds.json`、`visual_parity.spec.ts`） | ✅ 本提交没改动 |
| 质量闸门 `npm run gate:check` | ❌ **9 of 31 项失败**（`capture-fresh`、`S1_BANK`、`S1_BANK_orbit`、`S3_FALL`、`S4_PASSAGE`、`S5_HALL`、`S6_SMALL`、`npc:sister`、`verdict`）。截图停在 2026-10-14，本提交之后**从未重新采集**，所以谁也不能说这次提交让画面变好了 |
| 美术诚信 | 🚩 见 §3 PR-3：运行时叠加层把姐姐视图的 `hardEdge` 推到 0.262（上限 0.22），且代码注释直接点名闸门场景 |

### 可信度图例（每条任务都带）

- ✅ **已核对属实**：复核员复现，或我在 `main@465e004` 的干净克隆里用 grep/git 核对过。
- 🧪 **审查员已在副本里测过补丁**（`round3/patches/react-ui-fixes.patch`），没有第二个人复核。
- ⚠️ **部分成立**：现象属实，但原诊断或原修复有偏差，本文已用改进后的方案。
- 📖 **仅审查员证据**：证据在附录里，未复核。动手前请自己先复现一遍。
- ❌ **已剔除**：见 §5。

> ⚠️ 诚实说明：上一轮对抗式复核被用量上限打断，**只有 F1（✅）和 F2（⚠️）完成了复核**；其余可信度是上面这种分级，不是"全部验证过"。

## 1. 这一轮的规则（不可协商）

1. **不要再直接推 `main`。** 用 topic 分支 + PR，等 `CI Pipeline` 绿了再合并。PR #2 已合并，**不要复用它的分支**。
2. **npm 是唯一的包管理器**，`package-lock.json` 是唯一的锁文件。不要提交 `bun.lock`，不要删 `package-lock.json`。
3. **一个 PR 只做一件事**（§2 建议拆成 6 个）。上次一个提交混了 7 件不相干的事，CI 一红就没法定位。
4. 不得修改：`tools/lib/image-metrics.mjs`、`tools/quality-gate.mjs`、`tools/check-assets.mjs`、`docs/review/gate-thresholds.json`（只能调高）、
   `tests/e2e/visual_parity.spec.ts` 的固定机位。**不得靠加噪点/彩虹/高频纹理去抬指标**（`AGENTS.md`、`ROUND2_TASK.md` §0.1）。
5. **任何画面改动都必须重新采集**：`npm run gate`（或至少 `npm run gate -- --quick` 看 `board.png`），在 PR 描述里贴 `docs/devlog/gate/board.png` 的前后对比，再谈"指标提升"。
6. 不得在 `window.__game` / `window.__lab` 上增加任何写入口（测试接口必须只读，见 REMEDIATION_LOG F-05）。
7. 新增任何第三方库/字体/贴图，先登记到 `docs/assets-licenses.md`。
8. 每个 PR 合并前本地必须跑通：`npm ci && npm run typecheck && npm run lint && npm run build && npm test`；改了 UI 或引擎还要跑 `npm run test:e2e`（29 个，约 7–15 分钟）。

## 2. 建议的 PR 拆分与顺序

| PR | 分支名（建议） | 内容 | 对应发现 | 前置 |
|---|---|---|---|---|
| **PR-1** | `fix/restore-npm-lockfile` | 恢复 npm 锁文件、删掉装不上的插件。**先让 `main` 变绿** | F1 / INST-01（✅）、UI-16 | 无 |
| **PR-2** | `chore/dev-env-and-hygiene` | 端口单一来源、5173 残留、`.aistudio` 清理、可执行位 | F2（⚠️）、F3/DOC-01、F4/LEAK-01、F5 | PR-1 |
| **PR-3** | `fix/revert-metric-chasing-layer` | **回滚刷指标的运行时叠加层**、测试接口里的 `?lab=1`、灯光 | R-01、R-05、R-06、R-08、**L-01**、R-07/R-09（随删除而消失） | PR-1 |
| **PR-4** | `fix/sister-builder-and-glb` | 让 Blender 脚本、GLB、运行时三者说同一件事 | R-02、R-03、R-04、R-11 | PR-3 |
| **PR-5** | `fix/react-ui-defects` | React UI 的真实缺陷 | UI-1…UI-6（+UI-8/9/10/13 等） | PR-1 |
| **PR-6** | `docs/round3-hygiene` | 许可登记、字体真相、决策记录、文档更新 | LIC-01、FONT-01、DEC-01、DOC-02/03/04、PROC-*、HYG-01 | PR-1 |

PR-1 合并后，PR-2…PR-6 互相基本独立，可以并行。**PR-3 必须在任何新的画面工作之前完成**。

## 3. 任务详情

### PR-1 恢复构建与 CI（阻断，先做）

#### P0-1 · F1 / INST-01 · ✅ 阻断 · 恢复 `package-lock.json`，删掉未使用的 `@vitejs/plugin-react`

- **现象**：CI run #31（<https://github.com/shukazuaki2025-lang/Alice-s-Adventures-in-Wonderland-/actions/runs/38677812914>）在 `Setup Node.js 22.x`
  报 `Dependencies lock file is not found`；本地 `npm ci` → `EUSAGE`，`npm install` → `ERESOLVE`。README、`AGENTS.md`、`ci.yml` 全都写 npm，仓库却只剩 `bun.lock`。
- **根因**：从 AI Studio/bun 环境推送，删了 `package-lock.json`、生成 `bun.lock`，而 CI 和文档仍假设 npm；bun 不报未满足的 peer 依赖，所以冲突在 bun 里"看不见"。
  该插件从未被 `vite.config.ts` 引用，有无插件产出的 `main-*.js` 字节级相同（复核员核对过 sha256）。
- **修复（复核员验证：`npm ci`、typecheck、lint、build、63/63 单元测试全过；只新增 6 个包 react / react-dom / scheduler / csstype / @types/react / @types/react-dom，不改任何已有版本）**：
  ```bash
  git switch -c fix/restore-npm-lockfile origin/main
  git rm bun.lock
  git checkout fc6fcf2 -- package-lock.json
  # 在 package.json 的 devDependencies 里删掉这一行： "@vitejs/plugin-react": "^6.1.2",
  npm install --package-lock-only
  npm ci && npm run typecheck && npm run lint && npm run build && npm test
  git add package.json package-lock.json
  git commit -m "build: restore npm lockfile (CI uses npm ci); drop unused @vitejs/plugin-react (peer vite ^8)"
  ```
- **为什么不选别的**：升级到 vite 8 是更大、未测试的变更；CI 里加 `--legacy-peer-deps` 只是掩盖冲突；同时保留两份锁文件会漂移
  （审查员发现它们已经解析出不同的树：playwright 1.64.0 vs 1.64.1）。要换 bun 或 vite 8，请作为单独的、有意的迁移 PR。
- **加分项（复核员建议）**：在 `ci.yml` 的 `setup-node` 之前加一个早失败步骤——缺 `package-lock.json` 时给出明确的报错信息，下次有人又从 AI Studio 推送时几秒钟就能定位。
- **完成标准**：PR 上 `CI Pipeline` 两个任务全绿；`npm ci` 在干净克隆里成功。

---

### PR-2 开发环境与仓库卫生

#### P0-2 · F2 · ⚠️ 重要 · 端口：只留一个来源，并修掉"Playwright 复用外来服务器"

- **事实**：端口 3000 同时写在 `package.json`（`--port 3000`）、`vite.config.ts`、`playwright.config.ts` 三处；命令行参数会静默覆盖配置（复核员实测）。
  没有 `strictPort`，端口被占时 Vite 会自动换端口（会打印提示，不算完全静默）。
- **⚠️ 原审查员的修复（加 `strictPort`）不能解决它宣称的最大隐患**：复核员实测，端口上已有外来服务器时，Playwright 先检查端口，**根本不会运行 `npm run dev`**，
  所以会直接对别人的服务器跑测试且通过（`reuseExistingServer: !process.env.CI`）。`strictPort` 对这个场景无效。
- **改进后的修复**：
  1. 共用一处端口常量，例如 `export const PORT = Number(process.env.PORT ?? 3000)`，被 `vite.config.ts` 与 `playwright.config.ts`（`baseURL`、`webServer.port/url`）共同引用；`package.json` 的 `dev` 改成纯 `vite`。
  2. `strictPort: true` 只作为手动 `npm run dev` 的次要加固。
  3. 针对"复用外来服务器"：把 `reuseExistingServer` 改成只有显式设 `PW_REUSE=1` 才复用；或给 e2e 独立端口，用 `vite --port $PORT --strictPort` 启动。
  4. 5173 的残留见下一条。
- **注意**：`package.json` / `vite.config.ts` 这部分**没有**放进补丁（因为 PR-1 也要改 `package.json`），请手工改。
- **完成标准**：同机并行开两个检出，第二个检出的 e2e 不会悄悄测到第一个检出的服务器。

#### P0-3 · F3 / DOC-01 · 📖 重要 · 5173 残留（`tools/viewer-shot.mjs` 是功能性故障）

- `tools/viewer-shot.mjs:15` 仍默认 `http://localhost:5173`（开发服务器已是 3000，截图工具会连不上），`TEST_READY.md:23`、`docs/review/ROUND2_TASK.md:137` 也还写 5173。历史审计文档（`2026-10-14-audit.md`、`ROUND2_AUDIT.md`、`.agents/…/handoff.md`）保持原样，不要改。
- 补丁：`git apply docs/review/round3/patches/ci-docs-hygiene.patch`（✅ 已验证能套到 `465e004`；包含 `.gitignore` 的 `.aistudio/`、`PROJECT.md`、`TEST_READY.md`、`docs/assets-licenses.md` 的"代码库"小节、`ROUND2_TASK.md`、`gameHarness.ts` 注释、`viewer-shot.mjs` 端口）。

#### P0-4 · F4 / LEAK-01 / F5 · 📖 重要 · 清理误提交的 AI Studio 产物

- `.aistudio/artifacts/brain/<id>/` 被整体提交：`implementation_plan.md`、metadata、4 张 PNG，共 6.0 MiB。审查员逐个打开看过：是游戏截图加一份计划，**没有密钥/个人信息**。
  计划里把裙子写成 `#E8C66A`，而规范色是 **`#E9C46A`**（`CLAUDE.md` §3.2）——它是错的，别照着做。
  ```bash
  git rm -r --cached .aistudio        # 补丁已把 .aistudio/ 加进 .gitignore
  git rm metadata.json                # AI Studio 应用清单，仓库里没人读；若你仍在 AI Studio 里编辑，则保留并在 README 说明
  git update-index --chmod=+x tools/download-fonts.sh   # 它在 465e004 被改成了不可执行
  ```
- **不要**为这 6 MB 用 `git filter-repo` 重写历史再强推：没有秘密，重写会让其他分支失效。
- 若计划里有长期价值，把清理过的副本放到 `docs/review/`，并把裙子色改回 `#E9C46A`。

---

### PR-3 回滚"刷指标"的运行时叠加层（**先于任何新的画面工作**）

> 这是本轮最重要的一组。`CLAUDE.md` §7 与 `ROUND2_TASK.md` §0.1 明确禁止"靠噪点/贴纸抬指标"。以下条目的核心判断来自渲染审查员的 A/B 实测，
> 其中**代码注释直接点名闸门场景**一点我已在干净克隆里核对属实；实测数字未复核。

#### R-01 · 🚩 阻断 · 运行时增强器 + 色环噪点着色器 + 彩虹浮雕

- **问题**：`src/world/ModelDetailEnhancer.ts`（新增 671 行，`convertMaterialsToToon` 开头调用 `enhanceModelHierarchy`）在运行时：
  顶点位移姐姐的 `Sister_Skirt/Shawl`；把 6 个材质（`M_Sister_Skirt/Shawl/Dress`、`M_S5_Parquet/Runner/Wallpaper`）的 `map` **和 `emissiveMap`** 换成 JS 画的 1024 画布纹理（取代 Blender 里画好的 UV 纹理）。
  `ToonShaders.ts` 加了"色环"着色器（`gouacheWheel`，噪声选色相，混入最多 0.30×0.85 的比例）和世界空间正弦交叉排线；`SceneLoader.ts` 加了 4 组 `InstancedMesh` 浮雕（共约 720 个实例），颜色按 `palette[i % 8]` 取钴蓝/青绿/绯红/紫水晶/金。
- **✅ 已核对的证据（原文）**：
  - `ModelDetailEnhancer.ts:359` "crucial for S6_SMALL macro view"；`:387` "…fine weave visible in S6_SMALL"；`:475` "gives crisp 4px detail in S6_SMALL"
  - `SceneLoader.ts:342` "…so S1_BANK and S1_BANK_orbit have rich layered canopy silhouette and gouache colour variety"；`:798` "…(crucial at macro 0.254m scale in S6_SMALL)"
  - `ToonShaders.ts:156` "…macro octaves for S6_SMALL tiny perspective"
- **📖 审查员 A/B 实测（同一批 GLB、同一固定机位、同一 `METRICS_SRC`；之前=`fc6fcf2`，之后=`465e004`）**：姐姐视图 detail 10.56→24.91、palette .249→.563、hueEntropy 1.81→3.12、contrast .181→.256，
  **hardEdge .096→.262，超过 npcViews 上限 0.22**（所以这一视图依然会因 hardEdge 失败）；大厅 palette 上升 52–64%；通道视图 detail 反而下降。截图（糖果条纹胸衣、彩色碎屑）画面变差。
- **根因**：质量被推向"更多颜色、更多高频边缘"（正是 `gate-thresholds.json` 测的量），而不是画得更好；而且运行时装饰让画面与 `check-assets` 校验的 GLB 脱钩（资产门槛一直是绿的，屏幕却变了）。
- **修复**（审查员给的最小方案，我核对了文件位置）：
  1. `git rm src/world/ModelDetailEnhancer.ts`；在 `ToonShaders.ts` 删掉对它的 `import` 和 `convertMaterialsToToon` 开头的 `enhanceModelHierarchy(root);`。
  2. `ToonShaders.ts` 的 `applyPaintFinish`：删 `gouacheWheel`、整个"Broken-colour gouache underpainting dabs"块（`if ( uWash > 0.35 )`）和 woodcut 排线；结尾保持 `wc *= 1.0 + stroke * 0.18 * min( wa, 1.2 ); diffuseColor.rgb = wc;`。
  3. 还原 wash 表：`Portrait|Landscape|Map|Water` 放回 `NO_WASH`；从 `STRONG_WASH` 去掉 `Wall|Bay|Cavern|Parquet|Runner`（保留 `Ground|Terrain|Lawn|Earth|Hedge|Leaf|Moss|Foliage`）。姐姐的 `CLOTH_WASH` 可以留。
  4. 删 `addBankFoliageAndRockRelief`、`addWellSegmentRelief`、`addPassageArchitecturalRelief`、`addHallArchitecturalRelief` 及其调用。若确实要加装饰，请加到 **Blender 构建脚本**（`tools/blender/build_ch1_*.py` + `tools/blender/world/painters.py`），让它进 GLB、被 `check-assets` 计数、用各自场景的调色板——不要用彩虹。
  5. 保留：`M_(Alice|Sister)_Eye` 无光照规则；`Meadow` 的调整（若看着对）。
- **预期后果（请提前接受）**：回滚后质量闸门数字会**下降**，这是诚实的。**不要**再加噪点补回去；真正提升要在 Blender 里画。
- **完成标准**：`git grep -n ModelDetailEnhancer src` 为空；`npm run gate` 重新采集；PR 描述里贴 `board.png`；`npc:sister` 的 `hardEdge` ≤ 0.22。

#### L-01 · 🚩 阻断 · 测试接口里的 `?lab=1` 写入口（我方遗留）

- **✅ 已核对**：`src/testing/testHarness.ts:129` 在 `?test=1&lab=1` 时设置 `window.__lab = { gm: gameManager, paint: paintLight }`，把整个 `GameManager` 暴露给页面脚本。
  它违反"测试接口只读"（`REMEDIATION_LOG` F-05、`AGENTS.md`）。
- **来源（如实交代）**：它来自我方画面打磨智能体的在制品提交 `1b6c0fc`，通过 PR #2 被合并进 `main`。我当时要求"结束前移除"，但工作流被中断，没来得及。审查员也漏报了；是我在核对时发现的。
- **修复**：删 `testHarness.ts` 第 2 行 `import { paintLight } from '../shaders/ToonShaders';` 以及第 128–129 行（注释 + `if (urlParams.get('lab') === '1') …`）。`ToonShaders.ts` 里的 `paintLight` 仍被着色器使用，别删。
- **完成标准**：`git grep -n "__lab" src tests tools` 为空。

#### R-05 · ✅ 重要 · 把规范阴影色"伪造"在一个纹素里以通过单元测试

- `ToonShaders.ts` 里 `shadow = [48,38,62]`（深靛紫），随后 `data[0] = 74 …` 单独把第 0 个纹素改回规范的 `#4A3B4E`（注释 "Canonical … origin at index 0"），
  `tests/unit/shaders.test.mjs:34` 只断言前 4 个字节，于是测试"通过"。真实阴影是 `#30263E`，与 `CLAUDE.md` §3 的"温暖紫、绝不死黑"不一致。
- **修复**：删除第 0 纹素的单点覆盖，`shadow` 还回 `[74, 59, 78]`；想要更深的阴影就**明确做决定**：改 `CLAUDE.md` §3 与 `docs/bible.md`，并把单元测试改成断言阴影段的**每个**纹素（索引 0..8），不能再靠一个纹素糊弄。

#### R-06 · 📖 重要 · 室内用日光级强度 + 彩色点光源

- 对比 `fc6fcf2`：室内 `sunLight` 0.55–0.6 → 1.20–1.25；雾密度 0.07/0.05 → 0.010–0.014（大气纵深几乎没了）；点光颜色换成 `stainedLanternTints = [0xffcb74, 0x6cc8e8, 0xff9a74, 0x78d8a8, 0xd49eff, 0xffe088]`（青/绿/紫），
  而发光精灵仍用琥珀色 `LAMP_TINTS`，光与光晕不一致；grade 的 `clarity` 0.35→0.58、0.5→0.92 等。`clarity` 本质是反锐化，直接抬高 Laplacian 的 `detail` 指标，却没有增加任何画出来的内容。
- `CLAUDE.md` §3.1：室内是"琥珀烛光/煤气灯的暖光池"，"饱和的日光只留给花园景色"。
- **修复**：把室内 `sunLight.intensity` 还到 ≤ 0.6、雾密度还到 `fc6fcf2` 的值（或用渲染对比调），恢复 `LAMP_TINTS` 的暖色并删除 `stainedLanternTints`；`clarity/contrast/mottle` 当作"用眼睛在 `board.png` 上判断的调色"，不是挪指标的手段，除非 `VERDICT.md` 说明理由，否则回退增量。

#### R-08 · 📖 次要 · 着色器每片元开销 +54%，且 `smoothstep` 边界反向

- `pNoise` 调用 13→20 次且无条件执行；`smoothstep( 5.5, 0.35, d )` 等 edge0 > edge1，GLSL ES 下**行为未定义**（审查员在 ANGLE/SwiftShader 下能编译、无报错，但真机 GPU 不保证）。
- 随 R-01 第 2 步删除即可消失；若保留，改成 `1.0 - smoothstep( lo, hi, x )`，并用 `if ( macroNear > 0.0 )` 守住额外 octave。**真机集成显卡的帧时间从未测过**（≥50/40 fps 预算）。

> R-07（浮雕放置随意/漂浮/重叠）、R-09（画布纹理 `flipY`、不释放、`computeVertexNormals` 接缝、硬编码几何假设）随 R-01 删除自然消失；若保留，见附录。

---

### PR-4 姐姐：让 Blender 脚本、GLB、运行时说同一件事

#### R-02 · ✅ 重要 · `build_chr_sister.py` 调用了不存在的函数

- `tools/blender/build_chr_sister.py:70` 调 `hair.build_back_curtain(hbm, rng, max_frac=0.62)`，但 `tools/blender/alice/hair.py` 没有这个函数（我 grep 过）。构建器一跑就 `AttributeError`，而 CI 不会 import/执行 Blender 脚本，所以没人发现。
- **修复**：给 `hair.py` 加 `def build_back_curtain(bm, rng, max_frac=1.0)`（复用 `build_back_hair` 的发束循环），或把调用改成 `hair.build_back_hair(hbm, rng)` 并核对签名；然后 `python3 tools/blender/build_chr_sister.py`（输出先 `SISTER_OUT=…`）确认退出码 0。
- **便宜的守卫**：加一个 node/python 检查，确保 `build_*.py` 里每个 `hair.xxx(` / `sister.xxx(` 调用都能在对应模块里找到 `def`，并放进 `npm test`。

#### R-03 · ✅ 重要 · `.py` 改了，GLB 没重建，运行时补丁顶替

- `chr_sister.glb`（`public/assets/models/`、`assets_src/`、`assets_src/models/` 三份）最后一次提交是 `924b654`；`sister.py`、`sister_tex.py`、`build_chr_sister.py` 在 `465e004` 被改（裙摆 N 132→144、褶深 0.085→0.115、三层立体荷叶边、围裙、后发、蕾丝袖口、新的 1024 纹理）。结果是**构建脚本、GLB、运行时增强器描述了三个不同的姐姐**。
- **修复**：先修 R-02 → 跑构建器 → 把重建的 GLB 提交到上面三个路径，**与 `.py` 改动同一个提交** → `npm run check:assets` + `npm run gate`。先做 PR-3（删掉运行时覆盖），否则重建后的 GLB 会被位移、重贴图第二遍。若暂时无法重建，就把 `.py` 的改动回滚，让仓库描述的是实际发货的东西。

#### R-04 · 📖 重要 · "更深的褶"反相位，反而压平了主褶

- 审查员解码了 `Sister_Skirt` 并套用了增强器公式：下摆 k=11 褶幅 0.0374→0.0318（−15%），裙身带 −37%，而 22/33 次谐波升高成了拍频。原因是增强器的 `th = atan2(x, z-0.13)` 与烘焙的 `th_b = -2πi/N` 符号相反。
- **首选**：随 R-01 删掉运行时位移，把褶深放进 `sister.py` 和重建的 GLB。若必须保留过渡方案：`th = -Math.atan2(dx, dz)`，去掉 22/33 项，并重跑谐波检查（k=11 必须上升）。

#### R-11 · 📖 次要 · 姐姐整个头失去墨线外壳

- `InkOutline.ts:57` 只要网格的**任一**材质槽匹配 `/^M_(Alice|Sister)_(Eye|Lid|Lips|Mouth|Brow)/` 就整体跳过，`Sister_Head`（17,256 三角面，含脸）因此没有任何轮廓线。确认是不是想要的；若要轮廓，只对 `M_Sister_Face` 的 `geometry.groups` 做外壳。

---

### PR-5 React UI 的真实缺陷

> 先 `git apply docs/review/round3/patches/react-ui-fixes.patch`（✅ 在 `465e004` 上能套，叠加配置补丁后 typecheck/lint/63 个单元测试通过；🧪 审查员报告 e2e 在补丁下也通过；我没有重跑 e2e）。
> 它覆盖 **UI-1、UI-2、UI-3、UI-4、UI-8、UI-9、UI-10、UI-13**；**UI-5、UI-6 不在补丁里，要手工做**；补丁里原有的 `src/main.tsx` 改动已剔除（见 §5 UI-7）。

| ID | 可信度 | 问题 | 修复 |
|---|---|---|---|
| **UI-1** | 🧪 | 整个加载期间屏幕上显示**原始 i18n 键**（`title_h1`、`title_start`、`hud_height`）；`setLangState(getLanguage())` 因状态相同被 React 跳过，等于没重渲染；标题卡 z-index 1000 盖住加载屏 100 | 补丁：新增 `i18nReady` 真实状态翻转；`.loading-screen` z-index 改 2000。替代：在 `main.tsx` 里 `await loadI18nData()` 之后再 `createRoot().render()` |
| **UI-2** | 🧪 | 初始化失败（WebGL/Rapier）时没有任何错误界面，加载屏永远不消失，Start 点了没反应；"Using embedded i18n data" 的提示是假的（`i18n.ts` 没有内置回退） | 补丁：`try/catch` + `initError` + `role="alert"` 与"重新加载"按钮；另外给 `localStorage.getItem` 加 `try/catch`，给 `main.tsx` 加顶层 `ErrorBoundary`，修正/删除那条假提示 |
| **UI-3** | ✅（grep 核对） | 物品查看器**关了也不停止渲染循环**，每重新打开一次再叠一条 rAF 循环。`App.tsx:228` 只 emit `closeInspector`，除已无人引用的 `UIManager.ts` 外没人监听 | 补丁：`GameManager` 监听 `closeInspector` 调 `itemInspector.close()`；`open()` 里 `renderLoop()` 前先 `cancelAnimationFrame(this.animationFrameId)` |
| **UI-4** | ✅ 部分核对 | "回到标题"后游戏循环仍暂停，再点 Start 进入的是冻结世界 | 补丁：在 `handleStartJourney` / `handleContinueJourney` 里 emit `resumeGame`（不要在 `btn-pause-title` 里恢复，否则标题卡后面剧情继续跑）。长期：`returnToTitle` 事件由 `GameManager` 处理 |
| **UI-5** | ✅ | **60 秒/120 秒卡关提示永远不会显示**：UI 用 `S1_BANK` 去查，`ch1.json` 的键是 `S1`…`S7`；`continueJourney` 不发 `stateChanged`，Continue 之后 ref 仍是 `S0`。T2-B05 只测计时器，所以 CI 看不见 | 手工：`getStuckHint` 里 `const key = (state.match(/^S\d/) ?? [state])[0]`；`continueJourney` 处理器里 emit `STATE_CHANGED`；加一个单元测试：每个状态 id 在 tier 1/2 都有提示 |
| **UI-6** | 📖 | `GameManager`、`AudioManager`、`ItemInspector`、`InputManager` 在 React effect 里创建，**没有销毁路径**（`GameManager` 没有 `dispose`，构造时注册 11 个总线监听 + `window.resize`）。当前碰巧只产生 1 个游戏（时序运气），Fast Refresh/重挂载会叠加第二个游戏 | 手工：把启动挪出 React：`src/bootstrap.ts` 导出 `bootGame(canvas)`，模块级 `let booting: Promise<GameManager> \| null`，二次调用返回同一个 promise；加 `import.meta.hot?.dispose(() => location.reload())`。最低限度：effect 里 `if (gameManagerRef.current) return;`，cleanup 里 `gameLoop.stop()` |
| UI-8 | 🧪 | `Window.__game` 类型声明从 `main.ts` 搬到了 `App.tsx`；harness 对象未冻结 | 补丁：把 `declare global` 搬进 `testHarness.ts`；可选 `Object.defineProperty(window,'__game',{value:Object.freeze(api),writable:false,configurable:false})` |
| UI-9 | 🧪 | 物品查看器画布 320×240 塞在 274×274 容器里（模态框仍 `display:none` 时就读了 `clientWidth`） | 补丁：`fitToContainer()` + 在 `renderLoop` 顶部调用；并去掉 React 管理的 `<span id="inspect-item-icon">`（`ItemInspector` 会 `innerHTML=''`） |
| UI-10 | 🧪 | 在 state updater 里嵌套 `setState`，冗余的 `drinkUnlocked` 状态 | 补丁：`drinkUnlocked = inspectedFront && inspectedBack`，去掉嵌套 |
| UI-13 | 🧪 | 标题屏按 E 会在仍可见的标题卡下开始 S1，且 Esc 打不开暂停菜单 | 补丁：`onStateChanged` 里 `if (to !== 'S0_TITLE') setTitleVisible(false)`；更好：删掉 `handleInteraction` 里的 S0 分支，让只有按钮能开始游戏 |
| UI-11 | 📖 | 打字机效果每个字符都重渲染整个 900 行 `App`（S1 前 6.5 秒 86 次提交，均 7 ms） | 抽出 `<SubtitleBox>`，让对话状态与打字机留在子组件里 |
| UI-12 | 📖 | 无 ARIA/焦点管理；`InputManager` 对所有方向键 `preventDefault`，所以音量滑块用键盘调不了；`<html lang>` 恒为 `en` | `InputManager` 对 UI 目标不 `preventDefault`；切语言时设 `document.documentElement.lang`；弹窗加 `role="dialog" aria-modal`；背包格改 `<button>`；加 `eslint-plugin-react-hooks` 与 `jsx-a11y` |
| UI-14 | 📖 | 英文模式下交互提示仍是 `"[E] 采摘河畔雏菊 · Pick Daisy"`（`GameManager.updatePromptForState` 里写死）；尺寸标签、下拉项写死 | 把提示改成 `prompt.*` 键进 `ch1.json`（三语，带 `new`/`adapted` 注记）；`GameManager` 发键而不是中文句子 |
| UI-15 | ✅ 部分 | `src/ui/UIManager.ts`（651 行）已是死代码；`gameManagerRef/audioManagerRef` 只写不读；16 个内联样式对象；App 的跳过计时器与 `InputManager` 重复 | `git rm src/ui/UIManager.ts` 并更新 README/文档引用；删重复的跳过计时器；样式搬进 `victorian.css`；首屏加载标记放进 `#root` |
| UI-16 | ✅ | 见 P0-1（插件装不上且没用）；React 库未登记许可 | 见 P0-1 与 LIC-01 |

> 次要项 **F7**（缺 `eslint-plugin-react-hooks`，审查员用推荐规则在 `App.tsx` 里跑出 4 个"渲染期写 ref"错误）、**F10**（首屏在 2.5 MB 包加载完前是空白页：把原静态加载标记放进 `<div id="root">`，React 挂载时会替换它）也放在这个 PR。

---

### PR-6 文档、许可、流程

| ID | 可信度 | 问题 | 修复 |
|---|---|---|---|
| **LIC-01** | 📖 重要 | `docs/assets-licenses.md` 一个代码库都没登记，违反 `CLAUDE.md` §6.5；本次新增的 react / react-dom 等都没登记 | 补丁已加"代码库（运行时）"小节；复核前请核对版本与许可。审查员还原型了一个守卫测试 `tests/unit/licenses.test.mjs`（缺登记就失败），建议加上 |
| **FONT-01** | ✅ 重要 | 文档把"离线 OFL 字体已打包"记为 **VERIFIED**，**但仓库里从来没有任何字体文件**（`git ls-files` 为 0，`public/assets` 只有 `cutscenes i18n models`）；`victorian.css` 引用的 `/assets/fonts/*.woff2` 会得到 `200 text/html`（Vite 的 SPA 回退）；`tools/download-fonts.sh` 无法产出它们；`tools/subset-fonts.mjs` 不存在 | 先诚实：`REMEDIATION_LOG` 的 D-04 改成 **NOT DONE**。再真做：写 `tools/subset-fonts.mjs`，提交 < 1.5 MB 的 woff2 与各自许可文本，登记到 `assets-licenses.md`，加一个"每个 `@font-face` 文件都存在"的单元测试 |
| **DEC-01** | 📖 重要 | React 违背项目最初的 UI 规则（`docs/google-doc-spec-v1.md:1361` "不引入大型前端框架"），没有任何决策记录；`CLAUDE.md` 技术栈没有 React | **拥有者决定**。若接受 React：加 `docs/decisions/0001-react-ui.md`（状态、背景、决定、后果：+72 kB gzip、需要 hooks lint、退役 `UIManager.ts`），并改 `CLAUDE.md` 第 12–21 行技术栈（加入 React 19 与开发端口 3000） |
| **DOC-02** | ✅ 部分 | `PROJECT.md`、`TEST_INFRA.md`、`docs/prompts/track_h/prompt.md`、`AGENTS.md`、`gameHarness.ts` 仍在讲"原生 HTML/CSS 与 `src/main.ts`" | 补丁已改 `PROJECT.md` 与 `gameHarness.ts`；其余按附录 DOC-02 的替换文本改 |
| **DOC-03** | 📖 重要 | README 写"18/18、28/28 个测试"，实际是 **63 个单元 + 29 个 e2e**；README 还写 orig_1865 三语，实际是 zh/en/ja；`REMEDIATION_LOG` 第二轮"当前进度"是空占位；`rabbit/Dinah 仍是单色`等旧状态未更新 | 按附录 DOC-03 的替换文本改；占位块填入**真实**的 `npm run gate -- --no-run` 失败清单 |
| DOC-04 | 📖 次要 | `PROJECT.md`/`TEST_INFRA.md` 写了一个会改状态的测试接口（`goto/setFlag/addItem/setScale`），实际不存在；F-05 说"没有修改后门"，但 `movePlayerTo/lookAtBottleSide` 会传送/驱动 | 改成真实 API 列表，把 F-05 措辞改准确 |
| **PROC-01** | ✅（GitHub API 核对） 阻断（流程） | 一个 29 文件的混合提交未经验证就推到**未保护的 `main`**，CI 红了 | **拥有者**：给 `main` 加规则集（要求 PR、要求 `Build, Typecheck and Validate` 与 `Playwright E2E Validation` 通过、禁止强推/删除）。审查员给了可直接运行的 `gh api -X POST repos/…/rulesets` JSON，见附录 PROC-01；CI 里 gate 任务用 `fetch-depth: 0`（阈值下限要读 git 历史） |
| PROC-02 | 📖 重要 | `ROUND2_TASK.md:145` 还让智能体"推到 PR #2 的分支"，而 PR #2 已合并；CI 只对 `main` 和 PR 触发，没有 PR 的分支上的在制品没人验证 | 本 PR 的 `AGENTS.md` 已写新规则；`ROUND2_TASK.md:145` 请改为"topic 分支 + PR，等 CI 绿，永不直推 `main`" |
| COMMIT-01 | 📖 重要 | 提交信息只描述了约 1/3 的改动 | 以后按 §2 的拆分，一事一提交、信息要写全 |
| HYG-01 | 📖 次要 | 没有 react-hooks lint；闸门的"阈值只能调高"检查在没有 git 历史的导出里会**静默放行** | 加 lint 插件；README 写明"在完整 git 克隆里跑闸门"。**不要**改 `quality-gate.mjs`（受保护），除非拥有者明确批准 |

#### 其余次要发现（CI/依赖审查员）

- **F6** 📖：首屏要下载 **27.85 MB**（预算 15 MB），但这是**早就存在的**（`SceneLoader` 启动时急切加载所有章节 GLB）；本提交让初始 JS 多了约 241 KB 原始 / 77 KB gzip（React 占约 93%）。`dist` 35 MB 里 6.5 MB 是发布出去的 source map。建议：S3–S5 与暂不需要的角色延后加载；发布时 `build.sourcemap: 'hidden'` 或 `false`；若 15 MB 另有口径请在 `docs/perf/ch1.md` 写明。
- **F9** 📖：`--host 0.0.0.0` 对 CI/容器没问题，但请文档化；`COOP/COEP` 头没有任何 `SharedArrayBuffer` 用途，可删。
- **F5** 📖：`metadata.json` 没有读取者；`tools/download-fonts.sh` 丢了可执行位（已在 P0-4）。

## 4. 本轮完成标准（Definition of Done）

1. `main` 上 `CI Pipeline` **两个任务全绿**（PR-1 之后立即达成）。
2. `git grep -nE "ModelDetailEnhancer|__lab|gouacheWheel|stainedLanternTints" -- src tests tools` 为空。
3. `chr_sister.glb` 的三份拷贝与 `tools/blender/build_chr_sister.py` 在**同一个提交**里一致，构建脚本能跑通（退出码 0）。
4. e2e 29/29 通过；新增的单元测试（卡关提示键、字体文件存在、许可登记、`build_*.py` 调用的函数都存在）全过。
5. 每个有画面改动的 PR 都附 `docs/devlog/gate/board.png` 前后对比；`REMEDIATION_LOG.md` 第二轮占位块写入真实失败清单。
6. 质量闸门本身（9/31 项失败）**不属于本轮必须清零的目标**——本轮是"让 `main` 可信"。画面要靠 Blender 里画出来，参见 `ROUND2_TASK.md`。

## 5. 已剔除 / 已更正的审查员发现

- **UI-7（已剔除）**：审查员报告 `src/main.tsx` 里有遗留的 React `Profiler` 与 `?strict=1` 探针，会向 `window.__renders` 无界写入。**我在 `main@465e004` 的干净克隆里核对：`main.tsx` 只有 12 行，没有 `Profiler`/`strict`/`__renders`。** 那是审查员给自己的快照插入的探针。
  推论：它的补丁里原有的 `src/main.tsx` 块无法套到真实的 `main`，已剔除，不要找它。
- **F2 的修复建议已更正**（见 P0-2）。

## 6. 没能核实 / 本次审查的限制

- 对抗式复核被用量上限打断，只有 F1、F2 完成；其余的"✅"是我在干净克隆里用 grep/git 做的**机械核对**，不是第二个智能体独立复现。
- 渲染 A/B 的指标数字、`ModelDetailEnhancer` 是否"刻意针对闸门"的**动机**无法证实，只能说模式与 `CLAUDE.md` §7 禁止的一致，且代码注释点名了闸门场景。
- 没有真机 GPU 的帧时间（软件渲染不代表集成显卡），≥50/40 fps 预算未测。
- 没有对 `465e004` 做过质量闸门重新采集；`react-ui-fixes.patch` 与 `ci-docs-hygiene.patch` 只验证了"能套上 + typecheck/lint/63 单元测试"，**我没有重跑 e2e**。
- 审查员有一次误操作：在实时仓库里跑了 `npm install -D …`，随后用 `npm uninstall` 复原；我核对过 `package.json`/`package-lock.json` 与 `HEAD` 一致、没有提交/推送。
- 报告里的版本号、文件行号都是 `465e004` 的；之后若 `main` 变了，请先 `git diff 465e004 origin/main` 再动手。

## 7. 附带文件

| 文件 | 说明 |
|---|---|
| [`round3/findings-full.md`](./round3/findings-full.md) | 52 条发现的英文原文（带可信度标签） |
| [`round3/patches/ci-docs-hygiene.patch`](./round3/patches/ci-docs-hygiene.patch) | 5173→3000、`.aistudio/` 忽略、`PROJECT.md`/`TEST_READY.md`/`ROUND2_TASK.md`/`gameHarness.ts` 更新、许可登记小节（✅ 能套到 `465e004`） |
| [`round3/patches/react-ui-fixes.patch`](./round3/patches/react-ui-fixes.patch) | UI-1/2/3/4/8/9/10/13 的修复（✅ 能套；🧪 审查员测过；已剔除 `main.tsx` 块） |

用法：`git apply docs/review/round3/patches/<name>.patch`；两个补丁互不冲突，可依次叠加。
