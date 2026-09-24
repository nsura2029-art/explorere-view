import type { Point } from './radialGeometry';

/**
 * Pre-interaction "attract" motion: the menu drifts in from the bottom-left corner toward the top
 * right, then keeps roaming to random spots across the window on smooth curves — steering, not
 * point-to-point tweens, so it never stops or turns sharply. Pure functions; the component
 * drives them once per animation frame.
 */

/** Allowed range for the menu center (the safe box that keeps the whole menu on screen). */
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export type WanderState = {
  pos: Point;
  vel: Point;
  target: Point;
  /** Still coming in from off-screen: not clamped until it is fully inside the safe box. */
  entering: boolean;
};

/** How quickly the heading turns toward the current target (per second). Lower = lazier curves. */
export const STEER_PER_S = 0.9;
/** A new target is picked when the menu gets this close to the current one (px). */
export const ARRIVE_PX = 90;
/** New targets are at least this fraction of the safe box's diagonal away, so it roams widely. */
export const MIN_HOP = 0.35;

export function safeBounds(width: number, height: number, inset: number): Bounds {
  const bx = width < inset * 2 ? [width / 2, width / 2] : [inset, width - inset];
  const by = height < inset * 2 ? [height / 2, height / 2] : [inset, height - inset];
  return { minX: bx[0], maxX: bx[1], minY: by[0], maxY: by[1] };
}

/** Drift speed (px/s) for a viewport: slow, but it scales so big screens don't feel frozen. */
export function wanderSpeed(width: number, height: number): number {
  return Math.min(Math.max(Math.hypot(width, height) * 0.055, 60), 140);
}

const inside = (p: Point, b: Bounds) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

/** Start just past the bottom-left corner, heading for the top-right part of the window. */
export function initialWander(bounds: Bounds, extent: number, speed: number): WanderState {
  const pos = { x: bounds.minX - extent * 1.2, y: bounds.maxY + extent * 1.2 };
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const target = { x: bounds.maxX - w * 0.12, y: bounds.minY + h * 0.12 };
  const d = Math.hypot(target.x - pos.x, target.y - pos.y) || 1;
  // Already drifting when it fades in, so it glides rather than lurches.
  const vel = { x: ((target.x - pos.x) / d) * speed * 0.6, y: ((target.y - pos.y) / d) * speed * 0.6 };
  return { pos, vel, target, entering: true };
}

/** A random point in the safe box, a good distance from `from`. */
export function randomTarget(bounds: Bounds, from: Point, rnd: () => number = Math.random): Point {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const minDist = Math.hypot(w, h) * MIN_HOP;
  let best: Point = { x: bounds.minX + w / 2, y: bounds.minY + h / 2 };
  let bestDist = -1;
  for (let i = 0; i < 10; i++) {
    const p = { x: bounds.minX + rnd() * w, y: bounds.minY + rnd() * h };
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d >= minDist) return p;
    if (d > bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/** Advances the drift by `dt` seconds. */
export function wanderStep(
  s: WanderState,
  dt: number,
  bounds: Bounds,
  speed: number,
  rnd: () => number = Math.random,
): WanderState {
  let target = s.target;
  let entering = s.entering;
  // Keep the goal reachable if the window shrank.
  if (!inside(target, bounds)) target = randomTarget(bounds, s.pos, rnd);
  if (Math.hypot(target.x - s.pos.x, target.y - s.pos.y) < ARRIVE_PX) target = randomTarget(bounds, s.pos, rnd);

  const dx = target.x - s.pos.x;
  const dy = target.y - s.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const desired = { x: (dx / d) * speed, y: (dy / d) * speed };
  const k = Math.min(1, STEER_PER_S * dt);
  const vel = { x: s.vel.x + (desired.x - s.vel.x) * k, y: s.vel.y + (desired.y - s.vel.y) * k };
  let pos = { x: s.pos.x + vel.x * dt, y: s.pos.y + vel.y * dt };

  if (entering && inside(pos, bounds)) entering = false;
  if (!entering) {
    // Stay fully on screen: slide along the edge instead of leaving it.
    const cx = Math.min(Math.max(pos.x, bounds.minX), bounds.maxX);
    const cy = Math.min(Math.max(pos.y, bounds.minY), bounds.maxY);
    if (cx !== pos.x) vel.x = 0;
    if (cy !== pos.y) vel.y = 0;
    pos = { x: cx, y: cy };
  }
  return { pos, vel, target, entering };
}
