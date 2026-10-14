import * as THREE from 'three';

/**
 * Painted meadow dressing: wind-swayed grass tufts and wildflowers rendered as instanced, alpha-tested crossed quads whose
 * textures are brushed on a canvas at start-up (gouache dabs, no photo assets). Cheap (~30k triangles) and gives the
 * riverbank real depth and colour at ground level.
 */
function makeAtlas(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S * 4;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, S * 4, S);

  // cell 0: grass tuft (7 curved blades, dark base -> light tip)
  const blades = (ox: number, seedShift: number, hueShift: number) => {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const bx = ox + S * (0.15 + 0.7 * t) + Math.sin(i * 2.1 + seedShift) * 4;
      const h = S * (0.62 + 0.34 * Math.abs(Math.sin(i * 1.7 + seedShift)));
      const lean = (t - 0.5) * 34 + Math.sin(i * 3.3) * 8;
      const grad = g.createLinearGradient(bx, S, bx + lean, S - h);
      grad.addColorStop(0, `hsl(${108 + hueShift}, 48%, 24%)`);
      grad.addColorStop(0.55, `hsl(${96 + hueShift}, 52%, 40%)`);
      grad.addColorStop(1, `hsl(${74 + hueShift}, 62%, 62%)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(bx - 4.5, S);
      g.quadraticCurveTo(bx + lean * 0.35 - 2, S - h * 0.55, bx + lean, S - h);
      g.quadraticCurveTo(bx + lean * 0.35 + 3, S - h * 0.5, bx + 4.5, S);
      g.closePath();
      g.fill();
    }
  };
  blades(0, 0.0, 0);
  // cell 1: lush darker tuft
  blades(S, 2.0, 8);

  // cell 2: daisy on a stem
  const flower = (ox: number, petal: string, centre: string, n: number, big: number) => {
    const cx = ox + S / 2;
    const cy = S * 0.34;
    g.strokeStyle = 'hsl(100, 45%, 32%)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, S);
    g.quadraticCurveTo(cx + 6, S * 0.7, cx, cy + 6);
    g.stroke();
    g.fillStyle = 'hsl(98, 48%, 36%)';
    g.beginPath();
    g.ellipse(cx - 12, S * 0.74, 12, 4.5, -0.5, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = petal;
      g.beginPath();
      g.ellipse(big * 0.78, 0, big * 0.62, big * 0.2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = centre;
    g.beginPath();
    g.arc(cx, cy, big * 0.34, 0, Math.PI * 2);
    g.fill();
  };
  flower(S * 2, '#FFFDF4', '#F2C230', 13, 22);
  // cell 3: buttercup / pink clover
  flower(S * 3, '#F6D54B', '#E7A81A', 6, 16);
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

    const place = (count: number, tile: (i: number) => number, size: [number, number], hotShare: number, heightScale = 1) => {
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
        shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          vec3 inst = vec3( instanceMatrix[3].x, 0.0, instanceMatrix[3].z );
          float sway = sin( uTime * 1.7 + inst.x * 0.8 + inst.z * 0.6 ) * 0.5 + sin( uTime * 2.9 + inst.x * 1.9 ) * 0.25;
          transformed.x += sway * 0.09 * uv.y * uv.y;
          transformed.z += sway * 0.05 * uv.y * uv.y;`
        );
        // pick the atlas cell (0..3) per instance from a dedicated instanced attribute
        shader.vertexShader = 'attribute float aTile;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          /* glsl */ `
          #include <uv_vertex>
          #ifdef USE_MAP
            vMapUv = vec2( ( uv.x + aTile ) * 0.25, uv.y );
          #endif`
        );
      };
      mat.customProgramCacheKey = () => 'meadow-v1';
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.frustumCulled = false;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const tiles = new Float32Array(count);
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
        const s = size[0] + rng() * (size[1] - size[0]);
        pos.set(x, 0, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
        scl.set(s, s * (0.6 + rng() * 0.4) * heightScale, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(placed, m);
        tiles[placed] = tile(placed);
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1));
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return mesh;
    };

    this.group.add(place(opts.grassCount ?? 5200, () => (rng() < 0.7 ? 0 : 1), [0.45, 0.8], 0.45, opts.grassHeight ?? 0.8));
    this.group.add(place(opts.flowerCount ?? 900, () => (rng() < 0.65 ? 2 : 3), [0.26, 0.42], 0.35));
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
