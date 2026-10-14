import * as THREE from 'three';
import { createToonMaterial } from '../../shaders/ToonShaders';
import { ALICE_SCALES } from '../../core/constants';

export class AliceEntity {
  public mesh: THREE.Group = new THREE.Group();
  public scale: number = ALICE_SCALES.NORMAL;

  constructor() {
    this.buildAliceMesh();
  }

  private buildAliceMesh(): void {
    // Stylized Victorian 3D Character Mesh for Alice
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.6, 16);
    const dressMat = createToonMaterial(0x4a7c59); // Victorian blue-green dress
    const bodyMesh = new THREE.Mesh(bodyGeo, dressMat);
    bodyMesh.position.y = 0.5;
    this.mesh.add(bodyMesh);

    const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const skinMat = createToonMaterial(0xfbe3d6);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 0.95;
    this.mesh.add(headMesh);

    // Hair
    const hairGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const hairMat = createToonMaterial(0xe8c15a); // Blonde hair
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 0.97, -0.02);
    this.mesh.add(hairMesh);

    // Apron
    const apronGeo = new THREE.PlaneGeometry(0.2, 0.35);
    const apronMat = createToonMaterial(0xf7f3ea); // White apron
    const apronMesh = new THREE.Mesh(apronGeo, apronMat);
    apronMesh.position.set(0, 0.45, 0.16);
    this.mesh.add(apronMesh);
  }

  public setScale(scale: number): void {
    this.scale = scale;
    this.mesh.scale.set(scale, scale, scale);
  }

  public setPosition(pos: THREE.Vector3): void {
    this.mesh.position.copy(pos);
  }
}
