import * as THREE from 'three';
import { createToonMaterial } from '../../shaders/ToonShaders';

export class RabbitEntity {
  public mesh: THREE.Group = new THREE.Group();

  constructor() {
    this.buildRabbitMesh();
  }

  private buildRabbitMesh(): void {
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.45, 16);
    const coatMat = createToonMaterial(0x800020); // Red waistcoat
    const bodyMesh = new THREE.Mesh(bodyGeo, coatMat);
    bodyMesh.position.y = 0.3;
    this.mesh.add(bodyMesh);

    const headGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const furMat = createToonMaterial(0xffffff); // White fur
    const headMesh = new THREE.Mesh(headGeo, furMat);
    headMesh.position.y = 0.6;
    this.mesh.add(headMesh);

    // Rabbit Ears
    const earGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.25, 8);
    const ear1 = new THREE.Mesh(earGeo, furMat);
    ear1.position.set(-0.04, 0.75, 0);
    ear1.rotation.z = -0.15;
    const ear2 = new THREE.Mesh(earGeo, furMat);
    ear2.position.set(0.04, 0.75, 0);
    ear2.rotation.z = 0.15;
    this.mesh.add(ear1);
    this.mesh.add(ear2);

    // Gold Pocket Watch
    const watchGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16);
    const watchMat = createToonMaterial(0xd4af37);
    const watchMesh = new THREE.Mesh(watchGeo, watchMat);
    watchMesh.position.set(0.08, 0.35, 0.12);
    watchMesh.rotation.x = Math.PI / 2;
    this.mesh.add(watchMesh);
  }
}
