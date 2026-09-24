import { memo, useEffect, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { pickThrowTarget } from '../displays/throwMath';
import { controllerCenter, labelDisplays, postToDisplays, useDisplayStore } from '../displays/useDisplayLink';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useViewport } from '../hooks/useViewport';
import { useExplorerStore, type ImageCard as Card } from '../store/useExplorerStore';
import { clampCardCenter } from '../utils/cardPlacement';
import type { Point } from '../utils/radialGeometry';
import { sceneImageUrl } from '../utils/sceneImage';

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

/**
 * An image shown by a submenu item. Attached cards hang off their sub item; dragging one
 * detaches it so it stays wherever it is dropped, independent of the menu.
 */
function ImageCardBase({ card }: { card: Card }) {
  const reduceMotion = useReducedMotion() ?? false;
  const viewport = useViewport();
  const vpRef = useRef(viewport);
  vpRef.current = viewport;
  const { width, height } = card;
  // Top-left corner in motion values: dragging never re-renders.
  const left = useMotionValue(card.x - width / 2);
  const top = useMotionValue(card.y - height / 2);
  const [dragging, setDragging] = useState(false);
  const [thrown, setThrown] = useState(false);
  const origin = useRef<Point>({ x: 0, y: 0 });

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

  useEffect(() => {
    left.set(card.x - width / 2);
    top.set(card.y - height / 2);
  }, [card.x, card.y, width, height, left, top]);

  const handlers = usePointerDrag({
    onPress: () => {
      if (thrown) return false;
      useExplorerStore.getState().bringImageToFront(card.id);
    },
    onDragStart: () => {
      useExplorerStore.getState().detachImage(card.id);
      useDisplayStore.getState().setCardDragging(true);
      setDragging(true);
      // Follow the finger 1:1 from the card's position when the press began.
      origin.current = { x: left.get() + width / 2, y: top.get() + height / 2 };
    },
    onDragMove: (_info, delta) => {
      const c = clampCardCenter(
        { x: origin.current.x + delta.x, y: origin.current.y + delta.y },
        width,
        height,
        vpRef.current,
      );
      left.set(c.x - width / 2);
      top.set(c.y - height / 2);
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
      useExplorerStore.getState().moveImage(card.id, left.get() + width / 2, top.get() + height / 2);
    },
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
      style={{ x: left, y: top, width, height, zIndex: card.z }}
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
          <span className="image-card__hint">{card.detached ? 'Drag to move' : 'Drag to detach'}</span>
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
