#!/usr/bin/env node
/**
 * tools/generate-procedural-assets.mjs
 * Standalone Node.js Generator & Exporter for Chapter 1 3D Assets.
 * 
 * Generates spec-compliant glTF 2.0 Binary (.glb) files for:
 * 1. Combined Chapter 1 Greybox (`ch1_greybox.glb`)
 * 2. Scene GLBs: `ch1_s1_bank.glb`, `ch1_s3_well.glb`, `ch1_s4_passage.glb`, `ch1_s5_hall.glb`
 * 3. Character GLBs: `chr_alice.glb`, `chr_rabbit.glb`, `chr_sister.glb`, `chr_dinah_dream.glb`
 * 4. Prop GLBs: `prop_key_gold.glb`, `prop_bottle_drinkme.glb`, `prop_jar_marmalade.glb`, `prop_cake_eatme.glb`, `prop_watch.glb`, `prop_box_glass.glb`
 * 
 * Saves all generated GLBs into both `public/assets/models/` and `assets_src/`.
 */

import fs from 'node:fs';
import path from 'node:path';

class GLBBuilder {
  constructor() {
    this.bufferData = [];
    this.currentByteOffset = 0;
    this.bufferViews = [];
    this.accessors = [];
    this.materials = [];
    this.meshes = [];
    this.nodes = [];
  }

