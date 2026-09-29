import { MAX_SHELF } from '../utils/cardPlacement';
import type { Point } from '../utils/radialGeometry';
import type { ThrownImage } from './protocol';

/** One image on a display window. `from` says how it became the active one (drives its entrance). */
export type DisplayEntry = { key: number; image: ThrownImage; direction: Point; speed: number; from: 'throw' | 'tray' };

/** What a display shows: the active image full screen, earlier ones as tray thumbnails (oldest first). */
export type DisplayState = { active: DisplayEntry | null; shelf: DisplayEntry[] };

export const EMPTY_DISPLAY: DisplayState = { active: null, shelf: [] };

const sameImage = (a: DisplayEntry, b: DisplayEntry) => a.image.seed === b.image.seed;
/** Keeps the tray to MAX_SHELF thumbnails; the oldest leave first. */
const cap = (shelf: DisplayEntry[]) => (shelf.length > MAX_SHELF ? shelf.slice(shelf.length - MAX_SHELF) : shelf);

/**
 * A new image was thrown here: it becomes the active one and the image that was showing moves to
 * the end of the tray. An image thrown again is taken out of the tray (never shown twice).
 */
export function showOnDisplay(s: DisplayState, incoming: DisplayEntry): DisplayState {
  const shelf = s.shelf.filter((e) => !sameImage(e, incoming));
  if (s.active && !sameImage(s.active, incoming)) shelf.push(s.active);
  return { active: incoming, shelf: cap(shelf) };
}

/** A thumbnail was tapped: it comes back full screen and the active image takes its place at the end of the tray. */
export function activateShelved(s: DisplayState, key: number, newKey: number): DisplayState {
  const target = s.shelf.find((e) => e.key === key);
  if (!target) return s;
  const shelf = s.shelf.filter((e) => e.key !== key);
  if (s.active) shelf.push(s.active);
  return { active: { ...target, key: newKey, from: 'tray' }, shelf: cap(shelf) };
}
