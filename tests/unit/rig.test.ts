import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findNode, resolveHotspotId, createEmptyParts } from '../../src/components/viewer/rig';

function buildScene() {
  const root = new THREE.Group();
  root.name = 'FrogRoot';

  const pivot = new THREE.Group();
  pivot.name = 'SuspensionPivot';
  root.add(pivot);

  const assembly = new THREE.Group();
  assembly.name = 'FrogAssembly';
  pivot.add(assembly);

  // three.js 会把节点名中的 "." 去掉，这里模拟运行时真实情况
  const eye = new THREE.Mesh();
  eye.name = 'EyeL';
  assembly.add(eye);

  const body = new THREE.Mesh();
  body.name = 'Body';
  assembly.add(body);

  return { root, pivot, assembly, eye, body };
}

describe('findNode', () => {
  it('能按原始名字找到节点', () => {
    const { root, body } = buildScene();

    expect(findNode(root, 'Body')).toBe(body);
  });

  it('节点名中的点被 three.js 清理后仍能命中', () => {
    const { root, eye } = buildScene();

    expect(findNode(root, 'Eye.L')).toBe(eye);
  });

  it('找不到时返回 null', () => {
    const { root } = buildScene();

    expect(findNode(root, 'NotExist')).toBeNull();
    expect(findNode(null, 'Body')).toBeNull();
  });
});

describe('resolveHotspotId', () => {
  it('沿父级链找到热区标记', () => {
    const { eye } = buildScene();
    eye.userData.hotspotId = 'eye';

    expect(resolveHotspotId(eye)).toBe('eye');
  });

  it('没有标记时返回 null', () => {
    const { eye } = buildScene();

    expect(resolveHotspotId(eye)).toBeNull();
    expect(resolveHotspotId(null)).toBeNull();
  });
});

describe('createEmptyParts', () => {
  it('初始化所有引用为空', () => {
    const parts = createEmptyParts();

    expect(parts.root).toBeNull();
    expect(parts.suspensionPivot).toBeNull();
    expect(parts.body).toBeNull();
    expect(parts.bowTie).toBeNull();
    expect(parts.pants).toBeNull();
    expect(parts.eyes.L).toBeNull();
    expect(parts.eyes.R).toBeNull();
    expect(parts.eyelids.L).toBeNull();
    expect(parts.eyelids.R).toBeNull();
  });
});
