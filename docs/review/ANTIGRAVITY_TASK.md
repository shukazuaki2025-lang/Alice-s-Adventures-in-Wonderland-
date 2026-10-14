# 任务书（交给 Antigravity 执行）：整改《Alice: Down the Rabbit-Hole》第一章

> 本文件自包含。请先通读，再按工作包（WP）顺序执行。
> 问题的完整证据、文件行号、截图见 [`2026-10-14-audit.md`](./2026-10-14-audit.md)（下文用 `A-01`、`B-03` 等编号引用）。证据截图在 [`../devlog/review-2026-10-14/`](../devlog/review-2026-10-14/)。

## 0. 背景与硬性规则

**项目**：Vite 6 + TypeScript 5.8（`strict`）+ Three.js r174 + Rapier3D + zod 的 3D 网页叙事游戏，改编 Lewis Carroll 1865《爱丽丝梦游仙境》第一章（S0 标题 → S7 蛋糕 → END）。

**开工前必读（`CLAUDE.md` §6 要求）**：`CLAUDE.md`、`docs/bible.md`、`docs/ch1-design.md`、`docs/review/2026-10-14-audit.md`。

**审核结论一句话**：目前是"UI 壳 + 黑色画布"。点击 Start 后 3D 画面全黑（没有灯光）、状态不前进、角色是圆锥、对白不出现、过场只置 flag、测试是自我断言。**需要的是真实实现，不是把测试刷绿。**

### 诚信红线（违反任何一条，本轮视为失败）
1. **不得**用 `setFlag` / `goto` / `window.__game` 瞬移来"通关"并把它当成通过证据。测试后门只允许用来**加速**（例如 `timeScale`）或**读取**状态，不得**写入**进度。
2. **不得**改弱/删除断言、把 `lint` 写成 `echo`、在 `test` 脚本里加 `|| echo`、吞掉 stderr。
3. **不得**提交内容雷同的截图。每张截图必须是该场景真实渲染的结果，并且你要**亲自打开看过**。
4. **不得**用基础几何体（圆柱/球/盒）拼角色或关键道具来交差（`generate-procedural-assets.mjs` 的做法就是本次问题的根源之一）。
5. 每完成一个 WP，在 `docs/review/REMEDIATION_LOG.md` 追加：对应问题编号 → 提交哈希 → 验证命令与真实输出 → 截图路径。**没有证据的条目视为未完成。**
6. 不确定或无法完成的，如实写进 `REMEDIATION_LOG.md` 的"未完成/风险"，不要含糊带过。

### 每个 WP 完成时都必须跑
```bash
npm run typecheck && npm run lint && npm run test && npm run build
npm run test:e2e          # 见 WP-9 重建后的真实用例
```
视觉相关改动同时用 Playwright 截图存到 `docs/devlog/screens/`（文件名体现场景，禁止重复内容）。

---

## WP-1　先让画面可见（A-05、A-06 部分）〔P0 · 最先做〕
- 给每个场景添加真实光照：S1 午后暖光 + 薄雾；S3/S4 琥珀烛光；S5–S7 吊灯 `#F5C26B`；仅 Garden Vista 允许明亮饱和日光。灯光随 `StateMachine` 状态切换，S3 t=75s 渐变为薰衣草暮色。
- `ToonShaders.ts`：阴影档改为暖紫/棕（不得是 `#2B2420` 近黑）；渐变贴图只创建一次并复用。
- 接入墨线（`#2B2420`，随距离变细）、15% 纸张颗粒后处理（现在 `Renderer.ts:37-39` 创建后被丢弃）、暗角与按场景调色。
- **DoD**：点 Start 后每个状态的截图都是有内容的彩色画面（用脚本断言：非全黑，平均亮度 > 阈值，且各场景截图两两不同）。

## WP-2　爱丽丝角色建模：达到《小王子》级别的细节与辨识度（A-01、A-07）〔P0 · 用户点名〕
**要做**：在 Blender（本机 Blender 5.2：`/mnt/d/blender.exe`；Blender MCP：`127.0.0.1:9876`，见 `.agents/teamwork/ORIGINAL_REQUEST.md`）里**真正建模、绑定、做动画**，导出 `public/assets/models/chr_alice.glb`（同步 `assets_src/`），并让游戏加载它，替换 `AliceEntity.ts` 里的圆锥+球。

