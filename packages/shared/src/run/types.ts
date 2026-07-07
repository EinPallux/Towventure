/**
 * Run-state types. `RunState` is the JSONB blob the server persists per run
 * (ARCHITECTURE.md §6). Commands are pure functions of `(state, command)` → new
 * state; the same reducers run on client (optimistic UI) and server (authority).
 * Everything here is integer/enumerable — no floats, no wall-clock (AGENTS §3.1).
 */

import type { ClassId, ConsumableCondition } from '../content/types.js';

/** An item instance in a run: a content id + fusion tier + a run-unique id. */
export interface InventoryItem {
  uid: string;
  itemId: string;
  star: number;
  /** Consumables only: the auto-fire condition (defaults to the def's, player-settable). */
  condition?: ConsumableCondition;
  /** Infused material ids, one per filled socket (≤ socketsFor(rarity); GDD §4.2). */
  sockets?: string[];
}

/** The 8 equip slots (GDD §3.4). A 2-hand weapon lives in `weapon1`; `weapon2` is then blocked. */
export interface EquipState {
  weapon1: InventoryItem | null;
  weapon2: InventoryItem | null;
  helm: InventoryItem | null;
  armor: InventoryItem | null;
  boots: InventoryItem | null;
  trinket1: InventoryItem | null;
  trinket2: InventoryItem | null;
  relic: InventoryItem | null;
}

export type EquipSlotId = keyof EquipState;

/**
 * The minimal slice of a run that determines a hero's combat spec — everything
 * `buildHeroSpec` reads. A death Echo or a Skirmish defense is a snapshot of exactly
 * this (Phase 3), so the same builder produces the fighting spec on both sides.
 */
export interface HeroBuild {
  classId: ClassId;
  floorsCleared: number;
  equipment: EquipState;
  vows: string[];
}

export type DoorKind = 'battle' | 'elite' | 'shop' | 'boss' | 'event';

export interface DoorOffer {
  kind: DoorKind;
  enemyIds: string[];
  /** Event doors carry the event id (kind === 'event'). */
  eventId?: string;
  /** Honest-but-partial preview string (GDD §3.2). */
  preview: string;
}

export type FightKind = 'battle' | 'elite' | 'boss';

export interface PendingFight {
  kind: FightKind;
  enemyIds: string[];
}

export type ShopSlotKind = 'item' | 'material' | 'consumable' | 'requestedCopy';

export interface ShopSlot {
  kind: ShopSlotKind;
  refId: string;
  star: number;
  price: number;
  sold: boolean;
}

export interface ShopState {
  slots: ShopSlot[];
  rerollCount: number;
  rerollPrice: number;
}

export interface DeathInfo {
  floor: number;
  killerEnemyId: string;
  endTick: number;
}

/** Codex discovery progress (CONTENT §7): items by highest ★ seen, enemies by kills. */
export interface CodexProgress {
  items: Record<string, number>;
  enemies: Record<string, number>;
}

export type RunPhase = 'doors' | 'fight' | 'reward' | 'shop' | 'event' | 'ended';

export type RunStatus = 'active' | 'dead' | 'abandoned';

export interface RunState {
  v: 1;
  seed: number;
  classId: ClassId;
  vows: string[];
  floor: number;
  gold: number;
  status: RunStatus;
  phase: RunPhase;
  nextUid: number;
  equipment: EquipState;
  backpack: InventoryItem[];
  backpackSize: number;
  doors: DoorOffer[] | null;
  pendingFight: PendingFight | null;
  /** Event id awaiting a resolveEvent choice (phase === 'event'). */
  pendingEvent: string | null;
  /** Monotonic fight index; derives fight + loot seeds so resume stays deterministic. */
  fightCounter: number;
  /** Item id of the drop awaiting a takeLoot decision (gold is auto-credited). */
  pendingItem: string | null;
  /** Gold credited by the most recent fight (for the reward screen). */
  lastGold: number;
  shop: ShopState | null;
  // run stats / summary
  floorsCleared: number;
  bestFloor: number;
  damageDealt: number;
  fightsWon: number;
  /** Bad-luck protection counter (shop item slots since an Epic+ was offered). */
  shopSlotsSinceEpic: number;
  /** Requested-copy escalation counter. */
  requestsThisRun: number;
  deathInfo: DeathInfo | null;
  /** Codex discovery accrued this run (CONTENT §7). */
  codex: CodexProgress;
}

// ─── Commands (the one gameplay mutation surface; validated by protocol zod) ──

export type Command =
  | { type: 'chooseDoor'; doorIndex: number }
  | { type: 'takeLoot'; take: boolean }
  | { type: 'equip'; uid: string; slot?: EquipSlotId }
  | { type: 'unequip'; slot: EquipSlotId }
  | { type: 'fuse'; uid1: string; uid2: string }
  | { type: 'infuse'; itemUid: string; materialUid: string; socketIndex?: number }
  | { type: 'sell'; uid: string }
  | { type: 'setConsumableCondition'; uid: string; condition: ConsumableCondition }
  | { type: 'buy'; slotIndex: number }
  | { type: 'reroll' }
  | { type: 'leaveShop' }
  | { type: 'resolveEvent'; optionIndex: number }
  | { type: 'proceed' }
  | { type: 'abandonRun' };

export type CommandType = Command['type'];

/** Result of applying a command: either the new state or a rejection reason. */
export type CommandResult = { ok: true; state: RunState } | { ok: false; error: string };

/** Summary shown on the death screen / share card (GDD §7.1). */
export interface RunSummary {
  floor: number;
  bestFloor: number;
  fightsWon: number;
  damageDealt: number;
  gold: number;
  climbHonor: number;
  tier: string;
}
