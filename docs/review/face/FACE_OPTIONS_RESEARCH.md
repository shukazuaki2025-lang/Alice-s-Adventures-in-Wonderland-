> **读我**：这是 2026-10-15 的脸部精细化调研原文（4 位研究员 + 1 位合成者）。**可执行的任务单在 [`../FACE_UPGRADE_TASK.md`](../FACE_UPGRADE_TASK.md)**，以它为准。
> 本文 §2 的诊断读的是作者本地的旧检出，**代码行号可能与 `main` 不同**（例如眼睛的无光照规则在 `main` 上是 `src/shaders/ToonShaders.ts:289-290`，本文写作 :323）。
> 价格、许可、产品状态都是调研当天抓取的，使用前请再核对官方来源；§6 列出了没能核实的内容。MetaHuman、Reallusion 的许可在三份报告中说法互相矛盾，**本项目路线不依赖它们**。

# 爱丽丝脸部精细化：方案调研

调研日期：2026-10-15（价格、许可、状态以各报告抓取网页时为准）

## 1. 一句话结论

- **现实目标**：不是"照片级真人脸"，而是"风格化但真正雕过、画过的半写实 7 岁爱丽丝"（Tenniel / 绘本水平）。现在的脸弱，根因是它由"球体 + 约 10 个高斯凸起"程序生成，不是工具不够好；只换工具、不换做法，改善有限。
- **与美术方向冲突**：写实童脸与水彩/三段卡通渐变/墨线/纸纹冲突，而且项目自己的 docs/bible.md:31 写明 "no realistic photographic human faces"（诊断报告）。画风与五官写实度不一致是恐怖谷最有力的触发因素：https://pmc.ncbi.nlm.nih.gov/articles/PMC4392592 。
- **法律上堵死的**：FLAME 学术版 / DECA / EMOCA / Basel Face Model 仅限非商用（https://flame.is.tue.mpg.de/modellicense.html 、https://faces.dmi.unibas.ch/bfm/bfm2019.html ）；Hunyuan3D 2.1 许可排除欧盟、英国、韩国（https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE ）；扫描或拍摄真实儿童有隐私与法律风险；Ready Player Me 已停服。
- **最快见效**：先改着色 + 描边 + 眼睛 + 脸部贴图（不必重建模，1-3 天可见明显变化），再重雕五官，并用 Faceit 等补表情。

## 2. 现状诊断（来自对已提交 chr_alice.glb 的只读测量）

- **几何没有脸部结构**：头皮肤 7,786 顶点 / 15,560 三角面，来自一个 104x72 UV 球（tools/blender/alice/head.py）。其中 52% 的面在头心后方，脸前部只有 2,162 个。鼻尖只比眼部平面高约 1 mm；嘴线、下巴分别落在鼻尖平面后约 34 mm、69 mm，下半脸只是椭球底部。
- **着色抹平形体**：三档渐变的亮平台从 N.L≈0.6 开始，45-61% 的脸部顶点落在平台上。three r174 的 getGradientIrradiance 只返回渐变的 .r 通道，设计好的紫色暗部出不来。15 个材质都没有 normal / AO 贴图，toToonMatSlot 只复制 `map`。
- **贴图问题是内容，不是分辨率**：1024 脸图 JPEG 仅约 45-46 KB（模糊腮红斑、14 颗雀斑、2 个鼻孔短划、Voronoi"碎瓷"底）。整头只用一张正面平面 UV，脸部拉伸约 x1.6。嘴唇、眉毛是纯色管状体。
- **眼睛最弱**：每只眼是单个 UV 球，虹膜和高光都画死，用无光照的 MeshBasicMaterial（ToonShaders.ts:323）。15 个动画中 Eye 骨骼旋转为 0 度；setExpression() 从未被调用；眨眼不动皮肤顶点，微笑最多动 3.8 mm。现有形态键只有 6 个（Neutral 是占位）。
- **墨线过重**：统一 2.6 mm 外壳（InkOutline.ts）在 1.0 m 视角下产生 4-5 px 黑线，沿发际线和 43 根头发管之间走线；docs/art/benchmark/README.md 要求墨线"felt, never dominant"。
- **镜头距离**：默认游戏镜头（3.2 m，55 度）下头只有约 48 px（720p）/73 px（1080p），眼睛 12-18 px（按参数计算，非实机截图）。皮肤细节看不到，能读出来的是眼形、眉毛、墨线粗细、发型轮廓和特写镜头。门禁 alice:face 检查只用通用图像统计，抓不出"脸弱"。
- **结论与提醒**：加三角面或上 4K 贴图都不能解决。另外 tools/lib/glb.mjs 的 accessor() 读 uint8/uint16 有误（按 4 字节算）且不支持 sparse 形态键，测量脸部请用正确的读取器。诊断报告还指出 src/engine/Renderer.ts 实际总是创建 WebGLRenderer，与 CLAUDE.md 所写的 WebGPU 主路径不一致，改着色请以 WebGL 路径为准。

