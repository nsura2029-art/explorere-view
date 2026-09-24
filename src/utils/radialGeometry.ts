export type Point = { x: number; y: number };

export type RadialPoint = Point & {
  /** Angle in degrees, screen space (0° = right, 90° = down, -90° = up). */
  angle: number;
  index: number;
};

export type RadialOptions = {
  center: Point;
  radius: number;
  itemCount: number;
  /** Degrees. Default -90 places the first item at 12 o'clock. Items proceed clockwise. */
  startAngle?: number;
};

const DEG = Math.PI / 180;

/** Evenly distributes `itemCount` points on a circle. Shared by main menu and submenus. */
export function getRadialPositions({
  center,
  radius,
  itemCount,
  startAngle = -90,
}: RadialOptions): RadialPoint[] {
  if (itemCount <= 0) return [];
  const step = 360 / itemCount;
  return Array.from({ length: itemCount }, (_, index) => {
    const angle = startAngle + step * index;
    return {
      index,
      angle,
      x: center.x + radius * Math.cos(angle * DEG),
      y: center.y + radius * Math.sin(angle * DEG),
    };
  });
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Point on the rim of circle `from` (radius r) facing `toward`. */
export function pointOnRim(from: Point, toward: Point, r: number): Point {
  const d = distance(from, toward) || 1;
  return {
    x: from.x + ((toward.x - from.x) / d) * r,
    y: from.y + ((toward.y - from.y) / d) * r,
  };
}

/**
 * Concave "liquid bridge" between circle a (radius r) and circle b (radius rb, default r).
 * Attaches to each rim with half-width `attach` and pinches toward the middle.
 */
export function getBridgePath(a: Point, b: Point, r: number, attach = 0.46, pinch = 0.2, rb = r): string {
  const d = distance(a, b) || 1;
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const nx = -uy;
  const ny = ux;
  const w = r * attach;
  const wb = rb * attach;
  const along = Math.sqrt(Math.max(r * r - w * w, 0));
  const alongB = Math.sqrt(Math.max(rb * rb - wb * wb, 0));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const p = Math.min(w, wb) * pinch;
  const f = (n: number) => n.toFixed(2);
  const a1 = [a.x + ux * along + nx * w, a.y + uy * along + ny * w];
  const a2 = [a.x + ux * along - nx * w, a.y + uy * along - ny * w];
  const b1 = [b.x - ux * alongB + nx * wb, b.y - uy * alongB + ny * wb];
  const b2 = [b.x - ux * alongB - nx * wb, b.y - uy * alongB - ny * wb];
  return [
    `M${f(a1[0])} ${f(a1[1])}`,
    `Q${f(mx + nx * p)} ${f(my + ny * p)} ${f(b1[0])} ${f(b1[1])}`,
    `L${f(b2[0])} ${f(b2[1])}`,
    `Q${f(mx - nx * p)} ${f(my - ny * p)} ${f(a2[0])} ${f(a2[1])}`,
    'Z',
  ].join(' ');
}
