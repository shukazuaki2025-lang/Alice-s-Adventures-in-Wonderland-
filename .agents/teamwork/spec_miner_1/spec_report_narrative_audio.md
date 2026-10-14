# Specification Mining Report: Narrative, Lore, UI, Audio & Cutscenes
**Tracks Covered**: Track A, Track B, Track C, Track H / UI, Track I (Audio), Cutscenes (C1–C8), Track K1  
**Project**: *Alice's Adventures in Wonderland* (Chapter 1: "Down the Rabbit-Hole" / `Alice: Down the Rabbit-Hole`)  
**Authoritative Sources**:
1. User Request: `/home/administrator/Alice-s-Adventures-in-Wonderland-/.agents/teamwork/ORIGINAL_REQUEST.md`
2. Master Specification: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md`
**Miner**: `spec_miner_1`  
**Date**: 2026-10-14  

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Track A | Project Bible & Metric Dimensions | Fixed world scale (1m = 1 unit), Alice 1.20m normal / 0.254m small, table 0.72m, hall 24×7×2.85m, well 4m diameter | Metric scale constants | Canonical coordinates & bounding boxes | Mismatched dimensions fail scene validation | `google-doc-spec-v1.md` § A, F1 |
| 2 | Track B | S0–S7 Narrative State Machine | Explicit progression: S0_TITLE → S1_BANK → S2_CHASE → S3_FALL → S4_PASSAGE → S5_HALL → S6_SMALL → S7_CAKE → END | Player actions & trigger zones | State transitions & checkpoints | Unreachable states guarded by state flags | `google-doc-spec-v1.md` § B1, G2 |
| 3 | Track B | B1 Dialogue Lines (English Verbatim) | Complete dialogue/thought/narrative lines preserving Carroll 1865 text verbatim in English | Event triggers (`S1_PEEK_BOOK`, etc.) | Subtitle entries (id, scene, speaker, type, zh, en, ja, dur) | Missing ID or unknown trigger fails Zod schema | `google-doc-spec-v1.md` § B1, B2, G5 |
| 4 | Track B | Trilingual Localization Rules | English verbatim 1865, Chinese ≤ 28 chars/subtitle (7yo girl tone), Japanese reserved (fallback to en) | Language selector (zh, en, ja) | Localized UI and subtitles | Subtitle > 28 zh chars fails build test | `google-doc-spec-v1.md` § B2, G5 |
| 5 | Track B | Curiosity Notes (B3) | 5 collectible notes matching S3 thoughts (fall, 4000 miles, lat/long, Antipathies pun, Dinah & bats) | S3 thought bubble touches | Unlocked notes at chapter end summary | Missing thought bubbles bypass unlock | `google-doc-spec-v1.md` § B3 |
| 6 | Track B | Stuck Hint System | Two-tier guidance for idle players: Tier 1 (vague) at 60s, Tier 2 (explicit) at 120s | Idle timer per objective | Self-talk dialogue prompts | Reset timer on any valid interaction | `google-doc-spec-v1.md` § G4, B2 |
| 7 | Track C | Victorian Picture-Book Art Style | 3-tone toon shading, #2B2420 ink outlines, 15% paper grain, warm palette; Disney blue dress prohibited | 3D models & textures | Victorian storybook render pipeline | High contrast/unapproved colors flagged | `google-doc-spec-v1.md` § C0, G9 |
| 8 | Track C | Alice Character Design | 7yo Victorian girl, wheat-yellow dress #E9C46A, white pinafore #F7F3EA, navy ribbon #2E3F6E, head-body 1:4.5 | Multi-view concept prompts | Canonical mesh & textures | Disney style (blue dress/black band) rejected | `google-doc-spec-v1.md` § C0, C2 |
| 9 | Track C | White Rabbit Character Design | Upright gentleman rabbit, warm-white fur #F4F1EC, pink eyes #E88FA3, checked coat, mustard waistcoat #C9A24A, gold watch | Concept prompts | Mesh & animation rigs | Rabbit without waistcoat rejected | `google-doc-spec-v1.md` § C0, C3 |
| 10 | Track H | 12 HTML/CSS UI Components | Title, Loading, Subtitle, InteractPrompt, Objective, Inventory (6 slots), Inspect, Pause, Settings, ChapterCard, EndCard, Unsupported | Player input & game events | Responsive UI overlays (1920x1080 & 390x844) | Unsupported WebGPU/WebGL2 triggers fallback screen | `google-doc-spec-v1.md` § H1–H3 |
| 11 | Track H | Typography & Font Subsetting | SIL OFL fonts: Noto Serif SC, LXGW WenKai, IM Fell English, Zen Old Mincho; subsetting via pyftsubset | Subtitle & UI strings | WOFF2 font bundles < 1.5MB total | Missing glyphs in subset cause box glyphs | `google-doc-spec-v1.md` § H1, H3 |
| 12 | Track I | Music Tracks M1–M7 | 7 thematic compositions (Title 90s, Bank 120s, Chase 45s, Fall 95s, Hall 120s, Garden 8s, End 60s) | Scene transitions | Web Audio BGM playback with 2s crossfade | Autoplay blocked until initial user click | `google-doc-spec-v1.md` § I1, G11 |
| 13 | Track I | Dialogue Music Ducking | Automatic attenuation of BGM by -6 dB during spoken dialogue lines | Dialogue line start/stop | Smooth gain reduction and return (0.5s) | Gain clipped to 0 dB max | `google-doc-spec-v1.md` § G11 |
| 14 | Track I | 30 Sound Effects (SFX-01 to SFX-30) | Footsteps (4 surfaces), props, doors, water, wind, chimes, nibbles, sips, shrink whistle | Animation and physics events | AudioBuffer / Web Audio synth instances | Missing sound file triggers procedural synth fallback | `google-doc-spec-v1.md` § I2, G11 |
| 15 | Track I | Procedural Web Audio Synthesis | Built-in mathematical oscillators & noise filters for all music and SFX to ensure zero missing asset errors | Audio event triggers | Synthesized real-time audio | Zero external network failure | `ORIGINAL_REQUEST.md` R3, `spec-v1` G11 |
| 16 | Track I | SizeSystem Audio Modulation | Footstep & character audio pitch shifted by 1.6x when small (0.254m); ambient audio low-pass filtered | Alice size state | Real-time Web Audio pitch & filter change | Scale mismatch prevented by size state machine | `google-doc-spec-v1.md` § G7, G11 |
| 17 | Track I | 3D Spatial Positional Audio | PositionalAudio nodes for White Rabbit footsteps/watch, river water, hanging lamps, little door garden | 3D object world coordinates | Panned & distance-attenuated 3D audio | AudioListener not attached logs warning | `google-doc-spec-v1.md` § G11 |
| 18 | Cutscenes | Cutscene Engine (C1–C8) | JSON timeline cutscenes in `public/assets/cutscenes/ch1/`: camera, anim, line, sfx, fade, letterbox | Trigger zones / interaction | Cinematic camera & actor animation sequence | Skipping guarantees exact same post-state flags | `google-doc-spec-v1.md` § G10 |
| 19 | Cutscenes | Cutscene Skip Mechanism | Holding Esc or clicking on-screen skip button for 1.0s fast-forwards cutscene | User hold input (1s) | State flags and actor positions instantly updated | Skipping cannot leave player in locked state | `google-doc-spec-v1.md` § G10 |
| 20 | Track K1 | Development & Prompt Logging | Comprehensive archiving of prompts in `docs/prompts/`, 4 asset stages, devlogs, `stats.json` | Development workflow steps | Documentation markdown & JSON records | Missing documentation violates delivery criteria | `google-doc-spec-v1.md` § K1, K2 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | B1 / G4 Curtain Interaction | Player approaches curtain before trying key on doors ≥ 2 times | Curtain is non-interactive; no prompt is displayed; player cannot pull curtain aside early. |
| 2 | B1 / G8 Key Auto-Return | Player picks up "DRINK ME" bottle while holding gold key | Gold key is automatically and quietly placed back onto the glass table with a subtle clink (`sfx_key_down`); no prompt is displayed. |
| 3 | B1 / G8 Little Door Lock | Alice shrinks to 0.254m, approaches little door | Door has shut and locked automatically after garden peek; Alice cannot enter; triggers dialogue reminding player key is on table. |
| 4 | B1 / G8 Table Leg Climb | Alice attempts to climb glass table leg when small | Alice slides down (`sfx_slip`); 1st attempt gives thought "Too slippery…"; 2nd attempt triggers Cutscene C7 (sitting, crying, discovering glass box). |
| 5 | B1 / G6 Fall Without Jar | Player completes S3 fall without picking up marmalade jar | Scene completes smoothly at 88s; Alice lands on leaves; missed jar does not block progression. |
| 6 | B1 / G6 Jar Drop Attempt | Player presses drop button while holding marmalade jar in mid-air | Jar is not dropped; thought line triggers: "I mustn't drop it. I might kill somebody underneath!". |
| 7 | B1 / G6 Missed Thought Bubbles | Player misses thought bubbles during fall | Missed thought bubbles re-spawn within 10 seconds; any uncollected thoughts simply remain uncollected on Chapter End Card. |
| 8 | B1 / G6 Mid-air Curtsey Easter Egg | Player presses `C` key during S3 Thought 4 ("Antipathies") | Alice performs mid-air curtsey animation (`Alice_CurtseyAir`); narrator dialogue triggers; easter egg flag set to true. |
| 9 | G5 Localization Switch | Player changes language during mid-sentence typewriter subtitle playback | Subtitle instantly switches language and resumes typing current line in new language; resets typewriter cursor. |
| 10 | G10 Cutscene Skip | Player skips Cutscene C6 (shrinking) at 0.1s | Cutscene immediately terminates, Alice scale set to 0.212, size set to `small`, camera parameters set to small profile, flags updated. |
| 11 | G11 Audio Autoplay Policy | Game loads in browser before user interaction | AudioContext remains in suspended state; unlocked immediately upon clicking "点击 · 开始旅程" / "Start Journey". Zero console errors. |
| 12 | G4 Bottle Label Inspection | Player inspects bottle but does not rotate to back label | "Drink" action button remains disabled; button only enables once both front ("DRINK ME") and back (no poison mark) are inspected. |

---

## Part 1: Track A — Project Bible & Engineering Rules

### 1.1 Project Identity & Core Pillars
- **Game Title**: *爱丽丝梦游仙境* / *Alice's Adventures in Wonderland* (Working Title: *Alice: Down the Rabbit-Hole*).
- **Core Narrative Source**: Lewis Carroll, *Alice's Adventures in Wonderland* (1865), Public Domain. Original John Tenniel illustrations (1865).
- **Strict Prohibition**: No elements, character designs, naming, or color palettes from film/game adaptations (Disney 1951, Tim Burton 2010, American McGee). Specifically: **No light blue dress with black hairband**.
- **Visual Aesthetic**: "A Moving Victorian Picture-Book" — Warm paper texture overlay (15%), #2B2420 ink outlines, soft 3-tone toon shading, rounded shapes, slightly exaggerated proportions.
- **Tone & Atmosphere**: Gentle, curious, Victorian whimsy; no character death or failure states; gentle internal monologues guide the player if stuck.

### 1.2 Metric Dimensional Constants (Standardized Across All Tracks)
| Element | Metric Measurement | Canonical Reference / Rationale |
|---|---|---|
| Alice Normal Height | `1.20 m` | Carroll: Alice is a 7-year-old girl; standard 7yo height |
| Alice Small Height | `0.254 m` (scale `0.212`) | Carroll: "only ten inches high" (10 inches = 25.4 cm) |
| Little Door | Height `0.381 m`, Width `0.24 m` | Carroll: "about fifteen inches high" (15 inches = 38.1 cm) |
| Little Passage | W `0.24 m`, H `0.33 m`, L `1.20 m` | Fits Alice once shrunk to ~1 foot in Chapter 7 |
| Solid Glass Three-Legged Table | Height `0.72 m`, Diameter `0.50 m` | Small Alice (0.254m) cannot reach table top (2.8x her height) |
| Tiny Golden Key | Length `0.05 m` | Fits locks on little door |
| Long Hall | L `24.0 m`, W `7.0 m`, H `2.85 m` | Carroll: "long, low hall"; Alice bumps head when 9ft in Ch 2 |
| Hall Main Doors (10 doors) | Width `1.0 m`, Height `2.2 m` | Victorian interior panel doors |
| Rabbit-Hole Burrow | Diameter `0.80 m` | Burrow opening under hedge |
| Well Vertical Shaft | Inner Diameter `4.0 m` | Falling well cylinder |
| White Rabbit | Height `0.75 m` (including ears) | ~2/3 of Alice's normal standing height |

### 1.3 Engineering Rules (G0 & Bible Integration)
1. **Engine**: Three.js with `WebGPURenderer` (TSL), automated fallback to `WebGL2`, query param `?forceWebGL=1`.
2. **Coordinate Space**: 1 Three.js unit = 1.0 meter, +Y is UP, +Z is forward/out.
3. **Logic Markers (Blender Empty Prefixes)**:
   - `SPAWN_`: Player and character spawn locations
   - `TRG_`: Volume triggers (box or sphere)
   - `INT_`: Interactive target anchors
   - `CAM_`: Cinematic camera shot positions
   - `PATH_`: Movement / tracking curves
   - `COL_`: Physics collider geometries
   - `SOCKET_`: Attachment points (hands, pockets)
   - `SLOT_`: Procedural placement slots (bookshelves, cupboards)
   - `VISTA_ANCHOR`: Visual anchor for Garden vista

---

## Part 2: Track B — Narrative Beats, Verbatim B1 Dialogue Lines & Localization

### 2.1 Complete S0–S7 Gameplay Narrative Flow
1. **S0 Title & Prologue**: Key art background, language selection, "Start Journey" button (unlocks Web Audio), Chapter Card "Chapter I. Down the Rabbit-Hole" with paper page-turn transition into S1.
2. **S1 Riverbank Afternoon (12–15 min overall chapter)**:
   - Alice spawns under oak tree near Sister. Camera introduces scene with gentle sleepy sway.
   - Interactive: Sister's picture-less book (`INT_sister_book`), 3 highlighted English daisies (`INT_daisy_1..3`).
   - Rabbit event: Triggered upon picking 2nd daisy or 45 seconds of elapsed time. White Rabbit scurries from west, stops 4m away, pulls out watch, speaks line, scurries east (Cutscene C1).
   - Objective: "Follow the White Rabbit".
3. **S2 The Chase**:
   - White Rabbit stays 8–10m ahead. Rabbit matches player speed; turns to glance if player halts.
   - 35m dash across meadow to hedge. Rabbit dives into burrow.
   - Alice interacts with `INT_rabbit_hole` to jump down (Cutscene C2).
4. **S3 Down the Rabbit-Hole (90-second Fall)**:
   - Alice falls slowly (2.2 m/s descent speed simulated via floating origin; well moves upward).
   - Horizontal movement allowed within 1.4m cylinder radius.
   - Jar Mission (t=15s): Shelf with highlighted orange marmalade jar. Alice takes it; discovers it is empty. Player cannot drop it. Placed into an open cupboard (t=25s to 65s).
   - 5 Glowing Thought Bubbles (t=10s, 30s, 45s, 58s, 70s): Touching triggers Carroll stream-of-consciousness monologues.
   - Easter Egg: Pressing `C` during Thought 4 ("Antipathies") executes mid-air curtsey with special narration.
   - t=75s: Dozing off; lighting softens; translucent silhouette of cat Dinah appears; "Do bats eat cats?".
   - t=88s: Blackout, "thump! thump!" sound and on-screen text; lands safely on leaves (Cutscene C3).
5. **S4 The Long Corridor**:
   - Alice jumps up without injury. Spots White Rabbit scurrying ahead down 24m passage.
   - Rabbit rounds the corner with hurried dialogue and vanishes.
   - Alice turns corner, finds empty passage, seamless transition into Long Hall (Cutscene C4).
6. **S5 The Long Hall & Locked Doors**:
   - Camera sweeps along suspended oil lamps, showing low ceiling and 10 large doors.
   - All 10 doors locked. Trying 4 doors triggers Alice's despair dialogue ("How am I ever to get out again?").
   - Center glass table holds tiny golden key. Alice picks up key.
   - Trying key on big doors fails ("Either locks too large or key too small").
   - Trying key on ≥ 2 doors uncovers interactive curtain on north-east wall.
   - Drawing curtain reveals 15-inch little door. Golden key unlocks it.
   - Alice kneels, peeking through 1.2m tunnel into radiant Garden Vista (Cutscene C5, 4s hold).
   - Alice rises; door automatically swings shut and locks.
7. **S6 "DRINK ME" & Shrinking**:
   - Small bottle appears on glass table. Picking up bottle automatically places golden key back on table with a soft clink.
   - Inspecting bottle requires rotating 360° to verify label front and back ("not marked 'poison'").
   - Alice drinks. Shrinks over 2.5s to 10 inches (Cutscene C6).
   - Alice rushes to little door, discovers it is locked and key was left on top of glass table!
   - Alice attempts to climb slippery glass table leg twice, sliding down both times.
   - Alice sits and cries, gives herself a firm talking to, notices glimmering glass box under table (Cutscene C7).
8. **S7 "EAT ME" Cake & Chapter Finale**:
   - Alice opens glass box under table, finds tiny currant-marked cake "EAT ME".
   - Alice decides to eat it regardless of outcome. Takes a bite, holds hand to head ("Which way?").
   - Size does not change. Alice finishes cake. Screen fades out (Cutscene C8).
   - Chapter End Card: Stats summary, next chapter preview ("The Pool of Tears"), "Curiouser and curiouser!".

---

### 2.2 Complete B1 Dialogue Lines (English Verbatim Preserved)

The following table documents every line from the specification, retaining the 1865 English text verbatim, Chinese localized text (strictly ≤ 28 characters per subtitle line), speaker, dialogue type, and duration:

| Trigger ID | Scene | Speaker | Type | English Text (1865 Verbatim / Note) | Chinese Text (≤ 28 chars) | Dur (s) | Note |
|---|---|---|---|---|---|---|---|
| `S0_TITLE_NARR_1` | S0 | narrator | narr | Alice was beginning to get very tired of sitting by her sister on the bank, | 那天下午很热。爱丽丝挨着姐姐坐在河岸上， | 3.5 | Verbatim 1865 |
| `S0_TITLE_NARR_2` | S0 | narrator | narr | and of having nothing to do. | 什么事也没有，开始觉得没意思了。 | 2.5 | Verbatim 1865 |
| `S1_PEEK_BOOK` | S1 | alice | think | "and what is the use of a book," thought Alice "without pictures or conversations?" | 一本书，又没有图画，又没有对话，有什么用呢？ | 3.0 | Verbatim 1865 |
| `S1_IDLE` | S1 | alice | think | Would the pleasure of making a daisy-chain be worth the trouble of getting up and picking the daisies? | 编个雏菊花环吧……可是值得为这个站起来去摘花吗？ | 3.5 | Adapted 1865 |
| `S1_RABBIT_RUN` | S1 | rabbit | say | "Oh dear! Oh dear! I shall be late!" | 天哪！天哪！我要迟到了！ | 2.0 | Verbatim 1865 |
| `S1_RABBIT_WATCH` | S1 | alice | think | A rabbit with a waistcoat-pocket, and a watch to take out of it! | 兔子穿着背心，还从口袋里掏出一块表？ | 2.8 | Adapted 1865 |
| `S1_OBJECTIVE` | S1 | system | ui | Follow the White Rabbit | 跟上白兔 | 3.0 | System UI |
| `S2_JUMP` | S2 | narrator | narr | In another moment down went Alice after it, never once considering how in the world she was to get out again. | 她一下子就跟着钻了进去，压根没想过待会儿要怎么出来。 | 4.0 | Verbatim 1865 |
| `S3_START` | S3 | narrator | narr | Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her. | 要么是井太深，要么是她掉得太慢，反正她有的是时间东张西望。 | 4.5 | Verbatim 1865 |
| `S3_JAR_PICK` | S3 | alice | think | "ORANGE MARMALADE"… empty! | “橘子酱”！……空的。 | 2.0 | New |
| `S3_JAR_DROP_TRY` | S3 | alice | think | I mustn't drop it. I might kill somebody underneath! | 不能扔，砸到下面的人怎么办。 | 2.5 | Adapted 1865 |
| `S3_JAR_STORED` | S3 | alice | think | There! | 好啦，就放这儿。 | 1.5 | New |
| `S3_THOUGHT_1` | S3 | alice | think | "after such a fall as this, I shall think nothing of tumbling down stairs!" | 摔过这么一跤，以后滚下楼梯我都不当回事了！ | 3.2 | Verbatim 1865 |
| `S3_THOUGHT_2` | S3 | alice | say | "I wonder how many miles I've fallen by this time? I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—" | 我掉了多少英里了？快到地心了吧，大概四千英里？ | 4.2 | Verbatim 1865 |
| `S3_THOUGHT_3` | S3 | alice | say | "but then I wonder what Latitude or Longitude I've got to?" | 那现在到了什么纬度、什么经度呢？ | 2.5 | Verbatim 1865 |
| `S3_THOUGHT_4` | S3 | alice | say | "I wonder if I shall fall right through the earth! How funny it'll seem to come out among the people that walk with their heads downward! The Antipathies, I think—" | 会不会一直掉穿地球，掉到头朝下走路的“对头人”那边去？ | 4.5 | Verbatim 1865 (Antipathies pun) |
| `S3_CURTSEY` | S3 | narrator | narr | (she tried to curtsey as she spoke—fancy curtseying as you're falling through the air!) | 她一边说一边试着行屈膝礼。在半空中行礼，你想想看！ | 3.5 | Verbatim 1865 |
| `S3_THOUGHT_5` | S3 | alice | say | "Dinah'll miss me very much to-night, I should think! … Do cats eat bats? Do cats eat bats?" | 黛娜今晚肯定会想我的！猫吃蝙蝠吗？猫吃蝙蝠吗？ | 3.8 | Verbatim 1865 |
| `S3_DOZE` | S3 | alice | say | "Do bats eat cats?" | ……蝙蝠吃猫吗？ | 2.0 | Verbatim 1865 (Dreaming) |
| `S3_LAND` | S3 | narrator | narr | thump! thump! … and the fall was over. | 砰！砰！坠落结束了。 | 2.0 | Verbatim 1865 |
| `S4_UP` | S4 | alice | think | Not a bit hurt! | 一点都没摔疼！ | 1.8 | Adapted 1865 |
| `S4_CORNER` | S4 | rabbit | say | "Oh my ears and whiskers, how late it's getting!" | 哎哟，我的耳朵和胡子啊，都这么晚了！ | 2.8 | Verbatim 1865 |
| `S4_GONE` | S4 | alice | think | Where has it gone? | 咦？兔子呢？ | 1.8 | New |
| `S5_ENTER` | S5 | narrator | narr | she found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof. | 她站在一间又长又矮的大厅里，屋顶垂下一排灯，把大厅照亮。 | 4.5 | Verbatim 1865 |
| `S5_DOOR_LOCKED` | S5 | alice | think | Locked. | 锁着。 | 1.5 | New |
| `S5_DOOR_REPEAT_1` | S5 | alice | think | This one too. | 这扇也锁着。 | 1.5 | New variant 1 |
| `S5_DOOR_REPEAT_2` | S5 | alice | think | Still locked tight. | 还是锁着的。 | 1.5 | New variant 2 |
| `S5_DOOR_REPEAT_3` | S5 | alice | think | Won't budge either. | 这扇也打不开。 | 1.5 | New variant 3 |
| `S5_DOORS_ALL` | S5 | alice | think | How am I ever to get out again? | 这么多门，一扇都打不开，我还怎么出去？ | 3.2 | Adapted 1865 |
| `S5_TABLE` | S5 | alice | think | A little three-legged table, all made of solid glass… and a tiny golden key! | 一张全是玻璃做的小桌子……上面有把小金钥匙！ | 3.5 | Adapted 1865 |
| `S5_KEY_FAIL` | S5 | alice | think | Either the locks are too large, or the key is too small. | 要么是锁太大，要么是钥匙太小。 | 3.0 | Adapted 1865 |
| `S5_CURTAIN_FOUND` | S5 | alice | think | A low curtain! I hadn't noticed that before. | 这儿有道矮帘子，刚才怎么没看见？ | 2.8 | Adapted 1865 |
| `S5_LITTLE_DOOR` | S5 | alice | think | A little door, about fifteen inches high! | 一扇小门，才十五英寸高！ | 2.5 | Adapted 1865 |
| `S5_UNLOCK` | S5 | alice | think | It fits! | 正好合适！ | 1.5 | Adapted 1865 |
| `S5_PEEK` | S5 | narrator | narr | she knelt down and looked along the passage into the loveliest garden you ever saw. | 她跪下来顺着通道望出去，那是你见过的最美的花园。 | 4.0 | Verbatim 1865 |
| `S5_PEEK_END_1` | S5 | alice | think | "and even if my head would go through, it would be of very little use without my shoulders. | 就算头能钻过去，没有肩膀也没用啊。 | 3.0 | Verbatim 1865 |
| `S5_PEEK_END_2` | S5 | alice | think | Oh, how I wish I could shut up like a telescope!" | 真希望我能像望远镜那样缩起来！ | 2.5 | Verbatim 1865 |
| `S6_BOTTLE_APPEAR` | S6 | alice | say | "which certainly was not here before," | 刚才这儿明明没有的。 | 2.0 | Verbatim 1865 |
| `S6_INSPECT` | S6 | alice | say | "No, I'll look first," she said, "and see whether it's marked 'poison' or not" | “喝我”……不急，先看看有没有写“毒药”。 | 3.2 | Verbatim 1865 |
| `S6_NOT_POISON` | S6 | alice | think | It isn't marked "poison". | 没写“毒药”。那就尝一点。 | 2.0 | New |
| `S6_DRINK_1` | S6 | narrator | narr | it had, in fact, a sort of mixed flavour of cherry-tart, custard, pine-apple, roast turkey, toffee, and hot buttered toast, | 味道很好，像樱桃馅饼、奶油蛋羹、菠萝、烤火鸡、太妃糖和热黄油吐司。 | 4.5 | Verbatim 1865 |
| `S6_DRINK_2` | S6 | narrator | narr | … she very soon finished it off. | 她很快就喝光了。 | 2.0 | Verbatim 1865 |
| `S6_SHRINK` | S6 | alice | say | "What a curious feeling!" said Alice; "I must be shutting up like a telescope." | 好奇怪的感觉！我一定是像望远镜那样缩起来了。 | 3.5 | Verbatim 1865 |
| `S6_WAIT` | S6 | alice | think | "for it might end, you know, in my going out altogether, like a candle." | 会不会一直缩下去，最后像蜡烛一样灭掉？ | 3.2 | Verbatim 1865 |
| `S6_KEY_FORGOTTEN` | S6 | alice | think | The key! I've left it on the table! | 钥匙！我把钥匙忘在桌上了！ | 2.2 | New |
| `S6_CLIMB_FAIL` | S6 | alice | think | Too slippery… | 太滑了…… | 1.5 | Adapted 1865 |
| `S6_CRY_END` | S6 | alice | say | "Come, there's no use in crying like that! I advise you to leave off this minute!" | 好啦，这么哭有什么用！我劝你马上停下来！ | 3.5 | Verbatim 1865 |
| `S7_BOX_OPEN` | S7 | narrator | narr | a very small cake, on which the words "EAT ME" were beautifully marked in currants. | 盒子里有一块很小的蛋糕，上面用葡萄干拼着“吃我”。 | 3.5 | Verbatim 1865 |
| `S7_DECIDE_1` | S7 | alice | say | "Well, I'll eat it, and if it makes me grow larger, I can reach the key; | 好，我吃。要是变大，我就够得着钥匙； | 3.0 | Verbatim 1865 |
| `S7_DECIDE_2` | S7 | alice | say | and if it makes me grow smaller, I can creep under the door; so either way I'll get into the garden, and I don't care which happens!" | 要是变小，我就从门底钻过去。变成哪样我都不在乎！ | 4.0 | Verbatim 1865 |
| `S7_EAT` | S7 | alice | say | "Which way? Which way?" | 往哪边？往哪边？ | 2.0 | Verbatim 1865 |
| `S7_END` | S7 | narrator | narr | she remained the same size … So she set to work, and very soon finished off the cake. | 什么也没发生。于是她干脆动手，很快就把蛋糕吃光了。 | 3.8 | Verbatim 1865 |
| `S7_PREVIEW_NARR` | S7 | narrator | narr | Next: The Pool of Tears | 下一章：眼泪池 | 2.0 | End teaser |
| `S7_PREVIEW_ALICE` | S7 | alice | say | "Curiouser and curiouser!" | 越来越奇怪了！ | 2.0 | Verbatim 1865 |

### 2.3 Required In-Game Stuck Hints
Every scene features two tiers of idle hints (Tier 1: 60s idle, Tier 2: 120s idle):
- **S1 (Riverbank)**:
  - 60s: "姐姐看得好入神啊……河边的花开得真好看。" / "Sister is so absorbed in her book... the flowers by the bank are lovely."
  - 120s: "去摘两朵雏菊做花环吧！" / "I should pick a couple of daisies to make a daisy chain!"
- **S2 (Chase)**:
  - 60s: "兔子跑进树篱那边了……" / "The rabbit ran towards that hedge..."
  - 120s: "快跟过去，钻进那个大兔子洞！" / "Quick, follow it right into that big rabbit-hole!"
- **S3 (Well Fall)**:
  - 60s: "井壁上有好多橱柜呢……" / "There are so many cupboards along the well..."
  - 120s: "把空罐子稳稳放进路过的橱柜里吧。" / "Put the empty marmalade jar safely inside an open cupboard."
- **S5 (Long Hall)**:
  - 60s: "四周都是门，大厅中间似乎有张桌子？" / "All these doors... isn't that a glass table in the center?"
  - 120s: "拿起金钥匙去试门，找不到出路就仔细看看墙角帘子后面。" / "Try the gold key on the doors, and look carefully behind the low curtain."
- **S6 (Small Alice)**:
  - 60s: "钥匙还在玻璃桌上……该怎么上去呢？" / "The key is still up on the glass table... how do I get up there?"
  - 120s: "试着爬爬桌腿吧，虽然它看起来很滑。" / "Try climbing the table leg, even if it looks very slippery."
- **S7 (Cake)**:
  - 60s: "桌子底下好像有什么东西在发光……" / "Something seems to be glimmering under the table..."
  - 120s: "打开桌下的玻璃盒子，尝尝里面的小蛋糕。" / "Open the glass box under the table and eat the little cake inside."

### 2.4 Trilingual Translation & Formatting Rules
1. **English (`en`)**: Strictly preserves the 1865 Project Gutenberg edition wording. Lines added for game mechanics are marked `new` or `adapted`.
2. **Chinese (`zh`)**: Independent, colloquial, witty translation reflecting a 7-year-old Victorian girl. No copied translations from copyrighted modern editions. **Strict length constraint: ≤ 28 Chinese characters per subtitle entry** (verified via Zod schema test).
3. **Japanese (`ja`)**: Interface reserved. Initial release holds empty strings `""`, automatically falling back to English strings at runtime.
4. **Dialogue Types**: `say` (spoken with nameplate), `think` (italicized/script monologue without nameplate), `narr` (narrator, centered, borderless), `sfx` (comic-style on-screen sound popups), `ui` (system notifications/objectives).

### 2.5 Curiosity Notes Specifications (B3)
Five collectible notes corresponding to S3 thought bubbles:
1. `ch1_note_1` (Matching `S3_THOUGHT_1` — Tumbling Down Stairs):
   - *Theme*: The Origin of Wonderland & Alice's Courage.
   - *ZH*: 1862年7月4日的金色午后，卡罗尔在泰晤士河划船出游时为小爱丽丝口述了这个故事。面对未知坠落，爱丽丝的勇敢自嘲展现了维多利亚少女独特的独立个性。
   - *EN*: On July 4, 1862, Lewis Carroll first told Alice's story during a Thames rowing trip. Alice's spirited reaction to falling reveals her plucky, independent Victorian character.
   - *Source*: British Library Manuscript (Add MS 46700).
2. `ch1_note_2` (Matching `S3_THOUGHT_2` — 4,000 Miles to Earth's Center):
   - *Theme*: Carroll the Oxford Mathematician.
   - *ZH*: 卡罗尔是牛津大学基督教堂学院的数学讲师。地球的平均半径约为3959英里，爱丽丝随口猜测的“四千英里”其实非常符合科学事实！
   - *EN*: As an Oxford mathematics lecturer, Carroll knew Earth's radius was roughly 3,959 miles. Alice's guess of "four thousand miles down" is remarkably accurate!
   - *Source*: NASA Earth Fact Sheet & Oxford Archives.
3. `ch1_note_3` (Matching `S3_THOUGHT_3` — Latitude & Longitude):
   - *Theme*: Victorian Grand Words & Education.
   - *ZH*: 爱丽丝虽然不知道经纬度的具体含义，但觉得它们是“了不起的字眼”。这生动讽刺了维多利亚时代儿童死记硬背枯燥学问的教育现实。
   - *EN*: Alice loved high-sounding grand words without knowing what they meant, gently satirizing the rote memorization common in Victorian girls' education.
   - *Source*: Martin Gardner, *The Annotated Alice*.
4. `ch1_note_4` (Matching `S3_THOUGHT_4` — Antipathies vs. Antipodes):
   - *Theme*: Carroll's Linguistic Malapropism.
   - *ZH*: 爱丽丝把“对跖地”（Antipodes，地球对面脚对脚的人）口误说成了“反感”（Antipathies）。中文巧妙地译为把“对跖人”叫成“对头人”。
   - *EN*: Alice's famous malapropism confuses "Antipodes" (the other side of the earth) with "Antipathies" (hostility), creating a brilliant Carrollian pun.
   - *Source*: Oxford English Dictionary & *The Annotated Alice*.
5. `ch1_note_5` (Matching `S3_THOUGHT_5` — Dinah & Bats):
   - *Theme*: The Real Dinah at Christ Church.
   - *ZH*: 黛娜不仅是小说中的角色，更是真实原型爱丽丝·利德尔在牛津院长官邸饲养的深色花斑猫。半梦半醒间的胡思乱想体现了经典的意识流手法。
   - *EN*: Dinah was the real tabby cat belonging to Alice Liddell at Christ Church, Oxford. Her sleepy musings capture a classic child's stream of consciousness.
   - *Source*: Christ Church Oxford Archives.

---

## Part 3: Track C — Character & World Lore, Visual References & Concept Prompts

### 3.1 Color Palette & Visual Constraints
- **Primary Ink Outline**: `#2B2420` (Variable width based on depth).
- **Paper Background Texture**: `#F3E9D2` (15% screen-space overlay).
- **Scene-Specific Palettes**:
  - *Riverbank (S1)*: Grass green `#7FA35B`, Cream `#F3E9D2`, Sky blue `#A9C8E8`, Water blue `#6F9FB8`, Sunlight gold `#F2C46D`, Daisy white `#FFFDF5`.
  - *Rabbit Hole & Well (S2–S3)*: Earth brown `#5A3E2B`, Old wood `#8A6142`, Candle amber `#E8A54B`, Abyssal shadow `#1E1A24`.
  - *Long Hall (S4–S5)*: Cool blue-grey `#4B5A6E`, Stone wall `#6E6A66`, Dark wood floor `#4A3528`, Warm lamp yellow `#F5C26B`, Glass cyan `#BFE6EA`, Gold key `#D4A93A`, Velvet curtain wine-red `#7A2E3A`.
  - *Garden Vista (S5)*: Emerald green `#3FA36B`, Fountain blue `#8EC9F0`, Rose pink `#E0607E`, Sunlight yellow `#FFE6A0` (Highest saturation area in Chapter 1).
