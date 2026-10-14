# 第二轮任务书（交给 Antigravity）：把《Alice: Down the Rabbit-Hole》做到《小王子》的画风与质感

> 本文件自包含，先通读再动手。上一轮任务书 [`ANTIGRAVITY_TASK.md`](./ANTIGRAVITY_TASK.md) 仍然有效；本文件是它的**第二轮**，并且带有**机器执行的停止条件**。
> 用户原话：*"你给他做一个硬性的标准，直到他达到之前，不让他停止工作"* ／ *"做到这种程度，甚至往上，才可以让 Antigravity 停止"* ／ *"按照（littleprince.dev）这种画风和这个质感来做，而不只是做成一个样子很难看。"*

---

## 0. 停止规则（最重要的一节）

```
你只有在  npm run gate  以退出码 0 结束，
并且  docs/devlog/gate/VERDICT.md  写明 "Verdict: PASS"  之后，才被允许停止、交付或向用户汇报"完成"。
```

* `npm run gate` 退出码非 0（1 = 有检查失败；2 = 只跑了 `--quick`/`--no-run`，不算数）＝**继续干活，不要停，不要问用户"是否可以结束了"**。
* "上下文快用完 / 已经做了很久 / 我觉得已经够好了 / 剩下的是主观问题" **都不是**停止理由。上下文用完时：把进度写进 `docs/review/REMEDIATION_LOG.md` 的 "第二轮 · 当前进度" 小节（失败项、下一步、已踩的坑），提交并推送，然后**从 `npm run gate -- --no-run` 的失败列表接着做**。
* 唯一允许你**暂停**的情形：缺少只有人能提供的东西（真 GPU 机器、付费资源、权限）。此时在 `REMEDIATION_LOG.md` 写明缺什么、为什么阻塞，并继续做其余所有不依赖它的失败项。
* 通过 gate 不是终点而是**底线**：用户要的是"达到这种程度，甚至往上"。gate 通过后仍要对着 `board.png` 与 littleprince.dev 逐屏比较，写进 `VERDICT.md`；你**真心**认为某一屏仍然更差，就写 FAIL 并继续做。

### 0.1 这个 gate 怎么防止"刷绿"（理解它，不要和它作对）

| 防线 | 做法 |
|---|---|
| 数字来自画面本身 | gate **重新从 `docs/devlog/gate/screens/*.png` 读取并计算**指标，不信任任何手写 JSON |
| 阈值只能升不能降 | `docs/review/gate-thresholds.json` 与它**首次提交时的版本**比较（git 历史即地板）；`min*` 只能升、`max*` 只能降、必须覆盖的名单只能增 |
| 量尺被钉死 | `tools/lib/image-metrics.mjs` 的 `METRICS_SRC` 哈希写在阈值文件里；改量尺 = gate 失败 |
| 截图必须真实且新鲜 | 各场景截图 sha256 互不相同；比 `src/` 与 `public/assets/models/*.glb` 的最新修改更新 |
| 光有图像指标不够 | `tools/check-assets.mjs` 逐个检查每个 GLB 的三角面数、**带手绘贴图的材质数**、贴图像素量、动画名、体积 |
| 行为是真的 | `controls.spec.ts` 用真实鼠标/键盘事件验证拖拽转向、滚轮缩放、相机相对 WASD、行走/奔跑动画选择；`check-alice-rig.mjs` 检查骨骼、动画幅度、左右腿反相、循环闭合 |
| 人眼最终裁决 | gate 生成 `board.png`（所有场景 + 基准数字），并要求一份逐屏的 `VERDICT.md` |

**严禁**：降低/删除阈值、改 `image-metrics.mjs`、改 `gate` 脚本使其更宽松、给 `visual_parity.spec.ts` 换更好看的视角来骗分（视角固定；要改必须在 `VERDICT.md` 说明并经人批准）、截图里塞噪点/纹理贴纸来抬 `detail`、跳过/弱化任何测试、用 `window.__game` 写入状态或瞬移通关、提交重复内容的截图、把 `npm run gate` 的输出手工编辑后贴进日志。违反任何一条，本轮视为失败。

---

## 1. 现状（第一轮已完成什么、还差什么）

用户的原始报告：游戏里**鼠标不能转镜头、按住拖动不能调视角、人物动作很僵硬、Blender 建模很差**。完整缺陷审计（含根因和我们额外挖出的 11 个隐藏问题）见 [`ROUND2_AUDIT.md`](./ROUND2_AUDIT.md)。

