import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
} from 'framer-motion';
import { MAIN_MENU_ITEMS, TONE_COLORS, type SubMenuItem } from '../data/menuData';
import { useClockTicks } from '../hooks/useClockTicks';
import { useIdle } from '../hooks/useIdle';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useExplorerStore } from '../store/useExplorerStore';
import { attachedCardCenter, cardSize } from '../utils/cardPlacement';
import { clampMenuPosition, type Viewport } from '../utils/clampPosition';
import { EDGE_MARGIN, type MenuLayout } from '../utils/menuLayout';
import { getRadialPositions, type Point } from '../utils/radialGeometry';
import { SCENE_ASPECT } from '../utils/sceneImage';
import {
  angleDelta,
  angularVelocity,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP,
  spinSnapStep,
  type AngleSample,
} from '../utils/spinMath';
import { computeSubMenuPlacement } from '../utils/subMenuPlacement';
import { initialWander, safeBounds, wanderSpeed, wanderStep, type WanderState } from '../utils/wander';
import { MainMenuItem } from './MainMenuItem';
import { MenuConnectorRing } from './MenuConnectorRing';
import { SubRadialMenu } from './SubRadialMenu';

/** Delay before the menu materializes (spec: 300–500 ms). */
export const REVEAL_DELAY_S = 0.42;
/** Idle breathing period (spec: 2.8–3.6 s). */
const BREATH_S = 3.2;

/** "Attracted to touch" move: near-critically damped so it never overshoots into an edge. */
const MOVE_SPRING: Transition = { type: 'spring', stiffness: 260, damping: 30, mass: 1, restDelta: 0.5 };
const MOVE_REDUCED: Transition = { duration: 0.22, ease: 'easeOut' };

const REVEAL_FULL = {
  initial: { opacity: 0, scale: 0.82, y: 12, filter: 'blur(8px)' },
  animate: { opacity: 1, scale: [0.82, 1.04, 1], y: 0, filter: 'blur(0px)' },
  transition: {
    opacity: { delay: REVEAL_DELAY_S, duration: 0.55, ease: 'easeOut' },
    scale: { delay: REVEAL_DELAY_S, duration: 1.0, times: [0, 0.58, 1], ease: ['easeOut', 'easeInOut'] },
    y: { delay: REVEAL_DELAY_S, duration: 0.85, ease: [0.22, 1, 0.36, 1] },
    filter: { delay: REVEAL_DELAY_S, duration: 0.7, ease: 'easeOut' },
  } satisfies Record<string, Transition>,
};

const REVEAL_REDUCED = {
  initial: { opacity: 0, scale: 1, y: 6, filter: 'blur(0px)' },
  animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay: REVEAL_DELAY_S, duration: 0.25, ease: 'easeOut' } satisfies Transition,
};

/** One slot of the ring, in degrees. */
const SLOT_DEG = 360 / MAIN_MENU_ITEMS.length;
/** Seconds-hand snap: fast, with a small overshoot that settles. */
const TICK_SPRING: Transition = { type: 'spring', stiffness: 700, damping: 22, mass: 0.6 };

/** Ring angle (degrees) of main item 0, including the clock-tick rotation. */
export const ringStartAngle = (ringStep: number) => -90 + ringStep * SLOT_DEG;

/** Water ripple from the center of a tapped node. */
function rippleFrom(target: Element, selector: string, size: number, color: string) {
  const el = target.closest(selector);
  if (!el) return;
  const r = el.getBoundingClientRect();
  useExplorerStore.getState().addRipple(r.left + r.width / 2, r.top + r.height / 2, { size, color });
}

type Props = { layout: MenuLayout; viewport: Viewport };
type PressRole = 'main-item' | 'main-hub' | 'main-shell';

