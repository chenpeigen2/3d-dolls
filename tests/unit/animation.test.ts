import { describe, expect, it } from 'vitest';
import {
  damp,
  dampVector3,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  pulseProgress,
  stepSpring,
  swingAngle,
  type SpringState,
} from '../../src/lib/animation';

describe('damp', () => {
  it('始终朝目标值靠拢且不会越过目标', () => {
    let value = 0;
    for (let i = 0; i < 20; i += 1) {
      value = damp(value, 10, 5, 1 / 60);
      expect(value).toBeLessThanOrEqual(10);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('与帧率无关：单步大 dt 与多步小 dt 结果接近', () => {
    const single = damp(0, 1, 6, 0.5);

    let stepped = 0;
    for (let i = 0; i < 30; i += 1) {
      stepped = damp(stepped, 1, 6, 1 / 60);
    }

    expect(stepped).toBeCloseTo(single, 2);
  });

  it('当前值等于目标值时保持不变', () => {
    expect(damp(3, 3, 5, 1 / 60)).toBe(3);
  });
});

describe('dampVector3', () => {
  it('逐分量插值', () => {
    const result = dampVector3({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 }, 5, 1 / 60);

    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.z).toBeGreaterThan(0);
    expect(result.x).toBeLessThanOrEqual(1);
    expect(result.y).toBeLessThanOrEqual(2);
    expect(result.z).toBeLessThanOrEqual(3);
  });
});

describe('缓动函数', () => {
  it('easeOutCubic 端点正确且单调递增', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);

    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const value = easeOutCubic(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('easeInOutSine 端点正确', () => {
    expect(easeInOutSine(0)).toBeCloseTo(0, 6);
    expect(easeInOutSine(1)).toBeCloseTo(1, 6);
  });

  it('easeOutBack 会轻微过冲并最终回到 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 10);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);

    const overshoot = Math.max(...Array.from({ length: 20 }, (_, i) => easeOutBack((i + 1) / 20)));
    expect(overshoot).toBeGreaterThan(1);
  });
});

describe('pulseProgress', () => {
  it('窗口外返回 0', () => {
    expect(pulseProgress(-0.1, 0.4)).toBe(0);
    expect(pulseProgress(0.5, 0.4)).toBe(0);
  });

  it('窗口中点达到峰值 1', () => {
    expect(pulseProgress(0.2, 0.4)).toBeCloseTo(1, 6);
  });

  it('时长为 0 时不产生脉冲', () => {
    expect(pulseProgress(0.1, 0)).toBe(0);
  });
});

describe('stepSpring', () => {
  it('向目标靠近并最终稳定', () => {
    const state: SpringState = { value: 0, velocity: 0 };

    for (let i = 0; i < 120; i += 1) {
      stepSpring(state, 1, 1 / 60);
    }

    expect(state.value).toBeCloseTo(1, 1);
  });

  it('限制单帧步长，避免掉帧时数值发散', () => {
    const clamped = stepSpring({ value: 0, velocity: 0 }, 1, 1 / 30);
    const droppedFrame = stepSpring({ value: 0, velocity: 0 }, 1, 5);

    // 掉帧时按钳制后的步长推进，等价于 1/30 秒的一步
    expect(droppedFrame.value).toBeCloseTo(clamped.value, 10);
    expect(droppedFrame.velocity).toBeCloseTo(clamped.velocity, 10);
  });
});

describe('swingAngle', () => {
  it('摆动幅度不超过给定上限', () => {
    for (let t = 0; t < 20; t += 0.05) {
      expect(Math.abs(swingAngle(t, 0.05, 3.4))).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it('一个周期后回到起点', () => {
    expect(swingAngle(0, 0.05, 3.4)).toBeCloseTo(0, 9);
    expect(swingAngle(3.4, 0.05, 3.4)).toBeCloseTo(0, 6);
  });
});
