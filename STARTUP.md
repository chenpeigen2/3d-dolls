# 启动文档

从零把项目跑起来，以及日常开发、验证、部署的操作手册。

---

## 1. 环境要求

| 依赖 | 版本 | 必需 | 说明 |
|---|---|---|---|
| Node.js | ≥ 20.19（推荐 22/24） | ✅ | Vite 8 的最低要求；本机验证于 24.22.1 |
| npm | ≥ 10 | ✅ | 随 Node 安装 |
| Blender | ≥ 4.2（推荐 5.2 LTS） | ❌ | 仅重建模型时需要；本机为 5.2.3 LTS |
| Edge / Chrome | 任意近期版本 | ❌ | 仅 E2E 测试使用；测试默认走系统 Edge |

检查环境：

```bash
node -v
npm -v
```

> Blender 仅在修改 `scripts/blender/` 下的建模脚本时才用得上。只改网页代码的话，装 Node 就够了。

---

## 2. 首次安装

```bash
cd D:\code\3d娃娃
npm install
```

装完依赖后目录里会多出 `node_modules/`（已在 `.gitignore` 中忽略）。

---

## 3. 启动网页

### 3.1 开发模式（日常改代码用这个）

```bash
npm run dev
```

打开 **http://localhost:5173** —— 改代码自动热更新，浏览器刷新即可看到效果。

### 3.2 生产预览（验证打包后的真实效果）

```bash
npm run build      # 类型检查 + 打包到 dist/
npm run preview    # 打开 http://localhost:4173
```

`dist/` 才是真正要部署的东西，别用开发服务器验收。

### 3.3 手机 / 局域网访问

开发服务器默认只监听本机。需要手机看时：

```bash
npm run dev -- --host
```

终端会打印一个 `Network` 地址（形如 `http://192.168.1.23:5173`），手机连同一个 WiFi 打开它即可。生产预览同理：

```bash
npm run preview -- --host
```

### 3.4 临时公开访问（给外部同事看）

```bash
npm run build
npx vite preview --host
```

终端会给出 Network 地址。注意：这是临时进程，关掉即失效，且服务的是本机内容。

---

## 4. 常用命令速查

| 命令 | 作用 | 备注 |
|---|---|---|
| `npm run dev` | 开发服务器（5173） | 支持热更新 |
| `npm run build` | 类型检查 + 生产构建 | 输出到 `dist/` |
| `npm run preview` | 预览生产构建（4173） | 需先 build |
| `npm run typecheck` | 只跑 TypeScript 类型检查 | 改 `.ts`/`.tsx` 后可快速验证 |
| `npm test` | Vitest 单元与组件测试（70 例） | 改逻辑后必跑 |
| `npm run test:watch` | 单元测试监听模式 | 开发时用 |
| `npm run test:e2e` | Playwright 端到端测试（10 例） | 桌面 + 移动双视口 |
| `npm run assets:model:build` | 在 Blender 中重建模型并导出 GLB | 改了建模脚本才需要 |
| `npm run assets:preview` | 渲染模型正/侧面预览图 | 输出到 `assets/preview/` |
| `npm run assets:model` | 压缩优化 GLB → `public/models/` | 重建模型后必跑 |
| `npm run assets:poster` | 从原图重新生成首屏海报 | 换了原图才需要 |
| `npm run verify:visual` | 用系统浏览器截图并验证热区 | 需要先起 preview |
| `npm run inspect:model` | 打印 GLB 的节点/材质/纹理结构 | 排查节点契约问题 |

---

## 5. 目录速查

