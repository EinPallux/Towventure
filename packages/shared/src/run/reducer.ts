/**
 * The run reducer — the single gameplay mutation surface (ARCHITECTURE §3). Pure:
 * `applyCommand(state, cmd)` clones, validates, and returns a new state or a typed
 * rejection. The server runs these for authority; the client runs the same code
 * for optimistic UI. Fights are resolved separately (prepareFight → simulate →
 * resolveFight) because the sim seed is server-drawn.
 */

import { getClass, getEnemy } from '../content/registry.js';
import { simulate } from '../sim/engine.js';
import type { SimEvent, SimResult } from '../sim/types.js';
import { buildCombatSpec, goldPerWin } from './build.js';
import { generateDoors, isShopFloor } from './doors.js';
import { climbHonorForFrontier, honorTier } from './honor.js';
import { equip, fuse, pushBackpack, sell, unequip } from './inventory.js';
import { rollLoot } from './loot.js';
import { RNG_PURPOSE, deriveFightSeed, deriveRng } from './rng.js';
import { generateShop } from './shop.js';
import type { Command, CommandResult, EquipState, RunState, RunSummary } from './types.js';

const STARTING_BACKPACK = 12;

/**
 * Deep-clone run state. `RunState` is plain JSON (null, not undefined, for empty
 * slots), so a round-trip is portable (no `structuredClone` lib dependency in the
 * Node-free build) and deterministic.
 */
function cloneState(state: RunState): RunState {
  return JSON.parse(JSON.stringify(state)) as RunState;
}

function emptyEquipment(): EquipState {
  return {
    weapon1: null,
    weapon2: null,
    helm: null,
    armor: null,
    boots: null,
    trinket1: null,
    trinket2: null,
    relic: null,
  };
}

/** Create a fresh run for a class + vows, seeded (server draws the seed). */
export function startRun(classId: RunState['classId'], vows: string[], seed: number): RunState {
  const cls = getClass(classId);
  const state: RunState = {
    v: 1,
    seed: seed >>> 0,
    classId,
    vows,
    floor: 1,
    gold: 0,
    status: 'active',
    phase: 'doors',
    nextUid: 1,
    equipment: emptyEquipment(),
    backpack: [],
    backpackSize: STARTING_BACKPACK,
    doors: null,
    pendingFight: null,
    fightCounter: 0,
    pendingItem: null,
    lastGold: 0,
    shop: null,
    floorsCleared: 0,
    bestFloor: 1,
    damageDealt: 0,
    fightsWon: 0,
    shopSlotsSinceEpic: 0,
    requestsThisRun: 0,
    deathInfo: null,
  };
  // Relic (fixed) + start items equipped; start consumables into the backpack.
  state.equipment.relic = { uid: `i${state.nextUid++}`, itemId: cls.relicId, star: 1 };
  for (const itemId of cls.startItemIds) {
    const inst = pushBackpack(state, itemId, 1);
    const err = equip(state, inst.uid);
    if (err) throw new Error(`start item ${itemId} could not be equipped: ${err}`);
  }
  for (const consId of cls.startConsumableIds) pushBackpack(state, consId, 1);

  state.doors = generateDoors(state.seed, 1);
  return state;
}

const INVENTORY_PHASES = new Set(['doors', 'reward', 'shop']);

function reject(error: string): CommandResult {
  return { ok: false, error };
}

