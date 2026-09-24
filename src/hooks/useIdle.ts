import { useEffect, useState } from 'react';
import { useExplorerStore } from '../store/useExplorerStore';

/** Time without any touch after which the ring starts ticking again. */
export const IDLE_MS = 15000;

/** True when nobody has touched the screen for `ms` (also true before the first touch). */
export function useIdle(ms = IDLE_MS): boolean {
  const last = useExplorerStore((s) => s.lastActivityAt);
  const [idle, setIdle] = useState(() => Date.now() - last >= ms);
  useEffect(() => {
    const remaining = ms - (Date.now() - last);
    if (remaining <= 0) {
      setIdle(true);
      return;
    }
    setIdle(false);
    const t = window.setTimeout(() => setIdle(true), remaining);
    return () => window.clearTimeout(t);
  }, [last, ms]);
  return idle;
}
