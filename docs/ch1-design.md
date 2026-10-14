# Chapter 1 Game Design Document: Down the Rabbit-Hole
## `Alice: Down the Rabbit-Hole` (S0 through S7)

*Authoritative Systems, Puzzle Invariants, Camera Rigs, and Cutscene Timelines*

---

## 1. Executive Summary & Design Philosophy

Chapter 1 introduces the player to the physical world of Wonderland across eight sequential narrative states (`S0_TITLE` to `S7_CAKE`). The chapter is designed for an uninterrupted 12 to 15-minute playthrough, featuring third-person exploration, physical puzzle interactions, a 90-second floating-origin vertical descent, and the iconic scale-shifting transformation from 1.20 meters down to 10 inches (0.254 meters).

### Canonical Metric Standards & Three-State Height Scale
All scene architecture, props, character rigs, and collision volumes follow strict metric dimensions:
- **Alice Three-State Height Scale**:
  - **Normal**: `1.20 m` (scale factor `1.0`) — Canonical 7-year-old girl height (active in S1–S5).
  - **Small**: `0.254 m` / 10 inches (scale factor `0.2117 ≈ 0.212`) — Post-"DRINK ME" potion size (active in S6–S7).
  - **Giant**: `2.90 m` / >9 feet (scale factor `2.4167 ≈ 2.417`) — Post-"EAT ME" cake growth state (Chapter 2 transition).
- **Great Hall (Long Hall Shell)**: `24.0 m` length × `7.0 m` width × `2.85 m` ceiling height.
- **Solid Glass Table**: Height `0.72 m`, top diameter `0.50 m` (3-legged glass table).
- **Little Door**: Width `0.24 m`, height `0.381 m` (15 inches); passage tunnel `0.24 m` (W) × `0.33 m` (H) × `1.20 m` (L).

### Core Pillars
1. **Physical Causality**: Puzzles are tactile and physical rather than abstract inventory-combining screens.
2. **Deterministic State Machine**: Every state transition is guarded by explicit boolean and numeric flags stored in the global state and persisted in `localStorage` under `alice.save.v1`.
3. **No Failure States**: Players cannot die, fail, or get permanently soft-locked. If a player is idle for 60 seconds or 120 seconds, Alice delivers contextual spoken/thought hints.
4. **Authentic Lewis Carroll 1865 Text**: All English dialogue and monologues preserve the 1865 Project Gutenberg text verbatim.

---

## 2. Canonical State Progression (S0 through S7)

```
[S0_TITLE] ──(Start Journey)──> [S1_BANK] ──(Chase Rabbit)──> [S2_CHASE]
                                                                  │
                                                          (Jump into Burrow)
                                                                  ▼
[S5_HALL] <──(Follow Corner)── [S4_PASSAGE] <──(Landing)─── [S3_FALL]
    │
 (Unlock Door & Peek Garden)
    ▼
[S6_SMALL] ──(Climb Leg & Cry)──> [S7_CAKE] ──(Eat Cake)──> [END_CARD]
```

---

### S0: Title & Prologue
- **Duration**: ~0.5 min.
- **Environment**: High-resolution painterly title card background depicting Alice falling past illuminated cupboards and shelves.
- **Interface**:
  - Main title: *Alice's Adventures in Wonderland* / *爱丽丝梦游仙境*.
  - Language toggle: `English` | `中文` | `日本語` (dynamic live switching).
  - Primary button: "点击 · 开始旅程" / "Start Journey".
  - Audio unlock: User click initializes browser `AudioContext` to satisfy autoplay policies.
  - Continue button: Displayed only if valid `alice.save.v1` JSON exists in `localStorage`.
- **Transition**: Page-turn curl animation transitioning into Scene 1 with Chapter Card: *"Chapter I. Down the Rabbit-Hole"*.

---

