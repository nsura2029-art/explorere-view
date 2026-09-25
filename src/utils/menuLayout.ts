import { clamp, type Viewport } from './clampPosition';

export const EDGE_MARGIN = 20;
const GLOW_PAD = 14;
/**
 * The submenu is the main menu scaled down: same proportions (hub, items and the gap between
 * them), just noticeably — not dramatically — smaller.
 */
export const SUB_SCALE = 0.84;
/** Smallest submenu node, so sub items stay comfortable touch targets on small screens. */
const MIN_SUB_NODE = 64;

/** Radius of a menu's outer decorative circle (the outline drawn around its items). */
export const outerOrbitRadius = (ringRadius: number, nodeSize: number) => ringRadius + (nodeSize / 2) * 1.18;

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

  const subRing = Math.round(ringRadius * SUB_SCALE);
  const subNode = Math.max(MIN_SUB_NODE, Math.round(nodeSize * SUB_SCALE));
  const subHub = Math.round(hubSize * SUB_SCALE);
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
