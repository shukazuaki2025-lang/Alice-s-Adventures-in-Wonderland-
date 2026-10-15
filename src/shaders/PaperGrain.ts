import * as THREE from 'three';

/**
 * Final "paint on paper" pass of the whole game (also used by the model viewer).
 *
 * The scene is rendered into a linear half-float target; this pass turns it into the finished picture:
 *   1. soft bloom / halation of the brightest lamp and sky light (two blurred copies at 1/4 and 1/8 resolution),
 *   2. filmic tone-map + sRGB encode,
 *   3. gouache "clarity": a two-scale, edge-limited local-contrast lift that brings the painted textures forward,
 *   4. the colour grade - an S-curve, split-toning (warm paper-amber lights over cool violet-teal shadows), saturation
 *      control with a compressor for over-saturated pigment, a faint violet shadow lift,
 *   5. the paper itself: cotton-fibre tooth, pigment granulation (settles in the mid-darks) and large soft wash mottle,
 *      all fixed to the PAGE (screen space) the way a real watercolour reproduction is,
 *   6. a tinted (never black) vignette and the black "telescope" iris used by the shrinking sequence.
 */

type RGB = [number, number, number];

export interface GradeParams {
  exposure: number;
  /** multiplies shadows / highlights (split toning) */
  shadowTint: RGB;
  highlightTint: RGB;
  /** additive lift in the deepest shadows (display space) */
  lift: RGB;
  /** 0..1 strength of the S-curve */
  contrast: number;
  saturation: number;
  /** 0..1: pulls very saturated pixels back toward the pigment's neutral */
  satCompress: number;
  vignette: number;
  vignetteTint: RGB;
  /** fine / broad local-contrast gain */
  clarity: number;
  clarityBroad: number;
  bloom: number;
  bloomTint: RGB;
  bloomThreshold: number;
  /** cotton-fibre tooth amplitude (multiplies the legacy `opacity` uniform) */
  paper: number;
  granulation: number;
  mottle: number;
}

export const NEUTRAL_GRADE: GradeParams = {
  exposure: 1.0,
  shadowTint: [1, 1, 1],
  highlightTint: [1, 1, 1],
  lift: [0, 0, 0],
  contrast: 0,
  saturation: 1,
  satCompress: 0,
  vignette: 0,
  vignetteTint: [0.6, 0.55, 0.7],
  clarity: 0,
  clarityBroad: 0,
  bloom: 0,
  bloomTint: [1, 0.9, 0.7],
  bloomThreshold: 0.8,
  paper: 0.2,
  granulation: 0.0,
  mottle: 0.0,
};

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Linear blend of two grades (used for the S3 amber -> lavender transition). */
export function lerpGrade(a: GradeParams, b: GradeParams, t: number): GradeParams {
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    exposure: n(a.exposure, b.exposure),
    shadowTint: mixRGB(a.shadowTint, b.shadowTint, t),
    highlightTint: mixRGB(a.highlightTint, b.highlightTint, t),
    lift: mixRGB(a.lift, b.lift, t),
    contrast: n(a.contrast, b.contrast),
    saturation: n(a.saturation, b.saturation),
    satCompress: n(a.satCompress, b.satCompress),
    vignette: n(a.vignette, b.vignette),
    vignetteTint: mixRGB(a.vignetteTint, b.vignetteTint, t),
    clarity: n(a.clarity, b.clarity),
    clarityBroad: n(a.clarityBroad, b.clarityBroad),
    bloom: n(a.bloom, b.bloom),
    bloomTint: mixRGB(a.bloomTint, b.bloomTint, t),
    bloomThreshold: n(a.bloomThreshold, b.bloomThreshold),
    paper: n(a.paper, b.paper),
    granulation: n(a.granulation, b.granulation),
    mottle: n(a.mottle, b.mottle),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Paper: a seamless 512 px tile, generated once and deterministically (no Math.random, no canvas).
//   R = fibre tooth   G = pigment granulation   B = wash mottle
// ---------------------------------------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** periodic smooth value noise: n x n random lattice sampled bicubically-smoothed on an S x S grid */
function periodicNoise(S: number, n: number, rng: () => number): Float32Array {
  const lat = new Float32Array(n * n);
  for (let i = 0; i < lat.length; i++) lat[i] = rng();
  const out = new Float32Array(S * S);
  const k = n / S;
  for (let y = 0; y < S; y++) {
    const fy = y * k;
    const y0 = Math.floor(fy);
    let ty = fy - y0;
    ty = ty * ty * (3 - 2 * ty);
    const ya = (y0 % n) * n;
    const yb = ((y0 + 1) % n) * n;
    for (let x = 0; x < S; x++) {
      const fx = x * k;
      const x0 = Math.floor(fx);
      let tx = fx - x0;
      tx = tx * tx * (3 - 2 * tx);
      const xa = x0 % n;
      const xb = (x0 + 1) % n;
      const a = lat[ya + xa] + (lat[ya + xb] - lat[ya + xa]) * tx;
      const b = lat[yb + xa] + (lat[yb + xb] - lat[yb + xa]) * tx;
      out[y * S + x] = a + (b - a) * ty;
    }
  }
  return out;
}

function normalise(a: Float32Array, std: number): void {
  let m = 0;
  for (let i = 0; i < a.length; i++) m += a[i];
  m /= a.length;
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m);
  const s = Math.sqrt(v / a.length) || 1;
  for (let i = 0; i < a.length; i++) a[i] = 0.5 + ((a[i] - m) / s) * std;
}

