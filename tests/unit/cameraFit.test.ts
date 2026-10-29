import { describe, expect, it } from 'vitest';
import { aspectPaddingFactor, fitCameraToBox, type BoundingBoxLike } from '../../src/lib/cameraFit';

/** 娃娃整体包围盒：包含顶部皮绳挂环与脚部。 */
const box: BoundingBoxLike = {
  min: { x: -0.5, y: -0.5, z: -0.3 },
  max: { x: 0.5, y: 1.7, z: 0.3 },
};

describe('fitCameraToBox', () => {
  it('计算出的距离足以把包围盒完整装入视野', () => {
    const fit = fitCameraToBox(box, { fov: 35, aspect: 1 });

    const halfWidth = (box.max.x - box.min.x) / 2;
    const halfHeight = (box.max.y - box.min.y) / 2;
    const radius = Math.hypot(halfWidth, halfHeight, 0.3);
    const verticalFov = (35 * Math.PI) / 180;

    // 距离必须大于按垂直视角计算出的最小容纳距离
    expect(fit.distance).toBeGreaterThan(radius / Math.sin(verticalFov / 2));
  });

  it('相机位置沿给定观察方向排列，并看向包围盒中心', () => {
    const fit = fitCameraToBox(box, { fov: 35, aspect: 1, direction: { x: 0, y: 0, z: 1 } });

    expect(fit.target[2]).toBeCloseTo(0, 6);
    expect(fit.position[0]).toBeCloseTo(fit.target[0], 6);
    expect(fit.position[1]).toBeCloseTo(fit.target[1], 6);
    expect(fit.position[2]).toBeGreaterThan(fit.target[2]);
  });

  it('宽屏比竖屏更远的相对距离，竖屏需要额外留白', () => {
    const wide = fitCameraToBox(box, { fov: 35, aspect: 2 });
    const tall = fitCameraToBox(box, { fov: 35, aspect: 0.5 });

    expect(tall.distance).toBeGreaterThan(wide.distance);
  });

  it('缩放上下限夹住默认距离，保证既不穿模也不会把模型缩成一点', () => {
    const fit = fitCameraToBox(box, { fov: 35, aspect: 1 });

    expect(fit.minDistance).toBeLessThan(fit.distance);
    expect(fit.maxDistance).toBeGreaterThan(fit.distance);
    expect(fit.minDistance).toBeGreaterThan(0);
  });

  it('padding 越大相机越远', () => {
    const near = fitCameraToBox(box, { fov: 35, aspect: 1, padding: 1 });
    const far = fitCameraToBox(box, { fov: 35, aspect: 1, padding: 1.6 });

    expect(far.distance).toBeGreaterThan(near.distance);
  });

  it('对空包围盒不会产生 NaN', () => {
    const empty: BoundingBoxLike = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
    const fit = fitCameraToBox(empty, { fov: 35, aspect: 1 });

    expect(Number.isFinite(fit.distance)).toBe(true);
    expect(Number.isFinite(fit.position[0])).toBe(true);
  });
});

describe('aspectPaddingFactor', () => {
  it('横屏与方形屏幕不需要额外距离', () => {
    expect(aspectPaddingFactor(1)).toBe(1);
    expect(aspectPaddingFactor(1.8)).toBe(1);
  });

  it('竖屏系数随宽度变窄而增大，但有上限', () => {
    expect(aspectPaddingFactor(0.5)).toBeGreaterThan(1);
    expect(aspectPaddingFactor(0.2)).toBeLessThanOrEqual(1.9);
    expect(aspectPaddingFactor(0.5)).toBeLessThanOrEqual(1.9);
  });
});
