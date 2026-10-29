import { Environment, Lightformer } from '@react-three/drei';
import type { QualitySettings } from '../../lib/webglSupport';

/**
 * 场景与灯光：温暖手作展台风格。
 * 使用暖白渐变背景、柔和主光与轮廓光，配合接触阴影表现悬挂体积感。
 */
export function StudioScene({ quality }: { quality: QualitySettings }) {
  return (
    <>
      <color attach="background" args={['#ece4d7']} />
      <fog attach="fog" args={['#e7ded0', 6, 14]} />

      {/* 环境光：用于金属与眼珠的反射，不依赖外部 HDRI 文件 */}
      <Environment resolution={quality.environmentResolution}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#fff4e2"
          position={[0, 3.5, 2.5]}
          scale={[6, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#ffe9cf"
          position={[-3, 1.6, 1.5]}
          rotation={[0, Math.PI / 2.6, 0]}
          scale={[4, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#dfe9ff"
          position={[3.2, 1.2, -1.2]}
          rotation={[0, -Math.PI / 2.4, 0]}
          scale={[3, 4, 1]}
        />
        <Lightformer
          form="circle"
          intensity={0.6}
          color="#ffffff"
          position={[0, -2.5, 1.5]}
          scale={[5, 5, 1]}
        />
      </Environment>

      <ambientLight intensity={0.35} color="#fff3e4" />

      {/* 主光 */}
      <directionalLight
        position={[3.2, 5.5, 4.2]}
        intensity={2.1}
        color="#fff6e8"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />

      {/* 补光：提亮暗部，避免阴影处死黑 */}
      <directionalLight position={[-4, 2.2, 2.6]} intensity={0.65} color="#e8f0ff" />
      {/* 轮廓光：分离主体与背景 */}
      <directionalLight position={[-1.5, 3.2, -4]} intensity={0.9} color="#ffe9c9" />
    </>
  );
}
