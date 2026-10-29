/**
 * 裁切原图局部并放大，便于观察细节。
 * 用法：node scripts/crop-reference.mjs <输出名> <left> <top> <width> <height> [放大倍数]
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'assets', 'preview', 'reference');

const [name, left, top, width, height, scale = '2'] = process.argv.slice(2);

await mkdir(outDir, { recursive: true });

await sharp(resolve(root, '3d娃娃.jpeg'))
  .extract({
    left: Number(left),
    top: Number(top),
    width: Number(width),
    height: Number(height),
  })
  .resize({ width: Math.round(Number(width) * Number(scale)) })
  .png()
  .toFile(resolve(outDir, `${name}.png`));

console.log('saved', resolve(outDir, `${name}.png`));
