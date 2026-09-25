import { describe, expect, it } from 'vitest';
import {
  DEMO_PAUSE_MS,
  DEMO_RESTART_MS,
  demoDistance,
  outwardOffset,
  pickDemoItem,
  randomBetween,
} from '../utils/attractDemo';
import { getRadialPositions } from '../utils/radialGeometry';

const IDS = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6', 'item-7', 'item-8'];

describe('pickDemoItem', () => {
  it('never picks the same item twice in a row', () => {
    let last: string | null = null;
    for (let i = 0; i < 500; i++) {
      const id = pickDemoItem(IDS, last);
      expect(id).not.toBe(last);
      last = id;
    }
  });

  it('is random: every item gets picked over many runs', () => {
    const seen = new Set<string>();
    let last: string | null = null;
    for (let i = 0; i < 400; i++) {
      last = pickDemoItem(IDS, last);
      seen.add(last!);
    }
    expect(seen.size).toBe(IDS.length);
  });

  it('prefers items whose pulse fits on screen, but never repeats', () => {
    const onScreen = new Set(['item-2', 'item-3']);
    for (let i = 0; i < 100; i++) {
      const id = pickDemoItem(IDS, 'item-2', (x) => onScreen.has(x));
      expect(id).toBe('item-3');
    }
  });

  it('still picks something when no item fits, and handles a single item', () => {
    expect(IDS).toContain(pickDemoItem(IDS, 'item-1', () => false));
    expect(pickDemoItem(['only'], 'only')).toBe('only');
    expect(pickDemoItem([], null)).toBeNull();
  });
});

describe('outwardOffset', () => {
  const center = { x: 200, y: 200 };
  const nodes = getRadialPositions({ center, radius: 150, itemCount: 8 });

  it.each(nodes.map((n, i) => [i, n] as const))('moves item %i straight away from the center', (_i, node) => {
    const off = outwardOffset(node, center, 75);
    expect(Math.hypot(off.x, off.y)).toBeCloseTo(75, 6);
    const before = Math.hypot(node.x - center.x, node.y - center.y);
    const after = Math.hypot(node.x + off.x - center.x, node.y + off.y - center.y);
    expect(after).toBeCloseTo(before + 75, 6); // outward, never toward the center
  });

  it('works at any ring rotation (no per-item directions)', () => {
    const turned = getRadialPositions({ center, radius: 150, itemCount: 8, startAngle: -90 + 3 * 45 + 17 });
    for (const node of turned) {
      const off = outwardOffset(node, center, 60);
      const cross = (node.x - center.x) * off.y - (node.y - center.y) * off.x;
      expect(Math.abs(cross)).toBeLessThan(1e-6); // parallel to the radius
    }
  });
});

describe('demo distances and timing', () => {
  it('travels 50–100 px outward', () => {
    for (const node of [40, 70, 92, 104, 120, 200]) {
      expect(demoDistance(node)).toBeGreaterThanOrEqual(50);
      expect(demoDistance(node)).toBeLessThanOrEqual(100);
    }
  });

  it('pauses 1–2 s between steps and restarts after 8–12 s', () => {
    expect(DEMO_PAUSE_MS).toEqual([1000, 2000]);
    expect(DEMO_RESTART_MS).toEqual([8000, 12000]);
    for (const r of [0, 0.5, 0.999]) {
      const v = randomBetween(DEMO_RESTART_MS, () => r);
      expect(v).toBeGreaterThanOrEqual(8000);
      expect(v).toBeLessThanOrEqual(12000);
    }
  });
});
