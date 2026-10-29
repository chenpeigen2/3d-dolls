/**
 * 从用户提供的原图干净区域提取织物高频细节，生成可平铺 BaseColor。
 * 只处理本项目自有照片，不下载或使用第三方贴图。
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const jobs = [
  {
    name: 'fabric_photo_basecolor',
    region: { left: 490, top: 680, width: 190, height: 160 },
    target: [96, 139, 53],
    detail: 1.05,
  },
  {
    name: 'denim_photo_basecolor',
    region: { left: 390, top: 1360, width: 140, height: 150 },
    target: [43, 72, 116],
    detail: 1.18,
  },
];

await mkdir('assets/textures-source', { recursive: true });

for (const job of jobs) {
  const { data, info } = await sharp('3d娃娃.jpeg')
    .extract(job.region)
    .resize(256, 256, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blurred = await sharp(data, { raw: info }).blur(7).raw().toBuffer();
  const highPass = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += 1) {
    const channel = i % 3;
    const value = job.target[channel] + (data[i] - blurred[i]) * job.detail;
    highPass[i] = Math.max(0, Math.min(255, Math.round(value)));
  }

  // 将四边的小范围颜色向对侧边缘平滑过渡，降低连续平铺时的接缝。
  const periodic = Buffer.from(highPass);
  const margin = 20;
  for (let i = 0; i < 256; i += 1) {
    for (let m = 0; m < margin; m += 1) {
      const weight = (1 - m / margin) * 0.5;
      for (let channel = 0; channel < info.channels; channel += 1) {
        const left = (i * 256 + m) * info.channels + channel;
        const right = (i * 256 + 255 - m) * info.channels + channel;
        const horizontalAverage = (highPass[left] + highPass[right]) / 2;
        periodic[left] = Math.round(highPass[left] * (1 - weight) + horizontalAverage * weight);
        periodic[right] = Math.round(highPass[right] * (1 - weight) + horizontalAverage * weight);

        const top = (m * 256 + i) * info.channels + channel;
        const bottom = ((255 - m) * 256 + i) * info.channels + channel;
        const verticalAverage = (highPass[top] + highPass[bottom]) / 2;
        periodic[top] = Math.round(highPass[top] * (1 - weight) + verticalAverage * weight);
        periodic[bottom] = Math.round(highPass[bottom] * (1 - weight) + verticalAverage * weight);
      }
    }
  }

  // 连续平铺，不使用镜像，避免在曲面上出现万花筒式对称花纹。
  const tileSize = 512;
  const tiled = Buffer.alloc(tileSize * tileSize * info.channels);
  for (let y = 0; y < tileSize; y += 1) {
    const sourceY = y % 256;
    for (let x = 0; x < tileSize; x += 1) {
      const sourceX = x % 256;
      const sourceIndex = (sourceY * 256 + sourceX) * info.channels;
      const targetIndex = (y * tileSize + x) * info.channels;
      for (let channel = 0; channel < info.channels; channel += 1) {
        tiled[targetIndex + channel] = periodic[sourceIndex + channel];
      }
    }
  }

  await sharp(tiled, { raw: { width: 512, height: 512, channels: info.channels } })
    .resize(1024, 1024)
    .png()
    .toFile(`assets/textures-source/${job.name}.png`);

  console.log(`generated ${job.name}.png`);
}
