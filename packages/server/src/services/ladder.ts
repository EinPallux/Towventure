/**
 * Ladder queries. Phase 1 serves the global season ladder as a live aggregation
 * over the honor ledger (materialized views are a scale optimisation for later —
 * ARCHITECTURE §6/§7; at launch scale a ranked query is fine). Self-row pinned.
 */

import { honorTier } from '@towventure/shared/run';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';

export interface LadderRow {
  rank: number;
  name: string;
  honor: number;
  tier: string;
  isSelf: boolean;
}

export interface LadderPage {
  season: number;
  page: number;
  pageSize: number;
  total: number;
  rows: LadderRow[];
  self: LadderRow | null;
}

const PAGE_SIZE = 25;

export async function globalLadder(
  db: Db,
  season: number,
  page: number,
  selfAccountId: string | null,
): Promise<LadderPage> {
  const offset = page * PAGE_SIZE;

  const ranked = await db.execute<{
    account_id: string;
    name: string;
    honor: number;
    rank: number;
  }>(sql`
    SELECT account_id, name, honor, rank FROM (
      SELECT a.id AS account_id, a.name AS name,
             sum(h.delta)::int AS honor,
             rank() OVER (ORDER BY sum(h.delta) DESC)::int AS rank
      FROM honor_ledger h
      JOIN accounts a ON a.id = h.account_id
      WHERE h.season = ${season}
      GROUP BY a.id, a.name
    ) t
    ORDER BY rank
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);

  const totalRows = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT account_id)::int AS n FROM honor_ledger WHERE season = ${season}
  `);
  const total = totalRows[0]?.n ?? 0;

  const rows: LadderRow[] = ranked.map((r) => ({
    rank: r.rank,
    name: r.name,
    honor: r.honor,
    tier: honorTier(r.honor).name,
    isSelf: r.account_id === selfAccountId,
  }));

  let self: LadderRow | null = rows.find((r) => r.isSelf) ?? null;
  if (!self && selfAccountId) {
    const selfRows = await db.execute<{ name: string; honor: number; rank: number }>(sql`
      SELECT name, honor, rank FROM (
        SELECT a.id AS account_id, a.name AS name,
               sum(h.delta)::int AS honor,
               rank() OVER (ORDER BY sum(h.delta) DESC)::int AS rank
        FROM honor_ledger h JOIN accounts a ON a.id = h.account_id
        WHERE h.season = ${season}
        GROUP BY a.id, a.name
      ) t
      WHERE account_id = ${selfAccountId}
    `);
    const s = selfRows[0];
    if (s)
      self = {
        rank: s.rank,
        name: s.name,
        honor: s.honor,
        tier: honorTier(s.honor).name,
        isSelf: true,
      };
  }

  return { season, page, pageSize: PAGE_SIZE, total, rows, self };
}