let paperTexture: THREE.DataTexture | null = null;

/** Cotton-rag paper tile (also the legacy export name). */
export function generatePaperGrainTexture(): THREE.DataTexture {
  if (paperTexture) return paperTexture;
  const S = 512;
  const rng = mulberry32(1865);

  // R: fibres laid down as short, slightly curved strokes + a little fine felt; later centred on 0.5
  const fibre = new Float32Array(S * S);
  const splat = (x: number, y: number, v: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    for (let oy = 0; oy < 2; oy++) {
      for (let ox = 0; ox < 2; ox++) {
        const w = (ox ? fx : 1 - fx) * (oy ? fy : 1 - fy);
        const px = (((ix + ox) % S) + S) % S;
        const py = (((iy + oy) % S) + S) % S;
        fibre[py * S + px] += v * w;
      }
    }
  };
  for (let f = 0; f < 5200; f++) {
    let x = rng() * S;
    let y = rng() * S;
    let a = rng() * Math.PI * 2;
    const curl = (rng() - 0.5) * 0.28;
    const len = 5 + rng() * 15;
    const amp = (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.65);
    for (let s = 0; s < len; s += 0.7) {
      splat(x, y, amp * 0.34);
      a += curl;
      x += Math.cos(a) * 0.7;
      y += Math.sin(a) * 0.7;
    }
  }
  const felt1 = periodicNoise(S, 256, rng);
  const felt2 = periodicNoise(S, 128, rng);
  const tooth = new Float32Array(S * S);
  for (let i = 0; i < tooth.length; i++) tooth[i] = fibre[i] * 0.9 + (felt1[i] - 0.5) * 0.9 + (felt2[i] - 0.5) * 0.7;
  normalise(tooth, 0.2);

  // G: granulation - clumps 8..30 px across
  const g1 = periodicNoise(S, 64, rng);
  const g2 = periodicNoise(S, 32, rng);
  const g3 = periodicNoise(S, 16, rng);
  const gran = new Float32Array(S * S);
  for (let i = 0; i < gran.length; i++) gran[i] = g1[i] * 0.5 + g2[i] * 0.33 + g3[i] * 0.17;
  normalise(gran, 0.2);

  // B: wash mottle - 40..250 px blooms (sampled again at a lower frequency in the shader)
  const m1 = periodicNoise(S, 12, rng);
  const m2 = periodicNoise(S, 6, rng);
  const m3 = periodicNoise(S, 3, rng);
  const mott = new Float32Array(S * S);
  for (let i = 0; i < mott.length; i++) mott[i] = m1[i] * 0.4 + m2[i] * 0.35 + m3[i] * 0.25;
  normalise(mott, 0.2);

  const data = new Uint8Array(S * S * 4);
  const q = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = q(tooth[i]);
    data[i * 4 + 1] = q(gran[i]);
    data[i * 4 + 2] = q(mott[i]);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  paperTexture = tex;
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------------
// Final pass material
// ---------------------------------------------------------------------------------------------------------------------

const FINAL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position, 1.0 );
  }
