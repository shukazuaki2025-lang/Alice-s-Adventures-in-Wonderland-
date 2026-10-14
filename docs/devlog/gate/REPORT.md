# Quality gate report

- run: 2026-10-14T21:14:16.573Z  
- mode: NO-RUN (artefacts only, not valid for stopping)  
- result: **FAIL** — 22/31 checks

## integrity

| | check | detail |
|---|---|---|
| ✅ | `thresholds-floor` | no threshold lowered since d7d7c17 |
| ✅ | `metrics-pin-floor` | pin unchanged |
| ✅ | `metrics-function` | image-metrics.mjs matches the pinned hash |

## models

| | check | detail |
|---|---|---|
| ✅ | `models:budget` | 21.6 MB of GLB (limit 45 MB) |
| ✅ | `model:chr_sister` | 56204 tris, 11 painted mats, 5.7 Mpx |
| ✅ | `model:chr_rabbit` | 30596 tris, 8 painted mats, 3.3 Mpx |
| ✅ | `model:chr_dinah_dream` | 21844 tris, 3 painted mats, 1.6 Mpx |
| ✅ | `model:ch1_s1_bank` | 60218 tris, 7 painted mats, 2.6 Mpx |
| ✅ | `model:ch1_s3_well` | 69046 tris, 11 painted mats, 5.3 Mpx |
| ✅ | `model:ch1_s4_passage` | 37232 tris, 8 painted mats, 5.1 Mpx |
| ✅ | `model:ch1_s5_hall` | 85410 tris, 26 painted mats, 13.0 Mpx |
| ✅ | `model:prop_bottle_drinkme` | 1704 tris, 3 painted mats, 0.5 Mpx |
| ✅ | `model:prop_cake_eatme` | 2704 tris, 2 painted mats, 0.3 Mpx |
| ✅ | `model:prop_jar_marmalade` | 1708 tris, 2 painted mats, 0.6 Mpx |
| ✅ | `model:prop_key_gold` | 3992 tris, 1 painted mats, 0.3 Mpx |
| ✅ | `model:prop_watch` | 4288 tris, 2 painted mats, 0.5 Mpx |
| ✅ | `model:prop_box_glass` | 788 tris, 1 painted mats, 0.3 Mpx |

## visual

| | check | detail |
|---|---|---|
| ❌ | `capture-fresh` | src/ or a GLB changed after the last capture — re-run the capture (npm run gate) |
| ❌ | `S1_BANK` | detail 7.795 (≥8), palette 0.532 (≥0.6), contrast 0.195 (≥0.2) |
| ❌ | `S1_BANK_orbit` | palette 0.538 (≥0.6) |
| ❌ | `S3_FALL` | detail 5.226 (≥8), palette 0.226 (≥0.6), hueEntropy 1.69 (≥2), contrast 0.083 (≥0.2), saturation 0.866 (≤0.8) |
| ❌ | `S4_PASSAGE` | detail 3.033 (≥8), palette 0.176 (≥0.6), hueEntropy 1.642 (≥2), contrast 0.113 (≥0.2), dominant3 0.341 (≤0.3) |
| ❌ | `S5_HALL` | palette 0.383 (≥0.6), contrast 0.177 (≥0.2) |
| ❌ | `S6_SMALL` | detail 6.322 (≥8), palette 0.36 (≥0.6), contrast 0.158 (≥0.2) |
| ✅ | `alice:front` | detail 16.368 palette 0.205 hueEntropy 1.701 contrast 0.211 hardEdge 0.174 dominant3 0.5207 |
| ✅ | `alice:threeQuarter` | detail 17.297 palette 0.199 hueEntropy 1.623 contrast 0.221 hardEdge 0.1803 dominant3 0.5014 |
| ✅ | `alice:face` | detail 8.602 palette 0.25 hueEntropy 1.732 contrast 0.236 hardEdge 0.1227 dominant3 0.3958 |
| ✅ | `alice:walk` | detail 18.748 palette 0.2 hueEntropy 1.52 contrast 0.232 hardEdge 0.1935 dominant3 0.43 |
| ❌ | `npc:sister` | detail 8.839 (≥12), contrast 0.164 (≥0.2) |
| ✅ | `npc:rabbit` | detail 21.231 palette 0.228 hueEntropy 2.337 contrast 0.214 hardEdge 0.1985 dominant3 0.2856 |

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
