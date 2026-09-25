import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { openDisplayWindows, type OpenResult } from '../displays/openDisplays';
import { displayUrl } from '../displays/protocol';
import { useDisplayStore } from '../displays/useDisplayLink';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { SoundToggle } from './SoundToggle';

const NOTE_MS = 7000;

function describe(r: OpenResult): string {
  switch (r.kind) {
    case 'unsupported':
      return `This browser can't place windows on other screens. Open ${displayUrl()} on each screen and press F11.`;
    case 'denied':
      return 'Allow "Manage windows on all your displays" (icon in the address bar), then tap again.';
    case 'single-screen':
      return 'Only one screen found. In Windows Display settings choose "Extend these displays".';
    case 'opened':
      return r.blocked > 0
        ? `Opened ${r.opened}, ${r.blocked} blocked — allow pop-ups for this site, then tap again.`
        : `Opening ${r.opened} display window${r.opened === 1 ? '' : 's'}…`;
  }
}

/** Corner control that opens a display window on each external screen and shows link status. */
export function ScreensButton() {
  const count = useDisplayStore((s) => Object.keys(s.displays).length);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);

  const show = (text: string) => {
    setNote(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), NOTE_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      show(describe(await openDisplayWindows()));
    } finally {
      setBusy(false);
    }
  };

  const handlers = usePointerDrag({ onTap: () => void open() });

  return (
    <div className="screens">
      <div className="screens__row">
        <SoundToggle />
        <button
          type="button"
          className={`screens__btn${count > 0 ? ' is-linked' : ''}`}
          data-sound="off"
          {...handlers}
          onClick={(e) => {
            if (e.detail === 0) void open();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="4" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="13" y="4" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M8 20h8M12 14v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>{count > 0 ? `${count} screen${count === 1 ? '' : 's'} linked` : 'Open screens'}</span>
        </button>
      </div>
      <AnimatePresence>
        {note && (
          <motion.div
            className="screens__note"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {note}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