### 已修好（Claude 第一轮，已验证）
| 项 | 结果 | 证据 |
|---|---|---|
| 鼠标/视角 | 任意键拖拽环绕、滚轮缩放、触屏拖拽/捏合、`M` 指针锁定、WASD 相机相对、Shift 奔跑 | `tests/e2e/controls.spec.ts`（CTRL-01…08）、`tests/unit/controls.test.mjs` |
| 动作僵硬 | 速度平滑、Idle/Walk/Run 权重混合 + 共享步态相位、转身平滑、倾斜/摆动、眨眼；**动画片段重做**（2 骨 IK 保证落脚、骨盆起伏、手臂摆动反相） | `tools/check-alice-rig.mjs`（17 项） |
| Alice 建模 | 全新放样建模（73 骨骼、15 个动画、6 个形态键、12 张手绘贴图 4.8 Mpx），比例 1.20 m / 头身 1:4.5，规范色 | `tools/blender/alice/*`、`docs/devlog/gate/screens/alice_*.png` |
| 渲染管线 | 保留贴图的 3 档柔和色阶 + 湿边/边缘光、反壳墨线、HDR 线性目标 + 纸纹、画出来的天空穹顶、风动草簇/花、花粉 | `src/shaders/*`、`src/world/*`、`src/engine/Renderer.ts` |
| S1 河岸 | Blender 重做（带手绘贴图的地形/橡树/树篱/岩石/野餐毯），草花实例化 | `tools/blender/build_ch1_s1_bank.py` |
| 姐姐 | 新建坐姿读书模型（44k 面、10 张手绘贴图、`Sister_ReadIdle`） | `tools/blender/build_chr_sister.py` |
| S3 竖井 | 四块 6 m 无缝砖井段滚动（书架/橱柜/果酱架/地图/画框/煤油灯，6.9 万面，11 个手绘材质） | `tools/blender/build_ch1_s3_well.py` |
| S4 通道 | 拱顶砖砌+泥土洞壁、石拱肋、铜灯笼、垂根、苔藓、水洼、尽头暖光拱门（3.7 万面） | `tools/blender/build_ch1_s4_passage.py` |
| S5–S7 长厅 | 24×7×2.85 m：拼花地板+酒红长毯、花格蔷薇壁纸+护墙板、檐口/齿饰/梁格天花板、10 扇六镶板门、画框、边桌+瓷瓶、天鹅绒长椅、书柜、座钟、壁炉、吊灯（8.5 万面，26 个手绘材质）；**真正的小门**：墙上开 0.24×0.381 m 洞→1.2 m 土质通道→阳光花园（喷泉/树篱/花坛/树），小门铰链可开，C5 过场镜头沿通道推进 | `tools/blender/build_ch1_s5_hall.py` |
| 道具 | DRINK ME 瓶（正反面标签）、EAT ME 蛋糕、橘子酱罐、金钥匙、怀表（罗马数字表盘）、铰链玻璃盒，全部手绘贴图 | `tools/blender/build_props.py` |
| 渲染/工程 | 静态网格的墨线壳着色器修复（之前对非蒙皮网格直接编译失败）；双面材质保留；自发光保留；玻璃改为不走 transmission（hall 绘制调用 174→101）；favicon（消除 404 控制台错误）；`?scale=`/`?msaa=` 渲染旋钮让软件 GPU 的 e2e 快 2–3 倍 | `src/shaders/*`、`src/engine/Renderer.ts` |

### 还差（= `npm run gate` 里现在红色的东西，这就是你的工作清单）
运行 `npm run gate -- --no-run` 立刻看到失败列表，概括（交接时 16/30 项失败）：

1. **白兔 `chr_rabbit`、Dinah 梦境猫 `chr_dinah_dream` 仍是平涂无贴图**（模型检查两项红）。
2. **所有场景的画面指标仍未到基准线**：S1 `detail 7.8 / palette 0.53 / contrast 0.195`；S3 `detail 5.3 / palette 0.22 / contrast 0.08`；S4 `detail 3.0 / palette 0.18`；S5 `palette 0.39 / contrast 0.18`；S6 `detail 6.3 / palette 0.36`。几何和贴图已经到位，差的是**画面整体的笔触/色彩/光影层次**（见 WP-F 与 §2：后处理笔触滤镜、体积光/灯光色晕、色彩分级、远景大气、更多色相）。
3. **姐姐**：裙子是光滑圆顶（`npc:sister` 红）。
4. `VERDICT.md` 尚未存在（人眼验收）。