- **Alice Costume Palette**:
  - Dress: Wheat-yellow `#E9C46A`.
  - Pinafore apron: White `#F7F3EA`.
  - Hair ribbon: Navy blue `#2E3F6E`.
  - Hair: Light golden blonde `#E6C98F`.
  - Stockings: White `#FFFFFF`.
  - Shoes: Black Mary Jane strap shoes.
- **White Rabbit Palette**:
  - Fur: Warm white `#F4F1EC`.
  - Eyes: Soft pink `#E88FA3`.
  - Jacket: Brown & cream check `#9B5B3A` and `#E2C9A0`.
  - Waistcoat: Mustard yellow `#C9A24A`.
  - Watch: Polished brass/gold with chain.

---

## Part 4: Track H & UI Specifications

### 4.1 UI Architecture (12 Components)
1. `Title`: Full-screen key art background, Title banner, Language selector (中 / EN), "Click · Start Journey" button (audio unlock), "Continue" button (if save exists), opening quote.
2. `Loading`: "Preparing visuals · xx%" parchment progress bar with book-plate vignette.
3. `Subtitle`: Deckle-edged parchment paper strip, `#2B2420` ink text, speaker badge for `say`, script font for `think`, typewriter effect (zh: 30 chars/s, en: 45 chars/s), live language toggle.
4. `InteractPrompt`: Context-sensitive screen-space prompt `[E] Action / 动作`, displays within 1.2m (normal) / 0.3m (small), 100° front cone.
5. `Objective`: Sliding notification ribbon with current gameplay goal.
6. `Inventory`: 6-slot parchment grid (Tab key or mobile button), item icon, title, description, and "Use" action.
7. `Inspect`: Full-screen 3D inspect modal with trackball rotation. Used for DRINK ME bottle (requires front & back check) and EAT ME cake.
8. `Pause`: Esc modal with Resume, Settings, and Return to Title.
9. `Settings`: Language toggle, 4 audio sliders (Master, Music, SFX, VO), Subtitle size toggle (Small, Medium, Large), Camera Sensitivity, Invert Y, Reduce Motion, Graphics Preset (High, Med, Low), FPS toggle.
10. `ChapterCard`: Full-screen book cover opening animation: "Chapter I. Down the Rabbit-Hole / 第一章 掉进兔子洞".
11. `EndCard`: Chapter 1 summary: Collectibles (Thoughts n/5, Curtsey easter egg), Chapter 2 preview banner, Return to Title button.
12. `Unsupported`: Clean fallback screen for devices without WebGPU or WebGL2, with link to Electron desktop build.

