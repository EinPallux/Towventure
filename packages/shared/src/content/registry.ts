/**
 * Content registry — id→def lookups (insertion-ordered Maps, never key iteration)
 * and the small pure helpers that bridge authored content to sim/run integer math:
 * cooldown→ticks, derived weapon damage, sockets, floor→biome, floor→rarity band.
 */

import { TICKS_PER_SECOND } from '../sim/constants.js';
import { RARITY_BANDS, RARITY_POWER, SOCKETS_BY_RARITY } from './constants.js';
import { BIOMES } from './biomes.js';
import { CLASSES } from './classes.js';
import { CONSUMABLES } from './consumables.js';
import { ENEMIES } from './enemies.js';
import { EVENTS } from './events.js';
import { ITEMS } from './items.js';
import { MATERIALS } from './materials.js';
import { VOWS } from './vows.js';
import type {
  BiomeDef,
  ClassDef,
  ClassId,
  ConsumableDef,
  EnemyDef,
  EquipSlot,
  EventDef,
  ItemDef,
  ItemKind,
  MaterialDef,
  Rarity,
  VowDef,
} from './types.js';

function index<T extends { id: string }>(defs: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const d of defs) {
    if (m.has(d.id)) throw new Error(`duplicate content id: ${d.id}`);
    m.set(d.id, d);
  }
  return m;
}

const ITEM_MAP = index(ITEMS);
const CONSUMABLE_MAP = index(CONSUMABLES);
const MATERIAL_MAP = index(MATERIALS);
const ENEMY_MAP = index(ENEMIES);
const CLASS_MAP = index(CLASSES);
const BIOME_MAP = index(BIOMES);
const EVENT_MAP = index(EVENTS);
const VOW_MAP = index(VOWS);

export function getItem(id: string): ItemDef {
  const d = ITEM_MAP.get(id);
  if (!d) throw new Error(`unknown item: ${id}`);
  return d;
}
export function findItem(id: string): ItemDef | undefined {
  return ITEM_MAP.get(id);
}
export function getConsumable(id: string): ConsumableDef {
  const d = CONSUMABLE_MAP.get(id);
  if (!d) throw new Error(`unknown consumable: ${id}`);
  return d;
}
export function findConsumable(id: string): ConsumableDef | undefined {
  return CONSUMABLE_MAP.get(id);
}
export function getMaterial(id: string): MaterialDef {
  const d = MATERIAL_MAP.get(id);
  if (!d) throw new Error(`unknown material: ${id}`);
  return d;
}
export function findMaterial(id: string): MaterialDef | undefined {
  return MATERIAL_MAP.get(id);
}
export function getEnemy(id: string): EnemyDef {
  const d = ENEMY_MAP.get(id);
  if (!d) throw new Error(`unknown enemy: ${id}`);
  return d;
}
export function getClass(id: ClassId): ClassDef {
  const d = CLASS_MAP.get(id);
  if (!d) throw new Error(`unknown class: ${id}`);
  return d;
}
export function getBiome(id: string): BiomeDef {
  const d = BIOME_MAP.get(id);
  if (!d) throw new Error(`unknown biome: ${id}`);
  return d;
}
export function findEvent(id: string): EventDef | undefined {
  return EVENT_MAP.get(id);
}
export function findVow(id: string): VowDef | undefined {
  return VOW_MAP.get(id);
}
export function isVow(id: string): boolean {
  return VOW_MAP.has(id);
}

export { ITEMS, CONSUMABLES, MATERIALS, ENEMIES, CLASSES, BIOMES, EVENTS, VOWS };

/** Cooldown seconds → whole ticks (content authoring is in seconds; sim is ticks). */
export function cooldownTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** Derived ★1 weapon damage: rarity power × cooldown-in-ticks / 100 (equal DPS per rarity). */
export function deriveWeaponDamage(item: ItemDef): number {
  if (item.weaponDamage !== undefined) return item.weaponDamage;
  if (item.cooldownSeconds === undefined) return 0;
  return Math.trunc((RARITY_POWER[item.rarity] * cooldownTicks(item.cooldownSeconds)) / 100);
}

export function socketsFor(rarity: Rarity): number {
  return SOCKETS_BY_RARITY[rarity];
}

/** The equip slot an item kind occupies (weapons of both kinds occupy 'weapon'). */
export function equipSlotForKind(kind: ItemKind): EquipSlot | undefined {
  switch (kind) {
    case 'weapon':
    case 'weapon2h':
      return 'weapon';
    case 'helm':
    case 'armor':
    case 'boots':
    case 'trinket':
    case 'relic':
      return kind;
    default:
      return undefined;
  }
}

export function isEquippable(item: ItemDef): boolean {
  return equipSlotForKind(item.kind) !== undefined;
}

/** Which biome owns a floor. Beyond the last authored biome, loop it (Phase 1 placeholder). */
export function biomeForFloor(floor: number): BiomeDef {
  for (const b of BIOMES) {
    if (floor >= b.floors[0] && floor <= b.floors[1]) return b;
  }
  // Loop the last biome with scaling until deeper biomes are authored (Phase 2).
  return BIOMES[BIOMES.length - 1]!;
}

/** Rarity weight table (permille) for a floor's drops (BALANCE §5). */
export function rarityBandFor(floor: number): Record<Rarity, number> {
  for (const band of RARITY_BANDS) {
    if (floor <= band.maxFloor) return band.weights;
  }
  return RARITY_BANDS[RARITY_BANDS.length - 1]!.weights;
}

/**
 * The pool of item ids that can drop at a floor for a biome — Phase 1 uses the
 * global droppable pool (all non-relic equippables), filtered by the rolled
 * rarity. Relics never drop (they are class-granted).
 */
export function droppablePool(): ItemDef[] {
  return ITEMS.filter((i) => i.kind !== 'relic' && isEquippable(i));
}
