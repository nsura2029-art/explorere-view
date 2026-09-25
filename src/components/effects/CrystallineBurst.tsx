import { memo, useEffect, type CSSProperties, type ReactNode } from 'react';
import { BURST_MS, type Particle, type ParticleShape } from '../../utils/createCrystallineParticles';

export type CrystallineEffect = {
  id: number;
  pointerId: number;
  /** Exact pointer position (clientX / clientY). */
  x: number;
  y: number;
  createdAt: number;
  /** Decided once when the effect is created. */
  particles: Particle[];
  reduced: boolean;
};

/** Crystalline shapes on a 24×24 grid, filled with the particle colour. */
const SHAPES: Record<Exclude<ParticleShape, 'dot'>, ReactNode> = {
  // four-point sparkle with slender concave arms
  star: <path d="M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z" />,
  // slender crystal (taller than wide), pointed along its flight
  diamond: <path d="M12 0.5L17.5 12L12 23.5L6.5 12Z" />,
  shard: <path d="M12 0L14.6 12L12 24L9.4 12Z" />,
  snow: (
    <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
      <path d="M12 2V22M3.3 7L20.7 17M3.3 17L20.7 7" />
      <path d="M12 2L10 4.5M12 2L14 4.5M12 22L10 19.5M12 22L14 19.5" strokeWidth="1.6" />
    </g>
  ),
};

function CrystallineBurstBase({ effect, onDone }: { effect: CrystallineEffect; onDone: (id: number) => void }) {
  // Remove this burst once its last particle has faded (a timer, so it never lingers).
  useEffect(() => {
    const t = window.setTimeout(() => onDone(effect.id), BURST_MS + 80);
    return () => window.clearTimeout(t);
  }, [effect.id, onDone]);

  return (
    <div
      className="crystal-burst"
      style={{ left: effect.x, top: effect.y }}
      data-burst-id={effect.id}
      data-pointer-id={effect.pointerId}
    >
      <span className="crystal-flash" />
      {!effect.reduced && <span className="crystal-wave" />}
      {effect.particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const style = {
          '--size': `${p.px}px`,
          '--c': p.color,
          '--glow': p.glow,
          '--dx': `${(Math.cos(rad) * p.distance).toFixed(1)}px`,
          '--dy': `${(Math.sin(rad) * p.distance).toFixed(1)}px`,
          '--r0': `${p.rotation.toFixed(1)}deg`,
          '--r1': `${(p.rotation + p.spin).toFixed(1)}deg`,
          '--s1': p.scaleEnd.toFixed(3),
          '--delay': `${p.delay}ms`,
          '--dur': `${p.duration}ms`,
        } as CSSProperties;
        return (
          <span
            key={p.id}
            className={`crystal-p crystal-p--${p.size} crystal-p--${p.shape}`}
            data-size={p.size}
            data-family={p.family}
            style={style}
          >
            {p.shape !== 'dot' && (
              <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
                {SHAPES[p.shape]}
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}

export const CrystallineBurst = memo(CrystallineBurstBase);
