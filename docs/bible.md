# Project Bible: Alice's Adventures in Wonderland
## Chapter I: Down the Rabbit-Hole (`Alice: Down the Rabbit-Hole`)

*Version 1.0 — Authoritative World Lore, Character Specifications, and Art Direction*

---

## 1. Project Vision & Creative Mandate

### 1.1 The Golden Afternoon
*Alice: Down the Rabbit-Hole* is a 3D interactive narrative game for modern web browsers, adapting Chapter I of Lewis Carroll's 1865 masterpiece *Alice's Adventures in Wonderland*. 

The creative goal is to craft **"A Moving Victorian Picture-Book"** — an experience that feels as if Sir John Tenniel's 1865 woodblock engravings and Carroll's whimsical prose have been brought into physical, luminous 3D life. Players guide Alice not through a punishing combat trial, but through an authentic Victorian dreamscape of curiosity, polite astonishment, and surreal spatial logic.

### 1.2 Core Experience Principles
1. **Fidelity to Carroll's 1865 Text**: The sequence of events follows Carroll's chapter structure precisely. English narrative and spoken dialogue are drawn verbatim from the original 1865 Project Gutenberg edition.
2. **Interactive Agency over Passive Viewing**: Every scene is an explorable 3D physical space. Players walk, inspect, run, climb, and solve puzzles with real mechanical causality.
3. **Scale as the Central Phenomenon**: Spatial size changes (growing, shrinking, perspective distortion) are the emotional and mechanical spine of Wonderland. Chapter I focuses on Alice's first bewildering shrinkage from 1.20 meters down to 10 inches (0.254 m).
4. **Gentle Curiosity Without Failure or Death**: Wonderland has no "Game Over" screen. Alice cannot perish in the well, be injured by jumping into rabbit holes, or be punished for trying wrong doors. When idle or stuck, Alice's own candid internal monologue gently guides the player onward.
5. **Surreal Logic & Mathematical Humor**: Lewis Carroll (Charles Lutwidge Dodgson) was a mathematical lecturer at Christ Church, Oxford. The world's puzzles and Alice's thoughts reflect Carroll's fascination with geometry, scale, linguistic literalism, and inverted geography.

---

## 2. Strict Copyright & Anti-Derivation Rules

To preserve pure public-domain integrity and honor the original author, the project enforces strict anti-derivation boundaries:

### 2.1 Prohibited Derivative Influences
- **Strictly Prohibited**: Any visual, musical, or narrative motifs originating from 20th or 21st-century copyrighted film, animation, or video game adaptations (including the Walt Disney 1951 animated feature, Tim Burton's 2010 film, and American McGee's series).
- **Prohibited Color/Costume Combination**: **No light-blue dress with black hairband**. This is a 20th-century Disney invention. Any model, texture, or concept art featuring this combination will be immediately rejected.
- **Prohibited Tropes**: No gothic gore, no stylized combat weapons (Vorpal blade, butcher knives), no neon/cyberpunk aesthetics, no realistic photographic human faces, and no copyrighted modern translations.

### 2.2 Approved Historical References
- **Lewis Carroll's Original Text (1865)**: In the public domain worldwide.
- **Sir John Tenniel's Illustrations (1865)**: Woodblock engravings published in the first edition by Macmillan & Co., public domain.
- **Carroll's Original Manuscript**: *Alice's Adventures Under Ground* (1864, British Library Add MS 46700).

---

## 3. Visual Aesthetic: The Moving Victorian Picture-Book

### 3.1 Rendering Philosophy
The rendering pipeline is designed to look like a hand-tinted Victorian storybook in real-time motion:
- **3-Tone Toon Ramp Shading**: Meshes receive a customized toon ramp with three discrete lighting bands: paper highlight, rich warm mid-tone, and warm purple/sepia soft shadow. Shadows are never harsh or neutral black.
- **Ink Outline Work (`#2B2420`)**: Characters and interactive objects feature an ink outline using inverted-hull back-face extrusion in `#2B2420` (lamp-black sepia ink). Outline thickness subtly attenuates with camera distance to mimic fine pen-and-ink hatching.
- **Paper Grain Overlay (15%)**: A tileable screen-space parchment texture is blended at 15% opacity across the screen buffer, giving the entire viewport the tactile presence of high-rag Victorian book paper.
- **Cross-Hatch Shading**: In deepest shadow crevices, subtle procedural cross-hatching evokes Tenniel's hand-carved woodblocks.
- **Vignette & Color Grading**: Warm candle amber in descent and hall; soft drowsy haze on the riverbank; vibrant saturated daylight reserved exclusively for the Garden Vista.