### 4.2 Typography & Font Subsetting
- **Chinese Body Text**: Noto Serif SC / 思源宋体 (SIL Open Font License).
- **Chinese Monologue / Thoughts**: LXGW WenKai / 霞鹜文楷 (SIL Open Font License).
- **English Dialogue & Props**: IM Fell English (SIL Open Font License).
- **Japanese (Reserved)**: Zen Old Mincho (SIL Open Font License).
- **Subsetting Requirement**: `tools/subset-fonts.mjs` scans all i18n JSONs and UI strings, executing `fonttools pyftsubset` to create minimal WOFF2 bundles (< 1.5MB total).

---

## Part 5: Track I — Complete Audio Design Specifications

### 5.1 Music Specifications (M1 to M7)
| ID | Track Title | Placement | Length & Loop | Tempo & Key | Instrumentation & Style |
|---|---|---|---|---|---|
| **M1** | Title Waltz | Title Screen & Menus | 90s, Seamless loop | 80 BPM, D Major, 3/4 time | Gentle Victorian music box & celesta waltz, soft pizzicato string quartet underneath; warm, nostalgic, mysterious. |
| **M2** | Riverbank Afternoon | Scene 1 (S1 Riverbank) | 120s, Seamless loop | 70 BPM, F Major | Solo clarinet & harp arpeggios over soft sustained strings; sleepy, sunny, warm English afternoon. |
| **M3** | The Hurried Chase | Scene 2 (S2 Chase) & S4 Passage | 45s, Seamless loop | 140 BPM, 2/4 time | Playful hurried chase, pizzicato strings, staccato bassoon and flute, ticking woodblock like a pocket watch; comic and curious. |
| **M4** | Dreamy Descent | Scene 3 (S3 Well Fall) | 95s, One-shot (3s fade out) | 60 BPM | Slow dreamy descent, celesta, glass harmonica, airy strings, gentle reversed piano swells; floating, weightless, sleepier over time. |
| **M5** | The Dim Hall | Scene 5 (S5 Hall, S6, S7) | 120s, Seamless loop | 72 BPM, A Minor, 3/4 waltz | Quiet puzzle music for long dim hall, solo cello & muted strings, slow music-box waltz motif; curious and a little lonely. |
| **M6** | Garden Vista Stinger | Cutscene C5 (Peeking into Garden) | 8s, One-shot stinger | Bright tempo, G Major | Radiant short stinger: harp glissando into bright high strings and soft wordless choir; sunlight and wonder. |
| **M7** | Curious Finale | Cutscene C8 & Chapter End Card | 60s, One-shot | Whimsical tempo | Music-box waltz theme returns with full chamber ensemble, whimsical and hopeful, ending on an unresolved, questioning chord. |