### S1: Riverbank Afternoon
- **Duration**: 2 to 3 min.
- **Environment**: Grassy meadow (60m × 40m) along the River Thames. Giant English oak at `(0, 0)`, slow-moving water on the north bank, thick hedge on the east boundary.
- **Player Spawns**: `SPAWN_S1` at `(2, -1)`, facing north toward the river.
- **Atmosphere Effect**: Drowsy summer lethargy — Alice's movement speed is reduced by 15% (`1.19 m/s` walk, `2.55 m/s` run); subtle breathing camera sway is active (can be toggled off via "Reduce Motion" setting).
- **Interactives**:
  - `INT_sister_book`: Seated Sister reading. Interacting triggers Alice's inner thought: *"what is the use of a book without pictures or conversations?"*
  - `INT_daisy_1`, `INT_daisy_2`, `INT_daisy_3`: Three highlighted white English daisies. Picking them adds to inventory counter (`daisiesPicked` 1 to 3).
- **State Trigger**:
  - Picking the 2nd daisy OR remaining in scene for 45 seconds initiates the arrival of the White Rabbit.
  - Cutscene C1 begins: The White Rabbit runs from the west along `PATH_rabbit_S1`, stops 4m away at `RABBIT_STOP` `(4, 3)`, pulls out his gold pocket watch, cries *"Oh dear! Oh dear! I shall be late!"*, and darts toward the hedge.
  - Objective UI updates: *"Follow the White Rabbit"*. Drowsy movement penalty is removed.

---

### S2: The Chase
- **Duration**: ~1 min.
- **Environment**: Same terrain as S1. The White Rabbit sprints 35 meters eastward along `PATH_rabbit_S2`.
- **Rabbit AI Behavior**:
  - The Rabbit maintains an 8 to 10-meter lead ahead of Alice.
  - If Alice accelerates, the Rabbit sprints faster (`4.2 m/s`); if Alice stops, the Rabbit pauses and glances nervously backward (`Rabbit_LookBack`).
- **Destination**: The Rabbit dives under the thick green hedge into an 80 cm diameter burrow `INT_rabbit_hole` at `(29.5, -6.0)`.
- **State Trigger**: Alice approaches within 1.5m of `INT_rabbit_hole` and presses Interact.
  - Cutscene C2 plays: Alice crawls inside, walks a few paces along the dark horizontal tunnel, and suddenly plunges into the vertical abyss.

---

