/**
 * Objective "painterly richness" statistics for a screenshot, computed in a real browser canvas so no native image
 * decoder dependency is needed. Used by tools/quality-gate.mjs and tools/measure-reference.mjs.
 *
 * All metrics are measured on a 512 px wide downscale of the (optionally cropped) region, ignoring a flat background
 * colour (the colour of the top-left pixel and anything within tolerance of it) so empty space cannot pad the scores.
 *
 *   detail      mean |Laplacian(luma)| over subject pixels × 100        — painted texture / brush detail
 *   palette     distinct 4-bit/channel colours in the subject / 1000    — colour richness
 *   hueEntropy  Shannon entropy (bits) of the hue histogram, saturated pixels only
 *   saturation  mean HSV saturation of subject pixels (0..1)
 *   contrast    std-dev of luma on subject pixels (0..1)
 *   hardEdge    fraction of subject pixels with gradient > 0.30 — how "line-art / cel" it is (lower = softer, painterly)
 *   dominant3   share of subject pixels in the three most common 4-bit colours (lower = less flat)
 */
export const METRICS_SRC = /* js */ `
async function measure(dataUrl, crop) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const sx = crop ? crop.x : 0, sy = crop ? crop.y : 0;
  const sw = crop ? crop.w : img.width, sh = crop ? crop.h : img.height;
  const W = 512, H = Math.max(8, Math.round(512 * sh / sw));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const bg = [d[0], d[1], d[2]];
  const lum = new Float32Array(W * H), mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
    lum[i] = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    const near = Math.abs(r-bg[0]) + Math.abs(g-bg[1]) + Math.abs(b-bg[2]) < 18;
    mask[i] = near ? 0 : 1;
  }
  let n = 0, lap = 0, sum = 0, sum2 = 0, sat = 0, hard = 0;
  const bins = new Map(); const hue = new Float32Array(36); let hueN = 0;
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    const i = y*W + x; if (!mask[i]) continue;
    n++;
    const l = lum[i];
    lap += Math.abs(4*l - lum[i-1] - lum[i+1] - lum[i-W] - lum[i+W]);
    const gx = lum[i+1] - lum[i-1], gy = lum[i+W] - lum[i-W];
    if (Math.hypot(gx, gy) > 0.30) hard++;
    sum += l; sum2 += l*l;
    const r = d[i*4]/255, g = d[i*4+1]/255, b = d[i*4+2]/255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), df = mx - mn;
    const s = mx === 0 ? 0 : df / mx; sat += s;
    if (s > 0.15 && df > 0) {
      let h = mx === r ? ((g-b)/df) % 6 : mx === g ? (b-r)/df + 2 : (r-g)/df + 4; h = (h*60 + 360) % 360;
      hue[Math.floor(h/10) % 36]++; hueN++;
    }
    const key = ((d[i*4]>>4)<<8) | ((d[i*4+1]>>4)<<4) | (d[i*4+2]>>4);
    bins.set(key, (bins.get(key)||0) + 1);
  }
  if (n < 50) return { n, detail: 0, palette: 0, hueEntropy: 0, saturation: 0, contrast: 0, hardEdge: 0, dominant3: 1 };
  const mean = sum / n, std = Math.sqrt(Math.max(0, sum2/n - mean*mean));
  let ent = 0; for (const v of hue) if (v) { const p = v / hueN; ent -= p * Math.log2(p); }
  const top = [...bins.values()].sort((a,b)=>b-a).slice(0,3).reduce((a,b)=>a+b,0);
  return {
    n, detail: +(lap/n*100).toFixed(3), palette: +(bins.size/1000).toFixed(3), hueEntropy: +ent.toFixed(3),
    saturation: +(sat/n).toFixed(3), contrast: +std.toFixed(3), hardEdge: +(hard/n).toFixed(4), dominant3: +(top/n).toFixed(4),
  };
}
`;

/** Measure PNG/JPEG files with an already-launched Playwright browser. crops: { file: {x,y,w,h} } optional. */
export async function measureFiles(browser, files, crops = {}) {
  const fs = await import('node:fs');
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: METRICS_SRC });
  const out = {};
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const mime = f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
    const url = `data:${mime};base64,${buf.toString('base64')}`;
    out[f] = await page.evaluate(([u, c]) => window.measure(u, c), [url, crops[f] || null]);
  }
  await page.close();
  return out;
}