> 已落地的场景是**基线**，不是终点：它们让几何/贴图两项检查变绿，但画面指标说明它们离《小王子》的完成度还有距离——继续做，别停。

---

## 2. 目标画风：《小王子：星辰之旅》级别（littleprince.dev）

完整说明、测量方法与基准数字见 [`docs/art/benchmark/README.md`](../art/benchmark/README.md) 和 `littleprince-keyart-metrics.json`。要点：

* **一切都是"画出来的"**：岩石、草、树皮、布料、天空每一处都有可见的水粉/水彩笔触（积色、干笔飞白、颗粒），而不是单色多边形或纯程序噪点。
* **纸在颜料下面**：暖色棉纸颗粒、色块边缘比中心略深（积色）、颜色略微溢出线外。
* **没有粗黑描边**：形体靠明度与冷暖变化，不靠黑线。我们的墨线（`#2B2420`、很细、随距离变细）只能"感觉到"，不能成为主视觉。
* **丰富而和谐的色彩**：苔绿/橄榄/赭黄/玫红/石板灰/紫色阴影，统一的冷暖逻辑，只有极少数醒目点缀。
* **密集的手工小细节**：草簇、野花、卵石、苔藓、烟——表面永远有"被摆放过"的东西，不能是空的。
* **柔光**：暖色边缘光、发光的天空、柔和的大气衰减。
* **角色是雕出来的**：剪影清晰，衣服分层有褶皱，脸和手有表情，布料有质感。

**不得照搬**小王子的造型/配色/构图。爱丽丝仍是 Tenniel 1865 + `CLAUDE.md` §3：小麦黄连衣裙、白围裙、藏青发带；**禁止**浅蓝裙 + 黑发带；禁止任何迪士尼/伯顿/McGee 衍生物。

> 诚实声明：基准游戏在无 GPU 的无头浏览器里始终停在加载画面，**没能采集到它的游戏内画面**，基准数字来自它的主视觉图（key art）。因此阈值取 ≈ 主视觉的 90–100%，并要求你再用人眼对照（§7）。如果你能在有真 GPU 的机器上打开 https://littleprince.dev/ 并截到游戏内画面，请把数字加进基准文件，高于主视觉时**上调**阈值。

---

## 3. 工作包（按优先级；每个都对应 gate 里的检查项）

### WP-A　S3 竖井 `ch1_s3_well`  → `model:ch1_s3_well`、`S3_FALL`　〔基线已交付，画面指标未达标〕
Blender 脚本 `tools/blender/build_ch1_s3_well.py`（仿 `build_ch1_s1_bank.py`，用 `tools/blender/world/painters.py` 的手绘贴图生成器；缺的画法自己加到 `painters.py`）。
* 内径 4.0 m 的圆柱竖井（`CLAUDE.md` §4），砖石砌壁：**砖缝、苔藓、渗水痕、裂缝、突出的石块**；井壁上"柜子与书架"：橱柜门、书脊成排的书、罐子/果酱瓶、地图、挂在钉上的画（每个 `SLOT_*` 空物体供程序化摆放，见 `CLAUDE.md` §5）。
* 琥珀色油灯/烛光点（`LAMP_*`），井壁暖色光晕；T=75 s 后渐变薰衣草暮色（`SceneLighting.setS3Progress` 已有）。
* **DoD**：≥ 3 万三角面、≥ 8 个带手绘贴图的材质、≥ 4 Mpx 贴图；`S3_FALL` 的 `detail ≥ 8`、`palette ≥ 0.60`、`hueEntropy ≥ 2.0`、`dominant3 ≤ 0.30`；不破坏 `INT_jar_marmalade`、`INT_cupboard_return` 与 `tests/e2e/tier3_combinations.spec.ts INV-07`。

