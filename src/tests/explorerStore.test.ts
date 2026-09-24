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

  it('toggles the attached image and replaces it for another sub item', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    expect(useExplorerStore.getState().images).toHaveLength(1);
    s.toggleImage(card('b'));
    expect(useExplorerStore.getState().images.map((c) => c.subItemId)).toEqual(['b']);
    s.toggleImage(card('b'));
    expect(useExplorerStore.getState().images).toHaveLength(0);
  });

  it('keeps detached images when the submenu collapses, drops attached ones', () => {
    const s = useExplorerStore.getState();
    s.openSubMenu('item-1', placement);
    s.toggleImage(card('a'));
    const id = useExplorerStore.getState().images[0].id;
    s.detachImage(id);
    s.toggleImage(card('b'));
    expect(useExplorerStore.getState().images).toHaveLength(2);
    s.closeSubMenu();
    const imgs = useExplorerStore.getState().images;
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatchObject({ id, detached: true, tether: null });
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
});
