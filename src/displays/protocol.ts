import type { Point } from '../utils/radialGeometry';

/**
 * Same-machine link between the touchscreen controller and the display windows on the
 * external screens. BroadcastChannel reaches every window of this origin in the same browser
 * profile, whether the controller opened it or someone opened the URL by hand.
 */
export const CHANNEL_NAME = 'explorer-displays';
/** URL of a display window. */
export const DISPLAY_QUERY = 'view=display';

export type Rect = { x: number; y: number; width: number; height: number };
export type ThrownImage = { seed: number; title: string };

export type LinkMessage =
  /** controller → displays: who is there? (also the heartbeat) */
  | { type: 'ping' }
  /** display → controller: I exist, and this is where my window is on the desktop. */
  | { type: 'hello'; id: string; name: string; rect: Rect }
  | { type: 'bye'; id: string }
  /** controller → one display: show this image full screen, arriving from `direction`. */
  | { type: 'show'; target: string; image: ThrownImage; direction: Point; speed: number };

/** This window's rectangle in desktop coordinates (spans all monitors). */
export function windowRect(): Rect {
  return { x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight };
}

export const rectCenter = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

export function isDisplayView(search = window.location.search): boolean {
  return new URLSearchParams(search).get('view') === 'display';
}

export function displayUrl(): string {
  return `${window.location.origin}${window.location.pathname}?${DISPLAY_QUERY}`;
}
