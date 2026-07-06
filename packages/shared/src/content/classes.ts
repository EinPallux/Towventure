/**
 * Classes. Phase 1 ships the Vanguard only (ROADMAP). Duelist (tier 2) and
 * Arcanist (tier 3) base stats are in BALANCE §2 and their kits are authored in
 * Phase 2 alongside the Awakened/Zenith effect system their relics need.
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
];