### 5.2 Complete 30 Sound Effects (SFX-01 to SFX-30)
| ID | Name | Variants | Loop | Duration | Trigger Event / Mechanics |
|---|---|---|---|---|---|
| **SFX-01** | `sfx_step_grass` | 6 | No | 0.25s | Footstep on grass (S1, S2). Random pitch ±5%. Small Alice pitch 1.6x. |
| **SFX-02** | `sfx_step_wood` | 6 | No | 0.25s | Footstep on wooden floorboards (S5, S6, S7). Random pitch ±5%. |
| **SFX-03** | `sfx_step_stone` | 6 | No | 0.25s | Footstep on stone floors. Random pitch ±5%. |
| **SFX-04** | `sfx_step_leaves` | 6 | No | 0.3s | Footstep on heap of dry autumn leaves (S4). |
| **SFX-05** | `sfx_daisy_pick` | 2 | No | 0.5s | Picking daisy in S1 (`INT_daisy_1..3`). Soft pluck and rustle. |
| **SFX-06** | `sfx_watch_open` | 1 | No | 0.4s | Pocket watch lid clicking open during Rabbit animation. |
| **SFX-07** | `sfx_watch_tick` | 1 | Yes | 2.0s | Pocket watch steady ticking. 3D PositionalAudio attached to Rabbit. |
| **SFX-08** | `sfx_rabbit_scurry` | 2 | No | 1.5s | White Rabbit rapid scurry steps on grass. |
| **SFX-09** | `sfx_hole_jump` | 1 | No | 1.2s | Alice diving through hedge burrow into rabbit hole (Cutscene C2). |
| **SFX-10** | `amb_well_wind` | 1 | Yes | 8.0s | Cavernous hollow draft wind inside 4m well (S3). |
| **SFX-11** | `sfx_jar_pick` | 1 | No | 0.5s | Lifting glass marmalade jar from wooden shelf. |
| **SFX-12** | `sfx_jar_place` | 1 | No | 0.6s | Placing glass jar inside open wooden cupboard with slight creak. |
| **SFX-13** | `sfx_thought_pop` | 3 | No | 0.4s | Touching floating thought bubble in well; bubble pop + chime. |
| **SFX-14** | `sfx_land_thump` | 2 | No | 0.8s | Landing on dry stick/leaf heap; crunchy double thump (Cutscene C3). |
| **SFX-15** | `sfx_door_locked` | 3 | No | 0.8s | Rattling locked wooden door handle in S5. |
| **SFX-16** | `sfx_key_pick` | 1 | No | 0.3s | Picking up tiny brass key from solid glass table; sharp tick. |
| **SFX-17** | `sfx_key_down` | 1 | No | 0.3s | Subtle clink when key is quietly set back down upon bottle pickup. |
| **SFX-18** | `sfx_key_turn_small`| 1 | No | 0.4s | Tiny golden key turning in 15-inch door lock; crisp metallic click. |
| **SFX-19** | `sfx_curtain` | 1 | No | 1.0s | Heavy velvet curtain drawn aside on brass rings. |
| **SFX-20** | `sfx_little_door` | 1 | No | 0.8s | Miniature wooden door creaking open. |
| **SFX-21** | `amb_garden` | 1 | Yes | 8.0s | Faint sunny garden birdsong & fountain trickle behind little door. |
| **SFX-22** | `sfx_cork` | 1 | No | 0.4s | Popping cork out of DRINK ME glass bottle. |
| **SFX-23** | `sfx_drink` | 1 | No | 1.0s | Three small gulps drinking potion. |
| **SFX-24** | `sfx_shrink` | 1 | No | 2.5s | Whimsical shrinking sound: descending slide whistle with chime arpeggios. |
| **SFX-25** | `sfx_slip` | 2 | No | 1.0s | Small hands squeaking and sliding down smooth glass table leg. |
| **SFX-26** | `sfx_sniffle` | 1 | No | 2.0s | Gentle childlike sniffles after failing to climb table leg. |
| **SFX-27** | `sfx_box_open` | 1 | No | 0.5s | Glass box lid swinging open with brass hinge ting. |
| **SFX-28** | `sfx_nibble` | 2 | No | 0.4s | Tiny nibbles taking bites of EAT ME cake. |
| **SFX-29** | `amb_riverbank` | 1 | Yes | 10.0s | Flowing river water, rustling leaves, birds and summer insects. |
| **SFX-30** | `amb_hall` | 1 | Yes | 10.0s | Quiet room tone of long hall with faint hanging oil lamp hum. |