/** Apply one command. Returns the new state or a rejection (never throws on bad input). */
export function applyCommand(state: RunState, command: Command): CommandResult {
  if (state.status !== 'active' && command.type !== 'abandonRun') {
    return reject('this run has ended');
  }
  const draft = cloneState(state);

  switch (command.type) {
    case 'chooseDoor': {
      if (draft.phase !== 'doors' || !draft.doors) return reject('no doors to choose right now');
      const door = draft.doors[command.doorIndex];
      if (!door) return reject('no such door');
      if (door.kind === 'shop') return reject('shop floors have no doors');
      draft.pendingFight = { kind: door.kind, enemyIds: door.enemyIds };
      draft.phase = 'fight';
      draft.doors = null;
      return { ok: true, state: draft };
    }
    case 'takeLoot': {
      if (draft.phase !== 'reward') return reject('no loot pending');
      if (!draft.pendingItem) return reject('there is nothing to take');
      if (command.take) {
        if (draft.backpack.length >= draft.backpackSize) {
          return reject('backpack is full — sell or fuse to make room, then take it');
        }
        pushBackpack(draft, draft.pendingItem, 1);
      }
      draft.pendingItem = null;
      return { ok: true, state: draft };
    }
    case 'equip': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot change gear now');
      const err = equip(draft, command.uid, command.slot);
      return err ? reject(err) : { ok: true, state: draft };
    }
    case 'unequip': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot change gear now');
      const err = unequip(draft, command.slot);
      return err ? reject(err) : { ok: true, state: draft };
    }
    case 'fuse': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot fuse now');
      const err = fuse(draft, command.uid1, command.uid2);
      return err ? reject(err) : { ok: true, state: draft };
    }
    case 'sell': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot sell now');
      const err = sell(draft, command.uid);
      return err ? reject(err) : { ok: true, state: draft };
    }
    case 'buy':
      return buyFromShop(draft, command.slotIndex);
    case 'reroll':
      return rerollShop(draft);
    case 'leaveShop': {
      if (draft.phase !== 'shop') return reject('not in a shop');
      draft.shop = null;
      advanceFloor(draft);
      return { ok: true, state: draft };
    }
    case 'proceed': {
      if (draft.phase !== 'reward') return reject('nothing to proceed from');
      if (draft.pendingItem) return reject('resolve the loot drop first');
      advanceFloor(draft);
      return { ok: true, state: draft };
    }
    case 'abandonRun': {
      draft.status = 'abandoned';
      draft.phase = 'ended';
      return { ok: true, state: draft };
    }
  }
}

function buyFromShop(draft: RunState, slotIndex: number): CommandResult {
  if (draft.phase !== 'shop' || !draft.shop) return reject('not in a shop');
  const slot = draft.shop.slots[slotIndex];
  if (!slot) return reject('no such shop slot');
  if (slot.sold) return reject('already bought');
  if (draft.gold < slot.price) return reject('not enough gold');
  if (draft.backpack.length >= draft.backpackSize) return reject('backpack is full');
  draft.gold -= slot.price;
  slot.sold = true;
  pushBackpack(draft, slot.refId, slot.star);
  if (slot.kind === 'requestedCopy') draft.requestsThisRun += 1;
  return { ok: true, state: draft };
}

function rerollShop(draft: RunState): CommandResult {
  if (draft.phase !== 'shop' || !draft.shop) return reject('not in a shop');
  if (draft.gold < draft.shop.rerollPrice) return reject('not enough gold to reroll');
  draft.gold -= draft.shop.rerollPrice;
  const prevCount = draft.shop.rerollCount + 1;
  const rng = deriveRng(draft.seed, draft.floor, RNG_PURPOSE.shop, prevCount);
  const { shop, shopSlotsSinceEpic } = generateShop(draft, rng);
  // Escalating reroll price (×1.6 each), resets when the shop regenerates on a new floor.
  let price = draft.shop.rerollPrice;
  price = Math.trunc((price * 16) / 10);
  draft.shop = { ...shop, rerollCount: prevCount, rerollPrice: price };
  draft.shopSlotsSinceEpic = shopSlotsSinceEpic;
  return { ok: true, state: draft };
}

function advanceFloor(draft: RunState): void {
  draft.floorsCleared += 1;
  draft.floor += 1;
  if (draft.floor > draft.bestFloor) draft.bestFloor = draft.floor;
  draft.pendingFight = null;
  draft.pendingItem = null;
  if (isShopFloor(draft.floor)) {
    const rng = deriveRng(draft.seed, draft.floor, RNG_PURPOSE.shop, 0);
    const { shop, shopSlotsSinceEpic } = generateShop(draft, rng);
    draft.shop = shop;
    draft.shopSlotsSinceEpic = shopSlotsSinceEpic;
    draft.phase = 'shop';
    draft.doors = null;
  } else {
    draft.doors = generateDoors(draft.seed, draft.floor);
    draft.phase = 'doors';
    draft.shop = null;
  }
}

// ─── Fight resolution (server: prepareFight → simulate → resolveFight) ─────────

export interface PreparedFight {
  spec: ReturnType<typeof buildCombatSpec>;
  seed: number;
}

