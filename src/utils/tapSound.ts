/**
 * Decides which presses deserve the crystalline chime: a finger, pen or mouse press that is
 * released without moving (tap, click, pen tap, each tap of a double tap, long press).
 * Drags, flicks and pinches move, so they stay silent; so do presses on controls marked
 * data-sound="off" (close ×, "Open screens", the mute button).
 */

/** Movement (CSS px) beyond which a press is a drag, not a tap. Same as the drag threshold. */
export const TAP_SLOP_PX = 10;

type Press = { x: number; y: number; moved: boolean; silent: boolean };

export class TapTracker {
  private presses = new Map<number, Press>();

  /** A pointer went down. `silent` = on a control that never chimes. */
  down(pointerId: number, x: number, y: number, silent: boolean) {
    this.presses.set(pointerId, { x, y, moved: false, silent });
  }

  move(pointerId: number, x: number, y: number) {
    const p = this.presses.get(pointerId);
    if (p && !p.moved && Math.hypot(x - p.x, y - p.y) > TAP_SLOP_PX) p.moved = true;
  }

  /** The pointer lifted: true when this was a tap that should chime. */
  up(pointerId: number, x: number, y: number): boolean {
    this.move(pointerId, x, y);
    const p = this.presses.get(pointerId);
    this.presses.delete(pointerId);
    return !!p && !p.moved && !p.silent;
  }

  /** The system took the pointer away (pointercancel): never a tap. */
  cancel(pointerId: number) {
    this.presses.delete(pointerId);
  }

  get size() {
    return this.presses.size;
  }
}
