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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.z = 2;

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

  private buildItemMesh(itemId: string): void {
    if (this.itemMesh) {
      this.scene.remove(this.itemMesh);
      this.itemMesh = null;
    }
    const group = new THREE.Group();
    if (itemId === 'prop_bottle_drinkme' || itemId === 'drink_me_bottle') {
      const geo = new THREE.CylinderGeometry(0.2, 0.24, 0.65, 24);
      const mat = new THREE.MeshStandardMaterial({ color: 0x64b5c6, transparent: true, opacity: 0.78, roughness: 0.2 });
      const bottle = new THREE.Mesh(geo, mat);
      
      const neckGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.22, 16);
      const neck = new THREE.Mesh(neckGeo, mat);
      neck.position.set(0, 0.42, 0);

      const corkGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.14, 14);
      const corkMat = new THREE.MeshStandardMaterial({ color: 0xa87948, roughness: 0.8 });
      const cork = new THREE.Mesh(corkGeo, corkMat);
      cork.position.set(0, 0.56, 0);

      const labelGeo = new THREE.PlaneGeometry(0.26, 0.36);
      const frontMat = new THREE.MeshBasicMaterial({ color: 0xf7f3ea }); // "DRINK ME"
      const frontLabel = new THREE.Mesh(labelGeo, frontMat);
      frontLabel.position.set(0, 0, 0.245);
      
      const backMat = new THREE.MeshBasicMaterial({ color: 0xe8dfce }); // blank back (no poison)
      const backLabel = new THREE.Mesh(labelGeo, backMat);
      backLabel.position.set(0, 0, -0.245);
      backLabel.rotation.y = Math.PI;

      group.add(bottle, neck, cork, frontLabel, backLabel);
    } else {
      const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 });
      group.add(new THREE.Mesh(geo, mat));
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
