# grade-light progress log (append-only)

Owner of `src/` for the picture-quality round. Levers: post grade (PaperGrain.ts), per-state lighting (SceneLighting.ts),
atmosphere, meadow/sky (S1). Measurements come from my own scratch captures (`tests/e2e/_scratch_gl.spec.ts`, honest replica
of the gate's scene captures: `/?test=1&forceWebGL=1&scale=1&msaa=4`, same hero positions and orbit, only `window.__game`).

## 2026-10-15 - start (continuation of the interrupted attempt)

State on disk when I started (commits `wip(art)` since a798fa2): post pass with split-toning / S-curve / bloom / clarity / paper
granulation + wash mottle, per-state grades (GRADE_DAY / WELL / PASSAGE / HALL) in SceneLighting.ts, painter-style aerial fog
(AtmosphericFog.ts), instanced painted light glows (LightGlows.ts), 12-species meadow atlas, cavern sky mode, dust motes.
The previous agent's last lab-hook captures (r9, paused loop + re-render) suggested most metrics were near/over the bars; the
honest numbers are unknown until the baseline capture below.
