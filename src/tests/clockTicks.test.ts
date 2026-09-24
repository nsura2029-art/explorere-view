import { describe, expect, it } from 'vitest';
import { makeTickPlan } from '../hooks/useClockTicks';

const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('makeTickPlan', () => {
  it('ticks 2–3 forward, rests, 1–2 back, rests', () => {
    expect(makeTickPlan(fixed(0, 0))).toEqual([1, 1, 0, -1, 0]);
    expect(makeTickPlan(fixed(0.99, 0.99))).toEqual([1, 1, 1, 0, -1, -1, 0]);
  });

  it('always nets clockwise, so the ring keeps advancing like a clock', () => {
    for (let n = 0; n < 200; n++) {
      const plan = makeTickPlan();
      const forward = plan.filter((d) => d === 1).length;
      const back = plan.filter((d) => d === -1).length;
      expect(forward).toBeGreaterThanOrEqual(2);
      expect(forward).toBeLessThanOrEqual(3);
      expect(back).toBeGreaterThanOrEqual(1);
      expect(back).toBeLessThanOrEqual(2);
      expect(forward - back).toBeGreaterThanOrEqual(0);
    }
  });
});
