import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  angularVelocity,
  SPIN_MAX_EXTRA_SLOTS,
  spinSnapStep,
} from '../utils/spinMath';

describe('angleDelta', () => {
  it('returns the short signed way round', () => {
    expect(angleDelta(10, 30)).toBe(20);
    expect(angleDelta(30, 10)).toBe(-20);
    expect(angleDelta(170, -170)).toBe(20); // crossing ±180 clockwise
    expect(angleDelta(-170, 170)).toBe(-20);
  });
});

describe('angularVelocity', () => {
  it('measures deg/ms over the recent window', () => {
    expect(angularVelocity([{ t: 0, a: 0 }, { t: 50, a: 20 }, { t: 100, a: 60 }])).toBeCloseTo(0.6, 6);
  });
  it('is 0 when the finger stopped before lifting', () => {
    expect(angularVelocity([{ t: 0, a: 0 }, { t: 10, a: 90 }, { t: 400, a: 90 }])).toBe(0);
  });
  it('is signed (anticlockwise negative)', () => {
    expect(angularVelocity([{ t: 0, a: 0 }, { t: 100, a: -50 }])).toBeCloseTo(-0.5, 6);
  });
});

describe('spinSnapStep', () => {
  const slot = 45;
  it('snaps a slow release to the nearest slot', () => {
    expect(spinSnapStep(50, 0, slot)).toBe(1);
    expect(spinSnapStep(-70, 0, slot)).toBe(-2);
    expect(spinSnapStep(20, 0, slot)).toBe(0);
  });
  it('carries a clockwise flick further clockwise', () => {
    expect(spinSnapStep(10, 0.5, slot)).toBeGreaterThan(spinSnapStep(10, 0, slot));
  });
  it('carries an anticlockwise flick further anticlockwise', () => {
    expect(spinSnapStep(10, -0.5, slot)).toBeLessThan(spinSnapStep(10, 0, slot));
  });
  it('limits how far a wild flick can spin', () => {
    expect(spinSnapStep(0, 100, slot)).toBe(SPIN_MAX_EXTRA_SLOTS);
    expect(spinSnapStep(0, -100, slot)).toBe(-SPIN_MAX_EXTRA_SLOTS);
  });
});
