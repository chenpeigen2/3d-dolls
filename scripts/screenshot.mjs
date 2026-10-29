/**
 * 本地视觉验证脚本：加载生产构建页面，截图并回收控制台错误。
 *
 * 用法：node scripts/screenshot.mjs [输出目录]
 * 需要先启动预览服务（npm run preview -- --port 4173）。
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'assets', 'preview', 'web');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });

const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForSelector('canvas', { timeout: 30_000 });
// 等待模型加载与首帧渲染
await page.waitForTimeout(6000);

const probe = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const debug = window.__frogDebug;
  let camera = null;
  try {
    if (debug?.camera) {
      camera = {
        fov: debug.camera.fov,
        aspect: debug.camera.aspect,
        position: debug.camera.position.toArray().map((v) => +v.toFixed(3)),
        rotationY: +debug.camera.rotation.y.toFixed(3),
      };
    }
  } catch (error) {
    camera = `error: ${error.message}`;
  }
  return {
    distance: document.documentElement.dataset.frogFitDistance,
    box: document.documentElement.dataset.frogFitBox,
    aspect: document.documentElement.dataset.frogFitAspect,
    canvas: canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null,
    camera,
  };
});
console.log('fit probe:', probe);

await page.screenshot({ path: resolve(outDir, 'web-front.png') });

// 点击眼睛热区，检查材质卡片
const canvas = page.locator('canvas');
const box = await canvas.boundingBox();
if (box) {
  // 动态定位眼睛：模型会缓慢自转，固定坐标会随时间偏移
  const target = await page.evaluate(() => {
    const debug = window.__frogDebug;
    if (!debug) return null;
    const { THREE, camera, scene } = debug;
    const eye = scene.getObjectByName('EyeL') ?? scene.getObjectByName('Eye.L');
    if (!eye) return null;
    const box = new THREE.Box3().setFromObject(eye);
    const world = box.getCenter(new THREE.Vector3());
    world.project(camera);
    const rect = debug.gl.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((world.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - world.y) / 2) * rect.height,
    };
  });

  const clickX = target ? target.x : box.x + box.width * 0.4;
  const clickY = target ? target.y : box.y + box.height * 0.44;

  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(outDir, 'web-eye-click.png') });
  const cardVisible = await page
    .getByRole('dialog', { name: /材质介绍/ })
    .isVisible()
    .catch(() => false);
  console.log('material card visible:', cardVisible);
}

// 空闲自动旋转后再截一张
await page.waitForTimeout(5000);
await page.screenshot({ path: resolve(outDir, 'web-rotated.png') });

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