### 3.2 Master Color Palettes
| Scene / Subject | Primary Tones | Secondary Tones | Accents & Lighting |
|---|---|---|---|
| **S1 Riverbank** | Meadow Green `#7FA35B`<br>Warm Cream `#F3E9D2` | Sky Blue `#A9C8E8`<br>River Blue `#6F9FB8` | Sunlight Gold `#F2C46D`<br>Daisy White `#FFFDF5` |
| **S2 The Chase** | Hedge Green `#4E6E3A`<br>Earth Brown `#5A3E2B` | Meadow Grass `#6B8E4E` | Burrow Darkness `#1E1A24` |
| **S3 The Well** | Aged Oak `#8A6142`<br>Parchment `#D9C49A` | Deep Shadow `#1E1A24`<br>Dusty Rose `#A67B80` | Candle Amber `#E8A54B`<br>Marmalade Orange `#E07A2B` |
| **S4 Long Passage**| Flagstone Grey `#6E6A66`<br>Cool Blue-Slate `#4B5A6E` | Earth Floor `#4A3528` | Distant Lamp Glow `#F5C26B` |
| **S5-S7 Long Hall** | Cold Blue-Grey `#4B5A6E`<br>Aged Oak Wainscot `#4A3528`| Floor Parquet `#3D2B20`<br>Stone Door Frames `#5C5854`| Hanging Gaslight `#F5C26B`<br>Velvet Curtain `#7A2E3A`<br>Glass Cyan `#BFE6EA`<br>Gold Key `#D4A93A` |
| **The Garden Vista**| Emerald Lawn `#3FA36B`<br>Fountain Blue `#8EC9F0` | Rose Red `#E0607E`<br>Blossom Pink `#F2A4B8` | Radiant Pure Sunlight `#FFE6A0` |

---

## 4. Character Profiles