### S3: Down the Rabbit-Hole (The 90-Second Fall)
- **Duration**: Exactly 88–95 seconds.
- **Technical Architecture**: **Floating Origin**. Alice remains constrained near world origin `(0, 0, 0)`. The cylindrical well shaft (inner diameter 4.0m) scrolls upward at a steady descent velocity of `2.2 m/s`.
- **Player Control**: Alice can steer her horizontal drift within a 1.4-meter radius using WASD or thumbstick. Camera allows ±45° pitch and yaw look-around.
- **Scripted Sequence**:
  - **t = 5s**: Opening narrator line: *"Either the well was very deep, or she fell very slowly..."*
  - **t = 15s**: A glowing wooden shelf scrolls past holding an orange marmalade jar (`INT_jar_shelf`). Alice grabs it, inspects it, and exclaims *"ORANGE MARMALADE... empty!"*.
  - **t = 18s - 25s**: If player presses Drop/Discard, Alice refuses: *"I mustn't drop it. I might kill somebody underneath!"*.
  - **t = 25s - 65s**: Open wooden cupboards scroll past every ~8 seconds. Moving close to any open cupboard triggers the prompt to place the jar safely inside. Doing so stows the jar and awards the clean completion flag `jarStored`.
  - **t = 10s, 30s, 45s, 58s, 70s**: Five glowing golden thought bubbles scroll into view. Colliding with a thought bubble triggers Carroll's monologues (`S3_THOUGHT_1` through `S3_THOUGHT_5`). Any missed bubbles re-spawn 10 seconds later.
  - **t = 50s (Curtsey Easter Egg)**: While Thought 4 (*The Antipathies*) is playing, pressing the `C` key triggers `Alice_CurtseyAir` animation and special narrator line: *(she tried to curtsey as she spoke—fancy curtseying as you're falling through the air!)*. Flag `curtsey = true`.
  - **t = 75s (Drowsy Dream State)**: Well lighting shifts to deep twilight lavender; camera depth of field softens. A glowing translucent silhouette of Alice's cat Dinah floats through the well. Alice begins dozing, murmuring *"Do cats eat bats? ... Do bats eat cats?"*.
  - **t = 88s**: Hard blackout cut. Sound effect `sfx_land_thump` plays with comic on-screen text *"thump! thump!"*. Cutscene C3 begins as Alice lands softly upon a heap of dry autumn sticks and leaves.

---

### S4: The Long Subterranean Corridor
- **Duration**: ~1 min.
- **Environment**: 24-meter underground passage with stone masonry walls, dirt floor, and low arched ceiling (width 2.0m, height 2.4m).
- **Player Spawns**: `SPAWN_S4` at `(0, 0)` on the leaf pile. Alice springs to her feet unharmed: *"Not a bit hurt!"*.
- **Sequence**:
  - In the distance, the White Rabbit is seen hurrying toward a 90-degree right turn corner.
  - Approaching `TRG_S4_corner`, the Rabbit mutters *"Oh my ears and whiskers, how late it's getting!"* and turns the corner, vanishing.
  - Alice rounds the corner (`TRG_S4_exit`). Using doorway geometry occlusion, the corridor seamlessly transitions into the Long Hall (S5) without any loading screen.

---

### S5: The Long Hall & The Locked Doors
- **Duration**: 3 to 4 min.
- **Environment**: A low, grand subterranean hall: length 24.0m (along X-axis), width 7.0m, ceiling height 2.85m. Lit by six brass oil lamps suspended along the ceiling center line.
- **Doors**: 10 tall Victorian panel doors (1.0m × 2.2m) around the perimeter.
- **Puzzle Flow**:
  1. Alice attempts to open doors. Interacting with any large door plays `Alice_TryDoor` and rattling sound `sfx_door_locked`. A flag tracks `doorsTried`.
  2. When `doorsTried >= 4`, Alice steps back into the hall center and speaks her lament: *"How am I ever to get out again?"*.
  3. Alice approaches the three-legged solid glass table (`INT_table` at `(4.0, 0.0)`, height 0.72 m, top diameter 0.50 m). Resting on top is the tiny golden key (`prop_key_gold`, length 0.05m). Interacting picks up the key (`keyTaken = true`).
  4. Alice attempts to use the key on the large doors. Every attempt fails: *"Either the locks are too large, or the key is too small"*. Each attempt increments `keyTriesOnDoors`.
  5. **Curtain Invariant**: The low velvet curtain on the north wall `(10.5, 3.5)` is completely non-interactive and unhighlighted until `keyTriesOnDoors >= 2`.
  6. Once `keyTriesOnDoors >= 2`, Alice notices the curtain: *"A low curtain! I hadn't noticed that before."*. Interacting pulls the curtain aside (`curtainFound = true`, playing shape key `CurtainOpen`), revealing the 15-inch little door (`ch1_hall_door_little`, width 0.24 m, height 0.381 m; passage 0.24 m × 0.33 m × 1.20 m).
  7. Alice uses the tiny golden key on the little door. The lock clicks open (`littleDoorOpened = true`).
  8. Cutscene C5 plays: Alice kneels (`Alice_KneelPeek_In`), and the camera moves along the 1.20-meter tunnel floor to showcase the radiant **Garden Vista** (emerald lawns, rose bushes, cool marble fountain, bright golden sunlight).
  9. Alice sighs: *"Oh, how I wish I could shut up like a telescope!"*. She stands up. The little door swings gently shut and automatically locks.

---

### S6: "DRINK ME" & Shrinking
- **Duration**: ~2 min.
- **Environment**: Long Hall.
- **Puzzle Flow**:
  1. Alice returns to the center glass table. A small glass bottle with a cork stopper has appeared on the table top (`prop_bottle_drinkme`). Alice marvels: *"which certainly was not here before"*.
  2. **Key Auto-Return Invariant**: When Alice picks up the bottle, the golden key is quietly returned to the glass table surface with a soft clink (`sfx_key_down`). No prompt is displayed.
  3. **3D Inspection Invariant**: The 3D item inspector opens. The "Drink" action button is disabled. The player must rotate the bottle 360 degrees to verify both the front label (*DRINK ME*) and the back label (verifying it is not marked *POISON*). Once both sides are verified, Alice says *"It isn't marked 'poison'. I'll taste it"*, and the "Drink" button unlocks.
  4. Drinking triggers Cutscene C6: Alice gulps the liquid (*"cherry-tart, custard, pine-apple, roast turkey, toffee, and hot buttered toast"*).
  5. **Size Scaling**: Over 2.5 seconds, Alice smoothly shrinks from 1.20m to 0.254m (scale `0.212`). The room expands dramatically around her. A circular vignette contracts and expands like a folding brass telescope.
  6. Alice runs excitedly toward the little door. To her dismay, the little door is locked! She remembers: *"The key! I've left it on the table!"*.
  7. Alice runs back to the glass table. At 0.254m tall, the tabletop (height 0.72m) is nearly three times her height. Through the transparent glass, the tiny golden key gleams directly above her.
  8. Alice attempts to climb the glass table leg (`INT_table_leg`). She scrambles upward, slips, and falls to the floor (`sfx_slip`). She tries a second time and slides down again.
  9. Cutscene C7 plays: Alice sits on the dark floor and weeps (`Alice_SitCry`). She firmly lectures herself: *"Come, there's no use in crying like that! I advise you to leave off this minute!"*.
  10. As she wipes her tears, the camera tracks downward, catching a glint of light from beneath the table: a small rectangular glass box resting on the floor (`INT_glass_box`).

---

### S7: "EAT ME" Currant Cake & Finale
- **Duration**: ~1 min.
- **Environment**: Under the glass table in the Long Hall.
- **Sequence**:
  1. Alice interacts with `INT_glass_box` at `(4.1, -0.1)`. The brass-hinged lid opens (`sfx_box_open`), revealing a tiny golden currant cake with the words *EAT ME* beautifully spelled out in currants (`prop_cake_eatme`).
  2. Alice examines the cake: *"Well, I'll eat it, and if it makes me grow larger, I can reach the key; and if it makes me grow smaller, I can creep under the door; so either way I'll get into the garden, and I don't care which happens!"*.
  3. Cutscene C8 plays: Alice takes a delicate bite, resting her hand upon the crown of her head in anxious suspense: *"Which way? Which way?"*.
  4. She remains the exact same size. Astonished, she sits down and eagerly devours the rest of the cake.
  5. The scene fades to black as she rubs her full tummy.
  6. **Chapter End Card**:
     - Completion statistics: Thought Bubbles collected (n/5), Marmalade Jar stowed (Yes/No), Mid-air Curtsey discovered (Yes/No).
     - Preview text for Chapter II: *The Pool of Tears*.
     - Alice's closing voice line: *"Curiouser and curiouser!"*.
     - Buttons: "Restart Chapter" / "Return to Title" / "Making-Of Showcase".

---

## 3. Strict Puzzle Invariants & Rule Enforcement

To guarantee canonical game logic, zero soft-locks, and flawless automated testing, the following invariants are strictly enforced:

| Invariant | Name | Exact Rule & Trigger Logic |
|---|---|---|
| **INV-01** | **Curtain Access Lock** | `INT_curtain` cannot be selected, clicked, or interacted with until `flags.keyTriesOnDoors >= 2`. Prior to this condition, the curtain has no UI prompt and raycasts ignore it. |
| **INV-02** | **Table Transparency** | The glass table material (`M_Glass_Table`) must maintain optical transparency (alpha ≤ 0.25, refractive Fresnel edge) so that when Alice is small (0.254m), the golden key and bottle remain unmistakably visible through the tabletop. |
| **INV-03** | **Key Auto-Return** | Picking up the "DRINK ME" bottle (`INT_bottle`) automatically removes `prop_key_gold` from Alice's inventory and repositions it at `(4.05, 0.73, 0.0)` on the glass tabletop. A soft metallic clink (`sfx_key_down`) plays. No inventory dialogue is shown. |
| **INV-04** | **Size Scaling Transition** | Shrinking must take exactly 2.5 seconds with cubic ease-in-out interpolation: Alice scale shifts from `1.0` to `0.2117` (`0.254 m`). Character controller capsule radius reduces from `0.18 m` to `0.04 m`, height from `1.20 m` to `0.254 m`. Walk speed shifts from `1.4 m/s` to `0.5 m/s`. Camera distance shifts from `3.2 m` to `0.8 m`. Footstep pitch shifts by `1.6x`. |
| **INV-05** | **Bottle Inspection Verification** | In the 3D item inspect modal, the bottle object tracks rotation angles. The "Drink" button remains disabled (`disabled = true`) until the modal registers that both the front label (*DRINK ME*) and the reverse label (confirming no poison markings) have faced the camera within 30 degrees of normal. |
| **INV-06** | **Cutscene Skip Parity** | Holding the `Esc` key or clicking the on-screen skip button for 1.0 second immediately fast-forwards the cutscene to its completion state. Skipping any cutscene `C1` through `C8` sets the identical state flags, inventory items, and actor positions as watching the full animation. |
| **INV-07** | **Marmalade Jar No-Drop** | During Scene 3, pressing Discard / Drop while holding `prop_jar_marmalade` is strictly blocked. Instead, it plays Alice's thought: *"I mustn't drop it. I might kill somebody underneath!"*. The jar can only be cleared by placing it inside an open cupboard. |

---

## 4. Camera Systems & Profiles

The camera rig uses a spherical coordinate spring-arm collision system that sweeps against level colliders (`COL_*`) to guarantee the camera never clips through walls or props.

### 4.1 Camera Parameter Profiles
| Parameter | Normal Alice (1.20 m) | Small Alice (0.254 m) | In-Between Transition |
|---|---|---|---|
| Target Distance | `3.20 m` | `0.80 m` | 2.5s Slerp interpolation |
| Arm Pivot Height | `1.40 m` | `0.30 m` | 2.5s Linear interpolation |
| Field of View (FOV)| `55.0°` | `65.0°` (dramatic scale) | 2.5s Smooth step |
| Collision Sphere Radius | `0.15 m` | `0.05 m` | Instant update at end |
| Min Pitch / Max Pitch | `-30°` / `+60°` | `-20°` / `+70°` (steep look up)| Clamp bounds shift |

### 4.2 Fixed Cinematic Camera Anchors
- `CAM_S5_intro`: Position `(-11.0, 1.8, 0.0)`, looking eastward down the hall along the row of lamps.
- `CAM_S5_peek`: Position `(10.5, 0.15, 3.2)`, pitch `0°`, looking through the 15-inch door into the Garden Vista.
- `CAM_S6_shrink`: Position `(3.0, 0.8, -1.2)`, tracking Alice from medium-low perspective during the transformation.
- `CAM_S6_cry`: Position `(3.8, 0.2, 0.2)`, looking up at small Alice weeping beside the glass table leg.
- `CAM_S7_end`: Position `(4.5, 0.25, -0.4)`, framed close-up on small Alice devouring the currant cake.

---

## 5. Cutscenes Specification (C1 through C8)

All cutscenes are defined as declarative JSON timelines in `public/assets/cutscenes/ch1/`:

### C1: White Rabbit Scurry & Watch Check
- **Trigger**: Picking 2nd daisy or 45s in S1.
- **Duration**: 8.0 seconds.
- **Tracks**:
  - `0.0s`: Camera slerps to tracking shot of Alice turning west.
  - `1.5s`: Rabbit dashes in (`Rabbit_Hurry`), reaches `(4, 3)`.
  - `3.0s`: Rabbit stops, extracts pocket watch (`Rabbit_CheckWatch`).
  - `4.0s`: Rabbit speaks `S1_RABBIT_RUN` (*"Oh dear! Oh dear! I shall be late!"*).
  - `5.5s`: Alice thoughts `S1_RABBIT_WATCH` (*"A rabbit with a waistcoat-pocket..."*).
  - `6.5s`: Rabbit dashes east toward hedge; camera resets control to player.

### C2: Rabbit Hole Jump
- **Trigger**: Interacting with `INT_rabbit_hole`.
- **Duration**: 6.0 seconds.
- **Tracks**:
  - `0.0s`: Alice kneels and crawls into hedge (`Alice_CrawlIn`).
  - `2.5s`: Camera cuts to tunnel interior; Alice takes three running strides.
  - `4.0s`: Floor drops away; camera tilts upward framing Alice's falling silhouette against tunnel mouth.
  - `5.0s`: Narrator speaks `S2_JUMP` (*"In another moment down went Alice after it..."*).
  - `6.0s`: Transition into S3 floating origin well.

### C3: Leafpile Landing
- **Trigger**: t=88s in S3.
- **Duration**: 4.5 seconds.
- **Tracks**:
  - `0.0s`: Blackout screen; sound `sfx_land_thump`; text popups *"thump! thump!"*.
  - `1.0s`: Fade in on Alice seated on dry leaves (`Alice_Land`).
  - `2.5s`: Alice leaps up cheerfully (`S4_UP`: *"Not a bit hurt!"*).
  - `4.5s`: Camera hands back control in S4 corridor.

### C4: Rabbit Corner & Hall Reveal
- **Trigger**: Alice approaches `TRG_S4_corner`.
- **Duration**: 7.0 seconds.
- **Tracks**:
  - `0.0s`: White Rabbit scurries around corner; cries `S4_CORNER` (*"Oh my ears and whiskers..."*).
  - `2.0s`: Alice rounds corner; finds empty stone hall entrance (`S4_GONE`: *"Where has it gone?"*).
  - `3.5s`: Camera sweeps smoothly through doorway into Long Hall (`CAM_S5_intro`).
  - `4.5s`: Narrator speaks `S5_ENTER` (*"she found herself in a long, low hall..."*).
  - `7.0s`: Control returned to player in S5.

### C5: Little Door Garden Peek
- **Trigger**: Unlocking little door with golden key.
- **Duration**: 9.0 seconds.
- **Tracks**:
  - `0.0s`: Little door unlatches and creaks open (`sfx_little_door`).
  - `1.5s`: Alice kneels (`Alice_KneelPeek_In`), head resting near floor.
  - `3.0s`: Camera glides down tunnel to frame the saturated Garden Vista.
  - `4.0s`: Narrator speaks `S5_PEEK` (*"the loveliest garden you ever saw"*); musical stinger M6 plays (8s).
  - `7.0s`: Camera pulls back; Alice rises and sighs `S5_PEEK_END` (*"Oh, how I wish I could shut up like a telescope!"*).
  - `8.5s`: Little door swings shut and clicks locked. Player resumes control.

### C6: Drink & Shrink
- **Trigger**: Selecting "Drink" in item inspector for the bottle.
- **Duration**: 8.5 seconds.
- **Tracks**:
  - `0.0s`: Alice pops cork (`sfx_cork`) and drinks from bottle (`Alice_Drink`, 3 gulps `sfx_drink`).
  - `2.0s`: Narrator speaks `S6_DRINK_1` (*"cherry-tart, custard..."*).
  - `4.0s`: Size transition begins: Alice scale ramps `1.0` -> `0.212` over 2.5s; slide whistle sound `sfx_shrink` plays; telescopic vignette contracts.
  - `6.5s`: Alice reacts in wonder (`Alice_ShrinkReact`, `S6_SHRINK`: *"What a curious feeling! I must be shutting up like a telescope"*).
  - `8.5s`: Vignette clears; player resumes control at 0.254m height.

### C7: Table Leg Slip & Crying
- **Trigger**: Second climb attempt on glass table leg.
- **Duration**: 9.0 seconds.
- **Tracks**:
  - `0.0s`: Alice slips down table leg and tumbles to the floor (`sfx_slip`).
  - `2.0s`: Alice sits crying (`Alice_SitCry`, `sfx_sniffle`).
  - `4.0s`: Alice sternly scolds herself (`S6_CRY_END`: *"Come, there's no use in crying like that! I advise you to leave off this minute!"*).
  - `6.5s`: Camera pans downward toward floor under table; a bright glint reveals the glass box.
  - `9.0s`: Control returns to player.

### C8: Eat Cake & Chapter Finale
- **Trigger**: Selecting "Eat" on currant cake.
- **Duration**: 10.0 seconds.
- **Tracks**:
  - `0.0s`: Alice takes a bite of the cake (`Alice_Eat`, `sfx_nibble`).
  - `1.5s`: Alice places hand upon crown of her head (`S7_EAT`: *"Which way? Which way?"*).
  - `4.0s`: Nothing happens; Alice looks down at herself.
  - `5.5s`: Narrator speaks `S7_END` (*"she remained the same size... So she set to work, and very soon finished off the cake"*).
  - `7.5s`: Screen fades to warm black; Chapter I End Card appears with curiosity statistics and Chapter II teaser.

---

## 6. Global State Flags & Persistence

The game state is governed by the following typed flags:

```typescript
export interface GameFlags {
  // S1 Flags
  daisiesPicked: number;        // 0 to 3
  sisterBookInspected: boolean; // true once book read
  rabbitSeen: boolean;          // true once C1 triggered
  
  // S2 Flags
  chaseStarted: boolean;        // true during chase
  rabbitInHole: boolean;        // true once rabbit dives
  
  // S3 Flags
  jarTaken: boolean;            // true once marmalade jar picked up
  jarStored: boolean;           // true once marmalade jar placed in cupboard
  thoughts: [boolean, boolean, boolean, boolean, boolean]; // thoughts 1 to 5
  curtsey: boolean;             // easter egg triggered via C key
  
  // S5 Flags
  doorsTried: number;           // count of large doors rattled
  keyTaken: boolean;            // true once key taken from table
  keyTriesOnDoors: number;      // count of key used on large doors (>=2 unlocks curtain)
  curtainFound: boolean;        // true once curtain opened
  littleDoorOpened: boolean;    // true once key unlocks little door
  peekDone: boolean;            // true once Garden Vista peek cutscene ends
  
  // S6 Flags
  bottleAppeared: boolean;      // true once peekDone
  bottleInspectedFront: boolean;// true once front label viewed
  bottleInspectedBack: boolean; // true once back label viewed
  bottleDrank: boolean;         // true once bottle consumed
  climbAttempts: number;        // count of table leg climb attempts (>=2 triggers cry)
  
  // S7 Flags
  boxOpened: boolean;           // true once glass box opened
  cakeEaten: boolean;           // true once cake consumed
  chapterCompleted: boolean;    // true on end card
}
```

This state is automatically saved into `localStorage['alice.save.v1']` at each scene boundary, with corruption fallback and `window.__game` test harness injection for Playwright E2E verification.
