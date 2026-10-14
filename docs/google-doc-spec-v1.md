Title: Live Content

Description: Fetched live

Source: https://docs.google.com/document/d/1v_0NR3esCCIjC9SEzGaXo3E0rNNG0HFS04dcQGlRxrM/export?format=txt

---

﻿爱丽丝梦游仙境 AI 游戏 · 第一章「掉进兔子洞」分方向 Prompt 包
版本 v1，2026-10-14。适用范围：第一章（Down the Rabbit-Hole）。
这份文档按开发方向列出第一章的每一项任务。每项都写明四件事：用什么工具、要准备什么输入、可以直接复制的 prompt、做完怎么验收。prompt 放在浅色方框里，复制方框内全部文字即可；方框里写着【……】的地方，换成实际内容再发送。
参考作品与本项目路线
参考作品：littleprince.dev（The Little Prince: Across the Stars）。作者 @Saccc_c 用 Claude Opus 5.5 结合 Tripo 和 Blender，花 16 天把《小王子》做成网页 3D 剧情游戏，书里每个星球都是一个可以走动探索的 3D 场景。作者表示之后会开源整个游戏并公开制作流程，值得持续关注。
从网页本身能看到的做法：
* 网页版要求浏览器支持 WebGPU（Chrome、Edge 113+，Safari 26，Firefox 141+ 等），并且要在 HTTPS 或 localhost 下打开；另外提供桌面版下载。
* 界面支持 EN、中、日本語三种语言。
* 标题页结构：主视觉大图、标题、语言切换、「点击 · 开始旅程」按钮、一句原著开场白、「正在准备画面 · 百分比」加载进度。
本项目沿用的部分：
* 同一套工具链：Claude Code（Opus 5.5）写全部代码；Tripo 生成角色和道具；Blender 整理模型、搭建筑、摆关卡、导出 GLB。
* 同样的结构：书的一章对应游戏的一章，每章是一组可以走动、观察、互动的 3D 场景。
* 同样的标题页与加载流程，以及多语言（先做中文和 English，日语留好接口）。
本项目改进的部分：
* 渲染用 Three.js 的 WebGPURenderer：有 WebGPU 时走 WebGPU，没有时回退到 WebGL2，能覆盖更多设备。回退路径必须实测。
* 桌面版用 Electron 打包（之前做 Tifa 桌宠时已经走通过这套打包流程）。
* 完整保留 prompt 记录和开发日志，最后做一个「制作过程」页面，用来展示 AI 开发能力（见 K 节）。
工具总表
方向
	工具
	负责的任务
	备注
	A 总设定、B 剧情
	Claude（claude.ai，Opus 5.5；建一个 Project 存放设定）
	剧情节拍、三语台词、文案、审校
	台词输出成 JSON 直接给程序用
	C 概念图
	图像生成模型（ChatGPT 图像、Gemini、Midjourney 任选一个，全程只用这一个）
	主视觉、角色多视图、场景氛围图、道具图
	多视图是 Tripo 的输入；风格统一比单张好看更重要
	D 3D 生成
	Tripo Studio：图生 3D、多视图生 3D、Smart Low Poly 低模、AI 贴图、分件、风格化
	角色、道具、植物的初始模型和贴图
	低模可用 P1.0，主角可试 H3.1；选项名以 Tripo 当前界面为准
	D 整理与搭建
	Blender + Codex（Blender MCP，已接好），或 Claude 的 Blender 连接器；Tripo DCC Bridge 把模型送进 Blender
	尺寸、轴心、命名、减面、材质统一；程序化建筑；关卡组装；导出 GLB
	每次交付附视口截图和尺寸数值
	E 绑定与动画
	Tripo Auto Rig + 动作库；Blender（由 AI 打关键帧）
	走、跑、待机等基础动作用动作库；坠落、喝药、爬桌腿等专属动作在 Blender 里做
	30 fps，原地动画
	F 灰盒
	Blender + MCP
	按精确尺寸搭灰盒、摆逻辑点
	程序可以先在灰盒里开工
	G 程序
	Claude Code（Opus 5.5）；Vite + TypeScript + Three.js（WebGPURenderer、TSL）+ Rapier 物理
	游戏全部代码
	每一步都要跑起来截图，才算完成
	G 资源压缩
	glTF-Transform CLI、Khronos glTF Validator、KTX-Software
	Meshopt 压缩、KTX2 贴图、校验
	写成 npm 脚本
	H UI
	Claude 出界面设计稿；Claude Code 用 HTML/CSS 实现
	标题页、字幕、物品栏、设置、章节卡
	字体全部用 SIL OFL 开源字体
	I 音乐
	Suno 或 Udio（选一个用到底）
	7 段配乐
	用允许商用的付费档，保存条款截图
	I 音效
	ElevenLabs 音效生成，或 Freesound（只选 CC0）
	约 30 个音效和环境声
	来源登记到 docs/assets-licenses.md
	I 配音（可选）
	TTS（例如 ElevenLabs）
	爱丽丝、白兔台词
	第一章可以只做字幕
	J 测试
	Playwright（由 Claude Code 编写）、浏览器性能面板、renderer.info；Claude 看截图审查
	冒烟测试、截图对比、帧率
	

	G13 部署
	Cloudflare Pages、Vercel，或自己的服务器（Nginx + HTTPS）
	网页版上线
	WebGPU 只能在 HTTPS 或 localhost 下用
	G13 桌面版
	Electron
	Windows 便携版
	

	K 记录与展示
	Git + GitHub、OBS 录屏、剪映或 DaVinci Resolve
	版本管理、prompt 日志、开发录屏、预告片
	prompt 日志放 docs/prompts/
	执行顺序
1. A 总设定：在 Claude 里建 Project，把设定贴进 Project 说明；在 Claude Code 项目根目录放 CLAUDE.md。
2. B 剧情：节拍已在本文定稿，用 B2 生成三语台词 JSON，再用 B4 审校。
3. C 概念图：先出主视觉定风格，再出角色多视图、场景图、道具图。
4. F 灰盒：在 Blender 里按尺寸搭灰盒并导出，程序同时开工。
5. G1 到 G5：项目骨架、章节流程、角色控制、交互、对话。目标是在灰盒里从头玩到尾。
6. D 建模、E 动画：Tripo 出资产，Blender 整理，逐个替换灰盒。
7. G6 到 G11、H、I：坠落段、缩小机制、长厅谜题、画面风格、过场、音频、UI。
8. J 测试验收，G12、G13 优化与发布，K 整理展示材料。
原则：先让整章在灰盒里完整玩通，再换美术资产。美术资产晚到，不会卡住程序。
版权边界
* 原著 1865 年出版，John Tenniel 的插图同年发表，都已进入公有领域。情节、人物、英文原文都可以直接使用。
* 不参考任何影视或游戏改编（Disney 1951 年动画、Tim Burton 2010 年电影、American McGee 系列等）的造型、配色和台词，prompt 里也不写这些名字。爱丽丝按原著文字和 Tenniel 插图的轮廓重新设计。
* 已出版的中文译本大多仍受版权保护。中文台词由我们自己写或让 Claude 新译，不粘贴现成译本。
* Tripo、Suno、ElevenLabs 等生成的资产，先确认所用套餐允许商用和公开发布。打算开源时，资产许可要在 README 里单独说明。
第一章设计总览
玩家扮演爱丽丝，从河岸追着白兔掉进兔子洞，来到四周全是锁门的长厅，第一次变小。目标时长 12 到 15 分钟。
本章玩法：第三人称走动探索；交互与物品；坠落段的空中操控；体型变化（本章只变小）。没有失败和死亡，卡住时由爱丽丝的自言自语提示下一步。
场景
	原著内容
	玩家要做的事
	时长
	S0 标题与开场
	开篇第一句
	点击开始；开场旁白；章节卡
	0.5 分钟
	S1 河岸午后
	姐姐读没有图画的书；爱丽丝犹豫要不要编雏菊花环；粉眼睛的白兔跑过，从背心口袋掏出怀表
	熟悉操作；看姐姐的书；摘雏菊；目睹白兔
	2 到 3 分钟
	S2 追白兔
	穿过田野，白兔钻进树篱下的大兔子洞
	追逐；跳进兔子洞
	1 分钟
	S3 兔子洞坠落
	洞先像隧道一样平伸，再突然下坠；井壁上是橱柜和书架；空的橘子酱罐；胡思乱想；梦见黛娜
	空中移动；拿起罐子再放进橱柜；收集念头；彩蛋：空中行屈膝礼
	约 1.5 分钟
	S4 长廊
	摔在枯枝枯叶堆上；白兔在拐角消失
	追到拐角
	1 分钟
	S5 长厅
	一排吊灯；四周的门全锁着；玻璃三脚桌上的金钥匙；第二圈才发现矮帘子后的小门；最美的花园
	试门；拿钥匙；找到小门；跪下看花园
	3 到 4 分钟
	S6 喝我
	瓶子"刚才明明没有"；先看有没有写毒药；缩到十英寸；钥匙忘在桌上；爬桌腿滑下来；坐下哭
	检查瓶子并喝下；变小；发现够不着钥匙
	2 分钟
	S7 吃我（章末）
	桌下的玻璃盒；用葡萄干拼出 EAT ME 的小蛋糕；"往哪边？往哪边？"
	打开盒子，吃蛋糕；章节结束
	1 分钟
	尺寸常量（全项目统一）
项目
	数值
	依据
	爱丽丝正常身高
	1.20 m
	原著中爱丽丝 7 岁，按 7 岁女孩身高取值
	喝药后身高
	0.254 m（缩放系数 0.212）
	原著：只有十英寸高
	小门
	高 0.381 m，宽 0.24 m
	原著：大约十五英寸高
	小门后的通道
	宽 0.24 m，高 0.33 m，长 1.2 m
	第七章爱丽丝缩到约一英尺高后，要从这条通道走进花园
	玻璃三脚桌
	高 0.72 m，桌面直径 0.50 m
	缩小后桌面约是身高的 2.8 倍，够不着
	金钥匙
	长 0.05 m
	设计取值
	长厅
	长 24 m，宽 7 m，天花板高 2.85 m
	原著：又长又矮；第二章爱丽丝长到九英尺多（2.74 m 以上）时头撞到屋顶
	大门
	宽 1.0 m，高 2.2 m
	设计取值
	兔子洞口
	直径 0.8 m
	原著：树篱下的大兔子洞
	坠落竖井
	内径 4 m
	设计取值
	白兔
	高 0.75 m（含耳朵）
	设计取值
	长厅、玻璃桌、小门和花园在第二章、第七章还会出现，河岸和姐姐在最后一章出现，这些资产都按可复用来做。
A 总设定
工具：Claude（claude.ai Project 的项目说明）；Claude Code（项目根目录 CLAUDE.md，内容是本节加上 G0 的工程规则）。用途：所有 AI 会话共用同一套设定，不用每次重新解释。
【项目】《爱丽丝梦游仙境》3D 网页剧情游戏，工作名 Alice: Down the Rabbit-Hole。
【目标】用 AI 工具链（Claude、Claude Code、图像模型、Tripo、Blender）在短周期内做出可在浏览器里游玩的 3D 剧情游戏，用来展示 AI 开发能力。每一章是一组可以走动、观察、互动的 3D 场景。参考作品：littleprince.dev（同类工具链做的《小王子》）。
【原著】Lewis Carroll, Alice's Adventures in Wonderland (1865)，公有领域。只改编原著，不参考任何影视或游戏改编的造型、配色、台词和名字。
【体验原则】
1. 忠于原著的事件顺序；台词短而准，保留原著的幽默和好奇心。
2. 每个场景都能走动、观察、互动，玩家是在玩，不是在看动画。
3. 体型变化（变大、变小）是贯穿全游戏的核心机制；第一章只出现变小。
4. 画面像一本会动的维多利亚绘本：暖色纸纹、墨色描边、柔和的卡通光影、略夸张的比例。
5. 没有失败和死亡。卡住时用爱丽丝的自言自语提示。
【技术栈】Vite + TypeScript（strict）+ Three.js（WebGPURenderer + TSL，没有 WebGPU 时回退 WebGL2）+ Rapier 物理 + glTF（GLB）资源。网页版 HTTPS 部署，桌面版用 Electron 打包。
【单位与尺寸】1 单位 = 1 米，Y 轴朝上（Blender 导出 glTF 时自动转换）。爱丽丝正常身高 1.20 m，缩小后 0.254 m（原著十英寸）。小门高 0.381 m（原著十五英寸）。玻璃桌高 0.72 m。长厅 24 × 7 m，天花板高 2.85 m。
【命名】资产：ch1_场景_物体_变体，例如 ch1_hall_door_a；角色 chr_alice、chr_rabbit；通用道具 prop_key_gold 等；动画片段 Alice_Idle、Rabbit_Hurry 等。Blender 里表示逻辑的空物体前缀：SPAWN_ 出生点、TRG_ 触发区、INT_ 可交互物、CAM_ 镜头点、PATH_ 路径、COL_ 碰撞体、SOCKET_ 挂点、SLOT_ 插槽。
【语言】中文、English；日语预留。玩家能看到的文字一律放在 i18n 表里，不写死在代码中。
【工作要求】
1. 需求不清楚就先问，不要自己脑补成别的东西。
2. 每完成一步，说明改了哪些文件、怎么运行、实际运行结果（截图或日志）。没有实际运行过的，不能说"完成"。
3. 不引入来路不明的素材；外部资源全部登记在 docs/assets-licenses.md。
4. 说明用中文，代码和代码注释用英文。
	B 剧情与台词
B1 第一章剧情节拍（定稿）
下面的台词，中文是本项目自己的译写，英文是 1865 年原文；标"据原文改写"或"新写"的英文是为玩法补的句子。类型：说＝说出口，想＝内心独白，旁白＝叙述，拟声＝屏幕上弹出的声音字。
S0 标题与开场
* 标题页：主视觉背景，标题「爱丽丝梦游仙境 / Alice's Adventures in Wonderland」，语言切换，按钮「点击 · 开始旅程」（这一下同时用来解锁浏览器音频）。
* 点击后加载第一章资源，显示「正在准备画面 · xx%」。
* 章节卡：「第一章 掉进兔子洞 / Chapter I. Down the Rabbit-Hole」，用纸页翻开的转场进入 S1。
触发
	类型
	中文
	English
	标题页
	旁白
	那天下午很热。爱丽丝挨着姐姐坐在河岸上，什么事也没有，开始觉得没意思了。
	Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.
	S1 河岸午后