`;

const FINAL_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tBloom;
  uniform sampler2D tBloomWide;
  uniform sampler2D tPaper;
  uniform vec2 uRes;
  uniform float opacity;
  uniform float vignetteRadius;
  uniform vec3 colorGrade;
  uniform float uExposure;
  uniform vec3 uShadowTint;
  uniform vec3 uHighTint;
  uniform vec3 uLift;
  uniform float uContrast;
  uniform float uSat;
  uniform float uSatCompress;
  uniform float uVig;
  uniform vec3 uVigTint;
  uniform float uClarity;
  uniform float uClarityBroad;
  uniform float uBloom;
  uniform vec3 uBloomTint;
  uniform float uPaperAmt;
  uniform float uGran;
  uniform float uMottle;
  varying vec2 vUv;

  const vec2 K8[8] = vec2[8](
    vec2( 1.0, 0.0 ), vec2( 0.7071, 0.7071 ), vec2( 0.0, 1.0 ), vec2( -0.7071, 0.7071 ),
    vec2( -1.0, 0.0 ), vec2( -0.7071, -0.7071 ), vec2( 0.0, -1.0 ), vec2( 0.7071, -0.7071 )
  );

  float lum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
  float plum( vec3 c ) { return sqrt( max( lum( c ), 0.0 ) ); }

  void main() {
    vec2 px = 1.0 / uRes;
    float sc = uRes.y / 720.0;

    vec3 c0 = texture2D( tDiffuse, vUv ).rgb;

    // --- local contrast on the (perceptual) luma of the linear scene -------------------------------------------------
    float Lc = plum( c0 );
    float detail = 0.0;
    if ( uClarity > 0.0 || uClarityBroad > 0.0 ) {
      float Lf = 0.0;
      float Lb = 0.0;
      vec2 rf = px * 2.4 * sc;
      vec2 rb = px * 8.0 * sc;
      for ( int i = 0; i < 8; i++ ) {
        Lf += plum( texture2D( tDiffuse, vUv + K8[i] * rf ).rgb );
        Lb += plum( texture2D( tDiffuse, vUv + K8[i] * rb ).rgb );
      }
      float dF = Lc - Lf * 0.125;
      float dB = Lc - Lb * 0.125;
      dF = dF / ( 1.0 + 10.0 * abs( dF ) );
      dB = dB / ( 1.0 + 6.0 * abs( dB ) );
      detail = dF * uClarity + dB * uClarityBroad;
    }

    // --- bloom / halation (added in linear light, before the tone-map) -----------------------------------------------
    vec3 hdr = c0 * colorGrade * uExposure;
    if ( uBloom > 0.0 ) {
      vec3 bl = texture2D( tBloom, vUv ).rgb * 0.62 + texture2D( tBloomWide, vUv ).rgb * 0.7;
      hdr += bl * uBloom * uBloomTint;
    }
    gl_FragColor = vec4( hdr, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 d = gl_FragColor.rgb;

    // clarity, hue-preserving
    d += vec3( detail ) * mix( vec3( 1.0 ), d / max( lum( d ), 0.06 ), 0.4 );
    d = max( d, vec3( 0.0 ) );

    // --- S-curve ------------------------------------------------------------------------------------------------------
    vec3 dc = clamp( d, 0.0, 1.0 );
    d = mix( d, dc * dc * ( 3.0 - 2.0 * dc ), uContrast );

    // --- split toning: warm paper-amber lights over cool violet-teal shadows ---------------------------------------
    float l = lum( d );
    float t = smoothstep( 0.10, 0.82, l );
    d *= mix( uShadowTint, uHighTint, t );
    d += uLift * ( 1.0 - t ) * ( 1.0 - t );

    // --- saturation with a compressor for the hottest pigment ------------------------------------------------------
    l = lum( d );
    float mx = max( d.r, max( d.g, d.b ) );
    float mn = min( d.r, min( d.g, d.b ) );
    float s = ( mx - mn ) / max( mx, 1e-3 );
    float k = uSat * ( 1.0 - uSatCompress * smoothstep( 0.40, 0.95, s ) );
    d = mix( vec3( l ), d, k );

    // --- the paper -----------------------------------------------------------------------------------------------------
    vec2 puv = vUv * vec2( uRes.x / uRes.y, 1.0 ) * ( 720.0 / 512.0 );
    vec3 pp = texture2D( tPaper, puv ).rgb;
    // three independently drifting washes (one per channel), sampled at different offsets of the same low-frequency page
    vec3 pm = vec3( texture2D( tPaper, puv * 0.21 + vec2( 0.37, 0.61 ) ).b,
                    texture2D( tPaper, puv * 0.17 + vec2( 0.81, 0.23 ) ).b,
                    texture2D( tPaper, puv * 0.25 + vec2( 0.12, 0.74 ) ).b );
    float dark = 1.0 - smoothstep( 0.05, 0.85, lum( d ) );
    float tooth = ( pp.r - 0.5 ) * 2.0;
    float gran = ( pp.g - 0.5 ) * 2.0;
    vec3 mott = ( pm - 0.5 ) * 2.0;
    d *= 1.0 + tooth * opacity * uPaperAmt;
    d *= 1.0 + gran * uGran * ( 0.30 + 0.70 * dark );
    d *= 1.0 + mott * uMottle;

    // --- vignette: a tinted wash, never black ---------------------------------------------------------------------------
    vec2 q = ( vUv - 0.5 ) * vec2( 1.0, 0.82 );
    float vv = smoothstep( 0.30, 0.82, length( q ) );
    d = mix( d, d * uVigTint, vv * uVig );

    // --- telescope iris of the shrinking sequence (black) ----------------------------------------------------------------
    float dist = length( vUv - 0.5 );
    float iris = smoothstep( vignetteRadius - 0.2, vignetteRadius + 0.1, dist );
    d = mix( d, vec3( 0.0 ), iris );

    gl_FragColor = vec4( clamp( d, 0.0, 1.0 ), 1.0 );
  }
`;

