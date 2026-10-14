import * as THREE from 'three';

/**
 * Painted meadow dressing: wind-swayed grass tufts and wildflowers rendered as instanced, alpha-tested crossed quads whose
 * textures are brushed on a canvas at start-up (gouache dabs, no photo assets).
 *
 * Twelve painted species share one 4x3 atlas (three grasses, a seed-head grass, daisy, buttercup, clover, poppy, cornflower,
 * dandelion, cow-parsley, plantain). Which species grows where follows soft patch fields (a buttercup field, a blue drift near
 * the water, a clover lawn under the tree ...) and every card carries a low-frequency tint, so the meadow reads as washes of
 * olive, ochre, emerald and blue-green instead of one repeated green.
 */
const COLS = 4;
const ROWS = 3;
const CELL = 128;

/** hash-based smooth value noise in 2-D, deterministic */
function makeNoise(seed: number): (x: number, z: number) => number {
  const h = (ix: number, iz: number) => {
    let n = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return (((n ^ (n >>> 16)) >>> 0) % 100000) / 100000;
  };
  return (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    let fx = x - ix;
    let fz = z - iz;
    fx = fx * fx * (3 - 2 * fx);
    fz = fz * fz * (3 - 2 * fz);
    const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * fx;
    const b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * fx;
    return a + (b - a) * fz;
  };
}

function makeAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * COLS;
  canvas.height = CELL * ROWS;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const S = CELL;
  const rr = mulberry32(7);

  const origin = (cell: number): [number, number] => [(cell % COLS) * S, Math.floor(cell / COLS) * S];

  // --- grasses: curved blades, dark root -> luminous tip -------------------------------------------------------------
  const blades = (cell: number, hue: number, sat: number, light: number, count: number, seed: number) => {
    const [ox, oy] = origin(cell);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const bx = ox + S * (0.12 + 0.76 * t) + Math.sin(i * 2.1 + seed) * 4;
      const h = S * (0.58 + 0.38 * Math.abs(Math.sin(i * 1.7 + seed)));
      const lean = (t - 0.5) * 36 + Math.sin(i * 3.3 + seed) * 9;
      const hs = hue + Math.sin(i * 5.1 + seed) * 7;
      const grad = g.createLinearGradient(bx, oy + S, bx + lean, oy + S - h);
      grad.addColorStop(0, `hsl(${hs + 14}, ${sat}%, ${light - 17}%)`);
      grad.addColorStop(0.5, `hsl(${hs}, ${sat + 4}%, ${light}%)`);
      grad.addColorStop(1, `hsl(${hs - 20}, ${sat + 8}%, ${light + 22}%)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(bx - 4.5, oy + S);
      g.quadraticCurveTo(bx + lean * 0.35 - 2, oy + S - h * 0.55, bx + lean, oy + S - h);
      g.quadraticCurveTo(bx + lean * 0.35 + 3, oy + S - h * 0.5, bx + 4.5, oy + S);
      g.closePath();
      g.fill();
    }
  };
  blades(0, 100, 50, 38, 10, 0.0);   // fresh yellow-green
  blades(1, 128, 38, 30, 10, 2.0);   // deep blue-green
  blades(2, 70, 44, 42, 9, 4.0);     // dry olive / straw

  // cell 3: tall seed-head grass (golden stems with oat-like heads)
  {
    const [ox, oy] = origin(3);
    for (let i = 0; i < 6; i++) {
      const bx = ox + S * (0.2 + 0.12 * i) + (rr() - 0.5) * 6;
      const top = oy + S * (0.06 + rr() * 0.22);
      const lean = (rr() - 0.5) * 26;
      g.strokeStyle = `hsl(${46 + rr() * 8}, 52%, ${44 + rr() * 8}%)`;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(bx, oy + S);
      g.quadraticCurveTo(bx + lean * 0.2, oy + S * 0.55, bx + lean, top + 8);
      g.stroke();
      for (let k = 0; k < 7; k++) {
        g.fillStyle = `hsl(${40 + rr() * 10}, 60%, ${52 + rr() * 14}%)`;
        g.beginPath();
        g.ellipse(bx + lean + (k % 2 ? 3 : -3), top + k * 4.2, 3.2, 5.2, (k % 2 ? 0.5 : -0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
    blades(3, 84, 40, 40, 3, 9.0);
  }

  const stem = (cx: number, base: number, cy: number, hue = 98) => {
    g.strokeStyle = `hsl(${hue}, 44%, 32%)`;
    g.lineWidth = 3.6;
    g.beginPath();
    g.moveTo(cx, base);
    g.quadraticCurveTo(cx + 6, (base + cy) / 2, cx, cy + 5);
    g.stroke();
  };
  const leaf = (x: number, y: number, rx: number, ry: number, rot: number, hue = 98, l = 36) => {
    g.fillStyle = `hsl(${hue}, 46%, ${l}%)`;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
  };
  const petals = (cx: number, cy: number, n: number, len: number, wid: number, col: string, tip: string) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      const grad = g.createLinearGradient(0, 0, len * 1.5, 0);
      grad.addColorStop(0, col);
      grad.addColorStop(1, tip);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(len * 0.78, 0, len * 0.62, wid, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  };

  // cell 4: daisy
  {
    const [ox, oy] = origin(4);
    const cx = ox + S / 2;
    const cy = oy + S * 0.34;
    stem(cx, oy + S, cy);
    leaf(cx - 13, oy + S * 0.76, 12, 4.5, -0.5);
    petals(cx, cy, 14, 22, 4.4, '#FFFDF4', '#EFE6D2');
    g.fillStyle = '#F2C230';
    g.beginPath();
    g.arc(cx, cy, 7.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#D79A12';
    g.beginPath();
    g.arc(cx + 1.5, cy + 1.5, 4, 0, Math.PI * 2);
    g.fill();
  }
  // cell 5: buttercup
  {
    const [ox, oy] = origin(5);
    for (const [dx, h] of [[-20, 0.4], [14, 0.3], [34, 0.5]] as Array<[number, number]>) {
      const cx = ox + S / 2 + dx;
      const cy = oy + S * h;
      stem(cx, oy + S, cy);
      petals(cx, cy, 5, 11, 7, '#F6D54B', '#FFF0A0');
      g.fillStyle = '#E7A81A';
      g.beginPath();
      g.arc(cx, cy, 3.4, 0, Math.PI * 2);
      g.fill();
    }
    leaf(ox + 36, oy + S * 0.86, 13, 5, 0.3);
  }
  // cell 6: clover - leaf rosette with three-lobed leaves and rose-pink heads
  {
    const [ox, oy] = origin(6);
    for (let k = 0; k < 7; k++) {
      const lx = ox + S * (0.14 + 0.72 * (k / 6));
      const ly = oy + S * (0.86 - 0.08 * Math.sin(k * 2.0));
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI * 2 + k;
        leaf(lx + Math.cos(a) * 6, ly + Math.sin(a) * 4 - 6, 8, 6, a, 104 + k * 2, 30 + (k % 3) * 5);
      }
    }
    for (const [dx, h] of [[-18, 0.42], [16, 0.32]] as Array<[number, number]>) {
      const cx = ox + S / 2 + dx;
      const cy = oy + S * h;
      stem(cx, oy + S * 0.86, cy);
      for (let k = 0; k < 26; k++) {
        const a = rr() * Math.PI * 2;
        const r = Math.sqrt(rr()) * 11;
        g.fillStyle = `hsl(${326 + rr() * 16}, ${52 + rr() * 20}%, ${70 + rr() * 12}%)`;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 3.4, 2.6, a, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // cell 7: poppy
  {
    const [ox, oy] = origin(7);
    const cx = ox + S * 0.5;
    const cy = oy + S * 0.36;
    stem(cx, oy + S, cy, 96);
    leaf(cx + 14, oy + S * 0.74, 13, 4, 0.55, 96, 33);
    petals(cx, cy, 4, 17, 13, '#D7301F', '#F2603A');
    g.fillStyle = 'rgba(70,24,30,0.55)';
    g.beginPath();
    g.arc(cx, cy, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2C2018';
    g.beginPath();
    g.arc(cx, cy, 4.2, 0, Math.PI * 2);
    g.fill();
    // a nodding bud
    g.fillStyle = '#B83A24';
    g.beginPath();
    g.ellipse(ox + S * 0.78, oy + S * 0.56, 5, 7, 0.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'hsl(96,44%,32%)';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(ox + S * 0.72, oy + S);
    g.quadraticCurveTo(ox + S * 0.84, oy + S * 0.7, ox + S * 0.78, oy + S * 0.52);
    g.stroke();
  }
  // cell 8: cornflower / speedwell - small blue-violet stars
  {
    const [ox, oy] = origin(8);
    for (const [dx, h, hue] of [[-24, 0.38, 224], [4, 0.26, 238], [28, 0.46, 248]] as Array<[number, number, number]>) {
      const cx = ox + S / 2 + dx;
      const cy = oy + S * h;
      stem(cx, oy + S, cy, 104);
      petals(cx, cy, 8, 8.5, 3.2, `hsl(${hue}, 62%, 52%)`, `hsl(${hue + 8}, 70%, 70%)`);
      g.fillStyle = '#F4EBB8';
      g.beginPath();
      g.arc(cx, cy, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    leaf(ox + S * 0.5, oy + S * 0.84, 14, 3.6, 0.2, 108, 34);
  }
  // cell 9: dandelion, a flower and a seed clock
  {
    const [ox, oy] = origin(9);
    const cx = ox + S * 0.36;
    const cy = oy + S * 0.42;
    stem(cx, oy + S, cy, 100);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      g.strokeStyle = i % 2 ? '#F4C52A' : '#FAD84A';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
      g.stroke();
    }
    const px = ox + S * 0.7;
    const py = oy + S * 0.3;
    stem(px, oy + S, py, 100);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      g.strokeStyle = 'rgba(250,248,238,0.9)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * 14, py + Math.sin(a) * 14);
      g.stroke();
      g.fillStyle = '#EDE6D0';
      g.beginPath();
      g.arc(px + Math.cos(a) * 14, py + Math.sin(a) * 14, 1.5, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 5; k++) leaf(ox + 24 + k * 14, oy + S * 0.9 - (k % 2) * 4, 14, 3.4, -0.4 + k * 0.25, 96, 32 + k);
  }
  // cell 10: cow-parsley - tall stem, flat lacy umbels
  {
    const [ox, oy] = origin(10);
    const cx = ox + S * 0.5;
    stem(cx, oy + S, oy + S * 0.2, 92);
    for (let u = 0; u < 5; u++) {
      const ax = cx + (u - 2) * 15;
      const ay = oy + S * (0.16 + 0.07 * Math.abs(u - 2));
      g.strokeStyle = 'hsl(92,40%,38%)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(cx, oy + S * 0.34);
      g.lineTo(ax, ay + 4);
      g.stroke();
      for (let k = 0; k < 24; k++) {
        const a = rr() * Math.PI * 2;
        const r = Math.sqrt(rr()) * 11;
        g.fillStyle = `hsl(${60 + rr() * 30}, ${10 + rr() * 22}%, ${90 + rr() * 8}%)`;
        g.beginPath();
        g.arc(ax + Math.cos(a) * r, ay + Math.sin(a) * r * 0.5, 2.1, 0, Math.PI * 2);
        g.fill();
      }
    }
    leaf(cx - 16, oy + S * 0.78, 13, 3.8, 0.7, 98, 34);
  }
  // cell 11: plantain / broad-leaf rosette
  {
    const [ox, oy] = origin(11);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI + (k / 5) * Math.PI;
      const lx = ox + S / 2 + Math.cos(a) * 30;
      const ly = oy + S * 0.9 + Math.sin(a) * 28;
      leaf(lx, ly, 21, 8.5, a + Math.PI / 2 + 1.55, 100 + k * 3, 28 + (k % 3) * 6);
      g.strokeStyle = 'rgba(210,225,150,0.5)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(lx, ly + 8);
      g.lineTo(lx + Math.cos(a) * 3, ly - 14);
      g.stroke();
    }
    stem(ox + S * 0.7, oy + S * 0.92, oy + S * 0.26, 90);
    g.fillStyle = '#7A6538';
    g.beginPath();
    g.ellipse(ox + S * 0.7, oy + S * 0.3, 3.4, 12, 0, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export interface MeadowOptions {
  /** Axis-aligned world rectangle where tufts may grow. */
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Circles (x, z, r) kept clear: tree trunk, picnic rug, pickable daisies ... */
  keepOut?: Array<[number, number, number]>;
  /** Extra tufts packed near these (x, z, r) hot-spots (bank edge, tree roots, hedge). */
  hotSpots?: Array<[number, number, number]>;
  grassCount?: number;
  flowerCount?: number;
  /** Multiplier on tuft height (the camera sits low, so tall grass hides Alice's feet). */
  grassHeight?: number;
}

export class Meadow {
  public readonly group = new THREE.Group();
  private uniforms = { uTime: { value: 0 } };

  constructor(opts: MeadowOptions) {
    const atlas = makeAtlas();
    const rng = mulberry32(1865);
    const { area } = opts;
    const keep = opts.keepOut ?? [];
    const hot = opts.hotSpots ?? [];
    const nA = makeNoise(11); // patch fields (metres / scale)
    const nB = makeNoise(23);
    const nC = makeNoise(37);
    const nT = makeNoise(51);

    // species choice for the ground cover: which grass cell
    const grassCell = (x: number, z: number): number => {
      const dry = nA(x / 9, z / 9);
      const deep = nB(x / 7, z / 7);
      const r = rng();
      if (dry > 0.7) return r < 0.5 ? 2 : r < 0.64 ? 3 : 0;
      if (deep > 0.6) return r < 0.7 ? 1 : 0;
      return r < 0.56 ? 0 : r < 0.92 ? 1 : r < 0.97 ? 2 : 3;
    };
    // species choice for the flowers
    const flowerCell = (x: number, z: number): number => {
      const yellow = nA(x / 6.5, z / 6.5);
      const blue = nB(x / 8, z / 8);
      const clover = nC(x / 7, z / 7);
      const r = rng();
      if (yellow > 0.64) return r < 0.5 ? 5 : r < 0.8 ? 9 : 4;
      if (blue > 0.62) return r < 0.5 ? 8 : r < 0.72 ? 7 : r < 0.86 ? 4 : 10;
      if (clover > 0.6) return r < 0.5 ? 6 : r < 0.75 ? 4 : 11;
      return r < 0.3 ? 4 : r < 0.46 ? 5 : r < 0.58 ? 6 : r < 0.68 ? 7 : r < 0.78 ? 8 : r < 0.87 ? 9 : r < 0.94 ? 10 : 11;
    };
    // low-frequency colour wash per card (rgb multiplier)
    const tintFor = (x: number, z: number, flower: boolean): [number, number, number] => {
      const warm = nT(x / 10, z / 10);          // 0 cool blue-green .. 1 warm olive-gold
      const val = 0.86 + nT(x / 3.5 + 40, z / 3.5) * 0.3;
      const k = flower ? 0.35 : 1;
      const r = (0.9 + warm * 0.26) * val;
      const gch = (1.0 + (0.5 - Math.abs(warm - 0.5)) * 0.1) * val;
      const b = (1.12 - warm * 0.34) * val;
      return [1 + (r - 1) * k, 1 + (gch - 1) * k, 1 + (b - 1) * k];
    };

    const place = (count: number, pick: (x: number, z: number) => number, size: [number, number], hotShare: number, flowers: boolean, heightScale = 1) => {
      const geo = crossedQuad();
      const mat = new THREE.MeshLambertMaterial({
        map: atlas,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x203010),
        emissiveIntensity: 0.55,
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = this.uniforms.uTime;
        shader.vertexShader = 'uniform float uTime;\nattribute float aTile;\nattribute vec3 aTint;\nvarying vec3 vTint;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          vTint = aTint;
          vec3 inst = vec3( instanceMatrix[3].x, 0.0, instanceMatrix[3].z );
          float sway = sin( uTime * 1.7 + inst.x * 0.8 + inst.z * 0.6 ) * 0.5 + sin( uTime * 2.9 + inst.x * 1.9 ) * 0.25;
          transformed.x += sway * 0.09 * uv.y * uv.y;
          transformed.z += sway * 0.05 * uv.y * uv.y;`
        );
        // pick the atlas cell per instance from a dedicated instanced attribute
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          /* glsl */ `
          #include <uv_vertex>
          #ifdef USE_MAP
            float tCol = mod( aTile, ${COLS}.0 );
            float tRow = floor( aTile / ${COLS}.0 );
            vMapUv = vec2( ( uv.x + tCol ) / ${COLS}.0, ( uv.y + ${ROWS - 1}.0 - tRow ) / ${ROWS}.0 );
          #endif`
        );
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'varying vec3 vTint;\nvoid main() {');
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= vTint;');
      };
      mat.customProgramCacheKey = () => 'meadow-v2';
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.frustumCulled = false;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const tiles = new Float32Array(count);
      const tints = new Float32Array(count * 3);
      let placed = 0;
      let guard = 0;
      while (placed < count && guard++ < count * 40) {
        let x: number;
        let z: number;
        if (hot.length && rng() < hotShare) {
          const h = hot[Math.floor(rng() * hot.length)];
          const a = rng() * Math.PI * 2;
          const r = Math.sqrt(rng()) * h[2];
          x = h[0] + Math.cos(a) * r;
          z = h[1] + Math.sin(a) * r;
        } else {
          x = area.minX + rng() * (area.maxX - area.minX);
          z = area.minZ + rng() * (area.maxZ - area.minZ);
        }
        if (x < area.minX || x > area.maxX || z < area.minZ || z > area.maxZ) continue;
        if (keep.some((k) => (x - k[0]) ** 2 + (z - k[1]) ** 2 < k[2] * k[2])) continue;
        const cell = pick(x, z);
        // tall species stand taller, rosettes stay low
        const tall = cell === 3 || cell === 10 ? 1.25 : cell === 6 || cell === 11 ? 0.55 : 1;
        const s = size[0] + rng() * (size[1] - size[0]);
        pos.set(x, 0, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
        scl.set(s, s * (0.6 + rng() * 0.4) * heightScale * tall, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(placed, m);
        tiles[placed] = cell;
        const t = tintFor(x, z, flowers);
        // a touch of per-card variation so neighbouring tufts are never identical
        const j = 0.95 + rng() * 0.1;
        tints.set([t[0] * j, t[1] * j, t[2] * j], placed * 3);
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1));
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return mesh;
    };

    this.group.add(place(opts.grassCount ?? 5200, grassCell, [0.45, 0.8], 0.45, false, opts.grassHeight ?? 0.8));
    this.group.add(place(opts.flowerCount ?? 900, flowerCell, [0.26, 0.44], 0.35, true));
    this.group.name = 'MeadowDressing';
  }

  public update(dt: number): void {
    this.uniforms.uTime.value += dt;
  }
}

function crossedQuad(): THREE.BufferGeometry {
  const planes: THREE.PlaneGeometry[] = [];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.PlaneGeometry(1, 1);
    p.translate(0, 0.5, 0);
    p.rotateY((i * Math.PI) / 2 + 0.35);
    planes.push(p);
  }
  const merged = new THREE.BufferGeometry();
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const p of planes) {
    const pa = p.attributes.position;
    const ua = p.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      uv.push(ua.getX(i), ua.getY(i));
      nrm.push(0, 1, 0); // light as if facing up: tufts read as soft volumes under the hemisphere light
    }
    for (const i of p.index!.array) idx.push(base + i);
    base += pa.count;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  merged.setIndex(idx);
  return merged;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
