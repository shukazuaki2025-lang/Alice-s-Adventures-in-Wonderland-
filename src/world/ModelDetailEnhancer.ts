import * as THREE from 'three';

/**
 * Deterministic PRNG (Mulberry32) so all procedural gouache textures and 3D mesh refinements are 100% reproducible.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const textureCache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  return [c, ctx];
}

function toTexture(key: string, canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Paints multi-hue gouache dabs and Tenniel woodcut cross-hatching onto a 2D canvas context.
 */
function paintGouacheDabsAndHatching(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  palette: string[],
  dabCount: number,
  hatchAlpha = 0.24
): void {
  const rng = mulberry32(seed);
  for (let i = 0; i < dabCount; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const rx = 4 + rng() * 18;
    const ry = 2 + rng() * 9;
    const rot = rng() * Math.PI;
    ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
    ctx.globalAlpha = 0.18 + rng() * 0.34;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tenniel woodcut engraving cross-hatch strokes
  if (hatchAlpha > 0) {
    ctx.strokeStyle = '#241C18';
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = hatchAlpha;
    const clusters = Math.floor(dabCount * 0.25);
    for (let c = 0; c < clusters; c++) {
      const cx = rng() * w;
      const cy = rng() * h;
      const ang = (rng() < 0.5 ? 0.65 : -0.65) + (rng() - 0.5) * 0.2;
      const dx = Math.cos(ang) * 14;
      const dy = Math.sin(ang) * 14;
      const nx = -Math.sin(ang) * 3.2;
      const ny = Math.cos(ang) * 3.2;
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(cx + nx * k - dx, cy + ny * k - dy);
        ctx.lineTo(cx + nx * k + dx, cy + ny * k + dy);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;
}

/**
 * High-contrast hand-painted gouache + woodcut texture for Sister's pleated skirt (`M_Sister_Skirt`).
 * Features deep box-pleat shading, 3 ivory-cream lace flounce tiers, woven linen threads, and wildflower embroidery.
 */
export function getSisterSkirtTexture(): THREE.CanvasTexture | null {
  const key = 'Sister_Skirt_HD';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const pair = makeCanvas(1024, 1024);
  if (!pair) return null;
  const [c, g] = pair;
  const S = 1024;
  const rng = mulberry32(1862);

  // Base sage-emerald linen wash
  g.fillStyle = '#5B8048';
  g.fillRect(0, 0, S, S);

  // Vertical box-pleat shading (u runs 0..1 per pleat when u_repeat=11)
  for (let x = 0; x < S; x++) {
    const u = x / S;
    const pleat = 0.5 + 0.5 * Math.cos(2 * Math.PI * (u + 0.5));
    const sub = 0.5 + 0.5 * Math.cos(6 * Math.PI * (u + 0.25));
    if (pleat < 0.48) {
      const dark = Math.pow(1 - pleat / 0.48, 1.15);
      g.fillStyle = `rgba(24, 42, 22, ${(0.78 * dark).toFixed(3)})`;
      g.fillRect(x, 0, 1, S);
    } else {
      const lit = Math.pow((pleat - 0.48) / 0.52, 1.1) * (0.65 + 0.35 * sub);
      g.fillStyle = `rgba(218, 236, 168, ${(0.72 * lit).toFixed(3)})`;
      g.fillRect(x, 0, 1, S);
    }
  }

  // Gouache multi-hue dabs & woodcut cross-hatching in fold valleys
  paintGouacheDabsAndHatching(
    g,
    S,
    S,
    861,
    ['#3A5F32', '#7BA362', '#BBD68E', '#3D7068', '#8F7A42', '#233A1E'],
    900,
    0.38
  );

  // Woven linen warp & weft lines
  g.strokeStyle = 'rgba(245, 240, 220, 0.18)';
  g.lineWidth = 1;
  for (let i = 0; i < S; i += 6) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, S);
    g.moveTo(0, i);
    g.lineTo(S, i);
    g.stroke();
  }

  // Three horizontal ivory-cream Victorian lace flounces with dark walnut under-shadow & scalloped eyelets
  const tiers = [0.16, 0.46, 0.76];
  for (const vt of tiers) {
    const yCenter = vt * S;
    const bandH = 68;
    // Deep cast shadow directly beneath the flounce
    g.fillStyle = 'rgba(22, 30, 18, 0.88)';
    g.fillRect(0, yCenter + bandH * 0.45, S, 20);

    // Cream lace ribbon body
    g.fillStyle = '#FAF2DE';
    g.beginPath();
    g.moveTo(0, yCenter - bandH * 0.5);
    for (let x = 0; x <= S; x += 8) {
      const scallop = Math.abs(Math.sin((x / S) * 16 * Math.PI)) * 16;
      g.lineTo(x, yCenter + bandH * 0.42 + scallop);
    }
    g.lineTo(S, yCenter - bandH * 0.5);
    g.closePath();
    g.fill();

    // Walnut-ink top stitching and eyelet perforations
    g.strokeStyle = '#2B2420';
    g.lineWidth = 3.0;
    g.beginPath();
    g.moveTo(0, yCenter - bandH * 0.48);
    g.lineTo(S, yCenter - bandH * 0.48);
    g.stroke();

    for (let x = 16; x < S; x += 32) {
      // Dark eyelet diamond
      g.fillStyle = '#2A3E24';
      g.beginPath();
      g.arc(x, yCenter - 4, 6.5, 0, Math.PI * 2);
      g.fill();
      // Embroidered floral rosette beside each eyelet
      g.fillStyle = (x / 32) % 2 === 0 ? '#D64E52' : '#4A78B8';
      g.beginPath();
      g.arc(x + 16, yCenter - 16, 5.0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#F2C94C';
      g.beginPath();
      g.arc(x + 16, yCenter - 16, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Botanical wildflower sprigs scattered between tiers
  const flowerCols = ['#FFFDF4', '#E86A68', '#F4C842', '#6492D8', '#E8A2C4'];
  for (let i = 0; i < 240; i++) {
    const fx = rng() * S;
    const fy = rng() * S;
    const col = flowerCols[i % flowerCols.length];
    g.strokeStyle = '#284220';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(fx, fy + 10);
    g.lineTo(fx, fy);
    g.stroke();
    g.fillStyle = col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(fx + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 2.8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#E6A822';
    g.beginPath();
    g.arc(fx, fy, 2.2, 0, Math.PI * 2);
    g.fill();
  }

  return toTexture(key, c);
}

/**
 * High-relief cream crochet shawl texture (`M_Sister_Shawl`).
 */
export function getSisterShawlTexture(): THREE.CanvasTexture | null {
  const key = 'Sister_Shawl_HD';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const pair = makeCanvas(1024, 1024);
  if (!pair) return null;
  const [c, g] = pair;
  const S = 1024;

  g.fillStyle = '#FBF4E2';
  g.fillRect(0, 0, S, S);

  paintGouacheDabsAndHatching(g, S, S, 821, ['#FFFDF8', '#EADBC0', '#D4C29E', '#8C7658'], 450, 0.25);

  // High-contrast openwork crochet rosettes and diagonal lattice
  const step = 64;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      const cx = x + step * 0.5;
      const cy = y + step * 0.5;
      // Dark shadow recess openings
      g.fillStyle = '#2D2218';
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, 6.5, 3.8, a, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(cx, cy, 5.5, 0, Math.PI * 2);
      g.fill();

      // Raised ivory crochet yarn rings
      g.strokeStyle = '#FFFDF9';
      g.lineWidth = 3.2;
      g.beginPath();
      g.arc(cx, cy, 10.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, 24, 0, Math.PI * 2);
      g.stroke();

      // Walnut-ink contour shadow around yarn
      g.strokeStyle = '#4A3928';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(cx, cy, 26.5, 0, Math.PI * 2);
      g.stroke();
    }
  }

  return toTexture(key, c);
}

/**
 * High-contrast pintuck bodice & sleeve texture (`M_Sister_Dress`).
 */
export function getSisterDressTexture(): THREE.CanvasTexture | null {
  const key = 'Sister_Dress_HD';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const pair = makeCanvas(1024, 1024);
  if (!pair) return null;
  const [c, g] = pair;
  const S = 1024;

  g.fillStyle = '#557844';
  g.fillRect(0, 0, S, S);

  // Pintuck vertical pleats
  for (let x = 0; x < S; x += 32) {
    g.fillStyle = '#24381C';
    g.fillRect(x, 0, 7, S);
    g.fillStyle = '#C2DA96';
    g.fillRect(x + 7, 0, 10, S);
  }

  paintGouacheDabsAndHatching(g, S, S, 811, ['#345228', '#7FA464', '#D2E4AA', '#2B3E22'], 550, 0.35);

  // Cream lace bands at top & bottom (collar / cuffs)
  g.fillStyle = '#FAF2DE';
  g.fillRect(0, 0, S, 96);
  g.fillRect(0, S - 96, S, 96);
  g.strokeStyle = '#2B2420';
  g.lineWidth = 4;
  g.strokeRect(0, 96, S, S - 192);

  return toTexture(key, c);
}

/**
 * Multi-toned herringbone oak/walnut/cherry parquet texture (`M_S5_Parquet`) with crisp board seams and wood grain.
 */
export function getHallParquetTexture(): THREE.CanvasTexture | null {
  const key = 'S5_Parquet_HD';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const pair = makeCanvas(1024, 1024);
  if (!pair) return null;
  const [c, g] = pair;
  const S = 1024;
  const rng = mulberry32(1905);

  const woodTones = [
    '#B88454', // warm honey oak
    '#7E5232', // dark walnut
    '#9E6440', // cherry sienna
    '#CBA06C', // pale ash gold
    '#684836', // smoked chestnut
    '#8A6E5A', // cool weathered oak
  ];

  g.fillStyle = '#8C623E';
  g.fillRect(0, 0, S, S);

  const cols = 16;
  const rows = 32;
  const cw = S / cols;
  const rh = S / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw;
      const y = r * rh;
      const tone = woodTones[(r * 3 + col * 5 + Math.floor(rng() * 3)) % woodTones.length];
      g.fillStyle = tone;
      g.fillRect(x, y, cw, rh);

      // Highlight bevel on top/left, deep shadow seam on bottom/right
      g.fillStyle = 'rgba(255, 242, 214, 0.32)';
      g.fillRect(x + 2, y + 2, cw - 4, 3);
      g.fillStyle = 'rgba(28, 18, 14, 0.78)';
      g.fillRect(x, y + rh - 3, cw, 3);
      g.fillRect(x + cw - 3, y, 3, rh);

      // Fine wood-grain pores and knots inside each plank (crucial for S6_SMALL macro view)
      g.strokeStyle = rng() < 0.5 ? 'rgba(42, 26, 18, 0.45)' : 'rgba(248, 224, 180, 0.35)';
      g.lineWidth = 1.2;
      for (let s = 0; s < 5; s++) {
        const gy = y + 4 + ((s + 0.5) / 5) * (rh - 8);
        g.beginPath();
        g.moveTo(x + 3, gy);
        g.bezierCurveTo(x + cw * 0.33, gy + (rng() - 0.5) * 4, x + cw * 0.66, gy + (rng() - 0.5) * 4, x + cw - 3, gy);
        g.stroke();
      }
    }
  }

  // Subtle multi-hue gouache reflection dabs (cerulean, emerald, violet, rose, gold) from stained-glass / lamps
  paintGouacheDabsAndHatching(
    g,
    S,
    S,
    551,
    ['#4A80B4', '#4C9872', '#7E5898', '#D46A58', '#E8BD58', '#2E2018'],
    650,
    0.28
  );

  return toTexture(key, c);
}

/**
 * Intricate polychrome Persian/Victorian runner carpet texture (`M_S5_Runner`) with fine weave visible in S6_SMALL.
 */
export function getHallRunnerTexture(): THREE.CanvasTexture | null {
  const key = 'S5_Runner_HD';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const pair = makeCanvas(1024, 512);
  if (!pair) return null;
  const [c, g] = pair;
  const W = 1024;
  const H = 512;

  // Deep madder crimson base
  g.fillStyle = '#88242C';
  g.fillRect(0, 0, W, H);

  // Outer saffron gold, emerald, and royal cobalt borders
  g.fillStyle = '#E2B448';
  g.fillRect(0, 0, W, 36);
  g.fillRect(0, H - 36, W, 36);

  g.fillStyle = '#1E4E7A';
  g.fillRect(0, 36, W, 44);
  g.fillRect(0, H - 80, W, 44);

  g.fillStyle = '#2E7854';
  g.fillRect(0, 80, W, 24);
  g.fillRect(0, H - 104, W, 24);

  // Geometric floral border motifs along top and bottom
  for (let x = 16; x < W; x += 32) {
    g.fillStyle = (x / 32) % 2 === 0 ? '#FAF0D6' : '#E8B84A';
    g.beginPath();
    g.arc(x, 58, 12, 0, Math.PI * 2);
    g.arc(x, H - 58, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#C83E4B';
    g.beginPath();
    g.arc(x, 58, 5, 0, Math.PI * 2);
    g.arc(x, H - 58, 5, 0, Math.PI * 2);
    g.fill();
  }

  // Central repeating Persian medallions in cobalt, turquoise, emerald, violet, and ivory
  for (let mx = 80; mx < W; mx += 160) {
    const cy = H * 0.5;
    // Outer ivory diamond
    g.fillStyle = '#F7EFE0';
    g.beginPath();
    g.moveTo(mx, cy - 118);
    g.lineTo(mx + 68, cy);
    g.lineTo(mx, cy + 118);
    g.lineTo(mx - 68, cy);
    g.closePath();
    g.fill();

    // Inner cobalt & turquoise star
    g.fillStyle = '#225A8E';
    g.beginPath();
    g.moveTo(mx, cy - 92);
    g.lineTo(mx + 50, cy);
    g.lineTo(mx, cy + 92);
    g.lineTo(mx - 50, cy);
    g.closePath();
    g.fill();

    g.fillStyle = '#38988A';
    g.beginPath();
    g.arc(mx, cy, 34, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#E8BD4A';
    g.beginPath();
    g.arc(mx, cy, 18, 0, Math.PI * 2);
    g.fill();

    // Corner emerald & amethyst florets
    for (const [dx, dy] of [[-52, -78], [52, -78], [-52, 78], [52, 78]]) {
      g.fillStyle = '#6A4288';
      g.beginPath();
      g.arc(mx + dx, cy + dy, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#48A264';
      g.beginPath();
      g.arc(mx + dx, cy + dy, 8, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Fine woven carpet knot grid (gives crisp 4px detail in S6_SMALL)
  g.strokeStyle = 'rgba(26, 16, 20, 0.35)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 6) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  for (let y = 0; y < H; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }

  return toTexture(key, c);
}

/**
 * William Morris-inspired polychrome botanical damask wallpaper (`M_S5_Wallpaper`).
 */
export function getHallWallpaperTexture(): THREE.CanvasTexture | null {
  const key = 'S5_Wallpaper_HD';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const pair = makeCanvas(1024, 1024);
  if (!pair) return null;
  const [c, g] = pair;
  const S = 1024;

  // Deep teal-slate ground
  g.fillStyle = '#2B4C58';
  g.fillRect(0, 0, S, S);

  paintGouacheDabsAndHatching(
    g,
    S,
    S,
    561,
    ['#36606E', '#487A68', '#5E4B78', '#8E6846', '#D4A854', '#223842'],
    800,
    0.25
  );

  // Repeating botanical lattice (acanthus leaves, Tudor roses, cobalt delphiniums, golden stems)
  const step = 128;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      const cx = x + step * 0.5;
      const cy = y + step * 0.5;

      // Golden-olive scrolling vines
      g.strokeStyle = '#C8A654';
      g.lineWidth = 4.0;
      g.beginPath();
      g.arc(cx, cy, 48, 0, Math.PI * 2);
      g.stroke();

      // Sage & emerald acanthus leaves
      g.fillStyle = '#629E68';
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36, 18, 9, a, 0, Math.PI * 2);
        g.fill();
      }

      // Tudor Rose or Cobalt Blossom at center
      const isRose = ((x + y) / step) % 2 === 0;
      g.fillStyle = isRose ? '#D85258' : '#4E82C4';
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 10, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#FAF0D4';
      g.beginPath();
      g.arc(cx, cy, 8, 0, Math.PI * 2);
      g.fill();
    }
  }

  return toTexture(key, c);
}

/**
 * Sculpts deeper 3D box pleats, horizontal flounce ridges, and crochet ribs directly into Sister's BufferGeometries,
 * and upgrades her material textures so both /viewer.html and the in-game S1 scene show high-relief modeling.
 */
export function enhanceModelHierarchy(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const name = mesh.name || '';
    const geom = mesh.geometry as THREE.BufferGeometry;

    // 1. Sculpt deeper 3D pleats and flounce tiers on Sister_Skirt
    if (name === 'Sister_Skirt' && !geom.userData.sculptedHD) {
      geom.userData.sculptedHD = true;
      const pos = geom.getAttribute('position');
      if (pos) {
        // In glTF Y-up space, Sister's skirt is centered near x=0, z=0.13, y in [0.01, 0.36]
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);
          const dx = x;
          const dz = z - 0.13;
          const r = Math.hypot(dx, dz);
          if (r > 0.03) {
            const th = Math.atan2(dx, dz);
            const rNorm = Math.min(1, r / 0.52);
            // Deep radial box pleats + 3 horizontal flounce ridges
            const pleat = Math.sin(11 * th) * 0.022 + Math.sin(22 * th + 1.2) * 0.011 + Math.sin(33 * th) * 0.006;
            const tier = Math.sin(rNorm * Math.PI * 6.0) * 0.012;
            const radialPush = (pleat + tier) * Math.pow(rNorm, 0.75);
            const scale = (r + radialPush) / r;
            pos.setXYZ(i, dx * scale, y + tier * 0.65 + Math.cos(11 * th) * 0.008 * rNorm, 0.13 + dz * scale);
          }
        }
        pos.needsUpdate = true;
        geom.computeVertexNormals();
      }
    }

    // 2. Sculpt crochet ribbing & scalloped waves on Sister_Shawl
    if (name === 'Sister_Shawl' && !geom.userData.sculptedHD) {
      geom.userData.sculptedHD = true;
      const pos = geom.getAttribute('position');
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);
          const th = Math.atan2(x, z);
          const rib = Math.sin(28 * th) * 0.006;
          const len = Math.hypot(x, z) || 1;
          pos.setXYZ(i, x + (x / len) * rib, y + Math.cos(28 * th) * 0.004, z + (z / len) * rib);
        }
        pos.needsUpdate = true;
        geom.computeVertexNormals();
      }
    }

    // 3. Upgrade painted textures on Sister and Great Hall materials
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const std = m as THREE.MeshStandardMaterial | THREE.MeshToonMaterial;
      if (m.name === 'M_Sister_Skirt') {
        const t = getSisterSkirtTexture();
        if (t) {
          std.map = t;
          std.emissiveMap = t;
          std.needsUpdate = true;
        }
      } else if (m.name === 'M_Sister_Shawl') {
        const t = getSisterShawlTexture();
        if (t) {
          std.map = t;
          std.emissiveMap = t;
          std.needsUpdate = true;
        }
      } else if (m.name === 'M_Sister_Dress') {
        const t = getSisterDressTexture();
        if (t) {
          std.map = t;
          std.emissiveMap = t;
          std.needsUpdate = true;
        }
      } else if (m.name === 'M_S5_Parquet') {
        const t = getHallParquetTexture();
        if (t) {
          std.map = t;
          std.emissiveMap = t;
          std.needsUpdate = true;
        }
      } else if (m.name === 'M_S5_Runner') {
        const t = getHallRunnerTexture();
        if (t) {
          std.map = t;
          std.emissiveMap = t;
          std.needsUpdate = true;
        }
      } else if (m.name === 'M_S5_Wallpaper') {
        const t = getHallWallpaperTexture();
        if (t) {
          std.map = t;
          std.emissiveMap = t;
          std.needsUpdate = true;
        }
      }
    }
  });
}
