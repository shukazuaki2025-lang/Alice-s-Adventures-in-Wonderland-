/** Tiny dependency-free GLB reader used by the asset checks (JSON chunk + accessor decoding + node transforms). */
import fs from 'node:fs';

const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart);
  return { file, bytes: buf.length, json, bin };
}

export function accessor(glb, idx) {
  const g = glb.json;
  const a = g.accessors[idx];
  const bv = g.bufferViews[a.bufferView];
  const comps = COMPS[a.type];
  const stride = bv.byteStride || comps * 4;
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Float32Array(a.count * comps);
  const dv = new DataView(glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < comps; c++) {
      const p = off + i * stride + c * (a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1);
      let v;
      switch (a.componentType) {
        case 5126: v = dv.getFloat32(p, true); break;
        case 5123: v = dv.getUint16(p, true) / (a.normalized ? 65535 : 1); break;
        case 5121: v = dv.getUint8(p) / (a.normalized ? 255 : 1); break;
        case 5122: v = Math.max(dv.getInt16(p, true) / 32767, -1); break;
        case 5120: v = Math.max(dv.getInt8(p) / 127, -1); break;
        default: v = 0;
      }
      out[i * comps + c] = v;
    }
  }
  return { data: out, comps, count: a.count, min: a.min, max: a.max };
}

// --- 4x4 helpers (column-major arrays) -------------------------------------------------------------------------
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function compose(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

/** World-space rest position of every node, by name (last one wins for duplicate names). */
export function nodeWorldPositions(glb) {
  const nodes = glb.json.nodes;
  const parent = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
  const world = new Array(nodes.length);
  const get = (i) => {
    if (world[i]) return world[i];
    const n = nodes[i];
    const local = n.matrix ? n.matrix : compose(n.translation, n.rotation, n.scale);
    world[i] = parent[i] >= 0 ? mul(get(parent[i]), local) : local;
    return world[i];
  };
  const byName = new Map();
  nodes.forEach((n, i) => {
    const m = get(i);
    byName.set(n.name, { x: m[12], y: m[13], z: m[14], index: i });
  });
  return byName;
}

export function skinJointNames(glb) {
  const names = glb.json.nodes.map((n) => n.name);
  const out = [];
  for (const s of glb.json.skins || []) for (const j of s.joints) out.push(names[j]);
  return out;
}

export function quatAngleDeg(q, q0) {
  const d = Math.abs(q[0] * q0[0] + q[1] * q0[1] + q[2] * q0[2] + q[3] * q0[3]);
  return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI;
}

/** Per-animation, per-node channel data: { name, duration, channels: [{ node, path, times, values }] }. */
export function readAnimations(glb) {
  const names = glb.json.nodes.map((n) => n.name);
  return (glb.json.animations || []).map((an) => {
    const channels = an.channels.map((ch) => {
      const s = an.samplers[ch.sampler];
      const times = accessor(glb, s.input).data;
      const out = accessor(glb, s.output);
      return { node: names[ch.target.node], path: ch.target.path, times, values: out.data, comps: out.comps };
    });
    const duration = Math.max(0, ...channels.map((c) => c.times[c.times.length - 1] ?? 0));
    return { name: an.name, duration, channels };
  });
}

/** Max rotation (degrees, relative to the first key) reached by a node in an animation; 0 if it has no rotation track. */
export function maxRotationDeg(anim, node) {
  const ch = anim.channels.find((c) => c.node === node && c.path === 'rotation');
  if (!ch) return 0;
  const q0 = [ch.values[0], ch.values[1], ch.values[2], ch.values[3]];
  let m = 0;
  for (let i = 0; i < ch.times.length; i++) m = Math.max(m, quatAngleDeg(ch.values.subarray(i * 4, i * 4 + 4), q0));
  return m;
}

export function translationRange(anim, node) {
  const ch = anim.channels.find((c) => c.node === node && c.path === 'translation');
  if (!ch) return [0, 0, 0];
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < ch.times.length; i++) for (let k = 0; k < 3; k++) {
    const v = ch.values[i * 3 + k];
    mn[k] = Math.min(mn[k], v); mx[k] = Math.max(mx[k], v);
  }
  return mx.map((v, k) => v - mn[k]);
}

