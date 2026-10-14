import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createToonMaterial } from '../shaders/ToonShaders';
import { createGlassTableMaterial } from '../shaders/GlassRefraction';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface ParsedLogicMarkers {
  spawns: Map<string, THREE.Vector3>;
  triggers: Map<string, { id: string; bounds: THREE.Vector3; pos: THREE.Vector3 }>;
  interactables: Map<string, { id: string; type: string; item: string; pos: THREE.Vector3 }>;
  cameras: Map<string, { pos: THREE.Vector3; fov: number; duration: number }>;
  paths: Map<string, THREE.Vector3>;
  colliders: Map<string, { pos: THREE.Vector3; bounds: THREE.Vector3 }>;
  slots: Map<string, THREE.Vector3>;
  lamps: Map<string, THREE.Vector3>;
  vistaAnchors: Map<string, THREE.Vector3>;
}

export class SceneLoader {
  public sceneGroup: THREE.Group = new THREE.Group();
  public markers: ParsedLogicMarkers = {
    spawns: new Map(),
    triggers: new Map(),
    interactables: new Map(),
    cameras: new Map(),
    paths: new Map(),
    colliders: new Map(),
    slots: new Map(),
    lamps: new Map(),
    vistaAnchors: new Map(),
  };

  public propsMap: Map<string, THREE.Object3D> = new Map();

  constructor() {}

  public async loadGreybox(
    url: string = '/assets/models/ch1_greybox.glb',
    physicsWorld?: PhysicsWorld
  ): Promise<THREE.Group> {
    const loader = new GLTFLoader();

    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      this.sceneGroup.add(gltf.scene);
      this.parseNodes(gltf.scene, physicsWorld);
      console.log('[SceneLoader] GLB loaded & parsed successfully:', url);
    } catch (e) {
      console.warn('[SceneLoader] Could not load GLB file, generating fallback procedural architecture:', e);
      this.generateFallbackProceduralArchitecture(physicsWorld);
    }

