/**
 * Build compiler — turns a run's class + equipped items (and scaled enemies) into
 * the sim's flat integer `CombatantSpec`s. This is the only place ★ scaling and
 * slot-order resolution happen; the sim itself is content-blind (ARCHITECTURE §4).
 *
 * Slot order (BALANCE §1): weapon1, weapon2, helm, armor, boots, trinket1,
 * trinket2, relic — effects fire in exactly this order.
 */

import { scaleToStar } from '../content/constants.js';
import {
  cooldownTicks,
  deriveWeaponDamage,
  findConsumable,
  findMaterial,
  getClass,
  getEnemy,
  getItem,
} from '../content/registry.js';
import { TAG_SYNERGIES } from '../content/synergies.js';
import type { ConsumableCondition, ItemDef, ItemEffect, StatMod, Tag } from '../content/types.js';
import {
  DOOMFALL_START_TICKS,
  DOOMFALL_START_TICKS_HASTE,
  HP_PER_FLOOR,
} from '../sim/constants.js';
import type {
  CombatSpec,
  CombatantSpec,
  EffectBinding,
  EffectOp,
  Trigger,
  WeaponSpec,
} from '../sim/types.js';
import type { InventoryItem, RunState } from './types.js';

const SLOT_ORDER = [
  'weapon1',
  'weapon2',
  'helm',
  'armor',
  'boots',
  'trinket1',
  'trinket2',
  'relic',
] as const;

function scaleOp(op: EffectOp, star: number): EffectOp {
  switch (op.op) {
    case 'applyStatus':
      return { ...op, stacks: scaleToStar(op.stacks, star) };
    case 'gainArmor':
      return { ...op, amount: scaleToStar(op.amount, star) };
    case 'gainWard':
      return { ...op, amount: scaleToStar(op.amount, star) };
    case 'gainWardPctMax':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'heal':
      return { ...op, amount: scaleToStar(op.amount, star) };
    case 'healPctMax':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'damageWeaponPct':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'buffDamagePct':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'buffSpeedPct':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'buffNextHitPct':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'buffDamageVsStatusPct':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'detonateStatus':
      return { ...op, pctPerStack: scaleToStar(op.pctPerStack, star) };
    case 'chainHit':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'buffStatusDamagePct':
      return { ...op, pct: scaleToStar(op.pct, star) };
    case 'buffNextHitStatus':
      return { ...op, stacks: scaleToStar(op.stacks, star) };
    // Structural magnitudes that must not scale with ★.
    case 'cleanse':
    case 'retaliateThorns':
    case 'stun':
      return op;
  }
}

function compileEffect(source: string, e: ItemEffect, star: number): EffectBinding {
  const scales = e.scales !== false;
  const ops = scales ? e.ops.map((op) => scaleOp(op, star)) : e.ops;
  const binding: EffectBinding = { source, trigger: e.trigger, ops };
  if (e.chancePct !== undefined) binding.chancePct = e.chancePct;
  if (e.everyNthHit !== undefined) binding.everyNthHit = e.everyNthHit;
  if (e.minHitPctMax !== undefined) binding.minHitPctMax = e.minHitPctMax;
  return binding;
}

function scaleMod(m: StatMod, star: number): number {
  return m.scales === false ? m.value : scaleToStar(m.value, star);
}

interface Accum {
  maxHp: number;
  armor: number;
  speedPct: number;
  critChancePct: number;
  critDamagePct: number;
  dodgePct: number;
  lifestealPct: number;
  thorns: number;
  startWardPct: number;
  weapons: WeaponSpec[];
  effects: EffectBinding[];
  goldPerWin: number;
}

function addStat(acc: Accum, stat: StatMod['stat'], v: number): void {
  switch (stat) {
    case 'maxHp':
      acc.maxHp += v;
      break;
    case 'armor':
      acc.armor += v;
      break;
    case 'speedPct':
      acc.speedPct += v;
      break;
    case 'critChancePct':
      acc.critChancePct += v;
      break;
    case 'critDamagePct':
      acc.critDamagePct += v;
      break;
    case 'dodgePct':
      acc.dodgePct += v;
      break;
    case 'lifestealPct':
      acc.lifestealPct += v;
      break;
    case 'thorns':
      acc.thorns += v;
      break;
  }
}

