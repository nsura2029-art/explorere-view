import { describe, expect, it } from 'vitest';
import { initialWander, MIN_HOP, randomTarget, safeBounds, wanderSpeed, wanderStep, type WanderState } from '../utils/wander';

const W = 1536;
const H = 864;
const EXTENT = 240;
const bounds = safeBounds(W, H, EXTENT + 20);
const speed = wanderSpeed(W, H);

/** Deterministic PRNG for repeatable paths. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const run = (s: WanderState, seconds: number, rnd = rng(7), dt = 1 / 60) => {
  const path: WanderState[] = [];
  for (let t = 0; t < seconds; t += dt) {
    s = wanderStep(s, dt, bounds, speed, rnd);
    path.push(s);
  }
  return path;
};

describe('initialWander', () => {
  it('starts past the bottom-left corner, heading up and to the right', () => {
    const s = initialWander(bounds, EXTENT, speed);
    expect(s.pos.x).toBeLessThan(bounds.minX);
    expect(s.pos.y).toBeGreaterThan(bounds.maxY);
    expect(s.target.x).toBeGreaterThan((bounds.minX + bounds.maxX) / 2);
    expect(s.target.y).toBeLessThan((bounds.minY + bounds.maxY) / 2);
    expect(s.vel.x).toBeGreaterThan(0);
    expect(s.vel.y).toBeLessThan(0);
    expect(s.entering).toBe(true);
  });
});

describe('wanderStep', () => {
  it('drifts in and reaches the top-right region', () => {
    const path = run(initialWander(bounds, EXTENT, speed), 40);
    const firstInside = path.findIndex((s) => !s.entering);
    expect(firstInside).toBeGreaterThan(0);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const reachedTopRight = path.some((s) => s.pos.x > bounds.minX + w * 0.7 && s.pos.y < bounds.minY + h * 0.3);
    expect(reachedTopRight).toBe(true);
  });

  it('never leaves the safe box once inside', () => {
    const path = run(initialWander(bounds, EXTENT, speed), 120);
    for (const s of path.filter((p) => !p.entering)) {
      expect(s.pos.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(s.pos.x).toBeLessThanOrEqual(bounds.maxX);
      expect(s.pos.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(s.pos.y).toBeLessThanOrEqual(bounds.maxY);
    }
  });

  it('moves slowly and smoothly: capped speed, no sudden jumps', () => {
    const path = run(initialWander(bounds, EXTENT, speed), 90);
    for (let i = 1; i < path.length; i++) {
      const step = Math.hypot(path[i].pos.x - path[i - 1].pos.x, path[i].pos.y - path[i - 1].pos.y);
      expect(step).toBeLessThanOrEqual(speed / 60 + 1e-6);
    }
  });

  it('keeps roaming to new places across the window', () => {
    const path = run(initialWander(bounds, EXTENT, speed), 180, rng(3));
    const targets = new Set(path.map((s) => `${Math.round(s.target.x)},${Math.round(s.target.y)}`));
    expect(targets.size).toBeGreaterThanOrEqual(4);
    const xs = path.filter((s) => !s.entering).map((s) => s.pos.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan((bounds.maxX - bounds.minX) * 0.6);
  });
});

describe('randomTarget', () => {
  it('picks far-away points inside the box', () => {
    const r = rng(11);
    const from = { x: bounds.minX, y: bounds.minY };
    const diag = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    for (let i = 0; i < 50; i++) {
      const p = randomTarget(bounds, from, r);
      expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(p.x).toBeLessThanOrEqual(bounds.maxX);
      expect(Math.hypot(p.x - from.x, p.y - from.y)).toBeGreaterThanOrEqual(diag * MIN_HOP * 0.99);
    }
  });
});

describe('wanderSpeed', () => {
  it('is slow and scales with the screen', () => {
    expect(wanderSpeed(800, 600)).toBeGreaterThanOrEqual(60);
    expect(wanderSpeed(3840, 2160)).toBeLessThanOrEqual(140);
    expect(wanderSpeed(1920, 1080)).toBeGreaterThan(wanderSpeed(1024, 768));
  });
});
