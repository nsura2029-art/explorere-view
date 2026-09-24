import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Backdrop } from '../components/Backdrop';
import { ImageLayer } from '../components/ImageLayer';
import { MainRadialMenu } from '../components/MainRadialMenu';
import { RippleLayer } from '../components/RippleLayer';
import { ScreensButton } from '../components/ScreensButton';
import { ThrowPortals } from '../components/ThrowPortals';
import { TouchSurface } from '../components/TouchSurface';
import { useDisplayLink } from '../displays/useDisplayLink';
import { useViewport } from '../hooks/useViewport';
import { useExplorerStore } from '../store/useExplorerStore';
import { clampMenuPosition } from '../utils/clampPosition';
import { clampCardCenter } from '../utils/cardPlacement';
import { computeMenuLayout, EDGE_MARGIN } from '../utils/menuLayout';
import { activePointerCount } from '../utils/pointerRegistry';

/** Default center: 50% width, 48% height (spec 3.1). */
const DEFAULT_ANCHOR = { x: 0.5, y: 0.48 };

export function App() {
  const viewport = useViewport();
  const layout = useMemo(() => computeMenuLayout(viewport), [viewport]);
  const hasPosition = useExplorerStore((s) => s.menuPosition !== null);
  // Link to the display windows on the external screens (throw targets).
  useDisplayLink();

  // Place on first real layout; re-clamp into safe bounds on every resize (RT-12).
  useLayoutEffect(() => {
    // A hidden/zero-size window has no meaningful center yet; wait for a real size.
    if (viewport.width === 0 || viewport.height === 0) return;
    const s = useExplorerStore.getState();
    s.closeSubMenu();
    // Until the user interacts, the menu keeps its default (centered) anchor.
    const desired =
      s.menuPosition && s.hasInteracted
        ? s.menuPosition
        : { x: viewport.width * DEFAULT_ANCHOR.x, y: viewport.height * DEFAULT_ANCHOR.y };
    s.setMenuPosition(
      clampMenuPosition({ desiredPosition: desired, viewport, menuRadius: layout.extent, margin: EDGE_MARGIN }),
    );
    // Keep detached image cards reachable.
    const images = s.images.map((c) => ({ ...c, ...clampCardCenter(c, c.width, c.height, viewport) }));
    if (images.some((c, i) => c.x !== s.images[i].x || c.y !== s.images[i].y)) s.setImages(images);
  }, [viewport, layout.extent]);

  const onBackgroundPress = useCallback(
    (x: number, y: number) => {
      const s = useExplorerStore.getState();
      s.addRipple(x, y);
      s.setSpinMode(false);
      // Only a lone finger relocates; extra fingers and touches during a drag ripple only (spec 4.0).
      if (s.interactionMode === 'dragging' || activePointerCount() > 1 || !s.menuPosition) return;
      s.markInteracted();
      s.closeSubMenu();
      s.setMenuPosition(
        clampMenuPosition({ desiredPosition: { x, y }, viewport, menuRadius: layout.extent, margin: EDGE_MARGIN }),
        'spring',
      );
    },
    [viewport, layout.extent],
  );

  return (
    <TouchSurface onBackgroundPress={onBackgroundPress}>
      <Backdrop />
      <RippleLayer kind="surface" />
      {hasPosition && <MainRadialMenu layout={layout} viewport={viewport} />}
      <RippleLayer kind="item" />
      <ThrowPortals />
      <ImageLayer />
      <ScreensButton />
    </TouchSurface>
  );
}