### WP-B　S4 通道 + 花园远景 `ch1_s4_passage` → `model:ch1_s4_passage`、`S4_PASSAGE`　〔基线已交付，画面指标未达标；花园已在 hall GLB 里〕
* 通道 W 0.24 / H 0.33 / L 1.20 m（小爱丽丝视角），尽头是**明亮饱和的阳光花园**（`VISTA_ANCHOR`——全章唯一允许饱和日光的地方）：花坛、喷泉、玫瑰、绿篱迷宫、远树，全部手绘贴图；通道壁是带木纹/泥土/树根的洞壁。
* **DoD**：≥ 1 万三角面、≥ 5 个带贴图材质、≥ 2.5 Mpx；`S4_PASSAGE` 全部指标达标（光影对比：暗通道 → 亮花园，`contrast ≥ 0.20` 应当自然满足）。

### WP-C　S5–S7 长厅 `ch1_s5_hall` → `model:ch1_s5_hall`、`S5_HALL`、`S6_SMALL`　〔基线已交付，画面指标未达标〕
* 24 × 7 × 2.85 m 长而低的厅，10 扇 1.0 × 2.2 m 维多利亚木门（全锁）、天鹅绒帘（0.8 × 0.6，遮小门，位置见 `CLAUDE.md` §4）、三脚玻璃桌（`M_Glass_` 前缀）、悬挂油灯沿中线排布。
* 墙纸（花纹）、护墙板、踢脚线、地毯/拼花地板、吊灯光锥、门框雕饰、地面反光；**S6 小爱丽丝视角（0.254 m）要仍然好看**：桌腿高耸、地毯纤维、踢脚线像大墙。
* **DoD**：≥ 5 万面、≥ 10 个带贴图材质、≥ 5 Mpx；`S5_HALL`/`S6_SMALL` 指标达标；`T2-B03`（玻璃桌腿攀爬）、`INV-01`、`INV-03`、`INV-05` 仍通过。

### WP-D　白兔 `chr_rabbit` → `model:chr_rabbit`、`npc:rabbit`
现在 34.9k 面但**全是平涂**。重做：放样雕塑（耳朵内侧粉、毛发笔触贴图、粉色眼睛、格纹外套 `#9B5B3A/#E2C9A0`、芥黄背心 `#C9A24A`——**永远带背心**、黄铜怀表+链子），用 `tools/blender/alice/` 同样的工具链（`lib/meshkit.py`、`lib/paint.py`、`lib/rigkit.py`）；保留 4 个动画 `Rabbit_CheckWatch/Hurry/LookBack/Scurry`；身高 0.75 m（含耳）。
* **DoD**：≥ 6 个带贴图材质、≥ 3 Mpx、动画名齐全；`npc:rabbit` 通过；游戏内追逐 S2 的 `PATH_` 动画不回退。

### WP-E　Dinah 梦境猫与全部道具 → `model:chr_dinah_dream`、`model:prop_*`　〔道具已交付；Dinah 未做〕
* Dinah：毛发笔触贴图 + 蓬松轮廓；道具：DRINK ME 瓶（玻璃 `M_Glass_` + 软木塞 + 手写标签贴图，高 10 cm）、EAT ME 蛋糕（葡萄干纹理）、果酱罐（"ORANGE MARMALADE" 标签，IM Fell English 字体贴图）、金钥匙（5 cm，黄铜磨损）、怀表（表盘罗马数字）、玻璃盒（黄铜框，≥ 300 面）。
* **DoD**：每件至少 1 个带手绘贴图的非玻璃材质、≥ 0.25 Mpx；标签文字正反面仍满足 `INV-05`（3D 检视 ≤ 30° 法线判定）。

### WP-F　把 S1 河岸提到及格线以上 → `S1_BANK`、`S1_BANK_orbit`
现在 `detail 7.5 / palette 0.49 / contrast 0.19`。思路（选能真正提升观感的，不是堆噪点）：
* **橡树**：树冠现在是低模团块——换成多层叶团 + 叶簇卡片（alpha-tested，手绘叶片贴图）+ 透光斑；树干加苔藓、树瘤、露根。
* **河岸与水**：岸边卵石、芦苇、睡莲、水面反射渐变与手绘涟漪；
* **地面**：泥径、落叶、车前草/蒲公英、三叶草块、阴影里的苔藓；草簇增加 2–3 种形态与色相（现在偏单一）；远景山坡加灌木/树篮团与大气透视。
* **后处理**（`src/shaders/PaperGrain.ts`）：加入轻量 Kuwahara/各向异性"笔触"滤镜或彩色边缘出血（≤ 1.5 ms），不要用纯噪点。
* **性能**：`drawCalls ≤ 150`（gate 检查）、WebGL2 ≥ 40 fps（真 GPU 上自测）；增加几何用实例化/合并。
* **DoD**：两张 S1 截图全部指标达标。