  addBufferData(typedArray, target) {
    const buffer = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const byteOffset = this.currentByteOffset;
    const byteLength = buffer.length;

    this.bufferData.push(buffer);
    this.currentByteOffset += byteLength;

    // Alignment to 4 bytes
    const remainder = byteLength % 4;
    if (remainder !== 0) {
      const padLength = 4 - remainder;
      this.bufferData.push(Buffer.alloc(padLength));
      this.currentByteOffset += padLength;
    }

    const bufferViewIndex = this.bufferViews.length;
    this.bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength,
      target
    });

    return bufferViewIndex;
  }

  addAccessor(bufferViewIndex, componentType, count, type, min, max) {
    const accessorIndex = this.accessors.length;
    const acc = {
      bufferView: bufferViewIndex,
      byteOffset: 0,
      componentType,
      count,
      type
    };
    if (min !== undefined) acc.min = min;
    if (max !== undefined) acc.max = max;
    this.accessors.push(acc);
    return accessorIndex;
  }

  addMaterial(name, color, roughness = 0.5, metallic = 0.0, alpha = 1.0) {
    const matIndex = this.materials.length;
    const mat = {
      name,
      pbrMetallicRoughness: {
        baseColorFactor: color,
        roughnessFactor: roughness,
        metallicFactor: metallic
      }
    };
    if (alpha < 1.0) {
      mat.alphaMode = 'BLEND';
    }
    this.materials.push(mat);
    return matIndex;
  }

  addMesh(name, primitives) {
    const meshIndex = this.meshes.length;
    this.meshes.push({
      name,
      primitives
    });
    return meshIndex;
  }

  addNode(options) {
    const nodeIndex = this.nodes.length;
    const node = { name: options.name || `Node_${nodeIndex}` };
    if (options.translation) node.translation = options.translation;
    if (options.rotation) node.rotation = options.rotation;
    if (options.scale) node.scale = options.scale;
    if (options.mesh !== undefined) node.mesh = options.mesh;
    if (options.children && options.children.length > 0) node.children = options.children;
    if (options.extras) node.extras = options.extras;
    this.nodes.push(node);
    return nodeIndex;
  }

  buildBoxGeometry(dx, dy, dz) {
    const hx = dx / 2, hy = dy / 2, hz = dz / 2;
    const positions = new Float32Array([
      -hx, -hy,  hz,  hx, -hy,  hz,  hx,  hy,  hz, -hx,  hy,  hz,
      -hx, -hy, -hz, -hx,  hy, -hz,  hx,  hy, -hz,  hx, -hy, -hz,
      -hx,  hy, -hz, -hx,  hy,  hz,  hx,  hy,  hz,  hx,  hy, -hz,
      -hx, -hy, -hz,  hx, -hy, -hz,  hx, -hy,  hz, -hx, -hy,  hz,
       hx, -hy, -hz,  hx,  hy, -hz,  hx,  hy,  hz,  hx, -hy,  hz,
      -hx, -hy, -hz, -hx, -hy,  hz, -hx,  hy,  hz, -hx,  hy, -hz
    ]);

    const normals = new Float32Array([
       0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
       0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
       0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
       0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
       1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
      -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0
    ]);

    const indices = new Uint16Array([
       0,  1,  2,   0,  2,  3,
       4,  5,  6,   4,  6,  7,
       8,  9, 10,   8, 10, 11,
      12, 13, 14,  12, 14, 15,
      16, 17, 18,  16, 18, 19,
      20, 21, 22,  20, 22, 23
    ]);

    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      min[0] = Math.min(min[0], positions[i]);
      min[1] = Math.min(min[1], positions[i+1]);
      min[2] = Math.min(min[2], positions[i+2]);
      max[0] = Math.max(max[0], positions[i]);
      max[1] = Math.max(max[1], positions[i+1]);
      max[2] = Math.max(max[2], positions[i+2]);
    }

    const posView = this.addBufferData(positions, 34962);
    const normView = this.addBufferData(normals, 34962);
    const idxView = this.addBufferData(indices, 34963);

    const posAcc = this.addAccessor(posView, 5126, 24, "VEC3", min, max);
    const normAcc = this.addAccessor(normView, 5126, 24, "VEC3");
    const idxAcc = this.addAccessor(idxView, 5123, 36, "SCALAR");

    return { attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc };
  }

  buildCylinderGeometry(radiusTop, radiusBottom, height, segments = 16) {
    const pos = [], norm = [], idx = [];
    const halfH = height / 2;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      pos.push(radiusTop * cos, halfH, radiusTop * sin);
      norm.push(cos, 0, sin);
      pos.push(radiusBottom * cos, -halfH, radiusBottom * sin);
      norm.push(cos, 0, sin);
    }
    for (let i = 0; i < segments; i++) {
      const p1 = i * 2, p2 = p1 + 1, p3 = (i + 1) * 2, p4 = p3 + 1;
      idx.push(p1, p2, p3);
      idx.push(p2, p4, p3);
    }

    const positions = new Float32Array(pos);
    const normals = new Float32Array(norm);
    const indices = new Uint16Array(idx);

    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      min[0] = Math.min(min[0], positions[i]);
      min[1] = Math.min(min[1], positions[i+1]);
      min[2] = Math.min(min[2], positions[i+2]);
      max[0] = Math.max(max[0], positions[i]);
      max[1] = Math.max(max[1], positions[i+1]);
      max[2] = Math.max(max[2], positions[i+2]);
    }

    const posView = this.addBufferData(positions, 34962);
    const normView = this.addBufferData(normals, 34962);
    const idxView = this.addBufferData(indices, 34963);

    const posAcc = this.addAccessor(posView, 5126, positions.length / 3, "VEC3", min, max);
    const normAcc = this.addAccessor(normView, 5126, normals.length / 3, "VEC3");
    const idxAcc = this.addAccessor(idxView, 5123, indices.length, "SCALAR");

    return { attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc };
  }

  generateGLB(sceneName = "Scene") {
    const jsonObject = {
      asset: { version: "2.0", generator: "Alice Chapter 1 3D Asset Generator" },
      scene: 0,
      scenes: [{ name: sceneName, nodes: [0] }],
      nodes: this.nodes,
      meshes: this.meshes,
      materials: this.materials,
      accessors: this.accessors,
      bufferViews: this.bufferViews,
      buffers: [{ byteLength: this.currentByteOffset }]
    };

    const jsonString = JSON.stringify(jsonObject);
    let jsonBuffer = Buffer.from(jsonString, 'utf8');
    const jsonRemainder = jsonBuffer.length % 4;
    if (jsonRemainder !== 0) {
      jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(4 - jsonRemainder, 0x20)]);
    }

    const binBuffer = Buffer.concat(this.bufferData);
    const binRemainder = binBuffer.length % 4;
    let finalBinBuffer = binBuffer;
    if (binRemainder !== 0) {
      finalBinBuffer = Buffer.concat([binBuffer, Buffer.alloc(4 - binRemainder, 0x00)]);
    }

    const totalLength = 12 + 8 + jsonBuffer.length + 8 + finalBinBuffer.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546C67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
    jsonHeader.writeUInt32LE(0x4E4F534A, 4);

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(finalBinBuffer.length, 0);
    binHeader.writeUInt32LE(0x004E4942, 4);

    return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, finalBinBuffer]);
  }
}

