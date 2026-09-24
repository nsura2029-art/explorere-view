import type { Viewport } from './clampPosition';
import type { MenuLayout } from './menuLayout';
import { distance, getRadialPositions, type Point } from './radialGeometry';

export type SubMenuPlacement = {
  /** Submenu hub center, relative to the main menu center. */
  center: Point;
  /** Main item node center the submenu grows from, relative to the main menu center. */
  from: Point;
  /** startAngle for the submenu items; the gap between two items faces `from`. */
  startAngle: number;
  /** Main menu translation needed so menu + submenu fit on screen (0,0 when it already fits). */
  shift: Point;
};

type Options = {
  itemIndex: number;
  itemCount: number;
  subCount: number;
  layout: MenuLayout;
  /** Main menu center, viewport coordinates. */
  menuCenter: Point;
  viewport: Viewport;
  margin: number;
  /** Angle of main item 0 in degrees (-90 = 12 o'clock; changes as the ring ticks round). */
  startAngle?: number;
};

const DEG = Math.PI / 180;
const CLEARANCE = 28;
/** Angular deviations (from straight outward) tried when the submenu does not fit. */
const DEVIATIONS = [0, ...Array.from({ length: 10 }, (_, i) => [(i + 1) * 10, -(i + 1) * 10]).flat()];

type Circle = Point & { r: number };

const overlaps = (a: Circle, b: Circle, pad: number) => distance(a, b) < a.r + b.r + pad;

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}

/** Shift along one axis that brings [min,max] inside [lo,hi]; centers it when it cannot fit. */
function axisShift(min: number, max: number, lo: number, hi: number): number {
  if (max - min > hi - lo) return (lo + hi) / 2 - (min + max) / 2;
  if (min < lo) return lo - min;
  if (max > hi) return hi - max;
  return 0;
}

/** Hub-center distance from the selected main node so no submenu node touches it. */
export function subMenuDistance(layout: MenuLayout, subCount: number): number {
  const R = layout.nodeSize / 2;
  const r = layout.sub.nodeSize / 2;
  const s = layout.sub.ringRadius;
  const half = (180 / subCount) * DEG;
  const reach = R + r + CLEARANCE;
  const lateral = s * Math.sin(half);
  const byItems = s * Math.cos(half) + Math.sqrt(Math.max(reach * reach - lateral * lateral, 0));
  const byHub = R + layout.sub.hubSize / 2 + 24;
  return Math.max(byItems, byHub);
}

/**
 * Places a submenu next to its main item. Prefers growing straight outward; rotates around the
 * item when that would leave the screen, and as a last resort reports how far the main menu must
 * shift so both fit. Never overlaps the main menu's nodes or hub.
 */
export function computeSubMenuPlacement({
  itemIndex,
  itemCount,
  subCount,
  layout,
  menuCenter,
  viewport,
  margin,
  startAngle: ringStart = -90,
}: Options): SubMenuPlacement {
  const origin = { x: 0, y: 0 };
  const mainNodes = getRadialPositions({ center: origin, radius: layout.ringRadius, itemCount, startAngle: ringStart });
  const item = mainNodes[itemIndex];
  const R = layout.nodeSize / 2;
  const mainCircles: Circle[] = [
    { ...origin, r: layout.hubSize / 2 },
    ...mainNodes.filter((_, i) => i !== itemIndex).map((p) => ({ x: p.x, y: p.y, r: R })),
  ];
  const d = subMenuDistance(layout, subCount);
  const half = 180 / subCount;
  const subExtent = layout.sub.extent;

  let best: (SubMenuPlacement & { score: number }) | null = null;
  for (const dev of DEVIATIONS) {
    const psi = (item.angle + dev) * DEG;
    const center = { x: item.x + Math.cos(psi) * d, y: item.y + Math.sin(psi) * d };
    const back = Math.atan2(item.y - center.y, item.x - center.x) / DEG;
    const startAngle = back + half;

    if (dev !== 0) {
      const subCircles: Circle[] = [
        { ...center, r: layout.sub.hubSize / 2 },
        ...getRadialPositions({ center, radius: layout.sub.ringRadius, itemCount: subCount, startAngle }).map(
          (p) => ({ x: p.x, y: p.y, r: layout.sub.nodeSize / 2 }),
        ),
      ];
      const collides = subCircles.some((sc) => mainCircles.some((mc) => overlaps(sc, mc, 6)));
      const bridgeCrosses = mainCircles.slice(1).some((mc) => segmentDistance(mc, item, center) < R + 4);
      if (collides || bridgeCrosses) continue;
    }

    const minX = Math.min(-layout.extent, center.x - subExtent) + menuCenter.x;
    const maxX = Math.max(layout.extent, center.x + subExtent) + menuCenter.x;
    const minY = Math.min(-layout.extent, center.y - subExtent) + menuCenter.y;
    const maxY = Math.max(layout.extent, center.y + subExtent) + menuCenter.y;
    const shift = {
      x: axisShift(minX, maxX, margin, viewport.width - margin),
      y: axisShift(minY, maxY, margin, viewport.height - margin),
    };
    const score = Math.hypot(shift.x, shift.y) * 3 + Math.abs(dev);
    if (!best || score < best.score) best = { center, from: { x: item.x, y: item.y }, startAngle, shift, score };
    if (score === 0) break;
  }
  // dev 0 is always accepted, so best is set.
  const { score: _score, ...placement } = best!;
  return placement;
}
