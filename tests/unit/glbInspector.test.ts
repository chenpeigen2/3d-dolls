import { describe, expect, it } from 'vitest';
import { inspectGlb } from '../../src/lib/glbInspector';

/** 构造一个最小可用的 GLB（只有 JSON 区块）用于测试。 */
function buildGlb(json: object): ArrayBuffer {
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(Math.ceil(jsonBytes.length / 4) * 4);
  jsonPadded.set(jsonBytes);

  const totalLength = 12 + 8 + jsonPadded.length;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  bytes.set(jsonPadded, 20);

  return buffer;
}

describe('inspectGlb', () => {
  it('解析出节点名并校验必需节点', () => {
    const buffer = buildGlb({
      nodes: [{ name: 'FrogRoot' }, { name: 'SuspensionPivot' }, { name: 'Body' }],
      materials: [{ name: 'FabricGreen' }],
    });

    const result = inspectGlb(buffer, ['FrogRoot', 'SuspensionPivot', 'Body']);

    expect(result.nodes).toContain('FrogRoot');
    expect(result.missing).toEqual([]);
    expect(result.materialCount).toBe(1);
  });

  it('报告缺少的节点', () => {
    const buffer = buildGlb({ nodes: [{ name: 'Body' }] });

    const result = inspectGlb(buffer, ['FrogRoot', 'SuspensionPivot', 'Body']);

    expect(result.missing).toEqual(['FrogRoot', 'SuspensionPivot']);
  });

  it('兼容 three.js 清理过节点名的情况', () => {
    const buffer = buildGlb({ nodes: [{ name: 'FrogRoot' }, { name: 'SuspensionPivot' }, { name: 'Body' }, { name: 'EyeL' }] });

    const result = inspectGlb(buffer, ['Eye.L']);

    expect(result.missing).toEqual([]);
  });

  it('非法文件抛出可读错误', () => {
    expect(() => inspectGlb(new ArrayBuffer(4), ['Body'])).toThrow(/长度不足/);
  });

  it('非 GLB 魔数抛出可读错误', () => {
    const buffer = new ArrayBuffer(16);
    new DataView(buffer).setUint32(0, 0x12345678, true);

    expect(() => inspectGlb(buffer, ['Body'])).toThrow(/合法的 GLB/);
  });
});