## 3. 方案对比表（按适配度排序）

适配度 5 = 最适合本项目；综合各报告判断，报告间评分不同处已注明。工作量均为报告作者的估算。

| 方案 | 类型 | 价格与许可（能否用于免费网页游戏） | 真实感 | 导出与绑定 | 工作量 | 风险 | 适配度 |
|---|---|---|---|---|---|---|---|
| 1. 改自家管线：脸部着色+描边、重做眼睛、重绘贴图并烘焙 AO/法线、重塑五官浮雕 | 自有代码/脚本升级 | 自有代码，无许可问题 | 风格化到半写实（绘本） | 保持现有 GLB、6 个形态键、Head/Jaw/Eye 骨骼；normal/AO 经 toToonMatSlot 传入 MeshToonMaterial（r174 支持） | 约 4.5-8.5 天（各步估算相加） | 低；只改浮雕而不改着色看不出效果；脸部 hardEdge 门限 ≤0.16 | 5 |
| 2. Blender 全流程（雕刻、重拓扑、烘焙、贴图绘制）+ Krita 手绘 | 免费 DCC | Blender GPL，作品归你：https://www.blender.org/about/license/ ；Krita GPL v3，可商用：https://krita.org/en/about/license/ 。可用 | 风格化精细（想多写实都行） | 形态键与骨骼导出 glTF；形态键多时用 meshopt，Draco 对其几乎无效：https://blenderartists.org/t/how-to-reduce-gltf-file-size/1344466 | 熟手 1-2 周；新手 4-8 周 | 低到中；学习曲线；脸部环线差则形态键会变形 | 5 |
| 3. Faceit / ShapeKeyGen / ARKit Creator | Blender 形态键生成插件 | Faceit 1.8 $78、2.3 $99，GPL：https://superhivemarket.com/products/faceit ；ShapeKeyGen $15，GPL：https://superhivemarket.com/products/shapekeygen ；ARKit Creator 免费 MIT：https://github.com/tsikerdekis/ARKit-Creator-Blender-Addon/ 。生成的形态键按报告理解无许可负担（未核实） | 与头模型一致（卡通到写实均可） | 标准 Blender 形态键 → glTF morph targets；Faceit 页面未提 glTF，未实测 | 1-3 天（头部环线良好时） | 不提升细节，只提升表情；当前无环线的头效果差；52 个形态键增加 GPU/下载负担；自动结果需手修 | 4（报告评分 3/4/5） |
| 4. MPFB 2（MakeHuman Blender 插件） | 开源角色生成器 | 插件代码 GPL-3，基础网格/形态目标/皮肤 CC0；MakeHuman FAQ 称可用于闭源游戏：https://github.com/makehumancommunity/mpfb2 、https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/LICENSE.ASSETS.md 、https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html 。可用，第三方衣发包另有许可 | 半写实（通用 MakeHuman 脸，基础网格约 1.3 万顶点） | Blender 4.2+，标准 glTF；2.0.15（2026-05-05）新增 54 个 ARKit 面部单元形态键：https://static.makehumancommunity.org/mpfb/releases/release_2015.html | 2-4 天出带形态键的儿童头；再 1-2 周改成爱丽丝 | 儿童比例是已知弱项；默认脸需重雕；网格分辨率限制细节 | 4 |
| 5. ICT-FaceKit Light（USC ICT） | 开源脸部拓扑 + 表情 | MIT，保留版权声明即可商用：https://raw.githubusercontent.com/ICT-VGL/ICT-FaceKit/master/LICENSE 。可用 | 成人扫描统计，无贴图 | 26,719 顶点，53 个 ARKit 命名表情形态（browInnerUp、cheekPuff 拆左右），无 FBX 绑定：https://github.com/ICT-VGL/ICT-FaceKit | 1-2 周（收缩包裹到自雕儿童头并转移形态差分） | 成人比例；转移后需手修；扫描对象同意情况未说明 | 4（作参考/供体） |
| 6. Nomad Sculpt | 付费雕刻 App | iOS $19.99，桌面约 $35：https://apps.apple.com/us/app/nomad-sculpt/id1519508653 、https://nomadsculpt.com/ 。导出作品的商用条款页面未写明 | 风格化到半写实 | 导出 glTF/OBJ；无绑定，需另行重拓扑、烘焙：https://forum.nomadsculpt.com/t/game-asset-creation-workflow-pipeline-with-nomad-sculpt/4756 | 2-5 天雕一个风格化童头 | 商用权利未核实；Blender 本身已够用 | 4 |
| 7. Anny（NAVER LABS） | 开源全年龄参数化人体 | 代码 Apache-2.0，数据 CC0；`smplx` 拓扑仅限非商用，pip 安装可能下载非商用资源：https://github.com/naver/anny 。默认 anny/makehuman 拓扑可用 | 半写实（MakeHuman 系） | Python 包，无 Blender 插件/glTF，需自写脚本转入 Blender；面部动作形态约 564 个 | 脚本 3-5 天 + 风格化 1-2 周 | 研究级，无美术界面；脸部细节不超过 MPFB；需核对依赖下载许可 | 3 |
| 8. Meta MHR | 开源参数化人体 + 脸部绑定 | Apache-2.0：https://github.com/facebookresearch/MHR 。可用 | 半写实成人 | 72 个遵循 FACS 的艺术家雕刻表情参数，附 FBX；未提 glTF | 1-2 周（取头部作供体） | 整个成人身体，无儿童变化；pip 包为实验性 | 3 |
| 9. FLAME 2023 Open（Max Planck） | 开源参数化头模型 | CC BY：须署名、附许可链接、标明改动，并请引用论文；禁止色情及"虚假/误导性内容"：https://flame.is.tue.mpg.de/modellicense.html 。仅此一个版本可商用 | 半写实成人头形 | 表情是 PCA 而非 ARKit，需自己烘焙成形态键 | 1-2 周 | 同页的学术版仅限非商用，务必确认下载的是 Open 版；下载门槛未核实 | 3 |
| 10. Reallusion CC5 + Headshot 3 | 商业角色创建器 | CC 买断 $299 或订阅 $29/月、$99/年：https://www.cgchannel.com/2026/01/reallusion-switches-up-iclone-and-character-creator-licensing/ ；Headshot 3 页面标价 $199：https://www.reallusion.com/character-creator/headshot/ 。EULA 允许导出并放入游戏和网络服务：https://www.reallusion.com/Content/EULA/AP/EULA_AP.htm ，但"原创角色"定义存在陷阱，另一页的条款相互矛盾（见第 6 节）：https://www.reallusion.com/license/content.html | 照片级到风格化 | 导出 FBX，页面未列原生 glTF；ARKit 形态键导出不干净，需在 Blender 重建 | 1-2 周 | 许可歧义，需书面确认；无儿童基础；专有输出不能当 MIT 资源入库；照片模式会产生真人肖像 | 2（报告评分 2/3） |
| 11. MetaHuman（UE 5.8） | 照片级数字人 | 据 Epic 许可页：收入低于 $100 万免费，可用于任何引擎：https://www.metahuman.com/license ；另一份报告未能读到该页，且有厂商博客持相反说法（见第 6 节） | 照片级 | 头部 LOD0 约 24,000 顶点、669 个 blendshape、最大 8K 贴图：https://dev.epicgames.com/documentation/metahuman/platform-support-and-lod-specifications-for-metahumans ；需自己烘焙成网页可用的约 52 个 morph target | 2-4 周 | 需装虚幻引擎；官方无儿童支持；超出 15 MB/60 MB/150 draw call 预算；与绘本风格冲突；网页版 Creator 将于 2026-11-05 关闭：https://forums.unrealengine.com/t/metahuman-creator-web-application-is-being-discontinued/2695297 | 2（报告评分 1/1/3） |
| 12. AI 图生 3D（TRELLIS.2、Step1X-3D） | 开源图生 3D | TRELLIS.2 模型与代码 MIT，但默认流程会加载 RMBG-2.0（CC BY-NC 4.0）：https://huggingface.co/microsoft/TRELLIS.2-4B 、https://huggingface.co/briaai/RMBG-2.0 ；Step1X-3D 声明 Apache-2.0：https://github.com/stepfun-ai/Step1X-3D | 随输入图 | 输出静态致密三角网格 GLB，无绑定、无面部拓扑；需 24 GB 以上显存 | 数小时出体块；数天重拓扑 | 只能当雕刻前的体块参考；童脸效果无证据 | 2 |

