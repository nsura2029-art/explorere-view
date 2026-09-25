import { memo, useId, useMemo, useRef, type CSSProperties } from 'react';
import {
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type Transition,
} from 'framer-motion';
import { TONE_COLORS, type MainMenuItem, type SubMenuItem as SubItem } from '../data/menuData';
import { useDoubleTap } from '../hooks/useDoubleTap';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useRingSpin } from '../hooks/useRingSpin';
import { useExplorerStore } from '../store/useExplorerStore';
import type { MenuLayout } from '../utils/menuLayout';
import { distance, getBridgePath, getRadialPositions, type Point } from '../utils/radialGeometry';
import type { SubMenuPlacement } from '../utils/subMenuPlacement';
import { Icon } from './icons';
import { MenuConnectorRing } from './MenuConnectorRing';
import { SpinHubLabel } from './SpinHubLabel';

export type SubItemSelect = (sub: SubItem, index: number, center: Point) => void;

/** How the submenu ring settles after a spin (same feel as the main ring). */
const SETTLE: Transition = { type: 'spring', stiffness: 700, damping: 22, mass: 0.6 };
const PRESS_SPRING: Transition = { type: 'spring', stiffness: 620, damping: 26, mass: 0.6 };

// Opening: the bridge grows out of the main item, the submenu glides out along it and settles,
// then the sub items pop in one after another. Closing plays it back toward the item.
const BRIDGE_IN: Transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] };
const STAGE_IN: Transition = { type: 'spring', stiffness: 150, damping: 21, mass: 1, delay: 0.1 };
const STAGE_OUT: Transition = { duration: 0.26, ease: [0.4, 0, 1, 1] };
const ITEM_DELAY_S = 0.24;
const ITEM_STAGGER_S = 0.05;

type ItemProps = {
  item: SubItem;
  index: number;
  x: number;
  y: number;
  size: number;
  isActive: boolean;
  counterRotate: MotionValue<number>;
  reduceMotion: boolean;
  onKeyboardSelect: (index: number) => void;
};

