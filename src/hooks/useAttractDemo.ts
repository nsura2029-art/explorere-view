import { useEffect, useRef } from 'react';
import {
  DEMO_HOLD_MS,
  DEMO_PAUSE_MS,
  DEMO_RESTART_MS,
  DEMO_START_DELAY_MS,
  randomBetween,
} from '../utils/attractDemo';
import { activePointerCount } from '../utils/pointerRegistry';

export type AttractDemoApi = {
  /** A random main item id, never `exclude` when another is available. */
  pick: (exclude: string | null) => string | null;
  /** Item grows and moves outward (chime plays); resolves when it arrived. */
  pulseOut: (id: string) => Promise<void>;
  /** Item returns to its exact place and size; resolves when it is back. */
  pulseBack: (id: string) => Promise<void>;
  openSubmenu: (id: string) => void;
  closeSubmenu: () => void;
  /** Stop right now: item back to rest, chime off. Must not touch what the user is doing. */
  abort: () => void;
};

/**
 * Idle "attract" demo for the menu:
 * pick a random item → pulse it out (2×, outward, chime) → hold → back → pause → show its
 * submenu → pause → collapse → pause → next item (never the same one twice in a row).
 * Any touch, click or key stops it at once; it restarts after 8–12 s with no interaction.
 */
export function useAttractDemo(enabled: boolean, api: AttractDemoApi) {
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    if (!enabled) return;
    let gen = 0;
    let running = false;
    let last: string | null = null;
    let restartTimer = 0;
    const timers = new Set<number>();

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          resolve();
        }, ms);
        timers.add(t);
      });
    const pause = () => sleep(randomBetween(DEMO_PAUSE_MS));

    const run = async (g: number, firstDelay: number) => {
      running = true;
      const alive = () => g === gen;
      await sleep(firstDelay);
      while (alive()) {
        const a = apiRef.current;
        const id = a.pick(last);
        if (!id) break;
        last = id;
        await a.pulseOut(id);
        if (!alive()) return;
        await sleep(DEMO_HOLD_MS);
        if (!alive()) return;
        await apiRef.current.pulseBack(id);
        if (!alive()) return;
        // The submenu opens only once the item is fully back in place.
        await pause();
        if (!alive()) return;
        apiRef.current.openSubmenu(id);
        await pause();
        if (!alive()) return;
        apiRef.current.closeSubmenu();
        await pause();
      }
      if (alive()) running = false;
    };

    const start = (delay: number) => {
      gen++;
      void run(gen, delay);
    };

    // Restart only after a quiet spell, and never while a finger is still down.
    const scheduleRestart = () => {
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        if (activePointerCount() > 0) scheduleRestart();
        else start(0);
      }, randomBetween(DEMO_RESTART_MS));
    };

    // Capture phase: the demo stops before the app handles the touch, so the user always wins.
    const interrupt = () => {
      if (running) {
        gen++;
        running = false;
        timers.forEach((t) => window.clearTimeout(t));
        timers.clear();
        apiRef.current.abort();
      }
      scheduleRestart();
    };
    const quiet = () => {
      if (!running) scheduleRestart();
    };

    window.addEventListener('pointerdown', interrupt, true);
    window.addEventListener('keydown', interrupt, true);
    window.addEventListener('wheel', interrupt, true);
    window.addEventListener('pointerup', quiet, true);
    start(DEMO_START_DELAY_MS);

    return () => {
      window.removeEventListener('pointerdown', interrupt, true);
      window.removeEventListener('keydown', interrupt, true);
      window.removeEventListener('wheel', interrupt, true);
      window.removeEventListener('pointerup', quiet, true);
      window.clearTimeout(restartTimer);
      timers.forEach((t) => window.clearTimeout(t));
      gen++;
      if (running) apiRef.current.abort();
    };
  }, [enabled]);
}
