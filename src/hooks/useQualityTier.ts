import { useEffect, useRef, useState } from 'react';
import {
  downgradeTier,
  inferQualityTier,
  readDeviceCapabilities,
  type QualityTier,
} from '../lib/webglSupport';

export type QualityPreference = 'auto' | QualityTier;

export interface QualityTierState {
  tier: QualityTier;
  /** 手动降级（性能不足时） */
  downgrade: () => void;
}

/**
 * 画质档位管理：初始按设备能力推断，运行中若帧率持续偏低则自动降级。
 */
export function useQualityTier(preference: QualityPreference = 'auto'): QualityTierState {
  const [tier, setTier] = useState<QualityTier>(() => {
    if (preference !== 'auto') return preference;
    return inferQualityTier(readDeviceCapabilities());
  });

  const userLocked = preference !== 'auto';
  const lowFrameCount = useRef(0);
  const hasDowngraded = useRef(false);

  useEffect(() => {
    if (userLocked) {
      setTier(preference as QualityTier);
      return;
    }
    setTier(inferQualityTier(readDeviceCapabilities()));
  }, [preference, userLocked]);

  const downgrade = () => {
    if (userLocked || hasDowngraded.current) return;
    hasDowngraded.current = true;
    setTier((current) => downgradeTier(current));
  };

  useEffect(() => {
    if (userLocked) return;

    let lastTime = performance.now();
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      // 只统计可见页面中的帧；忽略标签页切换造成的长间隔
      if (delta < 100 && delta > 0) {
        const fps = 1000 / delta;
        if (fps < 26) {
          lowFrameCount.current += 1;
          if (lowFrameCount.current > 90) {
            downgrade();
            lowFrameCount.current = 0;
          }
        } else if (fps > 45) {
          lowFrameCount.current = Math.max(0, lowFrameCount.current - 1);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [downgrade, userLocked]);

  return { tier, downgrade };
}
