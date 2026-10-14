#!/usr/bin/env node
/**
 * THE HARD GATE.  `npm run gate`
 *
 * Exit code 0 is the ONLY signal that the work is done. Anything else means: keep working, do not stop, do not hand over.
 * See docs/review/ROUND2_TASK.md for the rules this enforces.
 *
 *   npm run gate                # everything (≈30–40 min under a software GPU): typecheck, lint, unit, build, controls e2e, scene capture,
 *                               #   full e2e, model floors, painterly-richness bars, integrity, human-eye board + verdict
 *   npm run gate -- --quick     # iteration mode: skips the full e2e suite. A quick run can NEVER exit 0 (exit 2 at best).
 *   npm run gate -- --no-run    # evaluate the artefacts already on disk (models, screenshots, metrics) – seconds
 *
 * What it cannot be talked out of:
 *   - screenshots are re-measured from the PNG files themselves (not from numbers someone typed into a JSON),
 *   - thresholds may only be raised: the file is compared with the version in which it was first committed,
 *   - the measuring function is pinned by hash,
 *   - every scene screenshot must be distinct, and fresher than the newest source / asset change.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { measureFiles, METRICS_SRC } from './lib/image-metrics.mjs';
import { renderBoard } from './lib/board.mjs';
import { checkModels } from './check-assets.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GATE_DIR = path.join(ROOT, 'docs/devlog/gate');
const SCREENS = path.join(GATE_DIR, 'screens');
const LOGS = path.join(GATE_DIR, 'logs');
const THRESHOLDS_REL = 'docs/review/gate-thresholds.json';
const argv = process.argv.slice(2);
const QUICK = argv.includes('--quick');
const NO_RUN = argv.includes('--no-run');

const T = JSON.parse(fs.readFileSync(path.join(ROOT, THRESHOLDS_REL), 'utf8'));
const results = []; // { id, group, ok, detail }
const add = (group, id, ok, detail) => results.push({ group, id, ok, detail });
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const git = (cmd) => spawnSync('git', cmd.split(' '), { cwd: ROOT, encoding: 'utf8' });

// ------------------------------------------------------------------------------------------------ 1. run the suites
const env = { ...process.env, PW_NO_VIDEO: '1', CI: '' };
if (!env.PW_CHROMIUM_PATH && fs.existsSync('/opt/pw-browsers/chromium')) env.PW_CHROMIUM_PATH = '/opt/pw-browsers/chromium';

function step(id, cmd, args, group = 'suite') {
  const t0 = Date.now();
  process.stdout.write(`\n▶ ${id}: ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  fs.mkdirSync(LOGS, { recursive: true });
  fs.writeFileSync(path.join(LOGS, `${id}.log`), `${r.stdout || ''}\n${r.stderr || ''}`);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const ok = r.status === 0;
  const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-3).join(' | ').slice(0, 300);
  add(group, id, ok, ok ? `${secs}s` : `exit ${r.status} after ${secs}s — see docs/devlog/gate/logs/${id}.log :: ${tail}`);
  return ok;
}

if (!NO_RUN) {
  step('typecheck', 'npm', ['run', 'typecheck']);
  step('lint', 'npm', ['run', 'lint']);
  step('unit', 'npm', ['test']);
  step('build', 'npm', ['run', 'build']);
  step('controls-e2e', 'npx', ['playwright', 'test', 'tests/e2e/controls.spec.ts', '--reporter=line']);
  step('scene-capture', 'npx', ['playwright', 'test', 'tests/e2e/visual_parity.spec.ts', '--reporter=line']);
  if (!QUICK) step('full-e2e', 'npx', ['playwright', 'test', 'tier', 'screenshots', '--reporter=line']);
}

// ------------------------------------------------------------------------------------------------ 2. integrity
function direction(p) {
  const last = p[p.length - 1];
  if (['heightTol', 'loopToleranceDeg', 'antiPhaseCorr'].includes(last)) return 'down';
  if (['thighDeg', 'kneeDeg', 'armDeg', 'pelvisBob', 'boneDeg', 'movingBones', 'halfCycleMatch', 'trisMin'].includes(last)) return 'up';
  if (p.includes('min') || /^min/.test(last)) return 'up';
  if (p.includes('max') || /^max/.test(last)) return 'down';
  return null;
}
function ratchet(floor, cur, p, problems) {
  if (typeof floor === 'number') {
    const dir = direction(p);
    if (typeof cur !== 'number') problems.push(`${p.join('.')} was removed`);
    else if (dir === 'up' && cur < floor) problems.push(`${p.join('.')} lowered ${floor} → ${cur}`);
    else if (dir === 'down' && cur > floor) problems.push(`${p.join('.')} loosened ${floor} → ${cur}`);
  } else if (Array.isArray(floor) && floor.every((x) => typeof x === 'string')) {
    const have = new Set(Array.isArray(cur) ? cur : []);
    for (const x of floor) if (!have.has(x)) problems.push(`${p.join('.')} no longer requires "${x}"`);
  } else if (floor && typeof floor === 'object') {
    for (const k of Object.keys(floor)) {
      if (k.startsWith('_')) continue;
      if (cur === undefined || cur === null || !(k in cur)) problems.push(`${[...p, k].join('.')} was removed`);
      else ratchet(floor[k], cur[k], [...p, k], problems);
    }
  }
}

(function integrity() {
  const first = git(`log --diff-filter=A --format=%H -- ${THRESHOLDS_REL}`).stdout.trim().split('\n').filter(Boolean).pop();
  if (!first) {
    add('integrity', 'thresholds-floor', true, 'thresholds not committed yet — the first commit will become the permanent floor');
  } else {
    const shown = git(`show ${first}:${THRESHOLDS_REL}`);
    const problems = [];
    try {
      ratchet(JSON.parse(shown.stdout), T, [], problems);
    } catch (e) {
      problems.push(`cannot parse floor version: ${e.message}`);
    }
    // new relaxations are also visible as "removed" requirements above; report them all
    add('integrity', 'thresholds-floor', problems.length === 0,
      problems.length ? `thresholds weakened vs ${first.slice(0, 7)}: ${problems.slice(0, 6).join('; ')}` : `no threshold lowered since ${first.slice(0, 7)}`);
    try {
      const floorPin = JSON.parse(shown.stdout).integrity?.metricsSha256;
      if (floorPin && floorPin !== '__FILL__') {
        add('integrity', 'metrics-pin-floor', T.integrity.metricsSha256 === floorPin, `pin ${T.integrity.metricsSha256 === floorPin ? 'unchanged' : 'CHANGED — needs human sign-off'}`);
      }
    } catch { /* ignore */ }
  }
  const actual = sha256(METRICS_SRC);
  add('integrity', 'metrics-function', actual === T.integrity.metricsSha256,
    actual === T.integrity.metricsSha256 ? 'image-metrics.mjs matches the pinned hash' : `image-metrics.mjs METRICS_SRC changed (sha256 ${actual.slice(0, 12)}…) — the measuring stick may not be edited to pass`);
})();

