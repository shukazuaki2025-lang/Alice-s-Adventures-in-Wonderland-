# Quality gate report

- run: 2026-10-14T18:07:56.390Z  
- mode: NO-RUN (artefacts only, not valid for stopping)  
- result: **FAIL** — 14/30 checks

## integrity

| | check | detail |
|---|---|---|
| ✅ | `thresholds-floor` | thresholds not committed yet — the first commit will become the permanent floor |
| ✅ | `metrics-function` | image-metrics.mjs matches the pinned hash |

## models

| | check | detail |
|---|---|---|
| ✅ | `models:budget` | 19.1 MB of GLB (limit 45 MB) |
| ✅ | `model:chr_sister` | 44348 tris, 10 painted mats, 4.7 Mpx |
| ❌ | `model:chr_rabbit` | 0 painted materials < 6; 0.00 Mpx texture < 3.00 |
| ❌ | `model:chr_dinah_dream` | 0 painted materials < 2; 0.00 Mpx texture < 1.50 |
| ✅ | `model:ch1_s1_bank` | 60218 tris, 7 painted mats, 2.6 Mpx |
| ✅ | `model:ch1_s3_well` | 69046 tris, 11 painted mats, 5.3 Mpx |
| ✅ | `model:ch1_s4_passage` | 37232 tris, 8 painted mats, 5.1 Mpx |
| ✅ | `model:ch1_s5_hall` | 85410 tris, 26 painted mats, 13.0 Mpx |
| ❌ | `model:prop_bottle_drinkme` | 0 painted materials < 1; 0.00 Mpx texture < 0.25 |
| ❌ | `model:prop_cake_eatme` | 0 painted materials < 1; 0.00 Mpx texture < 0.25 |
| ❌ | `model:prop_jar_marmalade` | 0 painted materials < 1; 0.00 Mpx texture < 0.25 |
| ❌ | `model:prop_key_gold` | 0 painted materials < 1; 0.00 Mpx texture < 0.25 |
| ❌ | `model:prop_watch` | 0 painted materials < 1; 0.00 Mpx texture < 0.25 |
| ❌ | `model:prop_box_glass` | 48 tris < 300; 0 painted materials < 1; 0.00 Mpx texture < 0.25 |

## visual

| | check | detail |
|---|---|---|
| ✅ | `capture-fresh` | captured 2026-10-14T18:07:10.011Z |
| ❌ | `S1_BANK` | detail 7.777 (≥8), palette 0.526 (≥0.6), contrast 0.195 (≥0.2) |
| ❌ | `S1_BANK_orbit` | palette 0.52 (≥0.6) |
| ❌ | `S3_FALL` | detail 5.349 (≥8), palette 0.217 (≥0.6), hueEntropy 1.708 (≥2), contrast 0.084 (≥0.2), saturation 0.87 (≤0.8) |
| ❌ | `S4_PASSAGE` | detail 3.034 (≥8), palette 0.178 (≥0.6), hueEntropy 1.642 (≥2), contrast 0.113 (≥0.2), dominant3 0.341 (≤0.3) |
| ❌ | `S5_HALL` | palette 0.39 (≥0.6), contrast 0.176 (≥0.2), drawCalls 174 (≤150) |
| ❌ | `S6_SMALL` | detail 6.325 (≥8), palette 0.362 (≥0.6), contrast 0.158 (≥0.2) |
| ✅ | `alice:front` | detail 16.368 palette 0.205 hueEntropy 1.701 contrast 0.211 hardEdge 0.174 dominant3 0.5207 |
| ✅ | `alice:threeQuarter` | detail 17.297 palette 0.199 hueEntropy 1.623 contrast 0.221 hardEdge 0.1803 dominant3 0.5014 |
| ✅ | `alice:face` | detail 8.602 palette 0.25 hueEntropy 1.732 contrast 0.236 hardEdge 0.1227 dominant3 0.3958 |
| ✅ | `alice:walk` | detail 18.748 palette 0.2 hueEntropy 1.52 contrast 0.232 hardEdge 0.1935 dominant3 0.43 |
| ❌ | `npc:sister` | detail 8.435 (≥12), contrast 0.168 (≥0.2), dominant3 0.6363 (≤0.6) |
| ✅ | `npc:rabbit` | detail 13.478 palette 0.212 hueEntropy 1.902 contrast 0.22 hardEdge 0.1498 dominant3 0.4334 |

## human

| | check | detail |
|---|---|---|
| ❌ | `verdict` | docs/devlog/gate/VERDICT.md missing — open board.png, compare with littleprince.dev, and write the scene-by-scene verdict (see ROUND2_TASK.md §7) |

## Benchmark (littleprince.dev key art, same metrics)

| frame | detail | palette | hueEntropy | saturation | contrast | hardEdge | dominant3 |
|---|---|---|---|---|---|---|---|
| fullFrame | 8.304 | 0.638 | 2.096 | 0.653 | 0.213 | 0.0332 | 0.5255 |
| planet | 10.636 | 0.803 | 3.175 | 0.502 | 0.254 | 0.0645 | 0.2208 |
| focal | 9.579 | 0.745 | 2.756 | 0.554 | 0.245 | 0.0774 | 0.1022 |
