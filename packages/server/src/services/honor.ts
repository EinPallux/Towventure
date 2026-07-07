/**
 * Honor service — every grant is a ledger row (ARCHITECTURE §6, invariant §4). No
 * direct rank writes; season Honor is always SUM(delta). Climb Honor is awarded on
 * reaching a new season frontier floor, in the same transaction as the cause.
 */

import { climbHonorForFrontier } from '@towventure/shared/run';
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { climbFrontier, honorLedger } from '../db/schema.js';

/** The transaction handle drizzle hands to `db.transaction(tx => …)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Award climb Honor for reaching `toFloor` if it beats the account's season
 * frontier. Idempotent per frontier: repeating a banked floor pays nothing
 * (GDD §7.2). Returns the Honor delta granted (0 if none).
 */
export async function awardClimbHonor(
  tx: Tx,
  accountId: string,
  season: number,
  toFloor: number,
  vowCount: number,
  runId: string,
): Promise<number> {
  const rows = await tx
    .select({ bestFloor: climbFrontier.bestFloor })
    .from(climbFrontier)
    .where(and(eq(climbFrontier.accountId, accountId), eq(climbFrontier.season, season)))
    .limit(1);
  const frontier = rows[0]?.bestFloor ?? 0;
  if (toFloor <= frontier) return 0;

  const delta = climbHonorForFrontier(frontier, toFloor, vowCount);
  if (delta > 0) {
    await tx
      .insert(honorLedger)
      .values({ accountId, season, delta, reason: 'climb', refId: runId });
  }
  await tx
    .insert(climbFrontier)
    .values({ accountId, season, bestFloor: toFloor })
    .onConflictDoUpdate({
      target: [climbFrontier.accountId, climbFrontier.season],
      set: { bestFloor: toFloor },
    });
  return delta;
}

/**
 * Record a non-climb Honor movement inside the caller's transaction (Echo bounties,
 * Echo defense trickle, Skirmish Elo — GDD §8/§9). Climb Honor keeps its own
 * frontier-guarded path; this is the general ledger insert for the other sources.
 */
export async function awardHonor(
  tx: Tx,
  accountId: string,
  season: number,
  delta: number,
  reason: string,
  refId?: string | null,
): Promise<void> {
  if (delta === 0) return;
  await tx.insert(honorLedger).values({ accountId, season, delta, reason, refId: refId ?? null });
}

/** Season Honor total for an account (SUM of ledger deltas). */
export async function seasonHonor(db: Db, accountId: string, season: number): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${honorLedger.delta}), 0)::int` })
    .from(honorLedger)
    .where(and(eq(honorLedger.accountId, accountId), eq(honorLedger.season, season)));
  return rows[0]?.total ?? 0;
}