### 4.1 Alice (Protagonist)
- **Age**: 7 years old (based on Carroll's canonical age for Alice Pleasance Liddell in 1862).
- **Proportions**: Stylized picture-book anatomy with a head-to-body ratio of **1:4.5**. Soft, rounded facial features, wide inquisitive dark hazel eyes, button nose, rosy cheeks, and expressive brows. Hands and feet are slightly oversized to ensure gestures and footsteps are distinctly legible from a third-person camera.
- **Hair**: Wavy, voluminous light-golden blonde hair (`#E6C98F`) flowing to mid-back, gathered in a single solid silhouette (optimized for clean geometry without wispy hair-card noise). Tied back with a classic Victorian navy-blue silk ribbon (`#2E3F6E`) featuring a neat flat bow on top.
- **Costume**:
  - **Dress**: Traditional Victorian knee-length day dress in warm **wheat-yellow / daffodil cotton** (`#E9C46A`), with short puffed sleeves and a round Peter Pan collar in soft antique white.
  - **Pinafore Apron**: Pristine white linen pinafore (`#F7F3EA`) with delicate ruffled shoulder straps, two front pockets, and a neat wide sash tied in a large butterfly bow at the small of her back.
  - **Hosiery & Shoes**: Knee-high ribbed white stockings (`#F7F3EA`) and black leather single-strap Mary Jane shoes with small brass buckles.
- **Personality & Voice**:
  - Polite, observant, candid, and slightly stubborn.
  - She speaks in crisp, well-enunciated English, often lecturing herself when emotions threaten to overwhelm her.
  - Alice possesses an innate Victorian sense of dignity — she curtsies mid-air while falling, worries about dropping a jar on someone's head below, and refuses to drink from unlabelled bottles until verifying they lack the word "Poison".

### 4.2 The White Rabbit (*Lepus Anxius*)
- **Role**: The catalyst of the adventure, leading Alice down into Wonderland.
- **Height**: 0.75 meters (including his upright, nervous ears) — approximately two-thirds Alice's height.
- **Anatomy**: Bipedal, upright gentleman hare. Soft, warm-white downy fur (`#F4F1EC`), long expressive ears with pale salmon-pink interiors (`#F4C2C2`), twitching whiskers, and luminous, anxious pink eyes (`#E88FA3`).
- **Costume**:
  - A tailored Victorian gentleman's hunting jacket in brown-and-cream houndstooth check (`#9B5B3A` and `#E2C9A0`) with miniature short split tails.
  - A crisp, high-buttoned mustard-yellow waistcoat (`#C9A24A`) featuring four brass buttons and a functioning fob pocket.
  - A burgundy-red butterfly bowtie at his starched white collar.
  - A heavy circular gold pocket watch on a gleaming chain (`prop_watch`), which he repeatedly extracts and checks with feverish dismay.
- **Personality**: Perpetually terrified of tardiness; perpetually in a flurried rush; oblivious to Alice yet wholly captivating in his absurdity.

### 4.3 Alice's Sister
- **Role**: S1 opening tableau figure, anchoring the mundane reality Alice departs from.
- **Appearance**: A calm young Victorian gentlewoman seated in quiet contemplation against the trunk of the great oak tree. Dressed in a long Victorian skirt of moss-green linen with a crocheted cream shawl.
- **Action**: Absorbed in reading a heavy hardbound book that has "neither pictures nor conversations" — an object Alice finds hopelessly dull.

### 4.4 Dinah (Dream Silhouette)
- **Role**: Alice's pet tabby kitten at home, manifesting as a warm glowing phantom during Alice's drowsy descent in Scene 3.
- **Appearance**: A soft, translucent, golden-amber dream silhouette of a sleek domestic cat, purring and batting at imaginary winged creatures in mid-air as Alice drifts into sleepy delirium ("Do cats eat bats?").

---

## 5. Metric Dimensions & Spatial Standard

To ensure seamless physics collision, camera framing, and asset reusability across all chapters, every model and scene is built to strict real-world metric scales (1 Three.js unit = 1.0 meter):

```
+-------------------------------------------------------------+
|                      CANONICAL METRICS                      |
|                                                             |
| Alice (Normal):        1.20 m height (scale 1.0), 0.36 m capsule width  |
| Alice (Small):         0.254 m (10 in) height (scale 0.2117 ≈ 0.212), 0.08 m width |
| Alice (Giant):         2.90 m (>9 ft) height (scale 2.4167 ≈ 2.417), 0.87 m width |
|                                                             |
| Long Hall Shell:       24.0 m (L) × 7.0 m (W) × 2.85 m (H)  |
| Hall Doors (10 pcs):   1.0 m (W) × 2.2 m (H)                |
| Solid Glass Table:     0.72 m height, 0.50 m diameter       |
| Tiny Golden Key:       0.05 m (5 cm) length                 |
| Velvet Curtain:        0.80 m (W) × 0.60 m (H)              |
| Little Door:           0.24 m (W) × 0.381 m (15 in) (H)     |
| Little Passage Tunnel: 0.24 m (W) × 0.33 m (H) × 1.20 m (L) |
| Falling Well Shaft:    4.0 m inner diameter                 |
| Descent Rate:          2.2 m/s simulated relative velocity  |
+-------------------------------------------------------------+
```

---

## 6. Narrative Beats & Scene Lore

### S0: Title & Prologue
- **Atmosphere**: The lazy golden afternoon of July 4, 1862.
- **Visual**: Painterly title card with Alice falling past glowing shelves; language selection (`English` / `中文` / `日本語`); "Start Journey" button unlocking browser Web Audio API context.
- **Narrative Opening**: *"Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do."*

### S1: Riverbank Afternoon
- **Atmosphere**: Heavy summer heat, buzzing insects, gently rippling water, drowsy lethargy.
- **Mechanics**: Third-person movement tutorial. Alice walks with a subtle drowsy sway (speed reduced by 15% to evoke summer slumber). Alice can peek at her sister's pictureless book and collect English daisies to weave a chain.
- **Trigger**: Picking the second daisy (or 45s idle time) prompts the sudden appearance of the White Rabbit.

### S2: The Chase Across the Meadow
- **Atmosphere**: Sudden kinetic burst of curiosity breaking the summer stupor.
- **Mechanics**: Alice dashes 35 meters across the sunny meadow, following the White Rabbit who stays 8–10 meters ahead. The Rabbit darts under the hedge into an 80 cm diameter burrow. Alice dives in without hesitation.

### S3: Down the Rabbit-Hole (The 90-Second Fall)
- **Atmosphere**: Dreamlike, weightless, vertical floating descent through a 4.0-meter cylindrical shaft.
- **Mechanics**:
  - The scene uses a **Floating Origin** architecture: Alice remains near world origin `(0, 0, 0)` while the modular well sections scroll continuously upward at 2.2 m/s.
  - Player controls Alice's horizontal drift within a 1.4-meter radius.
  - **Marmalade Jar**: At t=15s, Alice grabs a jar marked *ORANGE MARMALADE* from a passing shelf, discovers it is empty, refuses to drop it ("I might kill somebody underneath!"), and places it into an open cupboard down the shaft.
  - **5 Thought Bubbles**: Golden glowing thought spheres appear on descent path (t=10s, 30s, 45s, 58s, 70s), unlocking Carroll's philosophical musings.
  - **Mid-air Curtsey Easter Egg**: Pressing `C` during Thought 4 ("The Antipathies") causes Alice to perform an airborne curtsey.
  - **Drowsy Finale**: At t=75s, lighting dims to deep lavender; Dinah's phantom silhouette floats past; Alice mutters *"Do cats eat bats? ... Do bats eat cats?"*; screen fades out to "thump! thump!".

### S4: The Long Subterranean Corridor
- **Atmosphere**: Cool earth, rustling dry autumn leaves, damp stone walls.
- **Mechanics**: Alice jumps up completely unharmed, catches sight of the White Rabbit scurrying around a distant 90-degree corner ("Oh my ears and whiskers!"), and pursues him. Rounding the corner seamlessly transitions into the Long Hall via corner occlusion.

### S5: The Long Hall & The Locked Doors
- **Atmosphere**: An imposing, mysterious subterranean hall lit by a rhythmic row of suspended brass oil lamps.
- **Mechanics**:
  - 10 large doors surround the room. All are locked.
  - Alice discovers the three-legged solid glass table holding the tiny golden key.
  - **Invariant 1**: Trying the key on the large doors fails ("Either the locks are too large, or the key is too small").
  - **Invariant 2**: The low velvet curtain on the north-east wall is **non-interactive** until the player has tried the key on at least two large doors (`keyTriesOnDoors >= 2`).
  - **Invariant 3**: Opening the 15-inch door reveals the radiant, high-saturation Garden Vista. When Alice rises, the little door swings shut and clicks locked.

### S6: "DRINK ME" & Shrinking
- **Atmosphere**: Growing tension of scale distortion and unexpected consequences.
- **Mechanics**:
  - A small glass bottle with a tied paper label *DRINK ME* appears on the glass table.
  - **Invariant 4**: Picking up the bottle automatically and quietly places the golden key back onto the glass table.
  - **Invariant 5 (Inspection Rule)**: In the 3D item inspector, the player must rotate the bottle to inspect both front ("DRINK ME") and back (verifying no skull-and-crossbones or word "Poison"). Only then does the "Drink" action unlock.
  - **Shrinking Transition**: Over 2.5 seconds, Alice shrinks to 0.254 m (scale `0.212`). A telescopic circular vignette constricts the screen; footsteps pitch shift by 1.6x.
  - **Invariant 6**: Small Alice rushes to the little door, only to realize it is locked and the key remains on top of the 0.72 m glass table!
  - **Table Leg Climbing**: Alice attempts to climb the slippery glass leg twice, sliding down both times. She sits on the floor, scolds herself for weeping, and spots a glimmering glass box beneath the table.

### S7: "EAT ME" Currant Cake & Finale
- **Atmosphere**: Childlike resolve and surreal anticipation.
- **Mechanics**:
  - Alice pulls the glass box from under the table and opens its brass-hinged lid.
  - Inside rests a miniature golden cake beautifully marked in currants with the words *EAT ME*.
  - Alice takes a bite, pressing her palm to her head in suspense ("Which way? Which way?").
  - To her surprise, she remains the exact same size. She finishes the cake.
  - The screen gently fades out to the Chapter I End Card with curiosity statistics and a teaser for Chapter II: *The Pool of Tears*.

---

## 7. Audio Identity & Sound Design

- **Synthesized / Procedural Foundation**: Zero external asset dependencies. All music and sound effects are generated via real-time Web Audio API algorithms (oscillators, biquad filters, white-noise bursts, convolvers) with seamless fallback to static `.ogg` / `.wav` assets.
- **Theme Leitmotif**: A nostalgic, wistful music-box waltz in 3/4 time (D major, 80 BPM), recurring throughout the Title (M1), Long Hall (M5), and Finale (M7).
- **Interactive Audio Pitch Modulation**: When Alice shrinks into her 0.254 m form, character footsteps and interaction chimes automatically pitch-shift upward by **1.6x**, while room reverberation and ambient drones undergo low-pass filtering to heighten the sensation of being miniature in a giant world.
