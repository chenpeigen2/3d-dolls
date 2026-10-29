# 3D 布艺青蛙挂件 · 网页版

基于单张实拍照片重建的 3D 布艺青蛙挂件展示页。React + TypeScript + Three.js（R3F）实现，
包含可复用的 `FrogViewer` 查看器组件、程序化生成的布艺材质，以及 Blender 重建的 GLB 模型。

> 项目定位：**基于照片的艺术化三维重建**，非实物扫描，不宣称尺寸与背面结构等同于实物。

> 只想把它跑起来？直接看 **[STARTUP.md](./STARTUP.md)**（启动文档）。

---

## 快速开始

```bash
npm install
npm run dev            # 本地开发（Vite，默认 5173）
npm run build          # 类型检查 + 生产构建到 dist/
npm run preview        # 预览生产构建
npm test               # Vitest 单元与组件测试（70 个用例）
npm run test:e2e       # Playwright 端到端测试（桌面 + 移动双视口）
npm run assets:model:build   # 在 Blender 中重建模型并导出 GLB
npm run assets:model         # 压缩优化 GLB → public/models/
npm run assets:preview       # 渲染建模预览图
npm run verify:visual        # 用系统浏览器截图，验证网页渲染
npm run inspect:model        # 打印 GLB 节点/材质/纹理结构
```

E2E 使用系统安装的 Edge（`channel: 'msedge'`），无需额外下载浏览器内核；
如需改用 Chromium，安装浏览器后修改 `playwright.config.ts` 的 `channel` 即可。

## 目录结构

```text
3d娃娃/
├── 3d娃娃.jpeg                       原始参考照片（只读，勿修改）
├── 3D娃娃网页版-详细计划说明书.md      项目计划与验收标准
├── STARTUP.md                        启动文档：安装、启动、常见问题、部署
├── README.md                         项目总览与功能说明
├── assets/
│   ├── source/Frog.blend             Blender 可编辑源文件
│   ├── source/frog-v1.glb            未优化导出（供优化脚本输入）
│   ├── textures-source/              程序化生成的源贴图
│   ├── references/                   参考图板与来源记录
│   └── preview/                      建模阶段的正/侧面渲染图
├── public/
│   ├── images/frog-poster.*          首屏海报（AVIF / WebP / JPEG）
│   └── models/frog-v1.glb            优化后的线上模型
├── scripts/
│   ├── blender/build_frog.py         Blender 建模与导出脚本
│   ├── blender/texture_gen.py        程序化贴图生成
│   ├── blender/render_preview.py     建模预览渲染
│   ├── blender/blender.mjs           自动定位 Blender 可执行文件的包装器
│   ├── generate-poster.ts            从原图生成海报
│   ├── optimize-model.ts             GLB 压缩优化
│   ├── inspect-glb.mts               打印 GLB 节点/材质/纹理结构
│   ├── screenshot.mjs                用系统浏览器截图，验证网页渲染与热区
│   ├── diagnose-optimize.mts         逐步应用优化 transform，排查节点丢失
│   └── debug-fallback.mjs            模拟模型加载失败，验证海报兜底
├── src/
│   ├── app/App.tsx                   全屏页面
│   ├── components/viewer/            3D 查看器（Canvas / 场景 / 模型 / 动画 / 拾取）
│   ├── components/ui/                HTML 覆盖层（加载、兜底、工具栏、材质卡片）
│   ├── hooks/                        空闲状态、减少动态效果、画质档位
│   ├── lib/                          相机适配、动画插值、WebGL 探测、程序化贴图
│   ├── styles/                       全局样式
│   └── config.ts                     资源路径常量
└── tests/
    ├── unit/                         Vitest 单元与组件测试
    └── e2e/                          Playwright 端到端测试
```

## 模型重建流程

模型不是手工拖拽建模，而是**用脚本在 Blender 中程序化重建**，因此可以稳定复现与批量调参。

```bash
# 1. 生成贴图 + 建模 + 导出 GLB 与 .blend
npm run assets:model:build

# 2. 渲染正/侧面预览，用于和原图比对
npm run assets:preview

# 3. 压缩优化，输出到 public/models/frog-v1.glb
npm run assets:model
```

`scripts/blender/blender.mjs` 会自动定位本机 Blender（`BLENDER_PATH` → Program Files → PATH），
当前环境为 Blender 5.2.3 LTS。

### 节点契约（网页与资产之间的约定）

GLB 与代码内置的代理模型使用同一套节点命名，替换模型时网页逻辑无需改动：

| 节点 | 用途 |
|---|---|
| `FrogRoot` | 根节点，相机适配依据它的包围盒 |
| `SuspensionPivot` | 顶部悬挂点，闲置摆动绕此旋转 |
| `FrogAssembly` | 主体装配节点 |
| `Head` | 上唇片：横跨整个宽度的扁布片，中间鼓起圆丘 |
| `MouthJaw` | 下颚：缝合线下方的厚布片，最低处垂到 z ≈ 0.78 |
| `MouthSeam` | 嘴部缝合线：深色滚边，标示上下两片的拼接 |
| `Body` | 躯干 |
| `Eye.L` / `Eye.R` | 眼球（含眼珠），眨眼动画作用于其 Y 轴缩放 |
| `Eyelid.L` / `Eyelid.R` | 眼眶抽褶布环 |
| `BowTie` / `Pants` | 蝴蝶结与裤子，服饰点击回弹作用于其缩放 |
| `Suspenders` / `Buckles` | 背带与调节扣 |
| `Foot.L` / `Foot.R` | 脚掌 |
| `Rope` / `MetalRing` / `LeatherTag` | 皮绳、金属环、皮质标签 |

