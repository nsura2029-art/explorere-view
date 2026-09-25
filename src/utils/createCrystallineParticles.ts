/**
 * Particles for the crystalline touch burst. Every random value is decided once, here, when a
 * burst is created; rendering never re-rolls them.
 */

export type ParticleSize = 'small' | 'medium' | 'large';
export type ParticleShape = 'star' | 'diamond' | 'dot' | 'shard' | 'snow';
export type ColorFamily = 'white' | 'blue' | 'purple' | 'magenta';

export type Particle = {
  id: number;
  size: ParticleSize;
  shape: ParticleShape;
  family: ColorFamily;
  color: string;
  /** Glow tint (large feature stars glow blue/purple around their white core). */
  glow: string;
  /** Rendered size, px. */
  px: number;
  /** Direction of travel, degrees (0 = right, clockwise). */
  angle: number;
  /** How far it travels outward, px. */
  distance: number;
  /** Rotation at start and extra spin by the end, degrees. */
  rotation: number;
  spin: number;
  /** Scale reached at the end (some grow slightly). */
  scaleEnd: number;
  /** ms. */
  delay: number;
  duration: number;
};

/** The whole burst is gone by this time after the touch (ms). */
export const BURST_MS = 1000;

type Range = [number, number];
type Spec = { count: Range; px: Range; distance: Range; delay: Range; duration: Range; scaleEnd: Range };

/** Per-size recipe: counts, sizes (px), travel (px) and timing (ms) as specified. */
export const PARTICLE_SPECS: Record<ParticleSize, Spec> = {
  small: { count: [8, 20], px: [3, 8], distance: [20, 70], delay: [20, 60], duration: [560, 820], scaleEnd: [0.7, 1.15] },
  medium: { count: [3, 5], px: [10, 18], distance: [35, 90], delay: [50, 120], duration: [620, 860], scaleEnd: [1, 1.25] },
  large: { count: [1, 2], px: [22, 35], distance: [40, 110], delay: [80, 180], duration: [640, 820], scaleEnd: [1.05, 1.3] },
};

/** Theme colors (match the menu's blue / purple / magenta, plus white highlights). */
export const PALETTE: Record<ColorFamily, string[]> = {
  white: ['#ffffff', '#eef8ff', '#dff4ff'],
  blue: ['#3d82ff', '#56b6ff', '#5fe8ff'],
  purple: ['#9058ff', '#b58cff', '#c9a8ff'],
  magenta: ['#ff38c0', '#ff6fd2', '#ff9ade'],
};
const GLOWS = ['#7fb3ff', '#5fe8ff', '#b58cff'];
/** Feature stars stay white / icy: their "blue" is icy cyan, never deep blue. */
const LARGE_PALETTE: Partial<Record<ColorFamily, string[]>> = {
  white: ['#ffffff', '#f4fbff', '#e6f7ff'],
  blue: ['#c8f3ff', '#9fe9ff', '#7fe3ff'],
};

/** Colour balance per size: about 45% white, 22% blue/cyan, 18% purple, 15% magenta overall. */
const FAMILY_WEIGHTS: Record<ParticleSize, Record<ColorFamily, number>> = {
  small: { white: 0.46, blue: 0.22, purple: 0.17, magenta: 0.15 },
  medium: { white: 0.25, blue: 0.3, purple: 0.25, magenta: 0.2 },
  large: { white: 0.65, blue: 0.35, purple: 0, magenta: 0 },
};

const SHAPE_WEIGHTS: Record<ParticleSize, Partial<Record<ParticleShape, number>>> = {
  small: { dot: 0.4, diamond: 0.25, shard: 0.2, star: 0.1, snow: 0.05 },
  medium: { star: 0.55, diamond: 0.25, snow: 0.2 },
  large: { star: 1 },
};

const between = ([lo, hi]: Range, rnd: () => number) => lo + rnd() * (hi - lo);
const intBetween = ([lo, hi]: Range, rnd: () => number) => Math.min(hi, lo + Math.floor(rnd() * (hi - lo + 1)));
const pick = <T>(list: T[], rnd: () => number) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
function weighted<K extends string>(weights: Partial<Record<K, number>>, rnd: () => number): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [k, w] of entries) {
    if ((r -= w) < 0) return k;
  }
  return entries[entries.length - 1][0];
}

export type BurstOptions = {
  /** Reduced motion: no tiny particles and only a short drift. */
  reduced?: boolean;
};

/** Creates one burst's particles (8–20 small, 3–5 medium, 1–2 large). */
export function createCrystallineParticles(rnd: () => number = Math.random, options: BurstOptions = {}): Particle[] {
  const particles: Particle[] = [];
  let id = 0;
  for (const size of ['small', 'medium', 'large'] as ParticleSize[]) {
    const spec = PARTICLE_SPECS[size];
    const count = options.reduced && size === 'small' ? 0 : intBetween(spec.count, rnd);
    // Spread directions evenly with jitter, from a random start: organic, never a perfect ring.
    const start = rnd() * 360;
    for (let i = 0; i < count; i++) {
      const family = weighted(FAMILY_WEIGHTS[size], rnd);
      const shape = weighted(SHAPE_WEIGHTS[size], rnd);
      const slot = 360 / count;
      const angle = (start + i * slot + (rnd() - 0.5) * slot * 0.8) % 360;
      // Slender crystals (diamonds, shards) point along their flight and barely turn;
      // stars and snow twirl.
      const aligned = shape === 'diamond' || shape === 'shard';
      particles.push({
        id: id++,
        size,
        shape,
        family,
        color: pick((size === 'large' && LARGE_PALETTE[family]) || PALETTE[family], rnd),
        glow: pick(GLOWS, rnd),
        px: Math.round(between(spec.px, rnd) * 10) / 10,
        angle,
        distance: between(spec.distance, rnd) * (options.reduced ? 0.3 : 1),
        rotation: aligned ? angle + 90 + (rnd() - 0.5) * 30 : rnd() * 360,
        spin: (rnd() < 0.5 ? -1 : 1) * (aligned ? between([0, 25], rnd) : between([20, 120], rnd)),
        scaleEnd: between(spec.scaleEnd, rnd),
        delay: Math.round(between(spec.delay, rnd)),
        duration: Math.round(between(spec.duration, rnd)),
      });
    }
  }
  ensureMix(particles, rnd);
  return particles;
}

/** Guarantees white is present and at least three colour families appear (never a one-colour burst). */
function ensureMix(particles: Particle[], rnd: () => number) {
  const recolor = (p: Particle, family: ColorFamily) => {
    p.family = family;
    p.color = pick(PALETTE[family], rnd);
  };
  const smalls = particles.filter((p) => p.size !== 'large');
  if (!particles.some((p) => p.family === 'white') && particles.length) recolor(particles[0], 'white');
  const accents: ColorFamily[] = ['blue', 'purple', 'magenta'];
  let i = 1;
  while (new Set(particles.map((p) => p.family)).size < 3 && i < smalls.length) {
    const missing = accents.find((f) => !particles.some((p) => p.family === f))!;
    if (smalls[i].family !== 'white' || particles.filter((p) => p.family === 'white').length > 1) recolor(smalls[i], missing);
    i++;
  }
}
