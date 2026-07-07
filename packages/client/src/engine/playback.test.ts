import { simulate, type CombatSpec, type CombatantSpec } from '@towventure/shared/sim';
import { describe, expect, it } from 'vitest';
import { Playback } from './playback.js';

function c(over: Partial<CombatantSpec> & Pick<CombatantSpec, 'id' | 'name'>): CombatantSpec {
  return {
    maxHp: 120,
    armor: 0,
    speedPct: 0,
    critChancePct: 0,
    critDamagePct: 0,
    dodgePct: 0,
    lifestealPct: 0,
    thorns: 0,
    weapons: [{ name: 'Blade', cooldownTicks: 12, damage: 12 }],
    effects: [],
    ...over,
  };
}

function spec(): CombatSpec {
  return {
    hero: c({
      id: 'hero',
      name: 'Hero',
      maxHp: 200,
      weapons: [{ name: 'Sword', cooldownTicks: 10, damage: 20 }],
    }),
    enemies: [
      c({
        id: 'e0',
        name: 'Brute',
        maxHp: 80,
        weapons: [{ name: 'Club', cooldownTicks: 12, damage: 8 }],
      }),
    ],
    doomfallStartTicks: 450,
  };
}

describe('Playback — the client-side replay contract', () => {
  const s = spec();
  const seed = 4242;

  it('re-simulates to the same hash and winner the server would report', () => {
    const authoritative = simulate(s, seed);
    const pb = new Playback(s, seed, {});
    expect(pb.logHash).toBe(authoritative.logHash);
    expect(pb.winner).toBe(authoritative.winner);
    expect(pb.endTick).toBe(authoritative.endTick);
  });

  it('reconstructs final HP bars identical to the authoritative result (skip)', () => {
    const authoritative = simulate(s, seed);
    const pb = new Playback(s, seed, {});
    pb.skip();
    expect(pb.isDone).toBe(true);
    expect(pb.hp[0]).toBe(authoritative.heroHpRemaining);
    authoritative.enemyHpRemaining.forEach((hp, i) => expect(pb.hp[i + 1]).toBe(hp));
  });

  it('reaches the same end when stepped tick-by-tick over time', () => {
    const authoritative = simulate(s, seed);
    const pb = new Playback(s, seed, {});
    // Advance 100ms of sim time per step (one tick) until done, with a guard.
    for (let i = 0; i < 1000 && !pb.isDone; i++) pb.update(100);
    expect(pb.isDone).toBe(true);
    expect(pb.hp[0]).toBe(authoritative.heroHpRemaining);
    expect(pb.hp[1]).toBe(authoritative.enemyHpRemaining[0]);
  });

  it('drives listeners: HP updates, at least one swing, and a death, ending once', () => {
    let swings = 0;
    let deaths = 0;
    let ends = 0;
    let lastHeroHp = 200;
    const pb = new Playback(s, seed, {
      onSwing: () => swings++,
      onDeath: () => deaths++,
      onEnd: () => ends++,
      onHp: (idx, hp) => {
        if (idx === 0) lastHeroHp = hp;
      },
    });
    pb.skip();
    expect(swings).toBeGreaterThan(0);
    expect(deaths).toBeGreaterThan(0); // the enemy fell
    expect(ends).toBe(1); // fires exactly once
    expect(lastHeroHp).toBe(simulate(s, seed).heroHpRemaining);
  });
});
