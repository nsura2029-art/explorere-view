import { useChimeMuted } from '../hooks/useTapChime';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { playChime, setChimeMuted } from '../utils/chime';

/**
 * Round mute / unmute control beside "Open screens". Mutes every chime; the choice is remembered.
 * Turning sound back on plays one chime as confirmation.
 */
export function SoundToggle() {
  const muted = useChimeMuted();
  const toggle = () => {
    const next = !muted;
    setChimeMuted(next);
    if (!next) playChime();
  };
  const handlers = usePointerDrag({ onTap: toggle });
  return (
    <button
      type="button"
      className={`sound-toggle${muted ? ' is-muted' : ''}`}
      data-sound="off"
      aria-label={muted ? 'Sound off — tap to turn sound on' : 'Sound on — tap to mute'}
      aria-pressed={muted}
      title={muted ? 'Sound off' : 'Sound on'}
      {...handlers}
      onClick={(e) => {
        if (e.detail === 0) toggle();
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
          </g>
        )}
      </svg>
    </button>
  );
}