* 出生在姐姐身边。镜头从树荫推到爱丽丝，屏幕提示移动和转视角。
* 可交互：姐姐的书（看一眼）；草地上 3 朵高亮的雏菊（拾取，物品栏出现"雏菊 n/3"）。
* 白兔出场条件：摘到第 2 朵雏菊，或进入场景 45 秒后。白兔从西边跑来，在爱丽丝 4 m 外停下，从背心口袋掏出怀表看了看，再往东跑（过场 C1）。
* 过场结束后出现目标「跟上白兔」。
* 天热犯困：S1 里镜头有很轻的慵懒晃动，走路略慢；开始追逐后恢复正常。
触发
	类型
	中文
	English
	看姐姐的书
	想
	一本书，又没有图画，又没有对话，有什么用呢？
	"and what is the use of a book," thought Alice "without pictures or conversations?"
	原地待 10 秒
	想
	编个雏菊花环吧……可是值得为这个站起来去摘花吗？
	Would the pleasure of making a daisy-chain be worth the trouble of getting up and picking the daisies?（据原文改写）
	白兔跑过
	白兔说
	天哪！天哪！我要迟到了！
	"Oh dear! Oh dear! I shall be late!"
	白兔看表后
	想
	兔子穿着背心，还从口袋里掏出一块表？
	A rabbit with a waistcoat-pocket, and a watch to take out of it!（据原文改写）
	目标
	系统
	跟上白兔
	Follow the White Rabbit
	S2 追白兔
* 白兔始终领先 8 到 10 m。玩家跑得快它也快；玩家停下，它会回头张望。
* 约 35 m 后到达树篱，白兔钻进树篱下的大兔子洞。
* 洞口交互「跳下去」，过场 C2：爱丽丝钻进洞，像在隧道里一样走几步，地面突然消失，开始下坠。
触发
	类型
	中文
	English
	跳进洞后
	旁白
	她一下子就跟着钻了进去，压根没想过待会儿要怎么出来。
	In another moment down went Alice after it, never once considering how in the world she was to get out again.
	S3 兔子洞坠落
