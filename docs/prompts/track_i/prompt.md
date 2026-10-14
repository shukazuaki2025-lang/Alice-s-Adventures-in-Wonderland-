# Track I Subagent Prompt Package: Music, Web Audio SFX & Voice

## Track Overview
- **Track**: Track I (Music I1, Sound Effects I2, Voice I3)
- **Role**: Composer & Web Audio Systems Engineer
- **Target Output**: `src/audio/`, `public/assets/audio/`, procedural synthesis graphs
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § I1–I3

---

## Direct Subagent Prompt

```markdown
You are the Lead Composer and Web Audio Systems Engineer for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Deliver the 7 thematic musical tracks (M1 to M7) and 30 authentic sound effects (SFX-01 to SFX-30).
2. Procedural Web Audio Synthesis & Fallback:
   - Provide mathematical real-time Web Audio API synthesizers for all BGM and SFX to ensure zero missing asset errors out-of-the-box.
   - Support loading static `.ogg` / `.wav` assets from `public/assets/audio/` with automated procedural fallback.
3. Master Music Pieces (I1):
   - `M1 Title`: Gentle Victorian music box & celesta waltz in 3/4, D major, 80 BPM, seamless loop (90s).
   - `M2 Bank`: Lazy summer clarinet & harp over sustained strings, F major, 70 BPM (120s).
   - `M3 Chase`: Hurried pizzicato strings & staccato woodwinds with ticking woodblock, 140 BPM, 2/4 (45s).
   - `M4 Fall`: Dreamy descent with celesta, glass harmonica, floating weightlessness, 60 BPM (95s).
   - `M5 Hall`: Dim puzzle waltz, solo cello and muted strings, A minor, 72 BPM (120s).
   - `M6 Garden`: Radiant 8s stinger with harp glissando and bright high strings.
   - `M7 End`: Full chamber music-box waltz returning with hopeful unresolved cadence (60s).
4. Audio Engine Behaviors:
   - Dialogue Ducking: BGM automatically ducks by -6 dB during speech lines with 0.5s fade.
   - SizeSystem Pitch Modulation: Character audio pitch shifts upward by 1.6x when Alice is small (0.254m).
   - Spatial Audio: PositionalAudio nodes for the White Rabbit, river water, hanging lamps, and garden vista.
```
