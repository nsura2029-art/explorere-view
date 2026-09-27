import type { Point } from './radialGeometry';

/** Idle "attract" demo timing (ms). */
export const DEMO_START_DELAY_MS = 2000;
export const DEMO_OUT_MS = 550;
export const DEMO_HOLD_MS = 400;
export const DEMO_BACK_MS = 600;
/** Pauses between steps are random within this range. */
export const DEMO_PAUSE_MS: [number, number] = [1000, 2000];
/** After the user touches, the demo waits this long (random within range) with no interaction. */
export const DEMO_RESTART_MS: [number, number] = [8000, 12000];
/** The pulsing item grows to this scale. */
export const DEMO_SCALE = 2;

/**
 * Ring rotation inside the demo: a smooth glide of 2–3 slots forward, then 1–2 slots back,
 * alternating (random amounts). Nothing else moves while it glides.
 */
export const ROTATE_FORWARD: [number, number] = [2, 3];
export const ROTATE_BACK: [number, number] = [1, 2];
/** Glide duration: 3 slots ≈ 2 s, 1 slot ≈ 0.8 s. */
export const rotateDurationMs = (slots: number) => 250 + 580 * Math.abs(slots);

/** Next rotation in slots: positive (clockwise) when `forward`, negative when going back. */
export function nextRotation(forward: boolean, rnd: () => number = Math.random): number {
  const [lo, hi] = forward ? ROTATE_FORWARD : ROTATE_BACK;
  const n = Math.min(hi, lo + Math.floor(rnd() * (hi - lo + 1)));
  return forward ? n : -n;
}

/** Tap-to-move glide: calm, a little longer for longer trips (0.7–1.1 s). */
export const glideDurationMs = (distancePx: number) => Math.min(1100, Math.max(700, 700 + distancePx * 0.4));

export const randomBetween = ([lo, hi]: [number, number], rnd: () => number = Math.random) => lo + rnd() * (hi - lo);

/** How far the pulsing item travels outward: proportional to the node, kept within 50–100 px. */
export const demoDistance = (nodeSize: number) => Math.min(100, Math.max(50, nodeSize * 0.8));

/**
 * Offset that moves a node straight away from the menu center by `dist` px
 * (node and center in the same coordinates).
 */
export function outwardOffset(node: Point, center: Point, dist: number): Point {
  const dx = node.x - center.x;
  const dy = node.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (dx / len) * dist, y: (dy / len) * dist };
}

/**
 * Picks a random item, never `exclude` (the previous one) when another is available. Items in
 * `preferred` (e.g. those whose enlarged pulse stays on screen) are chosen first.
 */
export function pickDemoItem(
  ids: string[],
  exclude: string | null,
  preferred: (id: string) => boolean = () => true,
  rnd: () => number = Math.random,
): string | null {
  const others = ids.filter((id) => id !== exclude);
  const pool = others.filter(preferred);
  const from = pool.length ? pool : others.length ? others : ids;
  if (!from.length) return null;
  return from[Math.min(from.length - 1, Math.floor(rnd() * from.length))];
}
