import { describe, expect, it, vi } from 'vitest';
import {
  QUALITY_SETTINGS,
  detectWebGLSupport,
  downgradeTier,
  inferQualityTier,
  readDeviceCapabilities,
  type DeviceCapabilities,
} from '../../src/lib/webglSupport';

const baseCapabilities: DeviceCapabilities = {
  deviceMemory: 8,
  hardwareConcurrency: 8,
  isMobile: false,
  prefersReducedMotion: false,
  maxTouchPoints: 0,
};

describe('detectWebGLSupport', () => {
  it('拿到 WebGL2 上下文时报告支持并读取渲染器信息', () => {
    const fakeContext = {
      getExtension: (name: string) =>
        name === 'WEBGL_debug_renderer_info'
          ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
          : name === 'WEBGL_lose_context'
            ? { loseContext: () => {} }
            : null,
      getParameter: () => 'Test Renderer',
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
      type === 'webgl2' ? fakeContext : null) as unknown as typeof HTMLCanvasElement.prototype.getContext);

    const support = detectWebGLSupport();

    expect(support.supported).toBe(true);
    expect(support.version).toBe(2);
    expect(support.renderer).toBe('Test Renderer');
  });

  it('无法创建上下文时报告不支持', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext,
    );

    const support = detectWebGLSupport();

    expect(support.supported).toBe(false);
    expect(support.version).toBe(0);
  });

  it('上下文创建抛错时不崩溃，按不支持处理', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => {
        throw new Error('context creation failed');
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext,
    );

    expect(() => detectWebGLSupport()).not.toThrow();
    expect(detectWebGLSupport().supported).toBe(false);
  });
});

describe('inferQualityTier', () => {
  it('高配桌面设备使用 high', () => {
    expect(inferQualityTier(baseCapabilities)).toBe('high');
  });

  it('中配桌面设备使用 medium', () => {
    expect(inferQualityTier({ ...baseCapabilities, deviceMemory: 4, hardwareConcurrency: 4 })).toBe('medium');
  });

  it('低配桌面设备使用 low', () => {
    expect(inferQualityTier({ ...baseCapabilities, deviceMemory: 2, hardwareConcurrency: 2 })).toBe('low');
  });

  it('移动设备最高只到 medium', () => {
    expect(inferQualityTier({ ...baseCapabilities, isMobile: true })).toBe('medium');
  });

  it('低配移动设备使用 low', () => {
    expect(
      inferQualityTier({ ...baseCapabilities, isMobile: true, deviceMemory: 4, hardwareConcurrency: 4 }),
    ).toBe('low');
  });
});

describe('downgradeTier', () => {
  it('逐级降级且不会低于 low', () => {
    expect(downgradeTier('high')).toBe('medium');
    expect(downgradeTier('medium')).toBe('low');
    expect(downgradeTier('low')).toBe('low');
  });
});

describe('readDeviceCapabilities', () => {
  it('返回可用的能力字段', () => {
    const capabilities = readDeviceCapabilities();

    expect(capabilities.deviceMemory).toBeGreaterThan(0);
    expect(capabilities.hardwareConcurrency).toBeGreaterThan(0);
    expect(typeof capabilities.isMobile).toBe('boolean');
  });
});

describe('QUALITY_SETTINGS', () => {
  it('low 档位关闭阴影与抗锯齿以保证流畅', () => {
    expect(QUALITY_SETTINGS.low.shadows).toBe(false);
    expect(QUALITY_SETTINGS.low.antialias).toBe(false);
    expect(QUALITY_SETTINGS.low.dpr[1]).toBeLessThanOrEqual(1);
  });

  it('high 档位保留阴影并使用更高 DPR 上限', () => {
    expect(QUALITY_SETTINGS.high.shadows).toBe(true);
    expect(QUALITY_SETTINGS.high.dpr[1]).toBeGreaterThan(QUALITY_SETTINGS.low.dpr[1]);
  });

  it('每个档位的 DPR 区间都有效', () => {
    for (const settings of Object.values(QUALITY_SETTINGS)) {
      expect(settings.dpr[0]).toBeGreaterThan(0);
      expect(settings.dpr[1]).toBeGreaterThanOrEqual(settings.dpr[0]);
      expect(settings.shadowMapSize).toBeGreaterThan(0);
    }
  });
});