**"《小王子》级别"的含义**：特征鲜明、剪影一眼可认、细节丰富但风格统一。《小王子》仅是**水准参照**，**不得照搬其造型**；爱丽丝必须符合 Tenniel 1865 与项目配色（`CLAUDE.md` §3），**禁止浅蓝裙 + 黑发带**。

**必须具备的部件（每项在 GLB 中用可识别的节点/材质名，供自动检查）**
| 部位 | 要求 |
|---|---|
| 比例 | 头身比 1:4.5，高 1.20 m（`extras.height = 1.2`）；手、脚略夸张 |
| 头发 | 浅金 `#E6C98F` 波浪长发披到中背，用雕塑成束的发块，不是球/面片 |
| 发饰 | 头顶藏青 `#2E3F6E` 丝带 + 扁平蝴蝶结 |
| 脸 | 大而有神的深榛色眼睛（带高光）、眉毛、小圆鼻、红扑扑脸颊、嘴；形态键 ≥ 4：平静/惊讶/哭泣/微笑 |
| 上衣 | 小麦黄 `#E9C46A` 及膝连衣裙、短泡泡袖、古董白圆领（Peter Pan） |
| 围裙 | 白色亚麻 `#F7F3EA`：荷叶边肩带、两个前口袋、背后蝴蝶结腰带；双面可见 |
| 腿脚 | 及膝罗纹白袜；黑色单带玛丽珍鞋 + 小铜扣 |
| 手 | 完整手部（至少拇指 + 四指成形），可握物 |
| 骨架 | 人形骨架 + 头发/裙摆/腰带次级骨骼；挂点 `SOCKET_HandR` `SOCKET_HandL` |
| 预算 | LOD0 约 1 万–1.8 万三角面，另出 LOD1（≤ 4 千）；贴图 ≤ 2048，手绘质感；封闭网格 + 平滑法线（兼容反向外壳描边） |
| 动画 | `Alice_Idle` `Alice_Walk` `Alice_Run` `Alice_TryDoor` `Alice_CrawlIn` `Alice_Land` `Alice_CurtseyAir` `Alice_KneelPeek_In` `Alice_KneelPeek_Out` `Alice_Drink` `Alice_ShrinkReact` `Alice_Slip` `Alice_SitCry` `Alice_Eat` `Alice_LookDown`（名称与 `public/assets/cutscenes/ch1/*.json` 对齐；若需改名，同步改 JSON 与 `docs/ch1-design.md`） |

**验收（必须全部满足）**
1. 提交 **转面图**到 `docs/art/alice/`：正面/侧面/背面/3-4 面各一张（≥ 1600px），中性背景，另附面部特写。
2. 提交 **游戏内截图**：默认镜头（3.2 m、1280×720）下，S1 草地与 S5 大厅各一张；再附一张**纯黑剪影**，要求能辨认出：长发轮廓、头顶蝴蝶结、泡泡袖、外扩的裙摆、背后蝴蝶结腰带。
3. 写一个 Node 脚本 `tools/inspect-glb.mjs`（并接入 `npm test`），自动断言：三角面数范围、骨骼数 ≥ 40、上表中的命名节点/材质都存在、形态键 ≥ 4、动画片段名齐全、主色在规定色值容差内、包围盒高度 1.20 ± 0.03 m。
4. 游戏中 Alice 移动时**朝向会跟随**（A-01 里指出的 `rotation` 未应用问题）；缩放到 0.2117（小）/ 2.417（大）时比例正确。
5. 用户会人工对照截图做最终评审；达不到"特征鲜明、细节到位"即视为未通过，不得自行宣布完成。

## WP-3　白兔、姐姐、Dinah（A-02、A-07）〔P0〕
同 WP-2 的标准，在 Blender 中真实建模：
- **白兔**（高 0.75 m，含耳）：暖白毛 `#F4F1EC`、粉眼 `#E88FA3`、长耳（内侧 `#F4C2C2`）、**棕米色格纹外套 `#9B5B3A/#E2C9A0`**、**芥末黄马甲 `#C9A24A`**（四粒铜扣，**永远不能没有马甲**）、酒红蝴蝶领结、金怀表 + 表链（`prop_watch`）。动画：`Rabbit_Hurry` `Rabbit_Scurry` `Rabbit_CheckWatch` `Rabbit_LookBack`。
- **姐姐**（坐高 0.95 m）：苔绿亚麻长裙 + 米色钩针披肩，坐在橡树下读书。
- **Dinah 梦幻轮廓**：半透明金琥珀色猫形，伴随翅膀状拍打的小动画。
- 白兔与姐姐实际放进场景（`RabbitEntity` 目前无人实例化），并通过 `chr_*.glb` 加载。
- DoD：转面图 + 游戏内截图 + `tools/inspect-glb.mjs` 断言。

