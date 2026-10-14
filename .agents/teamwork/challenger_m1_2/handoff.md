# Empirical Challenge Report: Canonical Alignment & Invariant Specifications

**Agent**: `challenger_m1_2` (teamwork_preview_challenger)  
**Parent Orchestrator**: `teamwork_preview_orchestrator_1` (`96fcdb3d-2c70-4c56-b622-1b4e5ccd5a0b`)  
**Scope**: Canonical metric alignment across `CLAUDE.md`, `docs/bible.md`, `docs/ch1-design.md`, and `docs/google-doc-spec-v1.md`, and verification of Disney 1951 iconography prohibition.  
**Verdict**: **CHALLENGE_FAILED** (Milestone 1 documentation failed empirical verification on 4 distinct invariants and specifications).

---

## 1. Observation

Direct observations obtained by executing automated verification scripts, grep scans, and file audits across the workspace:

### 1.1 Automated Metric Dimensions Occurrence Matrix
Executed empirical parser over all specification documents:
```bash
python3 -c "
import re

files = {
    'CLAUDE.md': open('CLAUDE.md').read(),
    'docs/bible.md': open('docs/bible.md').read(),
    'docs/ch1-design.md': open('docs/ch1-design.md').read(),
    'docs/google-doc-spec-v1.md': open('docs/google-doc-spec-v1.md').read(),
}

specs = {
    'Alice normal height (1.20 m)': r'1\.20\s*m|1\.20\s*meters|1\.2\s*m',
    'Alice small height (0.254 m)': r'0\.254\s*m|0\.254\s*meters|10\s*inches',
    'Alice small scale (0.212)': r'0\.212|0\.2117',
    'Alice giant height (2.90 m / 2.9 m)': r'2\.90\s*m|2\.9\s*m|large.*2\.9',
    'Little door width (0.24 m)': r'0\.24\s*m',
    'Little door height (0.381 m)': r'0\.381\s*m',
    'Table height (0.72 m)': r'0\.72\s*m',
    'Table diameter (0.50 m)': r'0\.50\s*m|0\.5\s*m.*diameter|diameter.*0\.5',
    'Hall length (24.0 m)': r'24(\.0)?\s*m',
    'Hall width (7.0 m)': r'7(\.0)?\s*m',
    'Hall ceiling height (2.85 m)': r'2\.85\s*m',
}

for item, pattern in specs.items():
    print(f'Spec: {item}')
    for fname, content in files.items():
        matches = re.findall(pattern, content, re.IGNORECASE)
        print(f'  {fname:30s}: {len(matches)} match(es)')
"
```

**Results**:
- **Alice normal height (1.20 m)**:
  - `CLAUDE.md:72`: `| **Alice Normal Height** | 1.20 m |` -> **2 matches**
  - `docs/bible.md:18,107`: `Alice (Normal): 1.20 m height` -> **3 matches**
  - `docs/ch1-design.md:10,163,175`: `Normal Alice (1.20 m)` -> **4 matches**
  - `docs/google-doc-spec-v1.md:156,201,871,1192,1252`: `1.20 m` -> **10 matches**
- **Alice small height (0.254 m) & scale (0.212)**:
  - `CLAUDE.md:73`: `Alice Small Height | 0.254 m | 10 inches tall (scale factor 0.2117 ≈ 0.212)` -> **3 matches**
  - `docs/bible.md:18,108,109`: `0.254 m (10 in) height ... Size Scale Ratio: 0.2117 (≈ 0.212)` -> **5 matches**
  - `docs/ch1-design.md:10,128,163,175`: `0.254 meters ... scale 0.212` -> **9 matches**
  - `docs/google-doc-spec-v1.md:159,201,1252`: `0.254 m（缩放系数 0.212）` -> **4 matches**
- **Alice giant height (2.90 m)**:
  - `docs/google-doc-spec-v1.md:1252`: `1. 状态：normal（1.20 m）、small（0.254 m），之后会加 large（2.9 m）。每个状态对应 G3 里的一套参数。`
  - `PROJECT.md:59`: `aliceScale: 1.0 | 0.2117 | 2.417` ($1.20 \times 2.41666... = 2.90\text{ m}$)
  - `CLAUDE.md`: **0 matches** (Completely missing)
  - `docs/bible.md`: **0 matches** (Completely missing)
  - `docs/ch1-design.md`: **0 matches** (Completely missing)
- **Little door (0.24 m × 0.381 m)**:
  - `docs/google-doc-spec-v1.md:162,201,810,940`: `高 0.381 m，宽 0.24 m`
  - `CLAUDE.md:78`: `Little Door | Height 0.381 m (15 in), Width 0.24 m`
  - `docs/bible.md:116`: `Little Door: 0.24 m (W) × 0.381 m (15 in) (H)`
  - `docs/ch1-design.md:113,185`: **0 matches** for `0.24 m` and **0 matches** for `0.381 m`. Only referenced as "the 15-inch little door (`ch1_hall_door_little`)".
