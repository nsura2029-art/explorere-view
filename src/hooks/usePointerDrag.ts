import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { releaseVelocity, type Sample } from '../displays/throwMath';
import type { Point } from '../utils/radialGeometry';

/** Movement (CSS px) below which a press stays a tap (spec 4.4). */
export const DRAG_THRESHOLD = 10;

export type PressInfo = { pointerId: number; start: Point; target: Element };

type Options = {
  /** Called on pointerdown. Return false to ignore this press (it then propagates normally). */
  onPress?: (info: PressInfo) => boolean | void;
  onTap?: (info: PressInfo) => void;
  /** `delta` is the total movement since press. */
  onDragStart?: (info: PressInfo, delta: Point) => void;
  onDragMove?: (info: PressInfo, delta: Point) => void;
  /**
   * `cancelled` is true for pointercancel / lost capture (and when a pinch takes over).
   * `velocity` is the finger's speed at release in px/ms (0,0 when cancelled or held still).
   */
  onDragEnd?: (info: PressInfo, delta: Point, cancelled: boolean, velocity: Point) => void;
  /**
   * Two-finger pinch on the same element. Provide `onPinch` to enable it; otherwise extra fingers
   * are ignored. `scale` is finger spread relative to the start, `pan` the midpoint's movement.
   */
  onPinchStart?: () => void;
  onPinch?: (scale: number, pan: Point) => void;
  onPinchEnd?: () => void;
  /** Always called last when an accepted press ends, however it ended. */
  onRelease?: () => void;
  threshold?: number;
};

type Pinch = { second: number; d0: number; mid0: Point; pos: Map<number, Point> };
type Owner = PressInfo & { dragging: boolean; last: Point; samples: Sample[]; pinch: Pinch | null };
/** Enough recent samples to cover the velocity window at 120 Hz+. */
const MAX_SAMPLES = 24;

function addSample(o: Owner, e: ReactPointerEvent) {
  o.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
  if (o.samples.length > MAX_SAMPLES) o.samples.shift();
}

const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Single-owner tap-vs-drag recognizer on Pointer Events, with optional two-finger pinch.
 * The first pointer down owns the gesture; other pointers are ignored until it ends (unless pinch
 * is enabled, in which case the second finger on the same element turns it into a pinch).
 * Handled presses stop propagation so parents (e.g. the background) never see them.
 */
export function usePointerDrag(options: Options) {
  const opts = useRef(options);
  opts.current = options;
  const owner = useRef<Owner | null>(null);

  const capture = (e: ReactPointerEvent<Element>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const finish = (e: ReactPointerEvent, cancelled: boolean) => {
    const o = owner.current;
    if (!o) return;
    if (o.pinch) {
      // Either finger lifting ends the pinch (the other finger is then ignored until it lifts).
      if (e.pointerId !== o.pointerId && e.pointerId !== o.pinch.second) return;
      owner.current = null;
      opts.current.onPinchEnd?.();
      opts.current.onRelease?.();
      return;
    }
    if (o.pointerId !== e.pointerId) return;
    owner.current = null;
    const delta = cancelled ? o.last : { x: e.clientX - o.start.x, y: e.clientY - o.start.y };
    if (o.dragging) {
      // The release point can differ from the last move; land exactly where the finger lifted.
      if (!cancelled) {
        addSample(o, e);
        opts.current.onDragMove?.(o, delta);
      }
      const velocity = cancelled ? { x: 0, y: 0 } : releaseVelocity(o.samples);
      opts.current.onDragEnd?.(o, delta, cancelled, velocity);
    } else if (!cancelled) opts.current.onTap?.(o);
    opts.current.onRelease?.();
  };

  return {
    onPointerDown(e: ReactPointerEvent<Element>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const o = owner.current;
      if (o) {
        // Non-owning finger: swallow so it cannot start a second gesture or a background move.
        e.stopPropagation();
        if (!opts.current.onPinch || o.pinch) return;
        // Second finger on the same element: switch to pinch.
        const first = { x: o.start.x + o.last.x, y: o.start.y + o.last.y };
        const second = { x: e.clientX, y: e.clientY };
        if (o.dragging) {
          opts.current.onDragEnd?.(o, o.last, true, { x: 0, y: 0 });
          o.dragging = false;
        }
        o.pinch = {
          second: e.pointerId,
          d0: Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1),
          mid0: midpoint(first, second),
          pos: new Map([
            [o.pointerId, first],
            [e.pointerId, second],
          ]),
        };
        capture(e);
        opts.current.onPinchStart?.();
        return;
      }
      const info: PressInfo = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, target: e.target as Element };
      if (opts.current.onPress?.(info) === false) return;
      e.stopPropagation();
      owner.current = { ...info, dragging: false, last: { x: 0, y: 0 }, samples: [], pinch: null };
      addSample(owner.current, e);
      capture(e);
    },
    onPointerMove(e: ReactPointerEvent<Element>) {
      const o = owner.current;
      if (!o) return;
      if (o.pinch) {
        if (!o.pinch.pos.has(e.pointerId)) return;
        o.pinch.pos.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...o.pinch.pos.values()];
        const mid = midpoint(a, b);
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        opts.current.onPinch?.(d / o.pinch.d0, { x: mid.x - o.pinch.mid0.x, y: mid.y - o.pinch.mid0.y });
        return;
      }
      if (o.pointerId !== e.pointerId) return;
      const delta = { x: e.clientX - o.start.x, y: e.clientY - o.start.y };
      o.last = delta;
      addSample(o, e);
      if (!o.dragging) {
        if (Math.hypot(delta.x, delta.y) < (opts.current.threshold ?? DRAG_THRESHOLD)) return;
        o.dragging = true;
        opts.current.onDragStart?.(o, delta);
      }
      opts.current.onDragMove?.(o, delta);
    },
    onPointerUp(e: ReactPointerEvent<Element>) {
      finish(e, false);
    },
    onPointerCancel(e: ReactPointerEvent<Element>) {
      finish(e, true);
    },
    onLostPointerCapture(e: ReactPointerEvent<Element>) {
      finish(e, true);
    },
  };
}
