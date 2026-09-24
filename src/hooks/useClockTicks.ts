import { useEffect, useRef } from 'react';

/** Time between ticks, like a seconds hand. */
export const TICK_MS = 1000;

/**
 * One cycle of the ring's clock motion: 2–3 ticks clockwise (+1), a beat of rest (0),
 * 1–2 ticks back (-1), another beat of rest. Counts are random per cycle.
 */
export function makeTickPlan(rnd: () => number = Math.random): number[] {
  const forward = 2 + Math.floor(rnd() * 2);
  const back = 1 + Math.floor(rnd() * 2);
  return [...Array<number>(forward).fill(1), 0, ...Array<number>(back).fill(-1), 0];
}

/**
 * Calls `step(+1 | -1)` once per tick while `enabled`, following successive tick plans.
 * Pausing keeps the current plan, so the pattern resumes where it left off.
 */
export function useClockTicks(enabled: boolean, step: (delta: number) => void): void {
  const plan = useRef<number[]>([]);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (plan.current.length === 0) plan.current = makeTickPlan();
      const delta = plan.current.shift()!;
      if (delta !== 0) stepRef.current(delta);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}
