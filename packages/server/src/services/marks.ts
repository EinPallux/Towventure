/**
 * Valor Marks service — the soft-currency ledger (GDD §10.2, invariant §4). Marks
 * move only via ledger rows, in the same transaction as their cause; the season
 * balance is always SUM(delta). Earnings are positive rows; Merchant purchases are
 * negative rows guarded by an affordability check.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { marksLedger } from '../db/schema.js';
import type { Tx } from './honor.js';

/** Season Marks balance for an account (SUM of ledger deltas). */
export async function seasonMarks(db: Db, accountId: string, season: number): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${marksLedger.delta}), 0)::int` })
    .from(marksLedger)
    .where(and(eq(marksLedger.accountId, accountId), eq(marksLedger.season, season)));
  return rows[0]?.total ?? 0;
}

/**
 * Record a Marks movement inside the caller's transaction. `delta` may be negative
 * (a Merchant spend); callers that spend MUST verify affordability under the same
 * transaction first (SELECT … FOR UPDATE isn't needed — the ledger tolerates any
 * ordering, but a spend must never drive the balance below zero).
 */
export async function awardMarks(
  tx: Tx,
  accountId: string,
  season: number,
  delta: number,
  reason: string,
  refId?: string,
): Promise<void> {
  if (delta === 0) return;
  await tx.insert(marksLedger).values({ accountId, season, delta, reason, refId: refId ?? null });
}