function applyItem(acc: Accum, def: ItemDef, inst: InventoryItem): void {
  const star = inst.star;
  for (const m of def.mods ?? []) {
    if ((m.minStar ?? 1) > star) continue; // Awakened (★3) stat lines gate here
    addStat(acc, m.stat, scaleMod(m, star));
  }
  if (def.startWardPct) acc.startWardPct += def.startWardPct;
  if (def.goldPerWin) acc.goldPerWin += scaleToStar(def.goldPerWin, star);
  for (const e of def.effects ?? []) {
    // Phase 1 activates only lines available at this star (Awakened/Zenith are Phase 2).
    if ((e.minStar ?? 1) > star) continue;
    acc.effects.push(compileEffect(def.name, e, star));
  }
  if (def.cooldownSeconds !== undefined) {
    acc.weapons.push({
      name: def.name,
      cooldownTicks: cooldownTicks(def.cooldownSeconds),
      damage: scaleToStar(deriveWeaponDamage(def), star),
    });
  }
  // Infusions: each socketed material's mods + micro-effect (GDD §4.2). Materials
  // don't scale with ★ — the socket is the same whatever tier the host item is.
  for (const matId of inst.sockets ?? []) {
    const mat = findMaterial(matId);
    if (!mat) continue;
    for (const m of mat.mods ?? []) addStat(acc, m.stat, m.value);
    if (mat.effect) acc.effects.push(compileEffect(mat.name, mat.effect, 1));
  }
}

