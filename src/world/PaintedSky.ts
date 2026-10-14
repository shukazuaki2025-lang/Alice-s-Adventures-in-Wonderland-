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
  top: 0x6fa8d6,
  mid: 0xb8d8e8,
  horizon: 0xf7ecd0,
  glow: 0xffe3a0,
  clouds: 0.55,
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
        void main() {
          vec3 d = normalize( vDir );
          float h = clamp( d.y, 0.0, 1.0 );
          vec3 col = mix( uHorizon, uMid, smoothstep( 0.0, 0.28, h ) );
          col = mix( col, uTop, smoothstep( 0.22, 0.85, h ) );
          // sun glow
          float s = max( dot( d, normalize( uSunDir ) ), 0.0 );
          col += uGlow * ( pow( s, 24.0 ) * 0.35 + pow( s, 180.0 ) * 0.9 );
          // watercolour clouds on a projected plane
          vec2 uv = d.xz / ( d.y + 0.28 ) * 0.9 + vec2( uTime * 0.004, uTime * 0.0015 );
          vec2 warp = vec2( fbm( uv * 1.7 + 3.1 ), fbm( uv * 1.7 + 9.7 ) );
          float c = fbm( uv + warp * 0.9 );
          float cloud = smoothstep( 0.60 - uClouds * 0.12, 0.78 - uClouds * 0.06, c ) * smoothstep( 0.02, 0.22, d.y );
          // paper-dab edge: second, tighter threshold gives the cloud a lighter body and a warm shaded underside
          float body = smoothstep( 0.70, 0.86, c );
          vec3 cloudCol = mix( vec3( 1.0, 0.93, 0.82 ), vec3( 1.0, 0.99, 0.96 ), body );
          cloudCol = mix( cloudCol, uHorizon * 1.05, 0.25 * ( 1.0 - body ) );
          col = mix( col, cloudCol, cloud * 0.92 );
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