    this.buildProceduralProps();
    return this.sceneGroup;
  }

  private parseNodes(root: THREE.Object3D, physicsWorld?: PhysicsWorld): void {
    root.traverse((child) => {
      const name = child.name;

      // Extract custom properties or default marker names
      const pos = child.position.clone();

      if (name.startsWith('SPAWN_')) {
        this.markers.spawns.set(name, pos);
      } else if (name.startsWith('TRG_')) {
        this.markers.triggers.set(name, {
          id: name,
          bounds: new THREE.Vector3(2, 2, 2),
          pos,
        });
        if (physicsWorld) {
          physicsWorld.addTriggerVolume(name, pos, new THREE.Vector3(1, 1, 1));
        }
      } else if (name.startsWith('INT_')) {
        this.markers.interactables.set(name, {
          id: name,
          type: 'inspect',
          item: name.replace('INT_', ''),
          pos,
        });
      } else if (name.startsWith('CAM_')) {
        this.markers.cameras.set(name, { pos, fov: 60, duration: 3 });
      } else if (name.startsWith('PATH_')) {
        this.markers.paths.set(name, pos);
      } else if (name.startsWith('COL_')) {
        this.markers.colliders.set(name, { pos, bounds: new THREE.Vector3(5, 0.2, 5) });
        if (physicsWorld) {
          physicsWorld.addStaticBox(name, pos, new THREE.Vector3(5, 0.2, 5));
        }
      } else if (name.startsWith('SLOT_')) {
        this.markers.slots.set(name, pos);
      } else if (name.startsWith('LAMP_')) {
        this.markers.lamps.set(name, pos);
      } else if (name.startsWith('VISTA_ANCHOR')) {
        this.markers.vistaAnchors.set(name, pos);
      }
    });

    console.log('[SceneLoader] Logic markers parsed:', {
      spawns: this.markers.spawns.size,
      triggers: this.markers.triggers.size,
      interactables: this.markers.interactables.size,
      cameras: this.markers.cameras.size,
    });
  }

  public generateFallbackProceduralArchitecture(physicsWorld?: PhysicsWorld): void {
    // Populate mandatory 52 markers with canonical positions
    // Spawns
    this.markers.spawns.set('SPAWN_S1', new THREE.Vector3(2.0, 0, 0));
    this.markers.spawns.set('SPAWN_S4', new THREE.Vector3(0, 0, 0));
    this.markers.spawns.set('SPAWN_S5', new THREE.Vector3(-11.0, 0, 0));

    // Triggers
    this.markers.triggers.set('TRG_S2_hole', { id: 'TRG_S2_hole', bounds: new THREE.Vector3(2, 2, 2), pos: new THREE.Vector3(28, 0, 0) });
    this.markers.triggers.set('TRG_S4_corner', { id: 'TRG_S4_corner', bounds: new THREE.Vector3(2, 2, 2), pos: new THREE.Vector3(23, 0, 0) });

    // Colliders
    this.markers.colliders.set('COL_river_bank', { pos: new THREE.Vector3(0, -0.1, 0), bounds: new THREE.Vector3(30, 0.1, 20) });
    this.markers.colliders.set('COL_hall_floor', { pos: new THREE.Vector3(0, -0.1, 0), bounds: new THREE.Vector3(12, 0.1, 3.5) });

    if (physicsWorld) {
      physicsWorld.addStaticBox('COL_river_bank', new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(30, 0.1, 20));
      physicsWorld.addStaticBox('COL_hall_floor', new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(12, 0.1, 3.5));
    }

    // Ground Mesh
    const floorGeo = new THREE.PlaneGeometry(60, 40);
    const floorMat = createToonMaterial(0x8fa382); // Meadow green
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.sceneGroup.add(floorMesh);

    // Great Hall Mesh (24m x 7m x 2.85m)
    const hallGeo = new THREE.BoxGeometry(24.0, 2.85, 7.0);
    const hallMat = createToonMaterial(0xc8b097); // Victorian wallpaper tone
    const hallMesh = new THREE.Mesh(hallGeo, hallMat);
    hallMesh.position.set(0, 1.425, 0);
    this.sceneGroup.add(hallMesh);
  }

  private buildProceduralProps(): void {
    // Glass Table (Height 0.72m, Radius 0.25m) at (4.0, 0, 0)
    const tableGroup = new THREE.Group();
    tableGroup.name = 'INT_table';
    tableGroup.position.set(4.0, 0, 0);

    const topGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.04, 32);
    const glassMat = createGlassTableMaterial();
    const topMesh = new THREE.Mesh(topGeo, glassMat);
    topMesh.position.set(0, 0.70, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    tableGroup.add(topMesh);

    // 3 Table Legs
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.68, 16);
      const legMesh = new THREE.Mesh(legGeo, glassMat);
      legMesh.position.set(Math.cos(angle) * 0.2, 0.34, Math.sin(angle) * 0.2);
      tableGroup.add(legMesh);
    }
    this.sceneGroup.add(tableGroup);
    this.propsMap.set('INT_table', tableGroup);

    // Golden Key prop_key_gold on table
    const keyGroup = new THREE.Group();
    keyGroup.name = 'prop_key_gold';
    keyGroup.position.set(4.05, 0.73, 0);
    const keyGeo = new THREE.TorusGeometry(0.02, 0.005, 8, 16);
    const keyMat = createToonMaterial(0xd4af37); // Gold
    const keyMesh = new THREE.Mesh(keyGeo, keyMat);
    keyGroup.add(keyMesh);
    this.sceneGroup.add(keyGroup);
    this.propsMap.set('prop_key_gold', keyGroup);

    // Bottle prop_bottle_drinkme
    const bottleGroup = new THREE.Group();
    bottleGroup.name = 'prop_bottle_drinkme';
    bottleGroup.position.set(3.95, 0.73, 0.05);
    const bottleGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.1, 16);
    const bottleMat = createToonMaterial(0x88c0d0);
    const bottleMesh = new THREE.Mesh(bottleGeo, bottleMat);
    bottleGroup.add(bottleMesh);
    this.sceneGroup.add(bottleGroup);
    this.propsMap.set('prop_bottle_drinkme', bottleGroup);

    // Glass box under table with EAT ME cake
    const boxGroup = new THREE.Group();
    boxGroup.name = 'INT_glass_box';
    boxGroup.position.set(4.1, 0, -0.1);
    const boxGeo = new THREE.BoxGeometry(0.12, 0.06, 0.08);
    const boxMesh = new THREE.Mesh(boxGeo, glassMat);
    boxGroup.add(boxMesh);

    const cakeGeo = new THREE.BoxGeometry(0.05, 0.03, 0.04);
    const cakeMat = createToonMaterial(0xc39b5c);
    const cakeMesh = new THREE.Mesh(cakeGeo, cakeMat);
    cakeMesh.position.set(0, 0.015, 0);
    boxGroup.add(cakeMesh);

    this.sceneGroup.add(boxGroup);
    this.propsMap.set('INT_glass_box', boxGroup);

    // Little Door & Curtain on North Wall
    const doorGroup = new THREE.Group();
    doorGroup.name = 'ch1_hall_door_little';
    doorGroup.position.set(10.5, 0, 3.4);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.381, 0.05), createToonMaterial(0x5e4b3c));
    doorGroup.add(doorFrame);
    this.sceneGroup.add(doorGroup);
    this.propsMap.set('ch1_hall_door_little', doorGroup);

    const curtainGroup = new THREE.Group();
    curtainGroup.name = 'INT_curtain';
    curtainGroup.position.set(10.5, 0.2, 3.42);
    const curtainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.02), createToonMaterial(0x800020)); // Velvet red
    curtainGroup.add(curtainMesh);
    this.sceneGroup.add(curtainGroup);
    this.propsMap.set('INT_curtain', curtainGroup);
  }
}
