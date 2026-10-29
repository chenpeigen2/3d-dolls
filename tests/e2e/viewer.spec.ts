import { expect, test } from '@playwright/test';

/**
 * 端到端测试：验证生产构建下的加载、UI 操作与失败兜底。
 * 由于 CI 常用软件渲染 WebGL，此处只断言 DOM 层面的可见行为。
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '丑萌青蛙挂件' })).toBeVisible();
});

test('页面加载后渲染 3D 画布与工具栏', async ({ page }) => {
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: '复位视角' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看操作说明' })).toBeVisible();
});

test('操作说明面板可以打开与关闭', async ({ page }) => {
  const helpButton = page.getByRole('button', { name: '查看操作说明' });
  await helpButton.click();

  const dialog = page.getByRole('dialog', { name: '操作说明' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('拖动画面');

  await page.getByRole('button', { name: '关闭操作说明' }).click();
  await expect(dialog).toBeHidden();
});

test('复位按钮可点击且页面保持稳定', async ({ page }) => {
  await page.getByRole('button', { name: '复位视角' }).click();

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: '复位视角' })).toBeEnabled();
});

test('模型请求失败时展示海报兜底与重试入口', async ({ page }) => {
  // 先关掉浏览器缓存：否则刷新时模型会直接从缓存命中，拦截不到请求
  const client = await page.context().newCDPSession(page);
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });

  await page.route('**/*.glb', (route) => route.abort());

  await page.reload();
  await expect(page.getByRole('heading', { name: '丑萌青蛙挂件' })).toBeVisible();

  // 模型预检失败 → 显示静态海报、可读说明与重试按钮，而不是白屏
  const fallback = page.getByRole('alert');
  await expect(fallback).toBeVisible({ timeout: 20_000 });
  await expect(fallback).toContainText('实拍图片');
  await expect(fallback.getByRole('img')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();

  // 失败时不应残留空画布
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('交互热区点击后出现材质介绍卡片', async ({ page }) => {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // 等待模型节点进入场景树（模型是异步加载的）
  await page.waitForFunction(
    () => {
      const debug = (window as unknown as { __frogDebug?: any }).__frogDebug;
      return Boolean(debug?.scene.getObjectByName('BowTie'));
    },
    undefined,
    { timeout: 30_000 },
  );

  // 等相机适配与首帧渲染稳定，否则算出的屏幕坐标会失效
  await page.waitForTimeout(1500);

  // 先在画布上移动指针：交互会立即停掉空闲自转，模型不再移动
  const canvasBox = await canvas.boundingBox();
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.waitForTimeout(500);
  }

  const card = page.getByRole('dialog', { name: /材质介绍/ });

  // 模型在空闲时会缓慢自转：每次都重新计算热区屏幕坐标，
  // 并先用射线检测确认该点真的落在带热区标记的节点上，再执行点击。
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const target = await page.evaluate(() => {
      const debug = (window as unknown as { __frogDebug?: any }).__frogDebug;
      if (!debug) return null;
      const bow = debug.scene.getObjectByName('BowTie');
      if (!bow) return null;

      // 节点原点不一定在模型中心，用包围盒中心更可靠
      const box = new debug.THREE.Box3().setFromObject(bow);
      const world = box.getCenter(new debug.THREE.Vector3());
      world.project(debug.camera);

      const rect = debug.gl.domElement.getBoundingClientRect();
      const ndc = new debug.THREE.Vector2(world.x, world.y);
      const raycaster = new debug.THREE.Raycaster();
      raycaster.setFromCamera(ndc, debug.camera);
      const hits = raycaster.intersectObjects(debug.scene.children, true);
      const onHotspot = hits.some((hit) => {
        let node: any = hit.object;
        while (node) {
          if (node.userData?.hotspotId) return true;
          node = node.parent;
        }
        return false;
      });

      return {
        x: rect.left + ((world.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - world.y) / 2) * rect.height,
        onHotspot,
      };
    });

    expect(target).not.toBeNull();

    if (target?.onHotspot) {
      await page.mouse.click(target.x, target.y);
    }

    if (await card.isVisible().catch(() => false)) break;
    await page.waitForTimeout(400);
  }

  await expect(card).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: '关闭材质介绍' }).click();
  await expect(card).toBeHidden();

  await expect(page.getByRole('button', { name: '复位视角' })).toBeEnabled();
});
