/**
 * 诊断：逐步应用优化 transform，观察哪一步会丢掉节点层级。
 *
 * 用法：npx tsx scripts/diagnose-optimize.mts
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const source = 'assets/source/frog-v1.glb';

async function names(label: string, document: Awaited<ReturnType<typeof io.read>>) {
  const list = document.getRoot().listNodes().map((node) => node.getName());
  console.log(`${label}: ${list.length} nodes -> ${list.join(', ')}`);
}

const document = await io.read(source);
await names('source', document);

await document.transform(dedup());
await names('after dedup', document);

await document.transform(prune());
await names('after prune', document);

await document.transform(weld());
await names('after weld', document);

// 打印层级
const root = document.getRoot();
for (const scene of root.listScenes()) {
  const walk = (node: ReturnType<typeof root.listNodes>[number], depth: number) => {
    console.log(`${'  '.repeat(depth)}${node.getName() || '(未命名)'}`);
    node.listChildren().forEach((child) => walk(child, depth + 1));
  };
  scene.listChildren().forEach((child) => walk(child, 0));
}
