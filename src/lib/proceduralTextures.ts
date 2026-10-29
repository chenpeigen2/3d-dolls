import * as THREE from 'three';

/**
 * 程序化纹理：在没有烘焙贴图的阶段，用 Canvas 2D 生成布料图案，
 * 让代理模型也能体现棉麻、牛仔与格纹的差异。
 * 正式的 Blender 模型到位后，这些函数可整体移除。
 */

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 2D 绘图上下文');
  return { canvas, ctx };
}

/** 生成格纹布纹理（蝴蝶结用）。 */
export function createPlaidTexture(
  base = '#7d3b30',
  accent = '#d8c6a8',
  accent2 = '#4d241f',
  size = 256,
): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const band = size / 8;
  ctx.globalAlpha = 0.85;

  for (let i = 0; i < size; i += band * 2) {
    ctx.fillStyle = accent;
    ctx.fillRect(i, 0, band, size);
    ctx.fillRect(0, i, size, band);
  }

  ctx.globalAlpha = 0.65;
  ctx.fillStyle = accent2;
  const thin = Math.max(1, size / 64);
  for (let i = 0; i < size; i += band * 2) {
    ctx.fillRect(i + band, 0, thin, size);
    ctx.fillRect(0, i + band, size, thin);
  }

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 生成牛仔布纹理：靛蓝底色 + 斜纹织理 + 白色缝线。 */
export function createDenimTexture(size = 512): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = '#3f5c86';
  ctx.fillRect(0, 0, size, size);

  // 斜纹织理
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#dfe8f5';
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  // 白色装饰缝线
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#f2f5fa';
  ctx.lineWidth = Math.max(2, size / 128);
  ctx.setLineDash([size / 22, size / 26]);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.18);
  ctx.lineTo(size, size * 0.18);
  ctx.moveTo(0, size * 0.82);
  ctx.lineTo(size, size * 0.82);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 生成棉麻布料的粗糙度贴图，让表面呈现不均匀的纤维质感。 */
export function createFabricRoughness(size = 256, base = 0.92): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const weave = (Math.sin(x * 1.6) + Math.sin(y * 1.6)) * 6;
      const noise = (Math.random() - 0.5) * 22;
      const value = Math.max(0, Math.min(255, (base + weave / 255 + noise / 255) * 255));
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}