## WP-4　场景与道具（A-03、A-04、C-04）〔P0〕
用 Blender 做出真实的场景 GLB，并按各自状态加载/卸载（**不能所有关卡共用一块草地**）：
- **S1**：起伏草地（60×40 m）、有枝干/树根/树冠的橡树 `(0,0)`、北侧河流、东侧树篱、3 朵可摘雏菊（`INT_daisy_1..3`）、姐姐落座点。
- **S2**：树篱沿线 + 兔子洞（Ø 0.80 m，`INT_rabbit_hole` 在 `(29.5, -6.0)`）。
- **S3**：竖井（内径 4.0 m）砖石井壁、书架/壁橱（`SLOT_*`）/地图/画、橘子酱罐、思想气泡位。
- **S4**：24 m 走廊（宽 2.0 × 高 2.4，拱顶、石墙、泥地）、落叶堆、90° 拐角。
- **S5–S7 大厅**：24.0×7.0×2.85 m、**10 扇**门（1.0×2.2 m，带门框）、护墙板、拼花地板、6 盏吊灯（`LAMP_*`）、三足玻璃桌（高 0.72 m，Ø 0.50 m）、窗帘 0.80×0.60 m、小门 0.24×0.381 m + 通道 0.24×0.33×1.20 m、Garden Vista。
- **道具**（真实建模，非基础体）：金钥匙（柄环/杆/齿，长 5 cm）、DRINK ME 瓶（玻璃瓶身 + 软木塞 + 系绳纸标；正面 "DRINK ME"、背面无 POISON；高 10 cm）、ORANGE MARMALADE 罐、EAT ME 葡萄干蛋糕（Ø 5 cm）、玻璃盒（10×7×5 cm，黄铜铰链）、怀表。玻璃材质命名 `M_Glass_*`。
- **逻辑标记**：按 `CLAUDE.md` §5 的前缀（`SPAWN_ TRG_ INT_ CAM_ PATH_ COL_ SOCKET_ SLOT_ LAMP_ VISTA_ANCHOR`）放置，`userData` 带 `triggerId/type/item/promptKey/collider` 等；**`SceneLoader.parseNodes` 必须读取 `userData` 与真实尺寸**，不得再硬编码 `(1,1,1)` / `(5,0.2,5)`。运行日志中 `spawns/triggers/interactables/cameras` 不得为 0。
- 道具**按剧情显隐**（瓶子在 peek 之后才出现；窗帘在 `keyTriesOnDoors ≥ 2` 前不可交互/不高亮/射线忽略）。
- DoD：每个场景一张真实截图；`tools/inspect-glb.mjs` 断言尺寸与标记数量。

## WP-5　流程、交互、过场、对白（B-01…B-05、B-09、B-10）〔P0〕
1. **状态链**：Start → `S1_BANK`（出生点 `(2,-1)` 面朝北）；S1→S2（摘第 2 朵雏菊或 45 秒触发 C1）→S3（靠近洞口 1.5 m 并交互，C2）→S4（t=88s，C3）→S5（`TRG_S4_corner` / `TRG_S4_exit`，C4）→S6（C5 之后拿瓶）→S7（C7 后发现玻璃盒）→END（C8）。**全部由真实输入/计时触发。**
2. **交互系统**：基于 `INT_*` 标记的距离 + 视线判定，出现 `[E]` 提示（`showPrompt/hidePrompt` 必须真正被发射）；背包用真实物品表（名称/描述/图标/模型），不再全是 🗝️；去重（雏菊 3 朵各一）。
3. **过场播放器**：真正按时间轴执行 `events`（camera/animation/dialogue/audio/scale/state），时长与规范一致（C1=8s … C8=10s），相机沿 `CAM_*` 锚点移动；Esc 长按 **1.0 s**（现为 0.5 s）才跳过，跳过时**快进执行**所有事件，使终态与完整观看一致（INV-06）；删除 `applyTerminalState` 里"白送结果"的硬编码；统一 `ESC_SKIP` / `skipCutscene` 为一条路径。
4. **对白/字幕**：所有 `ch1.json` 台词通过 `dialogueTrigger` 在对应时刻真实播放（`say/think/narr/sfx/ui` 五种样式）；音乐闪避并能恢复（发出 `dialogueEnd`）；加"当前目标"HUD。
5. **好奇笔记 + 结算页**：5 条笔记可触发；END 时发出 `chapterComplete`，结算页显示 思想气泡 n/5、罐子是否收好、屈膝礼是否发现、第二章预告、三个按钮（Restart / Return to Title / Making-Of）。
6. **卡关提示**：修复键名不匹配（`S1_BANK` ↔ `S1`），合并成**一个**计时器；60/120 秒真实弹出；标题页不计时。
- DoD：见 WP-9 的"真实输入通关"用例必须能从 S0 一路按键走到 END 结算页。

