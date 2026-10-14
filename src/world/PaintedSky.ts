import * as THREE from 'three';

export interface SkyPalette {
  top: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  glow: THREE.ColorRepresentation;
  /** 0 = clear, 1 = overcast storybook clouds */
  clouds: number;
}

export const SKY_DAY: SkyPalette = {
  top: 0x5d8fd0,
  mid: 0xa9d2e6,
  horizon: 0xfbe6c4,
  glow: 0xffd890,
  clouds: 0.6,
};

/**
 * Painted storybook sky dome: warm cream horizon rising to soft cerulean, with watercolour clouds
 * (domain-warped fbm, thresholded with a soft edge and a warm underside) and a sun glow.
 */
export class PaintedSky {
  public readonly mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(palette: SkyPalette = SKY_DAY) {
    this.uniforms = {
      uTop: { value: new THREE.Color(palette.top) },
      uMid: { value: new THREE.Color(palette.mid) },
      uHorizon: { value: new THREE.Color(palette.horizon) },
      uGlow: { value: new THREE.Color(palette.glow) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.55, 0.7).normalize() },
      uClouds: { value: palette.clouds },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize( position );
          vec4 p = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w; // always at the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uMid, uHorizon, uGlow, uSunDir;
        uniform float uClouds, uTime;
        varying vec3 vDir;
        float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        float vnoise( vec2 p ) {
          vec2 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
        }
        float fbm( vec2 p ) {
          float a = 0.5, s = 0.0;
          for ( int i = 0; i < 5; i++ ) { s += a * vnoise( p ); p = p * 2.03 + 17.0; a *= 0.5; }
          return s;
        }
        float fbm3( vec2 p ) {
          float a = 0.5, s = 0.0;
          for ( int i = 0; i < 3; i++ ) { s += a * vnoise( p ); p = p * 2.03 + 17.0; a *= 0.5; }
          return s;
        }
        // one deck of watercolour cumulus: returns ( coverage, lit-side factor )
        vec2 cloudDeck( vec2 uv, vec2 sunUv, float cover, float soft ) {
          vec2 warp = vec2( fbm( uv * 1.7 + 3.1 ), fbm( uv * 1.7 + 9.7 ) );
          float c = fbm( uv + warp * 0.9 );
          float c2 = fbm( uv + sunUv * 0.07 + warp * 0.9 );
          float cov = smoothstep( 0.60 - cover * 0.12, 0.60 - cover * 0.12 + soft, c );
          float lit = clamp( 0.5 + ( c2 - c ) * 7.0, 0.0, 1.0 );
          return vec2( cov, lit );
        }
        void main() {
          vec3 d = normalize( vDir );
          float h = clamp( d.y, 0.0, 1.0 );
          // seamless azimuth coordinate (a plain atan() would leave a vertical seam behind the camera)
          float az = ( d.x * 5.0 + d.z * 3.1 ) / 2.6;
          // wet-in-wet bands: the wash is laid in horizontal sweeps that bleed into each other
          float band = fbm3( vec2( az * 2.6, h * 20.0 ) + 3.0 ) - 0.5;
          float hb = clamp( h + band * 0.08, 0.0, 1.0 );
          vec3 col = mix( uHorizon, uMid, smoothstep( 0.0, 0.30, hb ) );
          col = mix( col, uTop, smoothstep( 0.20, 0.88, hb ) );
          // patches of warmer and cooler pigment across the sky
          float drift = fbm3( vec2( az * 1.3, h * 4.0 ) + 9.0 ) - 0.5;
          col *= vec3( 1.0 + drift * 0.16, 1.0 + drift * 0.05, 1.0 - drift * 0.16 );
          // sun glow
          vec3 sd = normalize( uSunDir );
          float s = max( dot( d, sd ), 0.0 );
          col += uGlow * ( pow( s, 24.0 ) * 0.35 + pow( s, 180.0 ) * 0.9 );

          // two decks of clouds lit from the sun side, shaded in lilac and warm rose underneath
          vec2 sunUv = normalize( sd.xz + 1e-4 ) ;
          vec2 uv1 = d.xz / ( d.y + 0.28 ) * 0.9 + vec2( uTime * 0.004, uTime * 0.0015 );
          vec2 cl1 = cloudDeck( uv1, sunUv, uClouds, 0.18 );
          vec2 uv2 = d.xz / ( d.y + 0.45 ) * 2.1 + vec2( 4.0 - uTime * 0.006, 1.7 );
          vec2 cl2 = cloudDeck( uv2, sunUv, uClouds * 0.8, 0.16 );
          float elev = smoothstep( 0.02, 0.22, d.y );
          vec3 litCol = vec3( 1.0, 0.965, 0.88 );
          vec3 shadeCol = vec3( 0.70, 0.71, 0.86 );
          vec3 rose = vec3( 0.97, 0.80, 0.78 );
          vec3 c1 = mix( mix( shadeCol, rose, 0.35 ), litCol, cl1.y );
          vec3 c2c = mix( shadeCol * 1.05, litCol, cl2.y * 0.9 + 0.1 );
          c1 = mix( c1, uHorizon * 1.04, 0.2 * ( 1.0 - cl1.y ) );
          col = mix( col, c2c, cl2.x * 0.55 * elev );
          col = mix( col, c1, cl1.x * 0.94 * elev );

          // distant blue-lilac ridges just above the horizon
          float r2 = 0.012 + 0.05 * fbm3( vec2( az * 1.9 + 2.0, 1.0 ) );
          float r1 = 0.004 + 0.034 * fbm3( vec2( az * 3.1 + 7.0, 5.0 ) );
          vec3 hill2 = mix( uHorizon, vec3( 0.58, 0.63, 0.84 ), 0.6 );
          vec3 hill1 = mix( uHorizon, vec3( 0.46, 0.62, 0.70 ), 0.62 );
          col = mix( col, hill2, ( 1.0 - smoothstep( r2 - 0.004, r2 + 0.004, d.y ) ) * 0.8 );
          col = mix( col, hill1, ( 1.0 - smoothstep( r1 - 0.004, r1 + 0.004, d.y ) ) * 0.85 );

          gl_FragColor = vec4( col, 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
    this.mesh.name = 'PaintedSky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  public setPalette(p: SkyPalette): void {
    (this.uniforms.uTop.value as THREE.Color).set(p.top);
    (this.uniforms.uMid.value as THREE.Color).set(p.mid);
    (this.uniforms.uHorizon.value as THREE.Color).set(p.horizon);
    (this.uniforms.uGlow.value as THREE.Color).set(p.glow);
    this.uniforms.uClouds.value = p.clouds;
  }

  public setSunDirection(dir: THREE.Vector3): void {
    (this.uniforms.uSunDir.value as THREE.Vector3).copy(dir).normalize();
  }

  /** Keep the dome centred on the camera and drift the clouds. */
  public update(dt: number, cameraPosition: THREE.Vector3): void {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(cameraPosition);
  }
}
