import { useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { FROG_MODEL_URL } from '../../config';
import { findNode, useFrogRig } from './rig';

/**
 * 加载 Blender 导出的 GLB 模型。
 *
 * 节点契约见 rig.ts：FrogRoot / SuspensionPivot / Body / BowTie / Pants / Eye.L / Eye.R。
 * 缺少关键节点时抛出可读错误，由上层降级为代理模型或静态海报。
 */

export interface GlbFrogProps {
  url: string;
  onHotspot?: (id: 'eye' | 'body' | 'bowTie' | 'pants') => void;
  /** 节点校验通过后回调 */
  onReady?: () => void;
}

const REQUIRED_NODES = ['FrogRoot', 'SuspensionPivot', 'Body'] as const;

export function GlbFrog({ url, onHotspot, onReady }: GlbFrogProps) {
  const { scene } = useGLTF(url);
  const rig = useFrogRig();
  const [validated, setValidated] = useState(false);

  const clone = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const root = findNode(clone, 'FrogRoot');
    const pivot = findNode(clone, 'SuspensionPivot');
    const body = findNode(clone, 'Body');

    const missing = REQUIRED_NODES.filter((name) => !findNode(clone, name));
    if (missing.length > 0) {
      throw new Error(`模型缺少必要节点：${missing.join('、')}`);
    }

    // 关闭 GLB 中可能存在的自动包围盒变换，保持与代理模型一致的世界坐标
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    rig.current.root = root ?? clone;
    rig.current.suspensionPivot = pivot ?? null;
    rig.current.body = body ?? null;
    rig.current.bowTie = findNode(clone, 'BowTie');
    rig.current.pants = findNode(clone, 'Pants');
    rig.current.eyes.L = findNode(clone, 'Eye.L');
    rig.current.eyes.R = findNode(clone, 'Eye.R');

    setValidated(true);
    onReady?.();

    return () => {
      rig.current.root = null;
      rig.current.suspensionPivot = null;
      rig.current.body = null;
      rig.current.bowTie = null;
      rig.current.pants = null;
      rig.current.eyes.L = null;
      rig.current.eyes.R = null;
    };
  }, [clone, onReady, rig]);

  useEffect(() => {
    // 为关键节点标记热区，供射线拾取识别
    const markers: Array<[string, 'eye' | 'body' | 'bowTie' | 'pants']> = [
      ['Eye.L', 'eye'],
      ['Eye.R', 'eye'],
      ['Body', 'body'],
      ['BowTie', 'bowTie'],
      ['Pants', 'pants'],
    ];

    for (const [name, hotspot] of markers) {
      const node = findNode(clone, name);
      if (node) node.userData.hotspotId = hotspot;
    }
  }, [clone]);

  if (!validated) {
    // 校验在 effect 中完成；首帧渲染隐藏的占位，避免错误模型闪现
    return <group visible={false} />;
  }

  return (
    <primitive
      object={clone}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        const hotspot = resolveFromObject(event.object);
        if (!hotspot) return;
        event.stopPropagation();
        onHotspot?.(hotspot);
      }}
    />
  );
}

function resolveFromObject(object: THREE.Object3D): 'eye' | 'body' | 'bowTie' | 'pants' | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const marker = current.userData?.hotspotId;
    if (marker === 'eye' || marker === 'body' || marker === 'bowTie' || marker === 'pants') {
      return marker;
    }
    current = current.parent;
  }
  return null;
}

// 预加载正式模型，使用相对路径以兼容子目录部署
useGLTF.preload(FROG_MODEL_URL);