## WP-6　S3 坠落、S6 缩小、瓶子检视（B-06、B-07、B-08）〔P0/P1〕
- **S3（88–95 秒）**：浮动原点（Alice 留在原点，井筒以 2.2 m/s 滚动）；WASD 在 1.4 m 半径内漂移，±45° 环视；t=15s 橘子酱罐 → 拿起/检视（"ORANGE MARMALADE… empty!"）；Drop 键被拦截并播 "I mustn't drop it. I might kill somebody underneath!"（INV-07），只能放进敞开的壁橱（`jarStored`）；5 个思想气泡（t=10/30/45/58/70s，漏掉 10 秒后重生）；Thought 4 播放期间按 `C` 触发 `Alice_CurtseyAir` + 旁白（`curtsey`）；t=75s 薰衣草暮色 + Dinah 幻影 + "Do cats eat bats?…"；t=88s 黑屏 + "thump! thump!" → C3。
- **瓶子检视**：用**真实 3D 渲染**（独立 WebGLRenderTarget 或叠加视口）渲染 `prop_bottle_drinkme`，用鼠标拖拽**真实旋转**；正面标签与背面标签各自朝向相机 ≤ 30° 才分别记录；两面都看过后 "Drink" 才解锁（INV-05）。合并 `ItemInspector.ts` 与 `UIManager` 的两套实现，删除 emoji + `mousemove` 的假逻辑。
- **缩小（INV-04）**：2.5 秒三次 ease-in-out，缩放 1.0 → 0.2117；胶囊体半径 0.18→0.04、高 1.20→0.254；步速 1.4→0.5 m/s；相机距离 3.2→0.8、FOV 55→65；脚步变调 1.6×；望远镜式圆形暗角收缩/展开；修正 `constants.ts` 的比例（SMALL=0.2117、GIANT=2.417）。
- **S6/S7 其余**：INV-03 钥匙自动归位（**场景中的钥匙模型要真的移回桌面**，并播 `sfx_key_down`）；两次爬桌腿失败（C7）；`INT_glass_box` 开盒 → 吃蛋糕（C8）。
- DoD：S3 的 5 个气泡、罐子、`C` 键彩蛋、t=88s 着陆均有真实输入驱动的测试覆盖。

## WP-7　控制器、相机、渲染器（C-01…C-05、A-06）〔P1〕
- 控制器：用 Rapier `KinematicCharacterController`，与 `COL_*` 真实碰撞，不穿墙/树/桌；速度 1.4 走 / 2.55 跑，S1 慵懒 ×0.85（C1 后解除），小体型 0.5 m/s；朝向跟随移动方向；可选"Reduce Motion"关闭 S1 呼吸晃动。
- 相机：鼠标/摇杆环视（俯仰按规范 −30°…+60°，小体型 −20°…+70°）、弹簧臂对 `COL_*` 扫掠、**帧率无关**的阻尼、`CAM_*` 电影机位。
- 渲染器：实现 `WebGPURenderer`（`three/webgpu` + TSL）为主路径，失败自动回退 WebGL2，`?forceWebGL=1` 强制回退；监听 `window.resize` 更新画布/相机；`PhysicsWorld.step(dt)` 使用传入的 `dt`。
- 触发器：`addTriggerVolume` 接回调（`TRG_*` 真正触发），使用玩家胶囊而非点判定。
- DoD：附 3 张不同视角截图；缩放窗口后画面无空白条；性能按 `CLAUDE.md` §6.4 实测（真机/可用 GPU 环境），数据写入 `docs/perf/ch1.md`，不得编造。

