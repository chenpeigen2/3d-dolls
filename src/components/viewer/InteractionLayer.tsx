import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFrogController, useFrogRig } from './rig';
import type { HotspotId } from '../../types/frog';

/**
 * 交互层：为关键部位生成不可见的拾取代理。
 *
 * 代理位置跟随模型中的实际节点，因此代理模型与 GLB 模型共用同一套逻辑；
 * 射线检测只针对这几个少量代理，不对整个高模场景做拾取。
 */

interface HotspotSpec {
  id: HotspotId;
  /** 拾取代理相对模型根节点的位置（模型局部坐标） */
  position: [number, number, number];
  /** 拾取代理半径 */
  radius: number;
}

const HOTSPOT_SPECS: HotspotSpec[] = [
  { id: 'eye', position: [-0.31, 1.28, 0.3], radius: 0.19 },
  { id: 'body', position: [0, 0.62, 0.3], radius: 0.34 },
  { id: 'bowTie', position: [0, 0.86, 0.36], radius: 0.16 },
  { id: 'pants', position: [0, 0.16, 0.24], radius: 0.34 },
];

export function InteractionLayer({
  onHotspot,
  enabled = true,
}: {
  onHotspot: (id: HotspotId) => void;
  /** 已有真实模型节点时关闭代理热区，避免重复拾取 */
  enabled?: boolean;
}) {
  const rig = useFrogRig();
  const controller = useFrogController();

  const refs = useRef<Partial<Record<HotspotId, THREE.Mesh>>>({});
  const rootRef = useRef<THREE.Group>(null);

  // 使用 colorWrite=false 而不是 visible=false：
  // 不可见物体不会参与射线拾取，会让热区完全失效。
  const invisibleMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }),
    [],
  );

  useEffect(() => {
    // 关闭代理热区时取消射线拾取能力
    for (const mesh of Object.values(refs.current)) {
      if (!mesh) continue;
      mesh.raycast = enabled ? THREE.Mesh.prototype.raycast : () => {};
    }
  }, [enabled]);

  useFrame(() => {
    const root = rig.current.root;
    if (!root) return;

    for (const spec of HOTSPOT_SPECS) {
      const mesh = refs.current[spec.id];
      if (!mesh) continue;

      // GLB 模型使用实际节点位置，代理模型使用约定坐标
      const anchor =
        spec.id === 'eye'
          ? (rig.current.eyes.L ?? rig.current.eyes.R)
          : spec.id === 'body'
            ? rig.current.body
            : spec.id === 'bowTie'
              ? rig.current.bowTie
              : rig.current.pants;

      if (anchor) {
        const world = new THREE.Vector3();
        anchor.getWorldPosition(world);
        mesh.position.copy(world);
      } else {
        mesh.position.set(...spec.position);
      }
    }
  });

  const trigger = (id: HotspotId) => {
    onHotspot(id);
    if (id === 'eye') controller.blink();
    if (id === 'body') controller.squish();
    if (id === 'bowTie' || id === 'pants') controller.bounce(id);
  };

  return (
    <group ref={rootRef} name="InteractionProxies">
      {HOTSPOT_SPECS.map((spec) => (
        <mesh
          key={spec.id}
          ref={(node) => {
            if (node) refs.current[spec.id] = node;
          }}
          material={invisibleMaterial}
          onClick={(event) => {
            event.stopPropagation();
            trigger(spec.id);
          }}
        >
          <sphereGeometry args={[spec.radius, 16, 12]} />
        </mesh>
      ))}
    </group>
  );
}
