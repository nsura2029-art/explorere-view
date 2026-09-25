import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { pickThrowTarget } from '../displays/throwMath';
import { controllerCenter, labelDisplays, postToDisplays, useDisplayStore } from '../displays/useDisplayLink';
import { useDoubleTap } from '../hooks/useDoubleTap';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useViewport } from '../hooks/useViewport';
import { useExplorerStore, type ImageCard as Card } from '../store/useExplorerStore';
import {
  cardHeightFor,
  cardSize,
  cardSplitRegion,
  clampCardCenter,
  clampCardWidth,
  clampIntoRegion,
  CARD_MARGIN,
  DEFAULT_TOP_INSET,
  isZoomedIn,
  shelfLayout,
  type Slot,
} from '../utils/cardPlacement';
import type { Point } from '../utils/radialGeometry';
import { SCENE_ASPECT, sceneImageUrl } from '../utils/sceneImage';

function CloseButton({ onClose }: { onClose: () => void }) {
  const handlers = usePointerDrag({ onTap: onClose });
  return (
    <button
      type="button"
      className="image-card__close"
      data-sound="off"
      aria-label="Close image"
      {...handlers}
      onClick={(e) => {
        if (e.detail === 0) onClose();
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Space kept clear under the top-right screen info ("Open screens"), measured live. */
function topInset(): number {
  const r = document.querySelector('.screens__row')?.getBoundingClientRect();
  return r && r.height > 0 ? Math.ceil(r.bottom + 12) : DEFAULT_TOP_INSET;
}

/** Double tap zooms a card in to this multiple of its default width (limited by the screen). */
const ZOOM_IN = 2;
const ZOOM_SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const;

type CardProps = {
  card: Card;
  /** Tray slot while the card waits as a thumbnail (null for the active card). */
  slot: Slot | null;
  /** Split view is on: the active card lives in the right half, above the tray. */
  split: boolean;
  /** Lowest the active card may reach (the top of the tray, or the screen bottom). */
  bottom: number;
};

/**
 * An image shown by a submenu item. The newest (active) one is a full card: drag it anywhere
 * (detaching it from its sub item), pinch or double-tap to zoom, flick it to another screen.
 * Earlier ones wait as thumbnails in the tray at the bottom right: tap one to bring it back,
 * or flick it to another screen.
 */
function ImageCardBase({ card, slot, split, bottom }: CardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const viewport = useViewport();
  const vpRef = useRef(viewport);
  vpRef.current = viewport;
  const layoutRef = useRef({ split, bottom });
  layoutRef.current = { split, bottom };
  // Position (top-left) and size in motion values: dragging and zooming never re-render.
  const w = useMotionValue(card.width);
  const h = useMotionValue(card.height);
  const left = useMotionValue(card.x - card.width / 2);
  const top = useMotionValue(card.y - card.height / 2);
  const [dragging, setDragging] = useState(false);
  const [thrown, setThrown] = useState(false);
  const origin = useRef<Point>({ x: 0, y: 0 });
  const pinchBase = useRef({ w: card.width, cx: card.x, cy: card.y });
  const doubleTap = useDoubleTap();

  const center = () => ({ x: left.get() + w.get() / 2, y: top.get() + h.get() / 2 });
  /** Where the active card may be: the right half above the tray in split view (or when zoomed). */
  const region = () => cardSplitRegion(vpRef.current, topInset(), layoutRef.current.bottom);
  /**
   * Places the active card at `c` with width `width`: never wider than half the screen, never
   * taller than the space between the screen info and the tray. Zoomed in (or in split view) it
   * lives in the right half.
   */
  const place = (c: Point, width: number) => {
    const vp = vpRef.current;
    const inset = topInset();
    const { split: isSplit, bottom: limit } = layoutRef.current;
    const floor = isSplit ? limit : vp.height - CARD_MARGIN;
    const cw = clampCardWidth(width, vp, SCENE_ASPECT, inset, floor);
    const ch = cardHeightFor(cw, SCENE_ASPECT);
    const zoomed = isZoomedIn(cw, vp, SCENE_ASPECT);
    const p = zoomed || isSplit ? clampIntoRegion(c, cw, ch, region()) : clampCardCenter(c, cw, ch, vp);
    return { x: p.x, y: p.y, width: cw, height: ch, zoomed };
  };
  /** Zoomed in → this card takes split view (menus move left); back to normal → zoom split ends. */
  const syncFocus = (zoomed: boolean) => {
    const s = useExplorerStore.getState();
    if (zoomed && s.focusCardId !== card.id) s.setFocusCard(card.id);
    else if (!zoomed && s.focusCardId === card.id) s.setFocusCard(null);
  };
  const commit = () => {
    const c = center();
    useExplorerStore.getState().resizeImage(card.id, c.x, c.y, w.get(), h.get());
  };

  /** Flies the card off the edge toward the display, which takes over and shows it full screen. */
  const throwTo = (target: string, velocity: Point) => {
    const speed = Math.hypot(velocity.x, velocity.y);
    const dir = { x: velocity.x / speed, y: velocity.y / speed };
    setThrown(true);
    postToDisplays({
      type: 'show',
      target,
      image: { seed: card.seed, title: card.title },
      direction: dir,
      speed,
    });
    const vp = vpRef.current;
    const dist = Math.hypot(vp.width, vp.height);
    // Keep the release speed (px/ms) so the hand-off feels continuous.
    const duration = Math.min(Math.max(dist / speed / 1000, 0.18), 0.45);
    const t = { duration, ease: [0.25, 0.6, 0.5, 1] as const };
    animate(left, left.get() + dir.x * dist, t);
    animate(top, top.get() + dir.y * dist, t).then(() => useExplorerStore.getState().closeImage(card.id));
  };

  /** Animates the card to a position and size. */
  const glideTo = (next: { x: number; y: number; width: number; height: number }) => {
    const t = reduceMotion ? { duration: 0 } : ZOOM_SPRING;
    animate(w, next.width, t);
    animate(h, next.height, t);
    animate(left, next.x - next.width / 2, t);
    return animate(top, next.y - next.height / 2, t);
  };

  /** Double tap: zoom in (into the right half), or back to the default size if already zoomed. */
  const toggleZoom = () => {
    const vp = vpRef.current;
    const base = cardSize(vp, SCENE_ASPECT).width;
    const next = place(center(), isZoomedIn(w.get(), vp, SCENE_ASPECT) ? base : base * ZOOM_IN);
    useExplorerStore.getState().detachImage(card.id);
    syncFocus(next.zoomed);
    glideTo(next).then(commit);
  };

  // Another card was zoomed in: this one steps back to its normal size.
  const focusCardId = useExplorerStore((s) => s.focusCardId);
  useEffect(() => {
    if (card.shelved || focusCardId === null || focusCardId === card.id) return;
    const vp = vpRef.current;
    if (!isZoomedIn(w.get(), vp, SCENE_ASPECT)) return;
    glideTo(place(center(), cardSize(vp, SCENE_ASPECT).width)).then(commit);
  }, [focusCardId]);

  // Follow store changes (resize clamping, commits).
  useEffect(() => {
    w.set(card.width);
    h.set(card.height);
    left.set(card.x - card.width / 2);
    top.set(card.y - card.height / 2);
  }, [card.x, card.y, card.width, card.height, w, h, left, top]);

  // Tray layout: thumbnails glide into their slot; the active card keeps to its space above the
  // tray (coming back from the tray, it returns at its normal size).
  const wasShelved = useRef(card.shelved);
  useEffect(() => {
    if (thrown) return;
    const returning = wasShelved.current && !card.shelved;
    wasShelved.current = card.shelved;
    if (card.shelved) {
      if (slot) glideTo(slot).then(commit);
      return;
    }
    if (!split && !returning) return;
    const width = returning ? cardSize(vpRef.current, SCENE_ASPECT).width : w.get();
    const next = place(center(), width);
    const c = center();
    if (Math.abs(next.x - c.x) < 0.5 && Math.abs(next.y - c.y) < 0.5 && Math.abs(next.width - w.get()) < 0.5) return;
    glideTo(next).then(commit);
  }, [card.shelved, slot?.x, slot?.y, slot?.width, split, bottom, viewport]);

  const handlers = usePointerDrag({
    onPress: ({ start }) => {
      if (thrown) return false;
      if (card.shelved) return;
      useExplorerStore.getState().bringImageToFront(card.id);
      if (doubleTap.isSecondTap('card', start)) toggleZoom();
    },
    onTap: ({ start }) => {
      // A thumbnail comes back as the active image; on the active card a tap just arms double-tap.
      if (card.shelved) useExplorerStore.getState().activateImage(card.id);
      else doubleTap.deferSingle('card', start, () => {});
    },
    onDragStart: () => {
      doubleTap.clear();
      if (!card.shelved) useExplorerStore.getState().detachImage(card.id);
      useDisplayStore.getState().setCardDragging(true);
      setDragging(true);
      // Follow the finger 1:1 from the card's position when the press began.
      origin.current = center();
    },
    onDragMove: (_info, delta) => {
      const want = { x: origin.current.x + delta.x, y: origin.current.y + delta.y };
      // The active card keeps to its space in split view (or when zoomed); others roam the screen.
      const keep =
        !card.shelved && (layoutRef.current.split || useExplorerStore.getState().focusCardId === card.id);
      const c = keep
        ? clampIntoRegion(want, w.get(), h.get(), region())
        : clampCardCenter(want, w.get(), h.get(), vpRef.current);
      left.set(c.x - w.get() / 2);
      top.set(c.y - h.get() / 2);
    },
    onDragEnd: (_info, _delta, cancelled, velocity) => {
      // A fast flick toward a connected screen sends the card there; otherwise it's a normal drop.
      if (!cancelled) {
        const targets = labelDisplays(useDisplayStore.getState().displays);
        const target = pickThrowTarget(velocity, controllerCenter(), targets);
        if (target) {
          throwTo(target, velocity);
          return;
        }
      }
      // A thumbnail that wasn't thrown goes back to its place in the tray.
      if (card.shelved && slot) glideTo(slot).then(commit);
      else commit();
    },
    // Two fingers on the active card: zoom around the fingers' midpoint and follow it.
    onPinchStart: () => {
      doubleTap.clear();
      useExplorerStore.getState().detachImage(card.id);
      useDisplayStore.getState().setCardDragging(false);
      w.stop();
      h.stop();
      const c = center();
      pinchBase.current = { w: w.get(), cx: c.x, cy: c.y };
      setDragging(true);
    },
    onPinch: card.shelved
      ? undefined
      : (scale, pan) => {
          const b = pinchBase.current;
          const next = place({ x: b.cx + pan.x, y: b.cy + pan.y }, b.w * scale);
          syncFocus(next.zoomed);
          w.set(next.width);
          h.set(next.height);
          left.set(next.x - next.width / 2);
          top.set(next.y - next.height / 2);
        },
    onPinchEnd: commit,
    onRelease: () => {
      setDragging(false);
      useDisplayStore.getState().setCardDragging(false);
    },
  });

  const close = () => useExplorerStore.getState().closeImage(card.id);

  return (
    <motion.div
      className={`image-card${card.detached ? ' is-detached' : ' is-attached'}${card.shelved ? ' is-shelved' : ''}${dragging ? ' is-dragging' : ''}${thrown ? ' is-thrown' : ''}`}
      data-role="image-card"
      data-card-id={card.id}
      style={{ x: left, y: top, width: w, height: h, zIndex: card.z }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{
        opacity: thrown ? 0.15 : 1,
        scale: thrown && !reduceMotion ? 0.8 : dragging && !reduceMotion ? 1.04 : 1,
      }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      {...handlers}
    >
      <div className="image-card__frame">
        <img src={sceneImageUrl(card.seed)} alt={card.title} draggable={false} />
      </div>
      <div className="image-card__caption">
        <div className="image-card__text">
          <span className="image-card__title">{card.title}</span>
          {!card.shelved && (
            <span className="image-card__hint">
              {card.detached ? 'Drag to move · pinch to zoom' : 'Drag to detach · pinch to zoom'}
            </span>
          )}
        </div>
        <CloseButton onClose={close} />
      </div>
    </motion.div>
  );
}

const ImageCard = memo(ImageCardBase);

/** Tether from an attached card back to the sub item that opened it. */
function Tether({ from, to }: { from: Point; to: Point }) {
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <line className="tether tether--glow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <line className="tether" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle className="tether__dot" cx={from.x} cy={from.y} r={4} />
    </motion.g>
  );
}

export function ImageLayer() {
  const images = useExplorerStore((s) => s.images);
  const zoomed = useExplorerStore((s) => s.focusCardId !== null);
  const viewport = useViewport();
  const attached = images.filter((c) => !c.detached && c.tether);
  // Earlier images wait in the tray (bottom right); the active card stays above it.
  const shelved = images.filter((c) => c.shelved);
  const shelf = useMemo(() => shelfLayout(viewport, shelved.length, SCENE_ASPECT), [viewport, shelved.length]);
  const slotOf = new Map(shelved.map((c, i) => [c.id, shelf.slots[i]]));
  const split = zoomed || shelved.length > 0;
  return (
    <div className="image-layer">
      <svg className="tether-layer" width="100%" height="100%" aria-hidden="true">
        <AnimatePresence>
          {attached.map((c) => (
            <Tether key={c.id} from={c.tether!} to={{ x: c.x, y: c.y }} />
          ))}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {images.map((c) => (
          <ImageCard key={c.id} card={c} slot={slotOf.get(c.id) ?? null} split={split} bottom={shelf.top} />
        ))}
      </AnimatePresence>
    </div>
  );
}
