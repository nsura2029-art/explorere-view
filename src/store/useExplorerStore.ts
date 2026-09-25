import { create } from 'zustand';
import type { Point } from '../utils/radialGeometry';
import { MAX_SHELF } from '../utils/cardPlacement';
import type { SubMenuPlacement } from '../utils/subMenuPlacement';

export type InteractionMode = 'idle' | 'pressing' | 'dragging';
/** Visual lifecycle of the main menu. 'wandering' = pre-interaction drift across the window. */
export type MotionPhase = 'hidden' | 'revealing' | 'wandering' | 'idle' | 'moving';
/** How a new menu position is applied: instantly (drag/resize) or with the attract spring (tap). */
export type MoveKind = 'jump' | 'spring';

/** 'surface' = background touch (under the menu); 'item' = tapped node (drawn above the menu). */
export type RippleKind = 'surface' | 'item';
export type Ripple = {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  kind: RippleKind;
  /** Item ripples: diameter of the tapped node and its tint. */
  size?: number;
  color?: string;
};

export type ImageCard = {
  id: number;
  mainItemId: string;
  subItemId: string;
  title: string;
  seed: number;
  /** Card center, viewport coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Attached cards are tethered to the sub item that opened them (until dragged or zoomed). */
  detached: boolean;
  /** Viewport point the tether starts from (the sub item rim). */
  tether: Point | null;
  /**
   * Waiting as a thumbnail in the tray (bottom right). Only one card is not shelved: the active one.
   * `images` keeps shelved cards in tray order (oldest first) before the active card.
   */
  shelved: boolean;
  z: number;
};

export type NewImageCard = Omit<ImageCard, 'id' | 'detached' | 'shelved' | 'z'>;

const MAX_RIPPLES = 30;

type ExplorerState = {
  menuPosition: Point | null;
  moveKind: MoveKind;
  /** Bumped on every position change so equal-valued springs still restart cleanly. */
  moveSeq: number;
  activeMainItemId: string | null;
  isSubMenuOpen: boolean;
  subMenu: SubMenuPlacement | null;
  activeSubItemId: string | null;
  interactionMode: InteractionMode;
  motionPhase: MotionPhase;
  hasInteracted: boolean;
  ripples: Ripple[];
  images: ImageCard[];
  /** Clock-tick rotation of the main ring, in item slots (positive = clockwise). */
  ringStep: number;
  /** Double-tapped an item: dragging the menu turns the ring instead of moving the menu. */
  spinMode: boolean;
  /** Rotation of the open submenu's ring, in slots (reset whenever a submenu opens or closes). */
  subRingStep: number;
  /** Double-tapped a sub item: dragging the submenu turns its ring. */
  subSpinMode: boolean;
  /** Date.now() of the last touch anywhere (0 = none yet); drives the 15 s idle auto-rotation. */
  lastActivityAt: number;
  /**
   * Split view: the zoomed-in image card that owns the right half of the screen (null = no split).
   * While set, the menus are docked (and scaled to fit) in the left half.
   */
  focusCardId: number | null;
  /** Current scale of the whole menu (main + submenu); < 1 only while docked in split view. */
  menuScale: number;

  setMenuPosition: (p: Point, kind?: MoveKind) => void;
  setMotionPhase: (phase: MotionPhase) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  markInteracted: () => void;
  openSubMenu: (itemId: string, placement: SubMenuPlacement) => void;
  closeSubMenu: () => void;
  addRipple: (x: number, y: number, item?: { size: number; color: string }) => void;
  removeRipple: (id: number) => void;
  toggleImage: (card: NewImageCard) => void;
  moveImage: (id: number, x: number, y: number) => void;
  /** Zoom (pinch / double tap): new center and size. */
  resizeImage: (id: number, x: number, y: number, width: number, height: number) => void;
  detachImage: (id: number) => void;
  bringImageToFront: (id: number) => void;
  /** Brings a tray thumbnail back as the active image (the current one takes its place in the tray). */
  activateImage: (id: number) => void;
  closeImage: (id: number) => void;
  setImages: (images: ImageCard[]) => void;
  stepRing: (delta: number) => void;
  setRingStep: (step: number) => void;
  setSpinMode: (on: boolean) => void;
  setSubRingStep: (step: number) => void;
  setSubSpinMode: (on: boolean) => void;
  noteActivity: () => void;
  setFocusCard: (id: number | null) => void;
  setMenuScale: (scale: number) => void;
};

