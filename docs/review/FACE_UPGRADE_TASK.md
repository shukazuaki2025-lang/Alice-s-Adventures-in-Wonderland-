# 爱丽丝脸部精细化任务单（路线 A：风格化但精雕细绘）——给 Antigravity / Gemini

> 写于 2026-10-16，基线 `main@f09e3e6`。作者 Claude（**只读**：只写了文档，没改任何源码）。
> 来源：4 位研究员的调研（创建器类工具、扫描/AI 重建、风格化精细流程、对现有脸部的诊断），报告全文见
> [`face/FACE_OPTIONS_RESEARCH.md`](./face/FACE_OPTIONS_RESEARCH.md)。本文只取其中**能在本仓库现有 Blender/Three.js 管线里落地**的部分。
> 配套规则与 PR 流程见 [`ROUND3_REVIEW.md`](./ROUND3_REVIEW.md) §1（不要直推 `main`、npm 唯一、一个 PR 一件事）。

## 0. 目标与边界

**目标**：一张"半写实的绘本脸"（Tenniel 插图 / 《小王子》那种有体积、有笔触、眼睛有神的程度），能在近景和过场里站得住。
**不是目标**：照片级真人脸。理由：
- `docs/bible.md:31` 明文禁止："no realistic photographic human faces"；
- 与项目的三段卡通渐变、`#2B2420` 墨线、纸纹冲突，画风与五官写实度不一致正是"恐怖谷"的主要触发因素（来源：<https://pmc.ncbi.nlm.nih.gov/articles/PMC4392592>，研究员引用，我没读原文）；
- 这是一个 7 岁的虚构角色（卡罗尔 1865），不能用真人（尤其真实儿童）的照片/扫描做输入。

**不要做的事（坑）**：
1. **不要引入任何第三方人脸资产或 AI 生成网格**（MetaHuman、Character Creator、Daz、Ready Player Me（已于 2026-01-31 停服）、Avaturn、Hunyuan3D、Meshy/Tripo…）：许可证要么限制网页游戏、要么限制再分发、要么给不出可绑定的拓扑。调研结论见 `face/FACE_OPTIONS_RESEARCH.md` §3、§4-C。
2. **不要用运行时补丁**去"装饰"脸（类似被 `ROUND3_REVIEW.md` R-01 判为刷指标的 `ModelDetailEnhancer`）：所有细节必须来自 Blender 构建脚本，进到 GLB，被 `check-assets` 计数。
3. **不要靠加噪点/高频纹理抬指标**，不要改受保护文件（`tools/lib/image-metrics.mjs`、`tools/quality-gate.mjs`、`tools/check-assets.mjs`、`docs/review/gate-thresholds.json` 只升不降、`visual_parity.spec.ts` 的固定机位）。
4. **只加面数或上 4K 贴图没用**（诊断：当前 1024 的脸图约 4.1 像素/毫米，已经过采样 2.4 倍；问题在内容、UV 拉伸、着色和形体）。

**先决条件**：`ROUND3_REVIEW.md` 的 **PR-1（恢复锁文件，让 CI 变绿）** 和 **PR-3（回滚刷指标的运行时叠加层）** 已合并。
原因：A1 要改 `ToonShaders.ts`，PR-3 会大幅改动同一个文件，并且 PR-3 之后画面基线才是诚实的；先做会冲突，也无从比较前后。

### 可信度图例

✅ 我在 `main@f09e3e6` 的干净克隆里用 grep/读 GLB 核对属实 · 📖 研究员的测量或估算，未复核 · 💡 建议/判断，不是事实。

## 1. 现状：为什么这张脸不精细

