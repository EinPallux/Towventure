/**
 * Item legibility helpers — turn authored content into tooltip text. Numbers are
 * always exact (ART_DIRECTION §8); flavor never obscures math.
 */

import { findItem, scaleToStar, type ItemEffect, type Rarity } from '@towventure/shared/content';
import type { EffectOp } from '@towventure/shared/sim';

const STATUS_LABEL: Record<string, string> = {
  bleed: 'Bleed',
  burn: 'Burn',
  chill: 'Chill',
  regen: 'Regen',
  ward: 'Ward',
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
  rarity: Rarity | 'consumable';
  tags: string[];
  lines: string[];
  flavor: string;
}

export function describeItem(itemId: string, star: number): ItemText {
  const def = findItem(itemId);
  if (!def) {
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
