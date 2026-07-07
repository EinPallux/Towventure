import { describe, expect, it } from 'vitest';
import { DOOMFALL_START_TICKS } from './constants.js';
import { simulate } from './engine.js';
import type { CombatSpec, CombatantSpec } from './types.js';

function combatant(
  over: Partial<CombatantSpec> & Pick<CombatantSpec, 'id' | 'name'>,
): CombatantSpec {
  return {
    maxHp: 100,
    armor: 0,
    speedPct: 0,
    critChancePct: 0,
    critDamagePct: 0,
    dodgePct: 0,
    lifestealPct: 0,
    thorns: 0,
    weapons: [{ name: 'Fist', cooldownTicks: 10, damage: 10 }],
    effects: [],
    ...over,
  };
}

function spec(over: Partial<CombatSpec> = {}): CombatSpec {
  return {
    hero: combatant({ id: 'hero', name: 'Hero' }),
    enemies: [combatant({ id: 'e0', name: 'Dummy', maxHp: 40, weapons: [] })],
    doomfallStartTicks: DOOMFALL_START_TICKS,
    ...over,
  };
}

describe('sim determinism', () => {
  it('is bit-identical across runs of the same seed', () => {
    const s = spec();
    const a = simulate(s, 12345);
    const b = simulate(s, 12345);
    expect(a.logHash).toBe(b.logHash);
    expect(a.endTick).toBe(b.endTick);
    expect(a.events.length).toBe(b.events.length);
  });

  it('diverges on a different seed when there is any RNG (crit rolls)', () => {
    const s = spec({
      hero: combatant({ id: 'hero', name: 'Hero', critChancePct: 50 }),
      enemies: [combatant({ id: 'e0', name: 'Dummy', maxHp: 200, weapons: [] })],
    });
    const a = simulate(s, 1);
    const b = simulate(s, 999999);
    expect(a.logHash).not.toBe(b.logHash);
  });
});

describe('sim outcomes', () => {
  it('a hero with a weapon kills an unarmed dummy', () => {
    const r = simulate(spec(), 42);
    expect(r.winner).toBe('hero');
    expect(r.enemyHpRemaining[0]).toBe(0);
    expect(r.heroHpRemaining).toBe(100);
  });

  it('Doomfall resolves a stalemate of two unkillable walls', () => {
    // Two combatants that cannot damage each other → Doomfall must end it.
    const s = spec({
      hero: combatant({ id: 'hero', name: 'Hero', maxHp: 100, armor: 999, weapons: [] }),
      enemies: [combatant({ id: 'e0', name: 'Wall', maxHp: 100, armor: 999 })],
    });
    const r = simulate(s, 7);
    expect(r.endTick).toBeGreaterThanOrEqual(DOOMFALL_START_TICKS);
    expect(['hero', 'enemies']).toContain(r.winner);
    expect(r.events.some((e) => e.type === 'doomfall')).toBe(true);
  });

  it('Armor reduces damage but a hit always deals at least 1', () => {
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Pin', cooldownTicks: 10, damage: 5 }],
      }),
      enemies: [combatant({ id: 'e0', name: 'Tank', maxHp: 30, armor: 100, weapons: [] })],
    });
    const r = simulate(s, 3);
    const hit = r.events.find((e) => e.type === 'hit');
    expect(hit && hit.type === 'hit' ? hit.dmg : 0).toBe(1);
  });

  it('a simultaneous KO (lethal hit + fatal Thorns) resolves as a hero loss', () => {
    // The enemy lands a lethal blow on the hero; the hero's Thorns kill the enemy the
    // same instant. The hero must LOSE the tie — a 0-HP hero never "wins" (BALANCE §1).
    const s = spec({
      hero: combatant({ id: 'hero', name: 'Hero', maxHp: 10, thorns: 999, weapons: [] }),
      enemies: [
        combatant({
          id: 'e0',
          name: 'Kamikaze',
          maxHp: 5,
          weapons: [{ name: 'Lethal', cooldownTicks: 10, damage: 100 }],
        }),
      ],
    });
    const r = simulate(s, 1);
    expect(r.winner).toBe('enemies');
    expect(r.heroHpRemaining).toBe(0);
    expect(r.enemyHpRemaining[0]).toBe(0); // both fell
  });
});

describe('Phase 2 statuses', () => {
  it('Shock forces a guaranteed crit through dodge (hero has 0 base crit)', () => {
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        critChancePct: 0,
        weapons: [{ name: 'Rod', cooldownTicks: 12, damage: 10 }],
        effects: [
          {
            source: 'test',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'applyStatus', status: 'shock', stacks: 3, to: 'target' }],
          },
        ],
      }),
      enemies: [combatant({ id: 'e0', name: 'Slippery', maxHp: 400, dodgePct: 40, weapons: [] })],
    });
    const r = simulate(s, 7);
    const firstHit = r.events.find((e) => e.type === 'hit');
    // With 0 crit chance, a crit can only come from Shock; and it can't be dodged.
    expect(firstHit && firstHit.type === 'hit' ? firstHit.crit : 0).toBe(1);
  });

  it('Venom never expires and ramps: later ticks exceed earlier ones', () => {
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        maxHp: 999,
        weapons: [],
        effects: [
          {
            source: 'test',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }],
          },
        ],
      }),
      enemies: [combatant({ id: 'e0', name: 'Sponge', maxHp: 9999, weapons: [] })],
    });
    const r = simulate(s, 1);
    const venom = r.events.filter((e) => e.type === 'dot' && e.status === 'venom');
    const dmgs = venom.map((e) => (e.type === 'dot' ? e.dmg : 0));
    expect(dmgs.length).toBeGreaterThan(10);
    expect(dmgs[0]).toBe(1); // 1 stack, no ramp yet
    expect(dmgs[dmgs.length - 1]!).toBeGreaterThan(dmgs[0]!); // it only grows
  });
});
