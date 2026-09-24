import { clamp, type Viewport } from './clampPosition';

export const EDGE_MARGIN = 20;
const GLOW_PAD = 14;

export type MenuLayout = {
  ringRadius: number;
  nodeSize: number;
  hubSize: number;
  /** Distance from menu center to its outermost visible pixel. */
  extent: number;
  sub: { ringRadius: number; nodeSize: number; hubSize: number; extent: number };
};

/** Responsive sizing derived from the viewport's short side. No hard-coded screen sizes. */
export function computeMenuLayout({ width, height }: Viewport): MenuLayout {
  const base = Math.min(width, height);
  const ringRadius = clamp(base * 0.2, 118, 200);
  const nodeSize = Math.round(ringRadius * 0.6);
  const hubSize = Math.round(ringRadius * 0.98);
  const extent = Math.ceil(ringRadius + nodeSize / 2 + GLOW_PAD);

  const subRing = Math.round(ringRadius * 0.62);
  const subNode = Math.max(72, Math.round(nodeSize * 0.8));
  const subHub = Math.round(subRing * 1.02);
  return {
    ringRadius,
    nodeSize,
    hubSize,
    extent,
    sub: {
      ringRadius: subRing,
      nodeSize: subNode,
      hubSize: subHub,
      extent: Math.ceil(subRing + subNode / 2 + GLOW_PAD),
    },
  };
}
