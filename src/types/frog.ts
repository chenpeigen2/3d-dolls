/**
 * 娃娃交互热区与材质介绍的共享类型。
 * 这些 ID 同时用于：
 * 1. WebGL 内的射线拾取（点击部位）
 * 2. 屏幕空间 HTML 标记（无 WebGL 时的可访问性替代）
 */

export type HotspotId = 'eye' | 'body' | 'bowTie' | 'pants';

export interface HotspotDefinition {
  id: HotspotId;
  /** 中文名称，用于 UI 展示 */
  label: string;
  /** 材质介绍文案 */
  description: string;
  /** 屏幕空间标记的相对位置（百分比） */
  anchor: { x: number; y: number };
}

export const HOTSPOTS: readonly HotspotDefinition[] = [
  {
    id: 'eye',
    label: '凸起的眼睛',
    description:
      '白色棉布眼白向外鼓起，中心是一颗小巧的黑色亮面眼珠；周围一圈绿色褶皱包边，是整个挂件最显眼的特征。',
    anchor: { x: 30, y: 38 },
  },
  {
    id: 'body',
    label: '棉麻身体',
    description:
      '身体采用绿色棉麻布料填充，内部蓬松柔软，按压会有明显的回弹感，手工缝制因此保留了一点不规则的味道。',
    anchor: { x: 50, y: 58 },
  },
  {
    id: 'bowTie',
    label: '格纹蝴蝶结',
    description:
      '红棕格纹布裁成的蝴蝶结，中间用一小段红色织带束紧，是整体造型里唯一的暖色点缀。',
    anchor: { x: 50, y: 46 },
  },
  {
    id: 'pants',
    label: '牛仔灯笼裤',
    description:
      '蓝色牛仔布的灯笼裤，裤腿蓬松饱满，边缘用白色装饰线走了一圈针脚，背带由橙棕色皮革与黄铜调节扣固定。',
    anchor: { x: 50, y: 76 },
  },
] as const;

export const HOTSPOT_BY_ID: Record<HotspotId, HotspotDefinition> = HOTSPOTS.reduce(
  (acc, hotspot) => {
    acc[hotspot.id] = hotspot;
    return acc;
  },
  {} as Record<HotspotId, HotspotDefinition>,
);
