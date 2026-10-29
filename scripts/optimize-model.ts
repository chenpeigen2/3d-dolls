/**
 * GLB 优化脚本：清理无用属性、压缩几何与纹理、应用 Meshopt 压缩。
 *
 * 用法：npm run assets:model
 * 输入：assets/source/frog-v1.glb
 * 输出：public/models/frog-v1.glb
 */
import { existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

declare module 'meshoptimizer';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const input = resolve(root, 'assets/source/frog-v1.glb');
const outputDir = resolve(root, 'public/models');
const output = resolve(outputDir, 'frog-v1.glb');

async function main() {
  if (!existsSync(input)) {
    console.error(`找不到模型源文件：${input}`);
    console.error('请先用 Blender 导出 GLB 到 assets/source/frog-v1.glb 后再运行本脚本。');
    process.exitCode = 1;
    return;
  }

  await mkdir(outputDir, { recursive: true });
  await MeshoptEncoder.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    // meshopt 压缩扩展需要显式注册编码器，否则写出阶段会失败
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
    });

  const document = await io.read(input);

  await document.transform(
    dedup(),
    // keepExtras 必须开启：热点标记（hotspotId）保存在节点 extras 里
    prune({ keepExtras: true }),
    weld(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [2048, 2048],
    }),
    meshopt({
      encoder: MeshoptEncoder,
      level: 'high',
    }),
  );

  await io.write(output, document);

  const { size } = await stat(output);
  const { size: sourceSize } = await stat(input);
  console.log(`模型已优化：${(sourceSize / 1024 / 1024).toFixed(2)} MB → ${(size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
