import { memo, useMemo } from 'react';

/** Deterministic PRNG so the starfield is stable between renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function BackdropBase() {
  const stars = useMemo(() => {
    const rnd = mulberry32(20260923);
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: rnd() * 100,
      top: rnd() * 100,
      size: 1 + rnd() * 1.8,
      delay: rnd() * 6,
      duration: 3.5 + rnd() * 4,
      hue: rnd() < 0.3 ? 'm' : rnd() < 0.6 ? 'p' : 'b',
    }));
  }, []);

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__nebula" />
      <div className="backdrop__floor" />
      {stars.map((s) => (
        <span
          key={s.id}
          className={`star star--${s.hue}`}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
      <div className="backdrop__vignette" />
    </div>
  );
}

export const Backdrop = memo(BackdropBase);
