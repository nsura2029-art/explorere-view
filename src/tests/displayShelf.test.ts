import { describe, expect, it } from 'vitest';
import { activateShelved, EMPTY_DISPLAY, showOnDisplay, type DisplayEntry } from '../displays/displayShelf';
import { MAX_SHELF } from '../utils/cardPlacement';

let k = 0;
const entry = (seed: number): DisplayEntry => ({
  key: ++k,
  image: { seed, title: `Image ${seed}` },
  direction: { x: 1, y: 0 },
  speed: 1,
  from: 'throw',
});
const seeds = (es: DisplayEntry[]) => es.map((e) => e.image.seed);

describe('display tray', () => {
  it('the first image shows full screen with an empty tray', () => {
    const s = showOnDisplay(EMPTY_DISPLAY, entry(1));
    expect(s.active?.image.seed).toBe(1);
    expect(s.shelf).toHaveLength(0);
  });

  it('2nd and 3rd images move the earlier ones into the tray, oldest first', () => {
    let s = showOnDisplay(EMPTY_DISPLAY, entry(1));
    s = showOnDisplay(s, entry(2));
    s = showOnDisplay(s, entry(3));
    expect(s.active?.image.seed).toBe(3);
    expect(seeds(s.shelf)).toEqual([1, 2]);
  });

  it(`keeps at most ${MAX_SHELF} thumbnails; the oldest leave first`, () => {
    let s = EMPTY_DISPLAY;
    for (let i = 1; i <= MAX_SHELF + 3; i++) s = showOnDisplay(s, entry(i));
    expect(s.shelf).toHaveLength(MAX_SHELF);
    expect(seeds(s.shelf)).toEqual([3, 4, 5, 6, 7]);
  });

  it('an image thrown again comes out of the tray instead of appearing twice', () => {
    let s = showOnDisplay(EMPTY_DISPLAY, entry(1));
    s = showOnDisplay(s, entry(2));
    s = showOnDisplay(s, entry(1));
    expect(s.active?.image.seed).toBe(1);
    expect(seeds(s.shelf)).toEqual([2]);
    s = showOnDisplay(s, entry(1));
    expect(seeds(s.shelf)).toEqual([2]);
  });

  it('tapping a thumbnail brings it back; the active image takes its place in the tray', () => {
    let s = showOnDisplay(EMPTY_DISPLAY, entry(1));
    s = showOnDisplay(s, entry(2));
    s = showOnDisplay(s, entry(3));
    const thumb = s.shelf[0];
    s = activateShelved(s, thumb.key, 999);
    expect(s.active?.image.seed).toBe(1);
    expect(s.active?.key).toBe(999);
    expect(s.active?.from).toBe('tray');
    expect(seeds(s.shelf)).toEqual([2, 3]);
  });

  it('an unknown thumbnail changes nothing', () => {
    const s = showOnDisplay(EMPTY_DISPLAY, entry(1));
    expect(activateShelved(s, -1, 5)).toBe(s);
  });
});