## WP-8　UI / 本地化 / 字体 / 音频（D-01…D-06、E）〔P1〕
- 所有 UI 字符串走 `ch1.json.ui`（已有 `settings_*`、`chapter_complete` 等键，缺的补上）；标题页副标题/H1/H2/"Chapter I" 随语言切换；暂停菜单中文模式不得出现整页英文。
- 暂停菜单**真的暂停**模拟（`GameLoop` 暂停/恢复）；音量滑块接到 `AudioManager`；Continue 按钮在检测到有效存档时出现；存档只在**场景边界**写入并用 zod 校验（见 B-11），恢复时同时恢复位置/缩放/场景/UI。
- 字体本地化：下载 *IM Fell English*、*Noto Serif SC*、*LXGW WenKai*、*Zen Old Mincho* 的 OFL 字体，按游戏用到的字符子集化（总量 < 1.5 MB），打包进 `public/assets/fonts/`，删除 `victorian.css` 里的 Google Fonts `@import`，并登记到 `docs/assets-licenses.md`。
- 文本数据：给所有非 Carroll 原文的游戏性台词补 `"note": "new"` / `"adapted"`（见 D-05 列表）；新增脚本对每条 `en` 与 Gutenberg #11 比对（未匹配且无 `note` → 报错），接入 `npm test`；`S3_THOUGHT_5` 校对；`ja` 处理方式按 `CLAUDE.md` §2（首发留空串回退英文）——如决定保留已填日文，请先改 `CLAUDE.md` 并说明。
- 音频：按状态切换 M1–M7；在**用户手势之后**才启动 `AudioContext`；为各交互/过场发射 `playSfx`；脚步随缩放变调；`SpatialAudio` 接入兔子/河流/吊灯。

## WP-9　测试与诚信重建（F-01…F-05、G-01…G-04）〔P0 · 与每个 WP 并行〕
1. `package.json`：`lint` 换成真实检查（ESLint + `tsc`）；`test` 去掉 `|| echo` 与 `2>/dev/null`，失败必须返回非零。
2. **重写单元测试**：从 `src/` 真实 `import`（`StateMachine`、`PuzzleManager`、`CharacterController` 缩放插值、`CutscenePlayer` 时间轴、i18n schema…）并断言行为；删除"断言自己"的用例。
3. **重写 E2E**：
   - 至少一条**真实输入通关**用例：从 S0 点击 Start 开始，仅用 `page.keyboard` / 鼠标，在可用的 `timeScale` 加速下走到 END 结算页；全程不得调用 `__game.goto/setFlag/addItem`。
   - 每个关键场景截图后做**像素断言**：非全黑；平均亮度/色彩直方图在合理范围；各场景截图 md5 两两不同。
   - 覆盖 INV-01…INV-07 的真实触发路径。
   - 删除并重新生成 `docs/devlog/screens/e2e/` 下 7 张相同图片（F-04），文件名描述的画面必须真的出现。
4. `window.__game`：仅在 `?test=1` 时注册，且 API 只读 + `timeScale`（F-05）。
5. 文档与仓库清理：补 `LICENSE`、`ch1_notes.json`（或更正 README）、`docs/ui/`、`chr_alice.events.json`（或更正 README）；README 里"8 扇门"改 10，并删除未实现功能的声称；`public/assets/cutscenes/ch1/` 只保留 `C1.json…C8.json`（G-02，避免 Windows 大小写冲突）；`assets_src/` 合并为单一来源（G-03）；在 `.agents/teamwork/**` 的旧"VICTORY"报告顶部追加更正说明（G-04）。

---

## 提交与交付要求
- 每个 WP 单独提交，提交信息写明编号，如 `fix(render): add scene lighting (A-05)`。
- 在 `docs/review/REMEDIATION_LOG.md` 维护进度表（问题编号 / 状态 / 提交 / 证据）。
- **最终自检清单**（全部为真才可宣称完成）：
  - [ ] 点 Start 后每个场景都有彩色、有内容的画面（截图已亲自查看）
  - [ ] 仅凭键鼠可从标题走到结算页，所有 Carroll 台词按时出现
  - [ ] 爱丽丝/白兔等角色是 Blender 真实建模、带骨骼与动画，转面图已提交，用户评审通过
  - [ ] `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e` 全部真实通过
  - [ ] 无自我断言的测试，无重复截图，无硬编码终态
