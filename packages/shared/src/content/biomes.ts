/**
 * Biomes. The climb now runs the first five biomes (floors 1–50), ending on the
 * Prior of Teeth — the mid-game wall (CONTENT §4.1, ROADMAP Phase 2). Past floor 50
 * the last biome loops with scaling until Menagerie…Crown are authored. Accent per
 * ART_DIRECTION §1; each biome's palette is data in the client (engine/palettes.ts).
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
  {
    id: 'gardens',
    name: 'The Gardens',
    floors: [11, 20],
    accent: 'verdigris',
    regularIds: ['bramble_shambler', 'pollen_drone', 'bloodthorn_creeper'],
    eliteId: 'rustling_mimic',
    bossId: 'root_queen_marrow',
    bossFloor: 20,
  },
  {
    id: 'archive',
    name: 'The Archive',
    floors: [21, 30],
    accent: 'candle-ivory',
    regularIds: ['inkbound_folio', 'redaction_wisp', 'marginalia_wisp'],
    eliteId: 'the_unshelved',
    bossId: 'the_unread',
    bossFloor: 30,
  },
  {
    id: 'foundry',
    name: 'The Foundry',
    floors: [31, 40],
    accent: 'ember-orange',
    regularIds: ['slagling', 'vow_forged_sentinel', 'slag_imp'],
    eliteId: 'cinder_widow',
    bossId: 'forgetide_colossus',
    bossFloor: 40,
  },
  {
    id: 'chapel',
    name: 'The Chapel',
    floors: [41, 50],
    accent: 'bone-wine',
    regularIds: ['chained_penitent', 'bell_starved_acolyte', 'ash_chorister'],
    eliteId: 'warden_of_chains',
    bossId: 'prior_of_teeth',
    bossFloor: 50,
  },
];
