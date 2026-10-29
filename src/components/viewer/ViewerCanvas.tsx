import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { FrogAnimator } from './FrogAnimator';
import { InteractionLayer } from './InteractionLayer';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { ProxyFrog } from './ProxyFrog';
import { GlbFrog } from './GlbFrog';
import { StudioScene } from './StudioScene';
import { FrogControllerContext, FrogRigContext, createEmptyParts, type FrogController } from './rig';
import { QUALITY_SETTINGS, type QualityTier } from '../../lib/webglSupport';

export interface ViewerCanvasProps {
  modelUrl: string | null;
  qualityTier: QualityTier;
  idle: boolean;
  reducedMotion: boolean;
  resetSignal: number;
  onHotspot: (id: 'eye' | 'body' | 'bowTie' | 'pants') => void;
  onReady: () => void;
  onError: (error: Error) => void;
  /** GLB 节点校验通过后回调 */
  onModelReady?: () => void;
  children?: ReactNode;
}

/**
 * Canvas 容器：负责渲染循环、色彩管理、DPR 与画质设置。
 * 模型来源（GLB 或代理模型）在此处决策，加载失败自动降级。
 */
export function ViewerCanvas({
  modelUrl,
  qualityTier,
  idle,
  reducedMotion,
  resetSignal,
  onHotspot,
  onReady,
  onError,
  onModelReady,
  children,
}: ViewerCanvasProps) {
  const quality = QUALITY_SETTINGS[qualityTier];
  const rigRef = useRef(createEmptyParts());
  const readyFired = useRef(false);

  const controllerRef = useRef<FrogController>({
    blink: () => {},
    squish: () => {},
    bounce: () => {},
    setIdle: () => {},
    reset: () => {},
  });

  const [glbFailed, setGlbFailed] = useState(false);
  const [glbReady, setGlbReady] = useState(false);

  // GLB 加载失败后不再重试同一 URL
  useEffect(() => {
    setGlbFailed(false);
    setGlbReady(false);
  }, [modelUrl]);

  const handleReady = () => {
    if (readyFired.current) return;
    readyFired.current = true;
    onReady();
  };

  const handleModelReady = () => {
    setGlbReady(true);
    onModelReady?.();
  };

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      gl={{
        antialias: quality.antialias,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      camera={{ fov: 35, near: 0.1, far: 60, position: [0, 1.1, 4.2] }}
      onCreated={({ gl, camera, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFShadowMap;
        // 调试探针：便于在浏览器控制台核对相机与场景状态
        (window as unknown as { __frogDebug?: unknown }).__frogDebug = { camera, scene, gl, THREE };
      }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    >
      <FrogRigContext.Provider value={rigRef}>
        <FrogControllerContext.Provider value={controllerRef.current}>
          <StudioScene quality={quality} />

          <ModelErrorBoundary
            fallback={<ProxyFrog />}
            onError={(error) => {
              setGlbFailed(true);
              onError(error);
            }}
          >
            {modelUrl && !glbFailed ? (
              <GlbFrog url={modelUrl} onHotspot={onHotspot} onReady={handleModelReady} />
            ) : (
              <ProxyFrog />
            )}
          </ModelErrorBoundary>

          {/* 代理热区只在没有真实模型节点时启用 */}
          <InteractionLayer onHotspot={onHotspot} enabled={!glbReady} />

          <FrogAnimator idle={idle} reducedMotion={reducedMotion} />
          <CameraRig idle={idle} reducedMotion={reducedMotion} resetSignal={resetSignal} />

          <ReadySignal onReady={handleReady} />
          {children}
        </FrogControllerContext.Provider>
      </FrogRigContext.Provider>
    </Canvas>
  );
}

/** 模型与场景就绪后触发一次 onReady。 */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onReady, 60);
    return () => window.clearTimeout(id);
  }, [onReady]);

  return null;
}
