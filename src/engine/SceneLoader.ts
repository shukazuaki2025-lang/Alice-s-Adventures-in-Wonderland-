import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addInkOutline, createToonMaterial } from '../shaders/ToonShaders';
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
  public bankGroup: THREE.Group = new THREE.Group();
  public wellGroup: THREE.Group = new THREE.Group();
  public passageGroup: THREE.Group = new THREE.Group();
  public hallGroup: THREE.Group = new THREE.Group();

  public rabbitMesh: THREE.Group = new THREE.Group();
  public sisterMesh: THREE.Group = new THREE.Group();
  public wellScrollingGroup: THREE.Group = new THREE.Group();

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

  constructor() {
    this.bankGroup.name = 'Scene_S1_Bank';
    this.wellGroup.name = 'Scene_S3_Well';
    this.passageGroup.name = 'Scene_S4_Passage';
    this.hallGroup.name = 'Scene_S5_Hall';

    this.sceneGroup.add(this.bankGroup);
    this.sceneGroup.add(this.wellGroup);
    this.sceneGroup.add(this.passageGroup);
    this.sceneGroup.add(this.hallGroup);
  }

  public async loadGreybox(
    url: string = '/assets/models/ch1_greybox.glb',
    physicsWorld?: PhysicsWorld
  ): Promise<THREE.Group> {
    const loader = new GLTFLoader();

    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      this.parseNodes(gltf.scene, physicsWorld);
      // Keep raw greybox meshes hidden so they don't overlap across states;
      // state-specific Victorian environments are built cleanly into bankGroup/wellGroup/passageGroup/hallGroup
      gltf.scene.visible = false;
      this.sceneGroup.add(gltf.scene);
      console.log('[SceneLoader] GLB loaded & markers parsed successfully:', url);
    } catch (e) {
      console.warn('[SceneLoader] Could not load GLB file, generating fallback markers:', e);
      this.populateFallbackMarkers(physicsWorld);
    }

    this.buildBankEnvironment();
    this.buildWellEnvironment();
    this.buildPassageEnvironment();
    this.buildHallEnvironment();
    this.buildProceduralProps();

    this.setActiveStateScene('S1_BANK');
    return this.sceneGroup;
  }

  public setActiveStateScene(state: string): void {
    const isBank = state === 'S0_TITLE' || state === 'S1_BANK' || state === 'S2_CHASE';
    const isWell = state === 'S3_FALL';
    const isPassage = state === 'S4_PASSAGE';
    const isHall =
      state === 'S5_HALL' || state === 'S6_SMALL' || state === 'S7_CAKE' || state === 'END';

    this.bankGroup.visible = isBank;
    this.wellGroup.visible = isWell;
    this.passageGroup.visible = isPassage;
    this.hallGroup.visible = isHall;
  }

  private parseNodes(root: THREE.Object3D, physicsWorld?: PhysicsWorld): void {
    root.traverse((child) => {
      const name = child.name;
      const pos = child.position.clone();

      if (name.startsWith('COL_') || name.startsWith('TRG_')) {
        child.visible = false;
      }

      if (name.startsWith('SPAWN_')) {
        this.markers.spawns.set(name, pos);
      } else if (name.startsWith('TRG_')) {
        this.markers.triggers.set(name, {
          id: name,
          bounds: new THREE.Vector3(2.5, 2.5, 2.5),
          pos,
        });
        if (physicsWorld) {
          physicsWorld.addTriggerVolume(name, pos, new THREE.Vector3(2.0, 2.0, 2.0));
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

  public populateFallbackMarkers(physicsWorld?: PhysicsWorld): void {
    this.markers.spawns.set('SPAWN_S1', new THREE.Vector3(2.0, 0, 0));
    this.markers.spawns.set('SPAWN_S4', new THREE.Vector3(0, 0, 0));
    this.markers.spawns.set('SPAWN_S5', new THREE.Vector3(-11.0, 0, 0));

    this.markers.triggers.set('TRG_S2_hole', {
      id: 'TRG_S2_hole',
      bounds: new THREE.Vector3(2.5, 2.5, 2.5),
      pos: new THREE.Vector3(14, 0, -4),
    });
    this.markers.triggers.set('TRG_S4_corner', {
      id: 'TRG_S4_corner',
      bounds: new THREE.Vector3(2.5, 2.5, 2.5),
      pos: new THREE.Vector3(18, 0, 0),
    });

    this.markers.colliders.set('COL_river_bank', {
      pos: new THREE.Vector3(0, -0.1, 0),
      bounds: new THREE.Vector3(30, 0.1, 20),
    });
    this.markers.colliders.set('COL_hall_floor', {
      pos: new THREE.Vector3(0, -0.1, 0),
      bounds: new THREE.Vector3(12, 0.1, 3.5),
    });

    if (physicsWorld) {
      physicsWorld.addStaticBox('COL_river_bank', new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(30, 0.1, 20));
      physicsWorld.addStaticBox('COL_hall_floor', new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(12, 0.1, 3.5));
    }
  }

  private buildBankEnvironment(): void {
    // Sunny Riverbank Meadow (S0 - S2)
    const groundGeo = new THREE.PlaneGeometry(80, 60);
    const groundMat = createToonMaterial(0x88b378, { side: THREE.DoubleSide });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.bankGroup.add(groundMesh);

    // Gently winding River stream along Z = -10..12
    const riverGeo = new THREE.PlaneGeometry(80, 7);
    const riverMat = createToonMaterial(0x6ba4b8, {
      side: THREE.DoubleSide,
      emissive: 0x3b6e82,
      emissiveIntensity: 0.25,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(0, 0.02, -9.5);
    this.bankGroup.add(riverMesh);

    // Ancient Oak Tree at (-1.5, 0, -2.0)
    const oakGroup = new THREE.Group();
    oakGroup.position.set(-1.5, 0, -2.0);
    const trunkMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.85, 3.6, 12),
      createToonMaterial(0x6e4f3a)
    );
    trunkMesh.position.y = 1.8;
    addInkOutline(trunkMesh);
    oakGroup.add(trunkMesh);

    const canopyPositions = [
      [0, 4.2, 0, 2.4],
      [-1.4, 3.7, 0.6, 1.8],
      [1.5, 3.8, -0.4, 1.9],
      [0.3, 4.9, -0.8, 1.7],
    ];
    canopyPositions.forEach(([cx, cy, cz, r]) => {
      const leafMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r, 1),
        createToonMaterial(0x5b8c4a)
      );
      leafMesh.position.set(cx, cy, cz);
      addInkOutline(leafMesh);
      oakGroup.add(leafMesh);
    });
    this.bankGroup.add(oakGroup);

    // Alice's Sister sitting by the oak tree reading a book at (-0.2, 0, -1.2)
    this.sisterMesh = new THREE.Group();
    this.sisterMesh.name = 'chr_sister';
    this.sisterMesh.position.set(-0.2, 0, -1.2);
    const sisterSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.34, 0.65, 12),
      createToonMaterial(0x7c5268)
    );
    sisterSkirt.position.y = 0.35;
    const sisterHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 12),
      createToonMaterial(0xfbe3d6)
    );
    sisterHead.position.y = 0.82;
    const sisterBook = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.04, 0.18),
      createToonMaterial(0x8c2d2d)
    );
    sisterBook.position.set(0.18, 0.48, 0.18);
    addInkOutline(sisterBook);
    this.sisterMesh.add(sisterSkirt, sisterHead, sisterBook);
    this.bankGroup.add(this.sisterMesh);
    this.propsMap.set('INT_sister_book', this.sisterMesh);

    // 3 Pickable Meadow Daisies
    const daisyCoords: Array<[string, number, number]> = [
      ['INT_daisy_1', 3.6, -1.2],
      ['INT_daisy_2', 5.2, 1.1],
      ['INT_daisy_3', 7.0, -0.6],
    ];
    daisyCoords.forEach(([id, dx, dz]) => {
      const daisyGroup = new THREE.Group();
      daisyGroup.name = id;
      daisyGroup.position.set(dx, 0, dz);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8),
        createToonMaterial(0x4d7c3f)
      );
      stem.position.y = 0.175;
      const petals = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12),
        createToonMaterial(0xffffff)
      );
      petals.position.y = 0.36;
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 10),
        createToonMaterial(0xe8b838)
      );
      center.position.y = 0.38;
      daisyGroup.add(stem, petals, center);
      this.bankGroup.add(daisyGroup);
      this.propsMap.set(id, daisyGroup);
    });

    // White Rabbit in Red Waistcoat with Pocket Watch
    this.rabbitMesh = new THREE.Group();
    this.rabbitMesh.name = 'chr_rabbit';
    this.rabbitMesh.position.set(8.5, 0, -1.8);
    const rabbitBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.48, 12),
      createToonMaterial(0xb0303c) // Crimson tweed waistcoat
    );
    rabbitBody.position.y = 0.32;
    const rabbitHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 12),
      createToonMaterial(0xfaf6f0)
    );
    rabbitHead.position.y = 0.66;
    const earL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.28, 8),
      createToonMaterial(0xfaf6f0)
    );
    earL.position.set(-0.05, 0.9, 0);
    const earR = earL.clone();
    earR.position.set(0.05, 0.9, 0);
    const watch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12),
      createToonMaterial(0xd4af37)
    );
    watch.rotation.x = Math.PI / 2;
    watch.position.set(0.16, 0.42, 0.12);
    this.rabbitMesh.add(rabbitBody, rabbitHead, earL, earR, watch);
    this.bankGroup.add(this.rabbitMesh);
    this.propsMap.set('chr_rabbit', this.rabbitMesh);

    // Hedgerow & Rabbit-Hole Burrow at (14.0, 0, -2.0)
    const burrowGroup = new THREE.Group();
    burrowGroup.name = 'INT_rabbit_hole';
    burrowGroup.position.set(14.0, 0, -2.0);
    const hedgeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.8, 4.5),
      createToonMaterial(0x3f6a34)
    );
    hedgeMesh.position.set(0.6, 0.9, 0);
    addInkOutline(hedgeMesh);

    const holeArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.16, 10, 20, Math.PI),
      createToonMaterial(0x594130)
    );
    holeArch.rotation.y = -Math.PI / 2;
    holeArch.position.set(-0.62, 0.05, 0);

    const holeDark = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshBasicMaterial({ color: 0x1a1412, side: THREE.DoubleSide })
    );
    holeDark.rotation.y = -Math.PI / 2;
    holeDark.position.set(-0.6, 0.35, 0);

    burrowGroup.add(hedgeMesh, holeArch, holeDark);
    this.bankGroup.add(burrowGroup);
    this.propsMap.set('INT_rabbit_hole', burrowGroup);
  }

  private buildWellEnvironment(): void {
    // Deep Well Shaft (S3_FALL) — radius 4.8m so camera at z=3.2m is inside the well
    const shaftGeo = new THREE.CylinderGeometry(4.8, 4.8, 24, 24, 1, true);
    const shaftMat = createToonMaterial(0x6e5a4f, { side: THREE.DoubleSide });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.set(0, 0, 0);
    this.wellGroup.add(shaftMesh);

    // Scrolling cupboards, bookshelves, maps, and Marmalade Jar along the rear wall of the shaft
    this.wellScrollingGroup = new THREE.Group();
    const rearAngles = [-2.6, -2.1, -1.6, -1.1, -0.6, -2.4, -1.8, -0.8];
    for (let i = 0; i < 8; i++) {
      const angle = rearAngles[i];
      const yOffset = -5.5 + i * 1.8;
      const cupboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.05, 0.35),
        createToonMaterial(i % 2 === 0 ? 0x8c5e3c : 0xa87e58)
      );
      cupboard.position.set(Math.cos(angle) * 2.6, yOffset, Math.sin(angle) * 2.6);
      cupboard.lookAt(0, yOffset, 0);
      addInkOutline(cupboard);
      this.wellScrollingGroup.add(cupboard);
    }

    // Floating ORANGE MARMALADE jar within reach beside Alice
    const jarGroup = new THREE.Group();
    jarGroup.name = 'INT_jar_marmalade';
    jarGroup.position.set(0.75, 0.75, 0.25);
    const jarBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.32, 14),
      createToonMaterial(0xe09540)
    );
    const jarLabel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.145, 0.14, 14),
      createToonMaterial(0xf7f3ea)
    );
    addInkOutline(jarBody);
    jarGroup.add(jarBody, jarLabel);
    this.wellScrollingGroup.add(jarGroup);
    this.propsMap.set('prop_jar_marmalade', jarGroup);
    this.propsMap.set('INT_jar_marmalade', jarGroup);

    // Open cupboard shelf to stow the empty jar
    const returnCupboard = new THREE.Group();
    returnCupboard.name = 'INT_cupboard_return';
    returnCupboard.position.set(-0.75, 0.5, 0.25);
    this.wellScrollingGroup.add(returnCupboard);
    this.propsMap.set('INT_cupboard_return', returnCupboard);

    this.wellGroup.add(this.wellScrollingGroup);
  }

  private buildPassageEnvironment(): void {
    // Low Underground Passage (S4_PASSAGE)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 3.2),
      createToonMaterial(0x6b5848, { side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    this.passageGroup.add(floor);

    const wallL = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.5, 0.2),
      createToonMaterial(0x826d5c, { side: THREE.DoubleSide })
    );
    wallL.position.set(8, 1.25, -1.6);
    const wallR = wallL.clone();
    wallR.position.set(8, 1.25, 1.6);
    this.passageGroup.add(wallL, wallR);

    for (let x = -2; x <= 18; x += 5) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(1.55, 0.12, 8, 16, Math.PI),
        createToonMaterial(0x59493d)
      );
      arch.rotation.y = Math.PI / 2;
      arch.position.set(x, 1.0, 0);
      this.passageGroup.add(arch);
    }

    const exitMarker = new THREE.Group();
    exitMarker.name = 'TRG_S4_exit';
    exitMarker.position.set(18.0, 0, 0);
    this.passageGroup.add(exitMarker);
    this.propsMap.set('TRG_S4_exit', exitMarker);
  }

  private buildHallEnvironment(): void {
    // Great Hall of Doors (24m x 7m x 2.85m)
    const floorGeo = new THREE.PlaneGeometry(24, 7);
    const floorMat = createToonMaterial(0x9e8264, { side: THREE.DoubleSide });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.hallGroup.add(floorMesh);

    // North, South, East, West Interior Walls (open ceiling view for camera comfort)
    const wallMat = createToonMaterial(0xd8c3a5, { side: THREE.DoubleSide });
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(24, 2.85, 0.15), wallMat);
    northWall.position.set(0, 1.425, -3.5);
    addInkOutline(northWall);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(24, 2.85, 0.15), wallMat);
    southWall.position.set(0, 1.425, 3.5);
    addInkOutline(southWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.85, 7), wallMat);
    westWall.position.set(-12, 1.425, 0);
    addInkOutline(westWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.85, 7), wallMat);
    eastWall.position.set(12, 1.425, 0);
    addInkOutline(eastWall);

    this.hallGroup.add(northWall, southWall, westWall, eastWall);

    // Locked Full-Size Doors along North & South walls
    const doorX = [-8, -3, 2, 7];
    doorX.forEach((dx, idx) => {
      [-3.4, 3.4].forEach((dz, sideIdx) => {
        const doorNum = idx * 2 + sideIdx + 1;
        const doorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 2.1, 0.08),
          createToonMaterial(0x5c3c24)
        );
        doorMesh.position.set(dx, 1.05, dz);
        const paddedName = `INT_door_0${doorNum}`;
        doorMesh.name = paddedName;
        addInkOutline(doorMesh);
        this.hallGroup.add(doorMesh);
        this.propsMap.set(paddedName, doorMesh);
        this.propsMap.set(`INT_door_${doorNum}`, doorMesh);
      });
    });

    // 6 Warm Hanging Lamps along the Hall
    [-9, -5, -1, 3, 7, 10.5].forEach((lx) => {
      const lampMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        createToonMaterial(0xffe08a, { emissive: 0xffb84d, emissiveIntensity: 0.75 })
      );
      lampMesh.position.set(lx, 2.65, 0);
      this.hallGroup.add(lampMesh);
    });

    // Sunlit Garden Vista beyond the Little Door at (-0.8, 0, -5.2)
    const vistaGroup = new THREE.Group();
    vistaGroup.name = 'Garden_Vista';
    vistaGroup.position.set(-0.8, 0, -5.2);
    const vistaLawn = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 4),
      createToonMaterial(0x7ac769, { side: THREE.DoubleSide })
    );
    vistaLawn.rotation.x = -Math.PI / 2;
    const fountain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 0.8, 14),
      createToonMaterial(0x9bd4e8)
    );
    fountain.position.set(0, 0.4, 0);
    vistaGroup.add(vistaLawn, fountain);
    this.hallGroup.add(vistaGroup);
  }

  private buildProceduralProps(): void {
    // Glass Table (Height 0.72m, Radius 0.25m) at (0.85, 0, -0.6) right beside Alice in the Hall
    const tableGroup = new THREE.Group();
    tableGroup.name = 'INT_table';
    tableGroup.position.set(0.85, 0, -0.6);

    const topGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 32);
    const glassMat = createGlassTableMaterial();
    const topMesh = new THREE.Mesh(topGeo, glassMat);
    topMesh.position.set(0, 0.70, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    addInkOutline(topMesh);
    tableGroup.add(topMesh);

    // 3 Table Legs
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const legGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.68, 16);
      const legMesh = new THREE.Mesh(legGeo, glassMat);
      legMesh.position.set(Math.cos(angle) * 0.2, 0.34, Math.sin(angle) * 0.2);
      tableGroup.add(legMesh);
    }
    this.hallGroup.add(tableGroup);
    this.propsMap.set('INT_table', tableGroup);
    this.propsMap.set('INT_table_leg', tableGroup);

    // Golden Key prop_key_gold on table
    const keyGroup = new THREE.Group();
    keyGroup.name = 'INT_gold_key';
    keyGroup.position.set(0.92, 0.74, -0.6);
    const keyGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16);
    const keyMat = createToonMaterial(0xd4af37, { emissive: 0xd4af37, emissiveIntensity: 0.55 });
    const keyMesh = new THREE.Mesh(keyGeo, keyMat);
    keyMesh.rotation.x = Math.PI / 2;
    keyGroup.add(keyMesh);
    this.hallGroup.add(keyGroup);
    this.propsMap.set('prop_key_gold', keyGroup);
    this.propsMap.set('INT_gold_key', keyGroup);

    // Bottle prop_bottle_drinkme on table
    const bottleGroup = new THREE.Group();
    bottleGroup.name = 'INT_bottle_drinkme';
    bottleGroup.position.set(0.76, 0.78, -0.54);
    const bottleGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.14, 16);
    const bottleMat = createToonMaterial(0x64b5c6);
    const bottleMesh = new THREE.Mesh(bottleGeo, bottleMat);
    addInkOutline(bottleMesh);
    bottleGroup.add(bottleMesh);
    this.hallGroup.add(bottleGroup);
    this.propsMap.set('prop_bottle_drinkme', bottleGroup);
    this.propsMap.set('INT_bottle_drinkme', bottleGroup);

    // Glass box under table with EAT ME cake
    const boxGroup = new THREE.Group();
    boxGroup.name = 'INT_glass_box';
    boxGroup.position.set(0.88, 0.035, -0.62);
    const boxGeo = new THREE.BoxGeometry(0.16, 0.07, 0.12);
    const boxMesh = new THREE.Mesh(boxGeo, glassMat);
    addInkOutline(boxMesh);
    boxGroup.add(boxMesh);

    const cakeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14);
    const cakeMat = createToonMaterial(0xc99650);
    const cakeMesh = new THREE.Mesh(cakeGeo, cakeMat);
    cakeMesh.position.set(0, 0.015, 0);
    boxGroup.add(cakeMesh);

    this.hallGroup.add(boxGroup);
    this.propsMap.set('INT_glass_box', boxGroup);
    this.propsMap.set('INT_cake_eatme', boxGroup);

    // Little Door & Low Crimson Curtain on North Wall (z = -3.4) visible behind Alice
    const doorGroup = new THREE.Group();
    doorGroup.name = 'INT_little_door';
    doorGroup.position.set(-0.8, 0.19, -3.4);
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.381, 0.06),
      createToonMaterial(0x5e3c24)
    );
    addInkOutline(doorFrame);
    doorGroup.add(doorFrame);
    this.hallGroup.add(doorGroup);
    this.propsMap.set('ch1_hall_door_little', doorGroup);
    this.propsMap.set('INT_little_door', doorGroup);

    const curtainGroup = new THREE.Group();
    curtainGroup.name = 'INT_curtain';
    curtainGroup.position.set(-0.8, 0.3, -3.32);
    const curtainMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.6, 0.03),
      createToonMaterial(0x8a1c2b)
    );
    addInkOutline(curtainMesh);
    curtainGroup.add(curtainMesh);
    this.hallGroup.add(curtainGroup);
    this.propsMap.set('INT_curtain', curtainGroup);
  }
}
