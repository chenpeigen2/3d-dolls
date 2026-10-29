/**
 * 调试：移动视口下热区点击为何没命中。
 */
import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({ ...devices['Pixel 5'] });
const page = await context.newPage();

await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(
  () => Boolean(window.__frogDebug?.scene.getObjectByName('BowTie')),
  undefined,
  { timeout: 30_000 },
);
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const debug = window.__frogDebug;
  const bow = debug.scene.getObjectByName('BowTie');
  const box = new debug.THREE.Box3().setFromObject(bow);
  const world = box.getCenter(new debug.THREE.Vector3());
  world.project(debug.camera);
  const rect = debug.gl.domElement.getBoundingClientRect();
  const x = rect.left + ((world.x + 1) / 2) * rect.width;
  const y = rect.top + ((1 - world.y) / 2) * rect.height;
  const element = document.elementFromPoint(x, y);
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    canvasRect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },
    click: { x, y },
    elementAtPoint: element ? `${element.tagName}.${element.className}` : null,
  };
});

console.log(info);

await page.mouse.click(info.click.x, info.click.y);
await page.waitForTimeout(1200);
console.log('card visible:', await page.getByRole('dialog', { name: /材质介绍/ }).isVisible().catch(() => false));

await browser.close();