| # | 结论 | 可信度 | 证据 |
|---|---|---|---|
| 1 | 头是一个 **104×72 的 UV 球**，五官只是几个高斯凸起，不是有结构的脸 | ✅ | `tools/blender/alice/head.py:110` `bmesh.ops.create_uvsphere(bm, u_segments=104, v_segments=72, radius=1.0)`；`FACE_FEATURES`（:28）、`head_point`（:42） |
| 2 | 几何量化：头皮肤 7,786 顶点 / 15,560 三角面（占 Alice 的 21%），**52% 的面在脑后**，脸前部只有 2,162 个；鼻尖只比眼部平面高约 **1 毫米**；嘴线、下巴分别落在鼻尖平面后约 **34 / 69 毫米** | 📖 | 诊断员读 `chr_alice.glb` 实测 |
| 3 | **渲染把形体抹平**：三档渐变的亮平台从 N·L≈0.6 开始，45–61% 的脸顶点落在平台上；脸部 15 个材质**没有任何法线/AO 贴图**，且 `toToonMatSlot` 只拷贝 `map` | ✅ 无法线贴图（0/15）、`toToonMatSlot`（`ToonShaders.ts:282`，`:287` 只取 `std.map`）；📖 45–61% |
| 4 | **three r174 的 `getGradientIrradiance` 只取渐变图的 `.r` 通道**：`return vec3( texture2D( gradientMap, coord ).r )`，所以设计的**紫色暗部在整个游戏里都出不来**（不只是脸） | ✅ `node_modules/three/src/renderers/shaders/ShaderChunk/gradientmap_pars_fragment.glsl.js` |
| 5 | 渐变图是**全场景共用**的一张（`getSharedGradientMap()`，`ToonShaders.ts:11`、`:238`），所以改它会重新调色所有场景 | ✅ |
| 6 | **眼睛最弱**：每只眼是一个 UV 球，虹膜和高光画死在贴图上，用**无光照**的 `MeshBasicMaterial`（`ToonShaders.ts:289-290`，匹配 `/^M_(Alice\|Sister)_Eye/`）；`Eye_L/Eye_R` 骨在 15 个片段里旋转 **0°**；眨眼不动任何皮肤顶点，微笑最多动 3.8 毫米 | ✅ 材质规则；📖 骨骼 0°、顶点位移 |
| 7 | **`setExpression()` 只有定义（`AliceEntity.ts:149`），整个 `src/` 没有调用者**；形态键只有 6 个，其中 `Neutral` 是零位移占位 | ✅ |
| 8 | **墨线太重**：一条 2.6 毫米的外壳（`InkOutline.ts:9`、`:42` `thickness = 0.0026`），在 1.0 米特写下是 4–5 像素黑线，沿发际线、沿 43 根发束走；而基准文档要求墨线"felt, never dominant"（`docs/art/benchmark/README.md:48`） | ✅ 厚度与要求；📖 像素数 |
| 9 | **默认游戏镜头下头只有约 48 像素（720p）/ 73 像素（1080p），眼睛 12–18 像素**，皮肤细节根本看不到；能读出来的是眼形、眉毛、墨线粗细、发型轮廓和**特写/过场镜头** | 📖（按 3.2 m、55° 垂直视角计算，不是实机截图） |
| 10 | 质量闸门的 `alice:face` 只用通用图像统计，**抓不出"脸弱"**：它现在是通过的（detail 8.6，hardEdge 0.1227） | ✅ 见 `docs/devlog/gate/board.png` |
| 11 | `CLAUDE.md` 写 WebGPU 为主、WebGL2 回退，但 `src/engine/Renderer.ts` **只创建 `WebGLRenderer`**；改着色请以 WebGL 路径为准，并顺手把文档改准 | ✅ `Renderer.ts:11`、`:31` |
| 12 | `tools/lib/glb.mjs` 的 `accessor()` 默认步长写成 `comps * 4`（不管分量是 uint8/uint16），而且**完全不支持 sparse accessor**；Alice 的 GLB 有 31 个 sparse accessor（形态键就是）。**测脸部形态键时不能用它** | ✅ `glb.mjs:21`；GLB 实测 31 个 sparse |