function SubMenuItemBase({ item, index, x, y, size, isActive, counterRotate, reduceMotion, onKeyboardSelect }: ItemProps) {
  const delay = reduceMotion ? 0 : ITEM_DELAY_S + index * ITEM_STAGGER_S;
  return (
    <motion.button
      type="button"
      className={`orb orb--item orb--sub tone-${item.tone}${isActive ? ' is-active' : ''}`}
      data-role="sub-item"
      data-item-id={item.id}
      aria-label={item.label}
      aria-pressed={isActive}
      style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, rotate: counterRotate }}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 },
        shown: {
          opacity: 1,
          scale: 1,
          transition: reduceMotion ? { duration: 0.16 } : { delay, type: 'spring', stiffness: 380, damping: 20 },
        },
      }}
      whileTap={{ scale: 0.9 }}
      transition={PRESS_SPRING}
      // Keyboard activation only; pointer taps are recognized by the submenu.
      onClick={(e) => {
        if (e.detail === 0) onKeyboardSelect(index);
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

type SubRole = 'sub-item' | 'sub-hub' | 'sub-shell';

/**
 * Connected submenu grown from a main item: a scaled-down twin of the main menu. Rendered inside
 * the main menu anchor, positioned relative to the selected item. Tap a sub item to show its
 * image; double-tap one for rotate mode (drag to turn the ring, like the main menu).
 */
function SubRadialMenuBase({ mainItem, placement, layout, activeSubItemId, onSelect }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const isPresent = useIsPresent();
  const uid = useId().replace(/[:«»]/g, '');
  const subRingStep = useExplorerStore((s) => s.subRingStep);
  const subSpinMode = useExplorerStore((s) => s.subSpinMode);
  const { ringRadius, nodeSize, hubSize, extent } = layout.sub;
  const count = mainItem.subItems.length;
  const slotDeg = 360 / count;
  const stage = extent * 2;
  const { from } = placement;
  // Everything below is relative to the selected main item (the wrapper's origin).
  const hub = { x: placement.center.x - from.x, y: placement.center.y - from.y };
  const bridgeLen = distance({ x: 0, y: 0 }, hub);
  const bridgeDeg = (Math.atan2(hub.y, hub.x) * 180) / Math.PI;
  const stageCenter = useMemo(() => ({ x: extent, y: extent }), [extent]);
  const nodes = useMemo(
    () => getRadialPositions({ center: stageCenter, radius: ringRadius, itemCount: count, startAngle: placement.startAngle }),
    [stageCenter, ringRadius, count, placement.startAngle],
  );
  const tones = useMemo(() => mainItem.subItems.map((s) => s.tone), [mainItem]);
  // Bridge drawn along +x (then rotated into place) so it can grow outward from the item.
  const bridge = getBridgePath({ x: 0, y: 0 }, { x: bridgeLen, y: 0 }, layout.nodeSize / 2, 0.3, 0.45, hubSize / 2);

  // Ring rotation: the ring turns inside a rotor; items counter-rotate so labels stay upright.
  const ringAngle = useMotionValue(subRingStep * slotDeg);
  const counterAngle = useTransform(ringAngle, (a) => -a);
  const ringSpin = useRingSpin({
    angle: ringAngle,
    slotDeg,
    step: subRingStep,
    setStep: useExplorerStore.getState().setSubRingStep,
    reduceMotion,
    settle: SETTLE,
  });

  const latest = useRef({ placement, subRingStep, onSelect });
  latest.current = { placement, subRingStep, onSelect };

  /** Shows sub item `index`'s image; its position accounts for the current ring rotation. */
  const select = (index: number) => {
    const { placement: pl, subRingStep: step, onSelect: pick } = latest.current;
    const node = getRadialPositions({
      center: pl.center,
      radius: ringRadius,
      itemCount: count,
      startAngle: pl.startAngle + step * slotDeg,
    })[index];
    pick(mainItem.subItems[index], index, { x: node.x, y: node.y });
  };

  // --- gestures: one recognizer for the whole submenu ---
  const doubleTap = useDoubleTap();
  const press = useRef<{ role: SubRole; subId: string | null; spin: boolean } | null>(null);
  const hubRef = useRef<HTMLDivElement>(null);

  const handlers = usePointerDrag({
    onPress: ({ target, start }) => {
      const el = target.closest('[data-role]');
      const role = el?.getAttribute('data-role');
      // Presses on the hub or the gaps are swallowed too, so they never count as an outside tap.
      if (role !== 'sub-item' && role !== 'sub-hub' && role !== 'sub-shell') return false;
      const s = useExplorerStore.getState();
      s.markInteracted();
      const subId = el!.getAttribute('data-item-id');
      // Second tap on the same sub item soon after the first: toggle rotate mode.
      if (role === 'sub-item' && doubleTap.isSecondTap(subId, start)) {
        s.setSubSpinMode(!s.subSpinMode);
        press.current = { role, subId, spin: true };
        return;
      }
      press.current = { role, subId, spin: false };
    },
    onTap: ({ target, start }) => {
      const p = press.current;
      if (!p || p.spin) return; // the double tap already did its job
      const s = useExplorerStore.getState();
      if (p.role === 'sub-item' && p.subId) {
        const index = mainItem.subItems.findIndex((it) => it.id === p.subId);
        if (index < 0) return;
        const el = target.closest('[data-role="sub-item"]');
        if (el) {
          const r = el.getBoundingClientRect();
          s.addRipple(r.left + r.width / 2, r.top + r.height / 2, {
            size: nodeSize,
            color: TONE_COLORS[mainItem.subItems[index].tone].soft,
          });
        }
        // Single tap (confirmed after the double-tap window): leave rotate mode, show the image.
        doubleTap.deferSingle(p.subId, start, () => {
          useExplorerStore.getState().setSubSpinMode(false);
          select(index);
        });
      } else {
        doubleTap.clear();
        s.setSubSpinMode(false);
      }
    },
    onDragStart: ({ start }, delta) => {
      doubleTap.clear();
      if (!useExplorerStore.getState().subSpinMode || !hubRef.current) return;
      const r = hubRef.current.getBoundingClientRect();
      ringSpin.begin({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, start, {
        x: start.x + delta.x,
        y: start.y + delta.y,
      });
    },
    onDragMove: ({ start }, delta) => {
      if (useExplorerStore.getState().subSpinMode) ringSpin.move({ x: start.x + delta.x, y: start.y + delta.y });
    },
    onDragEnd: (_info, _delta, cancelled) => {
      if (useExplorerStore.getState().subSpinMode) ringSpin.end(cancelled);
    },
    onRelease: () => {
      press.current = null;
    },
  });

  const shellR = ringRadius + nodeSize / 2;
  return (
    <motion.div
      className={`submenu${subSpinMode ? ' is-spinning' : ''}`}
      data-role="sub-menu"
      style={{ left: from.x, top: from.y, pointerEvents: isPresent ? undefined : 'none' }}
      {...handlers}
    >
      <svg className="submenu__bridge" width="1" height="1" aria-hidden="true">
        <defs>
          <linearGradient id={`sb-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={bridgeLen} y2="0">
            <stop offset="0.15" stopColor={TONE_COLORS[mainItem.tone].core} stopOpacity="0.95" />
            <stop offset="0.5" stopColor="#b8c4ff" stopOpacity="0.55" />
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
        <g transform={`rotate(${bridgeDeg.toFixed(2)})`}>
          <motion.g
            style={{ originX: 0, originY: 0.5 }}
            initial={reduceMotion ? { opacity: 0 } : { scaleX: 0, opacity: 0.4 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { scaleX: 0, opacity: 0, transition: { ...STAGE_OUT, delay: 0.08 } }}
            transition={reduceMotion ? { duration: 0.16 } : BRIDGE_IN}
          >
            <path d={bridge} fill={`url(#sb-${uid})`} filter={`url(#sg-${uid})`} opacity="0.9" />
            <line className="submenu__flow" x1="0" y1="0" x2={bridgeLen} y2="0" />
          </motion.g>
        </g>
      </svg>

      <motion.div
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
        // Glide out along the bridge from the item, growing into place.
        initial={reduceMotion ? { opacity: 0 } : { x: -hub.x, y: -hub.y, scale: 0.25, opacity: 0 }}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        exit={
          reduceMotion
            ? { opacity: 0, transition: { duration: 0.16 } }
            : { x: -hub.x * 0.6, y: -hub.y * 0.6, scale: 0.3, opacity: 0, transition: STAGE_OUT }
        }
        transition={reduceMotion ? { duration: 0.16 } : STAGE_IN}
      >
        <div className="menu-halo menu-halo--sub" />
        {/* The ring turns inside this rotor; the hub stays still. */}
        <motion.div className="menu-layer menu-rotor" style={{ rotate: ringAngle }}>
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
          {mainItem.subItems.map((sub, i) => (
            <SubMenuItem
              key={sub.id}
              item={sub}
              index={i}
              x={nodes[i].x}
              y={nodes[i].y}
              size={nodeSize}
              isActive={activeSubItemId === sub.id}
              counterRotate={counterAngle}
              reduceMotion={reduceMotion}
              onKeyboardSelect={select}
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
        </motion.div>
        <div
          ref={hubRef}
          className="orb orb--hub orb--subhub"
          data-role="sub-hub"
          style={{ left: extent - hubSize / 2, top: extent - hubSize / 2, width: hubSize, height: hubSize }}
        >
          {subSpinMode ? (
            <SpinHubLabel hubSize={hubSize} />
          ) : (
            <>
              <span className="hub__label hub__label--sub">Sub Menu</span>
              <span className="hub__rule" />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export const SubRadialMenu = memo(SubRadialMenuBase);
