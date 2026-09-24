/** Signed smallest difference b − a between two angles, in degrees (−180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export type AngleSample = { t: number; a: number };

/** Angular velocity (deg/ms) over the last `windowMs` of unwrapped angle samples. */
export function angularVelocity(samples: AngleSample[], windowMs = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.a - first.a) / dt : 0;
}

/** How far a flick keeps spinning (ms of travel at release speed) and at most how many slots. */
export const SPIN_PROJECT_MS = 260;
export const SPIN_MAX_EXTRA_SLOTS = 4;

/**
 * Slot the ring settles on after a manual spin: where the momentum would carry it, rounded to the
 * nearest item slot. Positive = clockwise.
 */
export function spinSnapStep(angle: number, velocity: number, slotDeg: number): number {
  const carry = Math.max(
    -SPIN_MAX_EXTRA_SLOTS * slotDeg,
    Math.min(SPIN_MAX_EXTRA_SLOTS * slotDeg, velocity * SPIN_PROJECT_MS),
  );
  return Math.round((angle + carry) / slotDeg);
}

/** Two taps count as a double tap within this time (first release → second press) and distance. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP = 40;