/** Pearson correlation of the first quaternion components of two rotation tracks (resampled by index when lengths match). */
export function rotationCorrelation(anim, a, b) {
  const ca = anim.channels.find((c) => c.node === a && c.path === 'rotation');
  const cb = anim.channels.find((c) => c.node === b && c.path === 'rotation');
  if (!ca || !cb || ca.times.length !== cb.times.length) return 0;
  const n = ca.times.length;
  const xa = Array.from({ length: n }, (_, i) => ca.values[i * 4]);
  const xb = Array.from({ length: n }, (_, i) => cb.values[i * 4]);
  const ma = xa.reduce((p, c) => p + c, 0) / n, mb = xb.reduce((p, c) => p + c, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (xa[i] - ma) * (xb[i] - mb); da += (xa[i] - ma) ** 2; db += (xb[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

export function loopClosureDeg(anim) {
  let worst = 0;
  for (const ch of anim.channels) {
    if (ch.path !== 'rotation' || ch.times.length < 2) continue;
    const n = ch.times.length;
    worst = Math.max(worst, quatAngleDeg(ch.values.subarray((n - 1) * 4, n * 4), ch.values.subarray(0, 4)));
  }
  return worst;
}

export function meshBounds(glb, namePrefix) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  let tris = 0;
  glb.json.meshes.forEach((m) => {
    if (namePrefix && !m.name.startsWith(namePrefix)) return;
    for (const p of m.primitives) {
      const a = glb.json.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a.min[k]); mx[k] = Math.max(mx[k], a.max[k]); }
      const idx = p.indices !== undefined ? glb.json.accessors[p.indices].count : a.count;
      tris += Math.floor(idx / 3);
    }
  });
  return { min: mn, max: mx, size: mx.map((v, k) => v - mn[k]), tris };
}

/** Width/height of embedded images (PNG / JPEG headers) -> [{ name, width, height, mime, bytes }]. */
export function imageInfo(glb) {
  const out = [];
  for (const im of glb.json.images || []) {
    const bv = glb.json.bufferViews[im.bufferView];
    const buf = glb.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    let width = 0, height = 0;
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
      width = buf.readUInt32BE(16); height = buf.readUInt32BE(20);
    } else if (buf[0] === 0xff && buf[1] === 0xd8) {
      let p = 2;
      while (p < buf.length) {
        if (buf[p] !== 0xff) { p++; continue; }
        const marker = buf[p + 1];
        const len = buf.readUInt16BE(p + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          height = buf.readUInt16BE(p + 5); width = buf.readUInt16BE(p + 7); break;
        }
        p += 2 + len;
      }
    }
    out.push({ name: im.name, width, height, mime: im.mimeType, bytes: buf.length });
  }
  return out;
}

/** Correlation between track `a` and track `b` shifted by `lagFrac` of the cycle (same sample count required). */
export function rotationCorrelationLag(anim, a, b, lagFrac) {
  const ca = anim.channels.find((c) => c.node === a && c.path === 'rotation');
  const cb = anim.channels.find((c) => c.node === b && c.path === 'rotation');
  if (!ca || !cb || ca.times.length !== cb.times.length) return 0;
  const n = ca.times.length - 1; // last key duplicates the first in loops
  const lag = Math.round(lagFrac * n);
  const xa = Array.from({ length: n }, (_, i) => ca.values[i * 4]);
  const xb = Array.from({ length: n }, (_, i) => cb.values[((i + lag) % n) * 4]);
  const ma = xa.reduce((p, c) => p + c, 0) / n, mb = xb.reduce((p, c) => p + c, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (xa[i] - ma) * (xb[i] - mb); da += (xa[i] - ma) ** 2; db += (xb[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}
