/**
 * Item legibility helpers — turn authored content into tooltip text. Numbers are
 * always exact (ART_DIRECTION §8); flavor never obscures math.
 */

import {
  findConsumable,
  findItem,
  findMaterial,
  scaleToStar,
  socketsFor,
  type ConsumableCondition,
  type ItemEffect,
  type Rarity,
} from '@towventure/shared/content';
import type { EffectOp } from '@towventure/shared/sim';

/** How many infusion sockets this item id has (0 if not an item or a Common). */
export function socketCapacity(itemId: string): number {
  const def = findItem(itemId);
  return def ? socketsFor(def.rarity) : 0;
}

/** True if this id is a droppable material (for the infusion UI). */
export function isMaterial(itemId: string): boolean {
  return findMaterial(itemId) !== undefined;
}

/** Short display names for an item's filled sockets. */
export function socketLabels(sockets: string[] | undefined): string[] {
  return (sockets ?? []).map((id) => findMaterial(id)?.name ?? id);
}

export const CONSUMABLE_CONDITIONS: ConsumableCondition[] = [
  'fightStart',
  'hpBelow70',
  'hpBelow40',
  'doomfall',
  'vsElite',
];

export const CONDITION_LABEL: Record<ConsumableCondition, string> = {
  fightStart: 'Fight start',
  hpBelow70: 'HP < 70%',
  hpBelow40: 'HP < 40%',
  doomfall: 'Doomfall',
  vsElite: 'vs Elite+',
};

/** A consumable's data if this id is one (else undefined) — for the backpack UI. */
export function consumableInfo(
  itemId: string,
): { condition: ConsumableCondition; label: string } | undefined {
  const def = findConsumable(itemId);
  if (!def) return undefined;
  return { condition: def.defaultCondition, label: CONDITION_LABEL[def.defaultCondition] };
}

const STATUS_LABEL: Record<string, string> = {
  bleed: 'Bleed',
  burn: 'Burn',
  chill: 'Chill',
  regen: 'Regen',
  ward: 'Ward',
  venom: 'Venom',
  shock: 'Shock',
  weaken: 'Weaken',
  sunder: 'Sunder',
  haste: 'Haste',
};

function opText(op: EffectOp, star: number): string {
  const s = (n: number) => scaleToStar(n, star);
  switch (op.op) {
    case 'applyStatus':
      return `apply ${s(op.stacks)} ${STATUS_LABEL[op.status] ?? op.status}`;
    case 'gainArmor':
      return `gain ${s(op.amount)} Armor`;
    case 'gainWard':
      return `gain ${s(op.amount)} Ward`;
    case 'gainWardPctMax':
      return `gain Ward = ${s(op.pct)}% max HP`;
    case 'heal':
      return `heal ${s(op.amount)}`;
    case 'healPctMax':
      return `heal ${s(op.pct)}% max HP`;
    case 'damageWeaponPct':
      return `deal ${s(op.pct)}% weapon damage`;
    case 'buffDamagePct':
      return `+${s(op.pct)}% damage`;
    case 'buffSpeedPct':
      return `+${s(op.pct)}% Speed`;
    case 'buffNextHitPct':
      return `next hit +${s(op.pct)}%`;
    case 'buffDamageVsStatusPct':
      return `+${s(op.pct)}% damage vs ${STATUS_LABEL[op.status] ?? op.status}`;
    case 'detonateStatus':
      return `detonate ${STATUS_LABEL[op.status] ?? op.status} (${s(op.pctPerStack)}%/stack)`;
    case 'retaliateThorns':
      return `retaliate for Thorns ×${op.mult}`;
    case 'stun':
      return `stun ${(op.ticks / 10).toFixed(1)}s`;
  }
}

function triggerText(e: ItemEffect): string {
  const t = e.trigger;
  switch (t.kind) {
    case 'Every':
      return `Every ${t.seconds}s`;
    case 'OnHpBelow':
      return `Below ${t.pct}% HP`;
    case 'OnHit':
      return e.everyNthHit ? `Every ${ordinal(e.everyNthHit)} hit` : 'On hit';
    case 'OnCrit':
      return 'On crit';
    case 'OnHurt':
      return 'When hurt';
    case 'OnBlock':
      return 'On block';
    case 'OnDodge':
      return 'On dodge';
    case 'OnFightStart':
      return 'Fight start';
    case 'OnDoomfall':
      return 'On Doomfall';
    case 'OnStatusApplied':
      return t.minStacks !== undefined
        ? `At ${t.minStacks}+ ${STATUS_LABEL[t.status] ?? t.status}`
        : `On applying ${STATUS_LABEL[t.status] ?? t.status}`;
    case 'OnEnemyDeath':
      return 'On kill';
  }
}

function ordinal(n: number): string {
  return n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

export function effectLine(e: ItemEffect, star: number): string {
  const chance = e.chancePct !== undefined ? `${e.chancePct}% ` : '';
  const ops = e.ops.map((op) => opText(op, e.scales === false ? 1 : star)).join(', ');
  return `${triggerText(e)}: ${chance}${ops}`;
}

export interface ItemText {
  name: string;
  rarity: Rarity | 'consumable' | 'material';
  tags: string[];
  lines: string[];
  flavor: string;
}

export function describeItem(itemId: string, star: number): ItemText {
  const def = findItem(itemId);
  if (!def) {
    const cons = findConsumable(itemId);
    if (cons) {
      return {
        name: cons.name,
        rarity: 'consumable',
        tags: [],
        lines: cons.ops.map((op) => opText(op, star)),
        flavor: cons.flavor,
      };
    }
    const mat = findMaterial(itemId);
    if (mat) {
      const lines = (mat.mods ?? []).map((m) => `${m.value > 0 ? '+' : ''}${m.value} ${m.stat}`);
      if (mat.effect) lines.push(effectLine(mat.effect, 1));
      return { name: mat.name, rarity: 'material', tags: [], lines, flavor: mat.flavor };
    }
    return { name: itemId, rarity: 'consumable', tags: [], lines: [], flavor: '' };
  }
  const lines: string[] = [];
  for (const m of def.mods ?? []) {
    const v = m.scales === false ? m.value : scaleToStar(m.value, star);
    lines.push(`${v > 0 ? '+' : ''}${v} ${m.stat}`);
  }
  for (const e of def.effects ?? []) {
    if ((e.minStar ?? 1) > star) continue;
    lines.push(effectLine(e, star));
  }
  if (def.goldPerWin) lines.push(`+${scaleToStar(def.goldPerWin, star)} gold per fight won`);
  return { name: def.name, rarity: def.rarity, tags: def.tags, lines, flavor: def.flavor };
}
