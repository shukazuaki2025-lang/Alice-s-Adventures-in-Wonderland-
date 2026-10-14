import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { convertMaterialsToToon } from '../../shaders/ToonShaders';
import { applyInkOutline } from '../../shaders/InkOutline';

export class RabbitEntity {
  public mesh: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private waypoints: THREE.Vector3[] = [];
  private currentWaypointIndex: number = 0;
  private speed: number = 2.0;

  constructor() {
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load('/assets/models/chr_rabbit.glb', (gltf) => {
      const model = gltf.scene;
      convertMaterialsToToon(model);
      applyInkOutline(model);
      this.mesh.add(model);
      
      this.mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        this.actions.set(clip.name, this.mixer!.clipAction(clip));
      });
      
      this.playAnimation('Rabbit_Scurry');
    });
  }

  public playAnimation(name: string): void {
    const action = this.actions.get(name);
    if (action) {
      this.mixer?.stopAllAction();
      action.play();
    }
  }

  public setWaypoints(points: THREE.Vector3[]): void {
    this.waypoints = points;
    this.currentWaypointIndex = 0;
    if (this.waypoints.length > 0) {
      this.playAnimation('Rabbit_Scurry');
    }
  }

  public scurryTowardExit(): void {
    this.setWaypoints([new THREE.Vector3(29.5, 0, -6.0)]);
  }

  public update(dt: number): void {
    if (this.mixer) {
      this.mixer.update(dt);
    }

    if (this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length) {
      const target = this.waypoints[this.currentWaypointIndex];
      const distance = this.mesh.position.distanceTo(target);
      
      if (distance < 0.1) {
        this.currentWaypointIndex++;
        if (this.currentWaypointIndex >= this.waypoints.length) {
          this.playAnimation('Rabbit_LookBack');
        }
      } else {
        const direction = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
        
        // Face target
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = targetRotation;
      }
    }
  }
}
