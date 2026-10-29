import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ViewerCanvas } from './ViewerCanvas';
import { FallbackPanel } from '../ui/FallbackPanel';
import { HelpPanel } from '../ui/HelpPanel';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { MaterialCard } from '../ui/MaterialCard';
import { ViewerToolbar } from '../ui/ViewerToolbar';
import { useIdleActivity } from '../../hooks/useIdleActivity';
import { useModelProbe } from '../../hooks/useModelProbe';
import { useQualityTier, type QualityPreference } from '../../hooks/useQualityTier';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { detectWebGLSupport } from '../../lib/webglSupport';
import { HOTSPOT_BY_ID, type HotspotId } from '../../types/frog';

export interface FrogViewerProps {
  /** GLB 模型地址；为空时使用内置程序化代理模型 */
  modelUrl?: string | null;
  /** 首屏海报与兜底图片 */
  posterUrl?: string;
  /** 画质偏好，默认自动 */
  quality?: QualityPreference;
  /** 是否允许空闲自动旋转 */
  autoRotate?: boolean;
  /** 组件类名，便于宿主页面布局 */
  className?: string;
  /** 场景就绪回调 */
  onReady?: () => void;
  /** 发生降级或错误时回调 */
  onError?: (error: Error) => void;
}

/**
 * 可复用的 3D 娃娃查看器。
 *
 * 组件自适应父容器尺寸，不强制全屏；标题与说明由宿主页面决定是否包裹。
 */
export function FrogViewer({
  modelUrl = null,
  posterUrl,
  quality = 'auto',
  autoRotate = true,
  className,
  onReady,
  onError,
}: FrogViewerProps) {
  const [status, setStatus] = useState<'checking' | 'loading' | 'ready' | 'fallback'>('checking');
  const [error, setError] = useState<Error | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<HotspotId | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [probeToken, setProbeToken] = useState(0);

  const reducedMotion = useReducedMotion();
  const { tier } = useQualityTier(quality);
  const { isIdle, notifyInteraction } = useIdleActivity();
  const probe = useModelProbe(modelUrl, probeToken);

  const containerRef = useRef<HTMLDivElement>(null);
  const webglChecked = useRef(false);

  // 环境检测：WebGL 不可用时直接进入静态兜底
  useEffect(() => {
    if (webglChecked.current) return;
    webglChecked.current = true;

    const support = detectWebGLSupport();
    if (!support.supported) {
      const failure = new Error('当前浏览器或设备不支持 WebGL');
      setError(failure);
      setStatus('fallback');
      onError?.(failure);
      return;
    }
    setStatus('loading');
  }, [onError]);

  // 模型预检失败（网络错误或缺少必需节点）时展示海报兜底与重试入口
  useEffect(() => {
    if (probe.state !== 'error' && probe.state !== 'missing') return;

    const failure = new Error(probe.message);
    setError(failure);
    setStatus('fallback');
    onError?.(failure);
  }, [onError, probe.message, probe.state]);

  // 记录用户交互，用于暂停自动旋转
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handler = () => notifyInteraction();
    element.addEventListener('pointerdown', handler);
    element.addEventListener('pointermove', handler, { passive: true });
    element.addEventListener('wheel', handler, { passive: true });
    element.addEventListener('touchstart', handler, { passive: true });

    return () => {
      element.removeEventListener('pointerdown', handler);
      element.removeEventListener('pointermove', handler);
      element.removeEventListener('wheel', handler);
      element.removeEventListener('touchstart', handler);
    };
  }, [notifyInteraction]);

  // 页面隐藏时暂停渲染循环
  useEffect(() => {
    const onVisibilityChange = () => {
      const element = containerRef.current;
      if (!element) return;
      const canvas = element.querySelector('canvas');
      if (!canvas) return;
      // 通过释放焦点让浏览器自行节流，Three.js 的 rAF 在隐藏页面会自然暂停
      if (document.hidden) {
        canvas.setAttribute('data-paused', 'true');
      } else {
        canvas.removeAttribute('data-paused');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const handleReady = useCallback(() => {
    setStatus('ready');
    onReady?.();
  }, [onReady]);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
      // 模型出错时保留代理模型展示，不直接进入静态兜底
      setStatus((current) => (current === 'fallback' ? current : 'ready'));
    },
    [onError],
  );

  const handleHotspot = useCallback((id: HotspotId) => {
    setActiveHotspot(id);
  }, []);

  const handleReset = useCallback(() => {
    setResetSignal((value) => value + 1);
    setActiveHotspot(null);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setStatus('loading');
    setResetSignal((value) => value + 1);
    setProbeToken((value) => value + 1);
  }, []);

  const activeDefinition = useMemo(
    () => (activeHotspot ? HOTSPOT_BY_ID[activeHotspot] : null),
    [activeHotspot],
  );

  const idle = autoRotate && isIdle && !reducedMotion;

  // 模型预检通过后才把地址交给 Three.js，避免加载失败把整个画布带崩
  const modelReady = !modelUrl || probe.state === 'ok';
  const effectiveModelUrl = modelReady ? modelUrl : null;

  const fallbackDescription =
    probe.state === 'missing'
      ? `${probe.message}。可以先查看下面的实拍图片，或稍后重试。`
      : probe.state === 'error'
        ? `${probe.message}。可以先查看下面的实拍图片，或点击重试。`
        : undefined;

  return (
    <div className={`viewer${className ? ` ${className}` : ''}`} ref={containerRef}>
      {status === 'fallback' ? (
        <FallbackPanel
          posterUrl={posterUrl}
          {...(fallbackDescription ? { description: fallbackDescription } : {})}
          onRetry={handleRetry}
        />
      ) : (
        <>
          {modelReady && (
            <ViewerCanvas
              modelUrl={effectiveModelUrl}
              qualityTier={tier}
              idle={idle}
              reducedMotion={reducedMotion}
              resetSignal={resetSignal}
              onHotspot={handleHotspot}
              onReady={handleReady}
              onError={handleError}
            />
          )}

          {status === 'loading' && (
            <LoadingOverlay message={error ? '模型加载异常，正在显示备用模型…' : undefined} />
          )}

          <ViewerToolbar
            onReset={handleReset}
            onToggleHelp={() => setShowHelp((value) => !value)}
            showHelp={showHelp}
          />

          {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

          {activeDefinition && (
            <MaterialCard hotspot={activeDefinition} onClose={() => setActiveHotspot(null)} />
          )}
        </>
      )}
    </div>
  );
}
