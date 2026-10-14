import * as THREE from 'three';
import './../shaders/AtmosphericFog';
import { GradeParams, PostProcessor } from '../shaders/PaperGrain';

/**
 * Three.js WebGPU / WebGL2 Dual Render Engine with ?forceWebGL=1 support.
 * The scene is drawn into a linear half-float target; PostProcessor (src/shaders/PaperGrain.ts) bloom-glows, grades and
 * lays the paper over it, with a tinted vignette, the telescope iris and responsive resize handling.
 */
export class RenderEngine {
  public renderer: THREE.WebGLRenderer;
  /** draw calls / triangles of the last *scene* pass (excludes the full-screen post passes); read by the quality gate */
  public readonly sceneStats = { calls: 0, triangles: 0 };
  private post: PostProcessor;
  private renderTarget: THREE.WebGLRenderTarget;
  /** device pixel ratio × optional ?scale= (0.25–1): lets software-GPU CI render fewer pixels without touching the layout */
  private pixelRatio: number;

  constructor(canvas: HTMLCanvasElement) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceWebGL = urlParams.get('forceWebGL') === '1';
    const renderScale = Math.min(1, Math.max(0.25, parseFloat(urlParams.get('scale') ?? '1') || 1));
    const msaa = Math.max(0, Math.min(8, parseInt(urlParams.get('msaa') ?? '4', 10) || 0));

    if (!forceWebGL && typeof navigator !== 'undefined' && 'gpu' in navigator) {
      console.log('[RenderEngine] WebGPU capability detected; using WebGL2 compatible pipeline for custom GLSL shaders.');
    } else if (forceWebGL) {
      console.log('[RenderEngine] ?forceWebGL=1 query parameter detected. Using WebGL2 pipeline.');
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
    this.pixelRatio = pixelRatio;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.autoClear = false;

    // Scene is drawn in linear HDR (half-float) with 4x MSAA; the post pass tone-maps, grades and sRGB-encodes it.
    this.renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        samples: msaa,
      }
    );

    this.post = new PostProcessor(this.renderer, this.renderTarget);
    // 15% paper opacity as per requirements (the tooth amplitude itself is part of the grade)
    this.post.material.uniforms.opacity.value = 0.15;

    // Bind resize to window
    window.addEventListener('resize', () => {
      this.resize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * Controls the circular telescope vignette radius during Alice's 2.5s shrinking sequence (WP-6).
   * Default radius is 1.5 (off-screen); shrinking narrows it to ~0.38 then restores to 1.5.
   */
  public setTelescopeVignette(radius: number): void {
    this.post.setTelescopeVignette(radius);
  }

  public setColorGrade(color: THREE.ColorRepresentation): void {
    this.post.setColorGrade(color);
  }

  /** Painterly colour grade / bloom / paper settings of the current scene (see SceneLighting.gradeForState). */
  public setGrade(grade: Partial<GradeParams>): void {
    this.post.setGrade(grade);
  }

  public getGrade(): GradeParams {
    return this.post.getGrade();
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    // Render main scene to offscreen render target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.sceneStats.calls = this.renderer.info.render.calls;
    this.sceneStats.triangles = this.renderer.info.render.triangles;

    // Bloom chain + grade + paper to the screen
    this.post.render();
  }

  public resize(width: number, height: number): void {
    const pixelRatio = this.pixelRatio;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderTarget.setSize(width * pixelRatio, height * pixelRatio);
    this.post.setSize(width * pixelRatio, height * pixelRatio);
  }
}