let nextId = 1;

const topZ = (images: ImageCard[]) => Math.max(0, ...images.map((c) => c.z));
const toShelf = (c: ImageCard): ImageCard => ({ ...c, shelved: true, detached: true, tether: null });
/** Keeps the tray to MAX_SHELF thumbnails; the oldest leave first. */
const capShelf = (shelf: ImageCard[]) => (shelf.length > MAX_SHELF ? shelf.slice(shelf.length - MAX_SHELF) : shelf);
/** Detaches every tethered card (their sub item is going away), keeping them all. */
const detachAll = (images: ImageCard[]) =>
  images.some((c) => !c.detached) ? images.map((c) => (c.detached ? c : { ...c, detached: true, tether: null })) : images;

/** Removes a card; if it was the active one, the most recent thumbnail steps up to replace it. */
function withoutCard(s: ExplorerState, id: number): Partial<ExplorerState> | ExplorerState {
  const card = s.images.find((c) => c.id === id);
  if (!card) return s;
  let images = s.images.filter((c) => c.id !== id);
  if (!card.shelved) {
    const promoted = [...images].reverse().find((c) => c.shelved);
    if (promoted) {
      images = [...images.filter((c) => c.id !== promoted.id), { ...promoted, shelved: false, z: topZ(images) + 1 }];
    }
  }
  return {
    images,
    activeSubItemId: !card.shelved && s.activeSubItemId === card.subItemId ? null : s.activeSubItemId,
    // Closing (or throwing away) the zoomed card ends its zoom.
    focusCardId: s.focusCardId === id ? null : s.focusCardId,
  };
}

/** Makes `id` the active card; whatever was active goes to the end of the tray. */
function withActive(s: ExplorerState, id: number): Partial<ExplorerState> | ExplorerState {
  const target = s.images.find((c) => c.id === id);
  if (!target || !target.shelved) return s;
  const current = s.images.filter((c) => !c.shelved).map(toShelf);
  const shelf = capShelf([...s.images.filter((c) => c.shelved && c.id !== id), ...current]);
  return {
    images: [...shelf, { ...target, shelved: false, z: topZ(s.images) + 1 }],
    focusCardId: null,
    activeSubItemId: null,
  };
}

/**
 * Durable UI state only. Transient pointer data lives in refs.
 * Invariant: isSubMenuOpen === (activeMainItemId !== null) === (subMenu !== null).
 */
