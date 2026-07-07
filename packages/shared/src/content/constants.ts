/**
 * Content & economy constants — the integer mirror of BALANCE.md §4–§8. Code and
 * doc move in lockstep (AGENTS.md §3.5). All values are integers; anything with a
 * fractional formula in BALANCE is pre-resolved to a table or a fixed-point ratio.
 */

import type { Rarity } from './types.js';

/** Base item power P(rarity) — drives pricing and derived weapon damage (BALANCE §4). */
export const RARITY_POWER: Record<Rarity, number> = {
  common: 100,
  uncommon: 135,
  rare: 185,
  epic: 255,
  mythic: 350,
};

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'mythic'];

/** Infusion sockets by rarity (GDD §4.2). */
export const SOCKETS_BY_RARITY: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  mythic: 3,
};

export const MAX_STAR = 5;

/**
 * ★ scaling = ×1.35 per star, compounding (BALANCE §4). Fixed-point [num, den]
 * per star so scaling stays integer: scaled = trunc(base × num / den).
 * Indexed by star 1..5 (index 0 unused).
 */
export const STAR_SCALE: ReadonlyArray<readonly [number, number]> = [
  [1, 1], // 0 (unused)
  [1, 1], // ★1
  [135, 100], // ★2
  [18225, 10000], // ★3
  [2460375, 1000000], // ★4
  [332150625, 100000000], // ★5
];

/** Total copies of a ★1 item needed to reach each star (BALANCE §4). */
export const COPIES_FOR_STAR: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

/** Scale an integer base value to a star tier (compounding ×1.35). */
export function scaleToStar(base: number, star: number): number {
  const s = STAR_SCALE[star] ?? STAR_SCALE[1]!;
  return Math.trunc((base * s[0]) / s[1]);
}

// ─── Drops & shop economy (BALANCE §5) ───────────────────────────────────────

/** Fight gold: 10 + 2×floor, ±20% (the ± is a seeded roll in run/loot). */
export const GOLD_BASE = 10;
export const GOLD_PER_FLOOR = 2;
export const GOLD_VARIANCE_PCT = 20;

/** Item drop chance on a normal Battle win (percent). */
export const ITEM_DROP_PCT = 45;

/** Sell-back is 40% of shop value. */
export const SELL_PCT = 40;

/** Rarity weights by floor band (C/U/R/E/M), integer permille to avoid floats. */
export interface RarityBand {
  maxFloor: number;
  weights: Record<Rarity, number>;
}
export const RARITY_BANDS: RarityBand[] = [
  { maxFloor: 10, weights: { common: 700, uncommon: 250, rare: 50, epic: 0, mythic: 0 } },
  { maxFloor: 30, weights: { common: 450, uncommon: 350, rare: 170, epic: 30, mythic: 2 } },
  { maxFloor: 60, weights: { common: 250, uncommon: 380, rare: 270, epic: 90, mythic: 10 } },
  { maxFloor: 100, weights: { common: 120, uncommon: 300, rare: 350, epic: 190, mythic: 40 } },
  { maxFloor: Infinity, weights: { common: 80, uncommon: 240, rare: 360, epic: 250, mythic: 70 } },
];

/** Shop layout & pricing (BALANCE §5). */
export const SHOP_ITEM_SLOTS = 6; // one is the Requested Copy slot
export const SHOP_MATERIAL_SLOTS = 2;
export const SHOP_CONSUMABLE_SLOTS = 1;
export const SHOP_REROLL_BASE = 15;
export const SHOP_REROLL_MULT_NUM = 16; // ×1.6 each reroll (fixed-point /10)
export const SHOP_REROLL_MULT_DEN = 10;
/** Price = P(rarity)/2 × (1 + floor×0.03); fixed-point floorMult permille. */
export const SHOP_PRICE_FLOOR_PCT = 3; // +3% per floor
export const REQUESTED_COPY_MARKUP_NUM = 15; // ×1.5 base (fixed-point /10)
export const REQUESTED_COPY_MARKUP_DEN = 10;
export const REQUESTED_COPY_ESCALATE_NUM = 14; // ×1.4 per prior request (/10)
export const REQUESTED_COPY_ESCALATE_DEN = 10;

