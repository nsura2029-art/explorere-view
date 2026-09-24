import { AnimatePresence, motion } from 'framer-motion';
import { edgePoint } from '../displays/throwMath';
import { controllerCenter, labelDisplays, useDisplayStore } from '../displays/useDisplayLink';
import { useViewport } from '../hooks/useViewport';

/**
 * While an image card is being dragged, marks the screen edges that lead to each connected
 * display ("Screen 2 →"), so the user knows which way to throw.
 */
export function ThrowPortals() {
  const cardDragging = useDisplayStore((s) => s.cardDragging);
  const displays = useDisplayStore((s) => s.displays);
  const viewport = useViewport();
  const from = controllerCenter();
  const portals = cardDragging
    ? labelDisplays(displays).map((d) => {
        const dir = { x: d.center.x - from.x, y: d.center.y - from.y };
        const p = edgePoint(viewport.width, viewport.height, dir, 56);
        return { id: d.id, label: d.label, p, angle: (Math.atan2(dir.y, dir.x) * 180) / Math.PI };
      })
    : [];

  return (
    <div className="portal-layer" aria-hidden="true">
      <AnimatePresence>
        {portals.map((pt) => (
          <motion.div
            key={pt.id}
            className="portal"
            style={{ left: pt.p.x, top: pt.p.y }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <span className="portal__glow" />
            <span className="portal__label">
              {pt.label}
              <svg className="portal__arrow" width="18" height="18" viewBox="0 0 24 24" style={{ rotate: `${pt.angle}deg` }}>
                <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
