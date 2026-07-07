/**
 * War Chest boons (CONTENT §8) — mild, one-per-run head starts applied at run start.
 * All effects touch only gold / backpack / starting inventory — never combat stats —
 * so they don't shift any fight's deterministic outcome (the golden suite is untouched).
 * Pure integer mutations of run state; the server consumes the armed boon and calls this.
 */

import { pushBackpack } from './inventory.js';
import type { RunState } from './types.js';

/** Apply a boon's effect to a freshly-started run. Returns false for an unknown id. */
export function applyBoon(state: RunState, boonId: string): boolean {
  switch (boonId) {
    case 'boon_purse':
      state.gold += 50;
      return true;
    case 'boon_wide_pack':
      state.backpackSize += 2;
      return true;
    case 'boon_travel_kit':
      if (state.backpack.length < state.backpackSize) pushBackpack(state, 'whetstone', 1);
      return true;
    case 'boon_prime':
      state.gold += 100;
      state.backpackSize += 2;
      return true;
    default:
      return false;
  }
}
