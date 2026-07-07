/**
 * Event resolution (CONTENT §5). Each event's bespoke state change lives here, keyed
 * by (event id, chosen option index). Pure: mutates an already-cloned draft using the
 * passed seeded RNG; returns an error string or null. Option 0 is the "accept" branch
 * for every anchor event; the decline branch is a no-op. Effects that grant loot set
 * `pendingItem` (the reducer routes to the reward screen); the rest advance the floor.
 */

import { MAX_STAR } from '../content/constants.js';
import { ITEMS, findItem, findMaterial, isEquippable } from '../content/registry.js';
import type { Rng } from '../sim/rng.js';
import type { RunState } from './types.js';

export function applyEvent(
  draft: RunState,
  eventId: string,
  optionIndex: number,
  rng: Rng,
): string | null {
  switch (eventId) {
    case 'shrine_of_mended_blade': {
      if (optionIndex !== 0) return null; // declined
      // Upgrade a random real item (not a material/consumable) that isn't maxed.
      const upgradeable = draft.backpack.filter((i) => {
        const d = findItem(i.itemId);
        return d !== undefined && i.star < MAX_STAR;
      });
      if (upgradeable.length > 0) {
        upgradeable[rng.nextInt(upgradeable.length)]!.star += 1;
      }
      // Consume a random held material.
      const mats = draft.backpack.filter((i) => findMaterial(i.itemId) !== undefined);
      if (mats.length > 0) {
        const doomed = mats[rng.nextInt(mats.length)]!.uid;
        draft.backpack = draft.backpack.filter((i) => i.uid !== doomed);
      }
      return null;
    }
    case 'sleepwalkers_bargain': {
      if (optionIndex !== 0) return null;
      const t1 = draft.equipment.trinket1;
      const t2 = draft.equipment.trinket2;
      if (t1 && t2) {
        const s = t1.star;
        t1.star = t2.star;
        t2.star = s;
      }
      return null;
    }
    case 'gamblers_alcove': {
      if (optionIndex !== 0) return null;
      const stake = Math.trunc(draft.gold / 4);
      if (stake <= 0) return null;
      // Double or nothing: win → keep the stake and gain it again; lose → forfeit it.
      if (rng.chance(50)) draft.gold += stake;
      else draft.gold -= stake;
      return null;
    }
    case 'cursed_reliquary': {
      if (optionIndex !== 0) return null;
      const epics = ITEMS.filter(
        (i) => i.rarity === 'epic' && i.kind !== 'relic' && isEquippable(i),
      );
      if (epics.length > 0) draft.pendingItem = epics[rng.nextInt(epics.length)]!.id;
      return null;
    }
    default:
      return 'unknown event';
  }
}