// ------------------------------------------------------------------------------------------------ 3. models
for (const r of checkModels(T).rows) add('models', r.id, r.ok, r.detail);

// ------------------------------------------------------------------------------------------------ 4. visual bars (re-measured from the PNGs)
const ref = JSON.parse(fs.readFileSync(path.join(ROOT, T.reference.file), 'utf8'));
const tiles = [];
const metricsFile = path.join(GATE_DIR, 'visual-metrics.json');
let captured = null;
try { captured = JSON.parse(fs.readFileSync(metricsFile, 'utf8')); } catch { /* missing */ }

function newestSourceMtime() {
  let newest = 0;
  const walk = (d, filter) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, filter);
      else if (filter(p)) newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  walk(path.join(ROOT, 'src'), () => true);
  walk(path.join(ROOT, 'public/assets/models'), (p) => p.endsWith('.glb'));
  return newest;
}

function evalBars(label, m, mins, maxs, extra = {}) {
  const checks = [];
  const get = (k) => (k in extra ? extra[k] : m[k]);
  for (const [k, bar] of Object.entries(mins)) checks.push({ key: k, value: get(k), ok: get(k) >= bar, bar: `≥${bar}` });
  for (const [k, bar] of Object.entries(maxs)) checks.push({ key: k, value: get(k), ok: get(k) <= bar, bar: `≤${bar}` });
  const bad = checks.filter((c) => !c.ok);
  return { checks, bad, detail: bad.length ? bad.map((c) => `${c.key} ${c.value} (${c.bar})`).join(', ') : checks.map((c) => `${c.key} ${c.value}`).join(' ') };
}