模型加载后会校验 `FrogRoot`、`SuspensionPivot`、`Body` 三个必需节点；缺失时抛出可读错误，
由页面降级为程序化代理模型，而不是"能加载但不能互动"。

> **节点名注意事项**：three.js 在构建场景树时会用 `PropertyBinding.sanitizeNodeName` 清理节点名，
> 其中的 `.` 会被去掉（`Eye.L` → `EyeL`）。网页侧通过 `src/components/viewer/rig.ts` 的
> `findNode()` 同时尝试原始名与清理后的名字，保证与 Blender 导出的命名契约一致。

### 模型加载流程

```text
检测 WebGL
  ├── 不支持 → 静态海报 + 说明
  └── 支持
       → 预检模型：fetch GLB → 解析文件头与 JSON 区块 → 校验必需节点
           ├── 请求失败 / 缺少节点 → 静态海报 + 说明 + 重试按钮
           └── 通过
                → 挂载 Canvas，加载 GLB，渲染
                    ├── 用户操作
                    ├── 闲置动画（自动环绕 + 悬挂摆动）
                    └── 局部点击反馈
```

预检发生在把模型交给 Three.js **之前**，因此模型出错不会把整个 R3F 渲染树带崩，
用户始终能看到海报兜底与重试入口，而不是白屏。

### 坐标与单位

- Blender 为 Z 向上、娃娃正面朝 -Y；导出 glTF 时转换为 **Y 向上、正面朝 +Z**。
- 场景单位：约 1000 像素 = 1 单位，娃娃本体高约 1.25 单位，含皮绳整体约 1.87 单位。
- 未获得实物测量数据，因此不对应任何真实厘米尺寸。

## 查看器组件

```tsx
import { FrogViewer } from './components/viewer/FrogViewer';

<FrogViewer
  modelUrl="./models/frog-v1.glb"   // 传 null 时使用内置程序化代理模型
  posterUrl="./images/frog-poster.webp"
  quality="auto"                    // 'auto' | 'high' | 'medium' | 'low'
  autoRotate
  onReady={() => {}}
  onError={(error) => {}}
/>
```

组件自适应父容器尺寸，不强制全屏；卸载时释放 GPU 资源。

### 交互

| 交互 | 桌面端 | 移动端 |
|---|---|---|
| 旋转 | 左键拖动 | 单指拖动 |
| 缩放 | 滚轮 | 双指 |
| 复位 | 双击 / 右下角按钮 | 复位按钮 |
| 局部反馈 | 点击眼睛、身体、蝴蝶结、裤子 | 同左 |

闲置后自动缓慢环绕并轻微悬挂摆动；用户操作时立即停止，`prefers-reduced-motion` 下默认全部关闭。

## 性能预算与降级

| 项目 | 目标 | 当前 |
|---|---|---|
| GLB + 纹理体积 | ≤ 12 MB | **2.95 MB**（原始导出 17.03 MB，Meshopt + WebP 压缩） |
| 可见三角形 | ≤ 100k | 见 `npm run verify:visual` 与浏览器 `renderer.info` |
| 主要材质数量 | 10～12 组 | 10 组 |
| 首屏海报 | ≤ 200 KB | AVIF 146 KB / WebP 203 KB / JPEG 248 KB |

降级顺序：DPR → 阴影 → 环境贴图分辨率 → 纹理质量 → 停止闲置动画 → 静态海报模式。
画质档位由 `useQualityTier` 依据设备能力推断，并在帧率持续偏低时自动降一级。

> 调试探针：页面在 `window.__frogDebug` 上暴露了相机与场景对象，
> `npm run verify:visual` 用它做射线拾取诊断，排查热区问题时很有用。

## 部署

产物是纯静态 SPA，不依赖后端。

```bash
npm run build
# 将 dist/ 部署到任意静态托管
```

- `vite.config.ts` 中 `base: './'`，可直接部署到子目录。
- 所有资源使用相对路径，GLB、海报与脚本在子目录下同样可正确解析。
- `index.html` 不缓存，带哈希的 JS/CSS/GLB 可设置长期缓存。
- 部署后务必访问**生产构建**验证，而不是只看开发服务器。

## 已知限制

- 侧面与背面依据照片推断补全，未取得实物多角度照片，可能与实物存在偏差。
- 布料纤维为程序化贴图，近距离观察不会呈现真实织物的随机瑕疵。
- 抽褶眼眶为几何模拟，褶皱数量与实物不完全一致。
- 真实设备帧率未在 iPhone / Android 上实测验收，需按计划书第 11.4 节补测。
- 页面未做实物尺度对照，不提供"实际大小"参考。

详细验收结论见 [`ACCEPTANCE.md`](./ACCEPTANCE.md)，其中记录了每一条检查项的状态、
实测数据，以及本轮修复的缺陷清单。

## 已知限制之外的下一步

换装配置、更高精度的近景渲染、AR 展示，以及按实物照片重新校准侧面与背面。
