import { useEffect } from 'react';
import { create } from 'zustand';
import { CHANNEL_NAME, rectCenter, windowRect, type LinkMessage, type Rect } from './protocol';
import type { Point } from '../utils/radialGeometry';

/** How often the controller pings; displays silent for longer than DROP_MS are forgotten. */
const PING_MS = 2000;
const DROP_MS = 6500;

export type LinkedDisplay = { id: string; name: string; rect: Rect; lastSeen: number };
export type LabeledDisplay = LinkedDisplay & { label: string; center: Point };

type DisplayState = {
  displays: Record<string, LinkedDisplay>;
  /** True while a finger is dragging an image card (shows the edge portals). */
  cardDragging: boolean;
  setCardDragging: (v: boolean) => void;
};

export const useDisplayStore = create<DisplayState>((set) => ({
  displays: {},
  cardDragging: false,
  setCardDragging: (cardDragging) => set({ cardDragging }),
}));

let channel: BroadcastChannel | null = null;
const helloListeners = new Set<(d: LinkedDisplay) => void>();

/** Sends a message to all display windows (no-op before the link is up). */
export function postToDisplays(msg: LinkMessage) {
  channel?.postMessage(msg);
}

/** Called for every hello (used to hand fullscreen to windows we just opened). */
export function onDisplayHello(fn: (d: LinkedDisplay) => void): () => void {
  helloListeners.add(fn);
  return () => helloListeners.delete(fn);
}

/** Displays sorted left→right, top→bottom and labelled "Screen 1", "Screen 2", … */
export function labelDisplays(displays: Record<string, LinkedDisplay>): LabeledDisplay[] {
  return Object.values(displays)
    .map((d) => ({ ...d, center: rectCenter(d.rect) }))
    .sort((a, b) => a.center.x - b.center.x || a.center.y - b.center.y)
    .map((d, i) => ({ ...d, label: `Screen ${i + 1}` }));
}

/** Controller side of the link: discovers display windows and keeps the list fresh. */
export function useDisplayLink() {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channel = ch;
    ch.onmessage = (e: MessageEvent<LinkMessage>) => {
      const msg = e.data;
      if (msg.type === 'hello') {
        const d: LinkedDisplay = { id: msg.id, name: msg.name, rect: msg.rect, lastSeen: Date.now() };
        useDisplayStore.setState((s) => ({ displays: { ...s.displays, [d.id]: d } }));
        helloListeners.forEach((fn) => fn(d));
      } else if (msg.type === 'bye') {
        useDisplayStore.setState((s) => {
          if (!s.displays[msg.id]) return s;
          const { [msg.id]: _gone, ...rest } = s.displays;
          return { displays: rest };
        });
      }
    };
    const ping = () => {
      ch.postMessage({ type: 'ping' } satisfies LinkMessage);
      const now = Date.now();
      useDisplayStore.setState((s) => {
        const alive = Object.fromEntries(Object.entries(s.displays).filter(([, d]) => now - d.lastSeen < DROP_MS));
        return Object.keys(alive).length === Object.keys(s.displays).length ? s : { displays: alive };
      });
    };
    ping();
    const id = window.setInterval(ping, PING_MS);
    return () => {
      window.clearInterval(id);
      ch.close();
      if (channel === ch) channel = null;
    };
  }, []);
}

/** The controller window's center on the desktop (it can move, so read it when needed). */
export const controllerCenter = (): Point => rectCenter(windowRect());