> 结论（💡）：主要限制是**管线和着色设置**，不是工具。程序化生成最多做到"很好的风格化"，这正是想要的。

## 2. 怎么证明做好了（硬标准）

> 用户的原话是"设一个硬标准，达不到不许停"。下面的标准**写进代码**：一个新脚本 + 固定对比图，谁也不能凭感觉说"好了"。

### 2.1 新增检查脚本 `tools/check-alice-face.mjs`（新文件，不属受保护文件）

- 接入 `package.json` 的 `test` 脚本（和 `check-alice-rig.mjs` 并列），读 `public/assets/models/chr_alice.glb`。
- **自带正确的 GLB 读取器**（处理 uint8/uint16 步长、sparse accessor、形态键位移）；**不要复用也不要顺手改 `tools/lib/glb.mjs`**——它被受保护的 `check-assets.mjs` 引用，改它会悄悄改变受保护检查的结果；它的 bug 另开 PR 单独处理，并在 PR 里证明 `check-assets` 的输出前后一致。
- 数值规则：**只能收紧，不能放松**（同 `gate-thresholds.json` 的棘轮原则）。下表的"起始门槛"是 💡 建议值，由 A0 的基线测量与侧面渲染确认后定稿；定稿前必须有人在 PR 里写明依据。

| 检查项 | 现状 | 起始门槛（💡，A0 校准） | 对应步骤 |
|---|---|---|---|
| 鼻尖凸出量（相对眼部平面，毫米） | ≈1 📖 | ≥ 8 | A4 |
| 嘴线落在鼻尖平面后的距离（毫米） | ≈34 📖 | ≤ 20 | A4 |
| 下巴落在鼻尖平面后的距离（毫米） | ≈69 📖 | ≤ 40 | A4 |
| 脸部材质带法线贴图 / AO 贴图的数量 | 0 ✅ | ≥ 1 法线 + ≥ 1 AO（皮肤/脸） | A3 |
| 眼睛：角膜是独立网格且不是无光照材质 | 否 ✅ | 是（网格名与材质可在 GLB 里查到） | A2 |
| 形态键数量（含 `Neutral`） | 6 ✅ | ≥ 24；现有 6 个名字必须保留（`gate-thresholds.json` 要求 `Neutral/Blink/Smile/Surprised/Crying/MouthOpen`） | A5 |
| `Blink` 移动的皮肤顶点数 | 0 📖 | ≥ 200 | A5 |
| `Smile` 的最大顶点位移（毫米） | 3.8 📖 | ≥ 8 | A5 |
| 至少一个片段里 `Eye_L/Eye_R` 旋转 ≥ 3° | 0° 📖 | 是 | A5 |
| `src/` 中 `setExpression(` 至少有一个调用者 | 0 ✅ | ≥ 1 | A5 |
| 脸部墨线外壳厚度（毫米） | 2.6 ✅ | ≤ 1.0（脸皮肤区域） | A1 |

保持不变的既有门槛：Alice GLB ≤ 7,000,000 字节（现 4,196,236 ✅）、模型总量 ≤ 45 MB、三角面 ≤ 95,000、骨骼 ≥ 60（现 73 ✅）、`tools/check-alice-rig.mjs` 的 17 项、每帧 draw call ≤ 150、
`alice:face` 视图 `detail ≥ 6.0` 且 `hardEdge ≤ 0.16`。

### 2.2 固定的前后对比图

每个 PR 都要在 `docs/devlog/face/<步骤>/` 提交"前/后"两组截图并贴进 PR 描述。机位**沿用质量闸门使用的固定查看器参数**（`tests/e2e/visual_parity.spec.ts:101-103`，不要改）：