/** Count each tag across the 8 equip slots (CONTENT §2.2). Insertion-ordered. */
export function tagCounts(state: RunState): Map<Tag, number> {
  const counts = new Map<Tag, number>();
  for (const slot of SLOT_ORDER) {
    const inst = state.equipment[slot];
    if (!inst) continue;
    for (const tag of getItem(inst.itemId).tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

/** Apply every met tag-synergy threshold's mods + effects to the accumulator. */
function applySynergies(acc: Accum, counts: Map<Tag, number>): void {
  for (const [tag, count] of counts) {
    for (const syn of TAG_SYNERGIES[tag] ?? []) {
      if (count < syn.threshold) continue;
      const source = `${tag} (${syn.threshold})`;
      for (const m of syn.mods ?? []) addStat(acc, m.stat, m.value); // synergies don't scale with ★
      for (const e of syn.effects ?? []) acc.effects.push(compileEffect(source, e, 1));
    }
  }
}

/** Compile the hero's current class + equipment into a `CombatantSpec`. */
export function buildHeroSpec(state: RunState): CombatantSpec {
  const cls = getClass(state.classId);
  const acc: Accum = {
    maxHp: cls.base.maxHp + HP_PER_FLOOR * state.floorsCleared,
    armor: cls.base.armor,
    speedPct: cls.base.speedPct,
    critChancePct: cls.base.critChancePct,
    critDamagePct: cls.base.critDamagePct,
    dodgePct: cls.base.dodgePct,
    lifestealPct: cls.base.lifestealPct,
    thorns: cls.base.thorns,
    startWardPct: 0,
    weapons: [],
    effects: [],
    goldPerWin: 0,
  };
  for (const slot of SLOT_ORDER) {
    const inst = state.equipment[slot];
    if (inst) applyItem(acc, getItem(inst.itemId), inst);
  }
  applySynergies(acc, tagCounts(state));
  // Vow of Glass: −25% Max HP, +25% damage (a fight-start damage buff). CONTENT §6.
  if (state.vows.includes('vow_of_glass')) {
    acc.maxHp = Math.trunc((acc.maxHp * 75) / 100);
    acc.effects.push({
      source: 'Vow of Glass',
      trigger: { kind: 'OnFightStart' },
      ops: [{ op: 'buffDamagePct', pct: 25 }],
    });
  }
  const spec: CombatantSpec = {
    id: 'hero',
    name: cls.name,
    maxHp: acc.maxHp,
    armor: acc.armor,
    speedPct: acc.speedPct,
    critChancePct: acc.critChancePct,
    critDamagePct: acc.critDamagePct,
    dodgePct: acc.dodgePct,
    lifestealPct: acc.lifestealPct,
    thorns: acc.thorns,
    weapons: acc.weapons,
    effects: acc.effects,
  };
  if (acc.startWardPct > 0) spec.startWardPct = acc.startWardPct;
  return spec;
}

/** Bonus gold per fight won granted by equipped items (Tax-Stamp, etc.). */
export function goldPerWin(state: RunState): number {
  let g = 0;
  for (const slot of SLOT_ORDER) {
    const inst = state.equipment[slot];
    if (!inst) continue;
    const def = getItem(inst.itemId);
    if (def.goldPerWin) g += scaleToStar(def.goldPerWin, inst.star);
  }
  return g;
}

function scaleFloor(base: number, floor: number, up: boolean): number {
  // HP steps ×1.06 (×1.045 past the floor-50 knee); damage steps ×1.05 (BALANCE §6).
  let v = base;
  for (let i = 1; i <= floor; i++) {
    if (up) v = i <= 50 ? Math.trunc((v * 106) / 100) : Math.trunc((v * 1045) / 1000);
    else v = Math.trunc((v * 105) / 100);
  }
  return v;
}

/** Compile a list of enemy ids at a floor into scaled `CombatantSpec`s (BALANCE §6). */
export function buildEnemySpecs(enemyIds: string[], floor: number): CombatantSpec[] {
  return enemyIds.map((id, i) => {
    const def = getEnemy(id);
    let hp = scaleFloor(def.baseHp, floor, true);
    let dmg = scaleFloor(def.baseDamage, floor, false);
    if (def.role === 'elite') {
      hp = Math.trunc((hp * 18) / 10);
      dmg = Math.trunc((dmg * 135) / 100);
    } else if (def.role === 'boss') {
      hp = Math.trunc((hp * 45) / 10);
      dmg = Math.trunc((dmg * 15) / 10);
    }
    const effects: EffectBinding[] = (def.effects ?? []).map((e) => compileEffect(def.name, e, 1));
    const spec: CombatantSpec = {
      id: `e${i}`,
      name: def.name,
      maxHp: hp,
      armor: def.armor ?? 0,
      speedPct: 0,
      critChancePct: 0,
      critDamagePct: 0,
      dodgePct: def.dodgePct ?? 0,
      lifestealPct: 0,
      thorns: 0,
      weapons: [
        {
          name: `${def.name} attack`,
          cooldownTicks: cooldownTicks(def.cooldownSeconds),
          damage: dmg,
        },
      ],
      effects,
    };
    // Optional anti-autopilot mechanics (biomes 2–5, CONTENT §4).
    if (def.critImmune) spec.critImmune = true;
    if (def.healsFromStatus) spec.healsFromStatus = def.healsFromStatus;
    if (def.selfHealPctPerSec !== undefined) spec.selfHealPctPerSec = def.selfHealPctPerSec;
    if (def.healHalvedAtStacks !== undefined) spec.healHalvedAtStacks = def.healHalvedAtStacks;
    return spec;
  });
}

/** The sim trigger a consumable condition maps to (`vsElite` gates eligibility, then fires at start). */
function conditionTrigger(condition: ConsumableCondition): Trigger {
  switch (condition) {
    case 'hpBelow70':
      return { kind: 'OnHpBelow', pct: 70 };
    case 'hpBelow40':
      return { kind: 'OnHpBelow', pct: 40 };
    case 'doomfall':
      return { kind: 'OnDoomfall' };
    case 'fightStart':
    case 'vsElite':
      return { kind: 'OnFightStart' };
  }
}

/**
 * Compile held consumables into one-shot hero effect bindings for THIS fight
 * (CONTENT §3.4). `vsElite` consumables are only eligible when the roster has an
 * elite or boss. The sim reports which fired (`firedOneShots`); resolveFight
 * consumes exactly those. Consumables don't scale with ★ (they aren't fused).
 */
export function consumableBindings(state: RunState, enemyIds: string[]): EffectBinding[] {
  const vsElitePresent = enemyIds.some((id) => {
    const role = getEnemy(id).role;
    return role === 'elite' || role === 'boss';
  });
  const out: EffectBinding[] = [];
  for (const inst of state.backpack) {
    const def = findConsumable(inst.itemId);
    if (!def) continue;
    const condition = inst.condition ?? def.defaultCondition;
    if (condition === 'vsElite' && !vsElitePresent) continue;
    out.push({
      source: def.name,
      trigger: conditionTrigger(condition),
      ops: def.ops,
      oneShotId: inst.uid,
    });
  }
  return out;
}

/** Build the full `CombatSpec` for a pending fight (hero + scaled enemies + Doomfall). */
export function buildCombatSpec(state: RunState, enemyIds: string[]): CombatSpec {
  const haste = state.vows.includes('vow_of_haste');
  const hero = buildHeroSpec(state);
  // Consumables fire after equipment/synergy effects, in backpack order — unless the
  // Vow of Silence forbids them (CONTENT §6).
  if (!state.vows.includes('vow_of_silence')) {
    hero.effects = [...hero.effects, ...consumableBindings(state, enemyIds)];
  }
  return {
    hero,
    enemies: buildEnemySpecs(enemyIds, state.floor),
    doomfallStartTicks: haste ? DOOMFALL_START_TICKS_HASTE : DOOMFALL_START_TICKS,
  };
}
