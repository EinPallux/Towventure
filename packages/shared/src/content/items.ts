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

  {
    id: 'choir_of_nails',
    name: 'Choir of Nails',
    kind: 'weapon',
    rarity: 'epic',
    tags: ['shadow', 'arcane'],
    cooldownSeconds: 1.2,
    weaponDamage: 6,
    hitsPerSwing: 3,
    flavor: 'It sings in threes, and always the same note.',
    zenithName: 'Congregation',
    // Strikes 3× per swing; [Awakened] each nail 10% → 1 Bleed + 1 Shock (CONTENT §3.1).
    effects: [
      {
        trigger: { kind: 'OnHit' },
        minStar: 3,
        chancePct: 10,
        ops: [
          { op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' },
          { op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' },
        ],
      },
    ],
  },
  {
    id: 'lantern_hook',
    name: 'Lantern-Hook',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['ember', 'shadow'],
    cooldownSeconds: 2.4,
    flavor: 'It fishes for the warm parts.',
    zenithName: 'Trawler',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 30,
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }],
      },
      // [Awakened] OnDodge → the next hook also lands +3 Burn (CONTENT §3.1).
      {
        trigger: { kind: 'OnDodge' },
        minStar: 3,
        ops: [{ op: 'buffNextHitStatus', status: 'burn', stacks: 3 }],
      },
    ],
  },
  {
    id: 'bronze_shortsword',
    name: 'Bronze Shortsword',
    kind: 'weapon',
    rarity: 'common',
    tags: ['blade'],
    cooldownSeconds: 1.6,
    flavor: 'Older than iron, and it knows it.',
    zenithName: 'Green Edge',
    mods: [{ stat: 'critChancePct', value: 5, minStar: 3, scales: false }],
  },
  {
    id: 'notched_hatchet',
    name: 'Notched Hatchet',
    kind: 'weapon',
    rarity: 'common',
    tags: ['blade'],
    cooldownSeconds: 1.5,
    flavor: 'Every notch was a promise kept.',
    zenithName: 'Kindling Split',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 20,
        ops: [{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'tollhouse_mace',
    name: 'Tollhouse Mace',
    kind: 'weapon',
    rarity: 'common',
    tags: ['bulwark'],
    cooldownSeconds: 2.6,
    flavor: 'Persuasion, by the pound.',
    zenithName: 'Assessment',
    effects: [{ trigger: { kind: 'OnHit' }, ops: [{ op: 'gainArmor', amount: 3 }] }],
  },
  {
    id: 'frost_needle',
    name: 'Frost Needle',
    kind: 'weapon',
    rarity: 'common',
    tags: ['frost'],
    cooldownSeconds: 1.4,
    flavor: 'One cold stitch at a time.',
    zenithName: 'Long Winter',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 25,
        ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'venom_lash',
    name: 'Venom-Lash',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['venom'],
    cooldownSeconds: 1.7,
    flavor: 'It only ever needs to land once.',
    zenithName: 'Patient Coil',
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }] },
    ],
  },
  {
    id: 'thornvine_flail',
    name: 'Thornvine Flail',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['wild'],
    cooldownSeconds: 2.0,
    flavor: 'It drinks what it spills.',
    zenithName: 'The Greedy Green',
    mods: [{ stat: 'lifestealPct', value: 6 }],
  },
  {
    id: 'emberbrand',
    name: 'Emberbrand',
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['ember'],
    cooldownSeconds: 1.9,
    flavor: 'Struck once, warm for a week.',
    zenithName: 'Everburn',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 35,
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'duelists_rapier',
    name: "Duelist's Rapier",
    kind: 'weapon',
    rarity: 'uncommon',
    tags: ['blade', 'shadow'],
    cooldownSeconds: 1.3,
    flavor: 'Elegant. Impatient. Fatal in that order.',
    zenithName: 'First Blood',
    mods: [
      { stat: 'critChancePct', value: 8 },
      { stat: 'critDamagePct', value: 15, minStar: 3 },
    ],
  },
  {
    id: 'glass_dagger',
    name: 'Glass Dagger',
    kind: 'weapon',
    rarity: 'rare',
    tags: ['blade', 'shadow'],
    cooldownSeconds: 1.1,
    flavor: 'It will not survive the fight. Neither will they.',
    zenithName: 'The Only Cut',
    mods: [{ stat: 'critDamagePct', value: 40 }],
    effects: [
      {
        trigger: { kind: 'OnCrit' },
        ops: [{ op: 'applyStatus', status: 'bleed', stacks: 2, to: 'target' }],
      },
    ],
  },
  {
    id: 'stormcaller_rod',
    name: 'Stormcaller Rod',
    kind: 'weapon',
    rarity: 'rare',
    tags: ['arcane'],
    cooldownSeconds: 2.2,
    flavor: 'It disagrees with the whole room at once.',
    zenithName: 'Quorum',
    effects: [
      {
        trigger: { kind: 'Every', seconds: 5 },
        ops: [{ op: 'chainHit', pct: 55, targets: 3 }],
      },
    ],
  },
  {
    id: 'warden_pike',
    name: 'Warden Pike',
    kind: 'weapon',
    rarity: 'rare',
    tags: ['bulwark'],
    cooldownSeconds: 2.8,
    flavor: 'The line holds where it stands.',
    zenithName: 'The Held Line',
    mods: [{ stat: 'armor', value: 4 }],
    effects: [{ trigger: { kind: 'OnBlock' }, ops: [{ op: 'gainWard', amount: 4 }] }],
  },
  {
    id: 'sundering_maul',
    name: 'Sundering Maul',
    kind: 'weapon',
    rarity: 'rare',
    tags: ['bulwark'],
    cooldownSeconds: 3.0,
    flavor: 'Armor is a suggestion it declines.',
    zenithName: 'The Iron Argument',
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'sunder', stacks: 1, to: 'target' }] },
    ],
  },
  {
    id: 'reapers_scythe',
    name: "Reaper's Scythe",
    kind: 'weapon2h',
    rarity: 'epic',
    tags: ['wild', 'shadow'],
    cooldownSeconds: 2.7,
    twoHanded: true,
    flavor: 'It keeps the harvest, not the harvester.',
    zenithName: 'The Last Field',
    mods: [{ stat: 'lifestealPct', value: 6 }],
    effects: [
      { trigger: { kind: 'OnEnemyDeath' }, ops: [{ op: 'buffDamagePct', pct: 12 }] },
    ],
  },
  {
    id: 'avalanche_hammer',
    name: 'Avalanche Hammer',
    kind: 'weapon2h',
    rarity: 'epic',
    tags: ['frost', 'bulwark'],
    cooldownSeconds: 3.3,
    twoHanded: true,
    flavor: 'Slow to start. Impossible to stop.',
    zenithName: 'Whiteout',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        ops: [
          { op: 'applyStatus', status: 'chill', stacks: 2, to: 'target' },
          { op: 'applyStatus', status: 'sunder', stacks: 1, to: 'target' },
        ],
      },
    ],
  },
  {
    id: 'heartpiercer',
    name: 'Heartpiercer',
    kind: 'weapon',
    rarity: 'mythic',
    tags: ['blade'],
    cooldownSeconds: 1.4,
    flavor: 'It has only ever missed on purpose.',
    zenithName: 'The Kept Promise',
    mods: [{ stat: 'critChancePct', value: 12 }],
    effects: [
      {
        trigger: { kind: 'OnCrit' },
        ops: [{ op: 'detonateStatus', status: 'bleed', pctPerStack: 120, to: 'target' }],
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
  {
    id: 'iron_kettle_helm',
    name: 'Iron Kettle-Helm',
    kind: 'helm',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'Dented in a shape that fits your particular worries.',
    zenithName: 'The Sealed Lid',
    mods: [
      { stat: 'armor', value: 4 },
      { stat: 'maxHp', value: 6, minStar: 3 },
    ],
  },
  {
    id: 'scholars_circlet',
    name: "Scholar's Circlet",
    kind: 'helm',
    rarity: 'uncommon',
    tags: ['arcane'],
    flavor: 'Heavy with everything it refuses to forget.',
    zenithName: 'Tenure',
    mods: [
      { stat: 'maxHp', value: 10 },
      { stat: 'critChancePct', value: 4, minStar: 3, scales: false },
    ],
  },
  {
    id: 'horned_casque',
    name: 'Horned Casque',
    kind: 'helm',
    rarity: 'uncommon',
    tags: ['bulwark', 'wild'],
    flavor: 'The horns were a later, angrier idea.',
    zenithName: 'The Goring',
    mods: [
      { stat: 'maxHp', value: 12 },
      { stat: 'thorns', value: 2 },
    ],
  },
  {
    id: 'frostglass_visor',
    name: 'Frostglass Visor',
    kind: 'helm',
    rarity: 'uncommon',
    tags: ['frost'],
    flavor: 'The world through it is very calm and very cold.',
    zenithName: 'The Clear Cold',
    mods: [{ stat: 'maxHp', value: 14 }],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        chancePct: 25,
        ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'attacker' }],
      },
    ],
  },
  {
    id: 'emberplate_helm',
    name: 'Emberplate Helm',
    kind: 'helm',
    rarity: 'uncommon',
    tags: ['ember', 'bulwark'],
    flavor: 'Warm enough to shave by, if you dared.',
    zenithName: 'The Banked Coal',
    mods: [
      { stat: 'maxHp', value: 12 },
      { stat: 'armor', value: 3, minStar: 3 },
    ],
  },
  {
    id: 'owl_eyed_sallet',
    name: 'Owl-Eyed Sallet',
    kind: 'helm',
    rarity: 'rare',
    tags: ['arcane'],
    flavor: 'It sees the next thing before you have finished the last.',
    zenithName: 'Midnight Faculty',
    // CONTENT §3.2: "your Every(Xs) effects run 12% faster" needs an Every-interval
    // modifier op (deferred); shipped as an arcane throughput stat until it lands.
    mods: [
      { stat: 'maxHp', value: 12 },
      { stat: 'speedPct', value: 4, minStar: 3 },
    ],
  },
  {
    id: 'crown_of_small_thorns',
    name: 'Crown of Small Thorns',
    kind: 'helm',
    rarity: 'rare',
    tags: ['wild'],
    flavor: 'Uneasy, and sharp about it.',
    zenithName: 'The Circlet Bites',
    mods: [
      { stat: 'thorns', value: 4 },
      { stat: 'maxHp', value: 10 },
    ],
  },
  {
    id: 'mindspike_diadem',
    name: 'Mindspike Diadem',
    kind: 'helm',
    rarity: 'rare',
    tags: ['arcane', 'shadow'],
    flavor: 'A thought you cannot put down.',
    zenithName: 'The Fixed Idea',
    mods: [
      { stat: 'critChancePct', value: 6 },
      { stat: 'critDamagePct', value: 20, minStar: 3 },
    ],
  },
  {
    id: 'warlords_greathelm',
    name: "Warlord's Greathelm",
    kind: 'helm',
    rarity: 'epic',
    tags: ['bulwark'],
    flavor: 'Everyone it belonged to won, once.',
    zenithName: 'The Unlosing',
    mods: [
      { stat: 'maxHp', value: 24 },
      { stat: 'armor', value: 6 },
    ],
  },
  {
    id: 'veil_of_the_unseen',
    name: 'Veil of the Unseen',
    kind: 'helm',
    rarity: 'epic',
    tags: ['shadow'],
    flavor: 'They will remember a draft, and nothing else.',
    zenithName: 'The Forgotten Face',
    mods: [
      { stat: 'dodgePct', value: 8, scales: false },
      { stat: 'critChancePct', value: 6, minStar: 3 },
    ],
  },
  {
    id: 'the_sleepless_eye',
    name: 'The Sleepless Eye',
    kind: 'helm',
    rarity: 'mythic',
    tags: ['arcane', 'bulwark'],
    flavor: 'It watched the Tower go up. It has notes.',
    zenithName: 'The Long Watch',
    mods: [{ stat: 'maxHp', value: 20 }],
    effects: [
      { trigger: { kind: 'OnFightStart' }, ops: [{ op: 'gainWardPctMax', pct: 12 }] },
    ],
  },
  {
    id: 'brimmed_traveler_hat',
    name: "Brimmed Traveler's Hat",
    kind: 'helm',
    rarity: 'uncommon',
    tags: ['shadow', 'wild'],
    flavor: 'Keeps the lanternlight out of your eyes and your plans off your face.',
    zenithName: 'The Low Brim',
    mods: [
      { stat: 'dodgePct', value: 4, scales: false },
      { stat: 'speedPct', value: 4, minStar: 3 },
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
  {
    id: 'quilted_jerkin',
    name: 'Quilted Jerkin',
    kind: 'armor',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'Someone stitched it slowly, thinking of you generally.',
    zenithName: 'The Careful Stitch',
    mods: [
      { stat: 'maxHp', value: 10 },
      { stat: 'armor', value: 2, minStar: 3 },
    ],
  },
  {
    id: 'padded_vest',
    name: 'Padded Vest',
    kind: 'armor',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'It has stopped one knife it will never tell you about.',
    zenithName: 'The Quiet Save',
    mods: [{ stat: 'armor', value: 5 }],
  },
  {
    id: 'hide_wrap',
    name: 'Hide Wrap',
    kind: 'armor',
    rarity: 'common',
    tags: ['wild'],
    flavor: 'Still faintly of the thing it used to keep warm.',
    zenithName: 'Second Pelt',
    mods: [
      { stat: 'maxHp', value: 8 },
      { stat: 'lifestealPct', value: 2, minStar: 3, scales: false },
    ],
  },
  {
    id: 'chainmail_shirt',
    name: 'Chainmail Shirt',
    kind: 'armor',
    rarity: 'uncommon',
    tags: ['bulwark'],
    flavor: 'A thousand small agreements to hold together.',
    zenithName: 'Consensus',
    mods: [
      { stat: 'armor', value: 6 },
      { stat: 'maxHp', value: 8, minStar: 3 },
    ],
  },
  {
    id: 'thornmail',
    name: 'Thornmail',
    kind: 'armor',
    rarity: 'uncommon',
    tags: ['wild', 'bulwark'],
    flavor: 'Hugging it is its own answer.',
    zenithName: 'The Returned Favor',
    mods: [
      { stat: 'armor', value: 4 },
      { stat: 'thorns', value: 3 },
    ],
  },
  {
    id: 'warm_gambeson',
    name: 'Warm Gambeson',
    kind: 'armor',
    rarity: 'uncommon',
    tags: ['ember', 'bulwark'],
    flavor: 'Runs hot. Complains about the cold on your behalf.',
    zenithName: 'The Kept Hearth',
    mods: [{ stat: 'maxHp', value: 18 }],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        chancePct: 25,
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 1, to: 'attacker' }],
      },
    ],
  },
  {
    id: 'spellwoven_robe',
    name: 'Spellwoven Robe',
    kind: 'armor',
    rarity: 'rare',
    tags: ['arcane'],
    flavor: 'Woven on a loom that argued back.',
    zenithName: 'The Argued Cloth',
    mods: [{ stat: 'maxHp', value: 14 }],
    effects: [{ trigger: { kind: 'OnFightStart' }, ops: [{ op: 'gainWardPctMax', pct: 10 }] }],
  },
  {
    id: 'bramblehide',
    name: 'Bramblehide',
    kind: 'armor',
    rarity: 'rare',
    tags: ['wild', 'venom'],
    flavor: 'It grew back wrong, in your favor.',
    zenithName: 'The Second Growth',
    mods: [{ stat: 'armor', value: 6 }],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        chancePct: 35,
        ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'attacker' }],
      },
    ],
  },
  {
    id: 'dragonscale_hauberk',
    name: 'Dragonscale Hauberk',
    kind: 'armor',
    rarity: 'epic',
    tags: ['ember', 'bulwark'],
    flavor: 'The dragon is fine. It sheds, is all.',
    zenithName: 'The Molt Eternal',
    mods: [
      { stat: 'maxHp', value: 22 },
      { stat: 'armor', value: 5 },
    ],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'attacker' }],
      },
    ],
  },
  {
    id: 'shadowsilk_shroud',
    name: 'Shadowsilk Shroud',
    kind: 'armor',
    rarity: 'epic',
    tags: ['shadow'],
    flavor: 'It fits whoever is not quite there.',
    zenithName: 'The Absent Guest',
    mods: [{ stat: 'dodgePct', value: 10, scales: false }],
    effects: [{ trigger: { kind: 'OnDodge' }, ops: [{ op: 'buffNextHitPct', pct: 25 }] }],
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
  {
    id: 'worn_traveling_boots',
    name: 'Worn Traveling Boots',
    kind: 'boots',
    rarity: 'common',
    tags: ['wild'],
    flavor: 'They know the way better than you do.',
    zenithName: 'The Long Habit',
    mods: [
      { stat: 'speedPct', value: 4 },
      { stat: 'maxHp', value: 6, minStar: 3 },
    ],
  },
  {
    id: 'hobnail_boots',
    name: 'Hobnail Boots',
    kind: 'boots',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'You hear yourself coming. So does everyone.',
    zenithName: 'The Announced Arrival',
    mods: [
      { stat: 'armor', value: 3 },
      { stat: 'thorns', value: 1, minStar: 3 },
    ],
  },
  {
    id: 'swift_striders',
    name: 'Swift Striders',
    kind: 'boots',
    rarity: 'uncommon',
    tags: ['shadow'],
    flavor: 'Gone before the sentence finishes.',
    zenithName: 'The Unfinished',
    mods: [
      { stat: 'speedPct', value: 7 },
      { stat: 'dodgePct', value: 3, minStar: 3, scales: false },
    ],
  },
  {
    id: 'padded_greaves',
    name: 'Padded Greaves',
    kind: 'boots',
    rarity: 'uncommon',
    tags: ['bulwark'],
    flavor: 'Slow, but you arrive intact.',
    zenithName: 'The Whole Arrival',
    mods: [
      { stat: 'armor', value: 4 },
      { stat: 'maxHp', value: 10 },
    ],
  },
  {
    id: 'windstep_shoes',
    name: 'Windstep Shoes',
    kind: 'boots',
    rarity: 'uncommon',
    tags: ['arcane'],
    flavor: 'They borrow a little from every draft.',
    zenithName: 'The Borrowed Gust',
    mods: [{ stat: 'speedPct', value: 9 }],
  },
  {
    id: 'stalkers_treads',
    name: "Stalker's Treads",
    kind: 'boots',
    rarity: 'uncommon',
    tags: ['shadow', 'wild'],
    flavor: 'The floor forgets it was stepped on.',
    zenithName: 'The Unmarked Path',
    mods: [
      { stat: 'dodgePct', value: 6, scales: false },
      { stat: 'lifestealPct', value: 3, minStar: 3, scales: false },
    ],
  },
  {
    id: 'greaves_of_the_late_guest',
    name: 'Greaves of the Late Guest',
    kind: 'boots',
    rarity: 'rare',
    tags: ['shadow', 'wild'],
    flavor: 'It always arrives just after the danger has looked away.',
    zenithName: 'Never Quite There',
    // CONTENT §3.2: the "25% Dodge for 4s" opener needs a timed dodge buff (deferred);
    // shipped as flat Dodge plus an OnDodge next-hit spike until it lands.
    mods: [{ stat: 'dodgePct', value: 7, scales: false }],
    effects: [{ trigger: { kind: 'OnDodge' }, ops: [{ op: 'buffNextHitPct', pct: 20 }] }],
  },
  {
    id: 'sevenleague_boots',
    name: 'Sevenleague Boots',
    kind: 'boots',
    rarity: 'rare',
    tags: ['wild', 'arcane'],
    flavor: 'The floor between here and there is a formality.',
    zenithName: 'The Skipped Distance',
    mods: [{ stat: 'speedPct', value: 14 }],
  },
  {
    id: 'ironclad_sabatons',
    name: 'Ironclad Sabatons',
    kind: 'boots',
    rarity: 'rare',
    tags: ['bulwark'],
    flavor: 'Planted. Rooted. Immovable, mostly.',
    zenithName: 'The Deep Root',
    mods: [
      { stat: 'armor', value: 7 },
      { stat: 'maxHp', value: 8, minStar: 3 },
    ],
  },
  {
    id: 'stormchaser_boots',
    name: 'Stormchaser Boots',
    kind: 'boots',
    rarity: 'epic',
    tags: ['arcane', 'shadow'],
    flavor: 'They run toward the weather, laughing.',
    zenithName: 'The Glad Storm',
    mods: [{ stat: 'speedPct', value: 12 }],
    effects: [{ trigger: { kind: 'OnDodge' }, ops: [{ op: 'buffSpeedPct', pct: 8 }] }],
  },
  {
    id: 'duelists_dancers',
    name: "Duelist's Dancers",
    kind: 'boots',
    rarity: 'epic',
    tags: ['blade', 'shadow'],
    flavor: 'The footwork is the fight.',
    zenithName: 'The Closing Step',
    mods: [
      { stat: 'speedPct', value: 8 },
      { stat: 'critChancePct', value: 6 },
    ],
  },
  {
    id: 'the_long_way_down',
    name: 'The Long Way Down',
    kind: 'boots',
    rarity: 'mythic',
    tags: ['shadow'],
    flavor: 'Every step is the last one, until it is not.',
    zenithName: 'The Kept Footing',
    mods: [{ stat: 'dodgePct', value: 9, scales: false }],
    effects: [
      { trigger: { kind: 'OnHpBelow', pct: 40 }, ops: [{ op: 'buffSpeedPct', pct: 25 }] },
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
  {
    id: 'lucky_copper',
    name: 'Lucky Copper',
    kind: 'trinket',
    rarity: 'common',
    tags: ['bulwark'],
    flavor: 'Kept for luck it has never once provided.',
    zenithName: 'The Turned Coin',
    goldPerWin: 2,
  },
  {
    id: 'whetstone_charm',
    name: 'Whetstone Charm',
    kind: 'trinket',
    rarity: 'common',
    tags: ['blade'],
    flavor: 'A small stone that insists on sharpness.',
    zenithName: 'The Keen Edge',
    effects: [
      {
        trigger: { kind: 'OnCrit' },
        ops: [{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'warm_locket',
    name: 'Warm Locket',
    kind: 'trinket',
    rarity: 'common',
    tags: ['ember'],
    flavor: 'Whoever is inside it runs a little hot.',
    zenithName: 'The Kept Warmth',
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        minHitPctMax: 10,
        ops: [{ op: 'applyStatus', status: 'regen', stacks: 2, to: 'self' }],
      },
    ],
  },
  {
    id: 'frost_bell',
    name: 'Frost Bell',
    kind: 'trinket',
    rarity: 'common',
    tags: ['frost'],
    flavor: 'It rings once, and the room forgets to be warm.',
    zenithName: 'The First Chill',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 15,
        ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'venom_vial_charm',
    name: 'Venom-Vial Charm',
    kind: 'trinket',
    rarity: 'common',
    tags: ['venom'],
    flavor: 'Corked, mostly.',
    zenithName: 'The Slow Drip',
    effects: [
      {
        trigger: { kind: 'OnHit' },
        chancePct: 15,
        ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'thorn_pendant',
    name: 'Thorn Pendant',
    kind: 'trinket',
    rarity: 'common',
    tags: ['wild'],
    flavor: 'It bites the hand that wears it, gently, as a reminder.',
    zenithName: 'The Small Reprisal',
    mods: [{ stat: 'thorns', value: 3 }],
  },
  {
    id: 'spark_bauble',
    name: 'Spark Bauble',
    kind: 'trinket',
    rarity: 'common',
    tags: ['arcane'],
    flavor: 'It has a thought roughly every eight seconds.',
    zenithName: 'The Idle Charge',
    effects: [
      { trigger: { kind: 'Every', seconds: 8 }, ops: [{ op: 'damageWeaponPct', pct: 60, to: 'target' }] },
    ],
  },
  {
    id: 'butchers_ledger',
    name: "Butcher's Ledger",
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['blade'],
    flavor: 'Every entry is a name it did not bother to learn.',
    zenithName: 'Debts Collected',
    // CONTENT §3.3: "+1% weapon damage per kill this run (cap +25%)" needs run-scoped
    // permanent stacking (deferred); shipped fight-scoped: each kill hardens your blows.
    effects: [
      { trigger: { kind: 'OnEnemyDeath' }, ops: [{ op: 'buffDamagePct', pct: 6 }] },
    ],
  },
  {
    id: 'adrenaline_locket',
    name: 'Adrenaline Locket',
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['wild'],
    flavor: 'It opens on its own when things go badly.',
    zenithName: 'The Second Wind',
    effects: [
      { trigger: { kind: 'OnHpBelow', pct: 50 }, ops: [{ op: 'applyStatus', status: 'haste', stacks: 4, to: 'self' }] },
    ],
  },
  {
    id: 'emberheart_charm',
    name: 'Emberheart Charm',
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['ember'],
    flavor: 'It only truly wakes on a good hit.',
    zenithName: 'The Struck Match',
    effects: [
      { trigger: { kind: 'OnCrit' }, ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }] },
    ],
  },
  {
    id: 'frostbite_totem',
    name: 'Frostbite Totem',
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['frost', 'arcane'],
    flavor: 'It keeps the cold on retainer.',
    zenithName: 'The Deep Freeze',
    effects: [
      {
        trigger: { kind: 'OnStatusApplied', status: 'chill' },
        chancePct: 20,
        ops: [{ op: 'applyStatus', status: 'shock', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'serpents_eye',
    name: "Serpent's Eye",
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['venom'],
    flavor: 'It blinks, once, when the venom takes.',
    zenithName: 'The Patient Gaze',
    effects: [
      {
        trigger: { kind: 'OnFightStart' },
        ops: [{ op: 'buffDamageVsStatusPct', status: 'venom', pct: 12 }],
      },
    ],
  },
  {
    id: 'gamblers_die',
    name: "Gambler's Die",
    kind: 'trinket',
    rarity: 'uncommon',
    tags: ['shadow'],
    flavor: 'It has never once come up the same twice.',
    zenithName: 'The Weighted Throw',
    mods: [
      { stat: 'critChancePct', value: 7 },
      { stat: 'critDamagePct', value: 20, minStar: 3 },
    ],
  },
  {
    id: 'cracked_hourglass',
    name: 'Cracked Hourglass',
    kind: 'trinket',
    rarity: 'rare',
    tags: ['arcane'],
    flavor: 'The sand goes back up when it thinks you are not looking.',
    zenithName: 'The Undecided Hour',
    // CONTENT §3.3: the death-rewind needs a rewind op (deferred); shipped as a
    // low-HP emergency Ward + heal (a small stay of execution) until it lands.
    effects: [
      {
        trigger: { kind: 'OnHpBelow', pct: 30 },
        ops: [
          { op: 'gainWardPctMax', pct: 20 },
          { op: 'healPctMax', pct: 10 },
        ],
      },
    ],
  },
  {
    id: 'the_wrong_key',
    name: 'The Wrong Key',
    kind: 'trinket',
    rarity: 'rare',
    tags: ['shadow'],
    flavor: 'It opens something. Never the thing you meant.',
    zenithName: 'It Fits Everything',
    // CONTENT §3.3: "steal an enemy trigger" needs trigger-theft (deferred); shipped
    // as an opening burst of Ward and evasion until it lands.
    mods: [{ stat: 'dodgePct', value: 5, scales: false }],
    effects: [{ trigger: { kind: 'OnFightStart' }, ops: [{ op: 'gainWardPctMax', pct: 8 }] }],
  },
  {
    id: 'blooddebt_seal',
    name: 'Blood-Debt Seal',
    kind: 'trinket',
    rarity: 'rare',
    tags: ['blade', 'wild'],
    flavor: 'It collects in the only currency the Tower accepts.',
    zenithName: 'The Paid Account',
    mods: [{ stat: 'lifestealPct', value: 5 }],
    effects: [
      { trigger: { kind: 'OnCrit' }, ops: [{ op: 'applyStatus', status: 'bleed', stacks: 2, to: 'target' }] },
    ],
  },
  {
    id: 'stormcell_battery',
    name: 'Stormcell Battery',
    kind: 'trinket',
    rarity: 'rare',
    tags: ['arcane'],
    flavor: 'It holds a grudge with a charge.',
    zenithName: 'The Overload',
    effects: [
      { trigger: { kind: 'Every', seconds: 6 }, ops: [{ op: 'chainHit', pct: 50, targets: 3 }] },
    ],
  },
  {
    id: 'wardstone',
    name: 'Wardstone',
    kind: 'trinket',
    rarity: 'rare',
    tags: ['bulwark'],
    flavor: 'It hums when it turns a blow, which is often.',
    zenithName: 'The Standing Ward',
    effects: [
      { trigger: { kind: 'OnBlock' }, ops: [{ op: 'gainWard', amount: 4 }] },
    ],
  },
  {
    id: 'venomancers_locket',
    name: "Venomancer's Locket",
    kind: 'trinket',
    rarity: 'rare',
    tags: ['venom', 'arcane'],
    flavor: 'It keeps the good stuff for special occasions. Every occasion.',
    zenithName: 'The Cultivated Dose',
    effects: [
      {
        trigger: { kind: 'OnStatusApplied', status: 'venom' },
        chancePct: 15,
        ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }],
      },
    ],
  },
  {
    id: 'gluttons_fork',
    name: "Glutton's Fork",
    kind: 'trinket',
    rarity: 'epic',
    tags: ['wild'],
    flavor: 'It has never once been set down clean.',
    zenithName: 'Second Helpings',
    // CONTENT §3.3: "+6% Max HP per kill this run" needs run-scoped stacking (deferred);
    // shipped as a heal-and-empower on each kill until it lands.
    effects: [
      {
        trigger: { kind: 'OnEnemyDeath' },
        ops: [
          { op: 'healPctMax', pct: 6 },
          { op: 'buffDamagePct', pct: 5 },
        ],
      },
    ],
  },
  {
    id: 'cartographers_regret',
    name: "The Cartographer's Regret",
    kind: 'trinket',
    rarity: 'epic',
    tags: ['shadow', 'arcane'],
    flavor: 'Every door it drew turned out to be a wall.',
    zenithName: 'Where It All Went Wrong',
    // CONTENT §3.3: door-reveal is a run/UI feature (deferred); shipped as an opening
    // ward + tempo edge (foresight, mechanically) until it lands.
    mods: [{ stat: 'speedPct', value: 5 }],
    effects: [{ trigger: { kind: 'OnFightStart' }, ops: [{ op: 'gainWardPctMax', pct: 10 }] }],
  },
  {
    id: 'pyre_idol',
    name: 'Pyre Idol',
    kind: 'trinket',
    rarity: 'epic',
    tags: ['ember', 'arcane'],
    flavor: 'It asks for kindling. It is not picky about the source.',
    zenithName: 'The Fed Fire',
    effects: [
      {
        trigger: { kind: 'OnFightStart' },
        ops: [{ op: 'buffStatusDamagePct', status: 'burn', pct: 20 }],
      },
      {
        trigger: { kind: 'Every', seconds: 6 },
        ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }],
      },
    ],
  },
  {
    id: 'mirror_of_spite',
    name: 'Mirror of Spite',
    kind: 'trinket',
    rarity: 'epic',
    tags: ['shadow', 'bulwark'],
    flavor: 'It keeps every slight, and the interest on each.',
    zenithName: 'The Long Grudge',
    mods: [{ stat: 'thorns', value: 4 }],
    effects: [
      {
        trigger: { kind: 'OnHurt' },
        minHitPctMax: 8,
        ops: [{ op: 'damageWeaponPct', pct: 80, to: 'attacker' }],
      },
    ],
  },
  {
    id: 'crown_of_the_greedy',
    name: 'Crown of the Greedy',
    kind: 'trinket',
    rarity: 'epic',
    tags: ['bulwark'],
    flavor: 'Worn by everyone who thought the Tower could be bought.',
    zenithName: 'The Priced Crown',
    goldPerWin: 6,
    mods: [{ stat: 'maxHp', value: 10 }],
  },
  {
    id: 'tidecaller_conch',
    name: 'Tidecaller Conch',
    kind: 'trinket',
    rarity: 'epic',
    tags: ['frost', 'arcane'],
    flavor: 'Hold it to your ear and the whole room goes cold.',
    zenithName: 'The Turning Tide',
    effects: [
      {
        trigger: { kind: 'Every', seconds: 5 },
        ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'allEnemies' }],
      },
    ],
  },
  {
    id: 'pale_candle',
    name: 'Pale Candle',
    kind: 'trinket',
    rarity: 'mythic',
    tags: ['shadow', 'frost'],
    flavor: 'It burns for your Echo, and only a little for you.',
    zenithName: 'Vigil',
    // CONTENT §3.3: the Echo bonuses need the Echo system (deferred); the "+all stats"
    // half is shipped now as a broad statline.
    mods: [
      { stat: 'critChancePct', value: 6 },
      { stat: 'dodgePct', value: 5, scales: false },
      { stat: 'speedPct', value: 6 },
    ],
  },
  {
    id: 'the_sleepless_crown',
    name: 'The Sleepless Crown',
    kind: 'trinket',
    rarity: 'mythic',
    tags: ['arcane', 'bulwark'],
    flavor: 'The Tower gives it once, to whoever reaches the top the first time.',
    zenithName: 'Insomnia',
    // CONTENT §3.3: "replay your last 2s of damage" needs a damage-log replay op
    // (deferred); shipped as a recurring surge until it lands.
    effects: [
      {
        trigger: { kind: 'Every', seconds: 10 },
        ops: [{ op: 'damageWeaponPct', pct: 220, to: 'target' }],
      },
    ],
  },
  {
    id: 'the_hungering_coin',
    name: 'The Hungering Coin',
    kind: 'trinket',
    rarity: 'mythic',
    tags: ['wild', 'bulwark'],
    flavor: 'It spends you, a little, every time you spend it.',
    zenithName: 'The Last Purchase',
    goldPerWin: 5,
    mods: [{ stat: 'lifestealPct', value: 5 }],
    effects: [
      { trigger: { kind: 'OnEnemyDeath' }, ops: [{ op: 'healPctMax', pct: 5 }] },
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

  // ── Satchels (backpack size; consumed on pickup, GDD §3.4) ────────────────
  {
    id: 'patched_satchel',
    name: 'Patched Satchel',
    kind: 'satchel',
    rarity: 'common',
    tags: [],
    flavor: 'More pockets than sense, which is exactly enough.',
    zenithName: 'Patched Satchel',
    backpackBonus: 2,
  },
  {
    id: 'quartermasters_pack',
    name: "Quartermaster's Pack",
    kind: 'satchel',
    rarity: 'uncommon',
    tags: [],
    flavor: 'It has carried worse up higher.',
    zenithName: "Quartermaster's Pack",
    backpackBonus: 3,
  },
  {
    id: 'bottomless_rucksack',
    name: 'Bottomless Rucksack',
    kind: 'satchel',
    rarity: 'rare',
    tags: [],
    flavor: 'You have stopped asking where it all goes.',
    zenithName: 'Bottomless Rucksack',
    backpackBonus: 3,
  },
];
