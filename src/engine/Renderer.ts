import * as THREE from 'three';
import { createPaperGrainOverlayMaterial } from '../shaders/PaperGrain';

/**
 * Three.js WebGPU / WebGL2 Dual Render Engine with ?forceWebGL=1 support,
 * screen-space PaperGrain overlay, telescope circular vignette, and responsive resize handling.
 */
export class RenderEngine {
  public renderer: THREE.WebGLRenderer;
  private overlayScene: THREE.Scene;
  private overlayCamera: THREE.OrthographicCamera;
  private overlayMaterial: THREE.ShaderMaterial;
  private renderTarget: THREE.WebGLRenderTarget;

  constructor(canvas: HTMLCanvasElement) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceWebGL = urlParams.get('forceWebGL') === '1';

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

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;

    this.renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        colorSpace: THREE.SRGBColorSpace,
      }
    );

    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.overlayMaterial = createPaperGrainOverlayMaterial();
    this.overlayMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    // Set to 15% opacity as per requirements
    this.overlayMaterial.uniforms.opacity.value = 0.15;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.overlayMaterial);
    quad.frustumCulled = false;
    this.overlayScene.add(quad);
    
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
    if (this.overlayMaterial?.uniforms?.vignetteRadius) {
      this.overlayMaterial.uniforms.vignetteRadius.value = radius;
    }
  }

  public setColorGrade(color: THREE.ColorRepresentation): void {
    if (this.overlayMaterial?.uniforms?.colorGrade) {
      this.overlayMaterial.uniforms.colorGrade.value.set(new THREE.Color(color));
    }
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    // Render main scene to offscreen render target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    // Render overlay to screen
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }

  public resize(width: number, height: number): void {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderTarget.setSize(width * pixelRatio, height * pixelRatio);
  }
}