- **Solid glass table (Height 0.72 m, Diameter 0.50 m)**:
  - `docs/google-doc-spec-v1.md:168,201,789,939`: `高 0.72 m，桌面直径 0.50 m`
  - `CLAUDE.md:76`: `Solid Glass 3-Legged Table | Height 0.72 m, Top Dia 0.50 m`
  - `docs/bible.md:113`: `Solid Glass Table: 0.72 m height, 0.50 m diameter`
  - `docs/ch1-design.md:130`: Mentions `tabletop (height 0.72m)`. **0 matches** for diameter `0.50 m`.
- **Hall of Doors (24.0 m × 7.0 m × 2.85 m)**:
  - `docs/google-doc-spec-v1.md:174,201`: `长 24 m，宽 7 m，天花板高 2.85 m`
  - `CLAUDE.md:80`: `Long Hall Shell | Length 24.0 m, Width 7.0 m, Ceiling 2.85 m`
  - `docs/bible.md:111`: `Long Hall Shell: 24.0 m (L) × 7.0 m (W) × 2.85 m (H)`
  - `docs/ch1-design.md:105`: `length 24.0m (along X-axis), width 7.0m, ceiling height 2.85m`

### 1.2 Disney 1951 Iconography & Non-Derivation Audit
- In `CLAUDE.md:55-59` and `docs/bible.md:28-32`: Disney 1951, Tim Burton 2010, American McGee, light-blue dress + black hairband are explicitly prohibited. Canonical Alice is defined with wheat-yellow dress (`#E9C46A`), white apron (`#F7F3EA`), and navy ribbon (`#2E3F6E`).
- In `PROMPTS_CHAPTER_01.md:6` (in the root workspace, committed to git):
  - Line 6: `美学与基调：维多利亚哥特暗黑童话（对标《Alice: Madness Returns 爱丽丝：疯狂回归》×《Little Nightmares 小小梦魇》× 蒂姆·伯顿式诡谲解剖美学...）`
  - Line 60: Implements a sentient character on the 15-inch door: `【竖瞳黄铜门环（The Weeping Doorknob）】是一个半疯癫的古老守门灵` — this is a direct derivation of Disney's 1951 animated adaptation (the talking doorknob was created by Disney and is entirely absent from Lewis Carroll's 1865 original).

### 1.3 Invariant Clash Between Track J Prompt and Chapter 1 Design Doc
- In `docs/prompts/track_j/prompt.md:31-32`:
  - `INV-04`: Cake consumption increases scale to exactly 2.743m (9 feet).
  - `INV-05`: Fan pickup causes gradual shrink back to 0.60m -> 0.254m.
- In `docs/ch1-design.md:143-145` and `163-164`:
  - In Chapter 1, Alice eats the cake and **remains the same size** (0.254 m). Growing to 9 feet and picking up the White Rabbit's fan are Chapter 2 events.
  - `INV-04` is defined as: 2.5s shrinking transition to 0.254m (scale 0.2117).
  - `INV-05` is defined as: 2-sided bottle inspection verification.

---

## 2. Logic Chain

1. **Premise 1**: The Project Master Blueprint (`PROJECT.md`) and Chapter Specification (`docs/google-doc-spec-v1.md`) define project invariants that must be uniformly propagated across all primary reference documents (`CLAUDE.md`, `docs/bible.md`, `docs/ch1-design.md`).
2. **Observation 1**: `google-doc-spec-v1.md:1252` establishes Alice's three physical scale states: `normal (1.20 m)`, `small (0.254 m)`, and `large (2.9 m)`. `PROJECT.md:59` establishes `aliceScale: 1.0 | 0.2117 | 2.417` (corresponding to 1.20m, 0.254m, and 2.90m).
3. **Inference 1**: `CLAUDE.md`, `docs/bible.md`, and `docs/ch1-design.md` completely fail to document Alice's giant height (2.90 m / scale 2.417). Any downstream Track B/Track H engineer referring exclusively to `CLAUDE.md` or `docs/bible.md` will lack the canonical giant constant.
4. **Observation 2**: `docs/ch1-design.md` fails to specify the metric width and height (0.24 m × 0.381 m) for the Little Door, and fails to specify the diameter (0.50 m) for the solid glass table.
5. **Inference 2**: A developer or level designer reading `docs/ch1-design.md` cannot determine the collision bounds or doorway aperture without cross-referencing external files.
6. **Observation 3**: The repository contains an active file `PROMPTS_CHAPTER_01.md` containing prohibited American McGee / Tim Burton / Dark Gothic styling and Disney 1951 talking doorknob tropes.
7. **Inference 3**: Unless deleted or formally superseded, `PROMPTS_CHAPTER_01.md` creates documentation confusion for subagents and risks contaminating AI prompts with copyrighted 1951 Disney tropes.
8. **Observation 4**: `docs/prompts/track_j/prompt.md` specifies Chapter 2 mechanics (growing to 9 feet upon cake consumption, fan pickup) under Chapter 1 invariant numbers `INV-04` and `INV-05`, conflicting directly with `docs/ch1-design.md` §3.
9. **Inference 4**: If Track J implements E2E assertions expecting Alice to grow to 9 feet after eating the Chapter 1 currant cake, all E2E automated tests will fail, soft-locking Milestone 5/6 delivery.

