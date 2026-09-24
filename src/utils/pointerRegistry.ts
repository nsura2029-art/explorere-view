/**
 * Tracks every pointer currently down anywhere on the page (by pointerId), so a background touch
 * can tell whether it is the only finger down (spec 4.0: extra fingers ripple only).
 * Listeners run in the capture phase, so a pointerdown handler already sees its own pointer.
 */
const active = new Map<number, number>();
/** Safety net: a pointer whose up/cancel never arrived stops counting after this long. */
const STALE_MS = 8000;

function onDown(e: PointerEvent) {
  active.set(e.pointerId, performance.now());
}
function onEnd(e: PointerEvent) {
  active.delete(e.pointerId);
}
function clearAll() {
  active.clear();
}

export function installPointerRegistry(): () => void {
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', onEnd, true);
  window.addEventListener('pointercancel', onEnd, true);
  window.addEventListener('blur', clearAll);
  return () => {
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', onEnd, true);
    window.removeEventListener('pointercancel', onEnd, true);
    window.removeEventListener('blur', clearAll);
    active.clear();
  };
}

export function activePointerCount(): number {
  const now = performance.now();
  for (const [id, t] of active) if (now - t > STALE_MS) active.delete(id);
  return active.size;
}