export function MainRadialMenu({ layout, viewport }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  // Parent only mounts this once a position exists.
  const menuPosition = useExplorerStore((s) => s.menuPosition)!;
  const moveSeq = useExplorerStore((s) => s.moveSeq);
  const motionPhase = useExplorerStore((s) => s.motionPhase);
  const interactionMode = useExplorerStore((s) => s.interactionMode);
  const activeMainItemId = useExplorerStore((s) => s.activeMainItemId);
  const subMenu = useExplorerStore((s) => s.subMenu);
  const activeSubItemId = useExplorerStore((s) => s.activeSubItemId);
  const setMotionPhase = useExplorerStore((s) => s.setMotionPhase);
  const ringStep = useExplorerStore((s) => s.ringStep);
  const spinMode = useExplorerStore((s) => s.spinMode);

  // Menu center lives in motion values so movement never re-renders the tree.
  const x = useMotionValue(menuPosition.x);
  const y = useMotionValue(menuPosition.y);
  const moveScale = useMotionValue(1);
  const moveToken = useRef(0);
  // Clock-tick rotation of the item ring; items counter-rotate so labels stay upright.
  const ringAngle = useMotionValue(ringStep * SLOT_DEG);
  const counterAngle = useTransform(ringAngle, (a) => -a);

  const latest = useRef({ layout, viewport, reduceMotion });
  latest.current = { layout, viewport, reduceMotion };

  // --- pre-interaction drift: in from the bottom-left, then roaming the window until the first touch ---
  const wander = useRef<WanderState | null>(null);
  const wanderBounds = () => {
    const { layout: l, viewport: vp } = latest.current;
    return safeBounds(vp.width, vp.height, l.extent + EDGE_MARGIN);
  };
  // Before first paint: start just off the bottom-left corner (the reveal fades it in from there).
  useLayoutEffect(() => {
    const s = useExplorerStore.getState();
    if (latest.current.reduceMotion || s.hasInteracted || s.motionPhase !== 'hidden') return;
    const vp = latest.current.viewport;
    wander.current = initialWander(wanderBounds(), latest.current.layout.extent, wanderSpeed(vp.width, vp.height));
    x.set(wander.current.pos.x);
    y.set(wander.current.pos.y);
    s.setMotionPhase('wandering');
  }, []);

  useAnimationFrame((_time, delta) => {
    const w = wander.current;
    if (!w || useExplorerStore.getState().motionPhase !== 'wandering') return;
    const vp = latest.current.viewport;
    // Cap the step so a background tab / hiccup never makes it jump.
    const next = wanderStep(w, Math.min(delta, 50) / 1000, wanderBounds(), wanderSpeed(vp.width, vp.height));
    wander.current = next;
    x.set(next.pos.x);
    y.set(next.pos.y);
  });

  // The first touch ends the drift: hand the menu's live position to the store (synchronously, so
  // a tap handled right after — relocate, submenu placement — starts from where the menu really is).
  useEffect(
    () =>
      useExplorerStore.subscribe((s, prev) => {
        if (prev.motionPhase !== 'wandering' || s.motionPhase === 'wandering') return;
        wander.current = null;
        const { layout: l, viewport: vp } = latest.current;
        const here = { x: x.get(), y: y.get() };
        const safe = clampMenuPosition({ desiredPosition: here, viewport: vp, menuRadius: l.extent, margin: EDGE_MARGIN });
        // Still partly off-screen (touched while coming in): glide fully into view.
        s.setMenuPosition(safe, safe.x === here.x && safe.y === here.y ? 'jump' : 'spring');
      }),
    [x, y],
  );

  const stopMove = useCallback(() => {
    moveToken.current++;
    x.stop();
    y.stop();
    moveScale.stop();
    moveScale.set(1);
  }, [x, y, moveScale]);

  // Apply every committed position: instant for drag/resize, attract spring for taps.
  useEffect(() => {
    const { menuPosition: p, moveKind, motionPhase: phase } = useExplorerStore.getState();
    if (!p) return;
    // While drifting, the drift owns the position (store placement/resizes are ignored).
    if (phase === 'wandering') return;
    if (moveKind === 'jump') {
      stopMove();
      x.set(p.x);
      y.set(p.y);
      return;
    }
    const token = ++moveToken.current;
    const reduced = latest.current.reduceMotion;
    setMotionPhase('moving');
    if (!reduced) animate(moveScale, 0.96, { duration: 0.12, ease: 'easeOut' });
    const t = reduced ? MOVE_REDUCED : MOVE_SPRING;
    Promise.all([animate(x, p.x, t), animate(y, p.y, t)]).then(() => {
      if (token !== moveToken.current) return;
      if (!reduced) animate(moveScale, [moveScale.get(), 1.03, 1], { duration: 0.36, times: [0, 0.4, 1], ease: 'easeOut' });
      if (useExplorerStore.getState().motionPhase === 'moving') setMotionPhase('idle');
    });
  }, [moveSeq, x, y, moveScale, stopMove, setMotionPhase]);

  // Transition for the next ring snap (a manual spin hands over its momentum); ticks by default.
  const ringTransition = useRef<Transition | null>(null);
  useEffect(() => {
    const t = ringTransition.current ?? TICK_SPRING;
    ringTransition.current = null;
    animate(ringAngle, ringStep * SLOT_DEG, latest.current.reduceMotion ? { duration: 0 } : t);
  }, [ringStep, ringAngle]);

  /** Settles the ring on `step` (animates even when the step number itself is unchanged). */
  const snapRing = useCallback(
    (step: number, transition: Transition) => {
      const s = useExplorerStore.getState();
      if (step === s.ringStep) {
        animate(ringAngle, step * SLOT_DEG, latest.current.reduceMotion ? { duration: 0 } : transition);
      } else {
        ringTransition.current = transition;
        s.setRingStep(step);
      }
    },
    [ringAngle],
  );

  // The clock ticking runs only after 15 s without any touch (and from load until the first touch),
  // and never with a submenu open, in rotate mode or under a finger, so submenus and image
  // tethers always line up with their item.
  const idle = useIdle();
  useEffect(() => {
    if (idle && useExplorerStore.getState().spinMode) useExplorerStore.getState().setSpinMode(false);
  }, [idle]);
  const ticking =
    idle &&
    !reduceMotion &&
    !spinMode &&
    (motionPhase === 'idle' || motionPhase === 'wandering') &&
    activeMainItemId === null &&
    interactionMode === 'idle';
  useClockTicks(ticking, useExplorerStore.getState().stepRing);

  const { extent, ringRadius, nodeSize, hubSize } = layout;
  const stage = extent * 2;
  const center = useMemo(() => ({ x: extent, y: extent }), [extent]);
  const nodes = useMemo(
    () => getRadialPositions({ center, radius: ringRadius, itemCount: MAIN_MENU_ITEMS.length, startAngle: -90 }),
    [center, ringRadius],
  );
  const tones = useMemo(() => MAIN_MENU_ITEMS.map((m) => m.tone), []);

  const toggleItem = useCallback((itemId: string) => {
    const s = useExplorerStore.getState();
    if (s.activeMainItemId === itemId) {
      s.closeSubMenu();
      return;
    }
    const pos = s.menuPosition;
    const itemIndex = MAIN_MENU_ITEMS.findIndex((m) => m.id === itemId);
    if (!pos || itemIndex < 0) return;
    const { layout: l, viewport: vp } = latest.current;
    const placement = computeSubMenuPlacement({
      itemIndex,
      itemCount: MAIN_MENU_ITEMS.length,
      subCount: MAIN_MENU_ITEMS[itemIndex].subItems.length,
      layout: l,
      menuCenter: pos,
      viewport: vp,
      margin: EDGE_MARGIN,
      startAngle: ringStartAngle(s.ringStep),
    });
    s.openSubMenu(itemId, placement);
    if (placement.shift.x !== 0 || placement.shift.y !== 0) {
      // Not enough room: glide the menu just far enough for the submenu to fit (spec 4.8).
      s.setMenuPosition(
        clampMenuPosition({
          desiredPosition: { x: pos.x + placement.shift.x, y: pos.y + placement.shift.y },
          viewport: vp,
          menuRadius: l.extent,
          margin: EDGE_MARGIN,
        }),
        'spring',
      );
    }
  }, []);

  const onSubSelect = useCallback((sub: SubMenuItem, index: number, rel: Point) => {
    const s = useExplorerStore.getState();
    const main = MAIN_MENU_ITEMS.find((m) => m.id === s.activeMainItemId);
    if (!s.menuPosition || !s.subMenu || !main) return;
    const { layout: l, viewport: vp } = latest.current;
    const itemCenter = { x: s.menuPosition.x + rel.x, y: s.menuPosition.y + rel.y };
    const hubCenter = { x: s.menuPosition.x + s.subMenu.center.x, y: s.menuPosition.y + s.subMenu.center.y };
    const len = Math.hypot(itemCenter.x - hubCenter.x, itemCenter.y - hubCenter.y) || 1;
    const dir = { x: (itemCenter.x - hubCenter.x) / len, y: (itemCenter.y - hubCenter.y) / len };
    const r = l.sub.nodeSize / 2;
    const { width, height } = cardSize(vp, SCENE_ASPECT);
    // Keep the card off both menus when the preferred spot is pushed back by a screen edge.
    const c = attachedCardCenter(itemCenter, dir, r, width, height, vp, [
      { ...s.menuPosition, r: l.ringRadius + l.nodeSize / 2 },
      { ...hubCenter, r: l.sub.ringRadius + r },
    ]);
    s.toggleImage({
      mainItemId: main.id,
      subItemId: sub.id,
      title: `${main.label} · ${sub.label}`,
      seed: MAIN_MENU_ITEMS.indexOf(main) * main.subItems.length + index,
      x: c.x,
      y: c.y,
      width,
      height,
      tether: { x: itemCenter.x + dir.x * r, y: itemCenter.y + dir.y * r },
    });
  }, []);

  // --- gestures ---
  // Tap an item: open its submenu (after a short wait, in case a second tap follows).
  // Double-tap an item: rotate mode, where dragging turns the ring instead of moving the menu.
  // Drag an item / the hub / the ring: move the menu (or turn the ring in rotate mode).
  const press = useRef<{ role: PressRole; itemId: string | null; spin: boolean } | null>(null);
  const dragOrigin = useRef<Point>({ x: 0, y: 0 });
  const pendingTap = useRef<{ itemId: string; at: number; pos: Point; timer: number } | null>(null);
  const spin = useRef<{ last: number; samples: AngleSample[] }>({ last: 0, samples: [] });

  const clearPendingTap = () => {
    if (pendingTap.current) window.clearTimeout(pendingTap.current.timer);
    pendingTap.current = null;
  };
  useEffect(() => clearPendingTap, []);

  /** Pointer angle around the menu center, degrees (screen space, clockwise positive). */
  const pointerAngle = (p: Point) => (Math.atan2(p.y - y.get(), p.x - x.get()) * 180) / Math.PI;

  const handlers = usePointerDrag({
    onPress: ({ target, start }) => {
      const el = target.closest('[data-role]');
      const role = el?.getAttribute('data-role');
      if (role !== 'main-item' && role !== 'main-hub' && role !== 'main-shell') return false;
      const itemId = el!.getAttribute('data-item-id');
      const s = useExplorerStore.getState();
      s.markInteracted();
      s.setInteractionMode('pressing');

      // Second tap on the same item soon after the first: toggle rotate mode.
      const pend = pendingTap.current;
      const isDouble =
        role === 'main-item' &&
        !!pend &&
        pend.itemId === itemId &&
        performance.now() - pend.at <= DOUBLE_TAP_MS &&
        Math.hypot(start.x - pend.pos.x, start.y - pend.pos.y) <= DOUBLE_TAP_SLOP;
      if (isDouble) {
        clearPendingTap();
        const on = !s.spinMode;
        s.setSpinMode(on);
        if (on) s.closeSubMenu();
        press.current = { role, itemId, spin: true };
        return;
      }
      press.current = { role, itemId, spin: false };
    },
    onTap: ({ target, start }) => {
      const p = press.current;
      if (!p || p.spin) return; // the double tap already did its job
      const s = useExplorerStore.getState();
      if (p.role === 'main-item' && p.itemId) {
        const item = MAIN_MENU_ITEMS.find((m) => m.id === p.itemId);
        if (item) rippleFrom(target, '[data-role="main-item"]', latest.current.layout.nodeSize, TONE_COLORS[item.tone].soft);
        clearPendingTap();
        const itemId = p.itemId;
        pendingTap.current = {
          itemId,
          at: performance.now(),
          pos: start,
          timer: window.setTimeout(() => {
            pendingTap.current = null;
            useExplorerStore.getState().setSpinMode(false);
            toggleItem(itemId);
          }, DOUBLE_TAP_MS),
        };
      } else {
        clearPendingTap();
        s.setSpinMode(false);
        s.closeSubMenu();
      }
    },
    onDragStart: ({ start }, delta) => {
      const s = useExplorerStore.getState();
      clearPendingTap();
      if (s.spinMode) {
        // Rotate mode: the finger turns the ring around the menu center.
        ringAngle.stop();
        const from = pointerAngle(start);
        const now = pointerAngle({ x: start.x + delta.x, y: start.y + delta.y });
        const next = ringAngle.get() + angleDelta(from, now);
        ringAngle.set(next);
        spin.current = { last: now, samples: [{ t: performance.now(), a: next }] };
        s.setInteractionMode('dragging');
        return;
      }
      stopMove();
      s.closeSubMenu();
      s.setInteractionMode('dragging');
      s.setMotionPhase('idle');
      // The menu follows the finger 1:1 from where it was when the press began.
      dragOrigin.current = { x: x.get(), y: y.get() };
    },
    onDragMove: ({ start }, delta) => {
      if (useExplorerStore.getState().spinMode) {
        const p = { x: start.x + delta.x, y: start.y + delta.y };
        // Near the center the angle is unstable; ignore those moves.
        if (Math.hypot(p.x - x.get(), p.y - y.get()) < 24) return;
        const a = pointerAngle(p);
        const next = ringAngle.get() + angleDelta(spin.current.last, a);
        spin.current.last = a;
        ringAngle.set(next);
        const samples = spin.current.samples;
        samples.push({ t: performance.now(), a: next });
        if (samples.length > 24) samples.shift();
        return;
      }
      const { layout: l, viewport: vp } = latest.current;
      const p = clampMenuPosition({
        desiredPosition: { x: dragOrigin.current.x + delta.x, y: dragOrigin.current.y + delta.y },
        viewport: vp,
        menuRadius: l.extent,
        margin: EDGE_MARGIN,
      });
      x.set(p.x);
      y.set(p.y);
    },
    onDragEnd: (_info, _delta, cancelled) => {
      if (useExplorerStore.getState().spinMode) {
        // Keep the flick's momentum, then settle on the nearest item slot.
        const w = cancelled ? 0 : angularVelocity(spin.current.samples);
        const step = spinSnapStep(ringAngle.get(), w, SLOT_DEG);
        snapRing(step, { type: 'spring', stiffness: 140, damping: 20, velocity: w * 1000 });
        return;
      }
      useExplorerStore.getState().setMenuPosition({ x: x.get(), y: y.get() }, 'jump');
    },
    // Tap, drag end, pointercancel or lost capture: never leave a stale press behind (RT-11).
    onRelease: () => {
      press.current = null;
      useExplorerStore.getState().setInteractionMode('idle');
    },
  });

  const reveal = reduceMotion ? REVEAL_REDUCED : REVEAL_FULL;
  const breathing = motionPhase === 'idle' && interactionMode !== 'dragging' && !reduceMotion;
  const breathTransition: Transition = breathing
    ? { duration: BREATH_S, ease: 'easeInOut', repeat: Infinity }
    : { duration: 0.3, ease: 'easeOut' };
  const shellR = ringRadius + nodeSize / 2;
  const activeItem = MAIN_MENU_ITEMS.find((m) => m.id === activeMainItemId);

  return (
    <motion.div
      className={`menu-anchor${interactionMode === 'dragging' ? ' is-dragging' : ''}${spinMode ? ' is-spinning' : ''}`}
      style={{ x, y }}
      data-role="main-menu"
      {...handlers}
    >
      <AnimatePresence>
        {activeItem && subMenu && (
          <SubRadialMenu
            key={activeItem.id}
            mainItem={activeItem}
            placement={subMenu}
            layout={layout}
            activeSubItemId={activeSubItemId}
            onSelect={onSubSelect}
          />
        )}
      </AnimatePresence>

      <div
        className="menu-stage"
        style={
          {
            width: stage,
            height: stage,
            left: -extent,
            top: -extent,
            '--node': `${nodeSize}px`,
            '--hub': `${hubSize}px`,
          } as CSSProperties
        }
      >
        {/* Layer 1: one-shot materialize */}
        <motion.div
          className="menu-layer"
          initial={reveal.initial}
          animate={reveal.animate}
          transition={reveal.transition}
          onAnimationStart={() => {
            if (useExplorerStore.getState().motionPhase === 'hidden') setMotionPhase('revealing');
          }}
          onAnimationComplete={() => {
            const s = useExplorerStore.getState();
            if (s.motionPhase !== 'revealing') return;
            setMotionPhase('idle');
          }}
        >
          {/* Layer 2: touch-move compress / arrival pop */}
          <motion.div className="menu-layer" style={{ scale: moveScale }}>
            {/* Layer 3: idle breathing (stops cleanly whenever phase leaves 'idle') */}
            <motion.div
              className="menu-layer"
              animate={breathing ? { scale: [1, 1.015, 1] } : { scale: 1 }}
              transition={breathTransition}
            >
              <motion.div
                className="menu-halo"
                animate={breathing ? { opacity: [0.55, 0.95, 0.55] } : { opacity: 0.7 }}
                transition={breathTransition}
              />
              {/* Layer 4: the item ring ticks round like a seconds hand; the hub stays still. */}
              <motion.div className="menu-layer menu-rotor" style={{ rotate: ringAngle }}>
                <div
                  className="menu-shell"
                  data-role="main-shell"
                  style={{ left: center.x - shellR, top: center.y - shellR, width: shellR * 2, height: shellR * 2 }}
                />
                <MenuConnectorRing
                  layer="under"
                  size={stage}
                  center={center}
                  nodes={nodes}
                  tones={tones}
                  nodeSize={nodeSize}
                  hubSize={hubSize}
                  ringRadius={ringRadius}
                />
                {MAIN_MENU_ITEMS.map((item, i) => (
                  <MainMenuItem
                    key={item.id}
                    item={item}
                    x={nodes[i].x}
                    y={nodes[i].y}
                    size={nodeSize}
                    isActive={activeMainItemId === item.id}
                    counterRotate={counterAngle}
                    onKeyboardActivate={toggleItem}
                  />
                ))}
                <MenuConnectorRing
                  layer="over"
                  size={stage}
                  center={center}
                  nodes={nodes}
                  tones={tones}
                  nodeSize={nodeSize}
                  hubSize={hubSize}
                  ringRadius={ringRadius}
                />
              </motion.div>

              <motion.div
                className="orb orb--hub"
                data-role="main-hub"
                style={{ left: center.x - hubSize / 2, top: center.y - hubSize / 2, width: hubSize, height: hubSize }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              >
                {spinMode ? (
                  <>
                    <svg
                      className="hub__spin-icon"
                      width={Math.round(hubSize * 0.2)}
                      height={Math.round(hubSize * 0.2)}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="hub__label hub__label--spin">ROTATE</span>
                    <span className="hub__hint">drag to turn</span>
                  </>
                ) : (
                  <>
                    <span className="hub__label">MENU</span>
                    <span className="hub__rule" />
                  </>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