## 4. 推荐路线

### A) 最推荐：风格化但精雕细绘（零到约 $135，许可全干净）

综合估算：熟手约 1.5-3 周，新手 4-8 周（stylised 报告）；creators 报告估 2-3 周。按"每小时可见改善"排序：

1. **着色 + 墨线（0.5-1.5 天）**：为脸/皮肤/头发单独做角色渐变（不要动被所有环境材质共用的 getSharedGradientMap()）；脸部外壳降到约 0.8-1.0 mm、暖棕色，在发际线渐隐，或用每顶点宽度遮罩（MToon 有先例：https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_materials_mtoon-1.0/README.md ）；toToonMatSlot 透传 normalMap/aoMap；用 onBeforeCompile 补丁让渐变颜色（紫色暗部）生效。
2. **重做眼睛（1-2 天）**：巩膜球 + 略凹的虹膜盘 + 独立角膜（受光的高光）+ 加厚眼睑与睫毛条；Eye 骨骼接视线目标。新材质名要同步 ToonShaders.ts:323 与 InkOutline.ts:57 的名称规则，并满足 check-assets / check-alice-rig 门禁。
3. **重绘脸贴图 + 烘焙 AO/法线（编写绘制脚本 1-2 天 + 烘焙约 1 天；手绘 2048 脸图 3-7 天）**：用 Krita 或 Blender 贴图绘制，画出嘴唇轮廓、眉毛笔触、鼻孔阴影、上眼睑褶、水彩腮红，去掉"碎瓷"底；给头做正脸/侧面/后脑的独立 UV。脸部造型以 Tenniel 插图为参考（Gutenberg #11，美国公有领域：https://www.gutenberg.org/ebooks/11 ），颜色仍用 CLAUDE.md 的规范色。
4. **重塑五官浮雕（1-2 天）**：把 head.py 的高斯凸起换成剖面曲线（前额-鼻梁-鼻尖-人中-唇-下巴），有真实鼻体积、唇体积、眉弓、眼窝、颊垫；下半脸向前。不要过度雕刻，否则滑向 bible 禁止的真人感。想做真正的雕刻，则在 Blender 或 Nomad 中雕刻、重拓扑到约 8-14k 三角面、烘焙法线。
5. **表情（1.5-3 天）**：形态键扩到约 24-30 个（眨眼左右、眉毛、jawOpen、微笑/皱眉左右、元音等）加 3-5 个修正键；可用 Faceit（$78，https://superhivemarket.com/products/faceit ）加速，再手修。并在 AliceEntity.ts 驱动视线、眨眼，从剧情事件调用 setExpression。
6. **头发（可选，3-6 天）**：用片状发束 + 绘制的透明贴图，alphaTest + alphaToCoverage（需 antialias 为 true：https://threejs.org/docs/pages/Material.html ），清理发际线。
7. **交付（半天）**：glTF-Transform / gltfpack 做 meshopt 压缩，纹理用 KTX2（脸部反照率和法线用 UASTC）：https://gltf-transform.dev/ 。
8. **最后才考虑**完全重拓扑（3-6 天，回归风险最高），仅当 1-5 步仍不达标。