### 5.3 Web Audio Synth Fallback Architecture & Envelopes
To guarantee that the game runs without audio errors even prior to downloading large external audio files:
1. **Procedural Synth Engine (`src/audio/ProceduralSynth.ts`)**:
   - `playTone(freq, duration, type, adsr)`: Generates musical notes for M1–M7 motifs.
   - `playNoise(duration, filterFreq, q, adsr)`: Generates footsteps, wind, leaf rustle, water flow.
   - `playBubblePop(startFreq, endFreq, duration)`: Generates `sfx_thought_pop`.
   - `playSlideWhistle(startFreq, endFreq, duration)`: Generates `sfx_shrink` (1600 Hz down to 220 Hz glide).
   - `playMetallicClick(freq1, freq2)`: Generates `sfx_key_turn_small` and `sfx_watch_open`.
2. **Audio Pipeline Features**:
   - Master Gain Node → Music Bus, SFX Bus, VO Bus, Ambient Bus.
   - Dialogue Ducking: -6 dB gain attenuation on Music Bus during dialogue; 0.5s smooth ramp recovery.
   - Low-Pass Filter on Small State: 1500 Hz cutoff inserted on Ambient Bus when Alice is 0.254m.

---

## Part 6: Cutscenes C1 to C8 Specifications

| Cutscene | Scene | Trigger Event | Camera Track | Actor Animation | Audio & Dialogue | Post-State & Skip Result |
|---|---|---|---|---|---|---|
| **C1** | S1 | 2nd daisy picked or 45s in S1 | Cam 1: Over-shoulder Alice looking west (1.5s). Cam 2: Medium tracking White Rabbit stopping at 4m (3.5s). Cam 3: Reverse over-shoulder following rabbit running east (2.5s). | Alice: Turns head, idle. Rabbit: Scurries in, checks pocket watch, scurries out. | SFX: `sfx_rabbit_scurry`, `sfx_watch_open`, `sfx_watch_tick`. Line: Rabbit `S1_RABBIT_RUN`, Alice `S1_RABBIT_WATCH`. | Sets `rabbitSeen = true`; objective set to "Follow the White Rabbit"; restores player input. |
| **C2** | S2 → S3 | Interaction `INT_rabbit_hole` | Smooth first-person dolly through burrow; camera tilts 90° up to watch entrance recede as floor drops away. | Alice: Ducks into hole, falls downward. | SFX: `sfx_hole_jump`, BGM crossfade to `M4 Fall`. Line: Narrator `S2_JUMP`. | State set to `S3_FALL`; spawns Alice in floating origin well; unlocks mid-air controls. |
| **C3** | S3 → S4 | Well descent completes (t=88s) | Hard cut to pitch black. Fade up over 0.6s on Alice seated on leaf heap. Pan to rabbit running down passage. | Alice: `Alice_LandJumpUp` (bounds to feet). Rabbit: Scurries ahead into corridor. | SFX: `sfx_land_thump`, on-screen text "thump! thump!". Line: Narrator `S3_LAND`, Alice `S4_UP`. | State set to `S4_PASSAGE`; Alice standing on leaf heap in corridor; player control enabled. |
| **C4** | S4 → S5 | Approaching passage corner | Tracks rabbit turning corner. Alice turns corner into empty passage. Seamless dolly down Long Hall lamps. | Rabbit: Rounds corner and vanishes. Alice: Reaches corner, stops, looks around. | Line: Rabbit `S4_CORNER`, Alice `S4_GONE`, Narrator `S5_ENTER`. BGM crossfade to `M5 Hall`. | State set to `S5_HALL`; Alice placed at hall entrance; third-person camera restored. |
| **C5** | S5 | Key used on little door | Alice unlocks door. Camera drops to floor level (0.15m), dollies 1.2m through tunnel into Garden Vista. Holds 4.0s. Dollies back. | Alice: `Alice_Unlock`, `Alice_KneelPeek`, stands up. Little door swings open, then shuts and locks. | SFX: `sfx_key_turn_small`, `sfx_little_door`, `amb_garden`. Music: `M6 Garden` stinger. Line: `S5_PEEK`, `S5_PEEK_END`. | Flags `littleDoorOpened = true`, `peekDone = true`; bottle fades onto glass table; door locked. |
| **C6** | S6 | Player selects "Drink" on bottle | Focuses on Alice. Dolly zoom forward/down as she shrinks to keep screen framing constant while room expands. | Alice: `Alice_Drink` (cork pop, 3 gulps), `Alice_ShrinkReact` (wonder). Scale 1.0 → 0.212 over 2.5s. | SFX: `sfx_cork`, `sfx_drink`, `sfx_shrink`. Line: `S6_DRINK`, `S6_SHRINK`, `S6_WAIT`. | Alice scale set to 0.212 (0.254m); camera switches to small profile; state set to `S6_SMALL`. |
| **C7** | S6 | 2nd failed table leg climb | Alice slides down leg. Sits on floor. Camera dollies down from Alice to underside of glass table; box emits glint. | Alice: `Alice_ClimbSlip`, `Alice_SitCry`, gives self advice and stands up. | SFX: `sfx_slip`, `sfx_sniffle`. Line: `S6_CRY_END`. Visual glint on `prop_box_glass`. | `INT_glass_box` enabled for interaction; Alice standing under table; input unlocked. |
| **C8** | S7 → END | Player selects "Eat" on cake | Close shot on Alice nibbling cake, hand flat on head waiting. Nothing happens. Finishes cake with puffed cheeks. Fade out. | Alice: `Alice_Eat` (nibble), hand to head, finishes cake. Holds satisfied expression. | SFX: `sfx_nibble` x2. Line: `S7_EAT`, `S7_END`, `S7_PREVIEW_NARR`, `S7_PREVIEW_ALICE`. Music: `M7 Chapter End`. | State set to `END`; triggers Chapter End Card with statistics and "Return to Title". |

