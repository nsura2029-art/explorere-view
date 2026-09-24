import type { Point } from '../utils/radialGeometry';

/** Release speed (px/ms) above which letting go of a card counts as a throw. ≈ 900 px/s. */
export const THROW_SPEED = 0.9;
/** A display is hit when it lies within this many degrees of the throw direction. */
export const THROW_CONE_DEG = 55;
/** Only movement from the last few ms before release counts toward the throw. */
export const VELOCITY_WINDOW_MS = 100;

export type Sample = { t: number; x: number; y: number };

/**
 * Finger velocity at release (px/ms) from recent pointer samples. Uses the oldest sample inside
 * the window, so a finger that stops before lifting reports ~0 and drops instead of throwing.
 */
export function releaseVelocity(samples: Sample[], windowMs = VELOCITY_WINDOW_MS): Point {
  if (samples.length < 2) return { x: 0, y: 0 };
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  if (dt <= 0) return { x: 0, y: 0 };
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
}

export type Target = { id: string; center: Point };

/**
 * Display to throw at: the one whose direction from the controller is closest to the throw
 * direction, within the cone. `from` and target centers are in screen (desktop) coordinates;
 * only directions are compared, so CSS-px velocity works as-is.
 */
export function pickThrowTarget(
  velocity: Point,
  from: Point,
  targets: Target[],
  minSpeed = THROW_SPEED,
  coneDeg = THROW_CONE_DEG,
): string | null {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < minSpeed) return null;
  let best: { id: string; angle: number } | null = null;
  for (const t of targets) {
    const dx = t.center.x - from.x;
    const dy = t.center.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) continue;
    const cos = (velocity.x * dx + velocity.y * dy) / (speed * dist);
    const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (angle <= coneDeg && (!best || angle < best.angle)) best = { id: t.id, angle };
  }
  return best?.id ?? null;
}

/** Where a ray from the viewport center along `dir` meets the viewport edge, inset by `inset`. */
export function edgePoint(width: number, height: number, dir: Point, inset: number): Point {
  const cx = width / 2;
  const cy = height / 2;
  const hx = Math.max(cx - inset, 0);
  const hy = Math.max(cy - inset, 0);
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const tx = ux === 0 ? Infinity : hx / Math.abs(ux);
  const ty = uy === 0 ? Infinity : hy / Math.abs(uy);
  const t = Math.min(tx, ty);
  return { x: cx + ux * t, y: cy + uy * t };
}
