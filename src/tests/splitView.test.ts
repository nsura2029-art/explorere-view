import { beforeEach, describe, expect, it } from 'vitest';
import { useExplorerStore, type NewImageCard } from '../store/useExplorerStore';
import {
  CAPTION_H,
  CARD_MARGIN,
  cardHeightFor,
  cardSize,
  cardSplitRegion,
  clampCardWidth,
  clampIntoRegion,
  fitMenusInRegion,
  isZoomedIn,
  maxCardWidth,
  MAX_SHELF,
  menuSplitRegion,
  shelfLayout,
} from '../utils/cardPlacement';
import { computeMenuLayout, EDGE_MARGIN } from '../utils/menuLayout';
import { computeSubMenuPlacement } from '../utils/subMenuPlacement';

const aspect = 420 / 640;
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
];
const TOP_INSET = 76;

describe('zoomed card limits', () => {
  it.each(VIEWPORTS)('never wider than half the screen (%o)', (vp) => {
    expect(maxCardWidth(vp, aspect, TOP_INSET)).toBeLessThanOrEqual(vp.width / 2);
    expect(clampCardWidth(99999, vp, aspect, TOP_INSET)).toBeLessThanOrEqual(vp.width / 2);
  });

  it.each(VIEWPORTS)('never taller than the space under the top-right screen info (%o)', (vp) => {
    const w = maxCardWidth(vp, aspect, TOP_INSET);
    expect(cardHeightFor(w, aspect)).toBeLessThanOrEqual(vp.height - TOP_INSET - CARD_MARGIN + 1);
  });

  it('counts as zoomed in only when clearly bigger than the default', () => {
    const vp = VIEWPORTS[0];
    const base = cardSize(vp, aspect).width;
    expect(isZoomedIn(base, vp, aspect)).toBe(false);
    expect(isZoomedIn(base * 1.05, vp, aspect)).toBe(false);
    expect(isZoomedIn(base * 1.5, vp, aspect)).toBe(true);
  });
});

describe('split regions', () => {
  it.each(VIEWPORTS)('card region is the right half, below the screen info (%o)', (vp) => {
    const r = cardSplitRegion(vp, TOP_INSET);
    expect(r.left).toBeGreaterThanOrEqual(vp.width / 2);
    expect(r.right).toBeLessThanOrEqual(vp.width);
    expect(r.top).toBe(TOP_INSET);
    // the biggest card fits inside it
    const w = maxCardWidth(vp, aspect, TOP_INSET);
    const h = cardHeightFor(w, aspect);
    const c = clampIntoRegion({ x: 0, y: 0 }, w, h, r);
    expect(c.x - w / 2).toBeGreaterThanOrEqual(r.left - 1e-6);
    expect(c.x + w / 2).toBeLessThanOrEqual(r.right + 1e-6);
    expect(c.y - h / 2).toBeGreaterThanOrEqual(r.top - 1e-6);
    expect(c.y + h / 2).toBeLessThanOrEqual(r.bottom + 1e-6);
  });

  it.each(VIEWPORTS)('menus (main + any submenu) fit in the left half (%o)', (vp) => {
    const layout = computeMenuLayout(vp);
    const region = menuSplitRegion(vp, EDGE_MARGIN);
    expect(region.right).toBeLessThanOrEqual(vp.width / 2);
    for (let item = 0; item < 8; item++) {
      const p = computeSubMenuPlacement({
        itemIndex: item,
        itemCount: 8,
        subCount: 5,
        layout,
        menuCenter: { x: vp.width / 4, y: vp.height / 2 },
        viewport: vp,
        margin: EDGE_MARGIN,
      });
      const e = layout.sub.extent;
      const box = {
        minX: Math.min(-layout.extent, p.center.x - e),
        minY: Math.min(-layout.extent, p.center.y - e),
        maxX: Math.max(layout.extent, p.center.x + e),
        maxY: Math.max(layout.extent, p.center.y + e),
      };
      const { center, scale } = fitMenusInRegion(box, region);
      expect(scale).toBeLessThanOrEqual(1);
      expect(scale).toBeGreaterThan(0.3);
      expect(center.x + box.minX * scale).toBeGreaterThanOrEqual(region.left - 1e-6);
      expect(center.x + box.maxX * scale).toBeLessThanOrEqual(region.right + 1e-6);
      expect(center.y + box.minY * scale).toBeGreaterThanOrEqual(region.top - 1e-6);
      expect(center.y + box.maxY * scale).toBeLessThanOrEqual(region.bottom + 1e-6);
    }
  });

  it('does not shrink menus that already fit', () => {
    const fit = fitMenusInRegion({ minX: -100, minY: -100, maxX: 100, maxY: 100 }, { left: 0, top: 0, right: 600, bottom: 600 });
    expect(fit.scale).toBe(1);
    expect(fit.center).toEqual({ x: 300, y: 300 });
  });

  it('caption stays the same height at any zoom', () => {
    expect(cardHeightFor(300, aspect) - Math.round(300 * aspect)).toBe(CAPTION_H);
  });
});

