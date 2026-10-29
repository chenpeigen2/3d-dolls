import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { damp } from '../../lib/animation';
import { aspectPaddingFactor, fitCameraToBox } from '../../lib/cameraFit';
import { useFrogRig } from './rig';

export interface CameraRigProps {
  /** 用户是否正在操作 */
  idle: boolean;
  /** 是否尊重系统的减少动态效果设置 */
  reducedMotion: boolean;
  /** 复位触发计数 */
  resetSignal: number;
  /** 相机适配完成回调 */
  onFitted?: (fit: { distance: number }) => void;
}

/**
 * 相机控制：自动适配模型包围盒、限制缩放、禁止平移、
 * 空闲时缓慢环绕，并在收到复位指令时平滑回到默认机位。
 */
export function CameraRig({ idle, reducedMotion, resetSignal, onFitted }: CameraRigProps) {
  const rig = useFrogRig();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();

  const fitRef = useRef<ReturnType<typeof fitCameraToBox> | null>(null);
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const isResetting = useRef(false);
  const orbitAngle = useRef(0);

  // 模型加载完成后计算包围盒并适配相机
  useEffect(() => {
    const root = rig.current.root;
    if (!root) return;

    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;

    const fit = fitCameraToBox(
      { min: box.min, max: box.max },
      {
        fov: 35,
        aspect: Math.max(size.width / Math.max(size.height, 1), 0.35),
        padding: 1.15,
      },
    );

    fitRef.current = fit;
    targetPosition.current.set(...fit.position);
    targetLookAt.current.set(...fit.target);

    camera.position.copy(targetPosition.current);
    camera.lookAt(targetLookAt.current);
    camera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(targetLookAt.current);
      controls.minDistance = fit.minDistance;
      controls.maxDistance = fit.maxDistance;
      controls.update();
    }

    onFitted?.({ distance: fit.distance });
  }, [camera, onFitted, rig, size.height, size.width]);

  // 复位指令
  useEffect(() => {
    if (resetSignal === 0) return;
    isResetting.current = true;
    orbitAngle.current = 0;
  }, [resetSignal]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 1 / 20);
    const controls = controlsRef.current;
    if (!controls) return;

    if (isResetting.current) {
      camera.position.x = damp(camera.position.x, targetPosition.current.x, 5, step);
      camera.position.y = damp(camera.position.y, targetPosition.current.y, 5, step);
      camera.position.z = damp(camera.position.z, targetPosition.current.z, 5, step);
      controls.target.x = damp(controls.target.x, targetLookAt.current.x, 5, step);
      controls.target.y = damp(controls.target.y, targetLookAt.current.y, 5, step);
      controls.target.z = damp(controls.target.z, targetLookAt.current.z, 5, step);
      controls.update();

      const distance = camera.position.distanceTo(controls.target);
      if (Math.abs(distance - (fitRef.current?.distance ?? distance)) < 0.01) {
        isResetting.current = false;
      }
      return;
    }

    // 空闲时围绕模型缓慢环绕
    if (idle && !reducedMotion) {
      orbitAngle.current += step * 0.16;
      // 只取水平半径：若用三维距离回填水平面，距离会逐帧放大，模型越转越小
      const offset = camera.position.clone().sub(controls.target);
      const radius = Math.hypot(offset.x, offset.z);
      const height = offset.y;
      camera.position.x = controls.target.x + Math.cos(orbitAngle.current) * radius;
      camera.position.z = controls.target.z + Math.sin(orbitAngle.current) * radius;
      camera.position.y = controls.target.y + height;
      controls.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.75}
      zoomSpeed={0.8}
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.92}
    />
  );
}

/** 竖屏时额外拉远，避免主体被裁切。 */
export function usePortraitDistanceFactor(aspect: number): number {
  return aspectPaddingFactor(aspect);
}