```
/viewer.html?ui=0&model=chr_alice&clip=Alice_Idle&p=0.1&yaw=14&pitch=3&dist=1.0&ty=1.0&fov=30     # face（1.0 m 特写）
/viewer.html?ui=0&model=chr_alice&clip=Alice_Idle&p=0.1&yaw=0&pitch=3&dist=3.4&ty=0.6&fov=32       # front
/viewer.html?ui=0&model=chr_alice&clip=Alice_Idle&p=0.1&yaw=38&pitch=6&dist=3.4&ty=0.6&fov=32      # threeQuarter
```

再加两张**自己新增的**对比（不属于闸门，用来看形体）：**正侧面**（`yaw=90`）和**去掉墨线的纯着色图**（在查看器里关墨线），用来看鼻、唇、下巴的轮廓有没有真的出来。

### 2.3 人眼验收

`docs/devlog/gate/VERDICT.md` 的模板里加一节"脸"：把 `face` 视图的"前/后"并排，回答 4 个问题——鼻子有体积吗？嘴唇有轮廓吗？眼睛有神吗（有没有高光、睫毛、上眼睑的褶）？墨线是不是退到"能感觉到但不抢眼"。**四个都是"是"才算 PASS。**

## 3. 步骤（按"每小时可见改善"排序）

> 工作量是研究员对单人的**估算**（📖），没有实测。建议每步一个 PR（见 §4）。

### A0 · 基线与度量（约 0.5 天）

- 确认 `python3 -c "import bpy"` 可用；跑 `python3 tools/blender/build_chr_alice.py`（输出先重定向，别覆盖提交的 GLB），**比对重建结果与已提交 GLB 是否一致**（研究员没验证过 bpy 可用；`head.py` 若在上次导出后被改过，诊断数字可能已过期）。
- 写 `tools/check-alice-face.mjs` 的基线版：只**打印**当前各项数值，不设门槛，把结果写进 `docs/devlog/face/baseline.md`。
- 按 §2.2 拍"前"图。
- 找出**脸真正被看到的地方**：默认镜头下头只有 ~48 px，值得投入的是过场和查看器里的特写。列出 `public/assets/cutscenes/ch1/C*.json` 里镜头靠近爱丽丝的片段（看各文件的 camera 事件），在 PR 里写明"这些镜头里脸会占多大"。
- 完成标准：基线数值已入库；门槛经基线与侧面渲染校准后写进脚本。

### A1 · 着色与墨线（约 0.5–1.5 天，**见效最快，先做**）

文件：`src/shaders/ToonShaders.ts`、`src/shaders/InkOutline.ts`（可能还有 `src/game/entities/AliceEntity.ts`）。

1. **给角色（脸/皮肤/头发）单独做渐变图**，不要动被所有环境材质共用的 `getSharedGradientMap()`（否则整个游戏重新调色）。
2. **用 `onBeforeCompile` 补丁让渐变的颜色生效**（现在只取 `.r`，紫色暗部出不来）：只对角色材质打补丁；如果想对全局生效，那是一次**全游戏画面变更**，要走 §2.2 + 闸门重新采集，单独成 PR。
3. 把亮平台往上移、把明暗交界线放软，让正脸不再是一整块平色，鼻侧、眼窝能有明暗。
4. **`toToonMatSlot` 透传 `normalMap`、`aoMap`**（`MeshToonMaterial` 在 r174 支持二者），为 A3 铺路。
5. **墨线**：脸皮肤区域的外壳降到约 0.8–1.0 毫米、暖棕色，在发际线处淡出（可用逐顶点宽度遮罩，MToon 有先例：<https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_materials_mtoon-1.0/README.md>）。注意 `applyInkOutline()` 现在只建一个共享的 `outlineMat`，分区域厚度需要按网格建变体或用顶点属性。
6. 同时检查 `InkOutline.ts:57` 的跳过规则：只要网格**任一**材质槽匹配 `Eye|Lid|Lips|Mouth|Brow` 就整体不画外壳，这决定了哪些区域有轮廓线。

