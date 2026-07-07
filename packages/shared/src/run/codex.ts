/**
 * Codex (CONTENT §7) — discovery + lore unlock. Recording helpers stamp progress as
 * items are acquired and enemies fall; `buildCodex` turns a run's progress into a
 * display list. Pure and JSON-safe. Iterates the content arrays (insertion-ordered),
 * never the progress objects, so ordering is stable and key-order-independent.
 *
 * Discovery is run-scoped for v1 (it lives on RunState); persisting it across runs per
 * account is a server follow-up (a codex table keyed by account).
 */

import { CODEX_ENEMY_LORE, CODEX_ITEM_LORE } from '../content/codex.js';
import { ENEMIES, ITEMS, findItem } from '../content/registry.js';
import type { CodexProgress, RunState } from './types.js';

/** Item kill/tier thresholds at which the two lore lines unlock. */
const ITEM_UNLOCKS = [3, 5] as const; // ★3, ★5
const ENEMY_UNLOCKS = [3, 10] as const; // kills

/** Stamp an item at the highest ★ the account has seen it (only real equipment items). */
export function recordCodexItem(codex: CodexProgress, itemId: string, star: number): void {
  if (!findItem(itemId)) return;
  codex.items[itemId] = Math.max(codex.items[itemId] ?? 0, star);
}

/** Tally a kill for each enemy in a won fight. */
export function recordCodexKills(codex: CodexProgress, enemyIds: readonly string[]): void {
  for (const id of enemyIds) codex.enemies[id] = (codex.enemies[id] ?? 0) + 1;
}

export interface CodexLoreLine {
  text: string;
  unlocked: boolean;
  /** What unlocks it, for the locked hint (e.g. "★3", "10 kills"). */
  req: string;
}

export interface CodexEntry {
  id: string;
  kind: 'item' | 'enemy';
  name: string; // '???' until discovered
  flavor: string; // the discovery line ('' until discovered)
  discovered: boolean;
  /** Highest ★ seen (items) or kills (enemies). */
  progress: number;
  lore: CodexLoreLine[];
}

export interface Codex {
  items: CodexEntry[];
  enemies: CodexEntry[];
  discovered: number;
  total: number;
}

function loreLines(
  authored: readonly string[] | undefined,
  progress: number,
  unlocks: readonly [number, number],
  reqLabel: (n: number) => string,
): CodexLoreLine[] {
  const lines = authored ?? [];
  const out: CodexLoreLine[] = [];
  for (let i = 0; i < lines.length && i < unlocks.length; i++) {
    out.push({ text: lines[i]!, unlocked: progress >= unlocks[i]!, req: reqLabel(unlocks[i]!) });
  }
  return out;
}

/** Merge two progress maps (items keep the higher ★; enemies sum kills). */
export function mergeCodexProgress(a: CodexProgress, b: CodexProgress): CodexProgress {
  const items = { ...a.items };
  for (const [id, star] of Object.entries(b.items)) items[id] = Math.max(items[id] ?? 0, star);
  const enemies = { ...a.enemies };
  for (const [id, kills] of Object.entries(b.enemies)) enemies[id] = (enemies[id] ?? 0) + kills;
  return { items, enemies };
}

/** Build the Codex display from a run's discovery progress. */
export function buildCodex(state: RunState): Codex {
  return buildCodexFrom(state.codex ?? { items: {}, enemies: {} });
}

/** Build the Codex display from a raw progress map (e.g. the persisted account codex). */
export function buildCodexFrom(progressOf: CodexProgress): Codex {
  let discovered = 0;
  const items = ITEMS.map((def): CodexEntry => {
    const progress = progressOf.items[def.id] ?? 0;
    const seen = progress > 0;
    if (seen) discovered++;
    return {
      id: def.id,
      kind: 'item',
      name: seen ? def.name : '???',
      flavor: seen ? def.flavor : '',
      discovered: seen,
      progress,
      lore: loreLines(CODEX_ITEM_LORE[def.id], progress, ITEM_UNLOCKS, (n) => `★${n}`),
    };
  });
  const enemies = ENEMIES.map((def): CodexEntry => {
    const progress = progressOf.enemies[def.id] ?? 0;
    const seen = progress > 0;
    if (seen) discovered++;
    return {
      id: def.id,
      kind: 'enemy',
      name: seen ? def.name : '???',
      flavor: seen ? def.flavor : '',
      discovered: seen,
      progress,
      lore: loreLines(CODEX_ENEMY_LORE[def.id], progress, ENEMY_UNLOCKS, (n) => `${n} kills`),
    };
  });
  return { items, enemies, discovered, total: items.length + enemies.length };
}
