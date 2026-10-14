import { ModelViewer } from './ModelViewer';

/**
 * Real model / animation viewer (replaces the old spinning-cube placeholder).
 *
 *   /viewer.html?model=chr_alice                       turntable-able orbit view with the game's toon + ink pipeline
 *   &clip=Alice_Walk&p=0.25                            freeze a clip at 25 % of its length
 *   &sheet=8&clip=Alice_Walk                           contact sheet: 8 evenly spaced poses across one cycle
 *   &yaw=90&pitch=5&dist=2.4&fov=30&ty=0.6              framing (degrees / metres)
 *   &shading=raw|toon   &ink=0|1   &bg=%23e8e2d4        look controls
 *   &ui=0                                                hide HUD (clean screenshots)
 *
 * `window.__viewer.ready` resolves once the first frame has been drawn.
 */
const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('viewer-canvas') as HTMLCanvasElement;
const viewer = new ModelViewer(canvas, params);
(window as unknown as { __viewer: ModelViewer }).__viewer = viewer;
viewer.start();
