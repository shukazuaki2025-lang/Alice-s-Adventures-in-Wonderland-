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
      { time: 0.0, type: "camera", target: "camera", payload: { mode: "TRACKING_SHOT", position: [4.0, 4.0, 4.0], lookAt: [4.0, 3.0, 0.0] } },
      { time: 1.5, type: "animation", target: "chr_rabbit", payload: { animation: "Rabbit_Hurry", position: [4.0, 3.0, 0.0] } },
      { time: 3.0, type: "animation", target: "chr_rabbit", payload: { animation: "Rabbit_CheckWatch" } },
      { time: 4.0, type: "dialogue", target: "chr_rabbit", payload: { lineId: "S1_RABBIT_RUN" } },
      { time: 5.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S1_RABBIT_WATCH" } },
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
      { time: 2.5, type: "camera", target: "camera", payload: { path: "CAM_TUNNEL_INTERIOR" } },
      { time: 4.0, type: "camera", target: "camera", payload: { path: "CAM_TILT_UP_SILHOUETTE" } },
      { time: 5.0, type: "dialogue", target: "narrator", payload: { lineId: "S2_JUMP" } },
      { time: 6.0, type: "state", target: "game", payload: { goto: "S3_FALL" } }
    ],
    terminalFlags: { chaseStarted: true, rabbitInHole: true }
  },
  {
    id: "C3",
    title: "Leafpile Landing",
    duration: 5.0,
    events: [
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_land_thump" } },
      { time: 1.0, type: "camera", target: "camera", payload: { path: "CAM_LANDING", animation: "Alice_Land" } },
      { time: 1.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_Land" } },
      { time: 2.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S4_UP" } },
      { time: 4.5, type: "camera", target: "player", payload: { mode: "RESET_CONTROL" } }
    ],
    terminalFlags: {}
  },
  {
    id: "C4",
    title: "Rabbit Corner & Hall Reveal",
    duration: 6.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_rabbit", payload: { animation: "Rabbit_Scurry" } },
      { time: 0.5, type: "dialogue", target: "chr_rabbit", payload: { lineId: "S4_CORNER" } },
      { time: 2.0, type: "dialogue", target: "chr_alice", payload: { lineId: "S4_GONE" } },
      { time: 3.5, type: "camera", target: "camera", payload: { path: "CAM_SWEEP_S5_INTRO" } },
      { time: 4.5, type: "dialogue", target: "narrator", payload: { lineId: "S5_ENTER" } },
      { time: 6.0, type: "camera", target: "player", payload: { mode: "RESET_CONTROL" } }
    ],
    terminalFlags: {}
  },
  {
    id: "C5",
    title: "Little Door Garden Peek",
    duration: 7.0,
    events: [
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_little_door" } },
      { time: 1.5, type: "animation", target: "chr_alice", payload: { animation: "Alice_KneelPeek_In" } },
      { time: 3.0, type: "camera", target: "camera", payload: { path: "CAM_GLIDE_VISTA" } },
      { time: 4.0, type: "dialogue", target: "narrator", payload: { lineId: "S5_PEEK" } },
      { time: 4.0, type: "audio", target: "music", payload: { track: "M6", duration: 8.0 } },
      { time: 5.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S5_PEEK_END" } },
      { time: 6.5, type: "animation", target: "chr_alice", payload: { animation: "Alice_KneelPeek_Out" } },
      { time: 6.5, type: "audio", target: "sfx", payload: { sfx: "sfx_door_lock" } }
    ],
    terminalFlags: { peekDone: true }
  },
  {
    id: "C6",
    title: "Drink & Shrink",
    duration: 6.0,
    events: [
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_cork" } },
      { time: 0.5, type: "animation", target: "chr_alice", payload: { animation: "Alice_Drink" } },
      { time: 2.0, type: "dialogue", target: "narrator", payload: { lineId: "S6_DRINK_1" } },
      { time: 3.5, type: "scale", target: "chr_alice", payload: { from: 1.0, to: 0.2117, duration: 2.5 } },
      { time: 3.5, type: "audio", target: "sfx", payload: { sfx: "sfx_shrink" } },
      { time: 5.0, type: "dialogue", target: "chr_alice", payload: { lineId: "S6_SHRINK" } }
    ],
    terminalFlags: { bottleDrank: true }
  },
  {
    id: "C7",
    title: "Table Leg Slip & Crying",
    duration: 5.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_Slip" } },
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_slip" } },
      { time: 1.5, type: "animation", target: "chr_alice", payload: { animation: "Alice_SitCry" } },
      { time: 1.5, type: "audio", target: "sfx", payload: { sfx: "sfx_sniffle" } },
      { time: 3.0, type: "dialogue", target: "chr_alice", payload: { lineId: "S6_CRY_END" } },
      { time: 4.5, type: "camera", target: "camera", payload: { path: "CAM_PAN_GLASS_BOX" } }
    ],
    terminalFlags: {}
  },
  {
    id: "C8",
    title: "Eat Cake & Chapter Finale",
    duration: 10.0,
    events: [
      { time: 0.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_Eat" } },
      { time: 0.0, type: "audio", target: "sfx", payload: { sfx: "sfx_nibble" } },
      { time: 1.5, type: "dialogue", target: "chr_alice", payload: { lineId: "S7_EAT" } },
      { time: 4.0, type: "scale", target: "chr_alice", payload: { from: 0.2117, to: 2.417, duration: 3.5 } },
      { time: 4.0, type: "animation", target: "chr_alice", payload: { animation: "Alice_LookDown" } },
      { time: 5.5, type: "dialogue", target: "narrator", payload: { lineId: "S7_END" } },
      { time: 7.5, type: "camera", target: "camera", payload: { path: "CAM_FADE_BLACK_END_CARD" } },
      { time: 9.5, type: "state", target: "game", payload: { goto: "END" } }
    ],
    terminalFlags: { cakeEaten: true, chapterCompleted: true }
  }
];

cutscenes.forEach(c => {
  const jsonStr = JSON.stringify(c, null, 2);
  fs.writeFileSync(path.join(dir, `${c.id}.json`), jsonStr);
  console.log(`Successfully created ${c.id}.json`);
});
