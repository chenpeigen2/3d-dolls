/**
 * 检查 GLB 的节点结构，用于核对网页端的节点契约。
 *
 * 用法：npx tsx scripts/inspect-glb.mts [文件路径...]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
  });

const files = process.argv.slice(2);
if (files.length === 0) {
  files.push('assets/source/frog-v1.glb', 'public/models/frog-v1.glb');
}

for (const file of files) {
  const document = await io.read(file);
  const root = document.getRoot();

  console.log('---', file);
  console.log('nodes:', root.listNodes().map((node) => node.getName() || '(未命名)').join(', '));
  const extras = root
    .listNodes()
    .filter((node) => !node.getExtras().hotspotId === false)
    .map((node) => `${node.getName()}:${JSON.stringify(node.getExtras())}`)
    .filter((entry) => !entry.endsWith('{}'));
  console.log('extras:', extras.join(' | ') || '(无)');
  console.log('meshes:', root.listMeshes().map((mesh) => mesh.getName()).join(', '));
  console.log('materials:', root.listMaterials().map((material) => material.getName()).join(', '));
  console.log('textures:', root.listTextures().length);
  console.log('extensions:', root.listExtensionsUsed().join(', '));
}
