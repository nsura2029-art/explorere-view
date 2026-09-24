import { describe, expect, it } from 'vitest';
import { attachedCardCenter, CARD_MARGIN, cardSize, clampCardCenter } from '../utils/cardPlacement';

const viewport = { width: 1536, height: 864 };

describe('clampCardCenter', () => {
  it('keeps a safe center unchanged', () => {
    expect(clampCardCenter({ x: 700, y: 400 }, 300, 250, viewport)).toEqual({ x: 700, y: 400 });
  });
  it('clamps every edge', () => {
    expect(clampCardCenter({ x: -50, y: -50 }, 300, 250, viewport)).toEqual({ x: 150 + CARD_MARGIN, y: 125 + CARD_MARGIN });
    expect(clampCardCenter({ x: 5000, y: 5000 }, 300, 250, viewport)).toEqual({
      x: 1536 - 150 - CARD_MARGIN,
      y: 864 - 125 - CARD_MARGIN,
    });
  });
});

describe('cardSize', () => {
  it('scales with the viewport within bounds', () => {
    expect(cardSize({ width: 300, height: 300 }, 0.5).width).toBe(200);
    expect(cardSize({ width: 4000, height: 3000 }, 0.5).width).toBe(380);
  });
});

describe('attachedCardCenter', () => {
  it('places the card beyond the item along the preferred direction', () => {
    const c = attachedCardCenter({ x: 700, y: 400 }, { x: 1, y: 0 }, 40, 300, 250, viewport);
    expect(c.y).toBeCloseTo(400, 6);
    expect(c.x - 150).toBeGreaterThanOrEqual(740);
  });

  it('covers the menus less than the naive spot when an edge pushes the card back', () => {
    const item = { x: 1400, y: 80 };
    const obstacles = [{ x: 1300, y: 200, r: 120 }];
    const cover = (c: { x: number; y: number }) => {
      const dx = Math.max(Math.abs(obstacles[0].x - c.x) - 150, 0);
      const dy = Math.max(Math.abs(obstacles[0].y - c.y) - 125, 0);
      return Math.max(obstacles[0].r - Math.hypot(dx, dy), 0);
    };
    const naive = attachedCardCenter(item, { x: 1, y: 0 }, 40, 300, 250, viewport);
    const smart = attachedCardCenter(item, { x: 1, y: 0 }, 40, 300, 250, viewport, obstacles);
    expect(cover(smart)).toBeLessThan(cover(naive));
    expect(clampCardCenter(smart, 300, 250, viewport)).toEqual(smart);
  });

  it('finds a fully clear spot when one exists', () => {
    const item = { x: 700, y: 400 };
    // Obstacle sits on the preferred (right) side.
    const obstacles = [{ x: 950, y: 400, r: 100 }];
    const c = attachedCardCenter(item, { x: 1, y: 0 }, 40, 300, 250, viewport, obstacles);
    const dx = Math.max(Math.abs(obstacles[0].x - c.x) - 150, 0);
    const dy = Math.max(Math.abs(obstacles[0].y - c.y) - 125, 0);
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(obstacles[0].r);
  });
});
