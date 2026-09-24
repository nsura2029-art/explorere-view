import { displayUrl } from './protocol';
import { onDisplayHello } from './useDisplayLink';

/** Minimal typing for the Window Management API (Chrome/Edge 100+), not yet in lib.dom. */
type ScreenDetailed = Screen & { left: number; top: number; label?: string; isPrimary?: boolean };
type ScreenDetails = { screens: ScreenDetailed[]; currentScreen: ScreenDetailed };
type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> };

export type OpenResult =
  | { kind: 'opened'; opened: number; blocked: number }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'single-screen' };

const popups = new Map<string, Window>();
/** How long after opening we still try to hand fullscreen to a new window. */
const HANDOFF_MS = 4500;

/**
 * Opens one display window on every screen except the one the controller is on, sized to that
 * screen. Must be called from a tap (popups and permission need a user gesture).
 * Chrome asks once for "manage windows on all your displays"; after that one tap opens them all.
 */
export async function openDisplayWindows(): Promise<OpenResult> {
  const w = window as WindowWithScreens;
  if (typeof w.getScreenDetails !== 'function') return { kind: 'unsupported' };
  let details: ScreenDetails;
  try {
    details = await w.getScreenDetails();
  } catch {
    return { kind: 'denied' };
  }
  const others = details.screens.filter((s) => s !== details.currentScreen);
  if (others.length === 0) return { kind: 'single-screen' };

  const openedAt = Date.now();
  const names: string[] = [];
  let opened = 0;
  let blocked = 0;
  others
    .slice()
    .sort((a, b) => a.left - b.left || a.top - b.top)
    .forEach((s, i) => {
      const name = `explorer-display-${i + 1}`;
      const existing = popups.get(name);
      if (existing && !existing.closed) {
        existing.focus();
        opened++;
        return;
      }
      // 'fullscreen' is honoured by browsers that support fullscreen popups and ignored elsewhere.
      const features = `popup,left=${s.left},top=${s.top},width=${s.width},height=${s.height},fullscreen`;
      const win = window.open(displayUrl(), name, features);
      if (win) {
        popups.set(name, win);
        names.push(name);
        opened++;
      } else blocked++;
    });

  // Best effort: pass our tap's permission to go fullscreen to each new window as it says hello.
  if (names.length) {
    const off = onDisplayHello((d) => {
      const win = popups.get(d.name);
      if (!win || !names.includes(d.name)) return;
      names.splice(names.indexOf(d.name), 1);
      try {
        win.postMessage({ type: 'go-fullscreen' }, { targetOrigin: window.location.origin, delegate: 'fullscreen' } as WindowPostMessageOptions);
      } catch {
        /* delegation unsupported: the display shows its own "click for full screen" hint */
      }
      if (!names.length) off();
    });
    window.setTimeout(off, HANDOFF_MS - (Date.now() - openedAt));
  }
  return { kind: 'opened', opened, blocked };
}
