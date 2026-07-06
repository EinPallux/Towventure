/**
 * Biomes. Phase 1 ships the Gatehouse (floors 1–10), which loops with scaling as
 * a placeholder for the deeper tower until Phase 2 authors biomes 2–5 (ROADMAP).
 * Accent palette per ART_DIRECTION §1.
 */

import type { BiomeDef } from './types.js';

export const BIOMES: BiomeDef[] = [
  {
    id: 'gatehouse',
    name: 'The Gatehouse',
    floors: [1, 10],
    accent: 'amber',
    regularIds: ['tunnel_rat', 'gate_bandit', 'toll_shirker'],
    eliteId: 'two_coin_ferryman',
    bossId: 'toll_keeper',
    bossFloor: 10,
  },
];
