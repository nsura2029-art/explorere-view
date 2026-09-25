import { describe, expect, it } from 'vitest';
import { clampMenuPosition } from '../utils/clampPosition';
import { computeMenuLayout, EDGE_MARGIN } from '../utils/menuLayout';
import { distance, getRadialPositions, type Point } from '../utils/radialGeometry';
import { computeSubMenuPlacement, ORBIT_GAP } from '../utils/subMenuPlacement';
import { outerOrbitRadius } from '../utils/menuLayout';

const ITEMS = 8;
const SUBS = 5;

type Circle = Point & { r: number };

function circlesFor(viewport: { width: number; height: number }, menuCenter: Point, itemIndex: number) {
  const layout = computeMenuLayout(viewport);
  const p = computeSubMenuPlacement({
    itemIndex,
    itemCount: ITEMS,
    subCount: SUBS,
    layout,
    menuCenter,
    viewport,
    margin: EDGE_MARGIN,
  });
  const origin = { x: 0, y: 0 };
  const main: Circle[] = [
    { ...origin, r: layout.hubSize / 2 },
    ...getRadialPositions({ center: origin, radius: layout.ringRadius, itemCount: ITEMS }).map((q) => ({
      ...q,
      r: layout.nodeSize / 2,
    })),
  ];
  const sub: Circle[] = [
    { ...p.center, r: layout.sub.hubSize / 2 },
    ...getRadialPositions({
      center: p.center,
      radius: layout.sub.ringRadius,
      itemCount: SUBS,
      startAngle: p.startAngle,
    }).map((q) => ({ ...q, r: layout.sub.nodeSize / 2 })),
  ];
  return { layout, placement: p, main, sub };
}

const VIEWPORTS = [
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
];

describe('computeSubMenuPlacement', () => {
  it.each(VIEWPORTS)('never overlaps main nodes or hub (%o)', (viewport) => {
    const positions = [
      { x: viewport.width / 2, y: viewport.height / 2 },
      { x: 0, y: 0 },
      { x: viewport.width, y: viewport.height },
      { x: 0, y: viewport.height },
      { x: viewport.width, y: 0 },
    ];
    for (const raw of positions) {
      const layout = computeMenuLayout(viewport);
      const center = clampMenuPosition({ desiredPosition: raw, viewport, menuRadius: layout.extent, margin: EDGE_MARGIN });
      for (let i = 0; i < ITEMS; i++) {
        const { main, sub } = circlesFor(viewport, center, i);
        for (const s of sub) for (const m of main) expect(distance(s, m)).toBeGreaterThanOrEqual(s.r + m.r);
      }
    }
  });

  it('grows straight outward from the item when there is room', () => {
    const viewport = { width: 1920, height: 1080 };
    const center = { x: 960, y: 520 };
    const { placement } = circlesFor(viewport, center, 2); // Item 3 points right
    expect(placement.shift).toEqual({ x: 0, y: 0 });
    expect(placement.center.y).toBeCloseTo(placement.from.y, 6);
    expect(placement.center.x).toBeGreaterThan(placement.from.x);
  });

  it.each(VIEWPORTS)('menu + submenu fit on screen after the shift, from every corner (%o)', (viewport) => {
    const layout = computeMenuLayout(viewport);
    const corners = [
      { x: 0, y: 0 },
      { x: viewport.width, y: 0 },
      { x: 0, y: viewport.height },
      { x: viewport.width, y: viewport.height },
    ];
    for (const raw of corners) {
      const start = clampMenuPosition({ desiredPosition: raw, viewport, menuRadius: layout.extent, margin: EDGE_MARGIN });
      for (let i = 0; i < ITEMS; i++) {
        const { placement, sub } = circlesFor(viewport, start, i);
        const c = { x: start.x + placement.shift.x, y: start.y + placement.shift.y };
        // main menu stays in its own safe bounds
        expect(clampMenuPosition({ desiredPosition: c, viewport, menuRadius: layout.extent, margin: EDGE_MARGIN })).toEqual(c);
        for (const s of sub) {
          expect(c.x + s.x - s.r).toBeGreaterThanOrEqual(0);
          expect(c.y + s.y - s.r).toBeGreaterThanOrEqual(0);
          expect(c.x + s.x + s.r).toBeLessThanOrEqual(viewport.width);
          expect(c.y + s.y + s.r).toBeLessThanOrEqual(viewport.height);
        }
      }
    }
  });

  it('follows the ticking ring: submenu grows from the item where it currently is', () => {
    const viewport = { width: 1920, height: 1080 };
    const layout = computeMenuLayout(viewport);
    const base = { itemCount: ITEMS, subCount: SUBS, layout, menuCenter: { x: 960, y: 540 }, viewport, margin: EDGE_MARGIN };
    // Item 1 ticked two slots clockwise sits where Item 3 normally is (3 o'clock).
    const ticked = computeSubMenuPlacement({ ...base, itemIndex: 0, startAngle: -90 + 2 * 45 });
    const plain = computeSubMenuPlacement({ ...base, itemIndex: 2 });
    expect(ticked.from.x).toBeCloseTo(plain.from.x, 6);
    expect(ticked.from.y).toBeCloseTo(plain.from.y, 6);
    expect(ticked.center.x).toBeCloseTo(plain.center.x, 6);
    expect(ticked.center.y).toBeCloseTo(plain.center.y, 6);
  });

  it.each(VIEWPORTS)('keeps the two outer circles apart, with a visible gap (%o)', (viewport) => {
    const layout = computeMenuLayout(viewport);
    const mainOrbit = outerOrbitRadius(layout.ringRadius, layout.nodeSize);
    const subOrbit = outerOrbitRadius(layout.sub.ringRadius, layout.sub.nodeSize);
    const gap = layout.nodeSize * ORBIT_GAP;
    const spots = [
      { x: viewport.width / 2, y: viewport.height / 2 },
      { x: 0, y: 0 },
      { x: viewport.width, y: 0 },
      { x: 0, y: viewport.height },
      { x: viewport.width, y: viewport.height },
    ];
    for (const raw of spots) {
      const center = clampMenuPosition({ desiredPosition: raw, viewport, menuRadius: layout.extent, margin: EDGE_MARGIN });
      for (const ringStep of [0, 1, 3]) {
        for (let i = 0; i < ITEMS; i++) {
          const p = computeSubMenuPlacement({
            itemIndex: i,
            itemCount: ITEMS,
            subCount: SUBS,
            layout,
            menuCenter: center,
            viewport,
            margin: EDGE_MARGIN,
            startAngle: -90 + ringStep * 45,
          });
          expect(Math.hypot(p.center.x, p.center.y)).toBeGreaterThanOrEqual(mainOrbit + subOrbit + gap - 1e-6);
        }
      }
    }
  });
});

