import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { useAttractDemo } from '../hooks/useAttractDemo';
import { useClockTicks } from '../hooks/useClockTicks';
import { useDoubleTap } from '../hooks/useDoubleTap';
import { useIdle } from '../hooks/useIdle';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useRingSpin } from '../hooks/useRingSpin';
import { useExplorerStore } from '../store/useExplorerStore';
import {
  attachedCardCenter,
  cardSize,
  fitMenusInRegion,
  MAX_CARD_SHARE,
  menuSplitRegion,
} from '../utils/cardPlacement';
import { clampMenuPosition, type Viewport } from '../utils/clampPosition';
import { EDGE_MARGIN, type MenuLayout } from '../utils/menuLayout';
import {
  DEMO_BACK_MS,
  DEMO_OUT_MS,
  DEMO_SCALE,
  demoDistance,
  outwardOffset,
  pickDemoItem,
} from '../utils/attractDemo';
import { getRadialPositions, type Point } from '../utils/radialGeometry';
import { SCENE_ASPECT } from '../utils/sceneImage';
import { computeSubMenuPlacement } from '../utils/subMenuPlacement';
import { initialWander, safeBounds, wanderSpeed, wanderStep, type WanderState } from '../utils/wander';
import { MainMenuItem, type ItemPulse } from './MainMenuItem';
import { MenuConnectorRing } from './MenuConnectorRing';
import { SpinHubLabel } from './SpinHubLabel';
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
  // Split view: an image is zoomed in, or earlier images wait in the tray.
  const docked = useExplorerStore((s) => s.focusCardId !== null || s.images.some((c) => c.shelved));

  // Menu center lives in motion values so movement never re-renders the tree.
  const x = useMotionValue(menuPosition.x);
  const y = useMotionValue(menuPosition.y);
  const moveScale = useMotionValue(1);
  // Split view: the whole menu (main + submenu) shrinks to fit the left half.
  const compactScale = useMotionValue(1);
  const moveToken = useRef(0);
  // Clock-tick rotation of the item ring; items counter-rotate so labels stay upright.
  const ringAngle = useMotionValue(ringStep * SLOT_DEG);
  const counterAngle = useTransform(ringAngle, (a) => -a);

  const latest = useRef({ layout, viewport, reduceMotion });
  latest.current = { layout, viewport, reduceMotion };

  // --- pre-interaction drift: in from the bottom-left, then roaming the window until the first touch ---
  const wander = useRef<WanderState | null>(null);
  // The idle demo holds the drift still while it shows a submenu.
  const driftPaused = useRef(false);
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
    if (!w || driftPaused.current || useExplorerStore.getState().motionPhase !== 'wandering') return;
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

  // Clock ticks and manual spins both settle the ring through `ringStep`.
  const ringSpin = useRingSpin({
    angle: ringAngle,
    slotDeg: SLOT_DEG,
    step: ringStep,
    setStep: useExplorerStore.getState().setRingStep,
    reduceMotion,
    settle: TICK_SPRING,
  });

  // Split view (a zoomed image owns the right half): dock the menus in the left half, scaled to fit
  // the main menu plus any open submenu. Undocking restores full size where the menu is.
  useEffect(() => {
    const s = useExplorerStore.getState();
    const { layout: l, viewport: vp, reduceMotion: rm } = latest.current;
    const t = rm ? MOVE_REDUCED : MOVE_SPRING;
    if (docked) {
      // Don't yank the menu away from a finger that is dragging it.
      if (s.interactionMode === 'dragging') return;
      const box = { minX: -l.extent, minY: -l.extent, maxX: l.extent, maxY: l.extent };
      if (subMenu) {
        const e = l.sub.extent;
        box.minX = Math.min(box.minX, subMenu.center.x - e);
        box.minY = Math.min(box.minY, subMenu.center.y - e);
        box.maxX = Math.max(box.maxX, subMenu.center.x + e);
        box.maxY = Math.max(box.maxY, subMenu.center.y + e);
      }
      const fit = fitMenusInRegion(box, menuSplitRegion(vp, EDGE_MARGIN));
      animate(compactScale, fit.scale, t);
      s.setMenuScale(fit.scale);
      s.setMenuPosition(fit.center, 'spring');
    } else if (s.menuScale !== 1 || compactScale.get() !== 1) {
      animate(compactScale, 1, t);
      s.setMenuScale(1);
      if (s.menuPosition) {
        s.setMenuPosition(
          clampMenuPosition({ desiredPosition: s.menuPosition, viewport: vp, menuRadius: l.extent, margin: EDGE_MARGIN }),
          'spring',
        );
      }
    }
  }, [docked, subMenu, viewport, layout, compactScale]);

  // The clock ticking runs only after 15 s without any touch (and from load until the first touch),
  // and never with a submenu open, in rotate mode or under a finger, so submenus and image
  // tethers always line up with their item.
  const idle = useIdle();
  useEffect(() => {
    if (!idle) return;
    const s = useExplorerStore.getState();
    s.setSpinMode(false);
    s.setSubSpinMode(false);
  }, [idle]);
  // Idle demo: which item is pulsing (outward + 2×) right now, if any.
  const [pulse, setPulse] = useState<ItemPulse | null>(null);
  const ticking =
    idle &&
    pulse === null &&
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

  /** Opens `itemId`'s submenu (placing it, and nudging the menu if it would not fit). */
  const openItem = useCallback((itemId: string) => {
    const s = useExplorerStore.getState();
    // While the intro drift runs, the store position is stale: use where the menu really is.
    const drifting = s.motionPhase === 'wandering';
    const pos = drifting ? { x: x.get(), y: y.get() } : s.menuPosition;
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
    // Docked in split view, the dock refits both menus instead of shifting.
    if (s.focusCardId === null && (placement.shift.x !== 0 || placement.shift.y !== 0)) {
      // Not enough room: glide the menu just far enough for the submenu to fit (spec 4.8).
      const target = clampMenuPosition({
        desiredPosition: { x: pos.x + placement.shift.x, y: pos.y + placement.shift.y },
        viewport: vp,
        menuRadius: l.extent,
        margin: EDGE_MARGIN,
      });
      if (drifting) {
        animate(x, target.x, MOVE_SPRING);
        animate(y, target.y, MOVE_SPRING);
      } else s.setMenuPosition(target, 'spring');
    }
  }, [x, y]);

  const toggleItem = useCallback(
    (itemId: string) => {
      const s = useExplorerStore.getState();
      if (s.activeMainItemId === itemId) s.closeSubMenu();
      else openItem(itemId);
    },
    [openItem],
  );

  // --- idle attract demo: pulse a random item out and back, then preview its submenu ---
  const pulseWaiter = useRef<{ id: string; out: boolean; resolve: () => void } | null>(null);
  const onPulseSettled = useCallback((id: string, out: boolean) => {
    const w = pulseWaiter.current;
    if (w && w.id === id && w.out === out) {
      pulseWaiter.current = null;
      w.resolve();
    }
  }, []);
  /** Resolves when the item reports the animation finished (or after `fallbackMs`, whichever first). */
  const waitPulse = (id: string, out: boolean, fallbackMs: number) =>
    new Promise<void>((resolve) => {
      const t = window.setTimeout(() => {
        if (pulseWaiter.current?.resolve === done) pulseWaiter.current = null;
        resolve();
      }, fallbackMs);
      const done = () => {
        window.clearTimeout(t);
        resolve();
      };
      pulseWaiter.current = { id, out, resolve: done };
    });
  /** Drift picks up again from wherever the menu is now. */
  const resumeDrift = () => {
    if (!driftPaused.current) return;
    driftPaused.current = false;
    if (wander.current) wander.current = { ...wander.current, pos: { x: x.get(), y: y.get() }, vel: { x: 0, y: 0 } };
  };

  useAttractDemo(!reduceMotion, {
    pick: (exclude) => {
      const s = useExplorerStore.getState();
      const { layout: l, viewport: vp } = latest.current;
      const k = s.menuScale;
      const c = { x: x.get(), y: y.get() };
      const reach = (l.ringRadius + demoDistance(l.nodeSize)) * k;
      const radius = (l.nodeSize / 2) * DEMO_SCALE * k + 12;
      // Prefer items whose enlarged pulse stays fully on screen.
      const fits = (id: string) => {
        const i = MAIN_MENU_ITEMS.findIndex((m) => m.id === id);
        const a = (ringStartAngle(s.ringStep) + i * SLOT_DEG) * (Math.PI / 180);
        const px = c.x + Math.cos(a) * reach;
        const py = c.y + Math.sin(a) * reach;
        return px - radius >= 0 && py - radius >= 0 && px + radius <= vp.width && py + radius <= vp.height;
      };
      return pickDemoItem(
        MAIN_MENU_ITEMS.map((m) => m.id),
        exclude,
        fits,
      );
    },
    pulseOut: (id) => {
      const s = useExplorerStore.getState();
      s.setSpinMode(false);
      s.setSubSpinMode(false);
      const { layout: l } = latest.current;
      const i = MAIN_MENU_ITEMS.findIndex((m) => m.id === id);
      // Straight away from the menu center (in the ring's own coordinates, so it stays radial
      // however far the ring has ticked round).
      const off = outwardOffset(nodes[i], center, demoDistance(l.nodeSize));
      // Silent: sound is reserved for the user's own taps.
      setPulse({ id, dx: off.x, dy: off.y, out: true });
      return waitPulse(id, true, DEMO_OUT_MS + 700);
    },
    pulseBack: (id) => {
      setPulse((p) => (p && p.id === id ? { ...p, out: false } : p));
      return waitPulse(id, false, DEMO_BACK_MS + 700).then(() => setPulse(null));
    },
    openSubmenu: (id) => {
      if (useExplorerStore.getState().motionPhase === 'wandering') driftPaused.current = true;
      openItem(id);
    },
    closeSubmenu: () => {
      useExplorerStore.getState().closeSubMenu();
      resumeDrift();
    },
    abort: () => {
      pulseWaiter.current = null;
      setPulse(null);
      resumeDrift();
    },
  });

  const onSubSelect = useCallback((sub: SubMenuItem, index: number, rel: Point) => {
    const s = useExplorerStore.getState();
    const main = MAIN_MENU_ITEMS.find((m) => m.id === s.activeMainItemId);
    if (!s.menuPosition || !s.subMenu || !main) return;
    const { layout: l, viewport: vp } = latest.current;
    // Offsets are at full size; the menu may be scaled down (split view).
    const k = s.menuScale;
    const itemCenter = { x: s.menuPosition.x + rel.x * k, y: s.menuPosition.y + rel.y * k };
    const hubCenter = { x: s.menuPosition.x + s.subMenu.center.x * k, y: s.menuPosition.y + s.subMenu.center.y * k };
    const len = Math.hypot(itemCenter.x - hubCenter.x, itemCenter.y - hubCenter.y) || 1;
    const dir = { x: (itemCenter.x - hubCenter.x) / len, y: (itemCenter.y - hubCenter.y) / len };
    const r = (l.sub.nodeSize / 2) * k;
    const { width, height } = cardSize(vp, SCENE_ASPECT);
    // Keep the card off both menus (and the corner "Open screens" button) when the preferred
    // spot is pushed back by a screen edge.
    const obstacles = [
      { ...s.menuPosition, r: (l.ringRadius + l.nodeSize / 2) * k },
      { ...hubCenter, r: l.sub.ringRadius * k + r },
    ];
    // The top-right controls (mute, "Open screens"): one circle each.
    for (const el of document.querySelectorAll('.screens__row > *')) {
      const b = el.getBoundingClientRect();
      obstacles.push({ x: b.left + b.width / 2, y: b.top + b.height / 2, r: Math.max(b.width, b.height) / 2 + 8 });
    }
    const c = attachedCardCenter(itemCenter, dir, r, width, height, vp, obstacles);
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
  const doubleTap = useDoubleTap();

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
      if (role === 'main-item' && doubleTap.isSecondTap(itemId, start)) {
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
        const itemId = p.itemId;
        doubleTap.deferSingle(itemId, start, () => {
          useExplorerStore.getState().setSpinMode(false);
          toggleItem(itemId);
        });
      } else {
        doubleTap.clear();
        s.setSpinMode(false);
        s.closeSubMenu();
      }
    },
    onDragStart: ({ start }, delta) => {
      const s = useExplorerStore.getState();
      doubleTap.clear();
      if (s.spinMode) {
        // Rotate mode: the finger turns the ring around the menu center.
        ringSpin.begin({ x: x.get(), y: y.get() }, start, { x: start.x + delta.x, y: start.y + delta.y });
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
        ringSpin.move({ x: start.x + delta.x, y: start.y + delta.y });
        return;
      }
      const { layout: l, viewport: vp } = latest.current;
      const s = useExplorerStore.getState();
      // Docked in split view, the menu stays in the left half.
      const area = s.focusCardId === null ? vp : { width: vp.width * (1 - MAX_CARD_SHARE), height: vp.height };
      const p = clampMenuPosition({
        desiredPosition: { x: dragOrigin.current.x + delta.x, y: dragOrigin.current.y + delta.y },
        viewport: area,
        menuRadius: l.extent * s.menuScale,
        margin: EDGE_MARGIN,
      });
      x.set(p.x);
      y.set(p.y);
    },
    onDragEnd: (_info, _delta, cancelled) => {
      if (useExplorerStore.getState().spinMode) {
        ringSpin.end(cancelled);
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
      style={{ x, y, scale: compactScale }}
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
                    pulse={pulse?.id === item.id ? pulse : null}
                    onPulseSettled={onPulseSettled}
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
                  <SpinHubLabel hubSize={hubSize} />
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
