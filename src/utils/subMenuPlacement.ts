import type { Viewport } from './clampPosition';
import { outerOrbitRadius, type MenuLayout } from './menuLayout';
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
/**
 * Visible bridge length between the selected main item and the nearest sub items, as a fraction of
 * the main node size (keeps the spacing proportional on every screen).
 */
export const BRIDGE_CLEARANCE = 0.55;
/**
 * Clear space kept between the main menu's outer circle and the submenu's outer circle, as a
 * fraction of the main node size. The two circles never overlap.
 */
export const ORBIT_GAP = 0.35;

/** Minimum distance between the main menu center and the submenu center (outer circles apart). */
export function minCenterDistance(layout: MenuLayout): number {
  return (
    outerOrbitRadius(layout.ringRadius, layout.nodeSize) +
    outerOrbitRadius(layout.sub.ringRadius, layout.sub.nodeSize) +
    layout.nodeSize * ORBIT_GAP
  );
}

/**
 * Distance along `u` (unit) from point `p` to where the ray leaves the circle of radius `r`
 * around the origin (p is inside it).
 */
function rayExit(p: Point, u: Point, r: number): number {
  const b = p.x * u.x + p.y * u.y;
  const c = p.x * p.x + p.y * p.y - r * r;
  return -b + Math.sqrt(Math.max(b * b - c, 0));
}

/** Shorter bridges tried (in order) only when the full-length one can't fit on screen. */
const CLEARANCE_STEPS = [BRIDGE_CLEARANCE, 0.45, 0.35, 0.27];
/** Placement cost weights: moving the main menu (per px) > shortening the bridge (per px) > turning (per °). */
const COST_SHIFT = 3;
const COST_SHORTEN = 1.5;
const COST_OVERFLOW = 12;
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
export function subMenuDistance(layout: MenuLayout, subCount: number, clearanceFrac = BRIDGE_CLEARANCE): number {
  const R = layout.nodeSize / 2;
  const r = layout.sub.nodeSize / 2;
  const s = layout.sub.ringRadius;
  const half = (180 / subCount) * DEG;
  const clearance = layout.nodeSize * clearanceFrac;
  const reach = R + r + clearance;
  const lateral = s * Math.sin(half);
  const byItems = s * Math.cos(half) + Math.sqrt(Math.max(reach * reach - lateral * lateral, 0));
  const byHub = R + layout.sub.hubSize / 2 + clearance;
  return Math.max(byItems, byHub);
}

/**
 * Places a submenu next to its main item. Prefers growing straight outward on a full-length bridge;
 * when that would leave the screen it turns around the item, then shortens the bridge a little,
 * and as a last resort reports how far the main menu must shift (never out of its own safe
 * bounds). Never overlaps the main menu's nodes or hub.
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
  const half = 180 / subCount;
  const subExtent = layout.sub.extent;
  const dFull = subMenuDistance(layout, subCount);
  const minCenter = minCenterDistance(layout);
  // How far the main menu itself may move and still be fully on screen.
  const mainRange = (c: number, size: number) => {
    const lo = layout.extent + margin - c;
    const hi = size - layout.extent - margin - c;
    return lo <= hi ? [lo, hi] : [0, 0];
  };
  const [sxLo, sxHi] = mainRange(menuCenter.x, viewport.width);
  const [syLo, syHi] = mainRange(menuCenter.y, viewport.height);
  const overflow = (min: number, max: number, lo: number, hi: number) => Math.max(0, lo - min) + Math.max(0, max - hi);

  let best: (SubMenuPlacement & { score: number }) | null = null;
  search: for (const frac of CLEARANCE_STEPS) {
    const dItems = frac === BRIDGE_CLEARANCE ? dFull : subMenuDistance(layout, subCount, frac);
    for (const dev of DEVIATIONS) {
      const psi = (item.angle + dev) * DEG;
      const u = { x: Math.cos(psi), y: Math.sin(psi) };
      // Far enough that no sub item touches the main item AND the two outer circles stay apart.
      const d = Math.max(dItems, rayExit(item, u, minCenter));
      const center = { x: item.x + u.x * d, y: item.y + u.y * d };
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
        x: Math.min(Math.max(axisShift(minX, maxX, margin, viewport.width - margin), sxLo), sxHi),
        y: Math.min(Math.max(axisShift(minY, maxY, margin, viewport.height - margin), syLo), syHi),
      };
      const left =
        overflow(minX + shift.x, maxX + shift.x, margin, viewport.width - margin) +
        overflow(minY + shift.y, maxY + shift.y, margin, viewport.height - margin);
      const score =
        Math.hypot(shift.x, shift.y) * COST_SHIFT +
        left * COST_OVERFLOW +
        (dFull - dItems) * COST_SHORTEN +
        Math.abs(dev);
      if (!best || score < best.score) best = { center, from: { x: item.x, y: item.y }, startAngle, shift, score };
      if (score === 0) break search;
    }
  }
  // dev 0 is always accepted, so best is set.
  const { score: _score, ...placement } = best!;
  return placement;
}