/** Bad-luck protection: no Epic+ across this many shop item slots → pity (BALANCE §5). */
export const SHOP_PITY_SLOTS = 12;

// ─── Enemy scaling per floor (BALANCE §6) ────────────────────────────────────

/** Per-floor multipliers as fixed-point [num, den]; applied iteratively. */
export const ENEMY_HP_STEP: readonly [number, number] = [106, 100]; // ×1.06
export const ENEMY_HP_STEP_KNEE: readonly [number, number] = [1045, 1000]; // ×1.045 past floor 50
export const ENEMY_DMG_STEP: readonly [number, number] = [105, 100]; // ×1.05
export const ENEMY_SCALE_KNEE_FLOOR = 50;

export const ELITE_HP_NUM = 18; // ×1.8 (/10)
export const ELITE_HP_DEN = 10;
export const ELITE_DMG_NUM = 135; // ×1.35 (/100)
export const ELITE_DMG_DEN = 100;
export const BOSS_HP_NUM = 45; // ×4.5 (/10)
export const BOSS_HP_DEN = 10;
export const BOSS_DMG_NUM = 15; // ×1.5 (/10)
export const BOSS_DMG_DEN = 10;

// ─── Honor & tiers (BALANCE §7) ──────────────────────────────────────────────

/**
 * Cumulative climb Honor at floor f = round(3 × f^1.35), pre-computed to integers
 * so run/ stays integer-only. Index = floor (0..120). Beyond 120, extrapolate in
 * run/honor via the last delta (Torment territory is Phase 4+).
 */
export const CLIMB_HONOR_CUMULATIVE: readonly number[] = [
  0, 3, 8, 13, 19, 26, 34, 41, 50, 58, 67, 76, 86, 96, 106, 116, 127, 137, 149, 160, 171, 183, 195,
  207, 219, 231, 244, 257, 270, 283, 296, 309, 323, 337, 350, 364, 379, 393, 407, 422, 436, 451,
  466, 481, 496, 512, 527, 543, 558, 574, 590, 606, 622, 638, 654, 671, 687, 704, 721, 738, 754,
  771, 789, 806, 823, 841, 858, 876, 893, 911, 929, 947, 965, 983, 1001, 1020, 1038, 1057, 1075,
  1094, 1112, 1131, 1150, 1169, 1188, 1207, 1227, 1246, 1265, 1285, 1304, 1324, 1343, 1363, 1383,
  1403, 1423, 1443, 1463, 1483, 1504, 1524, 1544, 1565, 1585, 1606, 1627, 1647, 1668, 1689, 1710,
  1731, 1752, 1773, 1794, 1816, 1837, 1859, 1880, 1902, 1923,
];

/** +15% Honor per Vow (BALANCE §7); applied as fixed-point. */
export const VOW_HONOR_PCT = 15;

export interface HonorTier {
  id: string;
  name: string;
  min: number;
}
/** Honor tiers (BALANCE §7). The Unnumbered is top-100 (≥5000), resolved by rank. */
export const HONOR_TIERS: HonorTier[] = [
  { id: 'ashbound', name: 'Ashbound', min: 0 },
  { id: 'stairborn', name: 'Stairborn', min: 200 },
  { id: 'gatekeeper', name: 'Gatekeeper', min: 500 },
  { id: 'vaultbreaker', name: 'Vaultbreaker', min: 1000 },
  { id: 'lanternbearer', name: 'Lanternbearer', min: 1800 },
  { id: 'wardenslayer', name: 'Wardenslayer', min: 3000 },
  { id: 'crownseeker', name: 'Crownseeker', min: 5000 },
  { id: 'unnumbered', name: 'The Unnumbered', min: 5000 },
];

/** Free HP scaling mirror (also in sim/constants; kept here for build math). */
export const HP_PER_FLOOR = 6;
