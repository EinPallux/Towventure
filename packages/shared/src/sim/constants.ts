/**
 * Sim constants — the integer mirror of BALANCE.md §1 & §3. When this file and
 * BALANCE.md disagree, one of them is a bug; fix both in the same PR
 * (AGENTS.md §3.5). All time is in ticks, all magnitudes are integers.
 */

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND; // 100 — presentation only, not sim state

/** Fight hard cap: 60s. */
export const FIGHT_CAP_TICKS = 60 * TICKS_PER_SECOND; // 600

/** Doomfall start: 45s default, 35s under Vow of Haste (BALANCE §1). */
export const DOOMFALL_START_TICKS = 45 * TICKS_PER_SECOND; // 450
export const DOOMFALL_START_TICKS_HASTE = 35 * TICKS_PER_SECOND; // 350

/** Doomfall: 2% max HP/s, +1%/s every 5s elapsed (true, unmitigable). */
export const DOOMFALL_BASE_PCT_PER_SEC = 2;
export const DOOMFALL_RAMP_PCT = 1;
export const DOOMFALL_RAMP_EVERY_SEC = 5;

/** No weapon may go below 0.6s effective cooldown. */
export const COOLDOWN_FLOOR_TICKS = 6;

/** Crit: base ×1.5; the Crit-damage stat adds to the multiplier (percent). */
export const CRIT_BASE_MULT_PCT = 150;

/** Per-source caps (BALANCE §1). */
export const DODGE_CAP_PCT = 40;
export const SPEED_CAP_PCT = 150;
export const LIFESTEAL_CAP_PCT = 35;

/** Minimum damage a landed hit deals after Armor (BALANCE §1). */
export const MIN_HIT_DAMAGE = 1;

/** Status rules (per stack unless noted), BALANCE §3 — all ten. */
export const STATUS = {
  bleed: { dmgPerSecPerStack: 2, durationTicks: 4 * TICKS_PER_SECOND },
  burn: { dmgPerSecPerStack: 3, durationTicks: 3 * TICKS_PER_SECOND },
  chill: { speedPctPerStack: 4, durationTicks: 4 * TICKS_PER_SECOND, maxStacks: 8 },
  regen: { healPerSecPerStack: 2, durationTicks: 4 * TICKS_PER_SECOND },
  ward: { decayPctPerSec: 5, capPctOfMaxHp: 40 },
  // Venom never expires; each stack is 1 dmg/s and the whole DoT ramps +1 dmg/s
  // for every 5s it has been present (it only grows).
  venom: { dmgPerSecPerStack: 1, rampPerStep: 1, rampEverySec: 5 },
  // Next incoming hit on the target cannot miss and is a guaranteed crit; one stack
  // is consumed on use. No duration — it waits until spent.
  shock: { maxStacks: 3 },
  weaken: { dmgPctPerStack: 5, durationTicks: 5 * TICKS_PER_SECOND, maxStacks: 5 },
  // −3 Armor per stack; Armor may go negative (adds damage taken), floored at −15.
  sunder: { armorPerStack: 3, durationTicks: 6 * TICKS_PER_SECOND, minArmor: -15 },
  haste: { speedPctPerStack: 5, durationTicks: 3 * TICKS_PER_SECOND, maxStacks: 6 },
} as const;

/**
 * Fixed iteration order over statuses — never iterate object keys (AGENTS §3.1).
 * The Phase 1 five stay first so their status codes (and every committed golden
 * hash) are unchanged; the Phase 2 five are appended.
 */
export const STATUS_ORDER = [
  'bleed',
  'burn',
  'chill',
  'regen',
  'ward',
  'venom',
  'shock',
  'weaken',
  'sunder',
  'haste',
] as const;
export type StatusKind = (typeof STATUS_ORDER)[number];

/** Free HP scaling: +6 Max HP per floor cleared (BALANCE §2). */
export const HP_PER_FLOOR = 6;
