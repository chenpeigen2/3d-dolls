/**
 * 调试脚本：模拟模型请求失败，观察页面状态与网络请求。
 */
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });

page.on('console', (message) => console.log(`[console:${message.type()}]`, message.text()));
page.on('pageerror', (error) => console.log('[pageerror]', error.message));
page.on('requestfailed', (request) =>
  console.log('[failed]', request.url(), request.failure()?.errorText),
);
page.on('response', (response) => {
  if (response.status() >= 400) console.log('[http]', response.status(), response.url());
});

await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForTimeout(2000);

console.log('--- 注册拦截并刷新 ---');
await page.route('**/*.glb', (route) => route.abort());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);

console.log(
  'stage text:',
  await page.locator('main').innerText().catch(() => '(读取失败)'),
);
console.log('canvas count:', await page.locator('canvas').count());
console.log('alert count:', await page.getByRole('alert').count());

await browser.close();