function applyGradeUniforms(u: Record<string, THREE.IUniform>, g: GradeParams): void {
  u.uExposure.value = g.exposure;
  (u.uShadowTint.value as THREE.Vector3).set(...g.shadowTint);
  (u.uHighTint.value as THREE.Vector3).set(...g.highlightTint);
  (u.uLift.value as THREE.Vector3).set(...g.lift);
  u.uContrast.value = g.contrast;
  u.uSat.value = g.saturation;
  u.uSatCompress.value = g.satCompress;
  u.uVig.value = g.vignette;
  (u.uVigTint.value as THREE.Vector3).set(...g.vignetteTint);
  u.uClarity.value = g.clarity;
  u.uClarityBroad.value = g.clarityBroad;
  u.uBloom.value = g.bloom;
  (u.uBloomTint.value as THREE.Vector3).set(...g.bloomTint);
  u.uPaperAmt.value = g.paper;
  u.uGran.value = g.granulation;
  u.uMottle.value = g.mottle;
}

let blackTexture: THREE.DataTexture | null = null;
function getBlackTexture(): THREE.DataTexture {
  if (!blackTexture) {
    blackTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    blackTexture.needsUpdate = true;
  }
  return blackTexture;
}

/** Final grade / paper / vignette material. Legacy uniforms (tDiffuse, tPaper, opacity, vignetteRadius, colorGrade) are kept. */
export function createPaperGrainOverlayMaterial(): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    tDiffuse: { value: null },
    tBloom: { value: getBlackTexture() },
    tBloomWide: { value: getBlackTexture() },
    tPaper: { value: generatePaperGrainTexture() },
    uRes: { value: new THREE.Vector2(1280, 720) },
    opacity: { value: 0.15 },
    vignetteRadius: { value: 1.5 }, // large enough to be fully off-screen by default; the shrink sequence narrows it
    colorGrade: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uExposure: { value: 1 },
    uShadowTint: { value: new THREE.Vector3(1, 1, 1) },
    uHighTint: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uContrast: { value: 0 },
    uSat: { value: 1 },
    uSatCompress: { value: 0 },
    uVig: { value: 0 },
    uVigTint: { value: new THREE.Vector3(0.6, 0.55, 0.7) },
    uClarity: { value: 0 },
    uClarityBroad: { value: 0 },
    uBloom: { value: 0 },
    uBloomTint: { value: new THREE.Vector3(1, 0.9, 0.7) },
    uPaperAmt: { value: 0.2 },
    uGran: { value: 0 },
    uMottle: { value: 0 },
  };
  applyGradeUniforms(uniforms, NEUTRAL_GRADE);
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FINAL_VERT,
    fragmentShader: FINAL_FRAG,
    transparent: false,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Bloom chain + final pass driver
// ---------------------------------------------------------------------------------------------------------------------

const BLOOM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position, 1.0 );
  }
`;

const EXTRACT_FRAG = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    // 4x4 box of the full-resolution target through four bilinear taps, then keep only the brightest light
    vec3 c = texture2D( tSrc, vUv + uTexel * vec2( -1.0, -1.0 ) ).rgb
           + texture2D( tSrc, vUv + uTexel * vec2( 1.0, -1.0 ) ).rgb
           + texture2D( tSrc, vUv + uTexel * vec2( -1.0, 1.0 ) ).rgb
           + texture2D( tSrc, vUv + uTexel * vec2( 1.0, 1.0 ) ).rgb;
    c *= 0.25;
    float m = max( c.r, max( c.g, c.b ) );
    float w = smoothstep( uThreshold, uThreshold + 0.45, m );
    gl_FragColor = vec4( c * w, 1.0 );
  }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec2 o = uTexel * uDir;
    vec3 c = texture2D( tSrc, vUv ).rgb * 0.2270;
    c += ( texture2D( tSrc, vUv + o * 1.0 ).rgb + texture2D( tSrc, vUv - o * 1.0 ).rgb ) * 0.1946;
    c += ( texture2D( tSrc, vUv + o * 2.0 ).rgb + texture2D( tSrc, vUv - o * 2.0 ).rgb ) * 0.1216;
    c += ( texture2D( tSrc, vUv + o * 3.0 ).rgb + texture2D( tSrc, vUv - o * 3.0 ).rgb ) * 0.0541;
    c += ( texture2D( tSrc, vUv + o * 4.0 ).rgb + texture2D( tSrc, vUv - o * 4.0 ).rgb ) * 0.0162;
    gl_FragColor = vec4( c, 1.0 );
  }
`;