---

## 3. Adversarial Challenges

### Challenge 1 [HIGH]: Omission of Giant Height Constant (2.90 m)
- **Assumption challenged**: That `CLAUDE.md`, `docs/bible.md`, and `docs/ch1-design.md` provide a complete specification of Alice's canonical dimensions matching `docs/google-doc-spec-v1.md`.
- **Attack scenario**: Subagent implementing Track H (`SizeSystem`) or Track B (`chr_alice.glb` morph targets) builds the scale state machine based on `CLAUDE.md` Section 4 table, which only contains Normal (1.20m) and Small (0.254m). The `large` state (2.90m / scale 2.417) is omitted, causing interface incompatibility with `PROJECT.md` (`aliceScale: 1.0 | 0.2117 | 2.417`).
- **Blast radius**: `SizeSystem` refactoring required in Milestone 4; possible scale clipping or physics controller instability when transitioning to Chapter 2.
- **Mitigation**: Add `Alice Giant Height: 2.90 m (scale factor 2.417)` to `CLAUDE.md:74`, `docs/bible.md:110`, and `docs/ch1-design.md:163`.

### Challenge 2 [MEDIUM]: Missing Door & Table Dimensions in `docs/ch1-design.md`
- **Assumption challenged**: That `docs/ch1-design.md` is self-contained with respect to physical scene metrics.
- **Attack scenario**: Level design agent or collision tester inspects `docs/ch1-design.md` for `ch1_hall_door_little` and finds only "15-inch little door" without width (0.24m) or height (0.381m), and table diameter (0.50m) is unstated.
- **Blast radius**: Misaligned physics colliders in Track D/E.
- **Mitigation**: Update `docs/ch1-design.md` Section 2 (S5) to explicitly include `width 0.24 m × height 0.381 m` for the door and `diameter 0.50 m` for the table.

### Challenge 3 [HIGH]: Disney 1951 Talking Doorknob Contamination in `PROMPTS_CHAPTER_01.md`
- **Assumption challenged**: That all documentation strictly enforces prohibition of Disney 1951 iconography.
- **Attack scenario**: A prompt generator or LLM subagent indexes `PROMPTS_CHAPTER_01.md` in the root workspace and generates 3D models or dialogue for "The Weeping Doorknob", directly introducing Disney 1951 copyrighted concepts and American McGee dark gore into a project whose master rule is pure 1865 Carroll fidelity.
- **Blast radius**: Complete copyright violation and thematic failure of the project's core visual mandate.
- **Mitigation**: Delete `PROMPTS_CHAPTER_01.md` or prepend an explicit deprecation banner directing all agents exclusively to `docs/prompts/track_{a..k}/prompt.md`.

### Challenge 4 [HIGH]: Invariant Definition Collision in Track J Prompt
- **Assumption challenged**: That subagent prompt packages are harmonized with the Game Design Document.
- **Attack scenario**: Track J test engineer writes Playwright test `assert(alice.height === 2.743)` upon eating the cake based on `docs/prompts/track_j/prompt.md:31`. The test permanently fails because in `docs/ch1-design.md:144` Alice remains 0.254m in Chapter 1.
- **Blast radius**: Broken CI test pipeline blocking Milestone 4/5 integration.
- **Mitigation**: Update `docs/prompts/track_j/prompt.md` to align `INV-01` through `INV-07` with `docs/ch1-design.md` Section 3.

---

## 4. Stress Test Results Summary

