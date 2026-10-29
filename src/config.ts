/**
 * 运行时资源路径。
 *
 * 全部使用相对路径，保证部署到子目录（如 https://example.com/frog/）时
 * 模型、海报与解码器都能正确解析。
 */

/** Blender 导出的正式模型；版本参数用于避免浏览器长期缓存旧几何与材质。 */
export const FROG_MODEL_URL = './models/frog-v1.glb?v=20261029-refined-02';

/** 首屏海报与 WebGL 不可用时的兜底图 */
export const FROG_POSTER_URL = './images/frog-poster.webp';
