import { memo, useId, useMemo, type CSSProperties } from 'react';
import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { TONE_COLORS, type MainMenuItem, type SubMenuItem as SubItem } from '../data/menuData';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useExplorerStore } from '../store/useExplorerStore';
import type { MenuLayout } from '../utils/menuLayout';
import { getBridgePath, getRadialPositions, type Point } from '../utils/radialGeometry';
import type { SubMenuPlacement } from '../utils/subMenuPlacement';
import { Icon } from './icons';
import { MenuConnectorRing } from './MenuConnectorRing';

export type SubItemSelect = (sub: SubItem, index: number, center: Point) => void;

type ItemProps = {
  item: SubItem;
  index: number;
  x: number;
  y: number;
  size: number;
  isActive: boolean;
  /** Position relative to the main menu center, reported on tap. */
  menuRel: Point;
  onSelect: SubItemSelect;
};

function SubMenuItemBase({ item, index, x, y, size, isActive, menuRel, onSelect }: ItemProps) {
  const handlers = usePointerDrag({
    onPress: () => {
      useExplorerStore.getState().markInteracted();
    },
    onTap: ({ target }) => {
      const el = target.closest('[data-role="sub-item"]');
      if (el) {
        const r = el.getBoundingClientRect();
        useExplorerStore
          .getState()
          .addRipple(r.left + r.width / 2, r.top + r.height / 2, { size, color: TONE_COLORS[item.tone].soft });
      }
      onSelect(item, index, menuRel);
    },
  });
  return (
    <motion.button
      type="button"
      className={`orb orb--item orb--sub tone-${item.tone}${isActive ? ' is-active' : ''}`}
      data-role="sub-item"
      data-item-id={item.id}
      aria-label={item.label}
      aria-pressed={isActive}
      style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26, mass: 0.6 }}
      {...handlers}
      // Keyboard activation only; pointer taps go through the recognizer above.
      onClick={(e) => {
        if (e.detail === 0) onSelect(item, index, menuRel);
      }}
    >
      <span className="orb__icon">
        <Icon name={item.icon} size={Math.round(size * 0.28)} />
      </span>
      <span className="orb__label">{item.label}</span>
    </motion.button>
  );
}

const SubMenuItem = memo(SubMenuItemBase);

type Props = {
  mainItem: MainMenuItem;
  placement: SubMenuPlacement;
  layout: MenuLayout;
  activeSubItemId: string | null;
  onSelect: SubItemSelect;
};

/**
 * Connected submenu grown from a main item. Rendered inside the main menu anchor, positioned
 * relative to the selected item so it scales out of it.
 */
function SubRadialMenuBase({ mainItem, placement, layout, activeSubItemId, onSelect }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const isPresent = useIsPresent();
  const uid = useId().replace(/[:«»]/g, '');
  const { ringRadius, nodeSize, hubSize, extent } = layout.sub;
  const stage = extent * 2;
  const { from } = placement;
  // Everything below is relative to the selected main item (the wrapper's origin).
  const hub = { x: placement.center.x - from.x, y: placement.center.y - from.y };
  const stageCenter = useMemo(() => ({ x: extent, y: extent }), [extent]);
  const nodes = useMemo(
    () =>
      getRadialPositions({
        center: stageCenter,
        radius: ringRadius,
        itemCount: mainItem.subItems.length,
        startAngle: placement.startAngle,
      }),
    [stageCenter, ringRadius, mainItem.subItems.length, placement.startAngle],
  );
  const tones = useMemo(() => mainItem.subItems.map((s) => s.tone), [mainItem]);
  const bridge = getBridgePath({ x: 0, y: 0 }, hub, layout.nodeSize / 2, 0.3, 0.45, hubSize / 2);

  // Presses on the submenu's hub or gaps are swallowed so they never count as an outside tap.
  const shellHandlers = usePointerDrag({
    onPress: ({ target }) => {
      const role = target.closest('[data-role]')?.getAttribute('data-role');
      if (role !== 'sub-hub' && role !== 'sub-shell') return false;
      useExplorerStore.getState().markInteracted();
    },
  });

  const motionProps = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.16 },
      }
    : {
        initial: { opacity: 0, scale: 0.85, rotate: -8 },
        animate: { opacity: 1, scale: 1, rotate: 0 },
        exit: { opacity: 0, scale: 0.9, rotate: -4 },
        transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const },
      };

  const shellR = ringRadius + nodeSize / 2;
  return (
    <motion.div
      className="submenu"
      data-role="sub-menu"
      style={{ left: from.x, top: from.y, pointerEvents: isPresent ? undefined : 'none' }}
      {...motionProps}
      {...shellHandlers}
    >
      <svg className="submenu__bridge" width="1" height="1" aria-hidden="true">
        <defs>
          <linearGradient id={`sb-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={hub.x} y2={hub.y}>
            <stop offset="0.2" stopColor={TONE_COLORS[mainItem.tone].core} stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#b8c4ff" stopOpacity="0.55" />
            <stop offset="0.85" stopColor="#7e8dff" stopOpacity="0.95" />
          </linearGradient>
          <filter id={`sg-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={bridge} fill={`url(#sb-${uid})`} filter={`url(#sg-${uid})`} opacity="0.9" />
        <line className="submenu__flow" x1="0" y1="0" x2={hub.x} y2={hub.y} />
      </svg>

      <div
        className="menu-stage submenu__stage"
        style={
          {
            width: stage,
            height: stage,
            left: hub.x - extent,
            top: hub.y - extent,
            '--node': `${nodeSize}px`,
            '--hub': `${hubSize}px`,
          } as CSSProperties
        }
      >
        <div className="menu-halo menu-halo--sub" />
        <div
          className="menu-shell"
          data-role="sub-shell"
          style={{ left: extent - shellR, top: extent - shellR, width: shellR * 2, height: shellR * 2 }}
        />
        <MenuConnectorRing
          layer="under"
          size={stage}
          center={stageCenter}
          nodes={nodes}
          tones={tones}
          nodeSize={nodeSize}
          hubSize={hubSize}
          ringRadius={ringRadius}
        />
        <div
          className="orb orb--hub orb--subhub"
          data-role="sub-hub"
          style={{ left: extent - hubSize / 2, top: extent - hubSize / 2, width: hubSize, height: hubSize }}
        >
          <span className="hub__label hub__label--sub">Sub Menu</span>
          <span className="hub__rule" />
        </div>
        {mainItem.subItems.map((sub, i) => (
          <SubMenuItem
            key={sub.id}
            item={sub}
            index={i}
            x={nodes[i].x}
            y={nodes[i].y}
            size={nodeSize}
            isActive={activeSubItemId === sub.id}
            menuRel={{ x: placement.center.x + nodes[i].x - extent, y: placement.center.y + nodes[i].y - extent }}
            onSelect={onSelect}
          />
        ))}
        <MenuConnectorRing
          layer="over"
          size={stage}
          center={stageCenter}
          nodes={nodes}
          tones={tones}
          nodeSize={nodeSize}
          hubSize={hubSize}
          ringRadius={ringRadius}
        />
      </div>
    </motion.div>
  );
}

export const SubRadialMenu = memo(SubRadialMenuBase);