学习资源：Blender Studio "Stylized Character Workflow" $17/月：https://studio.blender.org/training/stylized-character-workflow/ （电影风脸偏皮克斯，只借鉴拓扑与形态键清单，不借鉴设计）。

### B) 想要更写实时的路线

- **B1 半写实、许可干净（约 2-3 周，creators 报告估算）**：
  1. 先做 1 天试验：MPFB 2 儿童头 + Faceit，放进 Three.js 套你的卡通着色，与 docs/devlog/gate/screens/alice_face.png 对比。
  2. 用 MPFB 2（CC0）或 Anny（Apache-2.0，需 3-5 天脚本）出儿童头，仅作拓扑与比例参考。
  3. 在 Blender 中为爱丽丝重雕风格化五官（Anny 报告称其儿童比例按 WHO 数据校准，MPFB 的儿童下限未确认）。
  4. 用 Faceit 补全表情形态键，手修眼睑。
  5. 用现有手绘贴图管线上色，导出 glTF morph targets。
- **B2 用开源表情供体（约 1-2 周以上）**：ICT-FaceKit Light（MIT）、Meta MHR（Apache-2.0）或 FLAME 2023 Open（CC BY）作表情供体，收缩包裹到自雕儿童头，转移形态差分后手修。可选 Faceform Wrap（Indie 永久授权 $570，收入低于 $10 万/年）：https://faceform.com/ ；Blender 自带收缩包裹/表面变形是否够用未核实。
- **B3 真照片级（不推荐，2-4 周）**：UE 5.8 的 MetaHuman（Mesh to MetaHuman 可适配任意拓扑的头）→ 导出 DNA/几何/材质 → Blender（第三方 Metabridge_DNA $35：https://superhivemarket.com/products/metabridge_dna ）减面 → 烘焙约 52 个 morph target → 重建卡通/墨线着色 → 测帧率。代价与限制见表中第 11 行。Reallusion（表中第 10 行）是另一条商业路线，先书面确认许可。

