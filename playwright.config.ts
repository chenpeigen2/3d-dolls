import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 配置：针对生产构建产物运行，确保验证的是实际发布的页面。
 * WebGL 在 CI 中可能使用软件渲染，帧率不在此处作为验收依据。
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // 软件渲染环境下并行过高会拖垮帧率，导致基于屏幕坐标的交互断言不稳定
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-edge',
      // 使用系统安装的 Edge，避免额外下载浏览器内核
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
    {
      name: 'mobile-edge',
      use: { ...devices['Pixel 5'], channel: 'msedge' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