- 完成标准：脸部墨线 ≤ 1.0 mm；`alice:face` 的 `hardEdge` 比现在（0.1227）更低或持平（变薄应释放出空间给后面的画出来的睫毛/唇线）；新增"前后"图肉眼可见脸颊/鼻侧有明暗过渡；全套测试通过。
- 风险：渐变补丁只对角色材质生效，别污染环境材质；改完要 `npm run gate -- --quick` 看 `board.png`。

### A2 · 重做眼睛（约 1–2 天）

文件：`tools/blender/alice/head.py`（眼睛构建）、`tools/blender/alice/textures.py`、`ToonShaders.ts:289-290`（无光照规则）、`InkOutline.ts:57`。

1. 巩膜球 + 略凹的虹膜/瞳孔盘 + **独立的角膜高光球壳**（受光，高光跟着主光走）取代"一个球画死虹膜"。
2. 加厚眼睑，加**睫毛条**和上眼睑褶，烘一层柔和的眼睑阴影。
3. 接 `Eye_L/Eye_R` 骨：由注视目标驱动 + 微扫视（当前所有片段里旋转 0°）。
4. 新材质名要同步 `ToonShaders.ts` 与 `InkOutline.ts` 里的名称规则，并通过 `tools/check-assets.mjs`、`tools/check-alice-rig.mjs`。
5. 研究员观察到 `T_Alice_Lid`（256 px）里有睫毛，但渲染里看不出睫毛线：**先排查眼睑壳是不是被皮肤或眼窝浮雕盖住了**（z 顺序），再决定要不要新做（📖 未确认）。

- 完成标准：`check-alice-face` 的"角膜独立网格且非无光照"通过；特写里能看到高光、睫毛、上眼睑褶；draw call ≤ 150（每多一块网格会多一个墨线外壳）。

### A3 · 重绘脸贴图 + 烘焙 AO/法线（绘制脚本 1–2 天 + 烘焙约 1 天；若手绘 2048 脸图 3–7 天）

文件：`tools/blender/alice/textures.py`（`head()`、`lid()` 画师函数）、`head.py`（UV）。

1. 把"高斯模糊腮红 + 14 颗雀斑 + 2 条鼻孔短划 + Voronoi 碎瓷"换成**分层画师**：唇线含人中和丘比特弓、眉毛笔触、有形状的鼻孔与阴影楔、上眼睑褶、眼下阴影、水彩晕开的腮红；**去掉 Voronoi"碎瓷"底**。
2. **给头做真正的 UV 岛**（正脸/侧面/后脑），取代整头单张正面平面投影（脸部纹素拉伸约 ×1.6）。
3. 在 Cycles 里从一个**细分+置换的高模副本**向低模 UV 烘焙 AO 与法线（需 `bpy` 无头运行；A0 要先确认）。
4. 法线贴图用 **PNG**（JPEG 会产生色带）；画师必须带固定随机种子、结果可复现。
5. 脸部造型以 **Tenniel 的插图**为参考（古腾堡 #11，美国公有领域：<https://www.gutenberg.org/ebooks/11>）；颜色仍用 `CLAUDE.md` 规范色，不要引入新的皮肤色体系。

- 完成标准：脸/皮肤材质带法线与 AO（`check-alice-face`）；GLB 仍 ≤ 7 MB（预计新增 0.5–2 MB，现在 4.2 MB）；`alice:face` 的 `detail` ≥ 6.0 且 `hardEdge` ≤ 0.16（更多画出来的线会抬高 hardEdge，所以要和 A1 配合）。

### A4 · 重塑五官浮雕与侧面轮廓（约 1–2 天，需要侧面渲染反复迭代）

文件：`tools/blender/alice/head.py`（`FACE_FEATURES`、`head_point`）。

