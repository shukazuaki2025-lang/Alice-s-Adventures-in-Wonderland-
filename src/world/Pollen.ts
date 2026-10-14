import * as THREE from 'three';

/** Drifting pollen / dust motes around the camera: a few hundred additive soft points (sunny afternoon feel). */
export class Pollen {
  public readonly points: THREE.Points;
  private base: Float32Array;
  private seeds: Float32Array;
  private time = 0;
  private radius: number;

  constructor(count = 260, radius = 14, color: THREE.ColorRepresentation = 0xfff1b8) {
    this.radius = radius;
    const geo = new THREE.BufferGeometry();
    this.base = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = (Math.random() * 2 - 1) * radius;
      this.base[i * 3 + 1] = 0.3 + Math.random() * 4.5;
      this.base[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
      this.seeds[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(c);
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map,
        color,
        size: 0.09,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      })
    );
    this.points.frustumCulled = false;
    this.points.name = 'Pollen';
  }

  /** daytime pollen vs warm dust motes in gaslight (smaller for the tiny Alice) */
  public setLook(kind: 'pollen' | 'dust' | 'dust-small'): void {
    const mat = this.points.material as THREE.PointsMaterial;
    if (kind === 'pollen') {
      mat.color.setHex(0xfff1b8);
      mat.size = 0.09;
      mat.opacity = 0.8;
    } else {
      mat.color.setHex(0xffd08a);
      mat.size = kind === 'dust' ? 0.045 : 0.02;
      mat.opacity = 0.65;
    }
  }

  public update(dt: number, center: THREE.Vector3): void {
    this.time += dt;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const r = this.radius;
    for (let i = 0; i < pos.count; i++) {
      const s = this.seeds[i];
      // wrap each mote around the player so the cloud follows without popping
      let ox = this.base[i * 3] + Math.sin(this.time * 0.21 + s) * 0.7 - (center.x % (2 * r));
      let oz = this.base[i * 3 + 2] + Math.cos(this.time * 0.17 + s * 1.3) * 0.7 - (center.z % (2 * r));
      ox = ((((ox + r) % (2 * r)) + 2 * r) % (2 * r)) - r;
      oz = ((((oz + r) % (2 * r)) + 2 * r) % (2 * r)) - r;
      pos.setXYZ(i, center.x + ox, this.base[i * 3 + 1] + Math.sin(this.time * 0.35 + s * 2.0) * 0.35, center.z + oz);
    }
    pos.needsUpdate = true;
  }
}
