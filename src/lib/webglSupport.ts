/**
 * 运行环境探测：WebGL 可用性、设备能力与画质档位判定。
 * 这些函数保持为纯函数，方便单元测试覆盖。
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface WebGLSupport {
  supported: boolean;
  version: 1 | 2 | 0;
  renderer: string | null;
}

const QUALITY_ORDER: QualityTier[] = ['low', 'medium', 'high'];

/** 检测 WebGL 支持情况，返回上下文信息而不保留上下文。 */
export function detectWebGLSupport(): WebGLSupport {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { supported: false, version: 0, renderer: null };
  }

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    const attributes: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
    };

    const gl2 = canvas.getContext('webgl2', attributes);
    if (gl2) {
      const renderer = readRenderer(gl2);
      gl2.getExtension('WEBGL_lose_context')?.loseContext();
      return { supported: true, version: 2, renderer };
    }

    const gl1 = canvas.getContext('webgl', attributes) ?? canvas.getContext('experimental-webgl', attributes);
    if (gl1) {
      const renderer = readRenderer(gl1 as WebGLRenderingContext);
      (gl1 as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
      return { supported: true, version: 1, renderer };
    }
  } catch {
    return { supported: false, version: 0, renderer: null };
  } finally {
    canvas = null;
  }

  return { supported: false, version: 0, renderer: null };
}

function readRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): string | null {
  try {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    if (extension) {
      const value = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
      return typeof value === 'string' ? value : null;
    }
    const value = gl.getParameter(gl.RENDERER);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export interface DeviceCapabilities {
  deviceMemory: number;
  hardwareConcurrency: number;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  maxTouchPoints: number;
}

/** 读取设备能力；缺失时返回保守的默认值。 */
export function readDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      deviceMemory: 4,
      hardwareConcurrency: 4,
      isMobile: false,
      prefersReducedMotion: false,
      maxTouchPoints: 0,
    };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = nav.userAgent ?? '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);

  return {
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 4,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : 4,
    isMobile,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
  };
}

/** 根据设备能力推断初始画质档位。 */
export function inferQualityTier(capabilities: DeviceCapabilities): QualityTier {
  const { deviceMemory, hardwareConcurrency, isMobile } = capabilities;

  if (isMobile) {
    if (deviceMemory <= 4 || hardwareConcurrency <= 4) return 'low';
    return 'medium';
  }

  if (deviceMemory >= 8 && hardwareConcurrency >= 8) return 'high';
  if (deviceMemory >= 4 && hardwareConcurrency >= 4) return 'medium';
  return 'low';
}

/** 在档位序列上降级一级，最低为 low。 */
export function downgradeTier(tier: QualityTier): QualityTier {
  const index = QUALITY_ORDER.indexOf(tier);
  if (index <= 0) return 'low';
  return QUALITY_ORDER[index - 1]!;
}

export interface QualitySettings {
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  environmentResolution: number;
  enableContactShadows: boolean;
}

export const QUALITY_SETTINGS: Record<QualityTier, QualitySettings> = {
  high: {
    dpr: [1, 1.75],
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    environmentResolution: 256,
    enableContactShadows: true,
  },
  medium: {
    dpr: [1, 1.35],
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    environmentResolution: 128,
    enableContactShadows: true,
  },
  low: {
    dpr: [1, 1],
    shadows: false,
    shadowMapSize: 512,
    antialias: false,
    environmentResolution: 64,
    enableContactShadows: false,
  },
};
