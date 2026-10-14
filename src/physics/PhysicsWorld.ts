import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsWorld {
  public world: RAPIER.World | null = null;
  private isInitialized = false;
  private rigidBodies: Map<string, RAPIER.RigidBody> = new Map();
  private staticBounds: Map<string, THREE.Box3> = new Map();
  private triggers: Map<string, { bounds: THREE.Box3; callback?: () => void }> = new Map();

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
    console.log('[PhysicsWorld] Rapier3D physics world initialized successfully');
  }

  public step(deltaTime: number = 1 / 60): void {
    if (this.world) {
      this.world.timestep = deltaTime;
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
    
    const min = new THREE.Vector3().subVectors(center, halfExtents);
    const max = new THREE.Vector3().addVectors(center, halfExtents);
    this.staticBounds.set(id, new THREE.Box3(min, max));
    return body;
  }

  public addTriggerVolume(
    id: string,
    center: THREE.Vector3,
    halfExtents: THREE.Vector3,
    onEnter?: () => void
  ): void {
    const min = new THREE.Vector3().subVectors(center, halfExtents);
    const max = new THREE.Vector3().addVectors(center, halfExtents);
    const bounds = new THREE.Box3(min, max);
    this.triggers.set(id, { bounds, callback: onEnter });
  }

  public checkTriggers(pos: THREE.Vector3, radius: number, height: number): void {
    const p1 = new THREE.Vector3(pos.x, pos.y + radius, pos.z);
    const p2 = new THREE.Vector3(pos.x, pos.y + height - radius, pos.z);

    this.triggers.forEach((trigger) => {
      if (this.capsuleIntersectsAABB(p1, p2, radius, trigger.bounds)) {
        if (trigger.callback) {
          trigger.callback();
        }
      }
    });
  }

  private capsuleIntersectsAABB(p1: THREE.Vector3, p2: THREE.Vector3, radius: number, aabb: THREE.Box3): boolean {
    const closestP1 = new THREE.Vector3().copy(p1).clamp(aabb.min, aabb.max);
    const closestP2 = new THREE.Vector3().copy(p2).clamp(aabb.min, aabb.max);

    const d1 = p1.distanceToSquared(closestP1);
    const d2 = p2.distanceToSquared(closestP2);

    if (d1 <= radius * radius || d2 <= radius * radius) return true;
    
    const center = new THREE.Vector3().addVectors(aabb.min, aabb.max).multiplyScalar(0.5);
    const halfExtents = new THREE.Vector3().subVectors(aabb.max, aabb.min).multiplyScalar(0.5).addScalar(radius);
    const expandedBounds = new THREE.Box3(
        new THREE.Vector3().subVectors(center, halfExtents),
        new THREE.Vector3().addVectors(center, halfExtents)
    );
    
    return expandedBounds.containsPoint(p1) || expandedBounds.containsPoint(p2);
  }

  public resolveMovement(currentPos: THREE.Vector3, desiredDelta: THREE.Vector3, radius: number, height: number): THREE.Vector3 {
    const result = desiredDelta.clone();
    
    const steps = 3;
    const stepDelta = result.clone().divideScalar(steps);
    
    const simPos = currentPos.clone();
    
    for (let s = 0; s < steps; s++) {
      simPos.add(stepDelta);
      
      const expandedRadius = radius * 1.1; // small margin
      
      // We'll treat the capsule as a cylinder roughly for horizontal collisions
      const miny = simPos.y;
      const maxy = simPos.y + height;
      
      this.staticBounds.forEach((bound) => {
        // Broad phase vertical check
        if (maxy < bound.min.y || miny > bound.max.y) return;
        
        // Expanded bound for XZ
        const minx = bound.min.x - expandedRadius;
        const maxx = bound.max.x + expandedRadius;
        const minz = bound.min.z - expandedRadius;
        const maxz = bound.max.z + expandedRadius;
        
        if (simPos.x > minx && simPos.x < maxx && simPos.z > minz && simPos.z < maxz) {
          // Collision occurred. Resolve by pushing out of the nearest edge
          const dx1 = simPos.x - minx;
          const dx2 = maxx - simPos.x;
          const dz1 = simPos.z - minz;
          const dz2 = maxz - simPos.z;
          
          const mind = Math.min(dx1, dx2, dz1, dz2);
          if (mind === dx1) simPos.x = minx;
          else if (mind === dx2) simPos.x = maxx;
          else if (mind === dz1) simPos.z = minz;
          else if (mind === dz2) simPos.z = maxz;
        }
      });
    }
    
    return simPos.sub(currentPos);
  }

  public sweepSphere(origin: THREE.Vector3, dir: THREE.Vector3, radius: number, maxDist: number): number {
    let hitDist = maxDist;
    const ray = new THREE.Ray(origin, dir);
    
    this.staticBounds.forEach((bound) => {
      // Expand bound by radius for sphere sweep
      const expanded = new THREE.Box3(
        new THREE.Vector3(bound.min.x - radius, bound.min.y - radius, bound.min.z - radius),
        new THREE.Vector3(bound.max.x + radius, bound.max.y + radius, bound.max.z + radius)
      );
      const target = new THREE.Vector3();
      if (ray.intersectBox(expanded, target)) {
        const d = origin.distanceTo(target);
        if (d < hitDist) {
          hitDist = d;
        }
      } else if (expanded.containsPoint(origin)) {
        hitDist = 0;
      }
    });
    
    return hitDist;
  }

  public clear(): void {
    if (!this.world) return;
    this.rigidBodies.forEach((body) => this.world?.removeRigidBody(body));
    this.rigidBodies.clear();
    this.staticBounds.clear();
    this.triggers.clear();
  }
}
