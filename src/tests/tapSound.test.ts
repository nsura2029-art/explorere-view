import { describe, expect, it } from 'vitest';
import { isChimeMuted, setChimeMuted, subscribeChimeMuted } from '../utils/chime';
import { TAP_SLOP_PX, TapTracker } from '../utils/tapSound';

describe('which presses chime (TapTracker)', () => {
  it('tap / click / pen tap: press and release in place → chime', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, false);
    expect(t.up(1, 100, 100)).toBe(true);
  });

  it('a little finger wobble still counts as a tap', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, false);
    t.move(1, 104, 97);
    expect(t.up(1, 106, 103)).toBe(true);
  });

  it('long press (held, not moved) → chime on release', () => {
    const t = new TapTracker();
    t.down(1, 50, 50, false);
    // no time limit: holding is still a tap
    expect(t.up(1, 50, 50)).toBe(true);
  });

  it('each tap of a double tap chimes', () => {
    const t = new TapTracker();
    t.down(1, 10, 10, false);
    expect(t.up(1, 10, 10)).toBe(true);
    t.down(2, 11, 10, false);
    expect(t.up(2, 11, 10)).toBe(true);
  });

  it('drag / flick: moved beyond the slop → silent, even if it comes back', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, false);
    t.move(1, 100 + TAP_SLOP_PX + 1, 100);
    t.move(1, 100, 100);
    expect(t.up(1, 100, 100)).toBe(false);
  });

  it('a release far from the press (fast flick with no move events) → silent', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, false);
    expect(t.up(1, 300, 100)).toBe(false);
  });

  it('pinch: both fingers move apart → silent', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, false);
    t.down(2, 140, 100, false);
    t.move(1, 60, 100);
    t.move(2, 180, 100);
    expect(t.up(1, 60, 100)).toBe(false);
    expect(t.up(2, 180, 100)).toBe(false);
  });

  it('several fingers tapping at once each count as a tap', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, false);
    t.down(2, 400, 300, false);
    expect(t.up(1, 100, 100)).toBe(true);
    expect(t.up(2, 400, 300)).toBe(true);
  });

  it('utility controls (data-sound="off") stay silent', () => {
    const t = new TapTracker();
    t.down(1, 10, 10, true);
    expect(t.up(1, 10, 10)).toBe(false);
  });

  it('cancelled pointers never chime and never leak', () => {
    const t = new TapTracker();
    t.down(1, 10, 10, false);
    t.cancel(1);
    expect(t.up(1, 10, 10)).toBe(false);
    expect(t.size).toBe(0);
  });

  it('a release without a press (e.g. right-click filtered out) is silent', () => {
    expect(new TapTracker().up(9, 0, 0)).toBe(false);
  });
});

describe('mute', () => {
  it('toggles and notifies subscribers', () => {
    const seen: boolean[] = [];
    const off = subscribeChimeMuted(() => seen.push(isChimeMuted()));
    setChimeMuted(true);
    setChimeMuted(true); // no change, no notification
    setChimeMuted(false);
    off();
    expect(seen).toEqual([true, false]);
    expect(isChimeMuted()).toBe(false);
  });
});