function makeSmallTarget(): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(4, 4, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

/**
 * Owns the final pass material and the bloom render targets. `source` is the renderer's linear HDR scene target.
 */
export class PostProcessor {
  public readonly material: THREE.ShaderMaterial;
  private grade: GradeParams = { ...NEUTRAL_GRADE };
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private extract: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private a4 = makeSmallTarget();
  private b4 = makeSmallTarget();
  private a8 = makeSmallTarget();
  private b8 = makeSmallTarget();

  constructor(
    private gl: THREE.WebGLRenderer,
    private source: THREE.WebGLRenderTarget
  ) {
    this.material = createPaperGrainOverlayMaterial();
    this.material.uniforms.tDiffuse.value = source.texture;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.extract = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.8 } },
      vertexShader: BLOOM_VERT,
      fragmentShader: EXTRACT_FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) } },
      vertexShader: BLOOM_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.setSize(source.width, source.height);
  }

  public getGrade(): GradeParams {
    return this.grade;
  }

  /** Merge a (partial) grade into the current one. */
  public setGrade(p: Partial<GradeParams>): void {
    this.grade = { ...this.grade, ...p };
    applyGradeUniforms(this.material.uniforms, this.grade);
  }

  public setTelescopeVignette(radius: number): void {
    this.material.uniforms.vignetteRadius.value = radius;
  }

  public setColorGrade(color: THREE.ColorRepresentation): void {
    this.material.uniforms.colorGrade.value.set(new THREE.Color(color));
  }

  public setSize(w: number, h: number): void {
    const w4 = Math.max(2, Math.ceil(w / 4));
    const h4 = Math.max(2, Math.ceil(h / 4));
    const w8 = Math.max(2, Math.ceil(w / 8));
    const h8 = Math.max(2, Math.ceil(h / 8));
    this.a4.setSize(w4, h4);
    this.b4.setSize(w4, h4);
    this.a8.setSize(w8, h8);
    this.b8.setSize(w8, h8);
    (this.material.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }

  private pass(mat: THREE.ShaderMaterial, src: THREE.Texture, srcW: number, srcH: number, dst: THREE.WebGLRenderTarget): void {
    mat.uniforms.tSrc.value = src;
    (mat.uniforms.uTexel.value as THREE.Vector2).set(1 / srcW, 1 / srcH);
    this.quad.material = mat;
    this.gl.setRenderTarget(dst);
    this.gl.render(this.scene, this.camera);
  }

  /** Runs the bloom chain (when enabled) and draws the final picture to the screen. */
  public render(): void {
    const useBloom = this.grade.bloom > 0.001;
    if (useBloom) {
      const sw = this.source.width;
      const sh = this.source.height;
      this.extract.uniforms.uThreshold.value = this.grade.bloomThreshold;
      this.pass(this.extract, this.source.texture, sw, sh, this.a4);
      this.blur.uniforms.uDir.value.set(1, 0);
      this.pass(this.blur, this.a4.texture, this.a4.width, this.a4.height, this.b4);
      this.blur.uniforms.uDir.value.set(0, 1);
      this.pass(this.blur, this.b4.texture, this.b4.width, this.b4.height, this.a4);
      // wide halo: 1/8 resolution copy of the already-soft 1/4 level, blurred again
      this.blur.uniforms.uDir.value.set(1, 0);
      this.pass(this.blur, this.a4.texture, this.a4.width, this.a4.height, this.a8);
      this.blur.uniforms.uDir.value.set(0, 1);
      this.pass(this.blur, this.a8.texture, this.a8.width, this.a8.height, this.b8);
      this.material.uniforms.tBloom.value = this.a4.texture;
      this.material.uniforms.tBloomWide.value = this.b8.texture;
    } else {
      this.material.uniforms.tBloom.value = getBlackTexture();
      this.material.uniforms.tBloomWide.value = getBlackTexture();
    }
    this.quad.material = this.material;
    this.gl.setRenderTarget(null);
    this.gl.clear();
    this.gl.render(this.scene, this.camera);
  }
}