// 1. Combined Greybox
function generateChapter1Greybox() {
  const builder = new GLBBuilder();
  const matGrass = builder.addMaterial("M_Grass", [0.22, 0.45, 0.18, 1.0], 0.8);
  const matStone = builder.addMaterial("M_Stone", [0.40, 0.40, 0.42, 1.0], 0.7);
  const matWood = builder.addMaterial("M_Wood", [0.32, 0.20, 0.12, 1.0], 0.6);
  const matGlassTable = builder.addMaterial("M_Glass_Table", [0.75, 0.90, 0.95, 0.25], 0.1, 0.0, 0.25);
  const matGlassBottle = builder.addMaterial("M_Glass_Bottle", [0.80, 0.95, 0.90, 0.30], 0.1, 0.0, 0.30);
  const matGlassBox = builder.addMaterial("M_Glass_Box", [0.85, 0.95, 0.95, 0.35], 0.1, 0.0, 0.35);
  const matGold = builder.addMaterial("M_Gold_Key", [0.83, 0.66, 0.23, 1.0], 0.25, 0.9);
  const matCake = builder.addMaterial("M_Cake", [0.85, 0.70, 0.45, 1.0], 0.8);
  const matCurtain = builder.addMaterial("M_Curtain", [0.15, 0.45, 0.22, 1.0], 0.7);

  const boxMeadow = builder.buildBoxGeometry(60.0, 40.0, 0.2);
  const meshMeadow = builder.addMesh("S1_Ground_Meadow", [{ ...boxMeadow, material: matGrass }]);

  const boxOakTrunk = builder.buildCylinderGeometry(0.8, 0.8, 4.0, 16);
  const meshOakTrunk = builder.addMesh("S1_Oak_Tree_Trunk", [{ ...boxOakTrunk, material: matWood }]);

  const boxOakCanopy = builder.buildCylinderGeometry(3.5, 3.5, 3.5, 16);
  const meshOakCanopy = builder.addMesh("S1_Oak_Tree_Canopy", [{ ...boxOakCanopy, material: matGrass }]);

  const nodeMeadow = builder.addNode({ name: "S1_Ground_Meadow", mesh: meshMeadow });
  const nodeTrunk = builder.addNode({ name: "S1_Oak_Tree_Trunk", translation: [0, 0, 2.0], mesh: meshOakTrunk });
  const nodeCanopy = builder.addNode({ name: "S1_Oak_Tree_Canopy", translation: [0, 0, 5.0], mesh: meshOakCanopy });

  builder.addNode({ name: "CH1_GREYBOX_ROOT", children: [nodeMeadow, nodeTrunk, nodeCanopy] });
  return builder.generateGLB("Chapter1_Greybox");
}

