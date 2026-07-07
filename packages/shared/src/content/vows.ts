/**
 * Vows (run modifiers, CONTENT §6). Each vow grants +15% climb Honor (BALANCE §7,
 * applied by the honor formulas via vow count) in exchange for a real penalty — so
 * only vows whose penalty is actually enforced may be offered, or the +15% would be
 * free Honor (the reason Phase 1 locked vows empty). This ships the five enforceable
 * ones; the rest (Echo/Sanctum/substat-dependent) are authored in CONTENT §6 and land
 * with those systems. `VOW_IDS` is the single source of truth the protocol enum reuses.
 */

import type { VowDef } from './types.js';

export const VOW_IDS = [
  'vow_of_haste',
  'vow_of_hunger',
  'vow_of_poverty',
  'vow_of_silence',
  'vow_of_glass',
] as const;

export type VowId = (typeof VOW_IDS)[number];

export const MAX_VOWS = 5;

export const VOWS: VowDef[] = [
  {
    id: 'vow_of_haste',
    name: 'Vow of Haste',
    flavor: 'You will not make them wait.',
    penalty: 'Doomfall arrives at 35s instead of 45s.',
  },
  {
    id: 'vow_of_hunger',
    name: 'Vow of Hunger',
    flavor: 'Want is a kind of discipline.',
    penalty: 'The Wandering Merchant stocks one fewer item.',
  },
  {
    id: 'vow_of_poverty',
    name: 'Vow of Poverty',
    flavor: 'The Tower keeps the coin; you keep the climb.',
    penalty: 'Fights pay 40% less gold.',
  },
  {
    id: 'vow_of_silence',
    name: 'Vow of Silence',
    flavor: 'No bottled courage. Only yours.',
    penalty: 'Your consumables never fire.',
  },
  {
    id: 'vow_of_glass',
    name: 'Vow of Glass',
    flavor: 'Hit like a held breath; break like one.',
    penalty: '+25% damage, but −25% Max HP.',
  },
];