### C) 不要走的坑

- **Ready Player Me**：公共创建器和 API 于 2026-01-31 下线：https://investinestonia.com/netflix-acquires-estonian-avatar-platform-ready-player-me/ 。
- **Avaturn / Avatar SDK**：均为 $800/月，且基于真人自拍与成人形象：https://avaturn.me/pricing 、https://avatarsdk.com/pricing-cloud/ 。
- **KeenTools FaceBuilder**：照片生成头像，$19.99/月：https://keentools.io/products/facebuilder-for-blender 。产出真人肖像，违反项目"不用真人面孔"的约束。
- **扫描或拍摄真实儿童**：涉及 GDPR 第 8、9 条（https://gdpr-info.eu/art-8-gdpr/ 、https://gdpr-info.eu/art-9-gdpr/ ）与 COPPA 对生物识别信息的扩展（https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data ）；法律解读未核实，必须先咨询律师。
- **FLAME 学术版、DECA、EMOCA、Pixel3DMM、Basel Face Model**：非商用且禁止再分发，网页游戏会把资源发给每位玩家（来源见第 1 节两个链接）。
- **Hunyuan3D 2.1**：许可地域排除欧盟、英国、韩国，全球网页游戏无法保证合规（见第 1 节链接）。
- **TRELLIS.2 默认流程**：其中的 RMBG-2.0 为 CC BY-NC 4.0；要自己抠图或换抠图模型。
- **MB-Lab 基础角色（经 CharMorph）**：AGPL，导出模型会被传染；只有 Vitruvian（CC0）可用但为成人：https://charmorph-docs.readthedocs.io/en/main/Introduction.html 。
- **Human Generator 3**：许可禁止分享其模型与贴图，即使编辑过，且儿童支持未确认：https://humgen3d.com/docs/faq/license-faq 。
- **Daz Genesis 9**：每个变形/头发/衣物都需各自的 Interactive License，且不得以原生格式提供给最终用户：https://www.daz3d.com/eula 。
- **VRoid Studio**：免费，但动漫脸与绘本、"不衍生自动画"的方向冲突：https://vroid.com/en/studio 。
- **Meshy / Tripo / Rodin 免费档**：商用权利未厘清（Meshy 免费档为 CC BY 4.0：https://docs.meshy.ai/en/webapp/pricing ），且都不给面部绑定。
- **Google GNM Head**：Apache-2.0（https://huggingface.co/google/gnm-v3 ），但为成人写实，儿童覆盖未说明。
- **只靠更多三角面/4K 贴图**：诊断显示无效。**ZBrush、Substance Painter、3D-Coat** 对只做一个头来说是付费过剩（ZBrush 2026.0 为 $49/月或 $399/年：https://www.cgchannel.com/2025/09/maxon-releases-zbrush-2026-0-and-zbrush-for-ipad-2026-0/ ；Substance 3D 合集 $59.99/月：https://www.adobe.com/products/substance3d/apps/painter.html ）。

