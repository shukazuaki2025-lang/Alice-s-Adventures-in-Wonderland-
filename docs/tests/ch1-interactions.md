# Chapter 1 Interaction & State Matrix Specification

## 1. Scene Interaction Matrix

This document defines the authoritative interaction matrix, state transition rules, item requirements, trigger behaviors, and state invariants for Chapter 1 ("Down the Rabbit-Hole") of *Alice's Adventures in Wonderland*.

| Interaction Node | Target Scene | Interaction Type | Required Item | Trigger Condition | State Flag Modified | Response Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT_sister_book` | S1_BANK | `inspect` | None | Proximity < 2.0m + `E` key | `sisterBookInspected: true` | Displays dialogue `S1_BOOK` (*"what is the use of a book without pictures or conversations?"*) |
| `INT_daisy_1` | S1_BANK | `pickup` | None | Proximity < 1.5m + `E` key | `daisiesPicked: 1` | Adds `daisy_1` to inventory, triggers picking animation |
| `INT_daisy_2` | S1_BANK | `pickup` | None | Proximity < 1.5m + `E` key | `daisiesPicked: 2` | Adds `daisy_2` to inventory, triggers C1 White Rabbit cutscene |
| `INT_daisy_3` | S1_BANK | `pickup` | None | Proximity < 1.5m + `E` key | `daisiesPicked: 3` | Adds `daisy_3` to inventory |
| `INT_rabbit_hole` | S1_BANK | `trigger` | None | Proximity < 1.0m + `E` key | `chaseStarted: true`, `rabbitInHole: true` | Triggers C2 Rabbit Hole Crawl cutscene, transitions state to `S3_FALL` |
| `SLOT_01` .. `SLOT_08` | S3_FALL | `inspect` | None | Fall trajectory alignment | None | Highlights shelf items during 88s descent |
| `prop_jar_marmalade` | S3_FALL | `pickup` | None | Proximity < 1.5m + `E` key during descent | `jarStored: true` | Adds `prop_jar_marmalade` ("ORANGE MARMALADE") to inventory |
| `TRG_S4_corner` | S4_PASSAGE | `trigger` | None | Position x > 23.0m | `doorsTried: 4` | Triggers C4 White Rabbit Scurry & Hall Reveal cutscene |
| `INT_door_01` .. `08` | S5_HALL | `door` | `prop_key_gold` | Proximity < 1.2m + `E` key | None | Door locked message; key does not fit large doors |
| `INT_table` | S5_HALL | `pickup` | None | Proximity < 1.2m + `E` key | `keyPickedUp: true` | Adds `prop_key_gold` to inventory; removes key mesh from table top |
| `INT_curtain` | S5_HALL | `trigger` | None | Proximity < 1.0m + `E` key | `curtainDrawn: true` | Draws low curtain aside, revealing 15-inch 3-locked Little Door |
| `INT_door_little` | S5_HALL | `door` | `prop_key_gold` | Proximity < 1.0m + `E` key (with key in inventory) | `littleDoorOpened: true`, `peekDone: true`, `bottleAppeared: true` | Unlocks Little Door, triggers C5 Garden Peek cutscene & reveals DRINK ME bottle |
| `INT_bottle_drinkme` | S5_HALL / Inspector | `use` | `prop_bottle_drinkme` | Select "Drink" in Item Inspector | `drankPotion: true`, `bottleDrank: true`, `audioPitchFactor: 1.6` | Triggers C6 Drink & Shrink cutscene; Alice scale ramps from 1.0 to 0.212 (0.254m height) |
| `INT_table_leg` | S5_HALL | `use` | None (at 0.254m height) | Proximity < 0.5m + `E` key | `climbAttempts: +1` | Attempt 1: Alice slips down slippery glass leg. Attempt 2: Triggers C7 Table Leg Slip & Crying cutscene |
| `INT_glass_box` | S5_HALL | `pickup` | None (under table at 0.254m height) | Proximity < 0.5m + `E` key | `boxOpened: true` | Opens glass box under table, reveals `prop_cake_eatme` ("EAT ME") |
| `prop_cake_eatme` | Inspector | `use` | `prop_cake_eatme` | Select "Eat" in Item Inspector | `cakeEaten: true`, `chapterCompleted: true` | Triggers C8 Eat Cake cutscene & displays Chapter 1 Finale End Card |

---

## 2. State Machine Transition Flow (S0 to S7)

```
[S0_TITLE] ──(New Game)──> [S1_BANK] ──(Interact INT_rabbit_hole / C2)──> [S2_CHASE]
                                                                                │
[S5_HALL] <──(Landing / C3)── [S4_PASSAGE] <──(End of Fall / 88s)── [S3_FALL] <─┘
   │
   ├── (Drink Bottle / C6) ──> Alice Scale: 0.212 (0.254m)
   ├── (Climb Table Leg x2 / C7) ──> Unlocks Glass Box under table
   └── (Eat Cake / C8) ──> [S7_FINALE / END CARD]
```

---

## 3. Invariants Verification Matrix

| Invariant | Description | Enforcement Rule | Verification Test |
| :--- | :--- | :--- | :--- |
| **INV-01** | Non-Null Narrative Lines | Every dialogue or text popup must pull valid string from `ch1.json` | Unit test `test_narrative_schema` |
| **INV-02** | Chinese Subtitle Constraint | Chinese subtitles must be <= 28 characters per line | Unit test `test_subtitle_length` |
| **INV-03** | Size Scale Parity | Alice scale matches physics capsule height (1.0 = 1.2m, 0.212 = 0.254m) | Unit test `test_scale_parity` & E2E Tier 2 |
| **INV-04** | Inventory Item Uniqueness | Golden key, Drink Me bottle, Marmalade jar, and Eat Me cake exist once | E2E Tier 3 combinations |
| **INV-05** | Door Lock Integrity | 10 large doors cannot be opened with golden key; only Little Door accepts key | Unit test & E2E Tier 1 |
| **INV-06** | Cutscene Skip Parity | Esc skip (1.0s) sets exact same terminal state flags as watching full cutscene | E2E Tier 3 & CutscenePlayer unit tests |
| **INV-07** | Non-Negative Curiosity Score | Curiosity notes and points accumulate non-negatively (0 to 100) | StateMachine unit tests |
