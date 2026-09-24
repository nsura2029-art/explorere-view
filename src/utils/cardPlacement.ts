import { clamp, type Viewport } from './clampPosition';
import type { Point } from './radialGeometry';

export const CARD_MARGIN = 12;
const CAPTION_H = 52;

/** Card size from the viewport's short side (image keeps the scene aspect). */
export function cardSize(viewport: Viewport, aspect: number): { width: number; height: number } {
  const width = Math.round(clamp(Math.min(viewport.width, viewport.height) * 0.36, 200, 380));
  return { width, height: Math.round(width * aspect) + CAPTION_H };
}

/** Nearest card center that keeps the whole card on screen. */
export function clampCardCenter(p: Point, width: number, height: number, viewport: Viewport): Point {
  const axis = (v: number, half: number, size: number) =>
    size < (half + CARD_MARGIN) * 2 ? size / 2 : clamp(v, half + CARD_MARGIN, size - half - CARD_MARGIN);
  return { x: axis(p.x, width / 2, viewport.width), y: axis(p.y, height / 2, viewport.height) };
}

export type Obstacle = Point & { r: number };

/** How deep a circle reaches into the card rectangle (0 when they don't touch). */
function penetration(o: Obstacle, c: Point, width: number, height: number): number {
  const dx = Math.max(Math.abs(o.x - c.x) - width / 2, 0);
  const dy = Math.max(Math.abs(o.y - c.y) - height / 2, 0);
  return Math.max(o.r - Math.hypot(dx, dy), 0);
}

/** Directions tried around the preferred one (degrees). */
const OFFSETS = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
/** Distances (px beyond the item rim) tried in each direction. */
const GAPS = [22, 70, 130];

/**
 * Center for a card attached to a sub item: just beyond the item, preferably along `dir`
 * (unit vector pointing away from the submenu hub). When the screen edge would push the card
 * back over the menus, other directions around the item are tried and the least-covering wins.
 */
export function attachedCardCenter(
  itemCenter: Point,
  dir: Point,
  itemRadius: number,
  width: number,
  height: number,
  viewport: Viewport,
  obstacles: Obstacle[] = [],
): Point {
  const base = Math.atan2(dir.y, dir.x);
  let best: { c: Point; score: number } | null = null;
  for (const off of OFFSETS) {
    const a = base + (off * Math.PI) / 180;
    const u = { x: Math.cos(a), y: Math.sin(a) };
    const support = Math.abs(u.x) * (width / 2) + Math.abs(u.y) * (height / 2);
    for (const gap of GAPS) {
      const d = itemRadius + gap + support;
      const c = clampCardCenter({ x: itemCenter.x + u.x * d, y: itemCenter.y + u.y * d }, width, height, viewport);
      const cover = obstacles.reduce((sum, o) => sum + penetration(o, c, width, height), 0);
      const score = cover * 20 + Math.hypot(c.x - itemCenter.x, c.y - itemCenter.y) * 0.2 + Math.abs(off) * 0.3;
      if (!best || score < best.score) best = { c, score };
    }
  }
  return best!.c;
}
