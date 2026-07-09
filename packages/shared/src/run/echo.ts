/**
 * Echo economy + lifecycle math (GDD §8, BALANCE §6). Pure integer functions — Honor
 * and Marks are integers and these feed server ledgers, so no floats leak in. The
 * `1.1×floor` / `floor/4` factors are evaluated as integer division. Placement,
 * persistence and payment live server-side; these are the shared formulas so the
 * client can preview a bounty and tests can pin the numbers.
 */

import { honorTierRank } from './honor.js';
import type { EquipState, HeroBuild } from './types.js';

/** An Echo fades after 3 defeats or 14 days, whichever first (GDD §8). */
export const ECHO_MAX_DEFEATS = 3;
export const ECHO_MAX_AGE_DAYS = 14;

/** Echo defense win pays its owner a small Honor trickle + Marks (GDD §8, BALANCE §6). */
export const ECHO_DEFENSE_HONOR = 3;
export const ECHO_DEFENSE_MARKS = 6;

const SLOT_ORDER: (keyof EquipState)[] = [
  'weapon1',
  'weapon2',
  'helm',
  'armor',
  'boots',
  'trinket1',
  'trinket2',
  'relic',
];

/**
 * Honor bounty for killing an Echo (BALANCE §6):
 * `B = 12 + 1.1×floor + 25×max(0, echoTier − yourTier)`, halved if the Echo is ≥2
 * tiers below you. Punching *up* pays best; farming down the ladder is throttled.
 */
export function echoBounty(echoFloor: number, echoHonor: number, yourHonor: number): number {
  const echoTier = honorTierRank(echoHonor);
  const yourTier = honorTierRank(yourHonor);
  let b =
    12 + Math.trunc((11 * Math.max(0, echoFloor)) / 10) + 25 * Math.max(0, echoTier - yourTier);
  if (echoTier <= yourTier - 2) b = Math.trunc(b / 2);
  return b;
}

/** Valor Marks for killing an Echo: `5 + floor/4` (BALANCE §6). */
export function echoMarks(echoFloor: number): number {
  return 5 + Math.trunc(Math.max(0, echoFloor) / 4);
}

/**
 * The Echo's fight-start damage bonus: +10% fresh, decaying −2%/day to 0 (BALANCE §6).
 * Fresh corpses are the scary ones.
 */
export function echoAiBonusPct(ageDays: number): number {
  return Math.max(0, 10 - 2 * Math.max(0, Math.trunc(ageDays)));
}

/** True once an Echo has hit its defeat cap or aged out (server also enforces this). */
export function echoIsSpent(defeats: number, ageDays: number): boolean {
  return defeats >= ECHO_MAX_DEFEATS || ageDays >= ECHO_MAX_AGE_DAYS;
}

/**
 * Grave-Copy candidates: up to 3 distinct equipped itemIds from the Echo's build, in
 * fixed slot order (deterministic — the hunter picks 1 of 3, granted as a ★1 copy).
 * The relic is excluded (class-bound, not lootable).
 */
export function graveCopyOptions(build: HeroBuild): string[] {
  const out: string[] = [];
  for (const slot of SLOT_ORDER) {
    if (slot === 'relic') continue;
    const inst = build.equipment[slot];
    if (inst && !out.includes(inst.itemId)) out.push(inst.itemId);
    if (out.length >= 3) break;
  }
  return out;
}
