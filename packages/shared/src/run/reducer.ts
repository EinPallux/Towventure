/**
 * The run reducer — the single gameplay mutation surface (ARCHITECTURE §3). Pure:
 * `applyCommand(state, cmd)` clones, validates, and returns a new state or a typed
 * rejection. The server runs these for authority; the client runs the same code
 * for optimistic UI. Fights are resolved separately (prepareFight → simulate →
 * resolveFight) because the sim seed is server-drawn.
 */

import { findConsumable, findEvent, getClass, getEnemy, isVow } from '../content/registry.js';
import { MAX_VOWS } from '../content/vows.js';
import { simulate } from '../sim/engine.js';
import type { SimEvent, SimResult } from '../sim/types.js';
import { buildCombatSpec, buildDuelSpec, goldPerWin, snapshotOf } from './build.js';
import { recordCodexItem, recordCodexKills } from './codex.js';
import { graveCopyOptions } from './echo.js';
import { generateDoors, isShopFloor } from './doors.js';
import { applyEvent } from './events.js';
import { climbHonorForFrontier, honorTier } from './honor.js';
import {
  applySatchel,
  equip,
  fuse,
  infuse,
  isSatchel,
  pushBackpack,
  sell,
  unequip,
} from './inventory.js';
import { rollLoot } from './loot.js';
import { RNG_PURPOSE, deriveFightSeed, deriveRng } from './rng.js';
import { generateShop } from './shop.js';
import type { Command, CommandResult, EquipState, RunState, RunSummary } from './types.js';

const STARTING_BACKPACK = 12;

/** Bosses whose defeat always yields a specific Mythic (CONTENT §4.1). */
const GUARANTEED_BOSS_DROP: Record<string, string> = {
  the_sleepless_warden: 'the_sleepless_crown',
};

/**
 * Deep-clone run state. `RunState` is plain JSON (null, not undefined, for empty
 * slots), so a round-trip is portable (no `structuredClone` lib dependency in the
 * Node-free build) and deterministic.
 */