### WP-G　角色打磨
* Alice：头发更有"成束的体积"和发丝高光、脸（眼睛反光层次、睫毛、鼻梁、嘴型）、手指、玛丽珍鞋铜扣与鞋底厚度、围裙荷叶边/口袋/背后蝴蝶结的褶皱；
* **表情接入游戏**：过场里 `Blink/Smile/Surprised/Crying/MouthOpen` 形态键随台词与动作触发（目前只有眨眼）；
* 姐姐：裙子褶皱雕刻（现在像一个光滑的圆顶）、披肩钩织纹理、眨眼与翻页动画、与橡树的接触；
* 走/跑：真 GPU 上人眼检查脚底滑步；必要时调 `tools/blender/alice/anim.py` 的步频与 `WALK_REF_SPEED/RUN_REF_SPEED`（`src/game/entities/AliceEntity.ts`）并重跑 `check-alice-rig.mjs`。
* **DoD**：`alice:*`、`npc:sister` 全绿；`check-alice-rig.mjs` 不回退（阈值只升）。

### WP-H　文档与合规
* 每完成一个 WP：在 `docs/review/REMEDIATION_LOG.md` 追加条目（问题 → 提交哈希 → 验证命令与**真实输出** → 截图路径）。
* 新增贴图/字体/代码库一律登记 `docs/assets-licenses.md`；**不得**把 littleprince.dev 的任何图片/素材放进仓库（只保留数字）。所有贴图必须是你**自己程序化/手绘生成**的。
* 关键渲染改动的 Playwright 截图存到 `docs/devlog/screens/`（文件名体现场景，禁止重复内容）。
* 更新 `README.md`（如何运行 gate、如何用 viewer）。

---

## 4. 工作循环

```bash
npm run dev                                   # 开发服务器 :5173（viewer: /viewer.html）
# 1) 改模型 / 着色 / 灯光
python3 tools/blender/build_<x>.py            # 重新导出 GLB（见 §5）；先用 *_OUT=public/assets/models/dev/x.glb 预览
node tools/viewer-shot.mjs out.png "model=dev/x&yaw=25&pitch=8&dist=2.6&ty=0.45&fov=32"   # 看一眼！
# 2) 小步验证
npm run typecheck && npm run lint && npm test
npm run gate -- --no-run                      # 秒级：看现有产物还差哪几项
npm run gate -- --quick                       # 分钟级：重新截图并评估（不跑全量 e2e）
# 3) 每个有意义的进展：提交并推送到 claude/fervent-brahmagupta-4qe1y9（PR #2 会自动更新）
# 4) 收尾：完整 gate（软件 GPU 下约 30–40 分钟）→ 必须 exit 0
npm run gate
```

**每次改动后你要亲自看图**（打开 `docs/devlog/gate/board.png` 与单张截图）。数字变绿但画面你自己都不满意，就是没做完。

---

## 5. 工具箱（第一轮踩过的坑，省你时间）

