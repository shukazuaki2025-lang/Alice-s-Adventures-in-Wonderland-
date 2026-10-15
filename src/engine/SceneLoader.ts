import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addInkOutline, convertMaterialsToToon, createToonMaterial } from '../shaders/ToonShaders';
import { applyInkOutline } from '../shaders/InkOutline';
import { createGlassTableMaterial } from '../shaders/GlassRefraction';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Meadow } from '../world/Meadow';
import { LAMP_TINTS, LightGlows, collectGlowSpecs } from '../world/LightGlows';

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
  /** painted light pools (lamp halos, fire, doorway of light); animated by update() */
  public glows: LightGlows[] = [];
  /** lamp anchors authored in the Blender sets (LAMP_* empties), used to place the few real point lights */
  public lampAnchors: { well: THREE.Vector3[]; passage: THREE.Vector3[]; hall: THREE.Vector3[] } = { well: [], passage: [], hall: [] };
  /** Painted riverbank dressing (grass tufts + wildflowers), animated by update(). */
  public meadow: Meadow | null = null;
  private waterMaps: THREE.Texture[] = [];
  private waterTime = 0;

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

    await this.loadPropAssets();
    await this.buildBankEnvironment();
    await this.buildWellEnvironment();
    await this.buildPassageEnvironment();
    await this.buildHallEnvironment();
    this.buildProceduralProps();
    if (physicsWorld) this.registerLevelColliders(physicsWorld);

    this.setActiveStateScene('S1_BANK');
    return this.sceneGroup;
  }

  /** Solid props, scoped per level so the oak never blocks the hall (and vice-versa). */
  private registerLevelColliders(physics: PhysicsWorld): void {
    // Riverbank (S1/S2): oak trunk, the reading sister, the hedge that hides the burrow.
    physics.addStaticBox('COL_oak_trunk', new THREE.Vector3(-1.5, 1.8, -2.0), new THREE.Vector3(0.85, 1.8, 0.85), 'bank');
    physics.addStaticBox('COL_sister', new THREE.Vector3(-0.2, 0.5, -1.2), new THREE.Vector3(0.3, 0.5, 0.3), 'bank');
    physics.addStaticBox('COL_hedge', new THREE.Vector3(15.6, 0.9, -1.4), new THREE.Vector3(1.5, 0.9, 5.0), 'bank');
    for (const [id, x, z, r] of [['a', 5.5, -5.3, 0.5], ['b', 9.0, -4.7, 0.4], ['c', -4.2, 2.6, 0.45], ['d', 20.5, 6.0, 0.6], ['e', -10.5, -4.9, 0.65]] as Array<[string, number, number, number]>) {
      physics.addStaticBox(`COL_rock_${id}`, new THREE.Vector3(x, 0.3, z), new THREE.Vector3(r, 0.3, r), 'bank');
    }
    // Great Hall: the three-legged glass table.
    physics.addStaticBox('COL_glass_table', new THREE.Vector3(0.85, 0.36, -0.6), new THREE.Vector3(0.3, 0.36, 0.3), 'hall');
  }

  /** Walkable XZ rectangle for a game state (null = unconstrained, e.g. the free-fall well). */
  public static getWalkBounds(state: string): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    switch (state) {
      case 'S0_TITLE':
      case 'S1_BANK':
      case 'S2_CHASE':
        return { minX: -34, maxX: 34, minZ: -6.0, maxZ: 24 };
      case 'S4_PASSAGE':
        return { minX: -4.8, maxX: 20.8, minZ: -1.5, maxZ: 1.5 };
      case 'S5_HALL':
      case 'S6_SMALL':
      case 'S7_CAKE':
      case 'END':
        return { minX: -11.8, maxX: 11.8, minZ: -3.35, maxZ: 3.35 };
      default:
        return null;
    }
  }

  public static getColliderGroup(state: string): string | null {
    if (state === 'S0_TITLE' || state === 'S1_BANK' || state === 'S2_CHASE') return 'bank';
    if (state === 'S3_FALL') return 'well';
    if (state === 'S4_PASSAGE') return 'passage';
    return 'hall';
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
        // Floor slabs are implicit (feet rest on y = 0); only real obstacles become walls, scoped to their level.
        if (physicsWorld && !name.includes('floor')) {
          physicsWorld.addStaticBox(name, pos, new THREE.Vector3(5, 0.2, 5), name.includes('river') ? 'bank' : 'global');
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

  /**
   * S1 riverbank: the Blender-built painted set (terrain, river, oak, hedge + burrow, rocks, toadstools, rug and the three
   * pickable daisies), plus engine-side grass/flower dressing. Falls back to a bare meadow if the GLB cannot load, so the game
   * remains playable (the interactables below still exist).
   */
  private async buildBankEnvironment(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/assets/models/ch1_s1_bank.glb');
      const root = gltf.scene;
      root.name = 'S1_Bank_Set';
      convertMaterialsToToon(root);
      // heavier ink on big soft masses, finer on small props (object-space thickness, metres)
      const ink: Array<[RegExp, number]> = [
        [/Oak_Trunk|Burrow_Arch/, 0.012],
        [/Oak_Canopy|Hedge/, 0.022],
        [/Rocks/, 0.016],
        [/Toadstool/, 0.006],
        [/Daisy|INT_daisy/, 0.0035],
      ];
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          const n = mesh.name;
          if (/Terrain|PicnicRug/.test(n)) mesh.receiveShadow = true;
          if (/Oak_|Hedge|Rocks|Burrow|Toadstool/.test(n)) mesh.castShadow = true;
          const rule = ink.find(([re]) => re.test(n) || re.test(mesh.parent?.name ?? ''));
          if (rule) applyInkOutline(mesh, 0x2b2420, rule[1]);
          if (/^Water_/.test(n)) {
            const mat = mesh.material as THREE.MeshToonMaterial;
            if (mat.map) {
              mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
              this.waterMaps.push(mat.map);
            }
            mat.emissiveIntensity = 0.32;
            mesh.receiveShadow = false;
          }
        }
        if (obj.name.startsWith('INT_')) this.propsMap.set(obj.name, obj);
      });
      this.bankGroup.add(root);
    } catch (e) {
      console.warn('[SceneLoader] Bank GLB unavailable, building a bare meadow:', e);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), createToonMaterial(0x88b378));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.bankGroup.add(ground);
      const pts: Array<[string, number, number]> = [
        ['INT_daisy_1', 3.6, -1.2],
        ['INT_daisy_2', 5.2, 1.1],
        ['INT_daisy_3', 7.0, -0.6],
        ['INT_rabbit_hole', 14.0, -2.0],
      ];
      for (const [id, x, z] of pts) {
        const g = new THREE.Group();
        g.name = id;
        g.position.set(x, 0, z);
        this.bankGroup.add(g);
        this.propsMap.set(id, g);
      }
    }

    // character placeholders: GameManager swaps the real entities in
    this.sisterMesh = new THREE.Group();
    this.sisterMesh.name = 'chr_sister';
    this.sisterMesh.position.set(-0.2, 0, -1.2);
    this.bankGroup.add(this.sisterMesh);
    this.propsMap.set('INT_sister_book', this.sisterMesh);

    this.rabbitMesh = new THREE.Group();
    this.rabbitMesh.name = 'chr_rabbit';
    this.rabbitMesh.position.set(8.5, 0, -1.8);
    this.bankGroup.add(this.rabbitMesh);
    this.propsMap.set('chr_rabbit', this.rabbitMesh);

    // grass + wildflowers (kept clear of the tree, rug, daisies and the burrow mouth)
    this.meadow = new Meadow({
      area: { minX: -32, maxX: 30, minZ: -6.2, maxZ: 22 },
      keepOut: [
        [-1.5, -2.0, 1.5],
        [-0.9, -0.1, 1.35],
        [3.6, -1.2, 0.45],
        [5.2, 1.1, 0.45],
        [7.0, -0.6, 0.45],
        [13.5, -2.0, 1.4],
        [15.5, -1.4, 1.7],
      ],
      hotSpots: [
        [-1.5, -2.0, 5.5],
        [4.5, -5.0, 6.0],
        [-12, -5.0, 6.0],
        [13.2, -4.5, 3.0],
        [13.2, 1.5, 3.0],
        [3.0, 0.0, 9.0],
      ],
      grassCount: 8600,
      flowerCount: 3800,
      grassHeight: 0.58,
    });
    this.bankGroup.add(this.meadow.group);
    this.addBankFoliageAndRockRelief();
  }

  /**
   * Adds instanced 3D sculpted foliage boughs, hanging blossom garlands, mossy riverbank stones, and streamside iris clusters
   * in 1 draw call so S1_BANK and S1_BANK_orbit have rich layered canopy silhouette and gouache colour variety.
   */
  private addBankFoliageAndRockRelief(): void {
    const count = 140;
    const geo = new THREE.DodecahedronGeometry(0.32, 1);
    const mat = createToonMaterial(0xffffff, { wash: 'strong' });
    mat.name = 'M_S1_Foliage_Relief';
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.name = 'S1_CanopyAndFlora_Instanced';
    inst.castShadow = true;
    inst.receiveShadow = true;

    const palette = [
      0xd8c848, // sunlit lemon-gold leaf cluster
      0x74a844, // warm apple-green bough
      0x3c7e54, // deep emerald canopy
      0x2e6468, // cool viridian-teal under-bough
      0x7c68a4, // wisteria-lavender blossom cluster
      0xd86e68, // wild rose-hawthorn cluster
      0x8c7e68, // mossy grey-ochre riverbank stone
      0x4e8898, // streamside blue-flag iris cluster
    ];

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();

    let idx = 0;
    // 1. Multi-layered oak canopy boughs & hanging garlands around (-1.5, y=2.1..4.6, -2.0)
    for (let i = 0; i < 65; i++) {
      const a = (i * 2.39996) % (Math.PI * 2);
      const r = 0.8 + ((i * 0.618) % 1) * 3.4;
      const h = 2.15 + ((i * 0.382) % 1) * 2.3;
      pos.set(-1.5 + Math.cos(a) * r, h, -2.0 + Math.sin(a) * r);
      quat.setFromEuler(new THREE.Euler(i * 0.7, i * 1.1, i * 0.5));
      const sx = 0.8 + (i % 4) * 0.32;
      const sy = 0.45 + (i % 3) * 0.22;
      scl.set(sx, sy, sx * 0.9);
      m.compose(pos, quat, scl);
      inst.setMatrixAt(idx, m);
      col.setHex(palette[i % 6]);
      inst.setColorAt(idx, col);
      idx++;
    }

    // 2. Mossy riverbank stones, root knots, and flowering cushion shrubs across the meadow & bank edge
    for (let i = 0; i < 75 && idx < count; i++) {
      const x = -12 + ((i * 3.73) % 30);
      const z = -5.6 + ((i * 2.17) % 14);
      // Keep clear of Alice's spawn (2, 0) and Sister (-0.2, -1.2)
      if (Math.hypot(x - 2.0, z) < 1.3 || Math.hypot(x + 0.2, z + 1.2) < 1.1) continue;
      pos.set(x, 0.08 + (i % 3) * 0.05, z);
      quat.setFromEuler(new THREE.Euler((i % 5) * 0.2, i * 0.9, (i % 3) * 0.15));
      const s = 0.35 + (i % 5) * 0.16;
      scl.set(s * 1.3, s * 0.65, s);
      m.compose(pos, quat, scl);
      inst.setMatrixAt(idx, m);
      col.setHex(palette[i % palette.length]);
      inst.setColorAt(idx, col);
      idx++;
    }

    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.bankGroup.add(inst);
  }

  /** Per-frame world animation (river flow, wind). */
  public update(dt: number): void {
    if (this.littleDoorLeaf) {
      const cur = this.littleDoorLeaf.rotation.y;
      const k = 1 - Math.exp(-5 * dt);
      this.littleDoorLeaf.rotation.y = cur + (this.littleDoorTarget - cur) * k;
    }
    this.waterTime += dt;
    for (const m of this.waterMaps) {
      m.offset.set((this.waterTime * 0.012) % 1, (this.waterTime * 0.004) % 1);
    }
    if (this.bankGroup.visible) this.meadow?.update(dt);
    for (const g of this.glows) g.update(dt);
  }

  /** Turn the emissive surfaces of a freshly loaded set into painted glows (see world/LightGlows.ts). */
  private addGlowsFor(root: THREE.Object3D, parent: THREE.Object3D, opts: Parameters<typeof collectGlowSpecs>[2] = {}): LightGlows | null {
    const specs = collectGlowSpecs(root, parent, opts);
    if (!specs.length) return null;
    const glows = new LightGlows(specs);
    parent.add(glows.mesh);
    this.glows.push(glows);
    return glows;
  }

  private static lampAnchorsOf(root: THREE.Object3D): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    root.traverse((o) => {
      if (o.name.startsWith('LAMP_')) out.push(o.position.clone());
    });
    return out;
  }

  private wellReturnCupboard: THREE.Group | null = null;

  /** Painted hand props (true-scale GLBs); anything that fails to load falls back to the primitive stand-in at its call site. */
  private propAssets = new Map<string, THREE.Object3D>();

  private async loadPropAssets(): Promise<void> {
    const names = ['prop_key_gold', 'prop_bottle_drinkme', 'prop_box_glass', 'prop_cake_eatme', 'prop_jar_marmalade'];
    await Promise.all(
      names.map(async (name) => {
        try {
          const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name}.glb`);
          const root = gltf.scene;
          convertMaterialsToToon(root);
          // ink widths are in object-space metres: a 5 cm cake needs a hair-line, not the 2.6 mm line used for a 1.2 m girl
          applyInkOutline(root, 0x2b2420, 0.00035);
          this.propAssets.set(name, root);
        } catch (e) {
          console.warn(`[SceneLoader] ${name}.glb unavailable, using a primitive stand-in:`, e);
        }
      })
    );
  }

  private cloneProp(name: string): THREE.Object3D | null {
    const src = this.propAssets.get(name);
    return src ? src.clone(true) : null;
  }

  /**
   * The painted S3 shaft: four stacked copies of ONE seamless 6 m segment (brick wall, bookshelves, cupboards, jar shelves,
   * maps, pictures, lanterns), scrolled upward by GameManager at fall speed so the wall really streams past Alice.
   */
  private async loadWellSet(): Promise<boolean> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/assets/models/ch1_s3_well.glb');
      const root = gltf.scene;
      convertMaterialsToToon(root);
      this.lampAnchors.well = SceneLoader.lampAnchorsOf(root);
      const segment = new THREE.Group();
      segment.name = 'S3_WellSegment';
      const returnCupboard = new THREE.Group();
      returnCupboard.name = 'S3_ReturnCupboard';
      for (const child of [...root.children]) {
        if (child.name.startsWith('S3_WellSegment')) segment.add(child);
        else if (child.name.startsWith('S3_ReturnCupboard')) returnCupboard.add(child);
      }
      segment.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && /Wood|Brass|Porcelain|Books|Stone/.test(mesh.name)) applyInkOutline(mesh, 0x2b2420, 0.0022);
      });
      returnCupboard.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) applyInkOutline(obj as THREE.Mesh, 0x2b2420, 0.003);
      });
      this.addWellSegmentRelief(segment);
      this.addGlowsFor(segment, segment, { scale: 0.9, minRadius: 0.22, maxRadius: 0.55, intensity: 0.45, tints: LAMP_TINTS });
      for (let k = 0; k < 4; k++) {
        const tile = k === 0 ? segment : segment.clone(true);
        tile.position.y = -12 + 6 * k;
        this.wellScrollingGroup.add(tile);
      }
      this.wellReturnCupboard = returnCupboard;
      return true;
    } catch (e) {
      console.warn('[SceneLoader] Well GLB unavailable, building the placeholder shaft:', e);
      return false;
    }
  }

  /**
   * Adds 180 sculpted 3D relief masonry blocks, multi-coloured leather books, Delft porcelain plates, and emerald ivy tufts
   * around each 6 m well segment in 1 InstancedMesh draw call.
   */
  private addWellSegmentRelief(segment: THREE.Group): void {
    const count = 180;
    const geo = new THREE.BoxGeometry(0.28, 0.22, 0.16);
    const mat = createToonMaterial(0xffffff, { wash: 'normal' });
    mat.name = 'M_S3_Books_Relief';
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.name = 'S3_Well_Polychrome_Relief';

    const palette = [
      0x2e6eb8, // cobalt leather folio
      0x38988a, // turquoise glazed ceramic / spine
      0x489a58, // emerald botanical volume / ivy
      0xe6b848, // gilded ochre atlas
      0xc84850, // crimson morocco binding
      0x7e549e, // amethyst velvet tome
      0xf4ebd4, // cream vellum scroll / Delft plate
      0x5882b8, // slate-blue ashlar stone block
    ];

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 * 5 + (i % 7) * 0.23;
      const y = (i / count) * 5.85 + 0.08;
      const r = 3.68 + (i % 3) * 0.07;
      pos.set(Math.cos(a) * r, y, Math.sin(a) * r);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
      const isBook = i % 3 !== 0;
      if (isBook) {
        scl.set(0.32 + (i % 4) * 0.12, 1.1 + (i % 3) * 0.35, 0.85 + (i % 2) * 0.3);
      } else {
        // Protruding stone corbel / brick course
        scl.set(1.6 + (i % 3) * 0.5, 0.65, 1.1);
      }
      m.compose(pos, quat, scl);
      inst.setMatrixAt(i, m);
      col.setHex(palette[i % palette.length]);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    segment.add(inst);
  }

  private async buildWellEnvironment(): Promise<void> {
    this.wellScrollingGroup = new THREE.Group();
    if (!(await this.loadWellSet())) {
      // placeholder shaft: radius 4.8m so the camera at z=3.2m is inside the well
      const shaftGeo = new THREE.CylinderGeometry(4.8, 4.8, 24, 24, 1, true);
      this.wellGroup.add(new THREE.Mesh(shaftGeo, createToonMaterial(0x6e5a4f, { side: THREE.DoubleSide })));
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
    }

    // Floating ORANGE MARMALADE jar within reach beside Alice
    const jarGroup = new THREE.Group();
    jarGroup.name = 'INT_jar_marmalade';
    jarGroup.position.set(0.75, 0.75, 0.25);
    const paintedJar = this.cloneProp('prop_jar_marmalade');
    if (paintedJar) {
      paintedJar.scale.setScalar(1.6);                 // generous: it has to be spotted while falling past
      paintedJar.position.y = -0.14;
      jarGroup.add(paintedJar);
    } else {
      const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 14), createToonMaterial(0xe09540));
      const jarLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.14, 14), createToonMaterial(0xf7f3ea));
      addInkOutline(jarBody);
      jarGroup.add(jarBody, jarLabel);
    }
    this.wellScrollingGroup.add(jarGroup);
    this.propsMap.set('prop_jar_marmalade', jarGroup);
    this.propsMap.set('INT_jar_marmalade', jarGroup);

    // Open cupboard shelf to stow the empty jar
    const returnCupboard = new THREE.Group();
    returnCupboard.name = 'INT_cupboard_return';
    returnCupboard.position.set(-0.75, 0.5, 0.25);
    if (this.wellReturnCupboard) {
      this.wellReturnCupboard.rotation.y = Math.PI / 2;
      returnCupboard.add(this.wellReturnCupboard);
    }
    this.wellScrollingGroup.add(returnCupboard);
    this.propsMap.set('INT_cupboard_return', returnCupboard);

    this.wellGroup.add(this.wellScrollingGroup);
  }

  private async buildPassageEnvironment(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/assets/models/ch1_s4_passage.glb');
      const root = gltf.scene;
      root.name = 'S4_Passage_Set';
      convertMaterialsToToon(root);
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (/S4_(Flag|Wood|Brass|Stone)/.test(mesh.name)) applyInkOutline(mesh, 0x2b2420, 0.0025);
        if (/S4_Flag/.test(mesh.name)) mesh.receiveShadow = true;
      });
      this.lampAnchors.passage = SceneLoader.lampAnchorsOf(root);
      this.addGlowsFor(root, root, { scale: 0.85, minRadius: 0.22, maxRadius: 0.65, intensity: 0.40, tints: LAMP_TINTS });
      this.passageGroup.add(root);
    } catch (e) {
      console.warn('[SceneLoader] Passage GLB unavailable, building the placeholder corridor:', e);
      this.buildPassagePlaceholder();
    }
    this.addPassageArchitecturalRelief();
    this.addPassageExit();
  }

  /**
   * Populates S4_PASSAGE with polychrome Victorian encaustic floor tiles, carved stone arch voussoirs, wall-niche curiosities,
   * and mossy ceiling roots in 1 InstancedMesh draw call.
   */
  private addPassageArchitecturalRelief(): void {
    const count = 240;
    const geo = new THREE.BoxGeometry(0.32, 0.18, 0.26);
    const mat = createToonMaterial(0xffffff, { wash: 'normal' });
    mat.name = 'M_S4_Brick_Relief';
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.name = 'S4_Passage_Polychrome_Relief';

    const palette = [
      0x2c6eb4, // cobalt encaustic tile / delft jar
      0x349688, // verdigris-teal glazed tile
      0x4e9a54, // emerald moss / botanical spine
      0xe8bd4c, // saffron-ochre keystone / brass
      0xc84a52, // terracotta-crimson tile
      0x7c549c, // amethyst slate block
      0xf5ecd6, // cream limestone voussoir
      0x5484b8, // cerulean puddle reflection / stone
    ];

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();

    let idx = 0;
    // 1. Polychrome encaustic floor border tiles & cobblestone relief along x = -3 .. 18
    for (let i = 0; i < 110; i++) {
      const x = -3.0 + (i / 110) * 21.0;
      const lane = (i % 5) - 2; // z lanes across the 3m floor
      const z = lane * 0.58 + ((i * 0.37) % 0.16 - 0.08);
      pos.set(x, 0.008 + (i % 3) * 0.004, z);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2) * (Math.PI / 4));
      scl.set(1.15, 0.08, 1.15);
      m.compose(pos, quat, scl);
      inst.setMatrixAt(idx, m);
      col.setHex(palette[i % palette.length]);
      inst.setColorAt(idx, col);
      idx++;
    }

    // 2. Protruding wall masonry courses, bookshelf niches & vaulted arch voussoirs along both sides and ceiling
    for (let i = 0; i < 130 && idx < count; i++) {
      const x = -2.5 + (i / 130) * 20.5;
      const archAngle = ((i * 1.37) % 1) * Math.PI; // 0 (right wall) -> pi/2 (vault crown) -> pi (left wall)
      const z = Math.cos(archAngle) * 1.78;
      const y = 0.22 + Math.sin(archAngle) * 1.95;
      pos.set(x, y, z);
      quat.setFromEuler(new THREE.Euler(archAngle - Math.PI / 2, 0, (i % 3 - 1) * 0.08));
      scl.set(0.95 + (i % 3) * 0.35, 0.85 + (i % 2) * 0.4, 0.75);
      m.compose(pos, quat, scl);
      inst.setMatrixAt(idx, m);
      col.setHex(palette[(i + 3) % palette.length]);
      inst.setColorAt(idx, col);
      idx++;
    }

    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.passageGroup.add(inst);
  }

  private buildPassagePlaceholder(): void {
    // Low Underground Passage (S4_PASSAGE)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 3.2),
      createToonMaterial(0x6b5848, { side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.x = 8; // spans x = -5..21 like the walls
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
  }

  private addPassageExit(): void {
    const exitMarker = new THREE.Group();
    exitMarker.name = 'TRG_S4_exit';
    exitMarker.position.set(18.0, 0, 0);
    this.passageGroup.add(exitMarker);
    this.propsMap.set('TRG_S4_exit', exitMarker);
  }

  /** True once the Blender-built, painted hall shell replaced the procedural placeholder shell. */
  private hallPainted = false;
  private littleDoorLeaf: THREE.Object3D | null = null;
  private hallCurtainNode: THREE.Object3D | null = null;
  private littleDoorTarget = 0;

  /** Swing the Little Door's hinged leaf open (into its 1.2 m passage) or shut; animated in update(). */
  public setLittleDoorOpen(open: boolean): void {
    this.littleDoorTarget = open ? 1.6 : 0;
  }

  /**
   * S5–S7 Great Hall: the painted Blender set (parquet + runner, damask wallpaper over a raised-panel dado, mouldings, beamed ceiling,
   * doors, pictures, consoles, settees, bookcases, clock, fireplace, hanging lamps). The interactive anchors (doors, table, curtain,
   * little door, key, bottle) are still created here so gameplay never depends on the art asset; if the GLB cannot load, the old
   * primitive shell is built instead.
   */
  private async buildHallEnvironment(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/assets/models/ch1_s5_hall.glb');
      const root = gltf.scene;
      root.name = 'S5_Hall_Set';
      convertMaterialsToToon(root);
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const n = mesh.name;
        if (/Parquet|Runner/.test(n)) mesh.receiveShadow = true;
        if (/S5_(Wood|Door|Brass|Marble|Porcelain|Books|Velvet|Clock)|Hall_LittleDoor/.test(n)) applyInkOutline(mesh, 0x2b2420, 0.0022);
        // the garden beyond the Little Door is the one place the chapter is allowed full-saturation sunshine: self-lit, not lamp-lit
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (/^M_S5_G_/.test(m.name)) (m as THREE.MeshToonMaterial).emissiveIntensity = /Sky/.test(m.name) ? 1.0 : 0.78;
        }
      });
      this.littleDoorLeaf = root.getObjectByName('Hall_LittleDoor') ?? null;
      this.hallCurtainNode = root.getObjectByName('Hall_Curtain') ?? null;
      this.hallCurtainNode?.removeFromParent();           // re-parented into INT_curtain so the game can slide it aside
      this.lampAnchors.hall = SceneLoader.lampAnchorsOf(root);
      this.addGlowsFor(root, root, { scale: 0.9, minRadius: 0.25, maxRadius: 0.75, intensity: 0.42, tints: LAMP_TINTS });
      this.hallGroup.add(root);
      this.hallPainted = true;
    } catch (e) {
      console.warn('[SceneLoader] Hall GLB unavailable, building the placeholder hall:', e);
    }
    if (!this.hallPainted) this.buildHallPlaceholderShell();
    this.addHallArchitecturalRelief();
    this.buildHallAnchors();
  }

  /**
   * Adds 3D sculpted parquet mosaic inlays, carpet fringe & border medallions (crucial at macro 0.254m scale in S6_SMALL),
   * and carved wainscot / stained-glass transom relief in 1 InstancedMesh draw call.
   */
  private addHallArchitecturalRelief(): void {
    const count = 160;
    const geo = new THREE.BoxGeometry(0.18, 0.024, 0.14);
    const mat = createToonMaterial(0xffffff, { wash: 'normal' });
    mat.name = 'M_S5_Wood_Relief';
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.name = 'S5_Hall_Polychrome_Relief';

    const palette = [
      0x2c6eb8, // royal cobalt carpet medallion / inlay
      0x389a8c, // turquoise mosaic tile
      0x4c9c5c, // emerald botanical border
      0xeabe4c, // gilded brass / saffron fringe
      0xc84650, // crimson velvet / madder knot
      0x7c54a0, // amethyst stained-glass reflection
      0xf7efe0, // ivory marble / cream fringe tassel
      0x8a5e3b, // carved walnut parquet block
    ];

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();

    let idx = 0;
    // 1. Macro-scale parquet mosaic border blocks & carpet fringe around the glass table & Little Door (x in [-4, 4], z in [-3.2, 2.2])
    for (let i = 0; i < 110; i++) {
      const x = -3.8 + (i / 110) * 7.6;
      const z = -3.1 + ((i * 0.618) % 1) * 5.0;
      pos.set(x, 0.006 + (i % 3) * 0.003, z);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 4) * (Math.PI / 4));
      scl.set(0.65 + (i % 3) * 0.25, 0.45, 0.65 + ((i + 1) % 3) * 0.25);
      m.compose(pos, quat, scl);
      inst.setMatrixAt(idx, m);
      col.setHex(palette[i % palette.length]);
      inst.setColorAt(idx, col);
      idx++;
    }

    // 2. Carved wainscot rosette bosses & stained-glass transom panels along the North & South walls (z = ±3.42)
    for (let i = 0; i < 50 && idx < count; i++) {
      const x = -10.5 + (i / 50) * 21.0;
      const z = i % 2 === 0 ? -3.42 : 3.42;
      const y = i % 3 === 0 ? 2.32 : 0.42 + (i % 2) * 0.36;
      pos.set(x, y, z);
      quat.setFromEuler(new THREE.Euler(Math.PI / 2, 0, (i % 2) * (Math.PI / 4)));
      scl.set(1.4, 1.2, 6.5);
      m.compose(pos, quat, scl);
      inst.setMatrixAt(idx, m);
      col.setHex(palette[(i + 2) % palette.length]);
      inst.setColorAt(idx, col);
      idx++;
    }

    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.hallGroup.add(inst);
  }

  private buildHallPlaceholderShell(): void {
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

    // 6 Warm Hanging Lamps along the Hall
    [-9, -5, -1, 3, 7, 10.5].forEach((lx) => {
      const lampMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        createToonMaterial(0xffe08a, { emissive: 0xffb84d, emissiveIntensity: 0.75 })
      );
      lampMesh.position.set(lx, 2.65, 0);
      this.hallGroup.add(lampMesh);
    });
  }

  private buildHallAnchors(): void {
    // Locked Full-Size Doors along North & South walls
    const doorX = [-8, -3, 2, 7];
    doorX.forEach((dx, idx) => {
      [-3.4, 3.4].forEach((dz, sideIdx) => {
        const doorNum = idx * 2 + sideIdx + 1;
        // painted doors come from the GLB; the anchor is an invisible group at the same spot
        const doorMesh: THREE.Object3D = this.hallPainted
          ? new THREE.Group()
          : new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), createToonMaterial(0x5c3c24));
        doorMesh.position.set(dx, 1.05, dz);
        const paddedName = `INT_door_0${doorNum}`;
        doorMesh.name = paddedName;
        if (!this.hallPainted) addInkOutline(doorMesh as THREE.Mesh);
        this.hallGroup.add(doorMesh);
        this.propsMap.set(paddedName, doorMesh);
        this.propsMap.set(`INT_door_${doorNum}`, doorMesh);
      });
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
    if (!this.hallPainted) this.hallGroup.add(vistaGroup);   // the painted hall already contains the Garden Vista
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
    const paintedKey = this.cloneProp('prop_key_gold');
    if (paintedKey) {
      paintedKey.rotation.x = Math.PI / 2;               // lies flat on the glass
      paintedKey.position.y = -0.016;                    // the group sits 4 cm above the table top
      keyGroup.add(paintedKey);
    } else {
      const keyGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16);
      const keyMat = createToonMaterial(0xd4af37, { emissive: 0xd4af37, emissiveIntensity: 0.55 });
      const keyMesh = new THREE.Mesh(keyGeo, keyMat);
      keyMesh.rotation.x = Math.PI / 2;
      keyGroup.add(keyMesh);
    }
    this.hallGroup.add(keyGroup);
    this.propsMap.set('prop_key_gold', keyGroup);
    this.propsMap.set('INT_gold_key', keyGroup);

    // Bottle prop_bottle_drinkme on table
    const bottleGroup = new THREE.Group();
    bottleGroup.name = 'INT_bottle_drinkme';
    bottleGroup.position.set(0.76, 0.78, -0.54);
    const paintedBottle = this.cloneProp('prop_bottle_drinkme');
    if (paintedBottle) {
      paintedBottle.position.y = -0.06;                  // group origin is 6 cm above the table top
      paintedBottle.rotation.y = 0.5;                    // label turned a little towards the player
      bottleGroup.add(paintedBottle);
    } else {
      const bottleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 16), createToonMaterial(0x64b5c6));
      addInkOutline(bottleMesh);
      bottleGroup.add(bottleMesh);
    }
    this.hallGroup.add(bottleGroup);
    this.propsMap.set('prop_bottle_drinkme', bottleGroup);
    this.propsMap.set('INT_bottle_drinkme', bottleGroup);

    // Glass box under table with EAT ME cake
    const boxGroup = new THREE.Group();
    boxGroup.name = 'INT_glass_box';
    boxGroup.position.set(0.88, 0.035, -0.62);
    const paintedBox = this.cloneProp('prop_box_glass');
    const paintedCake = this.cloneProp('prop_cake_eatme');
    if (paintedBox && paintedCake) {
      paintedBox.position.y = -0.035;                    // group origin is the box centre height
      paintedBox.scale.setScalar(1.5);                   // 15 × 10.5 × 7.5 cm: big enough to read from the hall
      paintedCake.position.set(0, -0.026, 0);
      paintedCake.scale.setScalar(1.5);
      boxGroup.add(paintedBox, paintedCake);
    } else {
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.12), glassMat);
      addInkOutline(boxMesh);
      boxGroup.add(boxMesh);
      const cakeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), createToonMaterial(0xc99650));
      cakeMesh.position.set(0, 0.015, 0);
      boxGroup.add(cakeMesh);
    }

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
    if (!this.hallPainted) doorGroup.add(doorFrame);   // the painted hall carries its own Little Door
    this.hallGroup.add(doorGroup);
    this.propsMap.set('ch1_hall_door_little', doorGroup);
    this.propsMap.set('INT_little_door', doorGroup);

    const curtainGroup = new THREE.Group();
    curtainGroup.name = 'INT_curtain';
    curtainGroup.position.set(-0.8, 0.3, -3.32);
    if (this.hallCurtainNode) {
      curtainGroup.add(this.hallCurtainNode);
    } else {
      const curtainMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.6, 0.03),
        createToonMaterial(0x8a1c2b)
      );
      addInkOutline(curtainMesh);
      curtainGroup.add(curtainMesh);
    }
    this.hallGroup.add(curtainGroup);
    this.propsMap.set('INT_curtain', curtainGroup);
  }
}
