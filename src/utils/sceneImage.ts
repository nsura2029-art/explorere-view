/**
 * Procedural placeholder artwork for submenu items: a layered night landscape in the Explorer
 * palette. Deterministic per seed, dependency-free, works offline.
 */

type Palette = { sky: [string, string, string]; glow: string; orb: [string, string]; ridges: [string, string, string] };

const PALETTES: Palette[] = [
  // aurora
  { sky: ['#030a2e', '#0b2a8a', '#2a6cff'], glow: '#38e1ff', orb: ['#e9f6ff', '#6fc3ff'], ridges: ['#1b2f86', '#101c5c', '#070c2e'] },
  // nebula
  { sky: ['#12032e', '#3d1291', '#9b5cff'], glow: '#ff5ad1', orb: ['#fff0fb', '#d58bff'], ridges: ['#3a1a8c', '#22105a', '#0e0630'] },
  // dusk
  { sky: ['#1a0526', '#7a1470', '#ff4fb3'], glow: '#ffb35a', orb: ['#fff4e0', '#ff9a6b'], ridges: ['#5b1560', '#360c42', '#170520'] },
  // ocean
  { sky: ['#020b22', '#063d7a', '#00b7ff'], glow: '#7affe0', orb: ['#effffb', '#7ae3ff'], ridges: ['#0a3a7a', '#06244f', '#020f26'] },
  // crystal
  { sky: ['#07051f', '#241a7a', '#6d7cff'], glow: '#c79bff', orb: ['#ffffff', '#b8c4ff'], ridges: ['#2c2583', '#181457', '#0a0829'] },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 640;
const H = 420;
const f = (n: number) => n.toFixed(1);

/** Midpoint-displacement ridge line closed to the bottom edge. */
function ridge(rnd: () => number, base: number, rough: number): string {
  const n = 64;
  const pts = new Array<number>(n + 1).fill(base);
  pts[0] = base + (rnd() - 0.5) * rough;
  pts[n] = base + (rnd() - 0.5) * rough;
  for (let step = n; step > 1; step /= 2) {
    const amp = rough * (step / n);
    for (let i = step / 2; i < n; i += step) {
      pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 + (rnd() - 0.5) * amp * 2;
    }
  }
  const coords = pts.map((y, i) => `${f((i / n) * W)} ${f(y)}`).join(' L');
  return `M0 ${H} L${coords} L${W} ${H} Z`;
}

function buildScene(seed: number): string {
  const rnd = mulberry32(seed * 7919 + 17);
  const pal = PALETTES[seed % PALETTES.length];
  const orbX = 120 + rnd() * 400;
  const orbY = 80 + rnd() * 70;
  const orbR = 26 + rnd() * 26;

  const stars = Array.from({ length: 70 }, () => {
    const r = 0.5 + rnd() * 1.4;
    return `<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H * 0.6)}" r="${f(r)}" fill="#fff" opacity="${f(0.3 + rnd() * 0.7)}"/>`;
  }).join('');

  const a1 = 150 + rnd() * 60;
  const aurora = `M-20 ${f(a1)} C ${f(W * 0.25)} ${f(a1 - 90 - rnd() * 40)}, ${f(W * 0.6)} ${f(a1 + 50)}, ${W + 20} ${f(a1 - 70 - rnd() * 40)}`;

  const ridges = pal.ridges
    .map((c, i) => `<path d="${ridge(rnd, 250 + i * 55, 150 - i * 35)}" fill="${c}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky[0]}"/><stop offset="0.62" stop-color="${pal.sky[1]}"/><stop offset="1" stop-color="${pal.sky[2]}"/></linearGradient>
<radialGradient id="orb"><stop offset="0" stop-color="${pal.orb[0]}"/><stop offset="0.7" stop-color="${pal.orb[1]}"/><stop offset="1" stop-color="${pal.orb[1]}" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop offset="0" stop-color="${pal.glow}" stop-opacity="0.45"/><stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="aur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${pal.glow}" stop-opacity="0"/><stop offset="0.5" stop-color="${pal.glow}" stop-opacity="0.7"/><stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/></linearGradient>
<filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.glow}" stop-opacity="0"/><stop offset="1" stop-color="${pal.glow}" stop-opacity="0.28"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars}
<path d="${aurora}" stroke="url(#aur)" stroke-width="46" fill="none" filter="url(#blur)"/>
<circle cx="${f(orbX)}" cy="${f(orbY)}" r="${f(orbR * 3.2)}" fill="url(#halo)"/>
<circle cx="${f(orbX)}" cy="${f(orbY)}" r="${f(orbR)}" fill="url(#orb)"/>
${ridges}
<rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#mist)"/>
</svg>`;
}

const cache = new Map<number, string>();

/** Data URL for the scene with this seed (cached). */
export function sceneImageUrl(seed: number): string {
  let url = cache.get(seed);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildScene(seed))}`;
    cache.set(seed, url);
  }
  return url;
}

export const SCENE_ASPECT = H / W;
