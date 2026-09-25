import { useEffect, useSyncExternalStore } from 'react';
import { isChimeMuted, playChime, preloadChime, subscribeChimeMuted } from '../utils/chime';
import { TapTracker } from '../utils/tapSound';

/** Controls that never chime (utility buttons). */
const SILENT_SELECTOR = '[data-sound="off"]';

/**
 * The crystalline chime plays when a finger, pen or mouse press is released without moving:
 * taps, clicks, pen taps, each tap of a double tap, long presses. Drags, flicks, pinches,
 * right/middle clicks, keys and the wheel stay silent, as do controls marked data-sound="off".
 * Passive capture listeners: it only listens, never alters the interaction.
 */
export function useTapChime() {
  useEffect(() => {
    preloadChime();
    const taps = new TapTracker();
    const opts = { capture: true, passive: true } as const;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const silent = e.target instanceof Element && !!e.target.closest(SILENT_SELECTOR);
      taps.down(e.pointerId, e.clientX, e.clientY, silent);
    };
    const onMove = (e: PointerEvent) => taps.move(e.pointerId, e.clientX, e.clientY);
    const onUp = (e: PointerEvent) => {
      if (taps.up(e.pointerId, e.clientX, e.clientY)) playChime();
    };
    const onCancel = (e: PointerEvent) => taps.cancel(e.pointerId);
    window.addEventListener('pointerdown', onDown, opts);
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onCancel, opts);
    return () => {
      window.removeEventListener('pointerdown', onDown, opts);
      window.removeEventListener('pointermove', onMove, opts);
      window.removeEventListener('pointerup', onUp, opts);
      window.removeEventListener('pointercancel', onCancel, opts);
    };
  }, []);
}

/** Current mute state, kept in sync with the mute button. */
export const useChimeMuted = () => useSyncExternalStore(subscribeChimeMuted, isChimeMuted, isChimeMuted);