| Test Dimension / Item | Target Spec (`google-doc-spec-v1.md`) | `CLAUDE.md` | `docs/bible.md` | `docs/ch1-design.md` | Result |
|---|---|---|---|---|---|
| Alice Normal Height | `1.20 m` | `1.20 m` | `1.20 m` | `1.20 m` | **PASS** |
| Alice Small Height | `0.254 m` (scale 0.212) | `0.254 m` (scale 0.212) | `0.254 m` (scale 0.212) | `0.254 m` (scale 0.212) | **PASS** |
| Alice Giant Height | `2.90 m` / `2.9 m` (§G7:1252) | *Omitted* | *Omitted* | *Omitted* | **FAIL** |
| Little Door | `0.24 m × 0.381 m` | `0.24 m × 0.381 m` | `0.24 m × 0.381 m` | *Only "15-inch"* | **FAIL (Partial)** |
| Glass Table | `H 0.72 m, Dia 0.50 m` | `H 0.72 m, Dia 0.50 m` | `H 0.72 m, Dia 0.50 m` | `H 0.72 m, Dia unstated` | **FAIL (Partial)** |
| Hall of Doors | `24.0 m × 7.0 m × 2.85 m` | `24.0 m × 7.0 m × 2.85 m` | `24.0 m × 7.0 m × 2.85 m` | `24.0 m × 7.0 m × 2.85 m` | **PASS** |
| Disney 1951 Prohibition | Strict ban, No blue dress/band | Banned (§3.2) | Banned (§2.1) | Implied compliant | **FAIL** (`PROMPTS_CHAPTER_01.md` introduces Weeping Doorknob) |
| Invariant Synchronization | Canonical Carroll 1865 Ch 1 | Compliant | Compliant | Canonical | **FAIL** (`track_j/prompt.md` has Ch 2 cake/fan mechanics) |

---

## 5. Caveats

- `worker_m1` has successfully established the build pipeline (`npm run typecheck`, `npm run lint`, and `npm run build` all pass with exit code 0).
- The omission of Alice giant height (2.90 m) in Chapter 1 documents is understandable given that Chapter 1 gameplay does not include the giant growth sequence, but it is an invariant failure against `google-doc-spec-v1.md` §G7 and `PROJECT.md` line 59.
- `PROMPTS_CHAPTER_01.md` appears to be a legacy draft committed prior to the instantiation of the Project Bible, but its continued presence in the repository root without deprecation constitutes an empirical risk.

---

## 6. Conclusion & Verdict

### Final Verdict: **CHALLENGE_FAILED**

The Milestone 1 work product **fails empirical verification** due to 4 concrete, reproducible discrepancies:
1. **Omission of Giant Height Standard**: Alice giant height (`2.90 m` / scale `2.417`), specified in `docs/google-doc-spec-v1.md:1252` and `PROJECT.md:59`, is absent from `CLAUDE.md`, `docs/bible.md`, and `docs/ch1-design.md`.
2. **Missing Dimensional Precision in GDD**: `docs/ch1-design.md` fails to specify the metric width and height for the little door (`0.24 m × 0.381 m`) and the diameter for the glass table (`0.50 m`).
3. **Disney 1951 & Gothic Contamination**: Root repository file `PROMPTS_CHAPTER_01.md` violates anti-Disney and non-derivation rules by introducing the "Weeping Doorknob" (Disney 1951) and American McGee / Tim Burton gothic tropes.
4. **Invariant Collision**: `docs/prompts/track_j/prompt.md` defines `INV-04` and `INV-05` using Chapter 2 mechanics (cake growing to 9ft, fan shrinking), directly contradicting `docs/ch1-design.md`.

**Actionable Remediation Required**:
- Update `CLAUDE.md` and `docs/bible.md` to append the canonical `Alice Giant Height: 2.90 m (scale 2.417)`.
- Update `docs/ch1-design.md` Section 2 to add door dimensions `0.24 m × 0.381 m` and table diameter `0.50 m`.
- Archive or delete `PROMPTS_CHAPTER_01.md` to prevent subagent contamination.
- Harmonize `docs/prompts/track_j/prompt.md` invariants `INV-04` and `INV-05` with `docs/ch1-design.md` § 3.

---

## 7. Verification Method

To independently reproduce all empirical findings:

1. **Verify Metric Dimension Omissions**:
   ```bash
   python3 -c "
   import re
   for f in ['CLAUDE.md', 'docs/bible.md', 'docs/ch1-design.md']:
       c = open(f).read()
       print(f'{f}: giant matches = {len(re.findall(r\"2\.90?m|large.*2\.9\", c, re.I))}, door 0.381m = {len(re.findall(r\"0\.381\", c))}, table 0.50m = {len(re.findall(r\"0\.50?m.*diameter|diameter.*0\.5\", c, re.I))}')
   "
   ```
   *Expected: `giant matches = 0` for all 3 files; `door 0.381m = 0` and `table 0.50m = 0` for `docs/ch1-design.md`.*

2. **Verify Disney 1951 Talking Doorknob Presence**:
   ```bash
   grep -n "Doorknob" PROMPTS_CHAPTER_01.md
   ```
   *Expected: Line 60 matches `The Weeping Doorknob`.*

3. **Verify Invariant Collision in Track J**:
   ```bash
   grep -n -E "INV-04|INV-05" docs/prompts/track_j/prompt.md docs/ch1-design.md
   ```
   *Expected: Conflicting definitions between Track J (9 feet cake growth) and Ch1 Design (2.5s shrinking transition).*
