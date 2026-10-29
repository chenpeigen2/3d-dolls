import { createContext, useContext, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { HotspotId } from '../../types/frog';

/**
 * 模型节点契约。
 *
 * Blender 导出的 GLB 与代码代理模型必须遵循同一套命名，
 * 这样网页逻辑（动画、热点）在替换资产时无需改动。
 *
 * 约定命名：
 *   FrogRoot          根节点
 *   SuspensionPivot   顶部悬挂点（摆动绕此旋转）
 *   Body              身体
 *   BowTie            蝴蝶结
 *   Pants             裤子
 *   Eye.L / Eye.R     眼珠
 *   Eyelid.L/.R       眼皮
 */
export interface FrogParts {
  root: THREE.Object3D | null;
  suspensionPivot: THREE.Object3D | null;
  body: THREE.Object3D | null;
  bowTie: THREE.Object3D | null;
  pants: THREE.Object3D | null;
  eyes: { L: THREE.Object3D | null; R: THREE.Object3D | null };
  eyelids: { L: THREE.Object3D | null; R: THREE.Object3D | null };
}

export function createEmptyParts(): FrogParts {
  return {
    root: null,
    suspensionPivot: null,
    body: null,
    bowTie: null,
    pants: null,
    eyes: { L: null, R: null },
    eyelids: { L: null, R: null },
  };
}

/** 触发局部反馈的指令接口，由动画执行器消费。 */
export interface FrogController {
  blink: () => void;
  squish: () => void;
  bounce: (part: 'bowTie' | 'pants') => void;
  setIdle: (idle: boolean) => void;
  reset: () => void;
}

export const FrogRigContext = createContext<MutableRefObject<FrogParts> | null>(null);
export const FrogControllerContext = createContext<FrogController | null>(null);

export function useFrogRig(): MutableRefObject<FrogParts> {
  const rig = useContext(FrogRigContext);
  if (!rig) throw new Error('useFrogRig 必须在 FrogRigContext.Provider 内使用');
  return rig;
}

export function useFrogController(): FrogController {
  const controller = useContext(FrogControllerContext);
  if (!controller) throw new Error('useFrogController 必须在 FrogControllerContext.Provider 内使用');
  return controller;
}

/** 沿着对象树向上查找被标记为热区的节点。 */
export function resolveHotspotId(object: THREE.Object3D | null): HotspotId | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const marker = current.userData?.hotspotId;
    if (typeof marker === 'string') {
      const known: HotspotId[] = ['eye', 'body', 'bowTie', 'pants'];
      if (known.includes(marker as HotspotId)) return marker as HotspotId;
    }
    current = current.parent;
  }
  return null;
}

/**
 * 按节点契约查找对象。
 *
 * three.js 在构建场景树时会用 `PropertyBinding.sanitizeNodeName` 清理节点名，
 * 其中的 "." 会被去掉，因此 `Eye.L` 在运行时实际是 `EyeL`。
 * 这里同时尝试原始名与清理后的名字，保证与 Blender 导出的命名契约一致。
 */
export function findNode(root: THREE.Object3D | null, name: string): THREE.Object3D | null {
  if (!root) return null;

  const direct = root.getObjectByName(name);
  if (direct) return direct;

  const sanitized = name.replace(/\./g, '');
  if (sanitized !== name) {
    const fallback = root.getObjectByName(sanitized);
    if (fallback) return fallback;
  }

  return null;
}
