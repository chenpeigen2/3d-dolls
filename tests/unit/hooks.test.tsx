import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useIdleActivity } from '../../src/hooks/useIdleActivity';
import { useQualityTier } from '../../src/hooks/useQualityTier';
import { useReducedMotion } from '../../src/hooks/useReducedMotion';

describe('useIdleActivity', () => {
  it('开始时不处于空闲状态', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleActivity(1000));

    expect(result.current.isIdle).toBe(false);
  });

  it('超过空闲阈值后进入空闲状态', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleActivity(1000));

    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('用户交互后立即退出空闲状态', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleActivity(1000));

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.isIdle).toBe(true);

    act(() => {
      result.current.notifyInteraction();
    });

    expect(result.current.isIdle).toBe(false);
  });
});

describe('useReducedMotion', () => {
  it('跟随系统的减少动态效果设置', async () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = [];
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
            listeners.push(listener),
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(true));

    await act(async () => {
      listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent),
      );
    });

    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useQualityTier', () => {
  it('显式指定画质时锁定该档位', () => {
    const { result } = renderHook(() => useQualityTier('low'));

    expect(result.current.tier).toBe('low');
  });

  it('用户锁定画质后，降级操作不改变档位', () => {
    const { result } = renderHook(() => useQualityTier('high'));

    act(() => result.current.downgrade());

    expect(result.current.tier).toBe('high');
  });

  it('自动模式下返回设备推断出的合法档位', async () => {
    const { result } = renderHook(() => useQualityTier('auto'));

    await waitFor(() => expect(['high', 'medium', 'low']).toContain(result.current.tier));
  });
});
