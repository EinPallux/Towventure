/**
 * Tag synergies (CONTENT.md §2.2). Each equipped item's tags count toward
 * thresholds at 2 / 4 / 6 across the 8 equip slots; a met threshold grants its
 * mods/effects to the compiled hero (build.ts applies them). Synergies do not
 * scale with ★.
 *
 * Design law (CONTENT §2): no tag's (6) is strictly mandatory — (4) is the build,
 * (6) is a spike. The thresholds expressible with the current effect vocabulary
 * are authored here; those needing new ops (per-weapon-tag speed, Burn/Chill
 * effectiveness, damage-type modifiers, DoT-crit, stealth) are listed in `DEFERRED`
 * and land with those ops. Shadow (4) [next-hit buffer] and Venom (4) [conditional
 * vs-status damage] are now live via the `buffNextHitPct` / `buffDamageVsStatusPct` ops.
 */

import type { ItemEffect, StatMod, Tag } from './types.js';

export const SYNERGY_THRESHOLDS = [2, 4, 6] as const;

export interface Synergy {
  threshold: number;
  /** Passive stat lines granted while the threshold holds. */
  mods?: StatMod[];
  /** Trigger→effect lines granted while the threshold holds. */
  effects?: ItemEffect[];
  /** Human-readable summary (for the build tag meter / tooltips). */
  note: string;
}

export const TAG_SYNERGIES: Record<Tag, Synergy[]> = {
  blade: [
    {
      threshold: 4,
      note: 'Every 3rd weapon hit applies 1 Bleed',
      effects: [
        {
          trigger: { kind: 'OnHit' },
          everyNthHit: 3,
          ops: [{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }],
        },
      ],
    },
  ],
  bulwark: [
    { threshold: 2, note: '+8 Armor', mods: [{ stat: 'armor', value: 8, scales: false }] },
    {
      threshold: 4,
      note: 'On block: gain 2 Ward',
      effects: [{ trigger: { kind: 'OnBlock' }, ops: [{ op: 'gainWard', amount: 2 }] }],
    },
  ],
  ember: [
    {
      threshold: 4,
      note: 'On crit: apply 2 Burn',
      effects: [
        {
          trigger: { kind: 'OnCrit' },
          ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }],
        },
      ],
    },
  ],
  frost: [
    {
      threshold: 4,
      note: 'On applying Chill: 20% to add Shock',
      effects: [
        {
          trigger: { kind: 'OnStatusApplied', status: 'chill' },
          chancePct: 20,
          ops: [{ op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' }],
        },
      ],
    },
  ],
  shadow: [
    { threshold: 2, note: '+6% Dodge', mods: [{ stat: 'dodgePct', value: 6, scales: false }] },
    {
      threshold: 4,
      note: 'On dodge: your next hit deals +40%',
      effects: [
        {
          trigger: { kind: 'OnDodge' },
          ops: [{ op: 'buffNextHitPct', pct: 40 }],
        },
      ],
    },
  ],
  wild: [
    {
      threshold: 2,
      note: '+6% Lifesteal',
      mods: [{ stat: 'lifestealPct', value: 6, scales: false }],
    },
    {
      threshold: 4,
      note: 'On kill: heal 8% max HP',
      effects: [{ trigger: { kind: 'OnEnemyDeath' }, ops: [{ op: 'healPctMax', pct: 8 }] }],
    },
    {
      threshold: 6,
      note: 'Below 50% HP: +20% Speed and +20% damage (once)',
      effects: [
        {
          trigger: { kind: 'OnHpBelow', pct: 50 },
          ops: [
            { op: 'buffSpeedPct', pct: 20 },
            { op: 'buffDamagePct', pct: 20 },
          ],
        },
      ],
    },
  ],
  venom: [
    {
      threshold: 4,
      note: 'Your hits deal +12% vs Venomed enemies',
      // A fight-scoped passive: every weapon hit into a Venomed target gets +12%.
      effects: [
        {
          trigger: { kind: 'OnFightStart' },
          ops: [{ op: 'buffDamageVsStatusPct', status: 'venom', pct: 12 }],
        },
      ],
    },
  ],
  // Authored in CONTENT §2.2 but deferred until their ops exist (see DEFERRED).
  arcane: [],
};

/** Thresholds from CONTENT §2.2 not yet transcribed, and the op each one needs. */
export const DEFERRED: Record<string, string> = {
  'blade(2)': '+8% Speed on Blade weapons — needs per-weapon-tag speed',
  'blade(6)': 'your Bleed can crit — needs DoT-crit',
  'bulwark(6)':
    'blocks reflect 30% of prevented damage as Thorns — needs prevented-damage tracking',
  'arcane(2)': 'Every(Xs) effects 10% faster — needs Every-interval modifier',
  'arcane(4)': 'duplicate the first OnFightStart effect — needs effect duplication',
  'arcane(6)': 'non-weapon effects +25% damage — needs damage-type modifier',
  'ember(2)': '+15% Burn damage — needs status-damage modifier',
  'ember(6)': 'Burn 8+ spreads to other enemies — needs spread op',
  'venom(2)': 'Venom ramps faster — needs per-tag ramp modifier',
  'venom(6)': 'enemy heals 50% less while Venomed — needs heal-reduction',
  'frost(2)': '+15% Chill effectiveness — needs status-effectiveness modifier',
  'frost(6)': 'Chilled enemies take +20% crit damage — needs vs-status CRIT-damage (buffDamageVsStatusPct is flat, not crit-only)',
  'shadow(6)': 'first hit from stealth: guaranteed crit ×2.5 — needs stealth',
};
