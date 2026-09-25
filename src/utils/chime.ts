import chimeUrl from '../../docs/original_crystalline_touch_3s.mp3';

/** Moderate volume for the crystalline UI chime. */
const CHIME_VOLUME = 0.45;

let audio: HTMLAudioElement | null = null;

/**
 * Plays the crystalline chime once. A single shared element means copies never overlap: if it
 * is still playing, this call does nothing. Browsers block sound until the page has had a user
 * gesture; that refusal is expected and silently ignored.
 */
export function playChime() {
  if (typeof Audio === 'undefined') return;
  if (!audio) {
    audio = new Audio(chimeUrl);
    audio.preload = 'auto';
    audio.volume = CHIME_VOLUME;
  }
  if (!audio.paused && !audio.ended) return;
  audio.currentTime = 0;
  audio.play().catch(() => {
    /* autoplay blocked before the first user gesture */
  });
}

/** Stops the chime (e.g. when the user interrupts the demo). */
export function stopChime() {
  if (!audio || audio.paused) return;
  audio.pause();
  audio.currentTime = 0;
}
