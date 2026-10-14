import * as THREE from 'three';

/**
 * Painted light pools: soft additive halos around lamps, fire and the garden door.
 *
 * Instead of paying for real lights (every point light is another loop in every material's fragment shader) the glow of a
 * flame in dusty Victorian air is "painted on": a single instanced camera-facing card per glow - one draw call per set.
 * Each glow is a warm core, an amber body and a rose-violet outer wash with a slightly wobbling brush edge, and a very slow
 * candle flicker. The card is nudged toward the camera so that a lamp hanging against a wall is not sliced in half by it.
 */
export interface GlowSpec {
  /** position in the glow set's parent space */
  position: THREE.Vector3;
  /** half-size of the card, metres (the halo fades to nothing at this distance) */
  radius: number;
  color: THREE.ColorRepresentation;
  /** peak brightness of the core in linear light */
  intensity: number;
}

const VERT = /* glsl */ `
  attribute vec4 aGlow;     // xyz centre, w radius
  attribute vec4 aColor;    // rgb, intensity
  varying vec2 vP;
  varying vec4 vCol;
  varying float vSeed;
  void main() {
    vP = position.xy;
    vCol = aColor;
    vSeed = fract( dot( aGlow.xyz, vec3( 0.137, 0.291, 0.173 ) ) * 7.0 );
    vec4 c = modelViewMatrix * vec4( aGlow.xyz, 1.0 );
    // a halo you are standing inside is just air: fade it out as the camera gets within about its own radius
    float dist = length( c.xyz );
    vCol.a *= smoothstep( aGlow.w * 0.7, aGlow.w * 2.4, dist );
    c.xyz += normalize( -c.xyz ) * min( aGlow.w * 0.15, 0.35 );
    c.xy += position.xy * aGlow.w;
    gl_Position = projectionMatrix * c;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uGain;
  varying vec2 vP;
  varying vec4 vCol;
  varying float vSeed;
  void main() {
    float r = length( vP );
    float a = atan( vP.y, vP.x );
    // a hand-brushed edge: the halo is not a perfect disc
    r *= 1.0 + 0.07 * sin( a * 5.0 + vSeed * 40.0 ) + 0.04 * sin( a * 11.0 - vSeed * 17.0 );
    if ( r >= 1.0 ) discard;
    float x = 1.0 - r;
    float core = pow( x, 5.0 );
    float body = pow( x, 2.3 );
    float wash = x * x * ( 3.0 - 2.0 * x );
    vec3 hot = mix( vCol.rgb, vec3( 1.0, 0.95, 0.78 ), 0.6 );
    vec3 outer = vCol.rgb * vec3( 1.0, 0.62, 0.55 ) + vec3( 0.02, 0.0, 0.05 );
    vec3 col = hot * core * 1.1 + vCol.rgb * body * 0.30 + outer * wash * 0.10;
    float flick = 1.0 + 0.05 * sin( uTime * 6.3 + vSeed * 31.0 ) + 0.03 * sin( uTime * 11.1 + vSeed * 7.0 );
    gl_FragColor = vec4( col * vCol.a * uGain * flick, 1.0 );
  }
`;

export class LightGlows {
  public readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(specs: GlowSpec[]) {
    const base = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const n = specs.length;
    const glow = new Float32Array(n * 4);
    const col = new Float32Array(n * 4);
    const c = new THREE.Color();
    specs.forEach((s, i) => {
      glow.set([s.position.x, s.position.y, s.position.z, s.radius], i * 4);
      c.set(s.color);
      col.set([c.r, c.g, c.b, s.intensity], i * 4);
    });
    geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glow, 4));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 4));
    geo.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGain: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'LightGlows';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  public update(dt: number): void {
    this.material.uniforms.uTime.value += dt;
  }

  public setGain(g: number): void {
    this.material.uniforms.uGain.value = g;
  }
}

/**
 * Finds every emissive painted surface below `root` (materials flagged by convertMaterialsToToon: lamp glass, fire, the
 * garden door) and turns each connected lump of it into a glow in the local space of `target`.
 * Vertices are bucketed on a coarse grid and joined with their neighbours, so a six-lamp chandelier row yields six glows and a
 * fireplace of five flames yields one.
 */
export function collectGlowSpecs(
  root: THREE.Object3D,
  target: THREE.Object3D,
  opts: { cell?: number; scale?: number; minRadius?: number; maxRadius?: number; intensity?: number } = {}
): GlowSpec[] {
  const cell = opts.cell ?? 0.35;
  const scale = opts.scale ?? 2.4;
  const minR = opts.minRadius ?? 0.45;
  const maxR = opts.maxRadius ?? 3.2;
  const gain = opts.intensity ?? 1.0;
  root.updateWorldMatrix(true, true);
  target.updateWorldMatrix(true, false);
  const toTarget = new THREE.Matrix4().copy(target.matrixWorld).invert();
  const out: GlowSpec[] = [];
  const v = new THREE.Vector3();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const glowMat = mats.find((m) => (m as THREE.Material).userData?.glow);
    if (!glowMat) return;
    const color = (glowMat.userData.glow as { color: number }).color;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(toTarget, mesh.matrixWorld);

    // bucket the vertices
    const cells = new Map<string, number[]>();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      pts.push(v.clone());
      const key = `${Math.floor(v.x / cell)},${Math.floor(v.y / cell)},${Math.floor(v.z / cell)}`;
      const arr = cells.get(key);
      if (arr) arr.push(i);
      else cells.set(key, [i]);
    }
    // connected components over neighbouring cells
    const seen = new Set<string>();
    for (const start of cells.keys()) {
      if (seen.has(start)) continue;
      const box = new THREE.Box3();
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const k = stack.pop() as string;
        for (const idx of cells.get(k) as number[]) box.expandByPoint(pts[idx]);
        const [cx, cy, cz] = k.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const nk = `${cx + dx},${cy + dy},${cz + dz}`;
              if (!seen.has(nk) && cells.has(nk)) {
                seen.add(nk);
                stack.push(nk);
              }
            }
          }
        }
      }
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z, 0.08);
      const radius = Math.min(maxR, Math.max(minR, span * scale));
      const centre = box.getCenter(new THREE.Vector3());
      out.push({ position: centre, radius, color, intensity: gain });
      // a second, much wider and fainter wash gives the pool of light on the surrounding air / walls
      out.push({ position: centre.clone(), radius: radius * 1.9, color, intensity: gain * 0.28 });
    }
  });
  return out;
}
