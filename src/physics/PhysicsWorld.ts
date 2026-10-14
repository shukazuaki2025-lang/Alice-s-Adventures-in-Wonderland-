import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsWorld {
  public world: RAPIER.World | null = null;
  private isInitialized = false;
  private rigidBodies: Map<string, RAPIER.RigidBody> = new Map();
  private triggers: Map<string, { body: RAPIER.RigidBody; bounds: THREE.Box3; callback?: () => void }> = new Map();

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
    console.log('[PhysicsWorld] Rapier3D physics world initialized successfully');
  }

  public step(_deltaTime: number = 1 / 60): void {
    if (this.world) {
      this.world.step();
    }
  }

  public addStaticBox(id: string, center: THREE.Vector3, halfExtents: THREE.Vector3): RAPIER.RigidBody | null {
    if (!this.world) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    this.world.createCollider(colliderDesc, body);
    this.rigidBodies.set(id, body);
    return body;
  }

  public addTriggerVolume(
    id: string,
    center: THREE.Vector3,
    halfExtents: THREE.Vector3,
    onEnter?: () => void
  ): RAPIER.RigidBody | null {
    if (!this.world) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      center.x,
      center.y,
      center.z
    );
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setSensor(
      true
    );
    this.world.createCollider(colliderDesc, body);

    const min = new THREE.Vector3().subVectors(center, halfExtents);
    const max = new THREE.Vector3().addVectors(center, halfExtents);
    const bounds = new THREE.Box3(min, max);

    this.triggers.set(id, { body, bounds, callback: onEnter });
    return body;
  }

  public checkTriggers(playerPosition: THREE.Vector3): void {
    this.triggers.forEach((trigger) => {
      if (trigger.bounds.containsPoint(playerPosition)) {
        if (trigger.callback) {
          trigger.callback();
        }
      }
    });
  }

  public clear(): void {
    if (!this.world) return;
    this.rigidBodies.forEach((body) => this.world?.removeRigidBody(body));
    this.triggers.forEach((t) => this.world?.removeRigidBody(t.body));
    this.rigidBodies.clear();
    this.triggers.clear();
  }
}
