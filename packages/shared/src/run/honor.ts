/**
 * Climb Honor + tiers (BALANCE §7). Honor is derived from the integer cumulative
 * table (no float `f^1.35` in run code). "First time per season at each floor"
 * bookkeeping lives server-side (the honor_ledger); these are the pure formulas.
 */

import { CLIMB_HONOR_CUMULATIVE, HONOR_TIERS, VOW_HONOR_PCT } from '../content/constants.js';

/** Cumulative climb Honor at a floor (extrapolates past the table by its last delta). */
export function cumulativeClimbHonor(floor: number): number {
  if (floor <= 0) return 0;
  const last = CLIMB_HONOR_CUMULATIVE.length - 1;
  if (floor <= last) return CLIMB_HONOR_CUMULATIVE[floor]!;
  const delta = CLIMB_HONOR_CUMULATIVE[last]! - CLIMB_HONOR_CUMULATIVE[last - 1]!;
  return CLIMB_HONOR_CUMULATIVE[last]! + delta * (floor - last);
}

/** Honor for newly reaching `floor` (the marginal step), ×(1 + 0.15×vows). */
export function climbHonorForFloor(floor: number, vowCount: number): number {
  const base = cumulativeClimbHonor(floor) - cumulativeClimbHonor(floor - 1);
  const mult = 100 + VOW_HONOR_PCT * vowCount;
  return Math.trunc((base * mult) / 100);
}

/**
 * Total climb Honor for a *frontier* jump from `fromFloor` (already banked) to
 * `toFloor` (new best), with Vows. Repeating banked floors pays nothing.
 */
export function climbHonorForFrontier(
  fromFloor: number,
  toFloor: number,
  vowCount: number,
): number {
  if (toFloor <= fromFloor) return 0;
  const base = cumulativeClimbHonor(toFloor) - cumulativeClimbHonor(fromFloor);
  const mult = 100 + VOW_HONOR_PCT * vowCount;
  return Math.trunc((base * mult) / 100);
}

/** The named tier for a season Honor total (The Unnumbered is resolved by rank, not here). */
export function honorTier(honor: number): { id: string; name: string } {
  let best = HONOR_TIERS[0]!;
  for (const t of HONOR_TIERS) {
    if (t.id === 'unnumbered') continue; // rank-based, not threshold-based
    if (honor >= t.min) best = t;
  }
  return { id: best.id, name: best.name };
}