if (!captured) {
  add('visual', 'capture-present', false, 'docs/devlog/gate/visual-metrics.json missing — run the scene-capture step (npm run gate)');
} else {
  const stale = newestSourceMtime() > Date.parse(captured.capturedAt) + 1000;
  add('visual', 'capture-fresh', !stale, stale ? 'src/ or a GLB changed after the last capture — re-run the capture (npm run gate)' : `captured ${captured.capturedAt}`);

  const jobs = [];
  for (const id of T.scenes.required) jobs.push({ id, file: path.join(SCREENS, `${id.toLowerCase()}.png`), mins: T.scenes.min, maxs: T.scenes.max, cap: captured.scenes?.[id], kind: 'scene' });
  for (const id of T.aliceViews.required) {
    const pv = T.aliceViews.perView?.[id];
    jobs.push({ id: `alice:${id}`, file: path.join(SCREENS, `alice_${id}.png`), mins: pv?.min ?? T.aliceViews.min, maxs: pv?.max ?? T.aliceViews.max, cap: captured.aliceViews?.[id], kind: 'alice' });
  }
  for (const id of T.npcViews.required) jobs.push({ id: `npc:${id}`, file: path.join(SCREENS, `npc_${id}.png`), mins: T.npcViews.min, maxs: T.npcViews.max, cap: captured.npcViews?.[id], kind: 'npc' });

  const present = jobs.filter((j) => fs.existsSync(j.file));
  for (const j of jobs.filter((x) => !fs.existsSync(x.file))) add('visual', j.id, false, `screenshot missing: ${path.relative(ROOT, j.file)}`);

  const browser = await chromium.launch({ executablePath: env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const measured = await measureFiles(browser, present.map((j) => j.file));
    const hashes = new Map();
    for (const j of present) {
      const h = sha256(fs.readFileSync(j.file));
      if (hashes.has(h)) add('visual', `${j.id}:distinct`, false, `identical to ${hashes.get(h)} — duplicate screenshots are not evidence`);
      hashes.set(h, j.id);
      const m = measured[j.file];
      const extra = j.kind === 'scene' ? { drawCalls: j.cap?.drawCalls ?? Infinity } : {};
      const r = evalBars(j.id, m, j.mins, j.maxs, extra);
      add('visual', j.id, r.bad.length === 0, r.detail);
      tiles.push({ title: j.id, file: j.file, metrics: m, checks: r.checks });
    }
    // human-eye board
    const refShow = Object.fromEntries(Object.entries(ref).filter(([k]) => ['fullFrame', 'planet', 'focal'].includes(k)));
    if (tiles.length) await renderBoard(browser, tiles, refShow, path.join(GATE_DIR, 'board.png'));
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------------------------- 5. human-eye verdict
  if (T.integrity.requireVerdict) {
    const vf = path.join(GATE_DIR, 'VERDICT.md');
    if (!fs.existsSync(vf)) {
      add('human', 'verdict', false, 'docs/devlog/gate/VERDICT.md missing — open board.png, compare with littleprince.dev, and write the scene-by-scene verdict (see ROUND2_TASK.md §7)');
    } else {
      const text = fs.readFileSync(vf, 'utf8');
      const fresh = fs.statSync(vf).mtimeMs >= Date.parse(captured.capturedAt) - 1000;
      const all = [...T.scenes.required, ...T.aliceViews.required.map((x) => `alice:${x}`), ...T.npcViews.required.map((x) => `npc:${x}`)];
      const missing = all.filter((id) => !text.includes(id));
      const verdict = /^\s*Verdict:\s*(PASS|FAIL)\b/im.exec(text);
      const ok = fresh && missing.length === 0 && !!verdict && verdict[1].toUpperCase() === 'PASS' && /littleprince/i.test(text);
      add('human', 'verdict', ok,
        ok ? 'VERDICT.md covers every scene and says PASS'
          : [!fresh && 'older than the last capture', missing.length && `no entry for ${missing.slice(0, 4).join(', ')}…`, !verdict && 'no "Verdict: PASS|FAIL" line',
              verdict && verdict[1].toUpperCase() !== 'PASS' && 'verdict is FAIL', !/littleprince/i.test(text) && 'does not reference the Little Prince comparison'].filter(Boolean).join('; '));
    }
  }
}

// ------------------------------------------------------------------------------------------------ 6. report
const failing = results.filter((r) => !r.ok);
const pass = failing.length === 0 && !QUICK && !NO_RUN;
const groups = [...new Set(results.map((r) => r.group))];
let md = `# Quality gate report\n\n- run: ${new Date().toISOString()}  \n- mode: ${QUICK ? 'QUICK (not valid for stopping)' : NO_RUN ? 'NO-RUN (artefacts only, not valid for stopping)' : 'FULL'}  \n- result: **${pass ? 'PASS' : 'FAIL'}** — ${results.length - failing.length}/${results.length} checks\n`;
for (const g of groups) {
  md += `\n## ${g}\n\n| | check | detail |\n|---|---|---|\n`;
  for (const r of results.filter((x) => x.group === g)) md += `| ${r.ok ? '✅' : '❌'} | \`${r.id}\` | ${r.detail.replace(/\|/g, '\\|')} |\n`;
}
md += `\n## Benchmark (littleprince.dev key art, same metrics)\n\n| frame | detail | palette | hueEntropy | saturation | contrast | hardEdge | dominant3 |\n|---|---|---|---|---|---|---|---|\n`;
for (const k of ['fullFrame', 'planet', 'focal']) if (ref[k]) md += `| ${k} | ${['detail', 'palette', 'hueEntropy', 'saturation', 'contrast', 'hardEdge', 'dominant3'].map((x) => ref[k][x]).join(' | ')} |\n`;
fs.mkdirSync(GATE_DIR, { recursive: true });
fs.writeFileSync(path.join(GATE_DIR, 'REPORT.md'), md);
const head = git('rev-parse --short HEAD').stdout.trim();
fs.writeFileSync(path.join(GATE_DIR, 'result.json'), JSON.stringify({ pass, quick: QUICK, noRun: NO_RUN, at: new Date().toISOString(), commit: head, failing: failing.map((f) => f.id) }, null, 2) + '\n');

const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + '='.repeat(100));
for (const g of groups) {
  console.log(`\n[${g}]`);
  for (const r of results.filter((x) => x.group === g)) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.id, 26)} ${r.detail.slice(0, 220)}`);
}
console.log('\n' + '='.repeat(100));
if (pass) {
  console.log(`GATE: PASS (${results.length}/${results.length}). The bar is met. docs/devlog/gate/board.png and VERDICT.md are the evidence to hand over.`);
  process.exit(0);
}
if (failing.length === 0) {
  console.log(`GATE: ${QUICK ? 'QUICK' : 'NO-RUN'} PASS — every evaluated check passed, but this mode is NOT a completion signal. Run \`npm run gate\` (full) before stopping.`);
  process.exit(2);
}
console.log(`GATE: FAIL — ${failing.length} of ${results.length} checks failing. DO NOT STOP. Do not hand over. Fix the cause (not the threshold) and run again.`);
console.log('Failing: ' + failing.map((f) => f.id).join(', '));
process.exit(1);
