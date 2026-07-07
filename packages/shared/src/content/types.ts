/**
 * Content type definitions. Items, enemies, classes, and biomes are authored as
 * plain typed data (CONTENT.md first, then here — AGENTS.md §3.5). The run layer
 * compiles these into the sim's flat `CombatantSpec`s; the sim never sees them.
 */

import type { StatusKind } from '../sim/constants.js';
import type { EffectOp, Trigger } from '../sim/types.js';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythic';

export type Tag = 'blade' | 'bulwark' | 'arcane' | 'ember' | 'venom' | 'frost' | 'shadow' | 'wild';

/** Equip slots (GDD §3.4): 8 total — weapon×2 (or one 2-hand), helm, armor, boots, trinket×2, relic. */
export type EquipSlot = 'weapon' | 'helm' | 'armor' | 'boots' | 'trinket' | 'relic';

export type ItemKind = EquipSlot | 'weapon2h' | 'consumable' | 'material';

/** Hero stat keys that item modifiers can touch. */
export type StatKey =
  | 'maxHp'
  | 'armor'
  | 'speedPct'
  | 'critChancePct'
  | 'critDamagePct'
  | 'dodgePct'
  | 'lifestealPct'
  | 'thorns';

export interface StatMod {
  stat: StatKey;
  value: number;
  /** Whether the value scales with ★ (default true). */
  scales?: boolean;
  /** Minimum star for this modifier to apply (e.g. an Awakened +Crit at ★3). */
  minStar?: number;
}

/**
 * An authored trigger→effect line. Phase 1 activates only ★1 lines (minStar ≤ 1);
 * Awakened (minStar 3) and Zenith (minStar 5) lines are authored in Phase 2
 * (ROADMAP: "Awakened/Zenith effect lines land in Phase 2").
 */
export interface ItemEffect {
  trigger: Trigger;
  ops: EffectOp[];
  chancePct?: number;
  everyNthHit?: number;
  minHitPctMax?: number;
  /** Minimum star for this line to be active (1 default). */
  minStar?: number;
  /** Whether the numeric magnitudes scale with ★ (default true). */
  scales?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  tags: Tag[];
  flavor: string;
  /** Weapons: base cooldown in seconds at ★1. */
  cooldownSeconds?: number;
  /** Weapons: explicit ★1 per-hit damage; if omitted, derived from rarity×cooldown. */
  weaponDamage?: number;
  twoHanded?: boolean;
  /** Start-of-fight Ward as % of max HP (e.g. Aegis). */
  startWardPct?: number;
  mods?: StatMod[];
  effects?: ItemEffect[];
  /** ★5 rename (display only in Phase 1; the transform effect is Phase 2). */
  zenithName?: string;
  /** Restricted to a class relic slot (class id) — relics never drop. */
  relicOf?: ClassId;
  /** Run-level economy: bonus gold per fight won (e.g. Tax-Stamp of the Gate). Scales with ★. */
  goldPerWin?: number;
}

/**
 * When an auto-trigger consumable fires (CONTENT §3.4, "player sets condition").
 * Maps to a sim trigger (or a fight-eligibility gate for `vsElite`) in run/build.
 */
export type ConsumableCondition =
  | 'fightStart'
  | 'hpBelow70'
  | 'hpBelow40'
  | 'doomfall'
  | 'vsElite';

export interface ConsumableDef {
  id: string;
  name: string;
  rarity: Rarity;
  flavor: string;
  /** Effect applied when the consumable auto-triggers. */
  ops: EffectOp[];
  /** Condition it fires on until the player picks another (CONTENT §3.4). */
  defaultCondition: ConsumableCondition;
}

export interface MaterialDef {
  id: string;
  name: string;
  flavor: string;
  /** Socket effect: passive stat mods and/or a triggered micro-effect. */
  mods?: StatMod[];
  effect?: ItemEffect;
  dropsFrom: string;
}

export type EnemyRole = 'regular' | 'elite' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  role: EnemyRole;
  baseHp: number;
  baseDamage: number;
  cooldownSeconds: number;
  armor?: number;
  dodgePct?: number;
  /** Sim-level mechanics (e.g. Toll-Keeper stun). Run-level checks live in run/. */
  effects?: ItemEffect[];
  /** Cannot be crit — the honest-damage check (The Unshelved, Archive). */
  critImmune?: boolean;
  /** DoT of this status heals it instead of hurting (Cinder Widow ← Burn, Foundry). */
  healsFromStatus?: StatusKind;
  /** Sustained self-heal, % max HP/sec (Prior of Teeth, floor 50). */
  selfHealPctPerSec?: number;
  /** …halved once this many total status stacks sit on it (the density check). */
  healHalvedAtStacks?: number;
  /** The build axis this enemy checks (flavor/legibility). */
  check: string;
  flavor: string;
}

export type ClassId = 'vanguard' | 'duelist' | 'arcanist';

export interface ClassBaseStats {
  maxHp: number;
  armor: number;
  speedPct: number;
  critChancePct: number;
  critDamagePct: number;
  dodgePct: number;
  lifestealPct: number;
  thorns: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  fantasy: string;
  base: ClassBaseStats;
  relicId: string;
  startItemIds: string[];
  startConsumableIds: string[];
  /** Honor tier at which this class unlocks (0 = from the start). */
  unlockTier: number;
}

/** A run modifier (CONTENT §6). Grants +15% Honor; the penalty is enforced in run code. */
export interface VowDef {
  id: string;
  name: string;
  flavor: string;
  penalty: string;
}

/** One choice at an event door; its index maps to a handler in run/events. */
export interface EventOption {
  label: string;
  /** Short outcome description for the UI. */
  blurb: string;
}

/**
 * An event (door type, CONTENT §5). Display metadata is authored here; the bespoke
 * state changes per option live in run/events (they touch run state in ways too
 * varied to model declaratively).
 */
export interface EventDef {
  id: string;
  name: string;
  flavor: string;
  options: EventOption[];
}

export interface BiomeDef {
  id: string;
  name: string;
  /** Inclusive floor range this biome owns. */
  floors: [number, number];
  /** Palette accent name (ART_DIRECTION §1). */
  accent: string;
  regularIds: string[];
  eliteId: string;
  bossId: string;
  bossFloor: number;
}
