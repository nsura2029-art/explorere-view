import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { createCrystallineParticles } from '../../utils/createCrystallineParticles';
import { CrystallineBurst, type CrystallineEffect } from './CrystallineBurst';

/** At most this many bursts on screen; the oldest goes first. */
export const MAX_BURSTS = 8;

let nextId = 1;

/**
 * Magical crystalline touch/click feedback: every pointerdown (finger, mouse or pen) anywhere
 * sparks a burst exactly under the pointer (the chime is separate: taps only, see useTapChime).
 * A purely visual layer above everything with pointer-events: none — it never takes part in
 * the interaction.
 */
export function CrystallineEffectLayer() {
  const [effects, setEffects] = useState<CrystallineEffect[]>([]);
  const reduced = useReducedMotion() ?? false;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const effect: CrystallineEffect = {
        id: nextId++,
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        createdAt: performance.now(),
        particles: createCrystallineParticles(Math.random, { reduced: reducedRef.current }),
        reduced: reducedRef.current,
      };
      setEffects((list) => [...list, effect].slice(-MAX_BURSTS));
    };
    // Passive capture listener: sees every touch first but never blocks or alters it.
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, []);

  const remove = useCallback((id: number) => setEffects((list) => list.filter((e) => e.id !== id)), []);

  return (
    <div className="crystal-layer" aria-hidden="true">
      {effects.map((e) => (
        <CrystallineBurst key={e.id} effect={e} onDone={remove} />
      ))}
    </div>
  );
}
