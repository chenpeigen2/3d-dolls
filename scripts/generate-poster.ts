/**
 * 生成首屏海报与兜底图。
 *
 * 从原始照片裁出主体区域，导出 AVIF / WebP 两档，
 * 避免在运行时直接加载 264KB 的原图。
 *
 * 用法：npm run assets:poster
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, '3d娃娃.jpeg');
const outputDir = resolve(root, 'public/images');

/** 原图中娃娃主体的大致范围（相对整图的比例） */
const CROP = {
  left: 0.14,
  top: 0.24,
  width: 0.72,
  height: 0.72,
};

async function main() {
  if (!existsSync(source)) {
    console.error(`找不到源图片：${source}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(outputDir, { recursive: true });

  const image = sharp(source);
  const meta = await image.metadata();
  const width = meta.width ?? 1206;
  const height = meta.height ?? 1913;

  const region = {
    left: Math.round(width * CROP.left),
    top: Math.round(height * CROP.top),
    width: Math.round(width * CROP.width),
    height: Math.round(height * CROP.height),
  };

  const resized = await sharp(source).extract(region).resize({ width: 900, withoutEnlargement: true });

  await resized.clone().avif({ quality: 62, effort: 6 }).toFile(resolve(outputDir, 'frog-poster.avif'));
  await resized.clone().webp({ quality: 78 }).toFile(resolve(outputDir, 'frog-poster.webp'));
  await resized.clone().jpeg({ quality: 82, progressive: true }).toFile(resolve(outputDir, 'frog-poster.jpg'));

  console.log('海报已生成：');
  for (const name of ['frog-poster.avif', 'frog-poster.webp', 'frog-poster.jpg']) {
    const { size } = await sharp(resolve(outputDir, name)).toBuffer().then((buffer) => ({ size: buffer.length }));
    console.log(`  ${name}  ${(size / 1024).toFixed(1)} KB`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
