/**
 * Run-scoped RNG derivation. All run randomness (doors, drops, shop stock) and
 * fight seeds derive deterministically from `runSeed + floor + purpose + counter`
 * (ARCHITECTURE.md §3), so the client can never peek at undrawn futures and the
 * server can reproduce any draw for support/audit.
 */

import { Rng, mixSeed } from '../sim/rng.js';

export const RNG_PURPOSE = {
  doors: 1,
  loot: 2,
  shop: 3,
  requestedCopy: 4,
  fight: 5,
  events: 6,
} as const;

export type RngPurpose = (typeof RNG_PURPOSE)[keyof typeof RNG_PURPOSE];

/** A fresh deterministic RNG for a specific run/floor/purpose/counter. */
export function deriveRng(seed: number, floor: number, purpose: RngPurpose, counter = 0): Rng {
  return new Rng(mixSeed(seed, floor, purpose, counter));
}

/** The seed a fight is simulated from (server draws it; client re-sims to render). */
export function deriveFightSeed(seed: number, floor: number, fightCounter: number): number {
  return mixSeed(seed, floor, RNG_PURPOSE.fight, fightCounter);
}
