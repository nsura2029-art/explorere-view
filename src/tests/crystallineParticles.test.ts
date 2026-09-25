import { describe, expect, it } from 'vitest';
import { BURST_MS, createCrystallineParticles, PARTICLE_SPECS, type ParticleSize } from '../utils/createCrystallineParticles';

const RUNS = 500;
const bursts = Array.from({ length: RUNS }, () => createCrystallineParticles());
const bySize = (ps: ReturnType<typeof createCrystallineParticles>, s: ParticleSize) => ps.filter((p) => p.size === s);

describe('crystalline burst composition', () => {
  it('always has 8–20 small, 3–5 medium and 1–2 large particles', () => {
    for (const ps of bursts) {
      expect(bySize(ps, 'small').length).toBeGreaterThanOrEqual(8);
      expect(bySize(ps, 'small').length).toBeLessThanOrEqual(20);
      expect(bySize(ps, 'medium').length).toBeGreaterThanOrEqual(3);
      expect(bySize(ps, 'medium').length).toBeLessThanOrEqual(5);
      expect(bySize(ps, 'large').length).toBeGreaterThanOrEqual(1);
      expect(bySize(ps, 'large').length).toBeLessThanOrEqual(2);
    }
  });

  it('uses the specified sizes and travel distances', () => {
    for (const ps of bursts) {
      for (const p of ps) {
        const spec = PARTICLE_SPECS[p.size];
        expect(p.px).toBeGreaterThanOrEqual(spec.px[0]);
        expect(p.px).toBeLessThanOrEqual(spec.px[1]);
        expect(p.distance).toBeGreaterThanOrEqual(spec.distance[0]);
        expect(p.distance).toBeLessThanOrEqual(spec.distance[1]);
      }
    }
  });

  it('appears in waves (small, then medium, then large) and is gone within 1 s', () => {
    for (const ps of bursts) {
      for (const p of ps) {
        const [lo, hi] = PARTICLE_SPECS[p.size].delay;
        expect(p.delay).toBeGreaterThanOrEqual(lo);
        expect(p.delay).toBeLessThanOrEqual(hi);
        expect(p.delay + p.duration).toBeLessThanOrEqual(BURST_MS);
      }
    }
  });

  it('large feature stars are four-point stars in white / icy cyan', () => {
    for (const ps of bursts) {
      for (const p of bySize(ps, 'large')) {
        expect(p.shape).toBe('star');
        expect(['white', 'blue']).toContain(p.family);
      }
    }
  });

  it('always includes white and at least three colour families', () => {
    for (const ps of bursts) {
      expect(ps.some((p) => p.family === 'white')).toBe(true);
      expect(new Set(ps.map((p) => p.family)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps roughly the requested colour balance overall', () => {
    const all = bursts.flat();
    const share = (f: string) => all.filter((p) => p.family === f).length / all.length;
    expect(share('white')).toBeGreaterThan(0.35);
    expect(share('white')).toBeLessThan(0.55);
    expect(share('blue')).toBeGreaterThan(0.15);
    expect(share('purple')).toBeGreaterThan(0.1);
    expect(share('magenta')).toBeGreaterThan(0.08);
  });

  it('mixes shapes, and never repeats the exact same particle', () => {
    const shapes = new Set(bursts.flat().map((p) => p.shape));
    expect([...shapes].sort()).toEqual(['diamond', 'dot', 'shard', 'snow', 'star']);
    for (const ps of bursts.slice(0, 50)) {
      const keys = new Set(ps.map((p) => `${p.angle.toFixed(3)}|${p.distance.toFixed(3)}`));
      expect(keys.size).toBe(ps.length);
    }
  });

  it('spreads outward all around the touch point (not one-sided)', () => {
    for (const ps of bursts.slice(0, 100)) {
      const quadrants = new Set(bySize(ps, 'small').map((p) => Math.floor(p.angle / 90)));
      expect(quadrants.size).toBeGreaterThanOrEqual(3);
    }
  });

  it('reduced motion: no tiny particles and only a short drift', () => {
    const ps = createCrystallineParticles(Math.random, { reduced: true });
    expect(bySize(ps, 'small')).toHaveLength(0);
    for (const p of ps) expect(p.distance).toBeLessThanOrEqual(PARTICLE_SPECS[p.size].distance[1] * 0.3 + 1e-9);
  });
});