/** Build the sim input + seed for the currently pending fight (server-side). */
export function prepareFight(state: RunState): PreparedFight | null {
  if (state.phase !== 'fight' || !state.pendingFight) return null;
  const seed = deriveFightSeed(state.seed, state.floor, state.fightCounter);
  return { spec: buildCombatSpec(state, state.pendingFight.enemyIds), seed };
}

function analyzeFight(events: SimEvent[]): { heroDamage: number; killerEnemyIdx: number | null } {
  let heroDamage = 0;
  let lastHeroHitFrom: number | null = null;
  let doomfallKilled = false;
  let heroDead = false;
  for (const e of events) {
    if (e.type === 'hit' && e.from === 0) heroDamage += e.dmg;
    else if (e.type === 'thorns' && e.from === 0) heroDamage += e.dmg;
    else if (e.type === 'dot' && e.to !== 0 && e.dmg > 0) heroDamage += e.dmg;
    if (e.type === 'hit' && e.to === 0) lastHeroHitFrom = e.from;
    if (e.type === 'doomfallTick' && e.who === 0) doomfallKilled = true;
    if (e.type === 'death' && e.who === 0) heroDead = true;
  }
  if (!heroDead) return { heroDamage, killerEnemyIdx: null };
  // Prefer the last melee attacker; else attribute to Doomfall.
  if (lastHeroHitFrom !== null) return { heroDamage, killerEnemyIdx: lastHeroHitFrom };
  return { heroDamage, killerEnemyIdx: doomfallKilled ? -1 : null };
}

/** Fold a completed fight result into run state (win → loot/reward; loss → death). */
export function resolveFight(state: RunState, result: SimResult): RunState {
  if (state.phase !== 'fight' || !state.pendingFight) return state;
  const draft = cloneState(state);
  const fight = draft.pendingFight!;
  const { heroDamage, killerEnemyIdx } = analyzeFight(result.events);
  draft.damageDealt += heroDamage;
  const fightCounter = draft.fightCounter;

  if (result.winner === 'hero') {
    const rng = deriveRng(draft.seed, draft.floor, RNG_PURPOSE.loot, fightCounter);
    const loot = rollLoot(draft.floor, fight.kind, rng);
    const bonus = goldPerWin(draft);
    draft.gold += loot.gold + bonus;
    draft.lastGold = loot.gold + bonus;
    draft.pendingItem = loot.itemId ?? null;
    draft.fightsWon += 1;
    draft.pendingFight = null;
    draft.phase = 'reward';
  } else {
    const enemyId =
      killerEnemyIdx !== null && killerEnemyIdx > 0
        ? (fight.enemyIds[killerEnemyIdx - 1] ?? fight.enemyIds[0]!)
        : killerEnemyIdx === -1
          ? 'doomfall'
          : fight.enemyIds[0]!;
    draft.status = 'dead';
    draft.phase = 'ended';
    draft.pendingFight = null;
    draft.deathInfo = { floor: draft.floor, killerEnemyId: enemyId, endTick: result.endTick };
  }
  draft.fightCounter += 1;
  return draft;
}

/** Convenience for tests/tools: run the pending fight to completion and fold it in. */
export function runPendingFight(state: RunState): { result: SimResult; state: RunState } | null {
  const prepared = prepareFight(state);
  if (!prepared) return null;
  const result = simulate(prepared.spec, prepared.seed);
  return { result, state: resolveFight(state, result) };
}

export function makeSummary(state: RunState): RunSummary {
  const vowCount = state.vows.length;
  const climb = climbHonorForFrontier(0, state.bestFloor, vowCount);
  return {
    floor: state.floor,
    bestFloor: state.bestFloor,
    fightsWon: state.fightsWon,
    damageDealt: state.damageDealt,
    gold: state.gold,
    climbHonor: climb,
    tier: honorTier(climb).name,
  };
}

/** The enemy that landed the killing blow, for the death screen. */
export function killerName(state: RunState): string | null {
  if (!state.deathInfo) return null;
  if (state.deathInfo.killerEnemyId === 'doomfall') return 'Doomfall';
  try {
    return getEnemy(state.deathInfo.killerEnemyId).name;
  } catch {
    return state.deathInfo.killerEnemyId;
  }
}
