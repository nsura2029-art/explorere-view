import { create } from 'zustand';
import type { Point } from '../utils/radialGeometry';
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
  /** Attached cards are tethered to their submenu item and close with the submenu. */
  detached: boolean;
  /** Viewport point the tether starts from (the sub item rim). */
  tether: Point | null;
  z: number;
};

export type NewImageCard = Omit<ImageCard, 'id' | 'detached' | 'z'>;

const MAX_RIPPLES = 30;
const MAX_IMAGES = 12;

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
  closeImage: (id: number) => void;
  setImages: (images: ImageCard[]) => void;
  stepRing: (delta: number) => void;
  setRingStep: (step: number) => void;
  setSpinMode: (on: boolean) => void;
  setSubRingStep: (step: number) => void;
  setSubSpinMode: (on: boolean) => void;
  noteActivity: () => void;
};

let nextId = 1;

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
      images: s.images.filter((c) => c.detached),
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
            images: s.images.filter((c) => c.detached),
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

  /** Shows the image for a sub item; tapping the same sub item again hides it. Detached cards are untouched. */
  toggleImage: (card) =>
    set((s) => {
      const attached = s.images.find((c) => !c.detached);
      const kept = s.images.filter((c) => c.detached);
      if (attached && attached.subItemId === card.subItemId) {
        return { images: kept, activeSubItemId: null };
      }
      const z = Math.max(0, ...s.images.map((c) => c.z)) + 1;
      const next = [...kept, { ...card, id: nextId++, detached: false, z }];
      return { images: next.slice(-MAX_IMAGES), activeSubItemId: card.subItemId };
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
  closeImage: (id) =>
    set((s) => {
      const card = s.images.find((c) => c.id === id);
      if (!card) return s;
      return {
        images: s.images.filter((c) => c.id !== id),
        activeSubItemId: !card.detached && s.activeSubItemId === card.subItemId ? null : s.activeSubItemId,
      };
    }),
  setImages: (images) => set({ images }),
  stepRing: (delta) => set((s) => ({ ringStep: s.ringStep + delta })),
  setRingStep: (ringStep) => set({ ringStep }),
  setSpinMode: (spinMode) => set((s) => (s.spinMode === spinMode ? s : { spinMode })),
  setSubRingStep: (subRingStep) => set({ subRingStep }),
  // Turning the submenu would pull its sub items away from an attached image, so that closes first.
  setSubSpinMode: (subSpinMode) =>
    set((s) =>
      s.subSpinMode === subSpinMode
        ? s
        : subSpinMode
          ? { subSpinMode, activeSubItemId: null, images: s.images.filter((c) => c.detached) }
          : { subSpinMode },
    ),
  noteActivity: () => set({ lastActivityAt: Date.now() }),
}));
