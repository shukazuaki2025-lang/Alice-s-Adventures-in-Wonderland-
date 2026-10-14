import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { convertMaterialsToToon } from '../shaders/ToonShaders';
import { applyInkOutline } from '../shaders/InkOutline';

const num = (p: URLSearchParams, k: string, d: number): number => {
  const v = p.get(k);
  if (v === null || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export class ModelViewer {
  public ready: Promise<void>;
  private resolveReady!: () => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private mixers: THREE.AnimationMixer[] = [];
  private clips: THREE.AnimationClip[] = [];
  private activeClip = '';
  private yaw: number;
  private pitch: number;
  private dist: number;
  private target: THREE.Vector3;
  private drag: { x: number; y: number } | null = null;
  private hud = document.getElementById('viewer-hud');
  private clipList = document.getElementById('viewer-clips');
  private turntable: boolean;
  private playing: boolean;
  private lastTime = 0;
  private bounds = new THREE.Box3();

  constructor(private canvas: HTMLCanvasElement, private params: URLSearchParams) {
    this.ready = new Promise((r) => (this.resolveReady = r));
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;

    this.scene.background = new THREE.Color(params.get('bg') ?? '#d9d3c3');
    const hemi = new THREE.HemisphereLight(0xfff8e7, 0x7c6a58, 1.35);
    const amb = new THREE.AmbientLight(0xf7f3ea, 0.85);
    const key = new THREE.DirectionalLight(0xfff0d0, 1.6);
    key.position.set(3, 6, 5);
    this.scene.add(hemi, amb, key);

    this.camera = new THREE.PerspectiveCamera(num(params, 'fov', 32), window.innerWidth / window.innerHeight, 0.01, 100);
    this.yaw = THREE.MathUtils.degToRad(num(params, 'yaw', 20));
    this.pitch = THREE.MathUtils.degToRad(num(params, 'pitch', 6));
    this.dist = num(params, 'dist', 4.2);
    this.target = new THREE.Vector3(num(params, 'tx', 0), num(params, 'ty', 0.6), num(params, 'tz', 0));
    this.turntable = params.get('turntable') === '1';
    this.playing = !params.has('p') && !params.has('t') && !params.has('sheet');
    this.scene.add(this.root);

    if (params.get('floor') !== '0') {
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(2.2, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(params.get('bg') ?? '#d9d3c3').multiplyScalar(0.92) })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      this.scene.add(floor);
    }

    if (params.get('ui') === '0') {
      if (this.hud) this.hud.style.display = 'none';
      if (this.clipList) this.clipList.style.display = 'none';
    }
    this.bindInput();
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.yaw -= (e.clientX - this.drag.x) * 0.007;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - this.drag.y) * 0.005, -1.2, 1.4);
      this.drag = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', () => (this.drag = null));
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(e.deltaY * 0.001), 0.3, 30);
        e.preventDefault();
      },
      { passive: false }
    );
  }

  public async start(): Promise<void> {
    const model = this.params.get('model') ?? 'chr_alice';
    const url = model.startsWith('/') ? model : `/assets/models/${model}.glb`;
    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(url);
    } catch (e) {
      (window as unknown as { __viewerError?: string }).__viewerError = String(e);
      this.resolveReady();
      return;
    }
    this.clips = gltf.animations;

    const shading = this.params.get('shading') ?? 'toon';
    const withInk = this.params.get('ink') !== '0';
    // Debug helpers: ?hide=Hair|Dress (regex) hides matching meshes, ?only=Head keeps only matching ones.
    const hideRe = this.params.get('hide') ? new RegExp(this.params.get('hide')!) : null;
    const onlyRe = this.params.get('only') ? new RegExp(this.params.get('only')!) : null;
    const hideMatRe = this.params.get('hidemat') ? new RegExp(this.params.get('hidemat')!) : null;
    const prep = (obj: THREE.Object3D): void => {
      obj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const m = (c as THREE.Mesh).material;
          const matName = Array.isArray(m) ? m.map((x) => x.name).join(',') : m.name;
          const parentName = c.parent?.name ?? '';
          const nm = `${c.name}|${parentName}`;
          if ((hideRe && hideRe.test(nm)) || (onlyRe && !onlyRe.test(nm)) || (hideMatRe && hideMatRe.test(matName))) c.visible = false;
        }
      });
      if (shading === 'toon') convertMaterialsToToon(obj);
      if (shading === 'toon' && withInk) {
        // ink width scales with the object (a 5 cm cake must not get the 2.6 mm line of a 1.2 m girl); ?inkw= overrides
        const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
        const auto = Math.max(0.0002, 0.0026 * Math.min(1, Math.max(size.x, size.y, size.z) / 1.2));
        applyInkOutline(obj, 0x2b2420, num(this.params, 'inkw', auto));
      }
      obj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).frustumCulled = false;
      });
    };

    const sheet = Math.floor(num(this.params, 'sheet', 0));
    const clipName = this.params.get('clip') ?? '';
    const spacing = num(this.params, 'spacing', 1.0);
    const count = sheet > 0 ? sheet : 1;
    const pristine = cloneSkinned(gltf.scene); // clone BEFORE the toon/ink conversion mutates the scene
    const alongZ = this.params.get('axis') === 'z';
    for (let i = 0; i < count; i++) {
      const inst = cloneSkinned(pristine);
      prep(inst);
      const off = (i - (count - 1) / 2) * spacing;
      if (alongZ) inst.position.z = off;
      else inst.position.x = off;
      this.root.add(inst);
      if (this.clips.length) {
        const mixer = new THREE.AnimationMixer(inst);
        this.mixers.push(mixer);
        const clip = this.clips.find((c) => c.name === clipName) ?? this.clips.find((c) => c.name.endsWith('_Idle')) ?? this.clips[0];
        const action = mixer.clipAction(clip);
        action.play();
        this.activeClip = clip.name;
        const frac = sheet > 0 ? i / count : num(this.params, 'p', NaN);
        if (Number.isFinite(frac)) {
          action.paused = true;
          action.time = frac * clip.duration;
        } else if (this.params.has('t')) {
          action.paused = true;
          action.time = num(this.params, 't', 0);
        }
        mixer.update(0);
      }
    }
    this.root.updateWorldMatrix(true, true);
    this.bounds.setFromObject(this.root);
    this.buildClipButtons();

    this.canvas.style.cursor = 'grab';
    this.loop(0);
    // Two frames so the first image is fully rasterised before screenshots.
    requestAnimationFrame(() => requestAnimationFrame(() => this.resolveReady()));
  }

  private buildClipButtons(): void {
    if (!this.clipList) return;
    this.clipList.innerHTML = '';
    for (const clip of this.clips) {
      const b = document.createElement('button');
      b.textContent = `${clip.name}  (${clip.duration.toFixed(2)}s)`;
      b.onclick = () => this.playClip(clip.name);
      if (clip.name === this.activeClip) b.classList.add('active');
      this.clipList.appendChild(b);
    }
  }

  public playClip(name: string): void {
    const clip = this.clips.find((c) => c.name === name);
    if (!clip) return;
    this.playing = true;
    this.activeClip = name;
    for (const m of this.mixers) {
      m.stopAllAction();
      m.clipAction(clip).reset().play();
    }
    this.buildClipButtons();
  }

  public getClipNames(): string[] {
    return this.clips.map((c) => c.name);
  }

  private loop = (ms: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (ms - this.lastTime) / 1000 || 0.016);
    this.lastTime = ms;
    if (this.playing) for (const m of this.mixers) m.update(dt);
    if (this.turntable) this.yaw += dt * 0.6;

    const sheetSpan = Math.max(1, Math.floor(num(this.params, 'sheet', 0)));
    let fit = 0;
    if (sheetSpan > 1) {
      const half = (sheetSpan * num(this.params, 'spacing', 1.0)) / 2 + 0.1;
      const halfV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect;
      fit = half / halfV;
      if (this.params.get('axis') === 'z' && Math.abs(Math.sin(this.yaw)) < 0.5) fit = 0;
    }
    const d = Math.max(this.dist, fit);
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * d,
      this.target.y + Math.sin(this.pitch) * d,
      this.target.z + Math.cos(this.yaw) * cp * d
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);

    if (this.hud && this.params.get('ui') !== '0') {
      const size = this.bounds.getSize(new THREE.Vector3());
      this.hud.textContent = `${this.params.get('model') ?? 'chr_alice'}   ${this.activeClip}\nbounds ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m\ndrag = orbit · wheel = zoom`;
    }
  };
}