```text
3d娃娃/
├── 3d娃娃.jpeg            原始参考照片（只读）
├── index.html             入口 HTML
├── vite.config.ts         构建配置（base: './'，可部署到子目录）
├── public/
│   ├── models/frog-v1.glb 线上模型（构建时会被复制进 dist/）
│   ├── images/            首屏海报（AVIF / WebP / JPEG）
│   └── favicon.svg
├── src/
│   ├── app/App.tsx        全屏页面
│   ├── components/viewer/ 3D 查看器（Canvas / 场景 / 模型 / 动画 / 拾取）
│   ├── components/ui/     HTML 覆盖层（加载、兜底、工具栏、材质卡片）
│   ├── hooks/             空闲状态、画质档位、减少动态效果、模型预检
│   ├── lib/               相机适配、动画插值、WebGL 探测、GLB 解析
│   └── config.ts          资源路径常量
├── scripts/
│   ├── blender/           建模脚本（Python，跑在 Blender 里）
│   └── *.ts / *.mjs       海报、优化、截图、诊断等工具
├── tests/
│   ├── unit/              Vitest
│   └── e2e/               Playwright
└── assets/                源资产（不进 git，见 .gitignore）
```

---

## 6. 改了模型之后要做什么

```bash
npm run assets:model:build   # 1. 重建模型 → assets/source/frog-v1.glb + Frog.blend
npm run assets:preview       # 2. 渲染预览图，自己比对原图
npm run assets:model         # 3. 压缩 → public/models/frog-v1.glb
npm run build                # 4. 重新打包网页
```

第 3 步不能跳过：`public/models/` 里的才是网页实际加载的文件。

重建后建议顺带跑一次校验：

```bash
npm run inspect:model        # 确认节点契约（FrogRoot / SuspensionPivot / Body）还在
npm run verify:visual        # 截图确认渲染与热区正常
```

---

## 7. 常见问题

**页面一直转圈 / 白屏**
按顺序排查：① 浏览器控制台有没有报错；② `public/models/frog-v1.glb` 是否存在（没跑 `npm run assets:model` 就没有）；③ 3D 引擎是懒加载的，等两秒再看。

**模型加载失败**
页面会显示原图海报 + 说明 + 「重新加载」按钮。模型请求失败时先看 DevTools 的 Network 面板里 `.glb` 请求的状态码。

**端口被占用**
```bash
npm run dev -- --port 5174
```

**E2E 测试报找不到浏览器**
测试用系统 Edge（`playwright.config.ts` 里的 `channel: 'msedge'`）。想改用自带 Chromium：先 `npx playwright install chromium`，再把 `channel` 删掉。

**E2E 热区点击用例偶发失败**
模型空闲时会缓慢自转，用例已经处理：先移动指针停掉自转、再用射线检测确认命中才点击。若仍失败，多半是机器负载过高，可把 `playwright.config.ts` 的 `workers` 调小。

**Blender 找不到**
`scripts/blender/blender.mjs` 按 `BLENDER_PATH` 环境变量 → `C:\Program Files\Blender Foundation\*` → PATH 的顺序找。装在别处时设置环境变量即可：

```bash
setx BLENDER_PATH "D:\Apps\Blender\blender.exe"
```

**改完样式没生效 / 3D 不动**
开发模式下热更新偶尔会让 R3F 状态错乱，硬刷新（Ctrl+Shift+R）即可。

---

## 8. 部署

产物是纯静态 SPA，不依赖后端。

```bash
npm run build
```

把 `dist/` 整个目录部署到任意静态托管即可。因为 `vite.config.ts` 里是 `base: './'`，部署到子目录（如 `https://example.com/frog/`）也能正常加载模型和海报。

缓存策略建议：

| 文件 | 缓存 |
|---|---|
| `index.html` | 不缓存 |
| `assets/*`（带哈希的 JS/CSS） | 长期强缓存 |
| `models/*.glb`、`images/*` | 版本化后长期缓存 |

部署后请访问**生产地址**验收，不要只看开发服务器。

---

## 9. 验收与文档

- 验收结论与已知缺陷：见 [`ACCEPTANCE.md`](./ACCEPTANCE.md)
- 资产来源与授权：见 [`ASSET_SOURCES.md`](./ASSET_SOURCES.md)
- 项目计划与验收标准：见 [`3D娃娃网页版-详细计划说明书.md`](./3D娃娃网页版-详细计划说明书.md)
- 完整功能说明：见 [`README.md`](./README.md)
