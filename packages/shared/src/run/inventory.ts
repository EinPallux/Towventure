/**
 * Inventory operations (GDD §3.4, §4.1): equip/unequip with 2-hand + trinket slot
 * resolution, sell at 40% value, and fusion (two identical ★N → one ★N+1). These
 * mutate an already-cloned draft and return an error string or null. Backpack
 * overflow is a real decision — equipping that would strand a displaced item with
 * no room fails loudly (GDD §3.4).
 */

import { MAX_STAR, SELL_PCT, scaleToStar } from '../content/constants.js';
import { equipSlotForKind, findItem, getConsumable, getItem } from '../content/registry.js';
import type { Rarity } from '../content/types.js';
import { itemPrice } from './shop.js';
import type { EquipSlotId, InventoryItem, RunState } from './types.js';

const MATERIAL_SELL_BASE = 40;

function backpackIndex(draft: RunState, uid: string): number {
  return draft.backpack.findIndex((i) => i.uid === uid);
}

function backpackHasRoomFor(draft: RunState, added: number, removed: number): boolean {
  return draft.backpack.length - removed + added <= draft.backpackSize;
}

/** Sell-back value at the item's current ★ (40% of value; BALANCE §5). */
export function sellValue(inst: InventoryItem, floor: number): number {
  const item = findItem(inst.itemId);
  let value: number;
  if (item) {
    value = scaleToStar(itemPrice(item.rarity, floor), inst.star);
  } else {
    const cons = tryConsumable(inst.itemId);
    value = cons ? itemPrice(cons, floor) : MATERIAL_SELL_BASE;
  }
  return Math.trunc((value * SELL_PCT) / 100);
}

function tryConsumable(id: string): Rarity | undefined {
  try {
    return getConsumable(id).rarity;
  } catch {
    return undefined;
  }
}

/** Add a fresh item instance to the backpack (no room check — caller guarantees it). */
export function pushBackpack(draft: RunState, itemId: string, star = 1): InventoryItem {
  const inst: InventoryItem = { uid: `i${draft.nextUid}`, itemId, star };
  draft.nextUid += 1;
  draft.backpack.push(inst);
  return inst;
}

const WEAPON_SLOTS: EquipSlotId[] = ['weapon1', 'weapon2'];
const TRINKET_SLOTS: EquipSlotId[] = ['trinket1', 'trinket2'];

export function equip(draft: RunState, uid: string, targetSlot?: EquipSlotId): string | null {
  const idx = backpackIndex(draft, uid);
  if (idx < 0) return 'item is not in the backpack';
  const inst = draft.backpack[idx]!;
  const def = getItem(inst.itemId);
  if (def.kind === 'relic') return 'the relic slot is fixed by your class';
  const baseSlot = equipSlotForKind(def.kind);
  if (!baseSlot) return 'that item cannot be equipped';

  // Which equip slot key will receive it, and which slots get displaced.
  let destKey: EquipSlotId;
  const displaced: (InventoryItem | null)[] = [];

  if (baseSlot === 'weapon') {
    if (def.twoHanded) {
      destKey = 'weapon1';
      displaced.push(draft.equipment.weapon1, draft.equipment.weapon2);
    } else {
      destKey =
        targetSlot && WEAPON_SLOTS.includes(targetSlot)
          ? targetSlot
          : (WEAPON_SLOTS.find((s) => draft.equipment[s] === null) ?? 'weapon1');
      // Replacing into a slot currently holding the 2-hander frees both hands.
      const existing = draft.equipment[destKey];
      if (existing && getItem(existing.itemId).twoHanded) {
        displaced.push(draft.equipment.weapon1, draft.equipment.weapon2);
      } else {
        displaced.push(existing);
      }
    }
  } else if (baseSlot === 'trinket') {
    destKey =
      targetSlot && TRINKET_SLOTS.includes(targetSlot)
        ? targetSlot
        : (TRINKET_SLOTS.find((s) => draft.equipment[s] === null) ?? 'trinket1');
    displaced.push(draft.equipment[destKey]);
  } else {
    destKey = baseSlot as EquipSlotId;
    displaced.push(draft.equipment[destKey]);
  }

  const displacedItems = displaced.filter((d): d is InventoryItem => d !== null);
  // Net backpack change: remove the equipped item (1), add displaced items back.
  if (!backpackHasRoomFor(draft, displacedItems.length, 1)) {
    return 'backpack is full — sell or fuse to make room first';
  }

  // Commit: pull the item out, clear the slots we are overwriting, place, return displaced.
  draft.backpack.splice(idx, 1);
  if (def.twoHanded && baseSlot === 'weapon') {
    draft.equipment.weapon1 = inst;
    draft.equipment.weapon2 = null;
  } else if (baseSlot === 'weapon') {
    const existing = draft.equipment[destKey];
    if (existing && getItem(existing.itemId).twoHanded) {
      // Overwriting the 2-hander clears both hands before placing the 1-hander.
      draft.equipment.weapon1 = null;
      draft.equipment.weapon2 = null;
    }
    draft.equipment[destKey] = inst;
  } else {
    draft.equipment[destKey] = inst;
  }
  for (const d of displacedItems) draft.backpack.push(d);
  return null;
}

export function unequip(draft: RunState, slot: EquipSlotId): string | null {
  if (slot === 'relic') return 'the relic slot is fixed by your class';
  const inst = draft.equipment[slot];
  if (!inst) return 'that slot is empty';
  if (!backpackHasRoomFor(draft, 1, 0)) return 'backpack is full — sell or fuse to make room first';
  draft.equipment[slot] = null;
  draft.backpack.push(inst);
  return null;
}

export function sell(draft: RunState, uid: string): string | null {
  const idx = backpackIndex(draft, uid);
  if (idx < 0) return 'you can only sell items in your backpack';
  const inst = draft.backpack[idx]!;
  draft.gold += sellValue(inst, draft.floor);
  draft.backpack.splice(idx, 1);
  return null;
}

export function fuse(draft: RunState, uid1: string, uid2: string): string | null {
  if (uid1 === uid2) return 'pick two different copies to fuse';
  const i1 = backpackIndex(draft, uid1);
  const i2 = backpackIndex(draft, uid2);
  if (i1 < 0 || i2 < 0) return 'both copies must be in your backpack';
  const a = draft.backpack[i1]!;
  const b = draft.backpack[i2]!;
  if (a.itemId !== b.itemId) return 'only identical items fuse';
  if (a.star !== b.star) return 'both copies must be the same ★ tier';
  if (a.star >= MAX_STAR) return 'already at ★5 (Zenith) — the maximum';
  // Remove both (splice the higher index first to keep indices valid), add the fused copy.
  const hi = Math.max(i1, i2);
  const lo = Math.min(i1, i2);
  draft.backpack.splice(hi, 1);
  draft.backpack.splice(lo, 1);
  pushBackpack(draft, a.itemId, a.star + 1);
  return null;
}