// 2. Scene GLBs
function generateSceneS1Bank() {
  const b = new GLBBuilder();
  const matGrass = b.addMaterial("M_Grass", [0.22, 0.45, 0.18, 1.0]);
  const matWood = b.addMaterial("M_Wood", [0.32, 0.20, 0.12, 1.0]);
  const box = b.buildBoxGeometry(60.0, 40.0, 0.2);
  const m1 = b.addMesh("S1_Meadow", [{ ...box, material: matGrass }]);
  const cyl = b.buildCylinderGeometry(0.8, 0.8, 4.0);
  const m2 = b.addMesh("S1_OakTree", [{ ...cyl, material: matWood }]);
  const n1 = b.addNode({ name: "Meadow_Ground", mesh: m1 });
  const n2 = b.addNode({ name: "Oak_Tree", translation: [0, 0, 2], mesh: m2 });
  b.addNode({ name: "S1_Bank_Root", children: [n1, n2] });
  return b.generateGLB("S1_Bank");
}

function generateSceneS3Well() {
  const b = new GLBBuilder();
  const matStone = b.addMaterial("M_Stone", [0.4, 0.4, 0.42, 1.0]);
  const cyl = b.buildCylinderGeometry(2.3, 2.3, 20.0);
  const m = b.addMesh("S3_WellShaft", [{ ...cyl, material: matStone }]);
  const n = b.addNode({ name: "Well_Shaft", mesh: m });
  b.addNode({ name: "S3_Well_Root", children: [n] });
  return b.generateGLB("S3_Well");
}

function generateSceneS4Passage() {
  const b = new GLBBuilder();
  const matStone = b.addMaterial("M_Stone", [0.35, 0.35, 0.38, 1.0]);
  const box = b.buildBoxGeometry(24.0, 2.0, 2.4);
  const m = b.addMesh("S4_PassageCorridor", [{ ...box, material: matStone }]);
  const n = b.addNode({ name: "Passage_Corridor", mesh: m });
  b.addNode({ name: "S4_Passage_Root", children: [n] });
  return b.generateGLB("S4_Passage");
}

function generateSceneS5Hall() {
  const b = new GLBBuilder();
  const matWood = b.addMaterial("M_Wood", [0.3, 0.18, 0.1, 1.0]);
  const matGlass = b.addMaterial("M_Glass", [0.8, 0.9, 0.95, 0.3]);
  const boxHall = b.buildBoxGeometry(24.0, 7.0, 2.85);
  const mHall = b.addMesh("S5_GreatHall", [{ ...boxHall, material: matWood }]);
  const cylTop = b.buildCylinderGeometry(0.25, 0.25, 0.035);
  const mTable = b.addMesh("S5_GlassTable", [{ ...cylTop, material: matGlass }]);
  const n1 = b.addNode({ name: "Hall_Shell", mesh: mHall });
  const n2 = b.addNode({ name: "Glass_Table", translation: [4.0, 0.0, 0.7], mesh: mTable });
  b.addNode({ name: "S5_Hall_Root", children: [n1, n2] });
  return b.generateGLB("S5_Hall");
}

// 3. Character GLBs
function generateCharacterAlice() {
  const b = new GLBBuilder();
  const matDress = b.addMaterial("M_Alice_Dress", [0.91, 0.77, 0.42, 1.0]); // Yellow dress #E9C46A
  const matApron = b.addMaterial("M_Alice_Apron", [0.97, 0.95, 0.92, 1.0]); // White apron #F7F3EA
  const boxBody = b.buildCylinderGeometry(0.2, 0.35, 1.0);
  const mBody = b.addMesh("Alice_Body", [{ ...boxBody, material: matDress }]);
  const boxApron = b.buildBoxGeometry(0.25, 0.05, 0.6);
  const mApron = b.addMesh("Alice_Apron", [{ ...boxApron, material: matApron }]);
  const n1 = b.addNode({ name: "Body_Dress", mesh: mBody });
  const n2 = b.addNode({ name: "White_Apron", translation: [0, 0.15, 0.5], mesh: mApron });
  b.addNode({ name: "chr_alice_root", children: [n1, n2], extras: { height: 1.2 } });
  return b.generateGLB("chr_alice");
}

