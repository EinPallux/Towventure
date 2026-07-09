/**
 * Torments (GDD §11, BALANCE §6) — the floors-100+ escalation. Past the Sleepless
 * Warden the Crown loops, and every 10 floors adds a Torment: a flat numeric bump
 * (+8% enemy HP, +6% enemy damage per level) plus stacking *mechanical* cards from a
 * fixed deck, so the pressure changes kind, not just size. Pure + integer + a function
 * of floor only, so nothing below floor 100 is touched and the goldens stay green.
 */

import { DOOMFALL_START_TICKS, DOOMFALL_START_TICKS_HASTE } from '../sim/constants.js';

/** First Torment lands on floor 101; each +10 floors adds another (GDD §11). */
export const TORMENT_FLOOR = 100;
export const TORMENT_STEP = 10;
/** Numeric scaling per Torment level (BALANCE §6). */
export const TORMENT_HP_PCT = 8;
export const TORMENT_DMG_PCT = 6;

export interface TormentCard {
  id: string;
  name: string;
  /** The level at which this card activates (cumulative — it stays on above it). */
  atLevel: number;
  blurb: string;
}

/**
 * The Torment deck (GDD §11). Combat cards are wired into the sim; the run-shape cards
 * (Ill Company / The Toll Rises) are surfaced to the player and scored as intended,
 * with their door/shop hooks a follow-up — they still carry the numeric bump.
 */
export const TORMENT_DECK: TormentCard[] = [
  { id: 'quickening', name: 'The Quickening', atLevel: 1, blurb: 'The tower hurries. Enemies attack faster.' },
  { id: 'weeping_air', name: 'The Weeping Air', atLevel: 2, blurb: 'The air itself is venomed — enemies open with it.' },
  { id: 'doomrush', name: 'Doomrush', atLevel: 3, blurb: 'The end comes early — Doomfall at 35s.' },
  { id: 'ill_company', name: 'Ill Company', atLevel: 4, blurb: 'Elites no longer climb alone. (door hook: follow-up)' },
  { id: 'relentless', name: 'The Relentless Hour', atLevel: 5, blurb: 'Faster still, and the venom doubles.' },
  { id: 'toll_rises', name: 'The Toll Rises', atLevel: 6, blurb: 'Every merchant charges the deep price. (shop hook: follow-up)' },
];

/** The Torment level at a floor: 0 up to floor 100, then +1 every 10 floors. */
export function tormentLevel(floor: number): number {
  if (floor <= TORMENT_FLOOR) return 0;
  return Math.ceil((floor - TORMENT_FLOOR) / TORMENT_STEP);
}

/** The Torment cards active at a floor (all whose `atLevel` ≤ the current level). */
export function activeTorments(floor: number): TormentCard[] {
  const level = tormentLevel(floor);
  return TORMENT_DECK.filter((c) => c.atLevel <= level);
}

const hasCard = (level: number, id: string): boolean =>
  TORMENT_DECK.some((c) => c.id === id && c.atLevel <= level);

/** Numeric enemy scaling multiplier (percent) from Torments at a floor. */
export function tormentHpPct(floor: number): number {
  return 100 + TORMENT_HP_PCT * tormentLevel(floor);
}
export function tormentDmgPct(floor: number): number {
  return 100 + TORMENT_DMG_PCT * tormentLevel(floor);
}

/** Extra enemy Speed% from the Quickening / Relentless cards. */
export function tormentEnemySpeedPct(floor: number): number {
  const level = tormentLevel(floor);
  let pct = 0;
  if (hasCard(level, 'quickening')) pct += 12;
  if (hasCard(level, 'relentless')) pct += 12;
  return pct;
}

/** Venom stacks each enemy opens the fight with (The Weeping Air / Relentless). */
export function tormentOpeningVenom(floor: number): number {
  const level = tormentLevel(floor);
  let v = 0;
  if (hasCard(level, 'weeping_air')) v += 2;
  if (hasCard(level, 'relentless')) v += 2;
  return v;
}

/** Doomfall start (ticks) for a floor — 35s once Doomrush is active (BALANCE §14). */
export function tormentDoomfallStartTicks(floor: number, hasteVow: boolean): number {
  if (hasCard(tormentLevel(floor), 'doomrush')) return DOOMFALL_START_TICKS_HASTE;
  return hasteVow ? DOOMFALL_START_TICKS_HASTE : DOOMFALL_START_TICKS;
}
