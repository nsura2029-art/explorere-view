import { describe, expect, it } from 'vitest';
import { edgePoint, pickThrowTarget, releaseVelocity, THROW_SPEED } from '../displays/throwMath';

describe('releaseVelocity', () => {
  it('measures px/ms over the recent window', () => {
    const v = releaseVelocity([
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 50, y: 0 },
      { t: 100, x: 150, y: -50 },
    ]);
    expect(v.x).toBeCloseTo(1.5, 6);
    expect(v.y).toBeCloseTo(-0.5, 6);
  });

  it('ignores movement older than the window', () => {
    const v = releaseVelocity([
      { t: 0, x: 0, y: 0 },
      { t: 10, x: 1000, y: 0 }, // old fast flick
      { t: 500, x: 1000, y: 0 },
      { t: 540, x: 1004, y: 0 },
    ]);
    expect(v.x).toBeCloseTo(0.1, 6);
  });

  it('is ~0 when the finger stops before lifting', () => {
    const v = releaseVelocity([
      { t: 0, x: 0, y: 0 },
      { t: 20, x: 300, y: 0 },
      { t: 300, x: 300, y: 0 },
    ]);
    expect(Math.hypot(v.x, v.y)).toBe(0);
  });

  it('handles too few samples', () => {
    expect(releaseVelocity([])).toEqual({ x: 0, y: 0 });
    expect(releaseVelocity([{ t: 0, x: 1, y: 1 }])).toEqual({ x: 0, y: 0 });
  });
});

describe('pickThrowTarget', () => {
  // Laptop at the bottom middle, one 32" screen up-left, one up-right (typical desk).
  const from = { x: 960, y: 1600 };
  const targets = [
    { id: 'left', center: { x: -1920 / 2 + 960 - 960, y: 540 } },
    { id: 'right', center: { x: 1920 + 960, y: 540 } },
  ];

  it('picks the screen in the throw direction', () => {
    expect(pickThrowTarget({ x: 2, y: -1 }, from, targets)).toBe('right');
    expect(pickThrowTarget({ x: -2, y: -1 }, from, targets)).toBe('left');
  });

  it('ignores slow releases (that is a drop, not a throw)', () => {
    expect(pickThrowTarget({ x: THROW_SPEED * 0.5, y: 0 }, from, targets)).toBeNull();
  });

  it('returns null when no screen lies in that direction', () => {
    expect(pickThrowTarget({ x: 0, y: 3 }, from, targets)).toBeNull();
  });

  it('skips a display on the same spot as the controller', () => {
    expect(pickThrowTarget({ x: 3, y: 0 }, from, [{ id: 'same', center: from }])).toBeNull();
  });
});

describe('edgePoint', () => {
  it('hits the right edge for a rightward ray', () => {
    expect(edgePoint(1000, 600, { x: 1, y: 0 }, 50)).toEqual({ x: 950, y: 300 });
  });
  it('hits the top edge for an upward ray', () => {
    expect(edgePoint(1000, 600, { x: 0, y: -1 }, 50)).toEqual({ x: 500, y: 50 });
  });
  it('stays inside the inset box on diagonals', () => {
    const p = edgePoint(1000, 600, { x: 1, y: -1 }, 50);
    expect(p.y).toBeCloseTo(50, 6);
    expect(p.x).toBeCloseTo(750, 6);
  });
});
