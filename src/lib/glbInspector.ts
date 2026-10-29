/**
 * 轻量 GLB 检查器：只读取文件头与 JSON 区块，不解析几何数据。
 *
 * 用途是在把模型交给 Three.js 之前，先确认文件可访问且包含必需节点，
 * 避免加载失败时把错误抛进 R3F 渲染树（那会导致整个 Canvas 被卸载）。
 */

export interface GlbInspection {
  /** 全部节点名 */
  nodes: string[];
  /** 缺少的必需节点 */
  missing: string[];
  /** 材质数量 */
  materialCount: number;
}

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'

/** 解析 GLB 二进制，提取节点名并校验必需节点。 */
export function inspectGlb(buffer: ArrayBuffer, requiredNodes: readonly string[]): GlbInspection {
  const view = new DataView(buffer);

  if (view.byteLength < 12) {
    throw new Error('GLB 文件长度不足');
  }

  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error('不是合法的 GLB 文件');
  }

  const totalLength = view.getUint32(8, true);
  if (totalLength > view.byteLength) {
    throw new Error('GLB 文件被截断');
  }

  let offset = 12;
  let jsonText: string | null = null;

  while (offset + 8 <= Math.min(totalLength, view.byteLength)) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;

    if (chunkType === CHUNK_TYPE_JSON) {
      const bytes = new Uint8Array(buffer, chunkStart, chunkLength);
      jsonText = new TextDecoder().decode(bytes);
      // JSON 区块按规范用空格补齐，但部分导出器使用 0x00，这里统一去掉尾部填充
      jsonText = jsonText.replace(/[\u0000\s]+$/, '');
      break;
    }

    offset = chunkStart + chunkLength + ((4 - (chunkLength % 4)) % 4);
  }

  if (jsonText === null) {
    throw new Error('GLB 中找不到 JSON 区块');
  }

  const json = JSON.parse(jsonText) as {
    nodes?: Array<{ name?: string }>;
    materials?: Array<unknown>;
  };

  const nodes = (json.nodes ?? []).map((node) => node.name ?? '');

  // three.js 会用 PropertyBinding.sanitizeNodeName 清理节点名，其中的 "." 会被去掉
  const sanitized = (name: string) => name.replace(/\./g, '');
  const missing = requiredNodes.filter(
    (name) => !nodes.includes(name) && !nodes.includes(sanitized(name)),
  );

  return {
    nodes,
    missing,
    materialCount: (json.materials ?? []).length,
  };
}