function cloneState(state: RunState): RunState {
  const draft = JSON.parse(JSON.stringify(state)) as RunState;
  // Normalize runs persisted before a field existed (forward-compatible reducers).
  if (!draft.codex) draft.codex = { items: {}, enemies: {} };
  if (draft.pendingGraveCopy === undefined) draft.pendingGraveCopy = null;
  return draft;
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
  // Defensive: only known vow ids, de-duplicated, capped — the +15%/vow Honor must
  // never attach to an unknown/duplicate vow even from a non-protocol caller.
  const cleanVows = [...new Set(vows.filter(isVow))].slice(0, MAX_VOWS);
  const state: RunState = {
    v: 1,
    seed: seed >>> 0,
    classId,
    vows: cleanVows,
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
    pendingEvent: null,
    fightCounter: 0,
    pendingItem: null,
    pendingGraveCopy: null,
    lastGold: 0,
    shop: null,
    floorsCleared: 0,
    bestFloor: 1,
    damageDealt: 0,
    fightsWon: 0,
    shopSlotsSinceEpic: 0,
    requestsThisRun: 0,
    deathInfo: null,
    codex: { items: {}, enemies: {} },
  };
  // Relic (fixed) + start items equipped; start consumables into the backpack.
  state.equipment.relic = { uid: `i${state.nextUid++}`, itemId: cls.relicId, star: 1 };
  recordCodexItem(state.codex, cls.relicId, 1); // the class relic is "discovered" at start
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
      if (door.kind === 'event') {
        draft.pendingEvent = door.eventId ?? null;
        draft.phase = 'event';
        draft.doors = null;
        return { ok: true, state: draft };
      }
      if (door.kind === 'echo') {
        if (!door.echo) return reject('echo door has no echo');
        draft.pendingFight = { kind: 'echo', enemyIds: [], echo: door.echo };
        draft.phase = 'fight';
        draft.doors = null;
        return { ok: true, state: draft };
      }
      draft.pendingFight = { kind: door.kind, enemyIds: door.enemyIds };
      draft.phase = 'fight';
      draft.doors = null;
      return { ok: true, state: draft };
    }
    case 'takeLoot': {
      if (draft.phase !== 'reward') return reject('no loot pending');
      if (!draft.pendingItem) return reject('there is nothing to take');
      if (command.take) {
        if (isSatchel(draft.pendingItem)) {
          applySatchel(draft, draft.pendingItem); // grows the backpack; not stored
        } else {
          if (draft.backpack.length >= draft.backpackSize) {
            return reject('backpack is full — sell or fuse to make room, then take it');
          }
          pushBackpack(draft, draft.pendingItem, 1);
        }
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
    case 'infuse': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot infuse now');
      const err = infuse(draft, command.itemUid, command.materialUid, command.socketIndex);
      return err ? reject(err) : { ok: true, state: draft };
    }
    case 'sell': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot sell now');
      const err = sell(draft, command.uid);
      return err ? reject(err) : { ok: true, state: draft };
    }
    case 'setConsumableCondition': {
      if (!INVENTORY_PHASES.has(draft.phase)) return reject('cannot change consumables now');
      const inst = draft.backpack.find((i) => i.uid === command.uid);
      if (!inst) return reject('no such item');
      if (!findConsumable(inst.itemId)) return reject('that item is not a consumable');
      inst.condition = command.condition;
      return { ok: true, state: draft };
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
    case 'resolveEvent': {
      if (draft.phase !== 'event' || !draft.pendingEvent) return reject('no event to resolve');
      const ev = findEvent(draft.pendingEvent);
      if (!ev) return reject('unknown event');
      if (command.optionIndex < 0 || command.optionIndex >= ev.options.length) {
        return reject('no such option');
      }
      const rng = deriveRng(draft.seed, draft.floor, RNG_PURPOSE.events, 0);
      const err = applyEvent(draft, draft.pendingEvent, command.optionIndex, rng);
      if (err) return reject(err);
      draft.pendingEvent = null;
      // An event that granted loot routes to the reward screen; otherwise the event
      // was the floor — advance. (advanceFloor clears pendingItem, so guard on it.)
      if (draft.pendingItem) draft.phase = 'reward';
      else advanceFloor(draft);
      return { ok: true, state: draft };
    }
    case 'chooseGraveCopy': {
      if (draft.phase !== 'reward' || !draft.pendingGraveCopy)
        return reject('no Grave-Copy to pick');
      const itemId = draft.pendingGraveCopy[command.index];
      if (!itemId) return reject('no such Grave-Copy option');
      // The copy is a ★1 of the Echo's item — capacity permitting; it's optional loot.
      if (draft.backpack.length >= draft.backpackSize) {
        return reject('backpack is full — sell or fuse to make room, then claim the Grave-Copy');
      }
      pushBackpack(draft, itemId, 1);
      draft.pendingGraveCopy = null;
      return { ok: true, state: draft };
    }
    case 'proceed': {
      if (draft.phase !== 'reward') return reject('nothing to proceed from');
      if (draft.pendingItem) return reject('resolve the loot drop first');
      // Proceeding past an unclaimed Grave-Copy forfeits it (the "Leave them all" path).
      draft.pendingGraveCopy = null;
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
  const satchel = isSatchel(slot.refId);
  if (!satchel && draft.backpack.length >= draft.backpackSize) return reject('backpack is full');
  draft.gold -= slot.price;
  slot.sold = true;
  if (satchel) applySatchel(draft, slot.refId);
  else pushBackpack(draft, slot.refId, slot.star);
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
  const pf = state.pendingFight;
  // An Echo fight duels a dead player's build through the same sim (GDD §8).
  if (pf.kind === 'echo' && pf.echo) {
    return { spec: buildDuelSpec(snapshotOf(state), pf.echo.build, pf.echo.bonusPct), seed };
  }
  return { spec: buildCombatSpec(state, pf.enemyIds), seed };
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
  // Spend the consumables that auto-fired this fight (win or lose).
  if (result.firedOneShots.length > 0) {
    const fired = new Set(result.firedOneShots);
    draft.backpack = draft.backpack.filter((i) => !fired.has(i.uid));
  }
  const fightCounter = draft.fightCounter;
  const isEcho = fight.kind === 'echo';

  if (result.winner === 'hero') {
    draft.fightsWon += 1;
    draft.pendingFight = null;
    draft.phase = 'reward';
    if (isEcho && fight.echo) {
      // An Echo kill pays a Grave-Copy (pick 1 of 3) instead of rolled loot; the
      // Honor bounty + Marks are credited server-side against the echo row (GDD §8).
      const opts = graveCopyOptions(fight.echo.build);
      draft.pendingGraveCopy = opts.length > 0 ? opts : null;
      draft.pendingItem = null;
      draft.lastGold = 0;
    } else {
      recordCodexKills(draft.codex, fight.enemyIds); // discovery: tally the fallen
      const rng = deriveRng(draft.seed, draft.floor, RNG_PURPOSE.loot, fightCounter);
      const loot = rollLoot(draft.floor, fight.kind, rng);
      const bonus = goldPerWin(draft);
      // Vow of Poverty: fights pay 40% less gold (the goldPerWin bonus is unaffected).
      const fightGold = draft.vows.includes('vow_of_poverty')
        ? Math.trunc((loot.gold * 60) / 100)
        : loot.gold;
      draft.gold += fightGold + bonus;
      draft.lastGold = fightGold + bonus;
      // Guaranteed boss drops override the rolled item (the RNG is still drawn so gold +
      // downstream draws stay deterministic). The Sleepless Warden always yields its Crown
      // (CONTENT §4.1; the per-account first-clear anti-farm is a server refinement).
      const guaranteed = GUARANTEED_BOSS_DROP[fight.enemyIds[0] ?? ''];
      draft.pendingItem = guaranteed ?? loot.itemId ?? null;
    }
  } else {
    draft.status = 'dead';
    draft.phase = 'ended';
    draft.pendingFight = null;
    if (isEcho && fight.echo) {
      // Losing to an Echo is a normal fight loss; the Echo's owner is credited a
      // defense win server-side (GDD §8). Record the slayer's name for the ritual.
      draft.deathInfo = {
        floor: draft.floor,
        killerEnemyId: 'echo',
        endTick: result.endTick,
        echoOwnerName: fight.echo.ownerName,
      };
    } else {
      const enemyId =
        killerEnemyIdx !== null && killerEnemyIdx > 0
          ? (fight.enemyIds[killerEnemyIdx - 1] ?? fight.enemyIds[0]!)
          : killerEnemyIdx === -1
            ? 'doomfall'
            : fight.enemyIds[0]!;
      draft.deathInfo = { floor: draft.floor, killerEnemyId: enemyId, endTick: result.endTick };
    }
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
  if (state.deathInfo.killerEnemyId === 'echo') {
    const name = state.deathInfo.echoOwnerName;
    return name ? `${name}'s Echo` : 'an Echo';
  }
  try {
    return getEnemy(state.deathInfo.killerEnemyId).name;
  } catch {
    return state.deathInfo.killerEnemyId;
  }
}
