import { useEffect, useState } from 'react';
import type { Viewport } from '../utils/clampPosition';

const read = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });

/** Viewport size, rAF-throttled on resize. */
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read);
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = read();
        setVp((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return vp;
}