1. 把"10 个高斯凸起 + 一个椭球"换成**由侧面剖面曲线驱动**的形体：额头 → 鼻梁 → 鼻尖 → 人中 → 唇 → 下巴；真正的鼻体积（鼻梁、鼻尖、鼻翼、鼻孔凹陷）、唇体积、眉弓、眼窝、脸颊垫；**下半脸和下巴前移**。
2. **别过度雕**：保持 `bible.md` 的"button nose, rounded features"，并满足闸门的 `headRatio 4.0–5.2`；过度雕刻会滑向被禁止的写实真人感。
3. 检查头发帽的贴合（`hairline_boundary`、`build_scalp` 用的也是 `head_point`）。
4. **注意**：只改浮雕、不改着色，几乎看不出来（研究员实测浮雕单独只让法线中位偏转 9.4°），所以 A4 必须在 A1 之后。

- 完成标准：`check-alice-face` 的鼻尖凸出、嘴线与下巴距离三项过线；正侧面图里轮廓有鼻、唇、下巴的起伏；`check-alice-rig` 仍过。

### A5 · 表情与视线系统（约 1.5–3 天）

文件：`tools/blender/build_chr_alice.py`（形态键，当前在 `:173-178` 附近）、`src/game/entities/AliceEntity.ts`（`setExpression` 在 `:149`）、剧情事件触发处。

1. 形态键从 6 个扩到约 **24–30** 个：左右眉上/下、睁大/眯眼、脸颊鼓起、左右微笑/皱眉、张嘴、撅嘴，以及几个元音口型；再加 3–5 个**修正键**。**保留现有 6 个名字**（闸门要求）。
2. **让 `Blink` 和 `Smile` 真的带动皮肤**（现在 `Blink` 不动任何皮肤顶点，`Smile` 最多 3.8 毫米）。
3. 可参考 ARKit 52 命名，这样以后可接口型/表情驱动。可选工具：**Faceit**（Blender 插件，$78，GPL，<https://superhivemarket.com/products/faceit>）或免费的 **ARKit Creator**（MIT，<https://github.com/tsikerdekis/ARKit-Creator-Blender-Addon/>）加速，再手修；它们对"当前这种无边环结构的头"效果会差，**所以放在 A4 之后**。
4. 在 `AliceEntity.ts` 里驱动注视、眨眼和眉毛反应，并**从剧情事件调用 `setExpression`**（目前没有任何调用者）。
5. 不要破坏剧情片段的闸门规则（`boneDeg` / `movingBones`）；只有 `Alice_Drink/SitCry/Eat` 会动下颌。

- 完成标准：`check-alice-face` 的形态键数、`Blink`/`Smile` 位移、`Eye` 骨旋转、`setExpression` 调用者四项过线。
- 风险：形态键越多 GLB 越大、GPU 越吃力（`three.js` 的形态键数量对 GPU 开销的影响没有测过，需在集成显卡上实测）。

### A6 · 头发（可选，约 3–6 天）

用片状发束 + 绘制的透明贴图，`alphaTest` + `alphaToCoverage`（需要 `antialias` 为 true：<https://threejs.org/docs/pages/Material.html>），清理发际线。头发目前是 43 根管状发束外加墨线外壳。非必须，A1–A5 做完后再看是不是还不够。

### A7 · 交付压缩（约 0.5 天）

用 `glTF-Transform`（MIT，<https://gltf-transform.dev/>）做 **meshopt** 压缩，贴图用 **KTX2**（脸部反照率与法线用 UASTC）。形态键多的网格用 meshopt，**Draco 对它几乎没用**（<https://blenderartists.org/t/how-to-reduce-gltf-file-size/1344466>）。
注意：加载端要接 `MeshoptDecoder` 和 `KTX2Loader`（需要随包放 transcoder 文件），**这些库和文件都要登记到 `docs/assets-licenses.md`**（meshoptimizer MIT、basis_universal Apache-2.0，以官方许可文本为准）。

### A8 · 重拓扑（最后手段，约 3–6 天）

