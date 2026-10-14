#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export function parseGlbSummary(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 20) {
    throw new Error(`Invalid GLB (too short): ${filePath}`);
  }
  const magic = buf.toString('ascii', 0, 4);
  const version = buf.readUInt32LE(4);
  if (magic !== 'glTF' || version !== 2) {
    throw new Error(`Invalid GLB header in ${filePath}: magic=${magic} version=${version}`);
  }
  const jsonChunkLen = buf.readUInt32LE(12);
  const jsonChunkType = buf.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) {
    throw new Error(`Missing JSON chunk in ${filePath}`);
  }
  const jsonStr = buf.toString('utf8', 20, 20 + jsonChunkLen);
  const gltf = JSON.parse(jsonStr);

  const accessors = gltf.accessors || [];
  const meshes = gltf.meshes || [];
  const nodes = gltf.nodes || [];
  const skins = gltf.skins || [];
  const animations = gltf.animations || [];
  const materials = gltf.materials || [];

  let triangles = 0;
  let morphTargets = 0;
  for (const mesh of meshes) {
    for (const prim of mesh.primitives || []) {
      if (typeof prim.indices === 'number' && accessors[prim.indices]) {
        triangles += Math.floor(accessors[prim.indices].count / 3);
      } else if (prim.attributes && typeof prim.attributes.POSITION === 'number' && accessors[prim.attributes.POSITION]) {
        triangles += Math.floor(accessors[prim.attributes.POSITION].count / 3);
      }
      if (Array.isArray(prim.targets)) {
        morphTargets = Math.max(morphTargets, prim.targets.length);
      }
    }
  }

  let bones = 0;
  for (const skin of skins) {
    if (Array.isArray(skin.joints)) {
      bones += skin.joints.length;
    }
  }

  const markerPrefixes = ['SPAWN_', 'TRG_', 'INT_', 'CAM_', 'PATH_', 'COL_', 'SLOT_', 'LAMP_', 'VISTA_ANCHOR', 'SOCKET_'];
  const markers = [];
  for (const node of nodes) {
    const name = node.name || '';
    if (markerPrefixes.some((p) => name.startsWith(p))) {
      markers.push(name);
    }
  }

  return {
    file: path.basename(filePath),
    bytes: buf.length,
    triangles,
    meshes: meshes.length,
    nodes: nodes.length,
    materials: materials.map((m) => m.name),
    bones,
    morphTargets,
    animations: animations.map((a) => a.name),
    markers,
  };
}

function main() {
  const args = process.argv.slice(2);
  const defaultDir = path.resolve('public/assets/models');
  const files =
    args.length > 0
      ? args
      : fs
          .readdirSync(defaultDir)
          .filter((f) => f.endsWith('.glb'))
          .sort()
          .map((f) => path.join(defaultDir, f));

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exitCode = 1;
      continue;
    }
    const info = parseGlbSummary(file);
    console.log(
      `[inspect-glb] ${info.file} (${(info.bytes / 1024).toFixed(1)} KB): tris=${info.triangles}, meshes=${info.meshes}, bones=${info.bones}, morphs=${info.morphTargets}, anims=${info.animations.length}, markers=${info.markers.length}`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
