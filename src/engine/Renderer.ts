import * as THREE from 'three';
import { createPaperGrainOverlayMaterial } from '../shaders/PaperGrain';

/**
 * Three.js WebGPU / WebGL2 Dual Render Engine with ?forceWebGL=1 support
 */
export class RenderEngine {
  public renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceWebGL = urlParams.get('forceWebGL') === '1';

    // Standard WebGL2 renderer initialization with WebGPU fallback detection
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });

    if (forceWebGL) {
      console.log('[RenderEngine] ?forceWebGL=1 query parameter detected. Using WebGL2 pipeline.');
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.setupPaperGrainOverlay();
  }

  private setupPaperGrainOverlay(): void {
    createPaperGrainOverlayMaterial();
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.renderer.render(scene, camera);
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
