import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrogRig } from './rig';

/**
 * 程序化代理模型。
 *
 * 目的：在 Blender 高还原模型交付之前，先用基础几何体还原照片中的
 * 关键造型（凸起大眼、宽扁嘴、格子蝴蝶结、牛仔灯笼裤、皮绳与金属环），
 * 以便打通网页架构、交互与动画。GLB 就绪后由 FrogModel 自动切换。
 */

/** 生成带褶皱（抽褶）的环形几何体，用作眼眶包边。 */
function createRuchedRingGeometry(
  radius: number,
  tube: number,
  radialSegments = 32,
  tubularSegments = 96,
  folds = 14,
  foldDepth = 0.018,
): THREE.BufferGeometry {
  const geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);

  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();
  const center = new THREE.Vector3();
  const offset = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);

    const angle = Math.atan2(vertex.y, vertex.x);
    const fold = Math.sin(angle * folds);
    const scale = 1 + fold * (foldDepth / Math.max(tube, 1e-4));

    center.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    offset.copy(vertex).sub(center);

    position.setXYZ(
      i,
      center.x + offset.x * scale,
      center.y + offset.y * scale,
      vertex.z + fold * tube * 0.9,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const GREEN = '#6d9a3c';
const GREEN_DARK = '#4f7526';
const DENIM = '#3f5c86';
const LEATHER = '#a8682f';
const METAL = '#c8c8c8';

export function ProxyFrog() {
  const rig = useFrogRig();

  const rootRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const bowTieRef = useRef<THREE.Group>(null);
  const pantsRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);

  const materials = useMemo(() => {
    const fabric = new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.95, metalness: 0 });
    const fabricDark = new THREE.MeshStandardMaterial({ color: GREEN_DARK, roughness: 0.98, metalness: 0 });
    const denim = new THREE.MeshStandardMaterial({ color: DENIM, roughness: 0.92, metalness: 0 });
    const leather = new THREE.MeshStandardMaterial({ color: LEATHER, roughness: 0.62, metalness: 0.05 });
    const metal = new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.28, metalness: 1 });
    const white = new THREE.MeshStandardMaterial({ color: '#f4f2e8', roughness: 0.88, metalness: 0 });
    const pupil = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.18, metalness: 0.1 });
    const bow = new THREE.MeshStandardMaterial({ color: '#7d3b30', roughness: 0.9, metalness: 0 });

    return { fabric, fabricDark, denim, leather, metal, white, pupil, bow };
  }, []);

  const geometries = useMemo(
    () => ({
      ruchedRing: createRuchedRingGeometry(0.155, 0.055),
      ruchedRingSmall: createRuchedRingGeometry(0.115, 0.042),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      geometries.ruchedRing.dispose();
      geometries.ruchedRingSmall.dispose();
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [geometries, materials]);

  useEffect(() => {
    rig.current.root = rootRef.current;
    rig.current.suspensionPivot = pivotRef.current;
    rig.current.body = bodyRef.current;
    rig.current.bowTie = bowTieRef.current;
    rig.current.pants = pantsRef.current;
    rig.current.eyes.L = eyeLRef.current;
    rig.current.eyes.R = eyeRRef.current;

    return () => {
      rig.current.root = null;
      rig.current.suspensionPivot = null;
      rig.current.body = null;
      rig.current.bowTie = null;
      rig.current.pants = null;
      rig.current.eyes.L = null;
      rig.current.eyes.R = null;
    };
  }, [rig]);

  return (
    <group name="FrogRoot" ref={rootRef}>
      {/* 顶部悬挂结构：皮绳 + 缠绕结 + 金属环 + 皮质标签 */}
      <group name="SuspensionPivot" ref={pivotRef} position={[0, 1.62, 0]}>
        <mesh material={materials.leather} position={[0, 0.34, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.03, 0.62, 12]} />
        </mesh>
        <mesh material={materials.leather} position={[0, 0.2, 0]} rotation={[0, 0, 0.35]} castShadow>
          <torusGeometry args={[0.055, 0.024, 10, 24]} />
        </mesh>
        <mesh material={materials.leather} position={[0, 0.12, 0]} rotation={[0, 0, -0.3]} castShadow>
          <torusGeometry args={[0.05, 0.022, 10, 24]} />
        </mesh>
        <mesh material={materials.metal} position={[0, 0.62, 0]} castShadow>
          <torusGeometry args={[0.115, 0.022, 14, 40]} />
        </mesh>
        <mesh material={materials.leather} position={[0, 0.44, 0.02]} castShadow>
          <boxGeometry args={[0.19, 0.22, 0.02]} />
        </mesh>
      </group>

      {/* 头部：宽扁的青蛙嘴部轮廓 */}
      <group name="Head" position={[0, 1.0, 0]}>
        <mesh material={materials.fabric} castShadow receiveShadow>
          <sphereGeometry args={[0.5, 48, 36]} />
        </mesh>
        <mesh
          material={materials.fabric}
          position={[0, -0.16, 0.14]}
          scale={[1.22, 0.42, 0.95]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.5, 48, 32]} />
        </mesh>
        <mesh
          material={materials.fabricDark}
          position={[0, -0.3, 0.2]}
          scale={[0.95, 0.16, 0.7]}
          visible={false}
        >
          <sphereGeometry args={[0.5, 24, 16]} />
        </mesh>
      </group>

      {/* 眼睛：白眼球 + 黑眼珠 + 抽褶绿色眼眶 */}
      <group name="Eye.L" ref={eyeLRef} position={[-0.31, 1.28, 0.26]}>
        <mesh material={materials.white} scale={[1, 1, 0.86]} castShadow>
          <sphereGeometry args={[0.135, 32, 24]} />
        </mesh>
        <mesh material={materials.pupil} position={[0.02, 0.0, 0.115]}>
          <sphereGeometry args={[0.045, 24, 18]} />
        </mesh>
        <mesh geometry={geometries.ruchedRing} material={materials.fabric} />
      </group>

      <group name="Eye.R" ref={eyeRRef} position={[0.31, 1.28, 0.26]}>
        <mesh material={materials.white} scale={[1, 1, 0.86]} castShadow>
          <sphereGeometry args={[0.135, 32, 24]} />
        </mesh>
        <mesh material={materials.pupil} position={[-0.02, 0.0, 0.115]}>
          <sphereGeometry args={[0.045, 24, 18]} />
        </mesh>
        <mesh geometry={geometries.ruchedRing} material={materials.fabric} />
      </group>

      {/* 脖子与躯干 */}
      <group name="Body" ref={bodyRef} position={[0, 0.55, 0]}>
        <mesh material={materials.fabric} scale={[1, 1.05, 0.9]} castShadow receiveShadow>
          <sphereGeometry args={[0.42, 40, 30]} />
        </mesh>
      </group>

      {/* 手臂：细长下垂 */}
      <mesh material={materials.fabric} position={[-0.42, 0.62, 0.05]} rotation={[0.12, 0, 0.34]} castShadow>
        <capsuleGeometry args={[0.075, 0.42, 6, 16]} />
      </mesh>
      <mesh material={materials.fabric} position={[0.42, 0.62, 0.05]} rotation={[0.12, 0, -0.34]} castShadow>
        <capsuleGeometry args={[0.075, 0.42, 6, 16]} />
      </mesh>

      {/* 蝴蝶结 */}
      <group name="BowTie" ref={bowTieRef} position={[0, 0.86, 0.34]}>
        <mesh material={materials.bow} position={[-0.09, 0, 0]} rotation={[0, 0, 0.35]} scale={[1, 0.72, 0.5]} castShadow>
          <coneGeometry args={[0.1, 0.16, 4]} />
        </mesh>
        <mesh material={materials.bow} position={[0.09, 0, 0]} rotation={[0, 0, -0.35]} scale={[1, 0.72, 0.5]} castShadow>
          <coneGeometry args={[0.1, 0.16, 4]} />
        </mesh>
        <mesh material={materials.bow} scale={[0.7, 1, 0.7]}>
          <sphereGeometry args={[0.035, 16, 12]} />
        </mesh>
      </group>

      {/* 背带与调节扣 */}
      <mesh material={materials.leather} position={[-0.16, 0.5, 0.3]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[0.05, 0.62, 0.02]} />
      </mesh>
      <mesh material={materials.leather} position={[0.16, 0.5, 0.3]} rotation={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[0.05, 0.62, 0.02]} />
      </mesh>
      <mesh material={materials.metal} position={[-0.15, 0.36, 0.315]}>
        <torusGeometry args={[0.035, 0.011, 8, 20]} />
      </mesh>
      <mesh material={materials.metal} position={[0.15, 0.36, 0.315]}>
        <torusGeometry args={[0.035, 0.011, 8, 20]} />
      </mesh>

      {/* 牛仔灯笼裤 */}
      <group name="Pants" ref={pantsRef} position={[0, 0.16, 0]}>
        <mesh material={materials.denim} position={[-0.17, 0, 0]} scale={[1, 0.92, 0.95]} castShadow receiveShadow>
          <sphereGeometry args={[0.3, 36, 26]} />
        </mesh>
        <mesh material={materials.denim} position={[0.17, 0, 0]} scale={[1, 0.92, 0.95]} castShadow receiveShadow>
          <sphereGeometry args={[0.3, 36, 26]} />
        </mesh>
      </group>

      {/* 脚部 */}
      <mesh material={materials.fabric} position={[-0.12, -0.16, 0.08]} scale={[1, 0.5, 1.25]} castShadow>
        <sphereGeometry args={[0.15, 24, 18]} />
      </mesh>
      <mesh material={materials.fabric} position={[0.12, -0.16, 0.08]} scale={[1, 0.5, 1.25]} castShadow>
        <sphereGeometry args={[0.15, 24, 18]} />
      </mesh>
    </group>
  );
}