* 爱丽丝缓慢下落，全程约 90 秒。往下看一片漆黑；井壁上是橱柜和书架，偶尔有挂在钉子上的地图和画。
* 玩家能在井里水平移动（半径 1.4 m 以内），经过架子时可以按交互键拿东西。
* 罐子任务：第 15 秒左右经过一格放着橘子酱罐的架子，拿起来发现是空的。罐子不能扔（按丢弃会说不能扔），要在之后经过某个开着门的橱柜时放进去。错过了也没关系，8 秒内会再出现一个开门的橱柜。
* 念头气泡：5 个发光的小气泡分布在下落路线上，碰到就触发一句胡思乱想。错过的会在之后再出现一次。可选收集，章末统计。
* 彩蛋：说到"对头人"那句时按屈膝礼键，爱丽丝在空中行屈膝礼，触发旁白。
* 最后 15 秒：画面变柔、变暗，爱丽丝打起瞌睡，梦里出现黛娜的半透明剪影（黛娜是爱丽丝家的猫）。然后"砰！砰！"落在枯枝枯叶堆上，坠落结束（过场 C3）。
触发
	类型
	中文
	English
	开始下坠
	旁白
	要么是井太深，要么是她掉得太慢，反正她有的是时间东张西望。
	Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her.
	拿起罐子
	想
	"橘子酱"！……空的。
	"ORANGE MARMALADE"… empty!（新写）
	想扔罐子
	想
	不能扔，砸到下面的人怎么办。
	I mustn't drop it. I might kill somebody underneath!（据原文改写）
	放进橱柜
	想
	好啦，就放这儿。
	There!（新写）
	念头 1
	想
	摔过这么一跤，以后滚下楼梯我都不当回事了！
	"after such a fall as this, I shall think nothing of tumbling down stairs!"
	念头 2
	说
	我掉了多少英里了？快到地心了吧，大概四千英里？
	"I wonder how many miles I've fallen by this time? I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—"
	念头 3
	说
	那现在到了什么纬度、什么经度呢？
	"but then I wonder what Latitude or Longitude I've got to?"
	念头 4
	说
	会不会一直掉穿地球，掉到头朝下走路的人那边去？他们叫……"对头人"？
	"I wonder if I shall fall right through the earth! How funny it'll seem to come out among the people that walk with their heads downward! The Antipathies, I think—"
	屈膝礼彩蛋
	旁白
	她一边说一边试着行屈膝礼。在半空中往下掉还行屈膝礼，你想想看！
	(she tried to curtsey as she spoke—fancy curtseying as you're falling through the air!)
	念头 5
	说
	黛娜今晚肯定会想我的！猫吃蝙蝠吗？猫吃蝙蝠吗？
	"Dinah'll miss me very much to-night, I should think! … Do cats eat bats? Do cats eat bats?"
	打瞌睡
	说（梦话）
	……蝙蝠吃猫吗？
	"Do bats eat cats?"
	落地
	拟声 + 旁白
	砰！砰！坠落结束了。
	thump! thump! … and the fall was over.
	注：原文 Antipathies（反感）是 Antipodes（对跖地）的口误。中文用"对头人"对应"对跖人"的口误，保留这个笑点。
S4 长廊
* 落地后爱丽丝一下跳起来，头顶一片漆黑，前面是一条长廊，白兔还在前面跑。
* 追到 24 m 外的拐角，白兔边跑边说那句台词，一拐弯就不见了。
* 拐过弯直接进入长厅（S5），用门洞遮挡做无缝衔接，不出现加载画面（过场 C4）。
触发
	类型
	中文
	English
	落地后
	想
	一点都没摔疼！
	Not a bit hurt!（据原文改写）
	白兔拐弯
	白兔说
	哎哟，我的耳朵和胡子啊，都这么晚了！
	"Oh my ears and whiskers, how late it's getting!"
	拐过弯
	想
	咦？兔子呢？
	Where has it gone?（新写）
	S5 长厅
* 进入时镜头沿着一排吊灯缓缓推进，旁白介绍长厅。
* 四周 10 扇大门，每扇都锁着。试过 4 扇以上，爱丽丝会走到大厅中间，说出"怎么出去"那句。
* 大厅中间偏东有一张全玻璃的三脚小桌，上面只有一把金钥匙。拿起钥匙。
* 用钥匙试大门，一扇都打不开。用钥匙试过 2 扇大门后，北墙东端的矮帘子才变成可交互，对应原文"第二圈"才发现帘子。
* 掀开帘子，后面是一扇大约十五英寸高的小门。用钥匙开锁，正好合适。
* 打开小门，爱丽丝跪下，镜头贴着地面顺着通道看出去，是最美的花园（过场 C5，花园是本章唯一的高饱和画面）。
* 头都伸不过去。爱丽丝起身，小门自己慢慢合上、落锁（第二章原文写到小门"又关上了"，这里先埋下）。
触发
	类型
	中文
	English
	进入长厅
	旁白
	她发现自己站在一间又长又矮的大厅里，屋顶垂下一排灯，把大厅照亮。
	she found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof.
	第一扇门
	想
	锁着。
	Locked.（新写）
	之后的门
	想
	这扇也锁着。（由 B2 补充多句变体）
	This one too.（新写）
	试过 4 扇后
	想
	这么多门，一扇都打不开，我还怎么出去？
	How am I ever to get out again?（据原文改写）
	发现桌子
	想
	一张全是玻璃做的小桌子……上面有把小金钥匙！
	A little three-legged table, all made of solid glass… and a tiny golden key!（据原文改写）
	钥匙试大门
	想
	要么是锁太大，要么是钥匙太小。
	Either the locks are too large, or the key is too small.（据原文改写）
	发现帘子
	想
	这儿有道矮帘子，刚才怎么没看见？
	A low curtain! I hadn't noticed that before.（据原文改写）
	掀开帘子
	想
	一扇小门，才十五英寸高！
	A little door, about fifteen inches high!（据原文改写）
	开锁
	想
	正好合适！
	It fits!（据原文改写）
	跪下看
	旁白
	她跪下来，顺着通道望出去，那是你见过的最美的花园。
	she knelt down and looked along the passage into the loveliest garden you ever saw.
	看完
	想
	就算头能钻过去，没有肩膀也没用啊。真希望我能像望远镜那样缩起来！
	"and even if my head would go through, it would be of very little use without my shoulders. Oh, how I wish I could shut up like a telescope!"
	S6 喝我
* 回到玻璃桌，桌上多了一个小瓶子，瓶颈系着纸签，印着 DRINK ME。
* 拿瓶子时，爱丽丝会把钥匙放回桌上空出手，只有一声轻响和一个小动作，不做任何提示。这就是原著里她忘记钥匙的原因，让玩家和爱丽丝一起忘掉。
* 检查瓶子：进入物品查看界面，可以旋转瓶子；看过纸签正反两面、确认没写"毒药"后，「喝下」选项才出现。
* 喝下：过场 C6。爱丽丝缩到十英寸，整个世界一下子变大。她先等了一会儿，担心会不会一直缩下去（3 秒停顿，玩家走动可以打断）。
* 走到小门：门锁着，钥匙还在桌上。
* 回到桌下：透过玻璃能清楚看到钥匙。和桌腿交互，爱丽丝抱住桌腿往上爬，滑了下来。第 2 次尝试后进入过场 C7：坐下哭，然后对自己说"哭有什么用"，镜头扫到桌下一个闪光的玻璃盒。
触发
	类型
	中文
	English
	瓶子出现
	说
	刚才这儿明明没有的。
	"which certainly was not here before,"
	查看瓶子
	说
	"喝我"……不急，先看看有没有写"毒药"。
	"No, I'll look first," she said, "and see whether it's marked 'poison' or not"
	确认没写毒药
	想
	没写"毒药"。那就尝一点。
	It isn't marked "poison".（新写）
	喝下
	旁白
	味道很好，像樱桃馅饼、奶油蛋羹、菠萝、烤火鸡、太妃糖和热黄油吐司混在一起。她很快就喝光了。
	it had, in fact, a sort of mixed flavour of cherry-tart, custard, pine-apple, roast turkey, toffee, and hot buttered toast, … she very soon finished it off.
	缩小
	说
	好奇怪的感觉！我一定是像望远镜那样缩起来了。
	"What a curious feeling!" said Alice; "I must be shutting up like a telescope."
	等待
	想
	会不会一直缩下去，最后像蜡烛一样灭掉？
	"for it might end, you know, in my going out altogether, like a candle."
	走到小门
	想
	钥匙！我把钥匙忘在桌上了！
	The key! I've left it on the table!（新写）
	爬桌腿
	想
	太滑了……
	Too slippery…（据原文改写）
	哭过之后
	说
	好啦，这么哭有什么用！我劝你马上停下来！
	"Come, there's no use in crying like that! I advise you to leave off this minute!"
	S7 吃我（章末）
* 打开桌下的玻璃盒，里面是一块很小的蛋糕，上面用葡萄干拼着 EAT ME。
* 爱丽丝说出她的打算，然后「吃下」。
* 过场 C8：咬一口，一只手按在头顶等着，什么也没发生。她干脆把蛋糕吃光，画面停在她鼓着腮帮、一脸期待的样子，淡出。
* 章末卡：第一章完；收集统计（念头 n/5、屈膝礼彩蛋）；下一章预告「眼泪池」，配一句"越来越奇怪了！"。
触发
	类型
	中文
	English
	打开盒子
	旁白
	盒子里有一块很小的蛋糕，上面用葡萄干拼着"吃我"。
	a very small cake, on which the words "EAT ME" were beautifully marked in currants.
	决定吃
	说
	好，我吃。要是变大，我就够得着钥匙；要是变小，我就从门底下钻过去。反正都能进花园，变成哪样我都不在乎！
	"Well, I'll eat it, and if it makes me grow larger, I can reach the key; and if it makes me grow smaller, I can creep under the door; so either way I'll get into the garden, and I don't care which happens!"
	咬一口
	说
	往哪边？往哪边？
	"Which way? Which way?"
	结束
	旁白
	什么也没发生。于是她干脆动手，很快就把蛋糕吃光了。
	she remained the same size … So she set to work, and very soon finished off the cake.
	章末预告
	旁白
	下一章：眼泪池
	Next: The Pool of Tears
	章末预告
	说
	越来越奇怪了！
	"Curiouser and curiouser!"
	B2 生成完整台词表（三语 JSON）
工具：Claude（claude.ai Project，Opus 5.5）。输入：B1 整节。产出：public/assets/i18n/ch1.json。
你是这个游戏的叙事编剧。下面附上第一章的剧情节拍和已经定稿的关键台词。请据此输出第一章完整的台词与字幕表。
规则：
1. 已定稿的台词一字不改，原样收录。
2. 需要你补写的部分：(a) 重复交互的变体台词，例如第 2 到第 10 扇锁着的门，每种情况至少 3 句，避免重复；(b) 玩家卡住时的提示台词，每个场景 2 句，第一句含糊、第二句明确；(c) 系统文字：交互提示（拾取、查看、喝下、吃下、跳下去、掀开、开锁、放进去）、目标提示、物品名称和物品描述（雏菊、橘子酱罐、金钥匙、喝我瓶、吃我蛋糕）、章末统计文案。
3. 中文：自己写，口语、俏皮，像一个爱说话、有点逞强的 7 岁英国小女孩；不要照抄任何已出版的中文译本；每条字幕不超过 28 个汉字。
4. English：能用 1865 年原文的就用原文；新写的句子模仿原著语气，并在 note 里写 new。
5. 日本語：本轮全部留空字符串。
6. type 只用这几种：say（说出口）、think（内心独白）、narr（旁白）、sfx（拟声）、ui（系统文字）。
7. 每条包含字段：id、scene（S0 到 S7）、trigger（事件 ID）、speaker（alice / rabbit / narrator / system）、type、zh、en、ja、dur（建议显示秒数，按中文每秒 6 个字估算，最少 1.5）、note。
8. 事件 ID 用大写加下划线，至少包括：S1_PEEK_BOOK、S1_IDLE、S1_DAISY_PICK、S1_RABBIT_RUN、S1_RABBIT_WATCH、S2_JUMP、S3_START、S3_JAR_PICK、S3_JAR_DROP_TRY、S3_JAR_STORED、S3_THOUGHT_1 到 S3_THOUGHT_5、S3_CURTSEY、S3_DOZE、S3_LAND、S4_UP、S4_CORNER、S4_GONE、S5_ENTER、S5_DOOR_LOCKED、S5_DOORS_ALL、S5_TABLE、S5_KEY_FAIL、S5_CURTAIN_FOUND、S5_LITTLE_DOOR、S5_UNLOCK、S5_PEEK、S5_PEEK_END、S6_BOTTLE_APPEAR、S6_INSPECT、S6_NOT_POISON、S6_DRINK、S6_SHRINK、S6_WAIT、S6_KEY_FORGOTTEN、S6_CLIMB_FAIL、S6_CRY_END、S7_BOX_OPEN、S7_DECIDE、S7_EAT、S7_END。缺的可以按同样格式补充，并在核对表里列出。
输出两部分：
第一部分：一个 JSON 代码块，结构为 {"chapter":"ch1","lines":[ ... ]}，必须是合法 JSON。
第二部分：核对表。按节拍逐条列出对应的台词 id，标出哪些英文是原文、哪些是新写，最后列出你拿不准的地方。
【剧情节拍与定稿台词】
（把本文档 B1 整节粘贴到这里）
	验收：
* JSON 能通过 G5 的校验（字段齐全、id 不重复、trigger 都在事件列表里）。
* 每个节拍至少有一条台词；定稿台词与 B1 一字不差。
* 抽查 10 条标为原文的英文，到 Project Gutenberg 第 11 号电子书核对。
B3 好奇心笔记（可选收集品文案）
工具：Claude（打开联网搜索）。产出：章末可以翻看的 5 条小知识，和 S3 的 5 个念头一一对应。
为游戏第一章写 5 条"好奇心笔记"。玩家在坠落段碰到念头气泡后解锁，章末可以翻看。每条对应一个念头：摔下楼梯、四千英里与地心、经纬度、Antipathies 口误、黛娜与蝙蝠。
要求：
1. 每条中文不超过 80 字，英文不超过 50 词，语气像博物馆展签，轻松但准确。
2. 只写能查证的事实，例如：这个故事的由来（1862 年 7 月 4 日的划船出游）、1865 年出版、Tenniel 的插图、Antipathies 与 Antipodes、地球半径和"四千英里"的对比、黛娜这个名字的来历。每条附 1 个可靠来源链接。
3. 找不到可靠来源的说法不要写；拿不准的单独标出来让我核对。
4. 输出 JSON：{"notes":[{"id":"ch1_note_1","thought":"S3_THOUGHT_1","zh":"","en":"","source":""}]}
	B4 台词审校
工具：Claude。输入：B2 输出的 JSON，加上 Project Gutenberg 第 11 号电子书的第一章原文。
请审校附件里的第一章台词 JSON，对照我贴的原著第一章英文原文，逐项检查，输出问题表（列：id、问题类型、原句、建议改法）：
1. 事件顺序是否和原著一致，有没有漏掉或多出的情节；
2. 标为原文的英文是否与原著逐字一致；
3. 中文是否通顺、像 7 岁小女孩的口吻、每条不超过 28 字、有没有错别字；
4. 有没有疑似照搬已出版中文译本的句子（标出可疑的即可）；
5. 有没有来自影视改编而非原著的设定或台词。
最后给出总体结论：可以直接用、修改后可用、需要重写，三选一。
	C 美术与概念图
C0 风格定义
一句话：一本会动的维多利亚绘本。形体圆润、比例略夸张，柔和的卡通光影，墨色描边，整体叠一层暖色纸纹。
* 比例：爱丽丝头身比约 1 比 4.5，手脚略大，远处也能看清动作。
* 材质：以手绘感颜色为主，高光很弱。玻璃（桌子、瓶子、盒子）是少数透明材质，在引擎里做假折射，不追求真实。
* 线条：墨色描边 #2B2420，宽度随距离变细。暗部叠交叉排线（致敬 Tenniel 插图的木刻版画线条）作为加分项。
* 后期：纸纹叠加约 15%、暗角；只给灯和花园加泛光。
* 文字：瓶签、罐签等道具上的字不让 AI 画，在 Blender 里做贴花，字体 IM Fell English。
* 禁止：影视改编的名字和造型；"浅蓝色连衣裙配黑色发箍"这个组合；写实人脸；霓虹和赛博风格。
对象
	主色
	辅色
	点缀
	河岸
	草绿 #7FA35B、奶油纸色 #F3E9D2
	天空 #A9C8E8、河水 #6F9FB8、深绿 #4E6E3A
	阳光金 #F2C46D、雏菊白 #FFFDF5
	兔子洞
	土褐 #5A3E2B、旧木 #8A6142
	羊皮纸 #D9C49A
	烛光琥珀 #E8A54B、井底深影 #1E1A24
	长厅
	冷灰蓝 #4B5A6E、石墙 #6E6A66
	深木地板 #4A3528
	灯光暖黄 #F5C26B、玻璃青 #BFE6EA、金钥匙 #D4A93A、帘子酒红 #7A2E3A
	花园（只从小门看到）
	翠绿 #3FA36B
	喷泉蓝 #8EC9F0
	玫瑰红 #E0607E、阳光 #FFE6A0
	爱丽丝
	连衣裙麦黄 #E9C46A、围裙白 #F7F3EA
	头发浅金 #E6C98F
	发带海军蓝 #2E3F6E、黑色一字带鞋
	白兔
	暖白毛色 #F4F1EC
	格纹外套 #9B5B3A 与 #E2C9A0
	粉色眼睛 #E88FA3、芥末黄马甲 #C9A24A、金表
	C1 主视觉（标题页背景）
工具：图像生成模型。尺寸：16:9，至少 2560×1440。产出：标题页背景、加载页背景、分享封面。
Key art for a 3D storybook adventure game adapted from Lewis Carroll's 1865 novel. A seven-year-old Victorian girl falls slowly down a deep, round well. The well walls are lined with old wooden cupboards, bookshelves, maps and framed pictures hanging on pegs. She has long wavy light-blonde hair with a navy ribbon, a wheat-yellow knee-length dress with a white pinafore, white stockings and black strap shoes. Her arms are spread out, her skirt billows gently, and she looks down with wide, curious eyes. Far below, a small white rabbit in a checked jacket and mustard waistcoat looks up while holding a gold pocket watch. Warm candle-amber light from above, fading into deep violet darkness below. Stylized 3D render that looks like a moving Victorian picture book: soft toon shading, thin ink outlines, subtle paper grain, slightly exaggerated proportions, rounded shapes. Composition: the girl in the right third; the left third is quiet and darker, leaving room for the title and menu. Aspect ratio 16:9. No text, no letters, no logo.
	验收：放进标题页实际界面后，标题文字清晰可读，人物和白兔一眼能认出。选定的图作为风格基准，之后每张概念图都附上它作参考图。
C2 爱丽丝角色设定（给 Tripo 的多视图）
工具：图像生成模型。先出正面，再用正面图作参考出侧面和背面。产出：alice_front.png、alice_side.png、alice_back.png，每张一个完整人物，纯色背景。
正面：
Character design for a stylized 3D game model, full body, front view. Alice, a seven-year-old Victorian girl: long wavy light-blonde hair down to her mid-back, held back by a navy-blue ribbon tied in a small bow on top; big curious eyes, small nose, rosy cheeks, a gentle smile. Wheat-yellow knee-length dress with short puffed sleeves and a round white collar; white pinafore apron with frilled edges and two front pockets, tied at the back with a bow; white stockings; black strap shoes. Head-to-body ratio about 1:4.5, soft rounded shapes, slightly oversized hands and feet. Neutral A-pose: arms 40 degrees away from the body, palms facing down, fingers slightly apart, legs slightly apart, standing straight. Orthographic camera at chest height, even flat lighting, no cast shadows, plain light-grey background, no props, no text. Clean hand-painted colors with subtle ink outlines.
侧面（附上正面图作参考）：
Same character as the reference image, exact same design, proportions, colors and A-pose. Left side view (profile), full body. Orthographic camera, even flat lighting, no cast shadows, plain light-grey background, no text.
背面（附上正面图作参考）：
Same character as the reference image, exact same design, proportions, colors and A-pose. Back view, full body, showing the apron bow and the hair ribbon. Orthographic camera, even flat lighting, no cast shadows, plain light-grey background, no text.
	* 三张图里人物的高度和位置要一致，可以在图像软件里对齐，裁成同样尺寸。
* 头发要画成整块的体积，不要飘散的细发丝，Tripo 才能生成干净的网格。
* 用 A-pose 是为了后面的自动绑定。
验收：三张图放在一起，衣服细节、颜色、比例一致；没有投影，手里没有道具。
C3 白兔角色设定
工具与产出：同 C2，得到 rabbit_front.png、rabbit_side.png、rabbit_back.png。侧面和背面沿用 C2 的两句模板。怀表单独当道具做，不要画在手里。
Character design for a stylized 3D game model, full body, front view. The White Rabbit: a white rabbit who walks upright like a small, anxious gentleman, about two-thirds the height of a seven-year-old girl. Soft warm-white fur, pink eyes, long upright ears with pale pink insides, a slightly worried expression. He wears a brown-and-cream checked jacket with short tails, a mustard-yellow waistcoat with a gold watch chain leading into the waistcoat pocket, and a small bow tie. Rounded shapes, slightly oversized head and feet. Neutral A-pose: arms away from the body, legs slightly apart, standing upright. Orthographic camera, even flat lighting, no cast shadows, plain light-grey background, nothing in his hands, no text. Clean hand-painted colors with subtle ink outlines.
	C4 场景氛围图
工具：图像生成模型，附上 C1 主视觉作风格参考。用途：给关卡、灯光和配色定调，不直接送进 Tripo。
河岸：
Environment concept art in the same style as the reference image. A sleepy summer afternoon on an English riverbank in the 1860s. A large oak tree casts soft shade; an older sister in a long dress sits beneath it reading a book; a girl in a wheat-yellow dress sits in the grass among daisies. A slow river on the left, a thick green hedge on the right with a dark rabbit-hole beneath it. Warm golden light, gentle haze, cream and green palette. Wide shot at eye level. No text.
兔子洞：
Environment concept art in the same style as the reference image. Looking up from inside a deep, round well about four meters wide. The walls are packed with old cupboards, some with open doors, bookshelves, maps and pictures hanging on pegs, and a few candles. Warm amber candlelight near the top, fading into violet darkness. A sense of slow, dreamy falling. No characters, no text.
长厅：
Environment concept art in the same style as the reference image. A long, low hall with a ceiling just under three meters, lit by a row of lamps hanging from the roof along its center line. Many tall wooden doors all around the walls, all closed. In the middle stands a small three-legged table made entirely of clear glass, with a tiny golden key on top. Near one corner, a low dark-red curtain hangs against the wall. Cool blue-grey walls, warm pools of lamplight on a dark wooden floor. No characters, no text.
花园一瞥：
Environment concept art in the same style as the reference image. A view from floor level through a tiny dark passage, not much larger than a rat-hole, opening onto the loveliest sunlit garden: beds of bright flowers, rose bushes, cool fountains, clipped hedges, blue sky. Strong contrast between the dark tunnel frame and the bright, saturated garden. No characters, no text.
	C5 道具设定
工具：图像生成模型。Tripo 一次只能吃一个物体，所以每个道具单独出一张；再把所有道具拼成一张总览图检查风格。
模板：
Prop design for a stylized 3D game: 【道具描述】. Single object, centered, three-quarter view from slightly above, even flat lighting, no cast shadows, plain light-grey background, no text. Clean hand-painted colors with subtle ink outlines, same style as the reference image.
【道具描述】逐个替换为：
a small three-legged side table made entirely of thick solid clear glass, round top, sturdy tapered legs, slightly bluish edges
a tiny ornate golden key with a looped bow and simple teeth
a small round glass bottle with a cork stopper and a blank paper label tied around its neck with string
a small rectangular glass box with thin brass edges and a hinged lid, slightly open
a very small round cake with a golden crust and pale icing on top
an empty glass jam jar with a paper cover tied with string and a blank paper label
a gold pocket watch with a short chain and an open hinged lid, white dial with Roman numerals
an old small wooden wall cupboard with one door and a brass knob, slightly worn
a Victorian hanging oil lamp with a brass frame, a glass chimney and a short chain
a small round stone garden fountain with a two-tier basin
	纸签保持空白，文字和蛋糕上的葡萄干字母都在 Blender 里做（D4）。
C6 风格一致性检查
工具：Claude（上传全部概念图和 C0 风格定义）。
附件是我的游戏的风格定义和全部概念图。请逐张检查：配色是否在调色板范围内；描边和光影是否一致；角色比例是否一致；有没有出现影视改编的造型特征。输出表格：文件名、问题、严重程度（高、中、低）、修改建议（直接写成可以发给图像模型的修改 prompt）。最后列出需要重做的图。
	D 3D 建模
D0 通用规范（所有建模 prompt 共用）
* 单位：米，Blender 的 Unit Scale 为 1.0；导出 glTF 时 +Y 朝上。
* 轴心：角色在两脚之间的地面；道具在底面中心（钥匙在几何中心）；门板在铰链一侧的底角；建筑模块在左下角。
* 三角面预算：爱丽丝不超过 15k，白兔 12k，姐姐 8k，单个道具 200 到 3k，一个场景同屏总量不超过 300k。
* 贴图：角色一张 2048 的 Base Color；道具共用 1024 图集；最终全部转成 KTX2。
* 材质：只用 glTF 能导出的 Principled BSDF 通道（Base Color、Roughness、Metallic、Normal、Alpha）。玻璃在引擎里换成自定义材质，Blender 里只把材质名写成 M_Glass_ 开头。
* 命名：物体名就是资产 ID；材质 M_名称；贴图 T_名称_类型。
* 逻辑标记：用空物体表示，前缀见 A 总设定。需要的参数写成自定义属性，导出时勾选 Custom Properties，Three.js 里就能在 object.userData 读到。
* 导出：glTF Binary（.glb），Apply Modifiers，不导出相机和灯光（灯光在引擎里放）。
* 交付检查：视口截图（实体模式、材质预览各一张）、Dimensions 数值、三角面数、文件大小；Khronos glTF Validator 没有 error；在 three.js editor（threejs.org/editor）里能正常打开。
D1 资产清单
ID
	名称
	场景
	做法
	尺寸
	面数上限
	优先级
	chr_alice
	爱丽丝
	全章
	Tripo 多视图 + Blender 整理 + 自动绑定
	高 1.20 m
	15k
	P0
	chr_rabbit
	白兔
	S1 S2 S4
	同上
	高 0.75 m
	12k
	P0
	chr_sister
	姐姐（坐着读书）
	S1
	Tripo 单图直接生成坐姿
	坐高约 0.95 m
	8k
	P1
	chr_dinah_dream
	黛娜梦影
	S3
	Tripo 单图
	长 0.45 m
	4k
	P2
	prop_watch
	白兔的怀表
	S1
	Tripo + Blender 修尺寸
	直径 0.05 m
	600
	P0
	ch1_bank_terrain
	河岸地形
	S1 S2
	Blender 程序化 + 雕刻
	60 × 40 m
	20k
	P0
	ch1_bank_oak
	大橡树
	S1
	Tripo 文生 3D
	高 8 m
	6k
	P1
	ch1_bank_hedge
	树篱模块
	S2
	Blender
	每段 4 m
	2k
	P0
	ch1_bank_rabbithole
	树篱下的兔子洞
	S2
	Blender
	洞口直径 0.8 m
	3k
	P0
	ch1_bank_daisy
	雏菊（实例化）
	S1
	Tripo 文生 3D
	高 0.12 m
	300
	P0
	ch1_bank_grass
	草片（实例化）
	S1 S2
	Blender
	卡片 0.3 m
	每片 8
	P1
	ch1_bank_book
	姐姐的书
	S1
	Blender
	0.20 × 0.14 m
	300
	P1
	ch1_well_segment
	竖井墙段（带插槽）
	S3
	Blender 程序化
	内径 4 m，每段高 3 m
	5k
	P0
	ch1_well_cupboard_open / closed
	橱柜两种
	S3
	Tripo + Blender
	0.8 × 1.0 × 0.4 m
	1.5k
	P0
	ch1_well_bookshelf
	书架（书本实例化）
	S3
	Blender 程序化
	1.0 × 1.4 × 0.3 m
	2k
	P0
	ch1_well_map / picture
	挂图、画框
	S3
	Blender + 贴图
	0.6 × 0.4 m
	200
	P1
	ch1_well_candle
	烛台
	S3
	Tripo 文生 3D
	高 0.3 m
	600
	P1
	prop_jar_marmalade
	橘子酱空罐
	S3
	Tripo + Blender 贴签
	高 0.14 m
	800
	P0
	ch1_well_leafpile
	枯枝枯叶堆
	S3 S4
	Tripo 文生 3D
	直径 2.5 m
	4k
	P0
	ch1_passage_straight / corner
	长廊段
	S4
	Blender 程序化
	宽 2 m，高 2.4 m，每段 4 m
	3k
	P0
	ch1_hall_shell
	长厅（地面、墙、天花板）
	S5 到 S7
	Blender 程序化
	24 × 7 × 2.85 m
	10k
	P0
	ch1_hall_door_a / b
	大门两款
	S5
	Tripo + Blender（门板和门框分开）
	1.0 × 2.2 m
	2k
	P0
	ch1_hall_lamp
	吊灯（6 盏）
	S5
	Tripo
	灯体 0.5 m + 吊链
	1.5k
	P0
	ch1_hall_table_glass
	玻璃三脚桌
	S5 到 S7
	Blender 程序化
	高 0.72 m，桌面直径 0.50 m
	1.5k
	P0
	prop_key_gold
	金钥匙
	S5 到 S7
	Tripo + Blender 修尺寸
	长 0.05 m
	600
	P0
	ch1_hall_curtain
	矮帘子
	S5
	Blender 布料模拟后固定
	宽 0.8 m，高 0.6 m
	1.5k
	P0
	ch1_hall_door_little
	小门（含门框、锁孔）
	S5 到 S7
	Blender 程序化
	0.24 × 0.381 m
	800
	P0
	ch1_hall_passage_little
	小门后的通道
	S5
	Blender
	0.24 × 0.33 × 1.2 m
	500
	P0
	ch1_garden_vista
	花园景箱
	S5
	Tripo（花坛、喷泉、玫瑰丛）+ Blender 组装
	10 × 6 m
	25k
	P0
	prop_bottle_drinkme
	喝我瓶
	S6
	Tripo + Blender 贴签
	高 0.10 m
	800
	P0
	prop_box_glass
	玻璃小盒
	S7
	Blender
	0.10 × 0.07 × 0.05 m
	400
	P0
	prop_cake_eatme
	吃我蛋糕
	S7
	Tripo + Blender（葡萄干字母）
	直径 0.05 m
	1.2k
	P0
	D2 Tripo 生成流程与设置
工具：Tripo Studio（网页版）。生成后用 DCC Bridge 直接送进 Blender，或下载 GLB 再导入。输入：C2、C3、C5 的图。
* 角色（爱丽丝、白兔）：用多视图生成，上传正面、侧面、背面三张图。打开 Smart Low Poly，目标面数按 D1；打开 AI 贴图，分辨率 2K。每个角色生成 3 到 4 个候选，挑剪影最接近概念图的。
* 生成后用分件（Segmentation）检查头发、裙子、围裙是否各自成块，为后面的换色和次级动画做准备。
* 角色确认后在 Tripo 里做 Auto Rig（人形骨骼），用动作库里的走、跑试播，看裙子和手臂有没有严重穿插。合格再导出带骨骼的 GLB。白兔也按人形骨骼绑定。
* 道具：用 C5 的单张图做图生 3D，打开 Smart Low Poly。
* 简单物体可以直接文生 3D，不需要概念图，prompt 见下框。
* 贴图偏写实或颜色跑偏：先试 Tripo 的风格化；还不行就在 Blender 里重画 Base Color。
* 每个资产的输入图、参数和候选截图都存到 docs/prompts/tripo/，之后做展示要用。
Tripo 文生 3D prompt（每行一个物体）：
A single English daisy flower with a short green stem and two small leaves, stylized storybook style, hand-painted look, low poly game asset.
A low round heap of dry sticks and brown autumn leaves, about 2.5 meters wide, stylized storybook style, hand-painted look, low poly game asset.
A Victorian hanging oil lamp with a brass frame, a glass chimney and a short chain, stylized storybook style, low poly game asset.
An old brass candle holder with a half-melted white candle, stylized storybook style, low poly game asset.
A small round stone garden fountain with a two-tier basin, stylized storybook style, low poly game asset.
A rounded rose bush with pink and red roses, stylized storybook style, low poly game asset.
A rectangular flower bed with bright tulips, daisies and pansies, stylized storybook style, low poly game asset.
A large old English oak tree with a broad rounded canopy, stylized storybook style, low poly game asset.
	D3 角色整理（Blender）
工具：Blender + Codex（Blender MCP），或 Claude 的 Blender 连接器。输入：Tripo 导出的带骨骼爱丽丝模型。产出：assets_src/characters/chr_alice.glb。
你正在通过 MCP 操作我电脑上的 Blender。任务：把从 Tripo 导入的角色"爱丽丝"（chr_alice）整理成可以直接用在 Three.js 游戏里的模型。
开始之前：先列出当前场景里所有物体的名称和类型，用一句话复述你要处理的对象（名字、类别、目标身高），等我回复"确认"再动手。
规格：
1. 单位米，Unit Scale 1.0。整体缩放到身高 1.20 m（脚底到头顶，不含发带蝴蝶结），然后应用缩放和旋转。
2. 原点放在两脚之间的地面中心，并位于世界原点；角色面朝 Blender 的 -Y 方向；保持 A-pose。
3. 网格清理：按距离 0.0001 合并重复顶点；重新计算法线，全部朝外；删除孤立顶点和看不见的内部面；三角面总数不超过 15,000，超出就用 Decimate，尽量保留脸和手。
4. 分件：保留或拆分为 Alice_Body、Alice_Hair、Alice_Dress、Alice_Apron 四个网格，共用一张 2048 贴图，蒙皮权重不能丢。
5. 材质：每个网格一个 Principled BSDF，只连 Base Color，Roughness 0.85，Metallic 0；贴图重命名为 T_Alice_BaseColor。
6. 骨骼：检查层级和命名，列出主要骨骼名。在右手骨骼下新建空物体 SOCKET_HandR 作为手持道具挂点，放在掌心；左手同样建 SOCKET_HandL。
7. 次级骨骼（可选）：如果没有，为裙摆加 6 条环绕的骨骼链（每条 2 节），为后脑长发加 2 条骨骼链（每条 3 节），用自动权重；之后在引擎里做弹簧摆动。
8. 导出到 assets_src/characters/chr_alice.glb：glTF Binary，+Y Up，Apply Modifiers，包含骨骼、蒙皮和自定义属性，不导出相机和灯光。
交付时给我：
1. 视口截图 4 张：正面、侧面、背面（实体模式），再加一张材质预览。截图里只能有爱丽丝本人；如果场景里有别的物体，先隐藏再截图。
2. Dimensions 数值、三角面数、骨骼数、导出文件大小。
3. 改了什么，哪些没做到、原因是什么。
	其他角色复用上面的 prompt，把角色名和第 1、4、6、7 条换成下表的值：
参数
	白兔 chr_rabbit
	姐姐 chr_sister
	黛娜梦影 chr_dinah_dream
	目标尺寸（第 1 条）
	高 0.75 m（含耳朵）
	坐姿，坐高 0.95 m，臀部在原点
	身长 0.45 m
	三角面上限
	12k
	8k
	4k
	分件（第 4 条）
	Rabbit_Body、Rabbit_Jacket、Rabbit_Waistcoat
	Sister_Body、Sister_Dress、Sister_Book
	一个网格
	挂点（第 6 条）
	SOCKET_HandR（拿怀表）
	无
	无
	次级骨骼（第 7 条）
	两只耳朵各 3 节，外套后摆 2 条
	只做翻书的手臂和书页骨骼
	尾巴 4 节
	绑定
	Tripo Auto Rig 人形
	不用自动绑定
	Tripo 支持四足就绑定，不支持就不绑，只做漂浮
	D4 道具整理与文字贴花（Blender）
工具：Blender + MCP。输入：assets_src/tripo_raw/props/ 里 Tripo 导出的道具。产出：assets_src/props/ 下每个道具一个 GLB。
你正在通过 MCP 操作我电脑上的 Blender。任务：批量整理 assets_src/tripo_raw/props/ 里从 Tripo 导出的道具模型。
开始之前：列出文件夹里的文件名，按下表逐个说明你认为它是什么物体；对不上的先停下来问我。
目标尺寸（最大边长或高度）与轴心：
prop_key_gold：长 0.05 m，轴心在几何中心
prop_bottle_drinkme：高 0.10 m，轴心在底面中心
prop_jar_marmalade：高 0.14 m，轴心在底面中心
prop_cake_eatme：直径 0.05 m，轴心在底面中心
prop_watch：直径 0.05 m（不含表链），轴心在中心
ch1_well_cupboard_open、ch1_well_cupboard_closed：0.8 × 1.0 × 0.4 m，轴心在背面底边中点（方便贴墙）
ch1_well_candle：高 0.3 m；ch1_hall_lamp：灯体高 0.5 m，轴心在吊链顶端；ch1_well_leafpile：直径 2.5 m
每个道具：
1. 缩放到目标尺寸，应用变换，设置轴心；清理网格（合并重复顶点、重算法线、删除孤立顶点）；三角面不超过资产清单的上限。
2. 一个物体一个材质，Roughness 0.8；玻璃类（瓶子）材质名用 M_Glass_ 开头。
3. 文字贴花，不使用模型原有贴图上的字：
(a) 用 Python 生成 1024 × 512 的透明 PNG 标签贴图，字体 IM Fell English（SIL OFL），墨色 #2B2420，纸色 #EFE3C8。瓶签写 DRINK ME，罐签写 ORANGE MARMALADE。
(b) 在瓶颈和罐身上各加一个贴合曲面的薄贴片网格（向外偏移 0.5 mm），贴上对应贴图。
(c) 蛋糕：做一个葡萄干小模型（深紫褐色、略皱的椭球，长约 4 mm），把文字 EAT ME 转成曲线，沿笔画均匀取点，用实例摆出字样，最后合并成一个网格放在蛋糕顶面。
4. 每个道具单独导出到 assets_src/props/<ID>.glb。
交付：每个道具一张材质预览特写；再汇总一张表：ID、尺寸、三角面数、文件大小、问题。
	D5 程序化建筑（Blender Python）
工具：Blender + MCP（让 AI 写 bpy 脚本并执行）。产出：可以反复运行的脚本 tools/blender/build_ch1_architecture.py，以及各建筑模块的 GLB。用脚本生成，以后改尺寸只要改参数重跑，也方便展示。
你正在通过 MCP 操作我电脑上的 Blender。请写一个可以反复运行的 Python 脚本 tools/blender/build_ch1_architecture.py，用代码生成下面的建筑模块。每次运行先清空名为 CH1_ARCH 的集合再重新生成，所有物体都放进这个集合。单位米，尺寸必须精确。坐标约定：X 朝东，Y 朝北，Z 朝上。
1. ch1_well_segment：竖井墙段，内径 4.0 m，墙厚 0.3 m，高 3.0 m，内壁是旧木板和石块混合（先用两种材质分区即可）。内壁均匀分布 8 个插槽空物体 SLOT_01 到 SLOT_08，朝向井中心，自定义属性 slotType 从 cupboard、bookshelf、map、picture、empty 中随机取值（随机种子 42）。
2. ch1_passage_straight（长 4 m）和 ch1_passage_corner（向右转 90 度）：宽 2.0 m，高 2.4 m，拱形顶，石墙，泥土地面。
3. ch1_hall_shell：长厅，内部长 24 m（沿 X 轴）、宽 7 m、天花板高 2.85 m，以大厅中心为原点；深色木地板、浅灰蓝墙面、带木梁的天花板。西墙中间留一个 2.0 × 2.4 m 的拱形入口，连接长廊。四周墙上共开 10 个门洞（南北长墙各 4 个，东墙 2 个），每个 1.0 × 2.2 m，均匀分布，但北墙东端要留出 2.5 m 给帘子和小门；每个门洞放一个空物体 INT_door_01 到 INT_door_10。天花板中线上每隔 4 m 放一个空物体 LAMP_01 到 LAMP_06，高度 2.85 m。
4. ch1_hall_table_glass：三脚桌，总高 0.72 m；圆形桌面直径 0.50 m，厚 0.035 m；三条腿上粗下细（上端直径 0.04 m，下端 0.025 m）；桌面边缘倒角 5 mm；材质 M_Glass_Table。放在长厅 (4, 0) 处。
5. ch1_hall_door_little：小门，门洞宽 0.24 m、高 0.381 m，顶部为半圆拱；门板厚 0.02 m，带黄铜锁孔；门板是单独物体，轴心在铰链一侧底角，可以绕 Z 轴转开。门嵌在北墙上，距东墙 1.5 m。
6. ch1_hall_passage_little：小门后的通道，截面宽 0.24 m、高 0.33 m，向北延伸 1.2 m；在通道尽头放一个空物体 VISTA_ANCHOR，标出花园景箱的位置和朝向。
7. ch1_hall_curtain：矮帘子，宽 0.8 m，高 0.6 m，挂在小门前方 0.05 m 处的横杆上。用布料模拟让它自然下垂后应用为静态网格，再做一个"被掀开"的形态键 CurtainOpen。
完成后：
1. 每个模块单独导出到 assets_src/arch/<ID>.glb（单位、朝向规则与之前相同，勾选自定义属性）。
2. 给我：长厅顶视图截图（显示网格）、每个模块的 Dimensions 和三角面数、脚本路径。
	D6 关卡组装（Blender）
工具：Blender + MCP。输入：F2 的灰盒文件（逻辑点已经摆好），以及 D3 到 D5 的资产。产出：assets_src/scenes/ 下的 ch1_s1_bank.glb、ch1_s3_well.glb、ch1_s4_passage.glb、ch1_s5_hall.glb。
你正在通过 MCP 操作我电脑上的 Blender。任务：把第一章的灰盒场景替换成正式美术资产，同时保留所有逻辑标记。
1. 打开 assets_src/greybox/ch1_greybox.blend。名称以 _gb 结尾的是灰盒块，去掉后缀就是对应的正式资产 ID。用 assets_src/arch/ 和 assets_src/props/ 里的 GLB 替换，位置、朝向、缩放与灰盒块保持一致，替换后删除灰盒块。
2. 名称以 SPAWN_、TRG_、INT_、CAM_、PATH_、COL_、SOCKET_、SLOT_、LAMP_ 开头的物体，以及 VISTA_ANCHOR，一律保留，名称和自定义属性都不改。
3. 可拾取和会动的物体（钥匙、瓶子、盒子、蛋糕、罐子、雏菊、门板、帘子）不要合并进场景网格，只在对应的 INT_ 位置保留空物体，由程序运行时加载道具 GLB。
4. 静态环境网格按材质合并，减少物体数量。
5. 碰撞：为每个场景生成简化碰撞体 COL_*（墙用盒子，地形用低面数网格），设为不渲染，自定义属性 collider=true。
6. 按场景分别导出 4 个 GLB（S1 和 S2 共用 ch1_s1_bank），勾选导出自定义属性。
交付：每个场景一张顶视图、一张玩家视角截图；再附一张表：场景、物体数、三角面数、文件大小、逻辑物体清单。
	E 绑定与动画
E1 动画清单
片段名
	来源
	时长
	循环
	说明
	Alice_Idle
	Tripo 动作库
	3 到 4 s
	是
	轻微摇晃，偶尔整理围裙
	Alice_Walk
	Tripo 动作库
	1.0 s
	是
	步幅约 0.5 m
	Alice_Run
	Tripo 动作库
	0.7 s
	是
	

	Alice_Pick
	Tripo 动作库
	1.2 s
	否
	弯腰拾取，0.6 s 处手到最低点
	Alice_Inspect
	Blender
	2.0 s
	否
	双手把东西举到胸前端详
	Alice_FallFloat
	Blender
	4.0 s
	是
	空中缓慢下落，裙摆和头发上飘
	Alice_CurtseyAir
	Blender
	1.5 s
	否
	空中行屈膝礼（彩蛋）
	Alice_Land
	Blender
	1.0 s
	否
	落地缓冲后一下站起
	Alice_TryDoor
	Blender
	1.2 s
	否
	拉两下门把手，泄气松手
	Alice_KneelPeek_In / _Loop
	动作库跪姿 + Blender
	1.5 s / 3.0 s
	否 / 是
	跪下，脸贴近地面往小门里看
	Alice_Drink
	Blender
	2.0 s
	否
	拔塞、仰头喝、手背擦嘴
	Alice_ShrinkReact
	Blender
	1.5 s
	否
	抱住肩膀，惊奇地左右看
	Alice_ClimbSlip
	Blender
	2.5 s
	否
	抱住桌腿往上爬两下，滑下坐倒
	Alice_SitCry
	动作库坐姿 + Blender
	3.0 s
	是
	坐在地上揉眼睛，肩膀抽动
	Alice_Eat
	Blender
	2.0 s
	否
	咬一口蛋糕，另一只手按在头顶
	Rabbit_Hurry
	动作库跑步 + Blender 修改
	0.6 s
	是
	小碎步急跑，上身前倾，耳朵后甩
	Rabbit_CheckWatch
	Blender
	2.5 s
	否
	从马甲口袋掏表、打开看、收回
	Rabbit_LookBack
	Blender
	1.0 s
	否
	边跑边回头
	Rabbit_JumpIn
	Blender
	1.0 s
	否
	俯身钻进兔子洞
	Rabbit_NervousIdle
	Blender
	2.0 s
	是
	原地跺脚、抖耳朵
	Sister_Read
	Blender
	6.0 s
	是
	低头看书，偶尔翻页
	规则：30 fps；原地动画，不带根骨骼的水平位移，移动交给程序；片段名就是 Blender 里的 Action 名，导出前全部推到 NLA；动作里的关键时刻（例如拾取时手到最低点）记在 assets_src/characters/chr_alice.events.json，格式 {"Alice_Pick":{"grab":0.6}}，单位秒。
E2 动作库导入（Tripo）
工具：Tripo（Auto Rig 之后在动作库里挑）。
* 爱丽丝：挑待机、走、跑、弯腰拾取、跪姿、坐地难过（名称以动作库为准），逐个预览；裙子穿插严重的放弃，改到 Blender 里做。
* 白兔：挑快跑和待机作为基础，之后在 Blender 里改成小碎步和紧张的样子。
* 导出带骨骼和动画的 GLB，进 Blender 后按 E1 的名称统一重命名。
E3 专属动画（Blender 关键帧）
工具：Blender + MCP。输入：D3 整理好的 chr_alice。产出：包含全部动画的 chr_alice.glb 和 chr_alice.events.json。
你正在通过 MCP 操作我电脑上的 Blender。场景里是已经绑定好的角色 chr_alice（Tripo 骨骼）。请按下面的清单制作专属动画：每个动作一个 Action，名称必须和清单一致；30 fps；原地动画，不移动根骨骼的水平位置。
开始之前：列出骨骼名称，说明你打算用哪些骨骼控制头、躯干、手臂、腿、裙摆和头发，等我确认后再做。
清单：
1. Alice_FallFloat（4.0 s，循环）：在空中缓慢漂浮下落。双臂张开，轻轻上下摆动；双腿交替轻蹬；裙摆和头发向上飘；头偶尔左右张望。
2. Alice_CurtseyAir（1.5 s）：空中行屈膝礼。双手捏起裙摆，一条腿往后撤，低头，再回到漂浮姿态。首尾姿态与 Alice_FallFloat 第 0 帧一致。
3. Alice_Land（1.0 s）：落在枯叶堆上，膝盖弯曲缓冲，然后一下子站直。
4. Alice_Inspect（2.0 s）：双手把东西举到胸前端详，头微微歪。右手掌心对准 SOCKET_HandR。
5. Alice_TryDoor（1.2 s）：双手握住门把手往外拉两下，再泄气地松手。
6. Alice_KneelPeek_In（1.5 s）和 Alice_KneelPeek_Loop（3.0 s，循环）：跪下、上身前倾、脸贴近地面往前看；循环部分只有轻微的呼吸和点头。
7. Alice_Drink（2.0 s）：右手拿瓶，左手拔塞，仰头喝，最后用手背擦嘴。
8. Alice_ShrinkReact（1.5 s）：双手抱住肩膀，左右看一圈，表情惊奇。
9. Alice_ClimbSlip（2.5 s）：双臂双腿抱住桌腿往上爬两下，然后滑回地面坐倒。
10. Alice_SitCry（3.0 s，循环）：坐在地上，双手揉眼睛，肩膀一抽一抽。
11. Alice_Eat（2.0 s）：右手拿蛋糕咬一口，同时左手按在头顶，像在感觉自己往哪边长。
每做完一个：从侧面和正面各截 3 帧（开始、中间、结束）给我检查；在 assets_src/characters/chr_alice.events.json 里记录关键时刻（例如 Alice_Drink 瓶口碰到嘴的时间）。
全部完成后：把所有 Action 推入 NLA，导出 assets_src/characters/chr_alice.glb（包含全部动画）。
	白兔的专属动画用同一个 prompt，把角色名换成 chr_rabbit，清单换成 E1 里的 Rabbit_ 片段，挂点换成右手拿怀表。
E4 导出检查
工具：three.js editor，或 G1 里做的模型查看调试页。
* 所有片段都在，名称与 E1 一致，逐个播放没有抖动和骨骼翻转。
* 循环片段首尾衔接，没有跳帧。
* 把瓶子和蛋糕挂到 SOCKET_HandR 后，在 Alice_Drink 和 Alice_Eat 里位置正确。
F 关卡与灰盒
F1 各场景布局
坐标按 Blender 约定：X 朝东，Y 朝北，Z 朝上，单位米。
S1、S2 河岸（可走区域 60 × 40 m，X 从 -30 到 30，Y 从 -20 到 20）
* 北边是河，岸边有隐形墙；东边是树篱，兔子洞在树篱下；南、西两边是缓坡和矮灌木，作为边界。
* 大橡树在 (0, 0)，姐姐坐在树下面朝北；SPAWN_S1 在 (2, -1)，面朝北。
* 3 朵可拾取的雏菊（INT_daisy_1 到 3）在出生点 6 到 15 m 范围内；装饰雏菊 60 朵随机分布。
* 白兔路线：PATH_rabbit_S1 从 (-25, 5) 到停留点 RABBIT_STOP (4, 3)，看表后沿 PATH_rabbit_S2 跑到兔子洞 (29.5, -6)，全长约 35 m。
* TRG_S2_hole：洞口前 1.5 m 的触发区；INT_rabbit_hole 在洞口。
* INT_sister_book 在姐姐手上的书旁边。
S3 竖井
* 灰盒只做一段 30 m 高、内径 4 m 的竖井用来测试；正式运行时由程序循环拼接墙段（G6）。
* 爱丽丝始终在原点附近，世界向上移动。
S4 长廊
* 落点枯叶堆在 (0, 0)，SPAWN_S4 在枯叶堆上；长廊向东 24 m 后右转。
* 白兔起点在前方 8 m；TRG_S4_corner 在拐角处。
S5 到 S7 长厅（以大厅中心为原点，尺寸见 D5）
* 入口在西墙中间 (-12, 0)，SPAWN_S5 在入口内 1 m，面朝东。
* 玻璃桌 INT_table 在 (4, 0)；桌下玻璃盒 INT_glass_box 在 (4.1, -0.1)；桌腿交互 INT_table_leg 在桌子南侧那条腿旁。
* 帘子 INT_curtain 和小门 INT_door_little 在北墙 (10.5, 3.5)。
* 大门 INT_door_01 到 10 与门洞位置一致。
* 镜头点：CAM_S5_intro（入口，看向大厅深处）、CAM_S5_peek（小门前贴地）、CAM_S6_shrink（桌边低机位）、CAM_S6_cry（桌下）、CAM_S7_end（桌下侧面）。
F2 灰盒搭建
工具：Blender + MCP。产出：assets_src/greybox/ch1_greybox.blend 和 ch1_greybox.glb。
你正在通过 MCP 操作我电脑上的 Blender。请为游戏第一章搭灰盒：只用立方体、圆柱、平面等简单形体，让程序在美术资产到位之前就能跑通流程。单位米，尺寸必须精确。灰盒块统一用浅灰材质，名称用正式资产 ID 加 _gb 后缀。
把下面"各场景布局"逐条实现。四个场景分别放在集合 CH1_S1_BANK、CH1_S3_WELL、CH1_S4_PASSAGE、CH1_S5_HALL 里，彼此在世界坐标上错开 200 m，避免重叠。
逻辑物体规则：
SPAWN_名称：出生点，用单箭头空物体，箭头方向就是角色朝向。
TRG_名称：触发区，用立方体空物体表示范围。
INT_名称：可交互物位置，自定义属性 type（pickup、inspect、door、use、trigger）、item、promptKey。
CAM_名称：镜头点，用单箭头空物体，箭头方向就是视线方向，自定义属性 fov。
PATH_名称：贝塞尔曲线，标出白兔路线。
COL_名称：碰撞盒，自定义属性 collider=true。
完成后导出 ch1_greybox.glb（勾选自定义属性），并给我：每个集合的顶视图截图（显示网格），以及所有逻辑物体的名称和坐标列表。
【各场景布局】
（把本文档 F1 整节粘贴到这里，尺寸以 D5 为准）
	G 程序（Claude Code）
工具：Claude Code（Opus 5.5），在本地项目文件夹里运行。每个 prompt 是一次独立任务，按顺序做，每完成一个提交一次 Git。长任务可以放到 Claude Code 的云端会话里跑。
G0 CLAUDE.md 工程规则
放在项目根目录的 CLAUDE.md，内容是 A 总设定加上下面这段。同时把本文档的 B1、F1 和尺寸常量保存为 docs/ch1-design.md，A 总设定保存为 docs/bible.md。
# 工程规则
- 开始任何任务前，先读 docs/bible.md（总设定）和 docs/ch1-design.md（第一章设计）。
- 先给出计划：要改哪些文件、分几步、怎么验证。计划确认后再改代码。
- 不确定的 three.js 或 Rapier API，先查官方文档和官方 examples 再写，不要凭记忆。
- 每个任务结束前必须运行 npm run typecheck、npm run lint、npm run test；涉及画面的改动用 Playwright 截图，存到 docs/devlog/screens/<日期>/。
- 汇报格式：改了哪些文件、怎么运行、实际运行结果（截图路径或日志）、已知问题。没有实际运行过的，不能写"完成"。
- 每个任务一个 Git 提交，提交信息写清做了什么、怎么验证的。
- 性能预算：1080p、集显笔记本上 WebGPU 不低于 50 fps，WebGL2 不低于 40 fps；每帧 draw call 不超过 150；首屏下载不超过 15 MB。
- 不引入未登记的素材；新增外部资源写进 docs/assets-licenses.md。
- 不关闭 TypeScript strict；不删除 assets_src/ 里的原始文件。
- 把我发的每个任务 prompt 原文存到 docs/prompts/code/<任务编号>.md，结尾附上你的结果摘要。
	G1 项目骨架、资源管线与标题页
任务 G1：搭项目骨架、资源管线和标题页。
1. 用 Vite + TypeScript 创建项目 alice-game，安装 three、@dimforge/rapier3d-compat、zod、lil-gui、stats-gl，版本锁定在 package.json。
2. 渲染：用 three 的 WebGPURenderer（从 three/webgpu 引入，TSL 从 three/tsl 引入，以当前版本文档为准）。没有 WebGPU 时让它回退到 WebGL2；URL 参数 ?forceWebGL=1 时强制走 WebGL2。调试面板显示当前后端。
3. 目录结构：
src/core（Game、Loop、Time、Input、Events）
src/render（Renderer、PostFX、materials）
src/world（SceneManager、LevelLoader、Physics）
src/gameplay（Player、CameraRig、Interact、Inventory、Size、Flags）
src/narrative（Dialogue、Subtitles、i18n）
src/scenes/ch1（s1_bank.ts 到 s7_cake.ts）
src/ui（Title、Loading、HUD、Subtitle、Pause、ChapterCard、EndCard）
src/audio
public/assets（characters、props、scenes、audio、fonts、i18n、cutscenes）
assets_src（美术原始文件）、tools（资源脚本）、docs（文档、日志、prompt 记录）
4. 资源加载：GLTFLoader + MeshoptDecoder + KTX2Loader（Basis 转码器放在 public/ 下）。统一的 AssetManager：按场景清单预加载、有进度回调、同一资源只加载一次。
5. 标题页（HTML/CSS 叠在画布上）：全屏主视觉背景、游戏标题、语言切换（中 / EN）、按钮"点击 · 开始旅程"、底部一句开场旁白。点击后显示"正在准备画面 · xx%"，加载完成后淡入第一个场景。文字全部从 i18n 读取。
6. 资源管线脚本 tools/optimize-assets.mjs：用 glTF-Transform 处理 assets_src 里的 GLB（dedup、prune、Meshopt 压缩、贴图转 KTX2：颜色贴图用 ETC1S，法线贴图用 UASTC；需要本机安装 KTX-Software），输出到 public/assets/；再用 Khronos 的 gltf-validator 校验，有 error 就失败退出。加到 npm run assets。
7. 调试指令台（按 ` 键打开）：goto 场景、give 物品、size normal 或 small、skip 跳过当前台词、colliders 显示碰撞体、fps。另做一个模型查看页 /viewer.html：选择 GLB，播放其中每个动画片段。
验收：
- npm run dev 后看到标题页；点开始后进度走到 100%，进入一个临时场景（地面、立方体、灯光）。
- Chrome 默认走 WebGPU；加 ?forceWebGL=1 走 WebGL2；两种模式都能渲染，调试面板显示的后端正确。
- npm run assets 能处理 assets_src 里的示例 GLB，并通过校验。
- 交付：两种后端各一张运行截图、文件树、下一步建议。
	G2 章节流程、存档与场景切换
任务 G2：实现第一章的流程控制、存档和场景切换。
1. 用一个显式状态机描述第一章：S0_TITLE、S1_BANK、S2_CHASE、S3_FALL、S4_PASSAGE、S5_HALL、S6_SMALL、S7_CAKE、END。S1 和 S2 在同一个场景文件里，S5 到 S7 在同一个场景（长厅）里，只切换状态，不重新加载。
2. 剧情标记集中在 Flags 模块，用 TypeScript 字面量类型保证类型安全：daisiesPicked、rabbitSeen、jarTaken、jarStored、thoughts（1 到 5）、curtsey、doorsTried、keyTaken、keyTriesOnDoors、curtainFound、littleDoorOpened、peekDone、bottleInspected、drank、climbAttempts、boxOpened、ate。
3. 场景加载：每个场景有资源清单，进入前预加载并显示进度；离开时释放几何体、材质、贴图（dispose），用 renderer.info 确认内存回落。
4. 转场：黑场淡入淡出 0.6 s。S4 到 S5 用门洞遮挡无缝衔接，不出现加载画面（S5 资源在 S3 期间后台预加载）。
5. 存档：每个场景开始时自动存到 localStorage，键名 alice.save.v1；读写都用 try/catch 包起来，失败时游戏照常运行。有存档时标题页显示"继续"。
6. 调试指令：goto 状态名、flag 名称 值、save、load、clearSave。
验收：
- 用调试指令依次跳转 S1 到 END，每个状态都能进入，控制台没有报错。
- 在 S5 刷新页面，点"继续"回到 S5 开始处。
- 连续循环 S1 到 END 三遍，renderer.info.memory 里的几何体和贴图数量不持续增长（贴出前后数值）。
	G3 角色控制与相机
任务 G3：实现爱丽丝的第三人称控制和相机，先在灰盒（public/assets/scenes/ch1_greybox.glb）里调好。
1. 物理：Rapier 的 KinematicCharacterController 配胶囊碰撞体。场景里名称以 COL_ 开头、或 userData.collider 为 true 的网格生成静态碰撞体（盒子用 cuboid，其他用 trimesh），这些网格不渲染。
2. 输入：键盘鼠标（WASD 移动、Shift 跑、鼠标转视角、E 交互、Tab 物品栏、Esc 暂停、C 屈膝礼）；手柄（左右摇杆、A 交互）；触屏（左半屏虚拟摇杆、右半屏拖动转视角、交互按钮）。输入层抽象成动作（move、look、interact、run 等），游戏逻辑只读动作。
3. 相机：跟随相机带弹簧臂，用射线检测防止穿墙，遇到遮挡平滑拉近；支持脚本接管（过场时切到 CAM_ 点）。
4. 两套体型参数，做成可切换的配置（G7 会用）：
正常：胶囊半径 0.18 m、总高 1.20 m；走 1.4 m/s、跑 3.0 m/s；可跨台阶 0.25 m；相机距离 3.2 m、高度 1.4 m、FOV 55 度。
变小：胶囊半径 0.04 m、总高 0.254 m；走 0.5 m/s、跑 1.1 m/s；可跨台阶 0.05 m；相机距离 0.8 m、高度 0.3 m、FOV 65 度。
5. 动画：AnimationMixer 根据速度在 Alice_Idle、Alice_Walk、Alice_Run 之间混合（交叉淡化 0.2 s）；一次性动作（拾取、查看等）由交互系统调用，播放期间锁定移动。
6. 脚步：根据动画相位和地面材质（userData.surface：grass、wood、stone、leaves）发出脚步事件，给音频系统用。
7. S1 的午后犯困：S1 期间走速乘 0.85，相机有很轻的呼吸式晃动；开始追逐后取消。设置里开了"减少晃动"就不晃。
验收：
- 在灰盒里走完 S1、S4、S5；相机在长厅墙角和门边不穿模（各截一张图）。
- 用调试指令切换两套体型参数，在长厅里各走一圈，截图对比。
- 手机（或 Chrome 设备模拟）上，用触屏能完成移动和交互。
	G4 交互、物品与卡关提示
任务 G4：实现交互系统、物品栏和卡关提示。
1. 交互物来自场景 GLB 里的 INT_ 空物体，读取 userData（type、item、promptKey、requires、setsFlag）。type 包括 pickup（拾取）、inspect（查看后可以选择使用）、door（门）、use（拿物品作用于目标）、trigger（触发过场）。
2. 选择规则：半径 1.2 m 以内（变小时 0.3 m）、在角色前方 100 度扇形内、离屏幕中心最近的一个；显示交互提示（图标加文字，文字来自 i18n）。
3. 物品栏：最多 6 格，Tab 打开（触屏有按钮），显示物品名和描述；选中物品后可以对目标"使用"（钥匙对门）。
4. 物品查看界面：把物体放大到屏幕中央，可以拖动旋转。S6 检查瓶子时，必须把纸签的正反两面都转到正对屏幕过，才出现"喝下"。
5. 卡关提示：每个场景有目标列表。玩家在当前目标上停留超过 60 秒，播放第一句提示台词；再过 60 秒播放第二句（台词来自 i18n 表）。
6. 第一章交互清单，全部要实现，名称与灰盒里的 INT_ 一致：
S1：INT_sister_book（查看）；INT_daisy_1 到 3（拾取，拿到第 2 朵触发白兔）。
S2：INT_rabbit_hole（触发跳洞过场）。
S3：坠落中的罐子架、开着门的橱柜、念头气泡（由 G6 生成，交互规则相同）。
S5：INT_door_01 到 10（门，全部上锁）；INT_table（拾取钥匙）；钥匙对大门使用（失败台词，计数 keyTriesOnDoors）；INT_curtain（keyTriesOnDoors 达到 2 之后才能被选中）；INT_door_little（用钥匙开锁，触发偷看过场）。
S6：桌上的瓶子（peekDone 之后出现；拿瓶时把钥匙自动放回桌上，只播一声轻响）；INT_door_little（变小后交互，提示钥匙忘了）；INT_table_leg（爬桌腿，第 2 次后触发哭的过场）。
S7：INT_glass_box（打开后出现蛋糕）；蛋糕（查看后吃下）。
7. 所有台词通过事件触发（例如 emit('S5_KEY_FAIL')），由对话系统负责显示。
验收：
- 写一份交互测试清单 docs/tests/ch1-interactions.md，在灰盒里逐项点一遍并打勾。
- 用不同顺序操作长厅（先去帘子、先试小门、不拿钥匙直接去桌子等），都不会卡死；列出测过的顺序。
	G5 对话与字幕
任务 G5：实现对话与字幕系统，读取 B2 生成的 public/assets/i18n/ch1.json。
1. 用 zod 定义台词表结构（id、scene、trigger、speaker、type、zh、en、ja、dur、note）。npm run test 时校验：字段缺失、id 重复、trigger 不在事件列表里，都要报错并指出 id。
2. 显示：屏幕下方书页风格的字幕条（样式见 H 节）。say 显示说话人名牌；think 用手写体、不显示名牌；narr 居中、无底框，用于开场和章节卡；sfx 用大号字在画面中短暂弹出；ui 用于提示和目标。
3. 打字机效果：中文每秒 30 字，英文每秒 45 个字符。点击或按 E 先补全当前句，再点进入下一句；按 dur 自动推进。
4. 队列：同一时间只显示一句；过场台词优先级最高，可以打断普通台词；同一事件的多句台词按顺序播完。
5. 语言：运行中切换语言，当前字幕立刻换成新语言；ja 为空时回退到 en。
6. 语音预留：如果 public/assets/vo/语言/台词id.ogg 存在就播放，并用音频时长代替 dur。
验收：
- 故意把一条台词的 trigger 写错，npm run test 失败并指出 id；改回后通过。
- 在 S5 中途切换中英文，截图对比。
	G6 兔子洞坠落段
任务 G6：实现 S3 兔子洞坠落段，时长约 90 秒。
1. 浮动原点：爱丽丝固定在世界原点附近，竖井向上移动。用 12 段 ch1_well_segment 组成循环池，移出视野上方的段落回收到下方重用。
2. 填充：每段的 SLOT_ 按 userData.slotType 放置橱柜、书架、挂图、画框；用固定随机种子，保证每次游玩布局一致。书本用 InstancedMesh。蜡烛用自发光材质加光晕面片，同屏真实光源不超过 4 个。
3. 下落速度 2.2 m/s；往下是渐浓的雾，看不到底；往上逐渐变暗。
4. 操控：WASD 或摇杆在井内水平移动，半径限制 1.4 m，带惯性；相机在爱丽丝斜上方，可以小范围转动视角。
5. 剧本时间线（从入井开始计时）：
第 5 秒：旁白"要么是井太深"。
第 15 秒：经过放着橘子酱罐的架子（高亮）。拾取后播放台词；之后按丢弃键播放"不能扔"台词，罐子不会掉下去。
第 25 到 65 秒：每隔约 8 秒出现一个开着门的橱柜，拿着罐子靠近时可以"放进去"；放好后不再生成。
第 10、30、45、58、70 秒附近：5 个念头气泡，碰到触发 S3_THOUGHT_1 到 5；错过的在 10 秒内再出现一次。
念头 4 播放期间按 C：播放 Alice_CurtseyAir 和屈膝礼旁白，记录 curtsey 彩蛋。
第 75 秒：开始打瞌睡。画面逐渐柔焦、降饱和，身边出现半透明的黛娜梦影，播放"蝙蝠吃猫吗"。
第 88 秒：硬切黑场，弹出"砰！砰！"拟声字并播放音效，进入 S4 的落地过场。
6. 设置里开了"减少晃动"：关闭相机摇晃和视野抖动，下落的视觉速度减半。
7. 调试：调试面板可调 fall.speed、fall.time；指令 goto S3@60 直接跳到第 60 秒。
验收：
- 完整录一遍，时长 85 到 95 秒；罐子、5 个念头、屈膝礼彩蛋都能触发。
- 贴出这个场景在 WebGPU 和 WebGL2 下的平均帧率。
- 不拿罐子、拿了不放、念头全部错过这三种情况，都能正常结束坠落。
	G7 体型变化系统
任务 G7：实现体型变化系统 SizeSystem。第一章只用到"变小"，但接口要给第二章的"变大"留好。
1. 状态：normal（1.20 m）、small（0.254 m），之后会加 large（2.9 m）。每个状态对应 G3 里的一套参数。
2. 切换过程 2.5 s，缓入缓出：角色模型缩放；相机距离、高度、FOV 插值；移动速度切换；胶囊碰撞体在结束时重建。变大前先检查头顶空间，空间不够就停在当前大小（第二章要用）。
3. 视觉：切换期间画面四周出现像望远镜筒一样收缩的环形暗角，加轻微径向模糊（TSL 后处理节点）；WebGL2 回退时只用简单暗角。
4. 声音：脚步和角色音效的音高随体型变化（small 时 1.6 倍）；small 时环境声略微低通。
5. 手持物品随角色一起缩放。
6. 小门：small 状态下能进入小门触发区的接口先留好（第一章不开放）；normal 状态下靠近小门只能跪下看。
验收：
- 用调试指令在长厅里来回切换 10 次，不穿地、不卡墙，控制台没有报错。
- 两种体型下各截图：桌下仰视钥匙、小门正面、大厅全景。
	G8 长厅谜题脚本（S5 到 S7）
任务 G8：用 G2 到 G7 的系统，把长厅（S5 到 S7）的谜题和剧情串起来。逻辑写在 src/scenes/ch1/ 下的 s5_hall.ts 等文件里，每一步对应的台词事件见 i18n 表。
流程：
1. 进入长厅：播放过场 C4 后半段（沿吊灯推进加旁白）。
2. 大门：与任何一扇门交互，播放 Alice_TryDoor 和锁门台词，doorsTried 计数；doorsTried 达到 4 时播放"怎么出去"。
3. 玻璃桌：拾取金钥匙（keyTaken）。
4. 钥匙对大门使用：失败台词，keyTriesOnDoors 计数。keyTriesOnDoors 达到 2 时，INT_curtain 才变为可交互；在此之前不显示提示，也不会被选中。
5. 掀开帘子：播放帘子的 CurtainOpen 形态键动画，露出小门（curtainFound）。
6. 小门：用钥匙开锁（littleDoorOpened），播放偷看过场 C5：Alice_KneelPeek，镜头贴地顺着通道看到花园景箱。花园用单独的明亮灯光和更高饱和度，泛光只在这里开。过场结束后小门自己合上并落锁，钥匙在爱丽丝手里（peekDone）。
7. peekDone 之后，玻璃桌上淡入瓶子。拿瓶子时钥匙自动放回桌上，只有一声轻响，不提示。
8. 查看瓶子：纸签正反两面都看过后出现"喝下"（bottleInspected）。喝下播放过场 C6：Alice_Drink，SizeSystem 切到 small，Alice_ShrinkReact，等待台词。
9. 变小后走到小门：播放"钥匙忘了"台词。桌下仰视时，钥匙要透过玻璃清晰可见。
10. 桌腿：交互播放 Alice_ClimbSlip，climbAttempts 计数；第 2 次后播放过场 C7（Alice_SitCry、自我训话台词、镜头扫到桌下闪光的玻璃盒）。
11. 玻璃盒：打开后出现蛋糕；查看后"吃下"（ate），播放过场 C8：Alice_Eat、"往哪边？"、旁白、淡出、章末卡。
12. 章末卡：第一章完成；显示念头收集数、是否发现屈膝礼彩蛋；下一章预告；按钮"回到标题"。
边界情况（都要处理）：
- 没拿钥匙就去小门：提示锁着，锁孔很小。
- 拿着钥匙但 keyTriesOnDoors 不到 2：靠近帘子没有任何提示。
- 变小后去大门：播放够不着门把手的台词。
- 变小后想回长廊：入口处播放"那边太黑了"并挡住。
验收：
- 不用调试指令，从进入长厅一路玩到章末卡，并录屏。
- docs/tests/ch1-interactions.md 里长厅部分全部打勾，列出测过的操作顺序（至少 5 种）。
	G9 画面风格（TSL）
任务 G9：实现"会动的维多利亚绘本"画面风格，基于 WebGPURenderer 和 TSL 节点材质；WebGL2 回退时也要能用。先查 three.js 官方 examples 里 WebGPU 的卡通着色、描边和后处理例子，按官方写法实现。
1. 卡通着色：角色和道具用 3 级明暗的渐变贴图；阴影色偏暖紫，不用纯黑。环境用同一套着色，对比度更低。
2. 描边：角色和道具用法线外扩的背面描边，颜色 #2B2420，宽度随相机距离变细；环境物体用基于深度和法线的屏幕空间描边（可以单独开关）。
3. 纸纹：全屏叠一张可平铺的纸张纹理，强度 0.15，跟随屏幕而不是世界。
4. 暗角与调色：每个场景一套调色参数（亮部、中间调、暗部的色彩偏移和饱和度），取值参照风格定义里的调色板；花园景箱单独一套更饱和的参数。
5. 泛光：只对自发光材质生效（吊灯、蜡烛、花园阳光）。
6. 玻璃：玻璃桌、瓶子、玻璃盒用自定义材质，透明度 0.25，菲涅尔边缘提亮，轻微的屏幕空间折射偏移（WebGL2 下关闭折射）。桌下仰视时钥匙必须清晰可见，注意透明物体的排序。
7. 画质档位：高（全部效果，阴影贴图 2048，像素比上限 2）、中（关闭屏幕空间描边，阴影 1024，像素比 1.5）、低（只保留纸纹和暗角，阴影 512，像素比 1）。启动时按设备粗略选档，设置里可以改。
8. 加分项，最后做：暗部按明暗程度叠加 2 到 3 层交叉排线纹理。
验收：
- 每个场景在高、低两档下各截一张图，和对应概念图并排存到 docs/devlog/screens/。
- 同一机位的 WebGPU 与 WebGL2 截图对比。
- 1080p 集显笔记本上，长厅场景达到 G0 的帧率预算。
	G10 过场与镜头
任务 G10：实现过场系统，并制作第一章的 8 段过场。
1. 过场用 JSON 时间线描述，存在 public/assets/cutscenes/ch1/。轨道类型：camera（沿 CAM_ 点或 PATH_ 曲线移动、看向目标、改 FOV）、anim（角色播放片段）、line（触发台词事件）、sfx、fade、letterbox、wait。
2. 过场期间锁定玩家输入。长按 Esc 或屏幕右下角按钮 1 秒可以跳过；跳过时直接应用过场结束后的状态。
3. 镜头切换不跳变：位置和朝向都做平滑插值，相邻镜头之间至少 0.3 s 过渡。
4. 第一章过场：
C1 白兔跑过（S1）：白兔沿路线跑来，停下掏表、看表，再跑走。镜头先拍爱丽丝回头，再给白兔中景，最后跟拍白兔背影。
C2 跳进兔子洞（S2 到 S3）：爱丽丝钻进洞口，第一人称视角在隧道里走几步，地面突然消失，镜头翻转朝上，进入坠落。
C3 落地（S3 到 S4）：黑场中"砰！砰！"，亮起后爱丽丝坐在枯叶堆上，跳起来，镜头转向长廊里的白兔背影。
C4 白兔消失与长厅登场（S4 到 S5）：跟拍到拐角，白兔台词，拐过去只剩空走廊；接长厅推镜和旁白。
C5 偷看花园（S5）：爱丽丝跪下，镜头贴地穿过通道，在花园全景停 4 秒，再拉回。
C6 喝药缩小（S6）：喝下；缩小时镜头跟着前推，让爱丽丝在画面里的大小保持不变，背景迅速变大；惊奇反应。
C7 哭与玻璃盒（S6）：坐下哭，自我训话，镜头缓缓扫到桌下的玻璃盒，盒子闪一下。
C8 章末（S7）：咬蛋糕，手按头顶，"往哪边？"，什么也没发生，吃光，淡出到章末卡。
验收：
- 每段过场都能用调试指令单独播放，也都能跳过；录一段包含全部过场的视频。
- 跳过任意一段过场后，剧情标记和角色状态与看完时一致（写自动化测试）。
	G11 音频系统
任务 G11：实现音频系统，接入 I 节的音乐和音效。
1. 用 three.js 的 AudioListener、Audio、PositionalAudio（基于 Web Audio）。标题页的"点击 · 开始旅程"同时用来解锁浏览器音频。
2. 音乐：每个场景一个音乐提示点，切换时交叉淡化 2 s；循环曲按 public/assets/audio/music.json 里的循环起止点无缝循环；有台词时音乐压低 6 dB。
3. 音效：对象池复用；脚步按地面材质选变体，音高随机 ±5%；变小时脚步音高 1.6 倍。
4. 空间音效：白兔的脚步和怀表滴答、河水、吊灯的嗡嗡声用 PositionalAudio。
5. 设置：总音量、音乐、音效、语音四个滑条，保存到 localStorage（try/catch）。
6. 每个音频准备 .ogg 和 .m4a 两份，运行时按浏览器支持选择。
验收：首次点击前没有任何音频报错；在 Chrome 和 Safari 各完整听一遍 S1 到 S3；四个音量滑条立即生效，刷新后仍然记得。
	G12 设置、无障碍与性能
任务 G12：设置菜单、无障碍选项和性能优化。
1. 暂停菜单（Esc）：继续、设置、回到标题。设置项：语言、四个音量、字幕大小（小、中、大）、视角灵敏度、Y 轴反转、减少晃动、画质档位、显示帧率。
2. 全程可以只用键盘、只用手柄或只用触屏完成；所有按钮都有焦点样式。
3. 性能：雏菊、草、书本用 InstancedMesh；每个场景的静态网格按材质合并；贴图全部是 KTX2；找出并消除每帧新建对象的代码；用 renderer.info 记录每个场景的 draw call 和三角面数。
4. 输出 docs/perf/ch1.md：每个场景在 WebGPU 和 WebGL2 下的平均帧率、最低帧率、draw call、三角面数；写清测试设备型号。
验收：docs/perf/ch1.md 里所有场景达到 G0 的预算；不达标的写出原因和处理方案。
	G13 构建、上线与桌面版
任务 G13：生产构建、网页上线和 Electron 桌面版。
1. 构建：npm run build，资源文件名带哈希；GLB、KTX2、音频设长期缓存，index.html 不缓存；启用 Brotli 压缩。
2. 网页部署：写部署说明，支持 Cloudflare Pages 和自有服务器（Nginx + HTTPS）两种方式，给出需要的缓存头和 MIME 类型（.glb、.ktx2、.wasm）。说明里写清 WebGPU 只在 HTTPS 或 localhost 下可用。
3. 既不支持 WebGPU 也不支持 WebGL2 的浏览器：显示一页说明和桌面版下载链接。
4. Electron 桌面版：用自定义安全协议加载本地构建产物（不要直接用 file://，否则可能不是安全上下文），确认 WebGPU 可用；打包 Windows 便携版 exe；设置窗口标题、图标、退出确认。
5. README：项目介绍、运行方法、构建方法、致谢（Lewis Carroll 原著 1865 年，John Tenniel 插图参考）、AI 工具链说明、素材许可说明。
验收：
- 线上地址在 Chrome、Edge、Safari 最新版都能玩（各一张截图）；线上加 ?forceWebGL=1 能走通 WebGL2。
- 桌面版在一台没装开发环境的 Windows 电脑上运行，断网也能玩。
	H UI
H1 界面规范
* 整体是书页质感。字幕是一条带毛边的纸条，墨色文字，不用大块半透明黑框。
* 字体（全部是 SIL OFL 开源字体）：中文正文用思源宋体；内心独白用霞鹜文楷；英文用 IM Fell English；日文预留 Zen Old Mincho。中文字体只保留台词里实际用到的字（H3 的子集化脚本），控制在几百 KB。
* 颜色：墨色 #2B2420，纸色 #F3E9D2，点缀金 #D4A93A。
* HUD 尽量少：平时屏幕上只有交互提示，物品栏和目标在需要时才出现。
* 页面清单：标题页、加载、游戏中（字幕、交互提示、目标）、物品栏与物品查看、暂停与设置、章节卡、章末卡、浏览器不支持提示页。
H2 界面设计稿
工具：Claude（让它直接出可以预览和修改的界面设计稿）。产出：设计稿存到 docs/ui/。
为我的网页 3D 剧情游戏《爱丽丝梦游仙境》设计一套界面。按下面的规范出 8 个画面，桌面 1920 × 1080 和手机竖屏 390 × 844 各一版：标题页、加载中、游戏中（字幕 + 交互提示 + 目标提示）、物品栏与物品查看、暂停与设置、章节卡（第一章 掉进兔子洞）、章末卡（含收集统计和下一章预告）、浏览器不支持提示页。
规范：
1. 风格：一本会动的维多利亚绘本，书页质感；字幕是带毛边的纸条，墨色文字，不用大块半透明黑框。
2. 字体：中文思源宋体，内心独白霞鹜文楷，英文 IM Fell English。
3. 颜色：墨色 #2B2420，纸色 #F3E9D2，点缀金 #D4A93A。
4. 标题页结构：全屏主视觉背景（先用占位图）、游戏标题、语言切换（中 / EN）、按钮"点击 · 开始旅程"、底部一句开场白、有存档时的"继续"按钮。
5. 文案用我提供的真实中文台词，不要用占位文字。【粘贴 B1 里 S0、S5 的几句台词】
6. 不使用任何影视改编的元素。
做完后列出每个画面的组件清单，方便程序实现。
	H3 界面实现
工具：Claude Code。
任务 H3：按 docs/ui/ 里的设计稿实现界面层，用 HTML/CSS 叠在画布上，不引入大型前端框架。
1. 组件：Title、Loading、Subtitle、InteractPrompt、Objective、Inventory、Inspect、Pause、Settings、ChapterCard、EndCard、Unsupported。
2. 颜色和字号用 CSS 变量统一；字幕大小三档切换只改变量。
3. 字体子集化脚本 tools/subset-fonts.mjs：扫描 public/assets/i18n/ 下所有 JSON 和界面文案里用到的字符，调用 fonttools 的 pyftsubset 生成 woff2 子集；字体许可文件一起放到 public/assets/fonts/。台词更新后重新运行。
4. 响应式：手机竖屏也能玩，字幕和按钮不遮挡交互物；横屏优先。
5. 键盘和手柄可以在所有菜单里导航。
验收：与设计稿并排截图对比（桌面、手机各一组）；字体文件总大小不超过 1.5 MB；切换字幕大小后不溢出。
	I 音频
I1 音乐
工具：Suno 或 Udio，选一个用到底。每首生成 4 个版本挑 1 个；用 Audacity 找无缝循环点，把循环起止秒数写进 public/assets/audio/music.json。生成时确认账户套餐允许商用和公开发布，截图保存条款页和订阅状态，登记到 docs/assets-licenses.md。
编号
	用在
	长度
	Prompt
	M1 标题
	标题页
	90 s，可循环
	Gentle Victorian music box and celesta waltz in 3/4, soft string quartet pizzicato underneath, warm, nostalgic, a little mysterious, 80 BPM, D major, instrumental, seamless loop
	M2 河岸
	S1
	120 s，可循环
	Lazy summer afternoon by an English river, solo clarinet and harp over soft sustained strings, sleepy and warm, 70 BPM, F major, instrumental, seamless loop
	M3 追白兔
	S2、S4
	45 s，可循环
	Playful hurried chase, pizzicato strings, staccato bassoon and flute, a ticking woodblock like a pocket watch, comic and curious, 140 BPM, 2/4, instrumental, seamless loop
	M4 坠落
	S3
	95 s，一次性，结尾 3 秒渐弱
	Slow dreamy descent, celesta, glass harmonica and airy strings, gentle reversed piano swells, floating and weightless, gradually getting sleepier and softer, 60 BPM, instrumental
	M5 长厅
	S5 到 S7
	120 s，可循环
	Quiet puzzle music for a long dim hall, solo cello and muted strings, a slow music-box waltz motif, curious and a little lonely, 72 BPM, A minor, instrumental, seamless loop
	M6 花园
	C5 偷看花园
	8 s
	Short radiant stinger, harp glissando into bright high strings and a soft wordless choir, sunlight and wonder
	M7 章末
	C8 与章末卡
	60 s
	A music-box waltz theme returns with a full chamber ensemble, whimsical and hopeful, ending on an unresolved, questioning chord, instrumental
	为了让 M1、M5、M7 听起来是同一个主题，先定下 M1，再把 M1 作为参考音频上传，生成 M5 和 M7（如果所用工具支持参考音频）。
I2 音效
工具：ElevenLabs 音效生成（输入英文描述），或在 Freesound 上找，只选 CC0。下表的描述可以直接当 prompt，末尾统一加上 close-up, dry, no music, no voice。
ID
	描述（prompt）
	变体数
	sfx_step_grass / wood / stone / leaves
	A child's light footstep on soft grass / wooden floorboards / a stone floor / dry leaves
	各 6
	sfx_daisy_pick
	Picking a small flower from the grass, a soft pluck and rustle, 0.5 seconds
	2
	sfx_watch_open
	A small brass pocket watch lid clicking open, 0.4 seconds
	1
	sfx_watch_tick
	A pocket watch ticking, steady and quiet, loopable, 2 seconds
	1
	sfx_rabbit_scurry
	Small quick footsteps hurrying across grass, 1.5 seconds
	2
	sfx_hole_jump
	Pushing through a hedge into a burrow, leaves rustling and a soft whoosh, 1.2 seconds
	1
	amb_well_wind
	Soft hollow wind inside a deep well while slowly falling, loopable, 8 seconds
	1
	sfx_jar_pick / sfx_jar_place
	An empty glass jar lifted from a wooden shelf / an empty glass jar set inside a wooden cupboard with a small creak
	各 1
	sfx_thought_pop
	A soft magical bubble pop with a tiny chime, 0.4 seconds
	3
	sfx_land_thump
	A child landing on a heap of dry sticks and leaves, a crunchy thump, 0.8 seconds
	2
	sfx_door_locked
	Rattling the handle of a locked wooden door, 0.8 seconds
	3
	sfx_key_pick
	A tiny brass key picked up from a glass table, a bright tick, 0.3 seconds
	1
	sfx_key_down
	A tiny brass key set down on a glass table, a very quiet clink, 0.3 seconds
	1
	sfx_key_turn_small
	A tiny lock clicking open, 0.4 seconds
	1
	sfx_curtain
	A heavy velvet curtain being pulled aside, 1 second
	1
	sfx_little_door
	A tiny wooden door creaking open, 0.8 seconds
	1
	amb_garden
	A sunny garden with a small fountain and birdsong, heard faintly through a narrow tunnel, loopable, 8 seconds
	1
	sfx_cork / sfx_drink
	A cork popping out of a small glass bottle / three small gulps
	各 1
	sfx_shrink
	A whimsical shrinking sound, a descending slide whistle with tiny chimes, like a telescope folding, 2.5 seconds
	1
	sfx_slip
	Small hands squeaking and sliding down a glass table leg, 1 second
	2
	sfx_sniffle
	Gentle childlike sniffles, soft and not distressing, 2 seconds
	1
	sfx_box_open
	A small glass box lid opening with a light clink, 0.5 seconds
	1
	sfx_nibble
	A tiny bite of soft cake, 0.4 seconds
	2
	amb_riverbank / amb_hall
	A sleepy summer riverbank with flowing water, birds and insects / the quiet room tone of a long hall with a faint lamp hum, loopable, 10 seconds
	各 1
	I3 配音（可选）
第一章建议只做字幕。需要配音时用 TTS，爱丽丝和白兔各固定一个音色，先只做英文；文件名用台词 id，放在 public/assets/vo/en/，G5 会自动播放。
J 测试与验收
J1 第一章验收清单
* 流程：从标题页到章末卡，不用调试指令就能完整通关；中途刷新能从最近的检查点继续。
* 剧情：8 个场景的节拍全部出现，顺序与原著一致；中英字幕不溢出、没有错字。
* 交互：交互清单每一项都能触发；任意操作顺序都不会卡死（附测过的顺序）。
* 画面：每个场景截图与概念图对比；描边、纸纹、调色符合风格定义；桌下能透过玻璃看清钥匙。
* 性能：1080p 集显笔记本上 WebGPU 不低于 50 fps，WebGL2 不低于 40 fps；首屏下载不超过 15 MB，整章不超过 60 MB。
* 兼容：Chrome、Edge、Safari 最新版；至少一台手机（触屏）；Electron 桌面版。
* 资产：glTF Validator 没有 error；docs/assets-licenses.md 覆盖所有外部资产。
* 无障碍：字幕三档字号；减少晃动生效；全程可以只用键盘或只用手柄。
J2 自动化测试
工具：Claude Code + Playwright。
任务 J2：为第一章写端到端冒烟测试。
1. 游戏支持 ?test=1 参数：关闭随机性、过场自动跳过、动画 4 倍速，并在 window.__game 暴露调试接口（goto、flag、interact、getState）。
2. 用 Playwright 写测试：从标题页开始，按节拍依次完成 S1 到 S7 的关键交互，断言每一步的剧情标记；每个场景截一张图，存到 docs/devlog/screens/e2e/<日期>/。
3. 浏览器：Chromium 走 WebGL2 路径（无头环境不一定有 WebGPU）；本地有显卡时，另外跑一遍 WebGPU 路径。
4. 加一个 GitHub Actions 工作流，每次推送都运行类型检查、单元测试和 WebGL2 冒烟测试。
验收：npm run test:e2e 在本地通过，GitHub Actions 显示通过；故意破坏一个交互（例如钥匙拿不起来）时，测试失败并指出是哪一步。
	J3 截图审查
工具：Claude（上传实机截图、对应的概念图和风格定义）。
附件是游戏第一章每个场景的实机截图，以及对应的概念图和风格定义。请逐张对照，指出：构图和可读性问题（玩家能否一眼看出该去哪、什么能交互）；与概念图和调色板的偏差；模型穿插或贴图错误；UI 遮挡。输出表格：截图文件名、问题、位置描述、严重程度、修改建议。
	J4 试玩
* 找 3 到 5 个没看过开发过程的人试玩。只告诉他们"用键盘鼠标玩，卡住了可以说出来"，不做其他提示。
* 记录：每个场景用时；在哪里卡住、卡了多久；有没有注意到钥匙被放回了桌上；最喜欢和最不喜欢的地方；遇到的 bug。
* 把记录交给 Claude 汇总成修改清单，按影响大小排序。
K 展示与开发记录
这个项目的目的是展示 AI 开发能力，开发过程本身也是作品的一部分。
K1 过程记录规则
* 每个 prompt 都存档：docs/prompts/方向/任务编号.md，写明工具、模型、输入、输出摘要、改了几轮、最终是否采用。
* 每个资产保留四个阶段的截图：概念图、Tripo 原始模型、Blender 整理后、游戏内。
* 每天一条开发日志 docs/devlog/日期.md：完成了哪些任务、花了多少时间、AI 做了什么、人工改了什么、遇到什么问题。
* 关键节点用 OBS 录屏：第一次在灰盒里走通、坠落段完成、长厅谜题完成、上线。
* 统计数据写进 docs/devlog/stats.json：总工时、prompt 数量、生成的资产数、代码行数、各工具的花费。
K2 制作过程页面
工具：Claude Code。
任务 K2：在游戏网站里加一个 /making-of 页面，展示第一章是怎么用 AI 工具链做出来的。
1. 工具链流程图（用 Mermaid 生成 SVG）：Claude（设定、剧情）→ 图像模型（概念图）→ Tripo（3D 生成、绑定）→ Blender + MCP（整理、建筑、关卡）→ Claude Code（程序）→ 上线。
2. 资产演变：读取 docs/devlog/assets/ 里每个资产的四阶段截图，做成可以左右滑动对比的卡片。
3. 数据：从 docs/devlog/stats.json 读取工时、prompt 数、资产数、代码行数，做成数字卡片和每日进度图。
4. prompt 示例：每个方向选 1 条最有代表性的 prompt 原文展示，可以折叠。
5. 时间线：按天列出里程碑和录屏片段（视频压缩成 mp4 或用外链）。
6. 页面风格和游戏 UI 一致，中英双语。
验收：手机和桌面都能正常浏览；所有数据都来自 docs/ 里的真实文件，没有写死的数字。
	K3 一分钟预告片分镜
工具：游戏内调试自由相机（隐藏 UI）+ OBS 录制；剪映或 DaVinci Resolve 剪辑；配乐用 M1。
1. 河岸午后，镜头从树荫推到爱丽丝，姐姐翻书（4 秒）。
2. 白兔跑过，掏出怀表（4 秒）。
3. 爱丽丝追到树篱，跳进兔子洞（4 秒）。
4. 坠落：俯拍爱丽丝张开双臂，穿过橱柜和书架（8 秒）。
5. 拿起橘子酱罐，空中行屈膝礼（6 秒）。
6. "砰！砰！"黑场，接长厅吊灯推镜（6 秒）。
7. 掀开帘子，小门，贴地看到花园（8 秒）。
8. 喝下瓶子，世界变大（6 秒）。
9. 桌下仰视够不着的钥匙（4 秒）。
10. EAT ME 蛋糕特写，"往哪边？"（4 秒）。
11. 标题和网址（6 秒）。
K4 开源前检查
* 代码许可（例如 MIT）写进 LICENSE。
* 逐项确认 Tripo、Suno 或 Udio、ElevenLabs 生成资产的条款是否允许随代码公开分发；不允许的，改成下载脚本或替换掉。
* 字体许可文件随字体一起发布。
* README 写清原著和插图的出处，以及哪些部分由 AI 生成、哪些经过人工修改。
第一章排期参考（7 个工作日）
天
	任务
	当天产出
	第 1 天
	A；B2 到 B4；C0 到 C3
	总设定、三语台词 JSON、主视觉、两套角色多视图
	第 2 天
	C4 到 C6；F1、F2；G0 到 G2
	场景和道具概念图、灰盒；项目能从标题页进入灰盒
	第 3 天
	G3 到 G5
	灰盒里能从 S1 玩到章末
	第 4 天
	D2 到 D5
	角色、道具、建筑模块的 GLB
	第 5 天
	E1 到 E4；D6；G6 到 G8
	动画齐全；坠落段、缩小机制、长厅谜题完成
	第 6 天
	G9 到 G11；H；I
	美术版整章，有音乐音效
	第 7 天
	J；G12、G13；K
	线上地址、桌面版、开发日志、制作过程页
	参考作品用 16 天做完了整本《小王子》。第一章还包括搭框架和定风格，后面的章节会快很多。