## 5. 许可与合规提醒

- **项目口径**：docs/assets-licenses.md 声明模型为 MIT 或公有领域（creators 报告）。Reallusion、Daz、Epic、Human Generator 的输出都是专有许可，不能作为 MIT 资源提交进公开仓库；MetaHuman 派生文件能否进公开 MIT 仓库，Epic 页面未说明。
- **需要登记到 docs/assets-licenses.md 的（按实际使用）**：Blender（GPL，作品归你）、Krita（GPL v3）、Faceit 等插件（GPL，属工具）、MPFB 2（代码 GPL-3 / 资产 CC0）、Anny（Apache-2.0 / CC0）、ICT-FaceKit（MIT，须保留声明）、Meta MHR（Apache-2.0）、FLAME 2023 Open（CC BY：署名、链接许可、标明改动、引用论文）、glTF-Transform 与 meshoptimizer（MIT）、Blender Studio Snow/Rain 绑定（CC-BY 4.0，署名行为 "Snow Rig (CC) Blender Foundation | studio.blender.org"：https://studio.blender.org/characters/snow/ ）、Rhubarb Lip Sync 若用于口型（MIT：https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/LICENSE.md ）。MPFB 的第三方衣发包可能是 CC-BY 等，需逐项登记。
- **非商用陷阱**：FLAME 学术版、DECA、EMOCA、Pixel3DMM（CC BY-NC 4.0）、Basel Face Model、RMBG-2.0；Anny 的 `smplx` 拓扑。
- **真人/儿童肖像**：爱丽丝是虚构的规范角色，不要用真实孩子的照片或扫描作输入；Headshot 照片模式、KeenTools 都会生成真人肖像，违反项目约束。GDPR/COPPA 的具体适用未核实，须律师判断。
- **按 CLAUDE.md 的质量门禁**：改动后要跑 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run gate`；tools/lib/image-metrics.mjs、tools/quality-gate.mjs、tools/check-assets.mjs 和 visual_parity.spec.ts 的固定机位不得为过门禁而修改（诊断报告也强调这点）。

## 6. 没能核实的信息

**报告之间不一致的地方**

- MetaHuman 许可：creators 报告读到了 Epic 许可页原文（任意引擎、收入低于 $100 万免费）；recon 与 stylised 报告都读不到该页（需登录/403），recon 引用的 CG Channel（https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/ ）与某厂商博客（https://www.strayspark.studio/blog/metahuman-2026-web-app-shutdown-migration-guide ）互相矛盾，creators 报告认为该博客无来源、与 Epic 页面相悖。网页版关闭日期 2026-11-05：creators 报告读的是 Epic 论坛公告，其他两份报告只有二手来源。
- Reallusion 许可：creators 报告引用 EULA（2026-05-25）称可放入游戏和网络服务；recon 报告读到的内容政策页称"嵌入任意应用或服务"仅限企业版，且表格与正文冲突。两者未能调和。
- Tripo 免费档归属：帮助页摘要称 Tripo 保留权利，Tripo 自己的博客称 CC BY 4.0，条款页 403 打不开。
- Faceit 适配度：三份报告分别评 3、5、4，属判断差异。
- 渲染器：CLAUDE.md 写 WebGPU 为主，诊断报告称代码实际总是 WebGLRenderer，仅此一份报告，需自行确认。

**未核实**

- 所有工作量估算都是报告作者的个人判断，未实测。
- Faceit / ShapeKeyGen 的形态键能否无损导出 glTF 未测试；"GPL 不波及生成的形态键"只是报告的法律解读，不是法律意见。
- MPFB 的最小年龄滑块和儿童质量未确认（约 2 岁下限来自旧版独立文档）；MHR 未提年龄变化；Anny 无美术界面。
- MetaHuman 的儿童支持、在 Three.js 中的性能、OpenRigLogic 能否编译到 WASM，均无数据；Epic 完整 EULA 403。
- Reallusion：Headshot 生成或 CC 滑块头是否算"原创角色"；当前实际价格；CC5 是否已有原生 glTF。
- Daz：各第三方儿童变形是否提供 Interactive License；Daz Studio 是否原生导出 glTF。
- Nomad Sculpt 导出作品的商用权利，以及 FBX/USD 导出状态。
- FLAME 2023 Open 的下载门槛、网格规模与学术版的差异；ICT-FaceKit 扫描对象的年龄与同意条款。
- Blender 自带收缩包裹/表面变形能否替代付费 Wrap；Blender 手册的雕刻/烘焙/贴图绘制页未能解析，glTF 导出选项只见于搜索摘要。
- AI 图生 3D 对风格化童脸的效果无独立证据；非商用的抠图模型是否影响输出网格的许可属法律问题，未核实。
- Ready Player Me 官网无法访问，停服信息来自 Invest in Estonia 与竞争对手 Avatar SDK 的博客；Avaturn / Avatar SDK 的服务条款未读；Sims、Roblox、Zepeto、Meta Avatars、Memoji 的许可完全没查。
- Fab / Megascans、Texturing.xyz VFACE、3D Scan Store 的游戏用许可及是否有儿童脸：均未核实或为成人素材。
- 眼睛视差、发片 alpha 流程、动漫脸部 SDF 阴影只有二手来源；three.js 形态键数量对 GPU 开销的影响未测，需在集成显卡上实测。
- 诊断数据来自已提交的 GLB（非实机渲染）；默认镜头中的脸部像素尺寸是计算值；未测试 bpy 是否可用；太阳穴/发际线黑色小方块与睫毛线不显示的原因均未确认；GLB 是旧导出，若 head.py 之后改过则数据可能过期。
- Wikimedia Commons 上 Tenniel 分类页打不开，公有领域状态依赖 Gutenberg 的 "Public domain in the USA"；littleprince.dev 只读到加载页，没有任何风格或技术信息。
