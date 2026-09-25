import chimeUrl from '../../docs/original_crystalline_touch_3s.mp3';

/** Default volume for the crystalline UI chime (0–1). Change at runtime with `setChimeVolume`. */
export const DEFAULT_CHIME_VOLUME = 0.35;

/** Who started the current sound: a touch always wins over the idle demo. */
export type ChimeSource = 'touch' | 'demo';

let audio: HTMLAudioElement | null = null;
let volume = DEFAULT_CHIME_VOLUME;
let source: ChimeSource | null = null;

function element(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(chimeUrl);
    audio.preload = 'auto';
    audio.volume = volume;
  }
  return audio;
}

const playing = (a: HTMLAudioElement) => !a.paused && !a.ended;

/**
 * Plays the crystalline chime. One shared element, so copies never stack:
 * - 'touch' restarts it from the beginning on every touch/click;
 * - 'demo' plays only if nothing is playing.
 * Browsers block sound until the page has had a user gesture; that refusal is silently ignored.
 */
export function playChime(from: ChimeSource = 'demo') {
  const a = element();
  if (!a) return;
  if (from === 'demo' && playing(a)) return;
  source = from;
  a.currentTime = 0;
  a.play().catch(() => {
    /* autoplay blocked before the first user gesture */
  });
}

/** Stops the chime only if the idle demo started it (a touch's chime keeps playing). */
export function stopDemoChime() {
  if (!audio || source !== 'demo' || !playing(audio)) return;
  audio.pause();
  audio.currentTime = 0;
}

/** Sets the chime volume (0–1). */
export function setChimeVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  if (audio) audio.volume = volume;
}

/** Loads the sound ahead of the first touch so it starts without delay. */
export function preloadChime() {
  element()?.load();
}
