/**
 * Item catalog — anchor slice (~17 equippables spanning every rarity and all 6
 * equip slots + the Vanguard relic). Transcribed from CONTENT.md §3.
 *
 * ★1 lines are always active; Awakened lines (Phase 2, marked `minStar: 3` on the
 * mod/effect) activate on fusing to ★3. The Awakened lines that use the current
 * effect vocabulary are transcribed here; a few whose CONTENT.md text needs new
 * ops (per-Armor damage, next-hit buffers, conditional-vs-status damage, Zenith
 * detonate/consume) are deferred until those ops land. `zenithName` is display
 * only until the ★5 transforms ship. Weapon per-hit damage is derived from rarity
 * power × cooldown in the registry (see deriveWeaponDamage).
 */

import type { ItemDef } from './types.js';

export const ITEMS: ItemDef[] = [
  // ── Weapons ────────────────────────────────────────────────────────────────
  {
    id: 'rusty_cleaver',
    name: 'Rusty Cleaver',
    kind: 'weapon',
    rarity: 'common',
    tags: ['blade'],
    cooldownSeconds: 2.2,
    flavor: 'It has chopped worse than you.',
    zenithName: "Butcher's Word",
    // [Awakened] +10% Crit (CONTENT §3.1).
    mods: [{ stat: 'critChancePct', value: 10, minStar: 3, scales: false }],
  },
  {
    id: 'sawtooth_dirk',
    name: 'Sawtooth Dirk',
    kind: 'weapon',
    rarity: 'common',
    tags: ['blade'],
    cooldownSeconds: 1.3,
    flavor: 'The smith who made it filed her teeth to match.',
    zenithName: 'Redline',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        everyNthHit: 3,
        ops: [{ op: 'applyStatus', status: 'bleed', stacks: 2, to: 'target' }],
      },
      // [Awakened] OnCrit → +2 Bleed (CONTENT §3.1).
      {
        trigger: { kind: 'OnCrit' },
        minStar: 3,
        ops: [{ op: 'applyStatus', status: 'bleed', stacks: 2, to: 'target' }],
      },
    ],
  },
  {
    id: 'watchmans_maul',
    name: "Watchman's Maul",
    kind: 'weapon',
    rarity: 'common',
    tags: ['bulwark'],
    cooldownSeconds: 3.4,
    flavor: 'Slow, sure, and never off duty.',
    zenithName: 'Curfew',
    effects: [{ trigger: { kind: 'OnHit' }, ops: [{ op: 'gainArmor', amount: 4 }] }],
  },
  {
    id: 'kindlewhip',
    name: 'Kindlewhip',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['ember'],
    cooldownSeconds: 1.8,
    flavor: 'Lights the room and the room-keeper.',
    zenithName: 'Solarlash',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 40,
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }],
      },
    ],
  },
  {
    id: 'coldsnap_pick',
    name: 'Coldsnap Pick',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['frost'],
    cooldownSeconds: 2.1,
    flavor: 'Miners called the sound it makes "the last tick".',
    zenithName: 'Winterbite',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'fangback_spear',
    name: 'Fangback Spear',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['wild'],
    cooldownSeconds: 2.3,
    flavor: 'It drinks first.',
    zenithName: 'The Long Hunger',
    mods: [{ stat: 'lifestealPct', value: 8 }],
    // [Awakened] OnEnemyDeath → burst of Speed (CONTENT §3.1: +20% Speed 5s,
    // modelled as 4 Haste stacks — the timed +Speed status).
    effects: [
      {
        trigger: { kind: 'OnEnemyDeath' },
        minStar: 3,
        ops: [{ op: 'applyStatus', status: 'haste', stacks: 4, to: 'self' }],
      },
    ],
  },
  {
    id: 'gravediggers_shovel',
    name: "Gravedigger's Shovel",
    kind: 'weapon',
    rarity: 'rare',
    tags: ['bulwark', 'shadow'],
    cooldownSeconds: 2.9,
    flavor: 'Digs in before it digs out.',
    zenithName: 'Eulogy',
    effects: [{ trigger: { kind: 'OnFightStart' }, ops: [{ op: 'gainArmor', amount: 15 }] }],
  },
  {
    id: 'pyrebrand_claymore',
    name: 'Pyrebrand Claymore',
    kind: 'weapon2h',
    rarity: 'epic',
    tags: ['ember', 'blade'],
    cooldownSeconds: 3.1,
    twoHanded: true,
    flavor: 'Two hands, one argument.',
    zenithName: 'The Argument of Ash',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 4, to: 'target' }],
      },
    ],
  },
  {
    id: 'toll_keepers_bell',
    name: "The Toll-Keeper's Bell",
    kind: 'weapon2h',
    rarity: 'mythic',
    tags: ['bulwark', 'arcane'],
    cooldownSeconds: 4.0,
    twoHanded: true,
    flavor: 'Everyone pays. Some pay attention.',
    zenithName: 'Last Toll',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        ops: [
          { op: 'stun', ticks: 6, to: 'target' },
          { op: 'gainArmor', amount: 10 },
        ],
      },
    ],
  },

  // ── Helm ─────────────────────────────────────────────────────────────────
  {
    id: 'dented_pot_helm',
    name: 'Dented Pot-Helm',
    kind: 'helm',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'Kept the stew warm. Keeps you warmer.',
    zenithName: 'The Unbowed',
    // [Awakened] +6 Armor (CONTENT §3.2).
    mods: [
      { stat: 'maxHp', value: 14 },
      { stat: 'armor', value: 6, minStar: 3 },
    ],
  },

  // ── Armor ────────────────────────────────────────────────────────────────
  {
    id: 'hearthplate',
    name: 'Hearthplate',
    kind: 'armor',
    rarity: 'uncommon',
    tags: ['ember', 'bulwark'],
    flavor: 'Home is where the hurt is.',
    zenithName: 'The Standing Fire',
    mods: [{ stat: 'maxHp', value: 20 }],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'attacker' }],
      },
    ],
  },

  // ── Boots ────────────────────────────────────────────────────────────────
  {
    id: 'quickstep_boots',
    name: 'Quickstep Boots',
    kind: 'boots',
    rarity: 'common',
    tags: ['shadow'],
    flavor: 'They remember every exit.',
    zenithName: 'Rumor',
    // [Awakened] +4% Dodge (CONTENT §3.2).
    mods: [
      { stat: 'speedPct', value: 5 },
      { stat: 'dodgePct', value: 4, minStar: 3, scales: false },
    ],
  },

  // ── Trinkets ─────────────────────────────────────────────────────────────
  {
    id: 'singed_grimoire',
    name: 'Singed Grimoire',
    kind: 'trinket',
    rarity: 'common',
    tags: ['arcane', 'ember'],
    flavor: 'Every page is the last page.',
    zenithName: 'Unfinished Chapter',
    effects: [
      {
        trigger: { kind: 'Every', seconds: 7 },
        ops: [
          { op: 'damageWeaponPct', pct: 80, to: 'target' },
          { op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' },
        ],
      },
    ],
  },
  {
    id: 'chime_of_small_mercies',
    name: 'Chime of Small Mercies',
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['frost', 'arcane'],
    flavor: 'It rings when it is already too late to help much.',
    zenithName: 'Kindness, Weaponized',
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        minHitPctMax: 10,
        ops: [{ op: 'applyStatus', status: 'regen', stacks: 3, to: 'self' }],
      },
      // [Awakened] also 1 Chill on the attacker (CONTENT §3.3).
      {
        trigger: { kind: 'OnHurt' },
        minStar: 3,
        minHitPctMax: 10,
        ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'attacker' }],
      },
    ],
  },
  {
    id: 'tax_stamp_of_the_gate',
    name: 'Tax-Stamp of the Gate',
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['bulwark'],
    flavor: 'Officially, you owe it your gratitude.',
    zenithName: 'Seal of the Auditor',
    goldPerWin: 3,
  },
  {
    id: 'moth_eaten_standard',
    name: 'Moth-Eaten Standard',
    kind: 'trinket',
    rarity: 'rare',
    tags: ['wild', 'bulwark'],
    flavor: 'The war is over. Nobody told it.',
    zenithName: 'The Banner Still',
    effects: [
      { trigger: { kind: 'OnHpBelow', pct: 50 }, ops: [{ op: 'buffDamagePct', pct: 15 }] },
      // [Awakened] the rally also grants 10 Armor (CONTENT §3.3).
      {
        trigger: { kind: 'OnHpBelow', pct: 50 },
        minStar: 3,
        ops: [{ op: 'gainArmor', amount: 10 }],
      },
    ],
  },

  // ── Relic (Vanguard; never drops) ────────────────────────────────────────
  {
    id: 'bulwark_sigil',
    name: 'Bulwark Sigil',
    kind: 'relic',
    rarity: 'epic',
    tags: ['bulwark'],
    relicOf: 'vanguard',
    flavor: 'The wall remembers every blow it turned.',
    zenithName: 'Bulwark Sigil',
    effects: [
      // Every 4th weapon hit grants 6 Armor (fight-scoped, stacks).
      {
        trigger: { kind: 'OnHit' },
        everyNthHit: 4,
        ops: [{ op: 'gainArmor', amount: 6 }],
        scales: false,
      },
      // OnBlock → 15% to retaliate for Thorns ×3.
      {
        trigger: { kind: 'OnBlock' },
        chancePct: 15,
        ops: [{ op: 'retaliateThorns', mult: 3 }],
        scales: false,
      },
    ],
  },
];
