import chimeUrl from '../../docs/original_crystalline_touch_3s.mp3';

/** Default volume for the crystalline UI chime (0–1). Change at runtime with `setChimeVolume`. */
export const DEFAULT_CHIME_VOLUME = 0.35;
/** Where the mute choice is remembered (survives reloads and restarts). */
const MUTE_KEY = 'explorer.soundMuted';

let audio: HTMLAudioElement | null = null;
let volume = DEFAULT_CHIME_VOLUME;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function element(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(chimeUrl);
    audio.preload = 'auto';
    audio.volume = volume;
  }
  return audio;
}

/**
 * Plays the crystalline chime from the beginning (one shared element, so copies never stack:
 * a new tap restarts it). Does nothing while muted. Browsers block sound until the page has had
 * a user gesture; that refusal is silently ignored.
 */
export function playChime() {
  if (muted) return;
  const a = element();
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => {
    /* autoplay blocked before the first user gesture */
  });
}

function stopChime() {
  if (!audio || audio.paused) return;
  audio.pause();
  audio.currentTime = 0;
}

/** Sets the chime volume (0–1). */
export function setChimeVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  if (audio) audio.volume = volume;
}

/** Loads the sound ahead of the first tap so it starts without delay. */
export function preloadChime() {
  element()?.load();
}

export const isChimeMuted = () => muted;

/** Mutes / unmutes every chime; the choice is remembered. Muting stops a chime that is playing. */
export function setChimeMuted(value: boolean) {
  if (muted === value) return;
  muted = value;
  if (muted) stopChime();
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
  listeners.forEach((fn) => fn());
}

/** For useSyncExternalStore. */
export function subscribeChimeMuted(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
