import { useEffect, useMemo, useRef } from 'react';
import type { Point } from '../utils/radialGeometry';
import { DOUBLE_TAP_MS, DOUBLE_TAP_SLOP } from '../utils/spinMath';

type Pending = { key: string; at: number; pos: Point; timer: number };

/**
 * Tells a single tap from a double tap on the same target. The single-tap action waits
 * DOUBLE_TAP_MS; a second press on the same key within that time (and DOUBLE_TAP_SLOP px)
 * cancels it and counts as a double tap instead.
 */
export function useDoubleTap() {
  const pending = useRef<Pending | null>(null);

  const api = useMemo(() => {
    const clear = () => {
      if (pending.current) window.clearTimeout(pending.current.timer);
      pending.current = null;
    };
    return {
      clear,
      /** Call on press: true (and the waiting single tap is dropped) if this is the second tap. */
      isSecondTap(key: string | null, pos: Point): boolean {
        const p = pending.current;
        const hit =
          !!p &&
          key !== null &&
          p.key === key &&
          performance.now() - p.at <= DOUBLE_TAP_MS &&
          Math.hypot(pos.x - p.pos.x, pos.y - p.pos.y) <= DOUBLE_TAP_SLOP;
        if (hit) clear();
        return hit;
      },
      /** Call on tap: runs `single` after the double-tap window unless a second tap arrives. */
      deferSingle(key: string, pos: Point, single: () => void) {
        clear();
        pending.current = {
          key,
          at: performance.now(),
          pos,
          timer: window.setTimeout(() => {
            pending.current = null;
            single();
          }, DOUBLE_TAP_MS),
        };
      },
    };
  }, []);

  useEffect(() => api.clear, [api]);
  return api;
}
