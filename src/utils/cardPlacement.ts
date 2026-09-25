import { clamp, type Viewport } from './clampPosition';
import type { Point } from './radialGeometry';

export const CARD_MARGIN = 12;
/** Height of the title bar under the image; it keeps this size when the card is zoomed. */
export const CAPTION_H = 52;
/** Smallest a card can be pinched down to (px wide). */
export const MIN_CARD_WIDTH = 160;

/** Card height for a given width (image keeps the scene aspect, caption stays fixed). */
export const cardHeightFor = (width: number, aspect: number) => Math.round(width * aspect) + CAPTION_H;

/** Card size from the viewport's short side (image keeps the scene aspect). */
export function cardSize(viewport: Viewport, aspect: number): { width: number; height: number } {
  const width = Math.round(clamp(Math.min(viewport.width, viewport.height) * 0.36, 200, 380));
  return { width, height: cardHeightFor(width, aspect) };
}

/** A zoomed card never gets wider than this share of the screen (the other half is the menus'). */
export const MAX_CARD_SHARE = 0.5;
/** Space kept clear at the top for the top-right screen info ("Open screens"), when not measurable. */
export const DEFAULT_TOP_INSET = 76;
/** A card this much wider than its default size counts as "zoomed in" and opens split view. */
export const SPLIT_ZOOM_RATIO = 1.15;

/**
 * Widest a card can be zoomed to: half the screen, and short enough to fit between the bottom
 * of the top-right screen info (`topInset`) and the bottom edge.
 */
export function maxCardWidth(
  viewport: Viewport,
  aspect: number,
  topInset = DEFAULT_TOP_INSET,
  bottom = viewport.height - CARD_MARGIN,
): number {
  const byWidth = viewport.width * MAX_CARD_SHARE - CARD_MARGIN * 2;
  const byHeight = (bottom - topInset - CAPTION_H) / aspect;
  return Math.max(MIN_CARD_WIDTH, Math.floor(Math.min(byWidth, byHeight)));
}

/** Clamps a zoomed card width between the minimum and the maximum above. */
export const clampCardWidth = (
  width: number,
  viewport: Viewport,
  aspect: number,
  topInset = DEFAULT_TOP_INSET,
  bottom = viewport.height - CARD_MARGIN,
) => clamp(width, MIN_CARD_WIDTH, maxCardWidth(viewport, aspect, topInset, bottom));

/** True when a card of this width is zoomed in far enough to open split view. */
export const isZoomedIn = (width: number, viewport: Viewport, aspect: number) =>
  width > cardSize(viewport, aspect).width * SPLIT_ZOOM_RATIO;

export type Region = { left: number; top: number; right: number; bottom: number };

/**
 * Split view: where the active card lives — the right half, below the screen info and above the
 * tray of earlier images (`bottom`).
 */
export function cardSplitRegion(
  viewport: Viewport,
  topInset = DEFAULT_TOP_INSET,
  bottom = viewport.height - CARD_MARGIN,
): Region {
  return {
    left: viewport.width * (1 - MAX_CARD_SHARE) + CARD_MARGIN,
    top: topInset,
    right: viewport.width - CARD_MARGIN,
    bottom,
  };
}

/** Earlier images wait as thumbnails in a tray: at most this many. */
export const MAX_SHELF = 5;
/** Title bar height on a tray thumbnail (smaller than a full card's). */
export const THUMB_CAPTION_H = 36;
const THUMB_MAX_W = 190;
const THUMB_GAP = 10;
/** Space between the tray and the active card above it. */
const SHELF_GAP = 14;

export type Slot = { x: number; y: number; width: number; height: number };

/**
 * The tray of earlier images: thumbnails side by side along the bottom of the right half,
 * right-aligned (index 0 = oldest, furthest left). `top` is where the active card must stop.
 */
export function shelfLayout(viewport: Viewport, count: number, aspect: number): { slots: Slot[]; top: number } {
  const bottom = viewport.height - CARD_MARGIN;
  if (count <= 0) return { slots: [], top: bottom };
  const right = viewport.width - CARD_MARGIN;
  const avail = viewport.width * MAX_CARD_SHARE - CARD_MARGIN * 2;
  // As large as possible (up to THUMB_MAX_W) while the whole row stays inside the right half.
  const width = Math.floor(Math.min(THUMB_MAX_W, (avail - THUMB_GAP * (count - 1)) / count));
  const height = Math.round(width * aspect) + THUMB_CAPTION_H;
  const y = bottom - height / 2;
  const slots = Array.from({ length: count }, (_, i) => ({
    x: right - width / 2 - (count - 1 - i) * (width + THUMB_GAP),
    y,
    width,
    height,
  }));
  return { slots, top: bottom - height - SHELF_GAP };
}

/** Split view: where the menus live — the left half. */
export function menuSplitRegion(viewport: Viewport, margin: number): Region {
  return { left: margin, top: margin, right: viewport.width * (1 - MAX_CARD_SHARE) - margin, bottom: viewport.height - margin };
}

/** Nearest center that keeps a width×height box inside `region` (centered on an axis that is too small). */
export function clampIntoRegion(p: Point, width: number, height: number, region: Region): Point {
  const axis = (v: number, half: number, lo: number, hi: number) =>
    hi - lo < half * 2 ? (lo + hi) / 2 : clamp(v, lo + half, hi - half);
  return { x: axis(p.x, width / 2, region.left, region.right), y: axis(p.y, height / 2, region.top, region.bottom) };
}

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Split view for the menus: the scale (≤ 1) and center that fit `box` (the menus' outline relative to
 * the main menu center, at scale 1) inside `region`, centered in it.
 */
export function fitMenusInRegion(box: Box, region: Region): { center: Point; scale: number } {
  const bw = box.maxX - box.minX;
  const bh = box.maxY - box.minY;
  const scale = Math.min(1, (region.right - region.left) / bw, (region.bottom - region.top) / bh);
  const midX = (box.minX + box.maxX) / 2;
  const midY = (box.minY + box.maxY) / 2;
  return {
    scale,
    center: {
      x: (region.left + region.right) / 2 - midX * scale,
      y: (region.top + region.bottom) / 2 - midY * scale,
    },
  };
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
const GAPS = [22, 70, 130, 200];

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
