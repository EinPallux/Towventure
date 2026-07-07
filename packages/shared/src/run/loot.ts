/**
 * Loot rolls (BALANCE §5): gold with ±20% seeded variance, and item drops by
 * floor-band rarity weights. Elites bias +1 rarity and always drop; bosses drop
 * an Epic-biased item with a chance at the biome's signature Mythic.
 */

import {
  GOLD_BASE,
  GOLD_PER_FLOOR,
  GOLD_VARIANCE_PCT,
  ITEM_DROP_PCT,
  RARITIES,
} from '../content/constants.js';
import { droppablePool, rarityBandFor } from '../content/registry.js';
import type { Rarity } from '../content/types.js';
import type { Rng } from '../sim/rng.js';
import type { FightKind } from './types.js';

export function rollGold(floor: number, rng: Rng): number {
  const base = GOLD_BASE + GOLD_PER_FLOOR * floor;
  const delta = Math.trunc((base * GOLD_VARIANCE_PCT) / 100);
  return base - delta + rng.nextInt(2 * delta + 1);
}

/** Weighted rarity pick from the floor band (permille weights). */
export function rollRarity(floor: number, rng: Rng): Rarity {
  const weights = rarityBandFor(floor);
  let total = 0;
  for (const r of RARITIES) total += weights[r];
  if (total <= 0) return 'common';
  let roll = rng.nextInt(total);
  for (const r of RARITIES) {
    roll -= weights[r];
    if (roll < 0) return r;
  }
  return 'common';
}

function bumpRarity(r: Rarity): Rarity {
  const i = RARITIES.indexOf(r);
  return RARITIES[Math.min(RARITIES.length - 1, i + 1)]!;
}

/** Pick a droppable item id of a rarity; steps down if that rarity's pool is empty. */
export function pickItemOfRarity(rarity: Rarity, rng: Rng): string | undefined {
  const pool = droppablePool();
  for (let i = RARITIES.indexOf(rarity); i >= 0; i--) {
    const tier = RARITIES[i]!;
    const candidates = pool.filter((it) => it.rarity === tier);
    if (candidates.length > 0) return rng.pick(candidates).id;
  }
  return undefined;
}

/** Roll the item drop for a won fight (returns an item id or undefined). */
export function rollDrop(floor: number, kind: FightKind, rng: Rng): string | undefined {
  if (kind === 'boss') {
    // Epic-biased with a chance at the signature Mythic (BALANCE §5).
    const rarity: Rarity = rng.chance(15) ? 'mythic' : 'epic';
    return pickItemOfRarity(rarity, rng);
  }
  if (kind === 'elite') {
    return pickItemOfRarity(bumpRarity(rollRarity(floor, rng)), rng);
  }
  // Battle: 45% drop chance.
  if (!rng.chance(ITEM_DROP_PCT)) return undefined;
  return pickItemOfRarity(rollRarity(floor, rng), rng);
}

export interface Loot {
  gold: number;
  itemId?: string;
}

export function rollLoot(floor: number, kind: FightKind, rng: Rng): Loot {
  const gold = rollGold(floor, rng);
  const itemId = rollDrop(floor, kind, rng);
  return itemId ? { gold, itemId } : { gold };
}
