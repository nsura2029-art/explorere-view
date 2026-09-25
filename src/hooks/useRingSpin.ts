import { useEffect, useMemo, useRef } from 'react';
import { animate, type MotionValue, type Transition } from 'framer-motion';
import type { Point } from '../utils/radialGeometry';
import { angleDelta, angularVelocity, spinSnapStep, type AngleSample } from '../utils/spinMath';

/** Near the ring's center the finger's angle is unstable; moves closer than this are ignored. */
const DEAD_ZONE_PX = 24;

type Options = {
  /** Rendered rotation of the ring, in degrees. */
  angle: MotionValue<number>;
  slotDeg: number;
  /** Committed rotation in slots (source of truth for layout maths). */
  step: number;
  setStep: (step: number) => void;
  reduceMotion: boolean;
  /** How the ring settles on a new step when nobody spun it (e.g. clock ticks). */
  settle: Transition;
};

/**
 * Turning a ring of items with a finger ("rotate mode"): follows the finger around the ring's
 * center, keeps a flick's momentum, then snaps to the nearest item slot. Shared by the main menu
 * and the submenu.
 */
export function useRingSpin({ angle, slotDeg, step, setStep, reduceMotion, settle }: Options) {
  const opts = useRef({ slotDeg, step, setStep, reduceMotion, settle });
  opts.current = { slotDeg, step, setStep, reduceMotion, settle };
  // Transition for the next step change (a spin hands over its momentum); `settle` otherwise.
  const pending = useRef<Transition | null>(null);

  useEffect(() => {
    const t = pending.current ?? opts.current.settle;
    pending.current = null;
    animate(angle, step * slotDeg, opts.current.reduceMotion ? { duration: 0 } : t);
  }, [step, slotDeg, angle]);

  const drag = useRef<{ center: Point; last: number; samples: AngleSample[] }>({
    center: { x: 0, y: 0 },
    last: 0,
    samples: [],
  });

  return useMemo(() => {
    const at = (p: Point) => (Math.atan2(p.y - drag.current.center.y, p.x - drag.current.center.x) * 180) / Math.PI;
    return {
      /** Drag started: `center` is the ring center, `from` the press point, `to` the finger now. */
      begin(center: Point, from: Point, to: Point) {
        angle.stop();
        drag.current.center = center;
        const next = angle.get() + angleDelta(at(from), at(to));
        angle.set(next);
        drag.current.last = at(to);
        drag.current.samples = [{ t: performance.now(), a: next }];
      },
      move(p: Point) {
        const c = drag.current.center;
        if (Math.hypot(p.x - c.x, p.y - c.y) < DEAD_ZONE_PX) return;
        const a = at(p);
        const next = angle.get() + angleDelta(drag.current.last, a);
        drag.current.last = a;
        angle.set(next);
        const samples = drag.current.samples;
        samples.push({ t: performance.now(), a: next });
        if (samples.length > 24) samples.shift();
      },
      /** Released: keep the flick's momentum, then settle on the nearest slot. */
      end(cancelled: boolean) {
        const o = opts.current;
        const w = cancelled ? 0 : angularVelocity(drag.current.samples);
        const target = spinSnapStep(angle.get(), w, o.slotDeg);
        const t: Transition = { type: 'spring', stiffness: 140, damping: 20, velocity: w * 1000 };
        if (target === o.step) {
          animate(angle, target * o.slotDeg, o.reduceMotion ? { duration: 0 } : t);
        } else {
          pending.current = t;
          o.setStep(target);
        }
      },
    };
  }, [angle]);
}
