import { describe, expect, it } from 'vitest';
import { clampMenuPosition } from '../utils/clampPosition';

const viewport = { width: 1536, height: 864 };
const base = { viewport, menuRadius: 200, margin: 20 };
const inset = 220;

describe('clampMenuPosition', () => {
  it('leaves a safe center unchanged', () => {
    expect(clampMenuPosition({ ...base, desiredPosition: { x: 768, y: 430 } })).toEqual({ x: 768, y: 430 });
  });
  it('clamps left edge', () => {
    expect(clampMenuPosition({ ...base, desiredPosition: { x: 5, y: 430 } })).toEqual({ x: inset, y: 430 });
  });
  it('clamps right edge', () => {
    expect(clampMenuPosition({ ...base, desiredPosition: { x: 1530, y: 430 } })).toEqual({ x: 1536 - inset, y: 430 });
  });
  it('clamps top edge', () => {
    expect(clampMenuPosition({ ...base, desiredPosition: { x: 768, y: 0 } })).toEqual({ x: 768, y: inset });
  });
  it('clamps bottom edge', () => {
    expect(clampMenuPosition({ ...base, desiredPosition: { x: 768, y: 900 } })).toEqual({ x: 768, y: 864 - inset });
  });
  it.each([
    [{ x: 0, y: 0 }, { x: inset, y: inset }],
    [{ x: 1536, y: 0 }, { x: 1536 - inset, y: inset }],
    [{ x: 0, y: 864 }, { x: inset, y: 864 - inset }],
    [{ x: 1536, y: 864 }, { x: 1536 - inset, y: 864 - inset }],
  ])('clamps corner %o', (desiredPosition, expected) => {
    expect(clampMenuPosition({ ...base, desiredPosition })).toEqual(expected);
  });
  it('centers when viewport is smaller than the menu', () => {
    expect(
      clampMenuPosition({ ...base, viewport: { width: 300, height: 300 }, desiredPosition: { x: 10, y: 290 } }),
    ).toEqual({ x: 150, y: 150 });
  });
});
