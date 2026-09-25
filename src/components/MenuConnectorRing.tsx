import { memo, useId } from 'react';
import { TONE_COLORS, type Tone } from '../data/menuData';
import { outerOrbitRadius } from '../utils/menuLayout';
import { getBridgePath, pointOnRim, type Point } from '../utils/radialGeometry';

type Props = {
  /** Stage size (square) in px. */
  size: number;
  center: Point;
  nodes: Point[];
  tones: Tone[];
  nodeSize: number;
  hubSize: number;
  ringRadius: number;
  /** 'under' draws bridges + orbits, 'over' draws the twinkling joint dots above nodes. */
  layer: 'under' | 'over';
};

function MenuConnectorRingBase({ size, center, nodes, tones, nodeSize, hubSize, ringRadius, layer }: Props) {
  const uid = useId().replace(/[:«»]/g, '');
  const r = nodeSize / 2;
  const n = nodes.length;

  if (layer === 'over') {
    const dots: Array<Point & { key: string; color: string; delay: number }> = [];
    nodes.forEach((p, i) => {
      const next = nodes[(i + 1) % n];
      const c = TONE_COLORS[tones[i]].soft;
      dots.push({ ...pointOnRim(p, next, r + 1), key: `n${i}`, color: c, delay: i * 0.37 });
      dots.push({ ...pointOnRim(p, center, r + 1), key: `h${i}`, color: c, delay: i * 0.37 + 1.1 });
    });
    return (
      <svg className="ring-svg ring-svg--over" width={size} height={size} aria-hidden="true">
        <defs>
          <filter id={`dotglow-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#dotglow-${uid})`}>
          {dots.map((d) => (
            <circle
              key={d.key}
              className="conn-dot"
              cx={d.x}
              cy={d.y}
              r={Math.max(2.6, nodeSize * 0.028)}
              fill={d.color}
              style={{ animationDelay: `${d.delay}s` }}
            />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg className="ring-svg ring-svg--under" width={size} height={size} aria-hidden="true">
      <defs>
        <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {nodes.map((p, i) => {
          const q = nodes[(i + 1) % n];
          return (
            <linearGradient
              key={i}
              id={`br-${uid}-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
            >
              <stop offset="0.3" stopColor={TONE_COLORS[tones[i]].core} stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#b8c4ff" stopOpacity="0.6" />
              <stop offset="0.7" stopColor={TONE_COLORS[tones[(i + 1) % n]].core} stopOpacity="0.9" />
            </linearGradient>
          );
        })}
      </defs>

      {/* orbit decorations */}
      <circle className="orbit orbit--outer" cx={center.x} cy={center.y} r={outerOrbitRadius(ringRadius, nodeSize)} />
      <circle className="orbit orbit--faint" cx={center.x} cy={center.y} r={ringRadius + r * 1.02} />
      <circle className="orbit orbit--dotted" cx={center.x} cy={center.y} r={hubSize / 2 + 14} />
      <circle className="orbit orbit--inner" cx={center.x} cy={center.y} r={hubSize / 2 + 30} />

      {/* liquid bridges between neighbours */}
      <g filter={`url(#glow-${uid})`}>
        {nodes.map((p, i) => {
          const q = nodes[(i + 1) % n];
          return (
            <path
              key={i}
              className="bridge"
              d={getBridgePath(p, q, r, 0.44, 0.22)}
              fill={`url(#br-${uid}-${i})`}
            />
          );
        })}
      </g>
      {/* energy flow along the ring */}
      <circle
        className="energy-flow"
        cx={center.x}
        cy={center.y}
        r={ringRadius}
        strokeDasharray={`${ringRadius * 0.05} ${ringRadius * 0.21}`}
      />
    </svg>
  );
}

export const MenuConnectorRing = memo(MenuConnectorRingBase);
