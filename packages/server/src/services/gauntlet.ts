/**
 * Daily Gauntlet (GDD §10) — a shared-seed, class-rotating run everyone plays the same
 * way today, with its own ladder. The seed + class are a pure function of the UTC day,
 * so two accounts on the same day get identical doors/shops/loot (the determinism the
 * run layer already guarantees). The Honor pot payout at UTC close is a rollover job
 * (Slice G territory) — the ladder + entry ship here.
 */

import type { ClassId } from '@towventure/shared/content';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { LadderPage, LadderRow } from './ladder.js';

const DAY_MS = 86_400_000;
const CLASS_ROTATION: ClassId[] = ['vanguard', 'duelist', 'arcanist'];
const PAGE_SIZE = 25;

/** The current UTC day number (days since the epoch). */
export function gauntletDay(nowMs = Date.now()): number {
  return Math.floor(nowMs / DAY_MS);
}

/** The shared seed for a Gauntlet day — FNV-1a of the day number, uint32. */
export function gauntletSeed(day: number): number {
  let h = 2166136261 >>> 0;
  const s = String(day);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** The forced class for a Gauntlet day (rotates vanguard → duelist → arcanist). */
export function gauntletClass(day: number): ClassId {
  return CLASS_ROTATION[((day % 3) + 3) % 3]!;
}

/** The Gauntlet ladder for a day — best floor per account among that day's runs. */
export async function gauntletLadder(
  db: Db,
  season: number,
  day: number,
  page: number,
  selfId: string | null,
): Promise<LadderPage> {
  const offset = page * PAGE_SIZE;
  const ranked = await db.execute<{ account_id: string; name: string; value: number; rank: number }>(sql`
    SELECT account_id, name, value, rank FROM (
      SELECT a.id AS account_id, a.name AS name, max(r.floor)::int AS value,
             rank() OVER (ORDER BY max(r.floor) DESC)::int AS rank
      FROM runs r JOIN accounts a ON a.id = r.account_id
      WHERE r.gauntlet_day = ${day}
      GROUP BY a.id, a.name
    ) t
    ORDER BY rank
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);
  const totalRows = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT account_id)::int AS n FROM runs WHERE gauntlet_day = ${day}
  `);
  const total = totalRows[0]?.n ?? 0;

  const rows: LadderRow[] = ranked.map((r) => ({
    rank: r.rank,
    name: r.name,
    value: r.value,
    tier: null,
    isSelf: r.account_id === selfId,
  }));
  let self: LadderRow | null = rows.find((r) => r.isSelf) ?? null;
  if (!self && selfId) {
    const selfRows = await db.execute<{ name: string; value: number; rank: number }>(sql`
      SELECT name, value, rank FROM (
        SELECT a.id AS account_id, a.name AS name, max(r.floor)::int AS value,
               rank() OVER (ORDER BY max(r.floor) DESC)::int AS rank
        FROM runs r JOIN accounts a ON a.id = r.account_id
        WHERE r.gauntlet_day = ${day}
        GROUP BY a.id, a.name
      ) t WHERE account_id = ${selfId}
    `);
    const srow = selfRows[0];
    if (srow) self = { rank: srow.rank, name: srow.name, value: srow.value, tier: null, isSelf: true };
  }
  return { board: 'gauntlet', metric: 'floor', season, page, pageSize: PAGE_SIZE, total, rows, self };
}
