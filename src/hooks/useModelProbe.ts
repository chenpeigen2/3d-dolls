import { useEffect, useState } from 'react';
import { inspectGlb } from '../lib/glbInspector';

/**
 * 模型预检：把 GLB 取回来校验必需节点，确认可用后才交给 Three.js 加载。
 *
 * 这样加载失败或节点缺失时，页面可以显示海报兜底与重试入口，
 * 而不是让错误抛进 R3F 渲染树导致整个画布被卸载。
 */

export type ModelProbeState = 'idle' | 'loading' | 'ok' | 'missing' | 'error';

export interface ModelProbeResult {
  state: ModelProbeState;
  /** 可读错误信息 */
  message: string;
  /** 缺少的节点名 */
  missing: string[];
}

export const REQUIRED_MODEL_NODES = ['FrogRoot', 'SuspensionPivot', 'Body'] as const;

export function useModelProbe(url: string | null, retryToken = 0): ModelProbeResult {
  const [result, setResult] = useState<ModelProbeResult>({
    state: url ? 'loading' : 'idle',
    message: '',
    missing: [],
  });

  useEffect(() => {
    if (!url) {
      setResult({ state: 'idle', message: '', missing: [] });
      return;
    }

    let cancelled = false;
    setResult({ state: 'loading', message: '', missing: [] });

    const run = async () => {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) {
          throw new Error(`模型请求失败（HTTP ${response.status}）`);
        }

        const buffer = await response.arrayBuffer();
        const inspection = inspectGlb(buffer, REQUIRED_MODEL_NODES);

        if (cancelled) return;

        if (inspection.missing.length > 0) {
          setResult({
            state: 'missing',
            message: `模型缺少必要节点：${inspection.missing.join('、')}`,
            missing: inspection.missing,
          });
          return;
        }

        setResult({ state: 'ok', message: '', missing: [] });
      } catch (error) {
        if (cancelled) return;
        setResult({
          state: 'error',
          message: error instanceof Error ? error.message : '模型加载失败',
          missing: [],
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [retryToken, url]);

  return result;
}
