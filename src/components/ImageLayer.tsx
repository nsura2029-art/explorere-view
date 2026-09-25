import { memo, useEffect, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { pickThrowTarget } from '../displays/throwMath';
import { controllerCenter, labelDisplays, postToDisplays, useDisplayStore } from '../displays/useDisplayLink';
import { useDoubleTap } from '../hooks/useDoubleTap';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useViewport } from '../hooks/useViewport';
import { useExplorerStore, type ImageCard as Card } from '../store/useExplorerStore';
import { cardHeightFor, cardSize, clampCardCenter, clampCardWidth } from '../utils/cardPlacement';
import type { Point } from '../utils/radialGeometry';
import { SCENE_ASPECT, sceneImageUrl } from '../utils/sceneImage';

function CloseButton({ onClose }: { onClose: () => void }) {
  const handlers = usePointerDrag({ onTap: onClose });
  return (
    <button
      type="button"
      className="image-card__close"
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

/** Double tap zooms a card in to this multiple of its default width (limited by the screen). */
const ZOOM_IN = 2;
const ZOOM_SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const;

/**
 * An image shown by a submenu item. Attached cards hang off their sub item; dragging one
 * detaches it so it stays wherever it is dropped, independent of the menu. Pinch with two
 * fingers (or double-tap) to zoom it in and out.
 */
function ImageCardBase({ card }: { card: Card }) {
  const reduceMotion = useReducedMotion() ?? false;
  const viewport = useViewport();
  const vpRef = useRef(viewport);
  vpRef.current = viewport;
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
  /** Places the card at `c` (clamped on screen) with width `width`. */
  const place = (c: Point, width: number) => {
    const vp = vpRef.current;
    const cw = clampCardWidth(width, vp, SCENE_ASPECT);
    const ch = cardHeightFor(cw, SCENE_ASPECT);
    const p = clampCardCenter(c, cw, ch, vp);
    return { x: p.x, y: p.y, width: cw, height: ch };
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

  /** Double tap: zoom in around the card's center, or back to the default size if already zoomed. */
  const toggleZoom = () => {
    const vp = vpRef.current;
    const base = cardSize(vp, SCENE_ASPECT).width;
    const zoomedIn = w.get() > base * 1.3;
    const next = place(center(), zoomedIn ? base : base * ZOOM_IN);
    useExplorerStore.getState().detachImage(card.id);
    const t = reduceMotion ? { duration: 0 } : ZOOM_SPRING;
    animate(w, next.width, t);
    animate(h, next.height, t);
    animate(left, next.x - next.width / 2, t);
    animate(top, next.y - next.height / 2, t).then(commit);
  };

  // Follow store changes (resize clamping, commits).
  useEffect(() => {
    w.set(card.width);
    h.set(card.height);
    left.set(card.x - card.width / 2);
    top.set(card.y - card.height / 2);
  }, [card.x, card.y, card.width, card.height, w, h, left, top]);

  const handlers = usePointerDrag({
    onPress: ({ start }) => {
      if (thrown) return false;
      useExplorerStore.getState().bringImageToFront(card.id);
      if (doubleTap.isSecondTap('card', start)) toggleZoom();
    },
    onTap: ({ start }) => {
      // Nothing happens on a single tap; this just arms the double tap.
      doubleTap.deferSingle('card', start, () => {});
    },
    onDragStart: () => {
      doubleTap.clear();
      useExplorerStore.getState().detachImage(card.id);
      useDisplayStore.getState().setCardDragging(true);
      setDragging(true);
      // Follow the finger 1:1 from the card's position when the press began.
      origin.current = center();
    },
    onDragMove: (_info, delta) => {
      const c = clampCardCenter(
        { x: origin.current.x + delta.x, y: origin.current.y + delta.y },
        w.get(),
        h.get(),
        vpRef.current,
      );
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
      commit();
    },
    // Two fingers: zoom around the fingers' midpoint and follow it.
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
    onPinch: (scale, pan) => {
      const b = pinchBase.current;
      const next = place({ x: b.cx + pan.x, y: b.cy + pan.y }, b.w * scale);
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
      className={`image-card${card.detached ? ' is-detached' : ' is-attached'}${dragging ? ' is-dragging' : ''}${thrown ? ' is-thrown' : ''}`}
      data-role="image-card"
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
          <span className="image-card__hint">
            {card.detached ? 'Drag to move · pinch to zoom' : 'Drag to detach · pinch to zoom'}
          </span>
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
  const attached = images.filter((c) => !c.detached && c.tether);
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
          <ImageCard key={c.id} card={c} />
        ))}
      </AnimatePresence>
    </div>
  );
}
