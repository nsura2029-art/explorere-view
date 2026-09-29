import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Backdrop } from '../components/Backdrop';
import { CrystallineEffectLayer } from '../components/effects/CrystallineEffectLayer';
import { activateShelved, EMPTY_DISPLAY, showOnDisplay, type DisplayState } from '../displays/displayShelf';
import { CHANNEL_NAME, windowRect, type LinkMessage } from '../displays/protocol';
import { useTapChime } from '../hooks/useTapChime';
import { useViewport } from '../hooks/useViewport';
import { shelfLayout } from '../utils/cardPlacement';
import { SCENE_ASPECT, sceneImageUrl } from '../utils/sceneImage';

/** In full screen the mouse cursor hides after this long without moving, and comes back on any move. */
const CURSOR_IDLE_MS = 3000;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `d-${Math.random().toString(36).slice(2)}`;

function requestFullscreen() {
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {
    /* needs a user gesture: the hint stays visible */
  });
}

/**
 * A window on one of the external screens. Announces itself to the controller and shows each
 * thrown image full screen, flying in from the side facing the touchscreen. Earlier images wait
 * as thumbnails in a tray at the bottom right (like the touchscreen's tray): tap one to bring it
 * back full screen. Touches and clicks
 * here get the same crystalline burst and tap sound as on the touchscreen (mute is shared).
 */
export function DisplayApp() {
  const reduceMotion = useReducedMotion() ?? false;
  const [view, setView] = useState<DisplayState>(EMPTY_DISPLAY);
  const shown = view.active;
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const [linked, setLinked] = useState(false);
  const seq = useRef(0);
  const [cursorIdle, setCursorIdle] = useState(false);
  useTapChime();

  // Cursor stays visible while the mouse is in use; only after a few still seconds does it hide.
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setCursorIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorIdle(true), CURSOR_IDLE_MS);
    };
    wake();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointermove', wake, opts);
    window.addEventListener('pointerdown', wake, opts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake, opts);
      window.removeEventListener('pointerdown', wake, opts);
    };
  }, []);

  useEffect(() => {
    document.title = 'Explorer · Display';
    const id = newId();
    const name = window.name || id;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    const hello = () => ch.postMessage({ type: 'hello', id, name, rect: windowRect() } satisfies LinkMessage);
    ch.onmessage = (e: MessageEvent<LinkMessage>) => {
      const msg = e.data;
      if (msg.type === 'ping') {
        setLinked(true);
        hello();
      } else if (msg.type === 'show' && msg.target === id) {
        setLinked(true);
        const incoming = { key: ++seq.current, image: msg.image, direction: msg.direction, speed: msg.speed, from: 'throw' as const };
        setView((v) => showOnDisplay(v, incoming));
        requestFullscreen();
      }
    };
    hello();
    const onResize = () => hello();
    const onBye = () => ch.postMessage({ type: 'bye', id } satisfies LinkMessage);
    // Fullscreen handed over by the controller's tap (capability delegation).
    const onWindowMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'go-fullscreen') requestFullscreen();
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', onBye);
    window.addEventListener('message', onWindowMessage);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      onBye();
      ch.close();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', onBye);
      window.removeEventListener('message', onWindowMessage);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  const { width: vw, height: vh } = useViewport();
  const shelf = shelfLayout({ width: vw, height: vh }, view.shelf.length, SCENE_ASPECT);
  const bringBack = (key: number) => setView((v) => activateShelved(v, key, ++seq.current));

  return (
    <div
      className={`display${fullscreen ? ' is-fullscreen' : ''}${cursorIdle ? ' is-cursor-idle' : ''}`}
      onClick={requestFullscreen}
    >
      <Backdrop />

      <AnimatePresence>
        {!shown && (
          <motion.div
            key="idle"
            className="display__idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="display__title">Explorer display</div>
            <div className="display__sub">
              {linked ? 'Connected — throw an image toward this screen' : 'Waiting for the touchscreen controller…'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {shown && (
          <motion.figure
            key={shown.key}
            className="display__stage"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : shown.from === 'tray'
                ? { opacity: 0, scale: 0.94 }
                : {
                    // Arrive from the edge facing the controller, carrying the throw's direction.
                    x: -shown.direction.x * vw * 0.9,
                    y: -shown.direction.y * vh * 0.9,
                    scale: 0.35,
                    opacity: 0.4,
                  }
            }
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 1.04, transition: { duration: 0.45 } }}
            transition={
              reduceMotion
                ? { duration: 0.3 }
                : { type: 'spring', stiffness: 90, damping: 18, mass: 1 }
            }
          >
            <img src={sceneImageUrl(shown.image.seed)} alt={shown.image.title} draggable={false} />
            <motion.figcaption
              className="display__caption"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.6, duration: 0.5 }}
            >
              {shown.image.title}
            </motion.figcaption>
          </motion.figure>
        )}
      </AnimatePresence>

      {/* tray: earlier images shrink down here; tap one to bring it back */}
      <AnimatePresence>
        {view.shelf.map((e, i) => {
          const slot = shelf.slots[i];
          const box = { left: slot.x - slot.width / 2, top: slot.y - slot.height / 2, width: slot.width, height: slot.height };
          return (
            <motion.button
              key={e.key}
              type="button"
              className="display__thumb"
              aria-label={`Show ${e.image.title}`}
              initial={reduceMotion ? { ...box, opacity: 0 } : { left: 0, top: 0, width: vw, height: vh, opacity: 0.7 }}
              animate={{ ...box, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.85, transition: { duration: 0.25 } }}
              transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 170, damping: 24 }}
              onClick={() => bringBack(e.key)}
            >
              <img src={sceneImageUrl(e.image.seed)} alt="" draggable={false} />
              <span className="display__thumb-title">{e.image.title}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {!fullscreen && (
        <button type="button" className="display__fs-hint" data-sound="off" onClick={requestFullscreen}>
          Click for full screen (or press F11)
        </button>
      )}

      <CrystallineEffectLayer />
    </div>
  );
}