function generateCharacterRabbit() {
  const b = new GLBBuilder();
  const matFur = b.addMaterial("M_Rabbit_Fur", [0.95, 0.95, 0.95, 1.0]);
  const matWaistcoat = b.addMaterial("M_Rabbit_Waistcoat", [0.75, 0.2, 0.2, 1.0]);
  const cylBody = b.buildCylinderGeometry(0.15, 0.2, 0.6);
  const mBody = b.addMesh("Rabbit_Body", [{ ...cylBody, material: matWaistcoat }]);
  const n = b.addNode({ name: "White_Rabbit_Mesh", mesh: mBody, extras: { character: "White Rabbit" } });
  b.addNode({ name: "chr_rabbit_root", children: [n] });
  return b.generateGLB("chr_rabbit");
}

function generateCharacterSister() {
  const b = new GLBBuilder();
  const matSister = b.addMaterial("M_Sister", [0.6, 0.4, 0.3, 1.0]);
  const cyl = b.buildCylinderGeometry(0.25, 0.4, 1.1);
  const m = b.addMesh("Sister_Mesh", [{ ...cyl, material: matSister }]);
  const n = b.addNode({ name: "Sister_Body", mesh: m });
  b.addNode({ name: "chr_sister_root", children: [n] });
  return b.generateGLB("chr_sister");
}

function generateCharacterDinah() {
  const b = new GLBBuilder();
  const matCat = b.addMaterial("M_Dinah", [0.8, 0.5, 0.2, 1.0]);
  const cyl = b.buildCylinderGeometry(0.1, 0.1, 0.3);
  const m = b.addMesh("Dinah_Mesh", [{ ...cyl, material: matCat }]);
  const n = b.addNode({ name: "Dinah_Cat", mesh: m });
  b.addNode({ name: "chr_dinah_dream_root", children: [n] });
  return b.generateGLB("chr_dinah_dream");
}

// 4. Prop GLBs
function generatePropKeyGold() {
  const b = new GLBBuilder();
  const matGold = b.addMaterial("M_Gold", [0.83, 0.66, 0.23, 1.0], 0.2, 0.9);
  const cyl = b.buildCylinderGeometry(0.005, 0.005, 0.05);
  const m = b.addMesh("GoldKey_Mesh", [{ ...cyl, material: matGold }]);
  const n = b.addNode({ name: "Golden_Key", mesh: m, extras: { itemId: "prop_key_gold" } });
  b.addNode({ name: "prop_key_gold_root", children: [n] });
  return b.generateGLB("prop_key_gold");
}

function generatePropBottleDrinkMe() {
  const b = new GLBBuilder();
  const matGlass = b.addMaterial("M_GlassBottle", [0.8, 0.95, 0.9, 0.3], 0.1, 0.0, 0.3);
  const cyl = b.buildCylinderGeometry(0.02, 0.02, 0.10);
  const m = b.addMesh("DrinkMeBottle_Mesh", [{ ...cyl, material: matGlass }]);
  const n = b.addNode({ name: "DrinkMe_Bottle", mesh: m, extras: { decal: "DRINK ME", itemId: "prop_bottle_drinkme" } });
  b.addNode({ name: "prop_bottle_drinkme_root", children: [n] });
  return b.generateGLB("prop_bottle_drinkme");
}

function generatePropJarMarmalade() {
  const b = new GLBBuilder();
  const matJar = b.addMaterial("M_Jar", [0.9, 0.6, 0.2, 0.5], 0.2, 0.0, 0.5);
  const cyl = b.buildCylinderGeometry(0.04, 0.04, 0.14);
  const m = b.addMesh("MarmaladeJar_Mesh", [{ ...cyl, material: matJar }]);
  const n = b.addNode({ name: "Marmalade_Jar", mesh: m, extras: { decal: "ORANGE MARMALADE", itemId: "prop_jar_marmalade" } });
  b.addNode({ name: "prop_jar_marmalade_root", children: [n] });
  return b.generateGLB("prop_jar_marmalade");
}

