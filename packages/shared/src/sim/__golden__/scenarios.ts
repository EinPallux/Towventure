/**
 * Golden scenarios — scripted fights covering every Phase 1 trigger, status, and
 * the boss stun mechanic (ARCHITECTURE.md §4.4). Each is a fixed `(spec, seed)`;
 * the committed `golden.json` pins the resulting hash/outcome. A sim change that
 * moves any hash must be intentional and regenerated via `pnpm goldens:update`.
 */

import { DOOMFALL_START_TICKS } from '../constants.js';
import type { CombatSpec, CombatantSpec, EffectBinding } from '../types.js';

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

function fight(
  hero: CombatantSpec,
  enemies: CombatantSpec[],
  doom = DOOMFALL_START_TICKS,
): CombatSpec {
  return { hero, enemies, doomfallStartTicks: doom };
}

const bindOnHit = (
  ops: EffectBinding['ops'],
  extra: Partial<EffectBinding> = {},
): EffectBinding => ({
  source: 'test',
  trigger: { kind: 'OnHit' },
  ops,
  ...extra,
});

export interface Scenario {
  name: string;
  seed: number;
  spec: CombatSpec;
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'basic-melee',
    seed: 101,
    spec: fight(c({ id: 'hero', name: 'Hero' }), [
      c({ id: 'e0', name: 'Dummy', maxHp: 60, weapons: [] }),
    ]),
  },
  {
    name: 'crit',
    seed: 202,
    spec: fight(c({ id: 'hero', name: 'Hero', critChancePct: 60, critDamagePct: 50 }), [
      c({ id: 'e0', name: 'Sack', maxHp: 200, weapons: [] }),
    ]),
  },
  {
    name: 'dodge-and-ondodge',
    seed: 303,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        dodgePct: 40,
        effects: [
          { source: 'Rumor', trigger: { kind: 'OnDodge' }, ops: [{ op: 'gainArmor', amount: 3 }] },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Puncher',
          maxHp: 400,
          weapons: [{ name: 'Jab', cooldownTicks: 8, damage: 8 }],
        }),
      ],
    ),
  },
  {
    name: 'bleed-every-3rd',
    seed: 404,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Dirk', cooldownTicks: 13, damage: 8 }],
        effects: [
          bindOnHit([{ op: 'applyStatus', status: 'bleed', stacks: 2, to: 'target' }], {
            everyNthHit: 3,
          }),
        ],
      }),
      [c({ id: 'e0', name: 'Bleeder', maxHp: 300, armor: 4, weapons: [] })],
    ),
  },
  {
    name: 'burn-chance',
    seed: 505,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Whip', cooldownTicks: 18, damage: 10 }],
        effects: [
          bindOnHit([{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }], {
            chancePct: 40,
          }),
        ],
      }),
      [c({ id: 'e0', name: 'Kindling', maxHp: 250, weapons: [] })],
    ),
  },
  {
    name: 'chill-slows',
    seed: 606,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 500,
        effects: [bindOnHit([{ op: 'applyStatus', status: 'chill', stacks: 2, to: 'target' }])],
      }),
      [
        c({
          id: 'e0',
          name: 'Frostable',
          maxHp: 200,
          weapons: [{ name: 'Claw', cooldownTicks: 12, damage: 9 }],
        }),
      ],
    ),
  },
  {
    name: 'regen-onhurt',
    seed: 707,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 300,
        weapons: [],
        effects: [
          {
            source: 'Chime',
            trigger: { kind: 'OnHurt' },
            ops: [{ op: 'applyStatus', status: 'regen', stacks: 3, to: 'self' }],
            minHitPctMax: 5,
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Beater',
          maxHp: 999,
          weapons: [{ name: 'Club', cooldownTicks: 15, damage: 20 }],
        }),
      ],
    ),
  },
  {
    name: 'ward-absorb-decay',
    seed: 808,
    spec: fight(c({ id: 'hero', name: 'Hero', maxHp: 200, startWardPct: 30, weapons: [] }), [
      c({
        id: 'e0',
        name: 'Chipper',
        maxHp: 999,
        weapons: [{ name: 'Tap', cooldownTicks: 10, damage: 6 }],
      }),
    ]),
  },
  {
    name: 'armor-onhit-maul',
    seed: 909,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Maul', cooldownTicks: 34, damage: 34 }],
        effects: [bindOnHit([{ op: 'gainArmor', amount: 4 }])],
      }),
      [
        c({
          id: 'e0',
          name: 'Ferryman',
          maxHp: 400,
          weapons: [{ name: 'Oar', cooldownTicks: 14, damage: 12 }],
        }),
      ],
    ),
  },
  {
    name: 'onblock-retaliate-thorns',
    seed: 111,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 300,
        armor: 8,
        thorns: 5,
        weapons: [],
        effects: [
          {
            source: 'Bulwark Sigil',
            trigger: { kind: 'OnBlock' },
            ops: [{ op: 'retaliateThorns', mult: 3 }],
            chancePct: 100,
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Puncher',
          maxHp: 200,
          weapons: [{ name: 'Fist', cooldownTicks: 10, damage: 12 }],
        }),
      ],
    ),
  },
  {
    name: 'onfightstart-armor',
    seed: 222,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        effects: [
          {
            source: 'Shovel',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'gainArmor', amount: 15 }],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Grave',
          maxHp: 120,
          weapons: [{ name: 'Spade', cooldownTicks: 12, damage: 10 }],
        }),
      ],
    ),
  },
  {
    name: 'onhpbelow-buff',
    seed: 333,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 120,
        weapons: [{ name: 'Sword', cooldownTicks: 12, damage: 10 }],
        effects: [
          {
            source: 'Standard',
            trigger: { kind: 'OnHpBelow', pct: 50 },
            ops: [{ op: 'buffDamagePct', pct: 50 }],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Rival',
          maxHp: 250,
          weapons: [{ name: 'Sword', cooldownTicks: 12, damage: 14 }],
        }),
      ],
    ),
  },
  {
    name: 'ondoomfall-burnup',
    seed: 444,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 400,
        weapons: [{ name: 'Brand', cooldownTicks: 20, damage: 8 }],
        effects: [
          {
            source: 'Argument of Ash',
            trigger: { kind: 'OnDoomfall' },
            ops: [{ op: 'buffDamagePct', pct: 100 }],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Endurer',
          maxHp: 260,
          armor: 2,
          weapons: [{ name: 'Poke', cooldownTicks: 16, damage: 6 }],
        }),
      ],
      DOOMFALL_START_TICKS,
    ),
  },
  {
    name: 'every-cinder-dart',
    seed: 555,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 300,
        weapons: [{ name: 'Rod', cooldownTicks: 20, damage: 10 }],
        effects: [
          {
            source: 'Singed Grimoire',
            trigger: { kind: 'Every', seconds: 7 },
            ops: [
              { op: 'damageWeaponPct', pct: 80, to: 'target' },
              { op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' },
            ],
          },
        ],
      }),
      [c({ id: 'e0', name: 'Study', maxHp: 220, weapons: [] })],
    ),
  },
  {
    name: 'stun-toll-bell',
    seed: 666,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 400,
        weapons: [{ name: "Toll-Keeper's Bell", cooldownTicks: 40, damage: 40 }],
        effects: [
          bindOnHit([
            { op: 'stun', ticks: 6, to: 'target' },
            { op: 'gainArmor', amount: 10 },
          ]),
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Stunnable',
          maxHp: 300,
          weapons: [{ name: 'Swipe', cooldownTicks: 12, damage: 8 }],
        }),
      ],
    ),
  },
  {
    name: 'multi-enemy-focus',
    seed: 777,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 300,
        weapons: [{ name: 'Cleaver', cooldownTicks: 12, damage: 16 }],
      }),
      [
        c({
          id: 'e0',
          name: 'Rat A',
          maxHp: 40,
          weapons: [{ name: 'Bite', cooldownTicks: 14, damage: 5 }],
        }),
        c({
          id: 'e1',
          name: 'Rat B',
          maxHp: 55,
          weapons: [{ name: 'Bite', cooldownTicks: 14, damage: 5 }],
        }),
        c({
          id: 'e2',
          name: 'Rat C',
          maxHp: 30,
          weapons: [{ name: 'Bite', cooldownTicks: 14, damage: 5 }],
        }),
      ],
    ),
  },

  // ── Phase 2 statuses + triggers ──────────────────────────────────────────
  {
    name: 'venom-ramps',
    seed: 888,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 500,
        weapons: [{ name: 'Kris', cooldownTicks: 15, damage: 4 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }])],
      }),
      [c({ id: 'e0', name: 'Envenomable', maxHp: 400, weapons: [] })],
    ),
  },
  {
    name: 'shock-guarantees-crit',
    seed: 999,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Rod', cooldownTicks: 16, damage: 10 }],
        critChancePct: 0,
        critDamagePct: 100,
        effects: [bindOnHit([{ op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' }])],
      }),
      // High dodge — Shock must force the next hit to land and crit.
      [c({ id: 'e0', name: 'Slippery', maxHp: 300, dodgePct: 40, weapons: [] })],
    ),
  },
  {
    name: 'weaken-reduces-damage',
    seed: 1212,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 600,
        weapons: [{ name: 'Dagger', cooldownTicks: 10, damage: 6 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'weaken', stacks: 5, to: 'target' }])],
      }),
      [
        c({
          id: 'e0',
          name: 'Courtier',
          maxHp: 200,
          weapons: [{ name: 'Rapier', cooldownTicks: 10, damage: 30 }],
        }),
      ],
    ),
  },
  {
    name: 'sunder-negative-armor',
    seed: 1313,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Pick', cooldownTicks: 12, damage: 8 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'sunder', stacks: 5, to: 'target' }])],
      }),
      [c({ id: 'e0', name: 'Colossus', maxHp: 260, armor: 10, weapons: [] })],
    ),
  },
  {
    name: 'haste-speeds-cooldowns',
    seed: 1414,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Blade', cooldownTicks: 20, damage: 10 }],
        effects: [
          {
            source: 'Adrenal',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'applyStatus', status: 'haste', stacks: 6, to: 'self' }],
          },
        ],
      }),
      [c({ id: 'e0', name: 'Sack', maxHp: 300, weapons: [] })],
    ),
  },
  {
    name: 'onstatusapplied-chill-to-shock',
    seed: 1515,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 400,
        weapons: [{ name: 'Coldsnap', cooldownTicks: 14, damage: 8 }],
        effects: [
          bindOnHit([{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }]),
          {
            source: 'Frost (4)',
            trigger: { kind: 'OnStatusApplied', status: 'chill' },
            chancePct: 50,
            ops: [{ op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' }],
          },
        ],
      }),
      [c({ id: 'e0', name: 'Frostable', maxHp: 260, weapons: [] })],
    ),
  },
  {
    name: 'onenemydeath-heal',
    seed: 1616,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 300,
        weapons: [{ name: 'Fang', cooldownTicks: 10, damage: 30 }],
        effects: [
          {
            source: 'Wild (4)',
            trigger: { kind: 'OnEnemyDeath' },
            ops: [{ op: 'healPctMax', pct: 8 }],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Prey A',
          maxHp: 30,
          weapons: [{ name: 'Nip', cooldownTicks: 8, damage: 20 }],
        }),
        c({
          id: 'e1',
          name: 'Prey B',
          maxHp: 30,
          weapons: [{ name: 'Nip', cooldownTicks: 8, damage: 20 }],
        }),
      ],
    ),
  },

  // ── Biomes 2–5 enemy mechanics (CONTENT §4) ─────────────────────────────────
  {
    // The Unshelved: crit-immune — 100% crit AND Shock must still land as normal hits.
    name: 'crit-immune-elite',
    seed: 1717,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        critChancePct: 100,
        critDamagePct: 100,
        weapons: [{ name: 'Pick', cooldownTicks: 12, damage: 12 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' }])],
      }),
      [c({ id: 'e0', name: 'Unshelved', maxHp: 300, armor: 3, critImmune: true, weapons: [] })],
    ),
  },
  {
    // Cinder Widow: Burn DoT heals her instead of hurting — win by raw weapon damage.
    name: 'heals-from-burn',
    seed: 1818,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 400,
        weapons: [{ name: 'Torch', cooldownTicks: 12, damage: 7 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }])],
      }),
      [
        c({
          id: 'e0',
          name: 'Widow',
          maxHp: 220,
          healsFromStatus: 'burn',
          weapons: [{ name: 'Sear', cooldownTicks: 14, damage: 9 }],
        }),
      ],
    ),
  },
  {
    // Prior of Teeth: 3%/s self-heal, halved once 10+ total status stacks sit on him.
    name: 'prior-self-heal-density',
    seed: 1919,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 500,
        weapons: [{ name: 'Fang', cooldownTicks: 10, damage: 14 }],
        effects: [
          bindOnHit([
            { op: 'applyStatus', status: 'bleed', stacks: 2, to: 'target' },
            { op: 'applyStatus', status: 'sunder', stacks: 2, to: 'target' },
            { op: 'applyStatus', status: 'weaken', stacks: 2, to: 'target' },
          ]),
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Prior',
          maxHp: 400,
          selfHealPctPerSec: 3,
          healHalvedAtStacks: 10,
          weapons: [{ name: 'Bite', cooldownTicks: 16, damage: 8 }],
        }),
      ],
    ),
  },

  // ── Deferred-ops wave: next-hit buffer + conditional vs-status damage ────────
  {
    // Shadow (4): each dodge buffs the hero's next landing hit by +40%.
    name: 'shadow-next-hit-buffer',
    seed: 2020,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        dodgePct: 40,
        weapons: [{ name: 'Kris', cooldownTicks: 12, damage: 12 }],
        effects: [
          {
            source: 'Shadow (4)',
            trigger: { kind: 'OnDodge' },
            ops: [{ op: 'buffNextHitPct', pct: 40 }],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Puncher',
          maxHp: 300,
          weapons: [{ name: 'Jab', cooldownTicks: 8, damage: 8 }],
        }),
      ],
    ),
  },
  {
    // Venom (4): the hero's hits deal +25% while the target is Venomed. The hero
    // seeds Venom OnHit, so every hit after the first carries the bonus.
    name: 'venom-vs-status-damage',
    seed: 2121,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Fang', cooldownTicks: 12, damage: 10 }],
        effects: [
          bindOnHit([{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }]),
          {
            source: 'Venom (4)',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'buffDamageVsStatusPct', status: 'venom', pct: 25 }],
          },
        ],
      }),
      [c({ id: 'e0', name: 'Envenomable', maxHp: 300, weapons: [] })],
    ),
  },
  {
    // Redline (Sawtooth Dirk ★5): OnHit stacks Bleed, and crits consume it all for
    // 150% of its damage — the first Zenith transform.
    name: 'redline-detonate-bleed',
    seed: 2323,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        critChancePct: 30,
        weapons: [{ name: 'Dirk', cooldownTicks: 13, damage: 5 }],
        effects: [
          bindOnHit([{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }]),
          {
            source: 'Redline',
            trigger: { kind: 'OnCrit' },
            ops: [{ op: 'detonateStatus', status: 'bleed', pctPerStack: 150, to: 'target' }],
          },
        ],
      }),
      [c({ id: 'e0', name: 'Bleeder', maxHp: 300, weapons: [] })],
    ),
  },
  {
    // Solarlash (Kindlewhip ★5): each hit stacks Burn; once it hits 10 the whole
    // stack detonates AoE. Uses the OnStatusApplied minStacks gate.
    name: 'solarlash-threshold-detonate',
    seed: 2424,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Kindlewhip', cooldownTicks: 8, damage: 4 }],
        effects: [
          bindOnHit([{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }]),
          {
            source: 'Solarlash',
            trigger: { kind: 'OnStatusApplied', status: 'burn', minStacks: 10 },
            ops: [{ op: 'detonateStatus', status: 'burn', pctPerStack: 200, to: 'allEnemies' }],
          },
        ],
      }),
      [c({ id: 'e0', name: 'Kindling', maxHp: 400, weapons: [] })],
    ),
  },

  // ── Deferred ops wave 2 ─────────────────────────────────────────────────────
  {
    // Choir of Nails: a weapon that strikes 3× per swing (each a full hit).
    name: 'multi-hit-weapon',
    seed: 2525,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Choir', cooldownTicks: 14, damage: 6, hitsPerSwing: 3 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }])],
      }),
      [c({ id: 'e0', name: 'Riddled', maxHp: 300, weapons: [] })],
    ),
  },
  {
    // Sparkrod chain: Every 4s, bounce 60% weapon damage to the 2 lowest-HP enemies.
    name: 'chain-hit-bounce',
    seed: 2626,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 400,
        weapons: [{ name: 'Rod', cooldownTicks: 18, damage: 12 }],
        effects: [
          {
            source: 'Stormtongue',
            trigger: { kind: 'Every', seconds: 4 },
            ops: [{ op: 'chainHit', pct: 60, targets: 2 }],
          },
        ],
      }),
      [
        c({ id: 'e0', name: 'A', maxHp: 80, weapons: [] }),
        c({ id: 'e1', name: 'B', maxHp: 120, weapons: [] }),
        c({ id: 'e2', name: 'C', maxHp: 60, weapons: [] }),
      ],
    ),
  },
  {
    // Molt: below 50% HP, cleanse all statuses on self and gain Armor.
    name: 'cleanse-on-low-hp',
    seed: 2727,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        maxHp: 200,
        weapons: [{ name: 'Blade', cooldownTicks: 12, damage: 8 }],
        effects: [
          {
            source: 'Molt',
            trigger: { kind: 'OnHpBelow', pct: 50 },
            ops: [
              { op: 'cleanse', to: 'self' },
              { op: 'gainArmor', amount: 15 },
            ],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Venomer',
          maxHp: 400,
          weapons: [{ name: 'Fang', cooldownTicks: 10, damage: 14 }],
          effects: [bindOnHit([{ op: 'applyStatus', status: 'venom', stacks: 2, to: 'target' }])],
        }),
      ],
    ),
  },
  {
    // Ember (2): the hero's Burn deals +50%.
    name: 'status-damage-buff-burn',
    seed: 2828,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        weapons: [{ name: 'Brand', cooldownTicks: 12, damage: 4 }],
        effects: [
          {
            source: 'Ember (2)',
            trigger: { kind: 'OnFightStart' },
            ops: [{ op: 'buffStatusDamagePct', status: 'burn', pct: 50 }],
          },
          bindOnHit([{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }]),
        ],
      }),
      [c({ id: 'e0', name: 'Kindling', maxHp: 300, weapons: [] })],
    ),
  },
  {
    // Lantern-Hook: on dodge, the next hook also applies +3 Burn.
    name: 'next-hit-status-buffer',
    seed: 2929,
    spec: fight(
      c({
        id: 'hero',
        name: 'Hero',
        dodgePct: 40,
        weapons: [{ name: 'Hook', cooldownTicks: 12, damage: 8 }],
        effects: [
          {
            source: 'Lantern-Hook',
            trigger: { kind: 'OnDodge' },
            ops: [{ op: 'buffNextHitStatus', status: 'burn', stacks: 3 }],
          },
        ],
      }),
      [
        c({
          id: 'e0',
          name: 'Puncher',
          maxHp: 300,
          weapons: [{ name: 'Jab', cooldownTicks: 8, damage: 8 }],
        }),
      ],
    ),
  },
  {
    // Biomes 6–10: a Burn-immune enemy (Ember Courtier, Court §4) — the hero applies
    // Burn on hit, which simply never lands, so the DoT never ticks.
    name: 'immune-to-burn',
    seed: 606,
    spec: fight(
      c({
        id: 'hero',
        name: 'Ember Hero',
        weapons: [{ name: 'Brand', cooldownTicks: 10, damage: 10 }],
        effects: [bindOnHit([{ op: 'applyStatus', status: 'burn', stacks: 3, to: 'target' }])],
      }),
      [c({ id: 'e0', name: 'Ember Courtier', maxHp: 220, immuneToStatus: 'burn' })],
    ),
  },
  {
    // Biomes 6–10: a multi-hit enemy (Pressure Wraith, Vault §4) — its swing lands as
    // five rapid sub-hits, leaking through a Ward the hero starts with.
    name: 'enemy-multi-hit-vs-ward',
    seed: 616,
    spec: fight(
      c({
        id: 'hero',
        name: 'Warded Hero',
        startWardPct: 25,
        weapons: [{ name: 'Blade', cooldownTicks: 14, damage: 10 }],
      }),
      [
        c({
          id: 'e0',
          name: 'Pressure Wraith',
          maxHp: 260,
          weapons: [{ name: 'Press', cooldownTicks: 16, damage: 3, hitsPerSwing: 5 }],
        }),
      ],
    ),
  },
];