export const useExplorerStore = create<ExplorerState>((set) => ({
  menuPosition: null,
  moveKind: 'jump',
  moveSeq: 0,
  activeMainItemId: null,
  isSubMenuOpen: false,
  subMenu: null,
  activeSubItemId: null,
  interactionMode: 'idle',
  motionPhase: 'hidden',
  hasInteracted: false,
  ripples: [],
  images: [],
  ringStep: 0,
  spinMode: false,
  subRingStep: 0,
  subSpinMode: false,
  lastActivityAt: 0,
  focusCardId: null,
  menuScale: 1,

  setMenuPosition: (menuPosition, moveKind = 'jump') =>
    set((s) =>
      s.menuPosition && s.menuPosition.x === menuPosition.x && s.menuPosition.y === menuPosition.y
        ? s
        : { menuPosition, moveKind, moveSeq: s.moveSeq + 1 },
    ),
  setMotionPhase: (motionPhase) => set({ motionPhase }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  markInteracted: () =>
    set((s) =>
      s.hasInteracted
        ? s
        : { hasInteracted: true, motionPhase: s.motionPhase === 'wandering' ? 'idle' : s.motionPhase },
    ),
  openSubMenu: (activeMainItemId, subMenu) =>
    set((s) => ({
      activeMainItemId,
      isSubMenuOpen: true,
      subMenu,
      activeSubItemId: null,
      subRingStep: 0,
      subSpinMode: false,
      // Images stay open; they just lose their tether to the old submenu.
      images: detachAll(s.images),
    })),
  closeSubMenu: () =>
    set((s) =>
      s.activeMainItemId === null && !s.images.some((c) => !c.detached)
        ? s
        : {
            activeMainItemId: null,
            isSubMenuOpen: false,
            subMenu: null,
            activeSubItemId: null,
            subRingStep: 0,
            subSpinMode: false,
            images: detachAll(s.images),
          },
    ),
  addRipple: (x, y, item) =>
    set((s) => ({
      ripples: [
        ...s.ripples,
        { id: nextId++, x, y, createdAt: performance.now(), kind: item ? 'item' : 'surface', ...item } as Ripple,
      ].slice(-MAX_RIPPLES),
    })),
  removeRipple: (id) => set((s) => ({ ripples: s.ripples.filter((r) => r.id !== id) })),

  /**
   * Shows the image for a sub item as the active card; earlier images move to the tray. Tapping the
   * sub item of the active image again hides it; one already in the tray is brought back instead.
   */
  toggleImage: (card) =>
    set((s) => {
      const active = s.images.find((c) => !c.shelved);
      if (active && active.subItemId === card.subItemId) return withoutCard(s, active.id);
      const waiting = s.images.find((c) => c.shelved && c.subItemId === card.subItemId);
      if (waiting) return withActive(s, waiting.id);
      const shelf = capShelf([...s.images.filter((c) => c.shelved), ...s.images.filter((c) => !c.shelved).map(toShelf)]);
      return {
        images: [...shelf, { ...card, id: nextId++, detached: false, shelved: false, z: topZ(s.images) + 1 }],
        activeSubItemId: card.subItemId,
        focusCardId: null,
      };
    }),
  moveImage: (id, x, y) =>
    set((s) => ({ images: s.images.map((c) => (c.id === id ? { ...c, x, y } : c)) })),
  resizeImage: (id, x, y, width, height) =>
    set((s) => ({ images: s.images.map((c) => (c.id === id ? { ...c, x, y, width, height } : c)) })),
  detachImage: (id) =>
    set((s) => {
      const card = s.images.find((c) => c.id === id);
      if (!card || card.detached) return s;
      return {
        images: s.images.map((c) => (c.id === id ? { ...c, detached: true, tether: null } : c)),
        activeSubItemId: s.activeSubItemId === card.subItemId ? null : s.activeSubItemId,
      };
    }),
  bringImageToFront: (id) =>
    set((s) => {
      const top = Math.max(0, ...s.images.map((c) => c.z));
      const card = s.images.find((c) => c.id === id);
      if (!card || (card.z === top && s.images.filter((c) => c.z === top).length === 1)) return s;
      return { images: s.images.map((c) => (c.id === id ? { ...c, z: top + 1 } : c)) };
    }),
  closeImage: (id) => set((s) => withoutCard(s, id)),
  activateImage: (id) => set((s) => withActive(s, id)),
  setImages: (images) => set({ images }),
  stepRing: (delta) => set((s) => ({ ringStep: s.ringStep + delta })),
  setRingStep: (ringStep) => set({ ringStep }),
  setSpinMode: (spinMode) => set((s) => (s.spinMode === spinMode ? s : { spinMode })),
  setSubRingStep: (subRingStep) => set({ subRingStep }),
  // Turning the submenu would pull its sub items away from a tethered image, so that detaches first.
  setSubSpinMode: (subSpinMode) =>
    set((s) =>
      s.subSpinMode === subSpinMode
        ? s
        : subSpinMode
          ? { subSpinMode, activeSubItemId: null, images: detachAll(s.images) }
          : { subSpinMode },
    ),
  noteActivity: () => set({ lastActivityAt: Date.now() }),
  setFocusCard: (focusCardId) => set((s) => (s.focusCardId === focusCardId ? s : { focusCardId })),
  setMenuScale: (menuScale) => set((s) => (s.menuScale === menuScale ? s : { menuScale })),
}));
