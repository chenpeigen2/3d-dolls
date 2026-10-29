/**
 * 相机适配计算：根据模型包围盒推导相机位置、目标点与缩放限制。
 * 纯函数实现，便于单元测试验证不同宽高比下的构图结果。
 */

export interface BoundingBoxLike {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface CameraFitOptions {
  /** 垂直视野角（度） */
  fov: number;
  /** 画布宽高比 */
  aspect: number;
  /** 额外留白系数 */
  padding?: number;
  /** 观察方向（从目标点指向相机的单位向量） */
  direction?: { x: number; y: number; z: number };
}

export interface CameraFitResult {
  position: [number, number, number];
  target: [number, number, number];
  /** 相机到目标的距离 */
  distance: number;
  /** 允许的最小缩放距离 */
  minDistance: number;
  /** 允许的最大缩放距离 */
  maxDistance: number;
}

const DEFAULT_PADDING = 1.18;
const DEFAULT_DIRECTION = { x: 0, y: 0.16, z: 1 };

function normalize(vector: { x: number; y: number; z: number }) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) return { x: 0, y: 0, z: 1 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/**
 * 计算能完整容纳包围盒的相机距离。
 * 同时考虑垂直与水平视野，取更受限的一侧，避免宽屏或竖屏出现裁切。
 */
export function fitCameraToBox(
  box: BoundingBoxLike,
  options: CameraFitOptions,
): CameraFitResult {
  const { fov, aspect } = options;
  const padding = options.padding ?? DEFAULT_PADDING;
  const direction = normalize(options.direction ?? DEFAULT_DIRECTION);

  const center: [number, number, number] = [
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  ];

  const halfWidth = Math.max((box.max.x - box.min.x) / 2, 1e-4);
  const halfHeight = Math.max((box.max.y - box.min.y) / 2, 1e-4);
  const halfDepth = Math.max((box.max.z - box.min.z) / 2, 1e-4);
  const radius = Math.hypot(halfWidth, halfHeight, halfDepth);

  const verticalFov = (fov * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.1));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const fitDistance = radius / Math.sin(limitingFov / 2);

  const distance = fitDistance * padding;

  return {
    position: [
      center[0] + direction.x * distance,
      center[1] + direction.y * distance,
      center[2] + direction.z * distance,
    ],
    target: center,
    distance,
    minDistance: Math.max(distance * 0.45, radius * 1.1),
    maxDistance: distance * 2.4,
  };
}

/** 计算竖屏时为保持完整构图所需的额外距离系数。 */
export function aspectPaddingFactor(aspect: number): number {
  if (aspect >= 1) return 1;
  // 竖屏越窄，需要越远的距离才能容纳完整宽度
  return Math.min(1.9, 1 / Math.max(aspect, 0.35));
}
