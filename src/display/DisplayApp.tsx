import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Backdrop } from '../components/Backdrop';
import { CHANNEL_NAME, windowRect, type LinkMessage, type ThrownImage } from '../displays/protocol';
import type { Point } from '../utils/radialGeometry';
import { sceneImageUrl } from '../utils/sceneImage';

type Shown = { key: number; image: ThrownImage; direction: Point; speed: number };

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
 * thrown image full screen, flying in from the side facing the touchscreen.
 */
export function DisplayApp() {
  const reduceMotion = useReducedMotion() ?? false;
  const [shown, setShown] = useState<Shown | null>(null);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const [linked, setLinked] = useState(false);
  const seq = useRef(0);

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
        setShown({ key: ++seq.current, image: msg.image, direction: msg.direction, speed: msg.speed });
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

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <div className={`display${fullscreen ? ' is-fullscreen' : ''}`} onClick={requestFullscreen}>
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

      {!fullscreen && (
        <button type="button" className="display__fs-hint" onClick={requestFullscreen}>
          Click for full screen (or press F11)
        </button>
      )}
    </div>
  );
}
