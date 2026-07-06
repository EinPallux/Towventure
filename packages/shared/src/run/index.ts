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
export { buildHeroSpec, buildEnemySpecs, buildCombatSpec, goldPerWin } from './build.js';
export { generateDoors, isBossFloor, isShopFloor } from './doors.js';
export { generateShop, itemPrice, requestableOwned } from './shop.js';
export { rollLoot, rollGold, rollRarity, rollDrop, pickItemOfRarity } from './loot.js';
export { equip, unequip, sell, fuse, sellValue, pushBackpack } from './inventory.js';
export {
  cumulativeClimbHonor,
  climbHonorForFloor,
  climbHonorForFrontier,
  honorTier,
} from './honor.js';
export { deriveRng, deriveFightSeed, RNG_PURPOSE, type RngPurpose } from './rng.js';