仅当 A1–A5 之后 `check-alice-face` 仍过不了线时才做：把 104×72 的 UV 球头换成约 6–8k 三角面的专用四边形头，眼、口、鼻周围有环形边线，后脑用粗拓扑。**回归风险最高**（每个与脸有关的生成器都会受影响），而且程序化写出这种拓扑很难，需要手工建模的基础网格。

## 4. PR 拆分与顺序

| PR | 内容 | 前置 |
|---|---|---|
| **F0** | A0：基线、`check-alice-face.mjs`（仅打印）、前图 | `ROUND3` 的 PR-1 与 PR-3 已合并 |
| **F1** | A1：角色渐变、法线/AO 透传、墨线分区 | F0 |
| **F2** | A2：眼睛 | F0（可与 F1 并行） |
| **F3** | A3：脸贴图、UV 岛、烘焙 | F1 |
| **F4** | A4：五官浮雕 | F1、F3 |
| **F5** | A5：表情与视线 | F4 |
| **F6** | 把 `check-alice-face` 门槛定稿并接入 `npm test`；写脸部 VERDICT 小节 | F2–F5 |
| 可选 | A6 头发、A7 压缩、A8 重拓扑 | F5 |

每个 PR：只含一件事；CI 绿；贴"前/后"图；`npm run typecheck && npm run lint && npm test && npm run check:assets`；改了画面就 `npm run gate -- --quick` 看 `board.png`。

## 5. 许可与登记

- 本路线**不需要任何第三方人脸资产**。工具：**Blender**（GPL，作品归你：<https://www.blender.org/about/license/>）、**Krita**（GPL v3，可商用：<https://krita.org/en/about/license/>）。
- 若用 Faceit/ARKit Creator/glTF-Transform/meshoptimizer/basis_universal，按实际使用登记到 `docs/assets-licenses.md`（Faceit 与 ShapeKeyGen 是 GPL 的 Blender 插件，属工具；"生成的形态键不受 GPL 影响"只是研究员的理解，**不是法律意见**）。
- 参考 Tenniel 插图：只作为造型参考，**不要把任何插图原图放进仓库或贴图**；美国公有领域状态依赖古腾堡 #11 的标注，**别处的法律状况没核实**。

## 6. 没能核实 / 限制

- 工作量全是估算，没有实测。
- **bpy 在本环境是否可用没有测过**；所有 GLB 数值来自已提交的 `chr_alice.glb`（诊断员称其顶点数与生成代码一致），若 `head.py` 之后被改过而没重新导出，数字可能已过期。
- "默认镜头下头 48 像素"是按相机参数**计算**的，不是实机截图。
- 太阳穴/发际线处的黑色小方块、睫毛线不显示的原因**没有确认**（可能是皮肤外壳穿出头皮帽，也可能是发束外壳，或眼睑壳被盖住）。
- 渲染器问题（只有 `WebGLRenderer`）只在代码里核对过，没做实机帧率测试；≥50/40 fps 预算在集成显卡上没测。
- 三份调研对 MetaHuman 和 Reallusion 的许可说法不一致，本路线刻意不依赖它们。
- 渐变图补丁对**全局**生效是否会让现有场景画面变好或变坏，**没有评估**，所以在 A1 里限定为"只对角色材质"。

## 7. 完成标准（Definition of Done）

1. `npm run typecheck && npm run lint && npm test`（含新的 `check-alice-face`）、`npm run check:assets`、e2e 29/29 全过，CI 绿。
2. §2.1 表里的所有项目都过线，且门槛已定稿入库、未被放松。
3. §2.2 的前/后图已提交，`docs/devlog/gate/VERDICT.md` 的"脸"一节由人眼写出并为 PASS。
4. `alice:face`、`alice:front`、`alice:threeQuarter` 三个闸门视图仍然通过；draw call ≤ 150。
5. `git grep -nE "ModelDetailEnhancer|__lab" -- src` 为空（不靠运行时补丁）。