describe('split view state', () => {
  const card = (subItemId: string): NewImageCard => ({
    mainItemId: 'item-1',
    subItemId,
    title: subItemId,
    seed: 1,
    x: 100,
    y: 100,
    width: 200,
    height: 180,
    tether: null,
  });
  const initial = useExplorerStore.getState();
  beforeEach(() => useExplorerStore.setState(initial, true));

  it('closing the zoomed card ends split view', () => {
    const s = useExplorerStore.getState();
    s.toggleImage(card('a'));
    const id = useExplorerStore.getState().images[0].id;
    s.detachImage(id);
    s.setFocusCard(id);
    expect(useExplorerStore.getState().focusCardId).toBe(id);
    s.closeImage(id);
    expect(useExplorerStore.getState().focusCardId).toBeNull();
  });

  it('closing another card keeps split view', () => {
    const s = useExplorerStore.getState();
    s.toggleImage(card('a'));
    const a = useExplorerStore.getState().images[0].id;
    s.detachImage(a);
    s.toggleImage(card('b'));
    const b = useExplorerStore.getState().images[1].id;
    s.setFocusCard(a);
    s.closeImage(b);
    expect(useExplorerStore.getState().focusCardId).toBe(a);
  });
});

describe('tray of earlier images', () => {
  it.each(VIEWPORTS)('lines thumbnails up side by side in the bottom of the right half (%o)', (vp) => {
    for (let n = 1; n <= MAX_SHELF; n++) {
      const { slots, top } = shelfLayout(vp, n, aspect);
      expect(slots).toHaveLength(n);
      for (let i = 0; i < n; i++) {
        const t = slots[i];
        // inside the right half, on the bottom edge
        expect(t.x - t.width / 2).toBeGreaterThanOrEqual(vp.width / 2);
        expect(t.x + t.width / 2).toBeLessThanOrEqual(vp.width - CARD_MARGIN + 1e-6);
        expect(t.y + t.height / 2).toBeCloseTo(vp.height - CARD_MARGIN, 6);
        // side by side, no overlap, oldest on the left
        if (i > 0) expect(t.x - t.width / 2).toBeGreaterThan(slots[i - 1].x + slots[i - 1].width / 2);
      }
      // the newest sits at the right edge
      expect(slots[n - 1].x + slots[n - 1].width / 2).toBeCloseTo(vp.width - CARD_MARGIN, 6);
      // the active card's space ends above the tray
      expect(top).toBeLessThan(slots[0].y - slots[0].height / 2);
    }
  });

  it.each(VIEWPORTS)('zoom stays between the screen info and the tray (%o)', (vp) => {
    const { top } = shelfLayout(vp, MAX_SHELF, aspect);
    const w = maxCardWidth(vp, aspect, TOP_INSET, top);
    expect(w).toBeLessThanOrEqual(vp.width / 2);
    expect(cardHeightFor(w, aspect)).toBeLessThanOrEqual(top - TOP_INSET + 1);
    const r = cardSplitRegion(vp, TOP_INSET, top);
    const c = clampIntoRegion({ x: vp.width, y: vp.height }, w, cardHeightFor(w, aspect), r);
    expect(c.y + cardHeightFor(w, aspect) / 2).toBeLessThanOrEqual(top + 1e-6);
    expect(c.y - cardHeightFor(w, aspect) / 2).toBeGreaterThanOrEqual(TOP_INSET - 1e-6);
  });

  it('an empty tray takes no space', () => {
    const vp = VIEWPORTS[0];
    expect(shelfLayout(vp, 0, aspect)).toEqual({ slots: [], top: vp.height - CARD_MARGIN });
  });
});

