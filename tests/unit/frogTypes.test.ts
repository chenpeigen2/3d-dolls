import { describe, expect, it } from 'vitest';
import { HOTSPOTS, HOTSPOT_BY_ID, type HotspotId } from '../../src/types/frog';

describe('热区定义', () => {
  it('覆盖计划要求的四个交互部位', () => {
    expect(HOTSPOTS.map((hotspot) => hotspot.id)).toEqual<HotspotId[]>([
      'eye',
      'body',
      'bowTie',
      'pants',
    ]);
  });

  it('每个热区都有标题、说明与锚点', () => {
    for (const hotspot of HOTSPOTS) {
      expect(hotspot.label.length).toBeGreaterThan(0);
      expect(hotspot.description.length).toBeGreaterThan(10);
      expect(hotspot.anchor.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.anchor.x).toBeLessThanOrEqual(100);
      expect(hotspot.anchor.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.anchor.y).toBeLessThanOrEqual(100);
    }
  });

  it('HOTSPOT_BY_ID 可以按 id 取回定义', () => {
    for (const hotspot of HOTSPOTS) {
      expect(HOTSPOT_BY_ID[hotspot.id]).toBe(hotspot);
    }
  });
});
