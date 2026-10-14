/**
 * Renders the human-eye comparison board (docs/devlog/gate/board.png): every captured scene / character view as a tile,
 * with its measured numbers coloured green (meets the bar) or red (below it), next to the benchmark reference numbers.
 * The board is the artefact a person looks at to judge "is this really at the Little Prince level?" — the numbers only
 * prove it is not obviously worse.
 */
import fs from 'node:fs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * @param browser  launched Playwright browser
 * @param tiles    [{ title, file, metrics, checks: [{ key, value, ok, bar }] }]
 * @param ref      { fullFrame: {...}, planet: {...}, focal: {...} }  benchmark numbers
 * @param outFile  PNG path
 */
export async function renderBoard(browser, tiles, ref, outFile) {
  const cell = (t) => {
    const img = fs.existsSync(t.file) ? `data:image/png;base64,${fs.readFileSync(t.file).toString('base64')}` : '';
    const rows = t.checks
      .map((c) => `<span class="${c.ok ? 'ok' : 'bad'}">${esc(c.key)} ${typeof c.value === 'number' ? c.value : esc(c.value)} <i>${esc(c.bar)}</i></span>`)
      .join('');
    return `<figure><img src="${img}"><figcaption><b>${esc(t.title)}</b><div class="m">${rows}</div></figcaption></figure>`;
  };
  const refRow = (name, m) =>
    `<tr><td>${esc(name)}</td>${['detail', 'palette', 'hueEntropy', 'saturation', 'contrast', 'hardEdge', 'dominant3'].map((k) => `<td>${m[k]}</td>`).join('')}</tr>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#2a2320;color:#f1e8d8;font:13px/1.35 Georgia,serif;width:1960px}
    h1{margin:0;padding:14px 20px;font-size:20px;background:#1b1512}
    .grid{display:grid;grid-template-columns:repeat(3,640px);gap:10px;padding:10px 20px}
    figure{margin:0;background:#1b1512;border-radius:6px;overflow:hidden}
    img{display:block;width:640px;height:360px;object-fit:contain;background:#111}
    figcaption{padding:6px 8px}.m{display:flex;flex-wrap:wrap;gap:2px 10px;font:11px monospace;margin-top:3px}
    .ok{color:#9fd88a}.bad{color:#ff8f7a}i{color:#9a8f80;font-style:normal}
    table{margin:6px 20px 16px;border-collapse:collapse;font:12px monospace}td,th{padding:2px 10px;border-bottom:1px solid #3d332d;text-align:right}
    td:first-child,th:first-child{text-align:left}
  </style>
  <h1>Alice: Down the Rabbit-Hole — quality gate board &nbsp;·&nbsp; green = meets the bar, red = below it</h1>
  <div class="grid">${tiles.map(cell).join('')}</div>
  <table><tr><th>benchmark (littleprince.dev key art)</th><th>detail</th><th>palette</th><th>hueEntropy</th><th>saturation</th><th>contrast</th><th>hardEdge</th><th>dominant3</th></tr>
  ${Object.entries(ref).map(([k, v]) => refRow(k, v)).join('')}</table>`;
  const page = await browser.newPage({ viewport: { width: 1960, height: 800 } });
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: outFile, fullPage: true });
  await page.close();
}
