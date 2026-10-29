# 资产来源与授权

本文件记录项目中所有第三方资产与自产资产的来源、许可与用途。
任何新增资产都必须同步更新本文件。

---

## 1. 自产资产

| 资产 | 路径 | 生成方式 | 授权 |
|---|---|---|---|
| 3D 模型（源文件） | `assets/source/Frog.blend` | `scripts/blender/build_frog.py` 程序化重建 | 项目自有 |
| 3D 模型（导出） | `assets/source/frog-v1.glb` | Blender glTF 导出 | 项目自有 |
| 3D 模型（线上） | `public/models/frog-v1.glb` | `scripts/optimize-model.ts` 压缩 | 项目自有 |
| 布料贴图 | `assets/textures-source/*.png` | `texture_gen.py` 程序化生成；`prepare-fabric-textures.mjs` 从项目原图干净区域提取织纹 | 见第 2 节原图授权说明 |
| 首屏海报 | `public/images/frog-poster.*` | `scripts/generate-poster.ts` 从原图裁切 | 见第 2 节 |
| 预览渲染图 | `assets/preview/*.png` | `scripts/blender/render_preview.py` | 项目自有 |

模型、贴图与代码均由本项目脚本生成，不包含任何第三方素材，因此不引入外部授权风险。

## 2. 参考照片

| 文件 | 说明 | 用途 |
|---|---|---|
| `3d娃娃.jpeg` | 原图款实拍照片，1206 × 1913 | 造型与配色参考；首屏海报裁切来源 |
| 本地 `assets/references/network/frog-00.jpg` ～ `frog-04.jpg` | 同一头部版型的卖家实物图，含不同服饰版本 | 上下唇、布眼、织纹与填充体积的内部参考；未确认授权，不纳入 Git 仓库或公开产物 |

该照片是实物照片，著作权归拍摄者/权利人所有。

- **内部使用**：用于三维重建的比例、配色与结构判断。
- **公开页面使用**：`public/images/frog-poster.*` 是该照片裁切压缩后的派生图像，
  用作 WebGL 不可用时的静态兜底图与首屏占位图。
- **注意**：若本项目用于商业宣传或公开发布，应先取得照片权利人的书面授权；
  派生图像同样受原照片权利约束。

## 3. 运行时第三方依赖

以下均为 npm 开源依赖，不随静态产物分发，仅参与构建：

| 依赖 | 用途 | 许可 |
|---|---|---|
| `three` | 3D 引擎 | MIT |
| `@react-three/fiber` | React 声明式 Three.js | MIT |
| `@react-three/drei` | GLTF 加载、OrbitControls、环境光 | MIT |
| `react` / `react-dom` | UI 框架 | MIT |
| `vite` / `@vitejs/plugin-react` | 构建 | MIT |
| `typescript` | 类型检查 | Apache-2.0 |
| `vitest` / `@testing-library/*` | 测试 | MIT |
| `@playwright/test` | 端到端测试 | Apache-2.0 |
| `@gltf-transform/*` | 模型优化 | MIT |
| `meshoptimizer` | 网格压缩 | MIT |
| `sharp` | 海报与纹理处理 | Apache-2.0 |

## 4. 未使用的外部素材

以下内容**明确没有**进入本项目：

- **HDRI 环境贴图**：场景环境光由 `StudioScene.tsx` 中的程序化 `Lightformer` 生成，
  不加载任何第三方 HDRI 文件，避免授权与体积问题。
- **第三方 3D 模型**：网络上存在的通用青蛙模型未被使用，本项目模型完全自行重建。
- **第三方商品图**：5 张同一头部版型的卖家实物图仅保存在本地 `assets/references/network/`，
  因未确认授权而不纳入 Git 仓库；仅用于内部结构参考，没有作为贴图、海报或其他公开产物发布。
  来源见 `assets/references/README.md`。
- **外部字体**：未引入 webfont，界面使用系统字体栈。

## 5. 纹理与环境贴图注意事项

- 贴图统一以 PNG 存放在 `assets/textures-source/`，属于中间产物。
- 线上模型使用 glTF 内嵌纹理（经 `sharp` 转为 WebP），不热链任何第三方图片。
- 若后续引入真实拍摄的多角度照片补充侧面与背面，来源与授权须按第 2 节同样方式登记。
