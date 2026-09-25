import { beforeEach, describe, expect, it } from 'vitest';
import { useExplorerStore, type NewImageCard } from '../store/useExplorerStore';
import type { SubMenuPlacement } from '../utils/subMenuPlacement';

const placement: SubMenuPlacement = {
  center: { x: 300, y: 0 },
  from: { x: 150, y: 0 },
  startAngle: 216,
  shift: { x: 0, y: 0 },
};

const card = (subItemId: string): NewImageCard => ({
  mainItemId: 'item-1',
  subItemId,
  title: subItemId,
  seed: 1,
  x: 100,
  y: 100,
  width: 200,
  height: 180,
  tether: { x: 0, y: 0 },
});

const initial = useExplorerStore.getState();
beforeEach(() => useExplorerStore.setState(initial, true));

describe('explorer store', () => {
  it('opens one submenu at a time and collapses it', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.openSubMenu('item-2', placement);
    let st = useExplorerStore.getState();
    expect(st.activeMainItemId).toBe('item-2');
    expect(st.isSubMenuOpen).toBe(true);
    st.closeSubMenu();
    st = useExplorerStore.getState();
    expect(st.activeMainItemId).toBeNull();
    expect(st.isSubMenuOpen).toBe(false);
    expect(st.subMenu).toBeNull();
  });

  it('a new image becomes active and the previous one goes to the tray; tapping again hides it', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    expect(useExplorerStore.getState().images).toHaveLength(1);
    s.toggleImage(card('b'));
    let imgs = useExplorerStore.getState().images;
    expect(imgs.map((c) => [c.subItemId, c.shelved])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(imgs[0]).toMatchObject({ detached: true, tether: null });
    // tap b again: hides it, and the most recent thumbnail (a) steps up
    s.toggleImage(card('b'));
    imgs = useExplorerStore.getState().images;
    expect(imgs.map((c) => [c.subItemId, c.shelved])).toEqual([['a', false]]);
  });

  it('closing the submenu keeps every image (just untethered)', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    s.toggleImage(card('b'));
    s.closeSubMenu();
    const imgs = useExplorerStore.getState().images;
    expect(imgs).toHaveLength(2);
    for (const c of imgs) expect(c).toMatchObject({ detached: true, tether: null });
  });

  it('first interaction ends the wander drift', () => {
    const s = useExplorerStore.getState();
    s.setMotionPhase('wandering');
    s.markInteracted();
    expect(useExplorerStore.getState()).toMatchObject({ hasInteracted: true, motionPhase: 'idle' });
  });

  it('caps ripples so rapid taps cannot leak nodes', () => {
    const s = useExplorerStore.getState();
    for (let i = 0; i < 100; i++) s.addRipple(i, i);
    expect(useExplorerStore.getState().ripples.length).toBeLessThanOrEqual(30);
  });

  it('brings a card to the front', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    const first = useExplorerStore.getState().images[0].id;
    s.detachImage(first);
    s.toggleImage(card('b'));
    s.bringImageToFront(first);
    const imgs = useExplorerStore.getState().images;
    const z = Object.fromEntries(imgs.map((c) => [c.id, c.z]));
    expect(z[first]).toBeGreaterThan(Math.max(...imgs.filter((c) => c.id !== first).map((c) => c.z)));
  });

  it('submenu rotate mode untethers images and resets with the submenu', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    const detachedId = useExplorerStore.getState().images[0].id;
    s.detachImage(detachedId);
    s.toggleImage(card('b'));
    s.setSubRingStep(2);
    s.setSubSpinMode(true);
    let st = useExplorerStore.getState();
    expect(st.subSpinMode).toBe(true);
    expect(st.activeSubItemId).toBeNull();
    expect(st.images).toHaveLength(2); // both kept
    expect(st.images.every((c) => c.detached && c.tether === null)).toBe(true);
    expect(st.images.some((c) => c.id === detachedId)).toBe(true);
    s.openSubMenu('item-2', placement);
    st = useExplorerStore.getState();
    expect(st).toMatchObject({ subSpinMode: false, subRingStep: 0 });
    s.setSubSpinMode(true);
    s.setSubRingStep(-1);
    s.closeSubMenu();
    st = useExplorerStore.getState();
    expect(st).toMatchObject({ subSpinMode: false, subRingStep: 0 });
  });

  it('resizes an image card (zoom)', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    const id = useExplorerStore.getState().images[0].id;
    s.resizeImage(id, 300, 250, 500, 380);
    expect(useExplorerStore.getState().images[0]).toMatchObject({ x: 300, y: 250, width: 500, height: 380 });
  });

  it('tapping a thumbnail brings it back; the active one takes its place at the end of the tray', () => {
    const s = useExplorerStore.getState();
    for (const k of ['a', 'b', 'c']) s.toggleImage(card(k));
    const a = useExplorerStore.getState().images.find((c) => c.subItemId === 'a')!;
    s.activateImage(a.id);
    const imgs = useExplorerStore.getState().images;
    expect(imgs.map((c) => [c.subItemId, c.shelved])).toEqual([
      ['b', true],
      ['c', true],
      ['a', false],
    ]);
  });

  it('opening an image that is already in the tray brings it back instead of duplicating it', () => {
    const s = useExplorerStore.getState();
    s.toggleImage(card('a'));
    s.toggleImage(card('b'));
    s.toggleImage(card('a'));
    const imgs = useExplorerStore.getState().images;
    expect(imgs.map((c) => [c.subItemId, c.shelved])).toEqual([
      ['b', true],
      ['a', false],
    ]);
  });

  it('keeps at most 5 thumbnails in the tray (oldest leave first)', () => {
    const s = useExplorerStore.getState();
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) s.toggleImage(card(k));
    const imgs = useExplorerStore.getState().images;
    expect(imgs.filter((c) => c.shelved).map((c) => c.subItemId)).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(imgs.filter((c) => !c.shelved).map((c) => c.subItemId)).toEqual(['g']);
  });

  it('closing a thumbnail leaves the active image alone', () => {
    const s = useExplorerStore.getState();
    s.toggleImage(card('a'));
    s.toggleImage(card('b'));
    const a = useExplorerStore.getState().images[0];
    s.closeImage(a.id);
    expect(useExplorerStore.getState().images.map((c) => [c.subItemId, c.shelved])).toEqual([['b', false]]);
  });
});

