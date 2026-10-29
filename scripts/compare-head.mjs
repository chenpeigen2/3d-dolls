/**
 * 生成「原图 vs 模型」的头部对比图，方便快速判断还原度。
 * 用法：node scripts/compare-head.mjs
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'assets', 'preview', 'reference');

await mkdir(outDir, { recursive: true });

const HEIGHT = 520;

const original = await sharp(resolve(root, '3d娃娃.jpeg'))
  .extract({ left: 170, top: 560, width: 860, height: 420 })
  .resize({ height: HEIGHT })
  .toBuffer();

const model = await sharp(resolve(root, 'assets', 'preview', 'frog-front.png'))
  .extract({ left: 170, top: 430, width: 570, height: 270 })
  .resize({ height: HEIGHT })
  .toBuffer();

const originalMeta = await sharp(original).metadata();
const modelMeta = await sharp(model).metadata();
const width = originalMeta.width + modelMeta.width + 24;

await sharp({
  create: { width, height: HEIGHT + 64, channels: 4, background: '#f2ece2' },
})
  .composite([
    { input: original, left: 0, top: 64 },
    { input: model, left: originalMeta.width + 24, top: 64 },
    {
      input: Buffer.from(
        `<svg width="${width}" height="48"><text x="12" y="32" font-size="24" fill="#4a4238">原图</text>` +
          `<text x="${originalMeta.width + 36}" y="32" font-size="24" fill="#4a4238">模型</text></svg>`,
      ),
      left: 0,
      top: 0,
    },
  ])
  .png()
  .toFile(resolve(outDir, 'head-compare.png'));

console.log('saved', resolve(outDir, 'head-compare.png'));
