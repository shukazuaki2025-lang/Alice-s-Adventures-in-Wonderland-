import fs from 'fs';
import path from 'path';

const dir = 'public/assets/cutscenes/ch1';
fs.mkdirSync(dir, { recursive: true });

const cutscenes = [
  {
    id: "C1",
    title: "White Rabbit Scurry & Watch Check",
    duration: 8.0,
    events: [
      { time: 0.0, type: "camera", target: "Alice", payload: { mode: "TRACKING_SHOT", lookAt: "WEST" } },
      { time: 1.5, type: "animation", target: "chr_rabbit", payload: { animation: "Rabbit_Hurry", position: [4.0, 3.0, 0.0] } },
      { time: 3.0, type: "animation", target: "chr_rabbit", payload: { animation: "Rabbit_CheckWatch" } },
      { time: 4.0, type: "dialogue", target: "chr_rabbit", payload: { lineId: "S1_RABBIT_RUN", text: "Oh dear! Oh dear! I shall be late!", zh: "天哪！天哪！我要迟到了！" } },
      { time: 5.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S1_RABBIT_WATCH", text: "A rabbit with a waistcoat-pocket, and a watch to take out of it...", zh: "穿着背心口袋还掏出怀表的兔子……" } },
      { time: 6.5, type: "camera", target: "player", payload: { mode: "RESET_CONTROL" } }
    ],
    terminalFlags: { rabbitSeen: true }
  },
  {
    id: "C2",
    title: "Rabbit Hole Jump",
    duration: 6.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_CrawlIn" } },
      { time: 2.5, type: "camera", target: "tunnel", payload: { mode: "TUNNEL_INTERIOR" } },
      { time: 4.0, type: "camera", target: "Alice", payload: { mode: "TILT_UP_SILHOUETTE" } },
      { time: 5.0, type: "dialogue", target: "narrator", payload: { lineId: "S2_JUMP", text: "In another moment down went Alice after it, never once considering how in the world she was to get out again.", zh: "紧接着爱丽丝也跳了进去，根本没想过以后怎么出来。" } },
      { time: 6.0, type: "state", target: "game", payload: { goto: "S3_FALL" } }
    ],
    terminalFlags: { chaseStarted: true, rabbitInHole: true }
  },
  {
    id: "C3",
    title: "Leafpile Landing",
    duration: 4.5,
    events: [
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_land_thump", text: "thump! thump!" } },
      { time: 1.0, type: "camera", target: "Alice", payload: { mode: "FADE_IN", animation: "Alice_Land" } },
      { time: 2.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S4_UP", text: "Not a bit hurt!", zh: "一点也没摔伤！" } },
      { time: 4.5, type: "camera", target: "player", payload: { mode: "RESET_CONTROL" } }
    ],
    terminalFlags: { jarStored: true }
  },
  {
    id: "C4",
    title: "Rabbit Corner & Hall Reveal",
    duration: 7.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_rabbit", payload: { animation: "Rabbit_Scurry", dialogue: "S4_CORNER", text: "Oh my ears and whiskers, how late it's getting!", zh: "噢，我的耳朵和胡须啊，太迟了！" } },
      { time: 2.0, type: "dialogue", target: "chr_alice", payload: { lineId: "S4_GONE", text: "Where has it gone?", zh: "它到哪里去了？" } },
      { time: 3.5, type: "camera", target: "hall", payload: { mode: "SWEEP_S5_INTRO" } },
      { time: 4.5, type: "dialogue", target: "narrator", payload: { lineId: "S5_ENTER", text: "She found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof.", zh: "她发现自己身处一间长而矮的大厅里，天花板上悬挂着一排吊灯。" } },
      { time: 7.0, type: "camera", target: "player", payload: { mode: "RESET_CONTROL" } }
    ],
    terminalFlags: { doorsTried: 4 }
  },
  {
    id: "C5",
    title: "Little Door Garden Peek",
    duration: 9.0,
    events: [
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_little_door" } },
      { time: 1.5, type: "animation", target: "chr_alice", payload: { animation: "Alice_KneelPeek_In" } },
      { time: 3.0, type: "camera", target: "garden", payload: { mode: "GLIDE_VISTA" } },
      { time: 4.0, type: "dialogue", target: "narrator", payload: { lineId: "S5_PEEK", text: "The loveliest garden you ever saw.", zh: "你所见过的最美丽的花园。" } },
      { time: 4.0, type: "audio", target: "music", payload: { track: "M6", duration: 8.0 } },
      { time: 7.0, type: "dialogue", target: "chr_alice", payload: { lineId: "S5_PEEK_END", text: "Oh, how I wish I could shut up like a telescope!", zh: "噢，我多么希望能像望远镜一样合起来啊！" } },
      { time: 8.5, type: "audio", target: "sfx", payload: { sfx: "sfx_door_lock" } }
    ],
    terminalFlags: { peekDone: true, littleDoorOpened: true, bottleAppeared: true }
  },
  {
    id: "C6",
    title: "Drink & Shrink",
    duration: 8.5,
    events: [
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_cork" } },
      { time: 0.5, type: "animation", target: "chr_alice", payload: { animation: "Alice_Drink" } },
      { time: 2.0, type: "dialogue", target: "narrator", payload: { lineId: "S6_DRINK_1", text: "It had, in fact, a sort of mixed flavour of cherry-tart, custard, pine-apple, roast turkey, toffee, and hot buttered toast...", zh: "事实上，它混合着樱桃馅饼、蛋奶羹、菠萝、烤火鸡、太妃糖和热黄油吐司的风味……" } },
      { time: 4.0, type: "scale", target: "chr_alice", payload: { from: 1.0, to: 0.212, duration: 2.5, sfx: "sfx_shrink" } },
      { time: 6.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S6_SHRINK", text: "What a curious feeling! I must be shutting up like a telescope.", zh: "多么奇妙的感觉！我一定正像望远镜一样收缩呢。" } }
    ],
    terminalFlags: { drankPotion: true, bottleDrank: true, audioPitchFactor: 1.6 }
  },
  {
    id: "C7",
    title: "Table Leg Slip & Crying",
    duration: 9.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_Slip", sfx: "sfx_slip" } },
      { time: 2.0, type: "dialogue", target: "chr_alice", payload: { animation: "Alice_SitCry", sfx: "sfx_sniffle" } },
      { time: 4.0, type: "dialogue", target: "chr_alice", payload: { lineId: "S6_CRY_END", text: "Come, there's no use in crying like that! I advise you to leave off this minute!", zh: "来吧，这样哭是没用的！我劝你立刻停止！" } },
      { time: 6.5, type: "camera", target: "table_base", payload: { mode: "PAN_GLASS_BOX" } }
    ],
    terminalFlags: { climbAttempts: 2 }
  },
  {
    id: "C8",
    title: "Eat Cake & Chapter Finale",
    duration: 10.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_Eat", sfx: "sfx_nibble" } },
      { time: 1.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S7_EAT", text: "Which way? Which way?", zh: "长高还是变矮？哪种方向？" } },
      { time: 4.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_LookDown" } },
      { time: 5.5, type: "dialogue", target: "narrator", payload: { lineId: "S7_END", text: "She remained the same size... So she set to work, and very soon finished off the cake.", zh: "她保持着原来的大小……于是她继续吃起来，很快就把蛋糕吃光了。" } },
      { time: 7.5, type: "camera", target: "screen", payload: { mode: "FADE_BLACK_END_CARD" } }
    ],
    terminalFlags: { boxOpened: true, cakeEaten: true, chapterCompleted: true }
  }
];

cutscenes.forEach(c => {
  const jsonStr = JSON.stringify(c, null, 2);
  fs.writeFileSync(path.join(dir, `${c.id}.json`), jsonStr);
  fs.writeFileSync(path.join(dir, `${c.id.toLowerCase()}.json`), jsonStr);
  console.log(`Successfully created ${c.id}.json and ${c.id.toLowerCase()}.json`);
});
