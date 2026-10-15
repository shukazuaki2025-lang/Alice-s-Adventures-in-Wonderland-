import * as THREE from 'three';
import { InventoryItem, globalEventBus } from '../core/types';
import { GAME_EVENTS } from '../core/events';

export class ItemInspector {
  public isOpen: boolean = false;
  public currentItem: InventoryItem | null = null;
  private rotationX: number = 0;
  private rotationY: number = 0;
  private targetRotationX: number = 0;
  private targetRotationY: number = 0;
  private inspectedFront: boolean = false;
  private inspectedBack: boolean = false;
  private onVerifiedCallback?: () => void;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvasContainer: HTMLElement | null = null;
  private itemMesh: THREE.Object3D | null = null;
  private animationFrameId: number = 0;
  private isDragging: boolean = false;
  private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.scene = new THREE.Scene();

    const ambientLight = new THREE.HemisphereLight(0xfff6e5, 0x4a3b5c, 1.15);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xfff0d4, 1.25);
    dirLight.position.set(4, 6, 5);
    this.scene.add(dirLight);
    const rimLight = new THREE.DirectionalLight(0x9ec5ff, 0.65);
    rimLight.position.set(-4, -2, -4);
    this.scene.add(rimLight);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.z = 1.85;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    this.setupUIListeners();
  }

  private setupUIListeners(): void {
    globalEventBus.on(GAME_EVENTS.INSPECT_ITEM, (data: any) => {
      const item: InventoryItem = data?.item || data;
      if (item && item.id) {
        this.open(item, data?.onVerified);
      }
    });

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });
    
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isOpen || !this.isDragging) return;
      const deltaX = e.offsetX - this.previousMousePosition.x;
      const deltaY = e.offsetY - this.previousMousePosition.y;
      this.rotate(deltaX * 0.01, deltaY * 0.01);
      this.previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });
  }

  public open(item: InventoryItem, onVerified?: () => void): void {
    this.isOpen = true;
    this.currentItem = item;
    this.rotationX = 0;
    this.rotationY = 0;
    this.targetRotationX = 0;
    this.targetRotationY = 0;
    this.inspectedFront = Boolean(item.inspectedFront);
    this.inspectedBack = Boolean(item.inspectedBack);
    this.onVerifiedCallback = onVerified;

    this.canvasContainer = document.getElementById('ui-inspector');
    if (this.canvasContainer) {
      this.canvasContainer.innerHTML = ''; // clear emoji mock
      const width = this.canvasContainer.clientWidth || 320;
      const height = this.canvasContainer.clientHeight || 240;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.canvasContainer.appendChild(this.renderer.domElement);
    }

    this.buildItemMesh(item.id);
    this.checkInspectedSides();

    console.log(`[ItemInspector] Inspecting item: ${item.name}`);
    this.renderLoop();
  }

  private makePaintedLabelTexture(front: boolean): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 352;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.fillText !== 'function') return null;

    ctx.fillStyle = front ? '#f6eedc' : '#ebe0c9';
    ctx.fillRect(0, 0, 256, 352);

    // Engraved double border
    ctx.strokeStyle = '#3a2618';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 228, 324);
    ctx.strokeStyle = '#9c7338';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 208, 304);

    ctx.fillStyle = '#2a1810';
    ctx.textAlign = 'center';
    if (front) {
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText('DRINK', 128, 145);
      ctx.fillText('ME', 128, 195);
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillStyle = '#7a3b2e';
      ctx.fillText('~ Very Nicely Printed ~', 128, 250);
    } else {
      ctx.font = 'italic 20px Georgia, serif';
      ctx.fillStyle = '#4a3828';
      ctx.fillText('Not marked', 128, 155);
      ctx.font = 'bold 22px Georgia, serif';
      ctx.fillStyle = '#5c4632';
      ctx.fillText('“POISON”', 128, 195);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private buildItemMesh(itemId: string): void {
    if (this.itemMesh) {
      this.scene.remove(this.itemMesh);
      this.itemMesh = null;
    }
    const group = new THREE.Group();
    if (itemId === 'prop_bottle_drinkme' || itemId === 'drink_me_bottle') {
      // Sculpted 12-flute Victorian apothecary phial
      const bodyGeo = new THREE.CylinderGeometry(0.21, 0.25, 0.62, 36, 12);
      const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ang = Math.atan2(z, x);
        const flute = 1.0 + 0.035 * Math.cos(ang * 12);
        const belly = 1.0 + 0.06 * Math.sin(((y + 0.31) / 0.62) * Math.PI);
        pos.setXYZ(i, x * flute * belly, y, z * flute * belly);
      }
      bodyGeo.computeVertexNormals();

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x6ec4d8,
        transparent: true,
        opacity: 0.78,
        roughness: 0.16,
        metalness: 0.1,
      });
      const bottle = new THREE.Mesh(bodyGeo, glassMat);

      // Glowing amber-rose cordial liquid inside the bottle
      const liqGeo = new THREE.CylinderGeometry(0.18, 0.21, 0.38, 28);
      const liqMat = new THREE.MeshStandardMaterial({
        color: 0xd97548,
        roughness: 0.25,
        metalness: 0.05,
      });
      const liquid = new THREE.Mesh(liqGeo, liqMat);
      liquid.position.set(0, -0.09, 0);

      // Tapered shoulder, neck, and lip flange
      const neckGeo = new THREE.CylinderGeometry(0.085, 0.135, 0.24, 24);
      const neck = new THREE.Mesh(neckGeo, glassMat);
      neck.position.set(0, 0.42, 0);

      const lipGeo = new THREE.TorusGeometry(0.095, 0.022, 12, 24);
      const lip = new THREE.Mesh(lipGeo, glassMat);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(0, 0.53, 0);

      // Cork + crimson wax seal + twine collar
      const corkGeo = new THREE.CylinderGeometry(0.095, 0.075, 0.15, 20);
      const corkMat = new THREE.MeshStandardMaterial({ color: 0xa87948, roughness: 0.82 });
      const cork = new THREE.Mesh(corkGeo, corkMat);
      cork.position.set(0, 0.58, 0);

      const waxGeo = new THREE.CylinderGeometry(0.102, 0.098, 0.04, 20);
      const waxMat = new THREE.MeshStandardMaterial({ color: 0x9e2424, roughness: 0.42 });
      const wax = new THREE.Mesh(waxGeo, waxMat);
      wax.position.set(0, 0.65, 0);

      const twineGeo = new THREE.TorusGeometry(0.105, 0.012, 10, 24);
      const twineMat = new THREE.MeshStandardMaterial({ color: 0xc8a46e, roughness: 0.85 });
      const twine = new THREE.Mesh(twineGeo, twineMat);
      twine.rotation.x = Math.PI / 2;
      twine.position.set(0, 0.46, 0);

      const labelGeo = new THREE.PlaneGeometry(0.27, 0.37, 8, 8);
      const frontTex = this.makePaintedLabelTexture(true);
      const backTex = this.makePaintedLabelTexture(false);
      const frontMat = new THREE.MeshBasicMaterial({
        color: 0xf7f3ea,
        map: frontTex ?? null,
      });
      const frontLabel = new THREE.Mesh(labelGeo, frontMat);
      frontLabel.position.set(0, 0.02, 0.265);

      const backMat = new THREE.MeshBasicMaterial({
        color: 0xe8dfce,
        map: backTex ?? null,
      });
      const backLabel = new THREE.Mesh(labelGeo, backMat);
      backLabel.position.set(0, 0.02, -0.265);
      backLabel.rotation.y = Math.PI;

      group.add(bottle, liquid, neck, lip, cork, wax, twine, frontLabel, backLabel);
    } else if (itemId === 'gold_key' || itemId === 'prop_key_gold') {
      // Sculpted Victorian filigree gold key
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xe2b842,
        metalness: 0.65,
        roughness: 0.28,
      });
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 16, 32), goldMat);
      bow.position.set(0, 0.28, 0);
      const innerLobeL = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 12, 24), goldMat);
      innerLobeL.position.set(-0.055, 0.28, 0);
      const innerLobeR = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 12, 24), goldMat);
      innerLobeR.position.set(0.055, 0.28, 0);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.06, 20), goldMat);
      collar.position.set(0, 0.1, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.026, 0.56, 20), goldMat);
      shaft.position.set(0, -0.16, 0);
      const bit1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.026), goldMat);
      bit1.position.set(0.07, -0.32, 0);
      const bit2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.038, 0.026), goldMat);
      bit2.position.set(0.055, -0.39, 0);
      group.add(bow, innerLobeL, innerLobeR, collar, shaft, bit1, bit2);
    } else {
      // Ornate Victorian currant cake & brass curiosity fallback
      const cakeMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.72 });
      const icingMat = new THREE.MeshStandardMaterial({ color: 0xfbf4e6, roughness: 0.42 });
      const currantMat = new THREE.MeshStandardMaterial({ color: 0x2e1824, roughness: 0.35 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.24, 32), cakeMat);
      const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.32, 0.08, 32), icingMat);
      icing.position.y = 0.11;
      group.add(base, icing);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const currant = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), currantMat);
        currant.position.set(Math.cos(a) * 0.22, 0.16, Math.sin(a) * 0.22);
        group.add(currant);
      }
    }
    this.itemMesh = group;
    this.scene.add(this.itemMesh);
  }

  public rotateTo(yaw: number, pitch: number): void {
    this.targetRotationY = yaw;
    this.targetRotationX = pitch;
    this.rotationY = yaw;
    this.rotationX = pitch;
    if (this.itemMesh) {
      this.itemMesh.rotation.set(this.rotationX, this.rotationY, 0, 'YXZ');
      this.checkInspectedSides();
    }
  }

  public inspectSide(side: 'front' | 'back'): void {
    if (side === 'front') {
      this.rotateTo(0, 0);
    } else {
      this.rotateTo(Math.PI, 0);
    }
  }

  public rotate(deltaX: number, deltaY: number): void {
    if (!this.isOpen || !this.currentItem) return;
    this.targetRotationY += deltaX;
    this.targetRotationX += deltaY;
    
    // limit pitch to avoid flipping
    this.targetRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.targetRotationX));
  }

  private checkInspectedSides(): void {
    if (!this.itemMesh) return;
    
    // Get forward vector of camera (-Z in local space)
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    
    // Get front (+Z) and back (-Z) of the item mesh in world space
    const itemFront = new THREE.Vector3(0, 0, 1).applyQuaternion(this.itemMesh.quaternion).normalize();
    const itemBack = new THREE.Vector3(0, 0, -1).applyQuaternion(this.itemMesh.quaternion).normalize();
    
    const dotFront = itemFront.dot(cameraForward);
    const dotBack = itemBack.dot(cameraForward);

    if (dotFront <= -0.866 && !this.inspectedFront) {
      this.inspectedFront = true;
      if (this.currentItem) this.currentItem.inspectedFront = true;
      globalEventBus.emit('bottleSideInspected', 'front');
    }
    
    if (dotBack <= -0.866 && !this.inspectedBack) {
      this.inspectedBack = true;
      if (this.currentItem) this.currentItem.inspectedBack = true;
      globalEventBus.emit('bottleSideInspected', 'back');
    }

    if (this.inspectedFront && this.inspectedBack) {
      if (this.currentItem) {
        globalEventBus.emit('itemFullyInspected', this.currentItem);
      }
      if (this.onVerifiedCallback) {
        this.onVerifiedCallback();
        this.onVerifiedCallback = undefined; // trigger once
      }
    }
  }

  private renderLoop = (): void => {
    if (!this.isOpen) return;

    // smooth damp
    this.rotationX += (this.targetRotationX - this.rotationX) * 0.1;
    this.rotationY += (this.targetRotationY - this.rotationY) * 0.1;

    if (this.itemMesh) {
      this.itemMesh.rotation.set(this.rotationX, this.rotationY, 0, 'YXZ');
      this.checkInspectedSides();
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  public close(): void {
    this.isOpen = false;
    this.currentItem = null;
    cancelAnimationFrame(this.animationFrameId);
    if (this.canvasContainer && this.renderer.domElement.parentElement) {
      this.canvasContainer.removeChild(this.renderer.domElement);
    }
  }
}