* **Blender**：`bpy 5.2` 已装在系统 `python3`（`pip install bpy`）；**先 `import bpy` 再 `import bmesh`**。脚本：`tools/blender/build_chr_alice.py`（环境变量 `ALICE_OUT`、`ALICE_SKIP_ANIM`）、`build_ch1_s1_bank.py`（`S1_OUT`）、`build_chr_sister.py`（`SISTER_OUT`）。成品同时写入 `public/assets/models/` 与 `assets_src/`。
* **新增库**：`lib/solids.py`（box/moulding/lathe/append_bm，世界米制平面 UV）、`world/interior.py`（砖/木/书脊/地图/壁纸/地毯/拼花/门/天鹅绒/黄铜/泥土/花园全景 等手绘生成器）、`world/props_tex.py`（带字标签/蛋糕/表盘，字体 Liberation Serif Bold, SIL OFL）。
* **库**：`tools/blender/lib/meshkit.py`（loft/tube/sheet/ellipsoid、UV 展开）、`paint.py`（fbm/voronoi/`wash` 水粉底色 → 贴图、`make_material`）、`rigkit.py`（骨架、距离权重、`Poser` FK、NLA）、`world/painters.py`（地面/树叶/树皮/水/岩石/地毯的手绘生成器）。
* **BMesh 顶点池会复用索引**：不要 `list(bm.verts)[start:]`；用 `_snapshot/_fresh` 的"按对象身份"跟踪（见 `meshkit.py`），读索引前先 `_sync()`。
* **形态键 `value` 必须设 0**，否则 glTF 把它导成默认权重 1（眼闭/嘴撑开）。
* **Blender 5 的分层 Action**：用 `keyframe_insert` + NLA，`rigkit.iter_fcurves` 遍历；关键帧从 0 开始，时长才精确。
* **缩放**：用 `mesh.transform(shape_keys=True)` + 缩放 edit-bone 烘焙最终比例，**不要**对象缩放 / `transform_apply`（会翻倍到 1.237 倍）。
* **坐标**：Blender (X,Y,Z) → glTF (X,Z,−Y)，所以游戏 (x,z) = Blender (x,−z)。`GLTFExporter`：应用修改器、+Y 向上、导出自定义属性。
* **游戏里材质**：`src/shaders/ToonShaders.ts` 的 `convertMaterialsToToon` **保留 `map`**（以前把贴图全丢了）；眼睛 `M_Alice_Eye*` 走不受光的 `MeshBasicMaterial`；玻璃 `M_Glass_*` 换折射材质。
* **Viewer**：`viewer.html` 与 `tools/viewer-shot.mjs` 用与游戏**相同**的描边/色阶管线渲染任意 GLB；参数见 `src/viewer/main.ts`（`model clip p yaw pitch dist fov tx ty tz shading ink bg floor ui only hide hidemat sheet`）。
* **e2e 提速旋钮**：`?scale=0.5&msaa=0`（`GameHarnessHelper.openGame` 默认带上；gate 的画面采集 spec 显式用 `scale=1&msaa=4`）。软件 GPU 下 S1 一帧约 1.3 s，全量 e2e 约 25–35 分钟，所以 gate 比文首写的 15 分钟长。
* **Playwright**：沙箱里设 `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`、`PW_NO_VIDEO=1`；软件 GL 很慢，测试里**轮询而不是固定 sleep**。
* **性能预算**（`CLAUDE.md` §6）：≥ 50 fps WebGPU / ≥ 40 fps WebGL2，drawCalls ≤ 150，首屏 ≤ 15 MB，全章 ≤ 60 MB（gate 对 GLB 总量设了 45 MB 上限）。

---

## 6. 诚信红线（延续上一轮，加上本轮新增）

1. 不得用 `setFlag` / `goto` / `window.__game` 写入或瞬移来"通关"；测试后门只能读取或加速。
2. 不得改弱/删除断言，不得吞 stderr，不得在脚本里加 `|| echo`。
3. 不得提交内容雷同的截图；每张截图是该场景真实渲染，且你**亲自看过**。
4. 不得用基础几何体（圆柱/球/盒）直接拼角色或关键道具交差。
5. **不得降低阈值、改量尺、改 gate、换视角骗分、往画面里灌噪点抬指标**（§0.1）。
6. 每个 WP 都要有可复现的证据写进 `REMEDIATION_LOG.md`；没有证据 = 没完成。
7. 做不到的如实写进"未完成/风险"，不要含糊。**不要为了让 gate 变绿而宣称完成。**

---

## 7. 人眼验收（gate 的最后一关）

`npm run gate` 会生成 `docs/devlog/gate/board.png`（所有场景与角色视图 + 基准数字，绿/红标注）。
1. 打开 `board.png`，再打开 https://littleprince.dev/（或 `docs/art/benchmark/README.md` 描述的主视觉），**逐屏**比较：笔触/纸纹/色彩丰富度/细节密度/光感/角色雕塑感。
2. 复制 [`VERDICT_TEMPLATE.md`](./VERDICT_TEMPLATE.md) 到 `docs/devlog/gate/VERDICT.md`，对 gate 列出的**每一个**场景/视图写一行（含 id，如 `S3_FALL`、`alice:face`、`npc:rabbit`）：它比基准好在哪、差在哪、你做了什么；最后一行 `Verdict: PASS` 或 `Verdict: FAIL`。
3. 写 FAIL 就回到 §3 继续。只有最新一次 gate 为 exit 0 **且** `VERDICT.md`（修改时间晚于最近一次截图）写着 `Verdict: PASS`，才算完成。
4. 最终由用户在浏览器里亲自玩一遍裁决——不要假设 gate 通过就等于用户满意。
