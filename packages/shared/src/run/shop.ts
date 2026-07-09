/**
 * The Wandering Merchant (GDD §5, BALANCE §5): 6 item slots (one is the Requested
 * Copy — a ★1 copy of something you own, the fusion-targeting valve), 2 materials,
 * 1 consumable. Prices scale with floor; rerolls escalate; Epic+ pity after 12 dry
 * item slots. "Shop minimal" for Phase 1 — no War Chest, no free-reroll tokens yet.
 */

import { CONSUMABLES, ITEMS, MATERIALS, findItem, getItem } from '../content/registry.js';
import {
  RARITY_POWER,
  REQUESTED_COPY_ESCALATE_DEN,
  REQUESTED_COPY_ESCALATE_NUM,
  REQUESTED_COPY_MARKUP_DEN,
  REQUESTED_COPY_MARKUP_NUM,
  SHOP_PITY_SLOTS,
  SHOP_PRICE_FLOOR_PCT,
  SHOP_REROLL_BASE,
} from '../content/constants.js';
import type { Rarity } from '../content/types.js';
import type { Rng } from '../sim/rng.js';
import { pickItemOfRarity, rollRarity } from './loot.js';
import type { RunState, ShopSlot, ShopState } from './types.js';

const MATERIAL_BASE_PRICE = 40;

/** Item shop price: P(rarity)/2 × (1 + floor×3%), integer (BALANCE §5). */
export function itemPrice(rarity: Rarity, floor: number): number {
  const base = Math.trunc(RARITY_POWER[rarity] / 2);
  return Math.trunc((base * (100 + floor * SHOP_PRICE_FLOOR_PCT)) / 100);
}

function materialPrice(floor: number): number {
  return Math.trunc((MATERIAL_BASE_PRICE * (100 + floor * SHOP_PRICE_FLOOR_PCT)) / 100);
}

function isEpicPlus(r: Rarity): boolean {
  return r === 'epic' || r === 'mythic';
}

/** Item ids the player owns that are valid Requested-Copy targets (equippable, non-relic). */
export function requestableOwned(state: RunState): string[] {
  const ids = new Set<string>();
  for (const inst of state.backpack) {
    const def = findItem(inst.itemId);
    if (def && def.kind !== 'relic' && def.kind !== 'consumable' && def.kind !== 'material')
      ids.add(inst.itemId);
  }
  for (const slot of Object.values(state.equipment)) {
    if (!slot) continue;
    const def = findItem(slot.itemId);
    if (def && def.kind !== 'relic') ids.add(slot.itemId);
  }
  return [...ids];
}

function requestedCopyPrice(itemId: string, floor: number, priorRequests: number): number {
  const base = itemPrice(getItem(itemId).rarity, floor);
  let price = Math.trunc((base * REQUESTED_COPY_MARKUP_NUM) / REQUESTED_COPY_MARKUP_DEN);
  for (let i = 0; i < priorRequests; i++) {
    price = Math.trunc((price * REQUESTED_COPY_ESCALATE_NUM) / REQUESTED_COPY_ESCALATE_DEN);
  }
  return price;
}

/**
 * Generate a fresh shop for the current floor. Returns the shop and the updated
 * pity counter (shop item slots seen since the last Epic+).
 */
export function generateShop(
  state: RunState,
  rng: Rng,
): { shop: ShopState; shopSlotsSinceEpic: number } {
  const floor = state.floor;
  const slots: ShopSlot[] = [];

  // Item slots + pity. The Vow of Hunger stocks one fewer (CONTENT §6).
  const itemSlots = state.vows.includes('vow_of_hunger') ? 4 : 5;
  const rarities: Rarity[] = [];
  for (let i = 0; i < itemSlots; i++) rarities.push(rollRarity(floor, rng));
  let sinceEpic = state.shopSlotsSinceEpic;
  if (!rarities.some(isEpicPlus) && sinceEpic + itemSlots >= SHOP_PITY_SLOTS) {
    rarities[rng.nextInt(itemSlots)] = 'epic'; // pity-force an Epic (BALANCE §5)
  }
  for (const rarity of rarities) {
    const itemId = pickItemOfRarity(rarity, rng);
    if (!itemId) continue;
    const def = getItem(itemId);
    slots.push({
      kind: 'item',
      refId: itemId,
      star: 1,
      price: itemPrice(def.rarity, floor),
      sold: false,
    });
  }
  sinceEpic = slots.some((s) => isEpicPlus(getItem(s.refId).rarity)) ? 0 : sinceEpic + itemSlots;

  // Requested Copy slot (the fusion-targeting valve).
  const owned = requestableOwned(state);
  if (owned.length > 0) {
    const target = rng.pick(owned);
    slots.push({
      kind: 'requestedCopy',
      refId: target,
      star: 1,
      price: requestedCopyPrice(target, floor, state.requestsThisRun),
      sold: false,
    });
  } else {
    // Fallback: a normal item slot if the player owns nothing yet.
    const rarity = rollRarity(floor, rng);
    const itemId = pickItemOfRarity(rarity, rng);
    if (itemId)
      slots.push({
        kind: 'item',
        refId: itemId,
        star: 1,
        price: itemPrice(getItem(itemId).rarity, floor),
        sold: false,
      });
  }

  // 2 material slots.
  for (let i = 0; i < 2; i++) {
    const mat = rng.pick(MATERIALS);
    slots.push({
      kind: 'material',
      refId: mat.id,
      star: 1,
      price: materialPrice(floor),
      sold: false,
    });
  }
  // 1 consumable slot.
  const cons = rng.pick(CONSUMABLES);
  slots.push({
    kind: 'consumable',
    refId: cons.id,
    star: 1,
    price: itemPrice(cons.rarity, floor),
    sold: false,
  });

  // ~1 in 6 shops offers a Satchel (backpack expansion, GDD §3.4).
  const satchels = ITEMS.filter((i) => i.kind === 'satchel');
  if (satchels.length > 0 && rng.chance(16)) {
    const sat = rng.pick(satchels);
    slots.push({
      kind: 'item',
      refId: sat.id,
      star: 1,
      price: itemPrice(sat.rarity, floor),
      sold: false,
    });
  }

  return {
    shop: { slots, rerollCount: 0, rerollPrice: SHOP_REROLL_BASE },
    shopSlotsSinceEpic: sinceEpic,
  };
}
