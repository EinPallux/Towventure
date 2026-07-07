/**
 * Item catalog — the authored anchor set spanning every rarity and all 6 equip
 * slots, plus the three class relics. Transcribed from CONTENT.md §3 (docs first,
 * then here). Adding an expressible item is content-only: a new entry here + its
 * CONTENT.md row, no engine change (ROADMAP Phase 2 criterion).
 *
 * ★1 lines are always active; Awakened lines (Phase 2, marked `minStar: 3`) activate
 * on fusing to ★3, and Zenith lines (`minStar: 5`) at ★5. The next-hit-buffer,
 * conditional-vs-status-damage, detonate/consume ops and the stack-threshold trigger
 * have since landed — the Sawtooth Dirk's ★5 **Redline** and the Kindlewhip's ★5
 * **Solarlash** are the first live Zenith transforms. Lines whose CONTENT.md text still
 * needs new ops (per-Armor damage, weapon-echo/chain, Burn-spread) stay deferred with a
 * note. `zenithName` is the ★5 display rename. Weapon per-hit damage is derived from
 * rarity power × cooldown in the registry (see deriveWeaponDamage).
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
      // [Zenith ★5 — Redline] Crits consume all Bleed for 150% of its damage (CONTENT
      // §3.1). Fires after the Awakened +2 Bleed above, so a crit tops off then blows
      // the whole stack. The first live Zenith transform.
      {
        trigger: { kind: 'OnCrit' },
        minStar: 5,
        scales: false,
        ops: [{ op: 'detonateStatus', status: 'bleed', pctPerStack: 150, to: 'target' }],
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
      // [Zenith ★5 — Solarlash] At 10+ Burn, detonate it AoE for 200%/stack of its
      // damage (CONTENT §3.1). The 2nd live Zenith, on the new stack-threshold trigger.
      {
        trigger: { kind: 'OnStatusApplied', status: 'burn', minStacks: 10 },
        minStar: 5,
        scales: false,
        ops: [{ op: 'detonateStatus', status: 'burn', pctPerStack: 200, to: 'allEnemies' }],
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
    id: 'apprentice_sparkrod',
    name: 'Apprentice Sparkrod',
    kind: 'weapon',
    rarity: 'common',
    tags: ['arcane'],
    cooldownSeconds: 2.0,
    flavor: 'Buzzes when it disapproves. It disapproves often.',
    zenithName: 'Stormtongue',
    // Every 5s → zap for 120% weapon damage, applies 1 Shock (CONTENT §3.1). The
    // Awakened bounce-to-a-second-enemy line needs a chain op (deferred).
    effects: [
      {
        trigger: { kind: 'Every', seconds: 5 },
        ops: [
          { op: 'damageWeaponPct', pct: 120, to: 'target' },
          { op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' },
        ],
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

  {
    id: 'vipermaw_kris',
    name: 'Vipermaw Kris',
    kind: 'weapon',
    rarity: 'rare',
    tags: ['venom'],
    cooldownSeconds: 1.5,
    flavor: 'It bites once. The rest is patience.',
    zenithName: "Widow's Sermon",
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }] },
      // [Awakened] when Venom is applied, 10% to stack +1 extra (the one-level
      // OnStatusApplied guard stops it cascading). CONTENT §3.1.
      {
        trigger: { kind: 'OnStatusApplied', status: 'venom' },
        minStar: 3,
        chancePct: 10,
        ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }],
      },
      // [Zenith] Widow's Sermon (Venom ramps 2× vs enemies above 50% HP) needs a
      // conditional per-tag ramp modifier — deferred.
    ],
  },
  {
    id: 'twin_moon_saif',
    name: 'Twin Moon Saif',
    kind: 'weapon',
    rarity: 'rare',
    tags: ['blade', 'shadow'],
    cooldownSeconds: 1.6,
    flavor: 'One edge for the moon you see, one for the one you do not.',
    zenithName: 'Eclipse',
    // [★1] OnCrit → an immediate echo-swing at 50% weapon damage. Modelled as a
    // bonus hit; the "once per 2s" throttle and the Zenith echo-of-echo chain need
    // per-effect cooldown + recursive-swing state (deferred).
    effects: [
      {
        trigger: { kind: 'OnCrit' },
        ops: [{ op: 'damageWeaponPct', pct: 50, to: 'target' }],
      },
    ],
    // [Awakened] +10% Crit (CONTENT §3.1).
    mods: [{ stat: 'critChancePct', value: 10, minStar: 3, scales: false }],
  },
  {
    id: 'mothlight_blade',
    name: 'Mothlight Blade',
    kind: 'weapon',
    rarity: 'mythic',
    tags: ['frost', 'shadow'],
    cooldownSeconds: 1.9,
    flavor: 'It is always a little brighter than a moment ago.',
    zenithName: 'The Patient Answer',
    // [★1] Damage scales +2% per second of fight elapsed, no cap (CONTENT §3.1):
    // a per-second self damage-buff. [Zenith] delay-then-400% needs a scheduled
    // first-swing mechanic — deferred.
    effects: [
      { trigger: { kind: 'Every', seconds: 1 }, ops: [{ op: 'buffDamagePct', pct: 2 }], scales: false },
      // [Awakened] OnDoomfall → +40% damage immediately (CONTENT §3.1).
      {
        trigger: { kind: 'OnDoomfall' },
        minStar: 3,
        ops: [{ op: 'buffDamagePct', pct: 40 }],
        scales: false,
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
  {
    id: 'rawhide_hood',
    name: 'Rawhide Hood',
    kind: 'helm',
    rarity: 'common',
    tags: ['shadow'],
    flavor: 'Smells of the road and whoever wore it before.',
    zenithName: "Hunter's Patience",
    // [Awakened] +6 HP (CONTENT §3.2).
    mods: [
      { stat: 'dodgePct', value: 4, scales: false },
      { stat: 'maxHp', value: 6, minStar: 3 },
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
  {
    id: 'verdigris_scale',
    name: 'Verdigris Scale',
    kind: 'armor',
    rarity: 'rare',
    tags: ['venom', 'bulwark'],
    flavor: 'The rot is load-bearing now.',
    zenithName: 'Molt',
    mods: [{ stat: 'armor', value: 8 }],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        chancePct: 30,
        ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'attacker' }],
      },
      // [Awakened] Armor counts +25% vs Venomed enemies — needs a conditional armor
      // modifier (deferred). [Zenith] Molt's cleanse needs a cleanse op (deferred).
    ],
  },
  {
    id: 'aegis_of_the_sleepless',
    name: 'Aegis of the Sleepless',
    kind: 'armor',
    rarity: 'mythic',
    tags: ['bulwark', 'arcane'],
    flavor: 'It has not closed its eye since the Tower opened.',
    zenithName: 'The Dream Refuses',
    // [★1] Start each fight with Ward = 20% Max HP. [Awakened] while Ward holds,
    // +15% damage — needs a ward-conditional modifier (deferred). [Zenith] deferred.
    startWardPct: 20,
  },
  {
    id: 'boiled_leather_vest',
    name: 'Boiled Leather Vest',
    kind: 'armor',
    rarity: 'common',
    tags: ['wild'],
    flavor: 'Boiled once, in a hurry, by someone who lived.',
    zenithName: 'Second Skin',
    // [Awakened] +6 HP (CONTENT §3.2).
    mods: [
      { stat: 'maxHp', value: 12 },
      { stat: 'maxHp', value: 6, minStar: 3 },
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
  {
    id: 'ironshod_sabatons',
    name: 'Ironshod Sabatons',
    kind: 'boots',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'Every step announces itself. Let them come.',
    zenithName: 'Standfast',
    // [Awakened] +3 Armor (CONTENT §3.2).
    mods: [
      { stat: 'armor', value: 4 },
      { stat: 'armor', value: 3, minStar: 3 },
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
  {
    id: 'twin_fang_oath',
    name: 'Twin-Fang Oath',
    kind: 'relic',
    rarity: 'epic',
    tags: ['blade'],
    relicOf: 'duelist',
    flavor: 'Two promises, kept in alternation.',
    zenithName: 'Twin-Fang Oath',
    // CONTENT §1.2: each weapon hit speeds the OTHER weapon +15% for 2s (×3), and a
    // two-hander instead auto-crits every 3rd hit. Modelled here at combatant level
    // as OnHit → Haste (the duelist accelerates as it fights); the per-weapon
    // alternation and the 2-hander auto-crit need per-weapon state + a next-hit-crit
    // op (deferred).
    effects: [
      {
        trigger: { kind: 'OnHit' },
        ops: [{ op: 'applyStatus', status: 'haste', stacks: 3, to: 'self' }],
        scales: false,
      },
    ],
  },
  {
    id: 'cinderheart',
    name: 'Cinderheart',
    kind: 'relic',
    rarity: 'epic',
    tags: ['arcane', 'ember'],
    relicOf: 'arcanist',
    flavor: 'It keeps a spare heartbeat for emergencies.',
    zenithName: 'Cinderheart',
    // CONTENT §1.3: Every 8s recast your most-recent non-weapon effect; status damage
    // +15%. Modelled as a recurring cinder cast (the arcanist's effect throughput);
    // the effect-recast and the status-damage modifier need last-effect tracking + a
    // status-damage op (deferred).
    effects: [
      {
        trigger: { kind: 'Every', seconds: 8 },
        ops: [
          { op: 'damageWeaponPct', pct: 100, to: 'target' },
          { op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' },
        ],
        scales: false,
      },
    ],
  },
];
