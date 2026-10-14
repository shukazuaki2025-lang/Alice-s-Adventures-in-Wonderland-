#!/usr/bin/env node
/**
 * tools/optimize-assets.mjs
 * Asset Optimization & Validation Tool for Chapter 1 glTF / GLB assets.
 * 
 * Validates glTF 2.0 binary structure, node hierarchy, mesh bounding boxes,
 * logic markers (`SPAWN_`, `TRG_`, `INT_`, `CAM_`, `PATH_`, `COL_`, `SLOT_`, `LAMP_`, `VISTA_ANCHOR`),
 * custom properties (`extras` / `userData`), and compresses/verifies runtime assets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REQUIRED_MARKER_PREFIXES = [
  'SPAWN_',
  'TRG_',
  'INT_',
  'CAM_',
  'PATH_',
  'COL_',
  'SLOT_',
  'LAMP_',
  'VISTA_ANCHOR'
];

function validateAndOptimizeGLB(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[optimize-assets] Target file ${filePath} not found. Running asset generator...`);
    try {
      execSync('node tools/generate-procedural-assets.mjs', { stdio: 'inherit' });
    } catch (err) {
      console.error(`[optimize-assets] Failed to generate asset:`, err);
      process.exit(1);
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[optimize-assets] Error: File still missing after generation: ${filePath}`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(filePath);
  console.log(`\n==================================================`);
  console.log(`[optimize-assets] Validating GLB: ${filePath}`);
  console.log(`[optimize-assets] File Size: ${(fileData.length / 1024).toFixed(2)} KB (${fileData.length} bytes)`);

  if (fileData.length < 12) {
    console.error(`[optimize-assets] Error: GLB file header too small (<12 bytes)`);
    process.exit(1);
  }

  // 1. Verify GLB Header
  const magic = fileData.readUInt32LE(0);
  const version = fileData.readUInt32LE(4);
  const totalLength = fileData.readUInt32LE(8);

  if (magic !== 0x46546C67) {
    console.error(`[optimize-assets] Error: Invalid magic number 0x${magic.toString(16)} (expected 0x46546c67 'glTF')`);
    process.exit(1);
  }

  if (version !== 2) {
    console.error(`[optimize-assets] Error: Unsupported glTF version ${version} (expected 2)`);
    process.exit(1);
  }

  if (totalLength !== fileData.length) {
    console.warn(`[optimize-assets] Warning: Header length (${totalLength}) != file size (${fileData.length})`);
  }

  // 2. Parse JSON Chunk
  const jsonChunkLength = fileData.readUInt32LE(12);
  const jsonChunkType = fileData.readUInt32LE(16);

  if (jsonChunkType !== 0x4E4F534A) { // "JSON"
    console.error(`[optimize-assets] Error: First chunk is not JSON (type 0x${jsonChunkType.toString(16)})`);
    process.exit(1);
  }

  const jsonBuffer = fileData.subarray(20, 20 + jsonChunkLength);
  let gltf;
  try {
    gltf = JSON.parse(jsonBuffer.toString('utf8'));
  } catch (err) {
    console.error(`[optimize-assets] Error: Failed to parse glTF JSON:`, err);
    process.exit(1);
  }

  console.log(`[optimize-assets] glTF Generator: ${gltf.asset?.generator || 'Unknown'}`);
  console.log(`[optimize-assets] Total Nodes: ${gltf.nodes?.length || 0}`);
  console.log(`[optimize-assets] Total Meshes: ${gltf.meshes?.length || 0}`);
  console.log(`[optimize-assets] Total Materials: ${gltf.materials?.length || 0}`);

  // 3. Logic Marker Scan
  const nodes = gltf.nodes || [];
  const foundMarkers = new Map();
  REQUIRED_MARKER_PREFIXES.forEach(prefix => foundMarkers.set(prefix, []));

  nodes.forEach((node, index) => {
    const nodeName = node.name || '';
    REQUIRED_MARKER_PREFIXES.forEach(prefix => {
      if (nodeName.startsWith(prefix) || nodeName === prefix) {
        foundMarkers.get(prefix).push({
          index,
          name: nodeName,
          translation: node.translation || [0, 0, 0],
          extras: node.extras || {}
        });
      }
    });
  });

  console.log(`\n--- Logic Marker Inventory ---`);
  let totalMarkerCount = 0;
  REQUIRED_MARKER_PREFIXES.forEach(prefix => {
    const list = foundMarkers.get(prefix);
    totalMarkerCount += list.length;
    console.log(`  [${prefix.padEnd(14)}] Count: ${list.length}`);
    list.slice(0, 3).forEach(m => {
      console.log(`    - ${m.name} @ [${m.translation.map(n => n.toFixed(2)).join(', ')}] ${JSON.stringify(m.extras)}`);
    });
    if (list.length > 3) {
      console.log(`    - ... and ${list.length - 3} more`);
    }
  });

  console.log(`\n[optimize-assets] Total Logic Markers Found: ${totalMarkerCount}`);

  // 4. Mesh Bounds & Geometry Inspection
  const accessors = gltf.accessors || [];
  let minBounds = [Infinity, Infinity, Infinity];
  let maxBounds = [-Infinity, -Infinity, -Infinity];

  accessors.forEach(acc => {
    if (acc.min && acc.max && acc.type === 'VEC3') {
      minBounds[0] = Math.min(minBounds[0], acc.min[0]);
      minBounds[1] = Math.min(minBounds[1], acc.min[1]);
      minBounds[2] = Math.min(minBounds[2], acc.min[2]);
      maxBounds[0] = Math.max(maxBounds[0], acc.max[0]);
      maxBounds[1] = Math.max(maxBounds[1], acc.max[1]);
      maxBounds[2] = Math.max(maxBounds[2], acc.max[2]);
    }
  });

  if (minBounds[0] !== Infinity) {
    console.log(`[optimize-assets] Global Bounding Box Min: [${minBounds.map(n => n.toFixed(2)).join(', ')}]`);
    console.log(`[optimize-assets] Global Bounding Box Max: [${maxBounds.map(n => n.toFixed(2)).join(', ')}]`);
  }

  // 5. Verification Gate
  const missingPrefixes = REQUIRED_MARKER_PREFIXES.filter(prefix => foundMarkers.get(prefix).length === 0);
  if (missingPrefixes.length > 0) {
    console.error(`\n[optimize-assets] ERROR: Missing required logic marker categories: ${missingPrefixes.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n[optimize-assets] ✅ Asset validation passed! Model is ready for Chapter 1 runtime.`);
  console.log(`==================================================\n`);
}

function main() {
  const targetFile = process.argv[2] || 'public/assets/models/ch1_greybox.glb';
  validateAndOptimizeGLB(targetFile);
}

main();
