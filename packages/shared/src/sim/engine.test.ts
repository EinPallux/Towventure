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

describe('biomes 2–5 enemy mechanics', () => {
  it('a crit-immune target is never crit — not even by Shock', () => {
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        critChancePct: 100, // would otherwise crit every swing
        critDamagePct: 100,
        weapons: [{ name: 'Pick', cooldownTicks: 10, damage: 8 }],
        effects: [
          {
            source: 'test',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'applyStatus', status: 'shock', stacks: 3, to: 'target' }],
          },
        ],
      }),
      enemies: [combatant({ id: 'e0', name: 'Unshelved', maxHp: 400, critImmune: true, weapons: [] })],
    });
    const r = simulate(s, 3);
    const crits = r.events.filter((e) => e.type === 'hit' && e.crit === 1);
    expect(crits.length).toBe(0);
    expect(r.winner).toBe('hero'); // still killable by honest damage
  });

  it('a healsFromStatus target is healed by that DoT (Burn ticks read as heals)', () => {
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Torch', cooldownTicks: 10, damage: 6 }],
        effects: [
          {
            source: 'test',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'applyStatus', status: 'burn', stacks: 3, to: 'target' }],
          },
        ],
      }),
      // High HP and no weapon so the fight lasts long enough to see Burn ticks.
      enemies: [
        combatant({ id: 'e0', name: 'Widow', maxHp: 9999, healsFromStatus: 'burn', weapons: [] }),
      ],
    });
    const r = simulate(s, 5);
    const burn = r.events.filter((e) => e.type === 'dot' && e.status === 'burn');
    expect(burn.length).toBeGreaterThan(0);
    // For a Burn-eater every Burn tick is a heal (negative dmg), never damage.
    expect(burn.every((e) => e.type === 'dot' && e.dmg < 0)).toBe(true);
  });

  it("the Prior's self-heal halves once the status-density threshold is crossed", () => {
    // The hero chips a weaponless Prior so its self-heal is visible; density is set
    // purely by a self-loaded Sunder stack (uncapped, non-lethal), NOT by the hero —
    // so the only thing changing between the two runs is the stack count.
    function firstPriorHeal(sunderStacks: number): number {
      const s = spec({
        hero: combatant({
          id: 'hero',
          name: 'Hero',
          weapons: [{ name: 'Chip', cooldownTicks: 5, damage: 40 }],
        }),
        enemies: [
          combatant({
            id: 'e0',
            name: 'Prior',
            maxHp: 1000,
            selfHealPctPerSec: 3, // 3% of 1000 = 30/s at full rate
            healHalvedAtStacks: 10,
            weapons: [],
            effects: [
              {
                source: 'test',
                trigger: { kind: 'OnFightStart' },
                ops: [{ op: 'applyStatus', status: 'sunder', stacks: sunderStacks, to: 'self' }],
              },
            ],
          }),
        ],
      });
      const r = simulate(s, 1);
      const heal = r.events.find((e) => e.type === 'heal' && e.who === 1);
      return heal && heal.type === 'heal' ? heal.amount : 0;
    }
    expect(firstPriorHeal(3)).toBe(30); // below the density threshold → full rate
    expect(firstPriorHeal(12)).toBe(15); // 12 ≥ 10 statuses → heal halved
  });
});

describe('conditional & buffered damage ops', () => {
  it('buffNextHitPct lifts exactly one landing hit, then clears', () => {
    // The hero one-shots via a huge next-hit buffer applied at fight start; the
    // second hit lands at the un-buffered damage.
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Blade', cooldownTicks: 10, damage: 10 }],
        effects: [
          {
            source: 'test',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'buffNextHitPct', pct: 100 }], // +100% → 20 on the first hit only
          },
        ],
      }),
      enemies: [combatant({ id: 'e0', name: 'Dummy', maxHp: 999, weapons: [] })],
    });
    const r = simulate(s, 1);
    const hits = r.events.filter((e) => e.type === 'hit');
    const dmg = hits.map((e) => (e.type === 'hit' ? e.dmg : 0));
    expect(dmg[0]).toBe(20); // 10 × (100 + 100)%
    expect(dmg[1]).toBe(10); // buffer consumed — back to base
  });

  it('buffDamageVsStatusPct only applies while the target carries the status', () => {
    // First hit: target is clean → base damage; it also seeds Venom, so every hit
    // afterwards carries the +50% vs-Venomed bonus.
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Fang', cooldownTicks: 10, damage: 10 }],
        effects: [
          {
            source: 'test',
            trigger: { kind: 'OnHit' },
            ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }],
          },
          {
            source: 'test',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'buffDamageVsStatusPct', status: 'venom', pct: 50 }],
          },
        ],
      }),
      enemies: [combatant({ id: 'e0', name: 'Envenomable', maxHp: 999, weapons: [] })],
    });
    const r = simulate(s, 1);
    const dmg = r.events.filter((e) => e.type === 'hit').map((e) => (e.type === 'hit' ? e.dmg : 0));
    expect(dmg[0]).toBe(10); // target clean on the first strike
    expect(dmg[1]).toBe(15); // now Venomed → 10 × 150%
  });

  it('detonateStatus consumes the affliction and bursts for pct × per-sec × stacks', () => {
    // Seed 5 Bleed at fight start, detonate it at t=20 (first Every-2s fire). No
    // weapons/RNG, so the numbers are exact: 150% × 2 dmg/s × 5 stacks = 15.
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        weapons: [],
        effects: [
          {
            source: 'seed',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'applyStatus', status: 'bleed', stacks: 5, to: 'target' }],
          },
          {
            source: 'Redline',
            trigger: { kind: 'Every', seconds: 2 },
            ops: [{ op: 'detonateStatus', status: 'bleed', pctPerStack: 150, to: 'target' }],
          },
        ],
      }),
      enemies: [combatant({ id: 'e0', name: 'Bleeder', maxHp: 999, weapons: [] })],
    });
    const r = simulate(s, 1);
    const boom = r.events.find((e) => e.type === 'hit' && e.from === 0 && e.to === 1);
    expect(boom && boom.type === 'hit' ? boom.dmg : -1).toBe(15);
    // Bleed is consumed by the detonation — no further Bleed ticks afterwards.
    const bleedAfter = r.events.filter((e) => e.type === 'dot' && e.status === 'bleed' && e.t > 20);
    expect(bleedAfter.length).toBe(0);
  });
});

describe('one-shot (consumable) reporting', () => {
  it('reports exactly the one-shot bindings whose condition fired', () => {
    const s = spec({
      hero: combatant({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Blade', cooldownTicks: 10, damage: 10 }],
        effects: [
          {
            source: 'Adrenal',
            oneShotId: 'a',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'gainArmor', amount: 5 }],
          },
          {
            source: 'Ale',
            oneShotId: 'b',
            trigger: { kind: 'OnHpBelow', pct: 40 },
            ops: [{ op: 'heal', amount: 5 }],
          },
        ],
      }),
      // Unarmed enemy: the hero never drops below 40%, so the Ale must NOT fire.
      enemies: [combatant({ id: 'e0', name: 'Dummy', maxHp: 30, weapons: [] })],
    });
    const r = simulate(s, 1);
    expect(r.firedOneShots).toContain('a');
    expect(r.firedOneShots).not.toContain('b');
  });
});