### 6.1 Cutscene Skip Logic & Verification Contract
1. **Trigger**: Holding `Esc` or clicking the on-screen "Skip" icon for 1.0 second.
2. **Deterministic State Transfer**: Skipping any cutscene (C1–C8) immediately fast-forwards all state flags, player coordinates, camera orientation, and size system parameters to the exact values produced by watching the cutscene to completion.
3. **Automated Verification**: Covered by Playwright E2E test verifying zero discrepancy in game flags between watched and skipped cutscenes.

---

## Part 7: Track K1 — Development Process Logging & Showcase Requirements

### 7.1 Development Log Artifact Structure
- **Prompt Archives**: `docs/prompts/<track>/<task_id>.md` documenting tools, models, inputs, outputs, iterations, and final adoption status.
- **Asset Evolution Records**: Four canonical screenshots per asset stored in `docs/devlog/assets/<asset_id>/`:
  1. `01_concept.png`: Initial 2D concept art.
  2. `02_raw_mesh.png`: Initial Tripo / generator output.
  3. `03_blender_processed.png`: Scaled, retopologized, and marked Blender model.
  4. `04_ingame.png`: Final in-engine render with picture-book shaders.
- **Daily Devlogs**: `docs/devlog/<date>.md` detailing tasks completed, AI contributions, manual edits, and roadblocks.
- **Performance Metrics**: `docs/perf/ch1.md` recording FPS, draw calls, triangle counts, and memory footprint across WebGPU and WebGL2.
- **Statistics Summary**: `docs/devlog/stats.json` tracking total dev hours, prompt counts, asset counts, lines of code, and tool costs.
- **Showcase Page (`/making-of`)**:
  - Interactive Mermaid toolchain diagram.
  - Interactive asset evolution before/after sliders.
  - Dynamic KPI cards populated live from `stats.json`.
  - Representative prompt viewer modals with copy buttons.
  - Fully bilingual (Chinese & English).

---

## Verification & Independent Inspection Methods
1. **Zod I18n Validation**: Check `public/assets/i18n/ch1.json` against the schema via `npm run test` (validates unique IDs, ≤ 28 Chinese chars, presence of all triggers, and English line integrity).
2. **Audio System Verification**: Inspect `src/audio/` for procedural synthesizer fallbacks ensuring all M1–M7 and SFX-01 to SFX-30 sounds initialize cleanly in headless and browser environments.
3. **Cutscene Timelines**: Verify `public/assets/cutscenes/ch1/` contains `c1.json` through `c8.json` matching the track actions and skip contracts documented above.
