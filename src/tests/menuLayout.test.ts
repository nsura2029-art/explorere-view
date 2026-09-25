import { describe, expect, it } from 'vitest';
import { computeMenuLayout, SUB_SCALE } from '../utils/menuLayout';
import { distance, getRadialPositions } from '../utils/radialGeometry';
import { BRIDGE_CLEARANCE, subMenuDistance } from '../utils/subMenuPlacement';

const VIEWPORTS = [
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
];

describe('submenu is a scaled-down twin of the main menu', () => {
  it.each(VIEWPORTS)('is slightly (but noticeably) smaller than the main menu (%o)', (vp) => {
    const l = computeMenuLayout(vp);
    for (const [sub, main] of [
      [l.sub.ringRadius, l.ringRadius],
      [l.sub.hubSize, l.hubSize],
    ]) {
      const ratio = sub / main;
      expect(ratio).toBeGreaterThanOrEqual(0.78);
      expect(ratio).toBeLessThanOrEqual(0.9);
    }
    expect(l.sub.nodeSize).toBeLessThan(l.nodeSize);
    expect(l.sub.nodeSize).toBeGreaterThanOrEqual(64);
  });

  it.each(VIEWPORTS)('keeps clear space between its hub and items, like the main menu (%o)', (vp) => {
    const l = computeMenuLayout(vp);
    const gap = (ring: number, hub: number, node: number) => ring - hub / 2 - node / 2;
    const mainGap = gap(l.ringRadius, l.hubSize, l.nodeSize);
    const subGap = gap(l.sub.ringRadius, l.sub.hubSize, l.sub.nodeSize);
    expect(subGap).toBeGreaterThan(0);
    expect(subGap / mainGap).toBeGreaterThan(0.6);
  });

  it.each(VIEWPORTS)('never overlaps its own items (%o)', (vp) => {
    const l = computeMenuLayout(vp);
    const pts = getRadialPositions({ center: { x: 0, y: 0 }, radius: l.sub.ringRadius, itemCount: 5 });
    for (let i = 0; i < pts.length; i++) {
      expect(distance(pts[i], pts[(i + 1) % pts.length])).toBeGreaterThan(l.sub.nodeSize);
    }
  });

  it('uses the documented scale', () => {
    expect(SUB_SCALE).toBeGreaterThan(0.78);
    expect(SUB_SCALE).toBeLessThan(0.9);
  });
});

describe('bridge from main item to submenu', () => {
  it.each(VIEWPORTS)('leaves a clearly visible gap before the nearest sub items (%o)', (vp) => {
    const l = computeMenuLayout(vp);
    const d = subMenuDistance(l, 5);
    // nearest sub items sit either side of the bridge, 36° off its axis
    const half = (36 * Math.PI) / 180;
    const near = { x: d - l.sub.ringRadius * Math.cos(half), y: l.sub.ringRadius * Math.sin(half) };
    const clear = Math.hypot(near.x, near.y) - l.nodeSize / 2 - l.sub.nodeSize / 2;
    expect(clear).toBeCloseTo(l.nodeSize * BRIDGE_CLEARANCE, 6);
    // and the visible bridge itself (item rim → sub hub rim) is long
    expect(d - l.nodeSize / 2 - l.sub.hubSize / 2).toBeGreaterThan(l.nodeSize * 0.5);
  });

  it('is longer than a shortened fallback bridge', () => {
    const l = computeMenuLayout({ width: 1536, height: 864 });
    expect(subMenuDistance(l, 5)).toBeGreaterThan(subMenuDistance(l, 5, 0.27));
  });
});
