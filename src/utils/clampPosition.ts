import type { Point } from './radialGeometry';

export type Viewport = { width: number; height: number };

export type ClampOptions = {
  desiredPosition: Point;
  viewport: Viewport;
  /** Visual extent of the menu from its center (incl. glow padding). */
  menuRadius: number;
  margin: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns the nearest center at which a circle of `menuRadius` stays fully on-screen.
 * If the viewport is too small on an axis, the menu is centered on that axis.
 */
export function clampMenuPosition({ desiredPosition, viewport, menuRadius, margin }: ClampOptions): Point {
  const inset = menuRadius + margin;
  const axis = (v: number, size: number) =>
    size < inset * 2 ? size / 2 : clamp(v, inset, size - inset);
  return {
    x: axis(desiredPosition.x, viewport.width),
    y: axis(desiredPosition.y, viewport.height),
  };
}