function generatePropCakeEatMe() {
  const b = new GLBBuilder();
  const matCake = b.addMaterial("M_Cake", [0.85, 0.7, 0.45, 1.0], 0.8);
  const cyl = b.buildCylinderGeometry(0.025, 0.025, 0.025);
  const m = b.addMesh("EatMeCake_Mesh", [{ ...cyl, material: matCake }]);
  const n = b.addNode({ name: "EatMe_Cake", mesh: m, extras: { decal: "EAT ME", itemId: "prop_cake_eatme" } });
  b.addNode({ name: "prop_cake_eatme_root", children: [n] });
  return b.generateGLB("prop_cake_eatme");
}

function generatePropWatch() {
  const b = new GLBBuilder();
  const matWatch = b.addMaterial("M_Watch", [0.83, 0.66, 0.23, 1.0], 0.2, 0.9);
  const cyl = b.buildCylinderGeometry(0.025, 0.025, 0.01);
  const m = b.addMesh("PocketWatch_Mesh", [{ ...cyl, material: matWatch }]);
  const n = b.addNode({ name: "Pocket_Watch", mesh: m, extras: { itemId: "prop_watch" } });
  b.addNode({ name: "prop_watch_root", children: [n] });
  return b.generateGLB("prop_watch");
}

function generatePropBoxGlass() {
  const b = new GLBBuilder();
  const matBox = b.addMaterial("M_GlassBox", [0.85, 0.95, 0.95, 0.35], 0.1, 0.0, 0.35);
  const box = b.buildBoxGeometry(0.10, 0.07, 0.05);
  const m = b.addMesh("GlassBox_Mesh", [{ ...box, material: matBox }]);
  const n = b.addNode({ name: "Glass_Box", mesh: m, extras: { itemId: "prop_box_glass" } });
  b.addNode({ name: "prop_box_glass_root", children: [n] });
  return b.generateGLB("prop_box_glass");
}

function writeAsset(filename, buffer) {
  const targets = [
    path.join('public/assets/models', filename),
    path.join('assets_src', filename),
    path.join('assets_src/models', filename)
  ];

  targets.forEach(t => {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, buffer);
    console.log(`Saved ${buffer.length} bytes -> ${t}`);
  });
}

function main() {
  console.log(`[generate-procedural-assets] Generating all Chapter 1 3D GLB assets...`);

  writeAsset('ch1_greybox.glb', generateChapter1Greybox());
  writeAsset('ch1_s1_bank.glb', generateSceneS1Bank());
  writeAsset('ch1_s3_well.glb', generateSceneS3Well());
  writeAsset('ch1_s4_passage.glb', generateSceneS4Passage());
  writeAsset('ch1_s5_hall.glb', generateSceneS5Hall());

  writeAsset('chr_alice.glb', generateCharacterAlice());
  writeAsset('chr_rabbit.glb', generateCharacterRabbit());
  writeAsset('chr_sister.glb', generateCharacterSister());
  writeAsset('chr_dinah_dream.glb', generateCharacterDinah());

  writeAsset('prop_key_gold.glb', generatePropKeyGold());
  writeAsset('prop_bottle_drinkme.glb', generatePropBottleDrinkMe());
  writeAsset('prop_jar_marmalade.glb', generatePropJarMarmalade());
  writeAsset('prop_cake_eatme.glb', generatePropCakeEatMe());
  writeAsset('prop_watch.glb', generatePropWatch());
  writeAsset('prop_box_glass.glb', generatePropBoxGlass());

  console.log(`[generate-procedural-assets] All GLB assets successfully generated and saved!`);
}

main();
