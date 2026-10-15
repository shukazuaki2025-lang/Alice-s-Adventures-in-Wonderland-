# Visual benchmark — *The Little Prince Among the Stars* (littleprince.dev)

The user's yard-stick for "fineness and texture": **https://littleprince.dev/** (小王子：星辰之旅), a watercolour / gouache
look rendered in a real-time 3D game. The instruction was: *make ours in this painting style and with this material
quality — not merely something that looks ugly — and do not stop until we reach this level or go above it.*

This folder holds the **numbers** derived from that benchmark. It deliberately does **not** hold the benchmark's artwork
(it is third-party; see `docs/assets-licenses.md` — nothing from the benchmark is shipped or committed).
We take the *level of finish* as the target, **not** its characters, shapes or palette. Alice stays Tenniel-1865 /
`CLAUDE.md` §3 (wheat dress, white pinafore, navy ribbon; no light-blue + black-hairband; no film derivations).

## What was measured, and how

| file | what |
|---|---|
| `littleprince-keyart-metrics.json` | seven painterly-richness statistics for the key-art still (`keyart.*.jpg`, 1672×941, the hero image on the site's loading screen): the full frame, the planet crop, and the focal crop (prince + rose + house) |
| `../../../tools/lib/image-metrics.mjs` | the statistics (documented in the file header). The **same** code measures our own frames in `npm run gate` |
| `../../../tools/measure-reference.mjs` | how the reference numbers were produced: `node tools/measure-reference.mjs out.json fullFrame=<img> planet=<img>@x,y,w,h …` |

The statistics, in one line each (all on a 512-px-wide downscale; flat background colour ignored):

* `detail` – mean |Laplacian of luma| ×100: how much painted texture / brush detail there is per pixel
* `palette` – distinct 4-bit colours /1000: colour richness
* `hueEntropy` – Shannon entropy of the hue histogram: how many different hues are really in play
* `saturation`, `contrast` – mean HSV saturation, luma std-dev
* `hardEdge` – share of pixels with a strong gradient: **lower = softer, more painterly; higher = cel / line-art**
* `dominant3` – share of the three most common colours: **lower = less flat**

| frame | detail | palette | hueEntropy | saturation | contrast | hardEdge | dominant3 |
|---|---|---|---|---|---|---|---|
| fullFrame (incl. plain navy sky) | 8.30 | 0.64 | 2.10 | 0.65 | 0.21 | 0.033 | 0.53 (sky-inflated) |
| planet crop | 10.64 | 0.80 | 3.18 | 0.50 | 0.25 | 0.065 | 0.22 |
| focal crop | 9.58 | 0.75 | 2.76 | 0.55 | 0.25 | 0.077 | 0.10 |

The gate bars for in-game scenes (`docs/review/gate-thresholds.json` → `scenes`) sit at ≈ 90–100 % of the **full-frame**
numbers on detail / palette / hueEntropy / contrast, and well inside the benchmark on `hardEdge` and `dominant3`.

## What the benchmark *looks* like (what the numbers are standing in for)

Read this before you start painting. Numbers can be gamed by noise; the look cannot.

1. **Everything is painted, nothing is "a coloured polygon".** Rock, grass, bark, cloth, sky: each surface carries
   visible gouache / watercolour strokes — pooled pigment, dry-brush streaks, granulation — at a scale that stays readable
   at game distance. No flat-colour materials, no procedural-noise-only looks.
2. **Paper under the paint.** A warm cotton-paper grain shows through darks and lights alike; edges of washes are
   slightly darker than their centres (pigment pooling), colour bleeds a little past outlines.
3. **No black outlines.** Form is carried by value and hue shifts (warm light / cool shadow), not by a hard black line.
   Our ink line (`#2B2420`, thin, tinted, thinning with distance) must be *felt*, never the dominant look.
4. **Rich but harmonious palette.** Many hues (moss, olive, ochre, rose, slate, violet shadows) held together by one
   temperature logic; accents (the red rose, the gold scarf) are rare and deliberate.
5. **Dense, hand-placed small detail.** Tufts, flowers, pebbles, craters, smoke — the surfaces are populated, never bare.
6. **Soft glow, not hard lighting.** Warm rim light, luminous skies, gentle atmospheric falloff.
7. **Characters are sculpted, not assembled.** Readable silhouette, layered clothing with fold structure, expressive face
   and hands, textured fabric.

## Limits of this benchmark (stated honestly)

* Only the **key art** could be measured. The WebGPU game on littleprince.dev never got past its loading screen under the
  headless software-GPU browser available here, so **no in-game footage of the benchmark was captured or compared.**
  The key art is the studio's own statement of the target look; it is probably *more* polished than live gameplay, which
  is why our bars are set against it and not lowered.
* The statistics are proxies. They catch "flat", "noisy-but-empty", "all one hue" and "line-art"; they cannot judge
  taste. The final judge is a person looking at `docs/devlog/gate/board.png`, and `docs/devlog/gate/VERDICT.md` is the
  written comparison that has to accompany it.
* If you can open https://littleprince.dev/ on a machine with a real GPU, **play it for ten minutes and screenshot the
  in-game frames** (meadow / planet surface close-ups, the prince at 3 m, rose, fox). Measure them with
  `tools/measure-reference.mjs`, add them to `littleprince-keyart-metrics.json` as `inGame_*` entries and — only if they
  are *higher* than the key art — raise the bars. Never lower them.
