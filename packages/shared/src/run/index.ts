/** Run state machine — pure reducers over run state + seed (ARCHITECTURE §2, §3). */
export * from './types.js';
export {
  startRun,
  applyCommand,
  prepareFight,
  resolveFight,
  runPendingFight,
  makeSummary,
  killerName,
  type PreparedFight,
} from './reducer.js';
export {
  buildHeroSpec,
  buildEnemySpecs,
  buildCombatSpec,
  buildDuelSpec,
  snapshotOf,
  goldPerWin,
  tagCounts,
} from './build.js';
export { TAG_SYNERGIES, type Synergy } from '../content/synergies.js';
export { generateDoors, isBossFloor, isShopFloor } from './doors.js';
export { generateShop, itemPrice, requestableOwned } from './shop.js';
export { rollLoot, rollGold, rollRarity, rollDrop, pickItemOfRarity } from './loot.js';
export { equip, unequip, sell, fuse, sellValue, pushBackpack } from './inventory.js';
export {
  buildCodex,
  buildCodexFrom,
  mergeCodexProgress,
  recordCodexItem,
  recordCodexKills,
  type Codex,
  type CodexEntry,
  type CodexLoreLine,
} from './codex.js';
export {
  cumulativeClimbHonor,
  climbHonorForFloor,
  climbHonorForFrontier,
  honorTier,
  honorTierRank,
} from './honor.js';
export {
  echoBounty,
  echoMarks,
  echoAiBonusPct,
  echoIsSpent,
  graveCopyOptions,
  ECHO_MAX_DEFEATS,
  ECHO_MAX_AGE_DAYS,
  ECHO_DEFENSE_HONOR,
  ECHO_DEFENSE_MARKS,
} from './echo.js';
export { deriveRng, deriveFightSeed, RNG_PURPOSE, type RngPurpose } from './rng.js';
export { applyBoon } from './boons.js';
