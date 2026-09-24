import { memo, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExplorerStore, type Ripple as RippleData, type RippleKind } from '../store/useExplorerStore';

const RINGS = [0, 0.08, 0.16];
const DURATION = 0.8;

const useRemove = () => useExplorerStore((s) => s.removeRipple);

/** Background touch: three quick concentric rings (spec 4.2). */
function SurfaceRipple({ ripple, reduced }: { ripple: RippleData; reduced: boolean }) {
  const removeRipple = useRemove();
  const rings = reduced ? [0] : RINGS;
  const duration = reduced ? 0.45 : DURATION;
  return (
    <div className="ripple" style={{ left: ripple.x, top: ripple.y }}>
      {!reduced && (
        <motion.span
          className="ripple__flash"
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 1.2, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      )}
      {rings.map((delay, i) => (
        <motion.span
          key={i}
          className={`ripple__ring ripple__ring--${i}${reduced ? ' ripple__ring--reduced' : ''}`}
          initial={{ scale: 0.08, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ delay, duration, ease: [0.16, 0.84, 0.44, 1] }}
          onAnimationComplete={i === rings.length - 1 ? () => removeRipple(ripple.id) : undefined}
        />
      ))}
    </div>
  );
}

const WATER_RINGS = [0, 0.14, 0.28, 0.42];
const WATER_S = 1.25;
/** Final ripple diameter as a multiple of the tapped node's diameter. */
const WATER_REACH = 3.2;

/**
 * Tapped item: a slow, soft water ripple that starts at the node's center, tinted with its tone.
 * A translucent swell spreads first, then rings follow it outward and fade.
 */
function WaterRipple({ ripple, reduced }: { ripple: RippleData; reduced: boolean }) {
  const removeRipple = useRemove();
  const size = (ripple.size ?? 90) * (reduced ? 1.8 : WATER_REACH);
  const rings = reduced ? [0] : WATER_RINGS;
  const style = {
    left: ripple.x,
    top: ripple.y,
    '--rs': `${size}px`,
    '--rc': ripple.color ?? '#7fb3ff',
  } as CSSProperties;
  return (
    <div className="ripple ripple--water" style={style}>
      {!reduced && (
        <motion.span
          className="water__swell"
          initial={{ scale: 0.05, opacity: 0.75 }}
          animate={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1] }}
        />
      )}
      {rings.map((delay, i) => (
        <motion.span
          key={i}
          className="water__ring"
          style={{ borderWidth: Math.max(1, 3 - i * 0.6) }}
          initial={{ scale: 0.04, opacity: 0.9 - i * 0.12 }}
          animate={{ scale: 1 - i * 0.06, opacity: 0 }}
          transition={{ delay, duration: reduced ? 0.5 : WATER_S, ease: [0.15, 0.6, 0.35, 1] }}
          onAnimationComplete={i === rings.length - 1 ? () => removeRipple(ripple.id) : undefined}
        />
      ))}
    </div>
  );
}

const Ripple = memo(function Ripple({ ripple, reduced }: { ripple: RippleData; reduced: boolean }) {
  return ripple.kind === 'item' ? (
    <WaterRipple ripple={ripple} reduced={reduced} />
  ) : (
    <SurfaceRipple ripple={ripple} reduced={reduced} />
  );
});

/** Ripples of one kind. Never intercepts input. */
export function RippleLayer({ kind }: { kind: RippleKind }) {
  const ripples = useExplorerStore((s) => s.ripples);
  const reduced = useReducedMotion() ?? false;
  return (
    <div className={`ripple-layer ripple-layer--${kind}`} aria-hidden="true">
      {ripples
        .filter((r) => r.kind === kind)
        .map((r) => (
          <Ripple key={r.id} ripple={r} reduced={reduced} />
        ))}
    </div>
  );
}
