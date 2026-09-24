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
   * `cancelled` is true for pointercancel / lost capture.
   * `velocity` is the finger's speed at release in px/ms (0,0 when cancelled or held still).
   */
  onDragEnd?: (info: PressInfo, delta: Point, cancelled: boolean, velocity: Point) => void;
  /** Always called last when an accepted press ends, however it ended. */
  onRelease?: () => void;
  threshold?: number;
};

type Owner = PressInfo & { dragging: boolean; last: Point; samples: Sample[] };
/** Enough recent samples to cover the velocity window at 120 Hz+. */
const MAX_SAMPLES = 24;

function addSample(o: Owner, e: ReactPointerEvent) {
  o.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
  if (o.samples.length > MAX_SAMPLES) o.samples.shift();
}

/**
 * Single-owner tap-vs-drag recognizer on Pointer Events.
 * The first pointer down owns the gesture; other pointers are ignored until it ends.
 * Handled presses stop propagation so parents (e.g. the background) never see them.
 */
export function usePointerDrag(options: Options) {
  const opts = useRef(options);
  opts.current = options;
  const owner = useRef<Owner | null>(null);

  const finish = (e: ReactPointerEvent, cancelled: boolean) => {
    const o = owner.current;
    if (!o || o.pointerId !== e.pointerId) return;
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
    }
    else if (!cancelled) opts.current.onTap?.(o);
    opts.current.onRelease?.();
  };

  return {
    onPointerDown(e: ReactPointerEvent<Element>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (owner.current) {
        // Non-owning finger: swallow so it cannot start a second gesture or a background move.
        e.stopPropagation();
        return;
      }
      const info: PressInfo = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, target: e.target as Element };
      if (opts.current.onPress?.(info) === false) return;
      e.stopPropagation();
      owner.current = { ...info, dragging: false, last: { x: 0, y: 0 }, samples: [] };
      addSample(owner.current, e);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    },
    onPointerMove(e: ReactPointerEvent<Element>) {
      const o = owner.current;
      if (!o || o.pointerId !== e.pointerId) return;
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
