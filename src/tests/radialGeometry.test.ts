import { describe, expect, it } from 'vitest';
import { distance, getRadialPositions } from '../utils/radialGeometry';

const center = { x: 300, y: 200 };

describe('getRadialPositions', () => {
  it.each([8, 5, 3])('returns %i points', (n) => {
    expect(getRadialPositions({ center, radius: 100, itemCount: n })).toHaveLength(n);
  });

  it('returns [] for zero items', () => {
    expect(getRadialPositions({ center, radius: 100, itemCount: 0 })).toEqual([]);
  });

  it.each([8, 5])('distributes %i points evenly', (n) => {
    const pts = getRadialPositions({ center, radius: 150, itemCount: n });
    const gaps = pts.map((p, i) => distance(p, pts[(i + 1) % n]));
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 6);
  });

  it('respects radius', () => {
    const pts = getRadialPositions({ center, radius: 173, itemCount: 8 });
    for (const p of pts) expect(distance(p, center)).toBeCloseTo(173, 6);
  });

  it('defaults to first item at 12 o’clock, clockwise', () => {
    const [first, second] = getRadialPositions({ center, radius: 100, itemCount: 8 });
    expect(first.x).toBeCloseTo(300, 6);
    expect(first.y).toBeCloseTo(100, 6);
    expect(second.x).toBeGreaterThan(300);
  });

  it('respects startAngle', () => {
    const [first] = getRadialPositions({ center, radius: 100, itemCount: 5, startAngle: 0 });
    expect(first.x).toBeCloseTo(400, 6);
    expect(first.y).toBeCloseTo(200, 6);
  });
});
