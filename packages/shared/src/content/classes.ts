/**
 * Classes (base stats BALANCE §2, kits CONTENT §1). All three are playable in
 * Phase 2. Unlock tiers are recorded (Vanguard 0, Duelist 2, Arcanist 3) but the
 * Honor-tier unlock *gating* is wired in Phase 3 (ROADMAP). The Duelist/Arcanist
 * relics are modelled with the current effect vocabulary — see the notes on their
 * relic items for the exact CONTENT mechanics awaiting deferred ops.
 */

import type { ClassDef } from './types.js';

export const CLASSES: ClassDef[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    fantasy: 'the wall that hits back',
    base: {
      maxHp: 120,
      armor: 6,
      speedPct: -10,
      critChancePct: 5,
      critDamagePct: 0,
      dodgePct: 0,
      lifestealPct: 0,
      thorns: 0,
    },
    relicId: 'bulwark_sigil',
    startItemIds: ['rusty_cleaver', 'dented_pot_helm'],
    startConsumableIds: ['small_ale'],
    unlockTier: 0,
  },
  {
    id: 'duelist',
    name: 'Duelist',
    fantasy: 'speed, crits, bleed, greed',
    base: {
      maxHp: 90,
      armor: 0,
      speedPct: 10,
      critChancePct: 12,
      critDamagePct: 25,
      dodgePct: 6,
      lifestealPct: 0,
      thorns: 0,
    },
    relicId: 'twin_fang_oath',
    startItemIds: ['sawtooth_dirk', 'quickstep_boots'],
    startConsumableIds: ['adrenal_vial'],
    unlockTier: 2,
  },
  {
    id: 'arcanist',
    name: 'Arcanist',
    fantasy: 'cooldowns, statuses, detonations',
    base: {
      maxHp: 95,
      armor: 0,
      speedPct: 0,
      critChancePct: 5,
      critDamagePct: 0,
      dodgePct: 3,
      lifestealPct: 0,
      thorns: 0,
    },
    relicId: 'cinderheart',
    startItemIds: ['apprentice_sparkrod', 'singed_grimoire'],
    startConsumableIds: ['cinder_phial'],
    unlockTier: 3,
  },
];
