/**
 * Ladder queries (ARCHITECTURE §6/§7). Live aggregations over the ledgers/runs — a
 * ranked query is fine at launch scale; materialized views are a later optimisation.
 * One generic `rankedPage` drives every board (global/weekly/echo-kills/unnumbered);
 * self-row is always pinned even when off the current page.
 */

import { honorTier } from '@towventure/shared/run';
import { sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client.js';

export type LadderMetric = 'honor' | 'floor' | 'kills';

export interface LadderRow {
  rank: number;
  name: string;
  value: number;
  /** Honor boards carry a tier badge; other metrics leave it null. */
  tier: string | null;
  isSelf: boolean;
}

export interface LadderPage {
  board: string;
  metric: LadderMetric;
  season: number;
  page: number;
  pageSize: number;
  total: number;
  rows: LadderRow[];
  self: LadderRow | null;
}

const PAGE_SIZE = 25;

interface RankedOpts {
  board: string;
  metric: LadderMetric;
  season: number;
  page: number;
  selfId: string | null;
  /** Subquery yielding `account_id`, `name`, `value` (one row per account). */
  inner: SQL;
  /** Cap the board at N rows (the Unnumbered top-100); 0 = uncapped. */
  cap?: number;
}

async function rankedPage(db: Db, opts: RankedOpts): Promise<LadderPage> {
  const { board, metric, season, page, selfId, inner } = opts;
  const cap = opts.cap ?? 0;
  const offset = page * PAGE_SIZE;
  const withTier = metric === 'honor';
  const tierOf = (v: number): string | null => (withTier ? honorTier(v).name : null);

  const ranked = await db.execute<{ account_id: string; name: string; value: number; rank: number }>(sql`
    SELECT account_id, name, value, rank FROM (
      SELECT account_id, name, value,
             rank() OVER (ORDER BY value DESC)::int AS rank
      FROM (${inner}) base
    ) t
    ${cap > 0 ? sql`WHERE rank <= ${cap}` : sql``}
    ORDER BY rank
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);

  const totalRows = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (${inner}) base
    ${cap > 0 ? sql`WHERE value IS NOT NULL` : sql``}
  `);
  const total = cap > 0 ? Math.min(cap, totalRows[0]?.n ?? 0) : (totalRows[0]?.n ?? 0);

  const rows: LadderRow[] = ranked.map((r) => ({
    rank: r.rank,
    name: r.name,
    value: r.value,
    tier: tierOf(r.value),
    isSelf: r.account_id === selfId,
  }));

  let self: LadderRow | null = rows.find((r) => r.isSelf) ?? null;
  if (!self && selfId) {
    const selfRows = await db.execute<{ name: string; value: number; rank: number }>(sql`
      SELECT name, value, rank FROM (
        SELECT account_id, name, value,
               rank() OVER (ORDER BY value DESC)::int AS rank
        FROM (${inner}) base
      ) t
      WHERE account_id = ${selfId}
    `);
    const s = selfRows[0];
    if (s && (cap === 0 || s.rank <= cap)) {
      self = { rank: s.rank, name: s.name, value: s.value, tier: tierOf(s.value), isSelf: true };
    }
  }

  return { board, metric, season, page, pageSize: PAGE_SIZE, total, rows, self };
}

/** Global season ladder — season Honor descending. */
export function globalLadder(db: Db, season: number, page: number, selfId: string | null): Promise<LadderPage> {
  return rankedPage(db, {
    board: 'global',
    metric: 'honor',
    season,
    page,
    selfId,
    inner: sql`
      SELECT a.id AS account_id, a.name AS name, sum(h.delta)::int AS value
      FROM honor_ledger h JOIN accounts a ON a.id = h.account_id
      WHERE h.season = ${season}
      GROUP BY a.id, a.name
    `,
  });
}

/** The Unnumbered — the top 100 by season Honor (GDD §7). */
export function unnumberedLadder(db: Db, season: number, page: number, selfId: string | null): Promise<LadderPage> {
  return rankedPage(db, {
    board: 'unnumbered',
    metric: 'honor',
    season,
    page,
    selfId,
    cap: 100,
    inner: sql`
      SELECT a.id AS account_id, a.name AS name, sum(h.delta)::int AS value
      FROM honor_ledger h JOIN accounts a ON a.id = h.account_id
      WHERE h.season = ${season}
      GROUP BY a.id, a.name
    `,
  });
}

/** Weekly climb — best floor reached on runs started since `weekStart` (GDD §10). */
export function weeklyLadder(
  db: Db,
  season: number,
  page: number,
  selfId: string | null,
  weekStart: Date,
): Promise<LadderPage> {
  return rankedPage(db, {
    board: 'weekly',
    metric: 'floor',
    season,
    page,
    selfId,
    inner: sql`
      SELECT a.id AS account_id, a.name AS name, max(r.floor)::int AS value
      FROM runs r JOIN accounts a ON a.id = r.account_id
      WHERE r.started_at >= ${weekStart.toISOString()}
      GROUP BY a.id, a.name
    `,
  });
}

/** Echo kills — climbers each account's Echo has slain (GDD §8/§10). */
export function echoKillsLadder(db: Db, season: number, page: number, selfId: string | null): Promise<LadderPage> {
  return rankedPage(db, {
    board: 'echo-kills',
    metric: 'kills',
    season,
    page,
    selfId,
    inner: sql`
      SELECT a.id AS account_id, a.name AS name, e.kills AS value
      FROM echoes e JOIN accounts a ON a.id = e.account_id
      WHERE e.kills > 0
    `,
  });
}
