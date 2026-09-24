import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { useExplorerStore } from '../store/useExplorerStore';
import { installPointerRegistry } from '../utils/pointerRegistry';

type Props = {
  children: ReactNode;
  /** Pointer down on empty space (menu and image cards stop propagation before this). */
  onBackgroundPress: (x: number, y: number) => void;
};

/**
 * Full-screen interactive surface. Owns touch-action / selection suppression and routes
 * background presses; menu and cards handle their own pointers and stop propagation.
 */
export function TouchSurface({ children, onBackgroundPress }: Props) {
  const handler = useRef(onBackgroundPress);
  handler.current = onBackgroundPress;

  useEffect(() => installPointerRegistry(), []);

  // Any touch (down or up, anywhere, including menu and cards) counts as activity.
  useEffect(() => {
    const note = () => useExplorerStore.getState().noteActivity();
    window.addEventListener('pointerdown', note, true);
    window.addEventListener('pointerup', note, true);
    return () => {
      window.removeEventListener('pointerdown', note, true);
      window.removeEventListener('pointerup', note, true);
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    handler.current(e.clientX, e.clientY);
  };

  return (
    <div
      className="touch-surface"
      data-role="touch-surface"
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
