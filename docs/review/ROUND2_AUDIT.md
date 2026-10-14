# 第二轮缺陷审计（2026-10-14）：用户报告 + 我们挖出来的 + 仍然存在的

> 来源：用户在 `localhost:5173` 实玩后的报告，以及 Claude 逐项追根因时发现的隐藏问题。
> 每条都写明：现象 → 根因（带文件）→ 状态 → 证据/复现。仍然存在的缺陷是 [`ROUND2_TASK.md`](./ROUND2_TASK.md) 的工作清单。

## A. 用户直接报告的

| # | 现象 | 根因 | 状态 | 证据 |
|---|---|---|---|---|
| A1 | 鼠标不能转镜头；按住鼠标左右拖动不能调视角 | `InputManager` 从未处理指针拖拽；`consumeMouseDelta()`、`CameraRig.applyMouseDelta()` 没人调用；相机是固定跟随偏移 | **已修** | `tests/e2e/controls.spec.ts` CTRL-01…08（真实鼠标事件）、`tests/unit/controls.test.mjs` |
| A2 | WASD 方向和镜头不一致 | `GameLoop` 从不把相机 yaw 传给 `CharacterController`（世界坐标移动） | **已修** | CTRL-05 |
| A3 | 人物动作非常僵硬 | `GameManager` 给 `AliceEntity.update` 传的是零速度向量，Walk/Run 从不播放；`AliceEntity` 每帧重新请求 `Alice_Idle` 覆盖剧情动画；GLB 里的片段几乎是常数；旧脚本把全部骨骼堆在一个点上 | **已修**（数值层面；仍需真 GPU 人眼验收脚底滑步） | `tools/check-alice-rig.mjs`（17 项）、CTRL-06/07 |
| A4 | Blender 建模很差（圆锥+球拼的角色、灰盒场景） | `generate-procedural-assets.mjs` 用基础几何体拼装；没有贴图 | **部分已修**：Alice、姐姐、白兔、Dinah、S1/S3/S4/S5 场景、6 件道具已重做（全手绘程序贴图）| `docs/devlog/gate/screens/*`、`npm run check:assets` |
| A5 | 画风/质感不到位（要对标《小王子》littleprince.dev） | 材质丢弃贴图（全白）、无纸纹/湿边/墨线、天空与草地是纯色 | **部分已修**；画面指标仍未达标 | `docs/art/benchmark/`、`npm run gate:check` |

## B. 追根因时挖出来的隐藏问题（用户没提，但都影响观感/稳定）

| # | 问题 | 根因 / 修复 |
|---|---|---|
| B1 | 向左/右"侧滑"，爱丽丝被弹开 | 灰盒 `COL_hall_floor` 大平板被当成墙体处理 → `PhysicsWorld` 忽略地板碰撞体、分关卡碰撞组、行走边界 |
| B2 | 墨线从来没画出来（静态网格） | `InkOutline` 的反壳着色器引用 `objectNormal`，MeshBasicMaterial 只在蒙皮/环境贴图时才声明它 → 静态网格着色器编译失败，`three` 吞掉了。改为静态网格用 `normal` 属性 |
| B3 | 双面材质被压成单面（围裙、叶片、窗帘、苔藓看不见） | `convertMaterialsToToon` 丢了 `side` → 保留 `std.side` |
| B4 | 灯罩/火焰不发光 | 自发光被丢弃 → 保留 GLB 自发光 |
| B5 | 玻璃桌让大厅绘制调用 174（预算 150） | `transmission` 会让 three 把所有不透明物体再画一遍 → 世界内玻璃改为带菲涅尔边缘光的半透明（alpha ≤ 0.25），`createRefractiveGlassMaterial` 只留给检视窗口 |
| B6 | 全局曝光过亮发橙 | 在 sRGB LDR 目标里做色调映射 → 改成线性 HDR(HalfFloat)+MSAA 目标，色调映射+sRGB 在纸纹通道里做 |
| B7 | 草地渲染成暗红 | `instanceColor` 与反照率相乘 → 改用逐实例 `aTile` 属性 |
| B8 | 白天 Dinah 梦境猫一路跟到后面所有场景 | S3 70 s 后 `scene.add` 却从不移除 → 离开 S3 即移除 |
| B9 | 小门偷看过场没有镜头调度、看不到花园 | C5 的相机事件只有 `path` 名没有位置（被忽略）；墙上没有开口 → 墙开 0.24×0.381 m 洞、1.2 m 通道、花园、铰链门、给 C5 写镜头 |
| B10 | `/favicon.ico` 404 让"零控制台错误"测试随机失败 | 加 `public/favicon.svg` |
| B11 | `screenshots.spec` 在 CI 上超时（一次长流程，软件 GPU） | 单测超时 300 s；e2e 默认 `?scale=0.5&msaa=0`；画面采集 spec 另设 `gate` 工程，不进 CI |

## C. 仍然存在（= `npm run gate` 红色项；详见 ROUND2_TASK §1）

* 所有场景的**画面**指标低于《小王子》基准：笔触/纸纹/色彩丰富度/光影层次不足（S3 `contrast 0.08`、S4 `detail 3.0`、S5 `palette 0.39`…）。几何和贴图都到位了，**差的是整幅画面的绘画感**：灯光色晕与体积光、色彩分级、大气透视、更丰富的色相、笔触级后处理（不是堆噪点）。
* 角色打磨：Alice 头发/脸/鞋；白兔耳朵内侧偶有毛面穿出、衣领偏"帽兜"；Dinah 偏简单；过场里表情形态键未接入（只有眨眼）。
* 白兔、姐姐、Dinah、道具尚未做 LOD；Alice 73 k 面。
* 没有在真 GPU 上测过帧率；基准游戏的游戏内画面没能采集到（见 `docs/art/benchmark/README.md`）。
* 人眼验收文件 `docs/devlog/gate/VERDICT.md` 尚未写。
