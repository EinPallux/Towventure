/**
 * Seasons + the rollover job (GDD §11, BALANCE §7). Seasons run 8 weeks; at rollover a
 * player's new-season starting Honor is a *compressed* placement of last season's total
 * (`√old × 12` — a Crownseeker lands around Gatekeeper, never back at zero). Lifetime
 * Honor (earned deltas, ever, excluding placement carry-overs) never resets. The first
 * real rollover runs in Phase 5; this ships the model + math + job so it can be drilled.
 */

import { and, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { honorLedger, seasons } from '../db/schema.js';
import type { Tx } from './honor.js';

const SEASON_MS = 8 * 7 * 86_400_000; // 8 weeks
const PLACEMENT_REASON = 'placement';

/** Compressed placement Honor for a new season from last season's total (BALANCE §7). */
export function placementHonor(finalHonor: number): number {
  if (finalHonor <= 0) return 0;
  return Math.round(Math.sqrt(finalHonor) * 12);
}

export interface SeasonMeta {
  number: number;
  startsAt: string;
  endsAt: string;
  status: string;
}

/** Ensure a season row exists (idempotent); returns its metadata. */
export async function ensureSeason(db: Db, number: number, nowMs = Date.now()): Promise<SeasonMeta> {
  const existing = await db.select().from(seasons).where(eq(seasons.number, number)).limit(1);
  if (existing[0]) {
    const s = existing[0];
    return {
      number: s.number,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      status: s.status,
    };
  }
  const startsAt = new Date(nowMs);
  const endsAt = new Date(nowMs + SEASON_MS);
  await db
    .insert(seasons)
    .values({ number, startsAt, endsAt, status: 'active' })
    .onConflictDoNothing();
  return { number, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), status: 'active' };
}

/** Lifetime Honor — every earned delta across all seasons, minus placement carry-overs. */
export async function lifetimeHonor(db: Db, accountId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${honorLedger.delta}), 0)::int` })
    .from(honorLedger)
    .where(and(eq(honorLedger.accountId, accountId), ne(honorLedger.reason, PLACEMENT_REASON)));
  return rows[0]?.total ?? 0;
}

/**
 * Roll the season over (GDD §11): compress each account's `fromSeason` total into a
 * placement row in `toSeason`, mark the old season ended, open the new one. Idempotent
 * guard: refuses if `toSeason` already has placement rows. Returns how many were placed.
 */
export async function runSeasonRollover(
  db: Db,
  fromSeason: number,
  toSeason: number,
  nowMs = Date.now(),
): Promise<{ placed: number }> {
  return db.transaction(async (tx: Tx) => {
    const already = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(honorLedger)
      .where(and(eq(honorLedger.season, toSeason), eq(honorLedger.reason, PLACEMENT_REASON)));
    if ((already[0]?.n ?? 0) > 0) return { placed: 0 };

    // Each account's final total last season → a compressed placement seed this season.
    const totals = await tx
      .select({
        accountId: honorLedger.accountId,
        total: sql<number>`sum(${honorLedger.delta})::int`,
      })
      .from(honorLedger)
      .where(eq(honorLedger.season, fromSeason))
      .groupBy(honorLedger.accountId);

    let placed = 0;
    for (const row of totals) {
      const seed = placementHonor(row.total);
      if (seed <= 0) continue;
      await tx.insert(honorLedger).values({
        accountId: row.accountId,
        season: toSeason,
        delta: seed,
        reason: PLACEMENT_REASON,
        refId: null,
      });
      placed++;
    }

    await tx.update(seasons).set({ status: 'ended' }).where(eq(seasons.number, fromSeason));
    await tx
      .insert(seasons)
      .values({
        number: toSeason,
        startsAt: new Date(nowMs),
        endsAt: new Date(nowMs + SEASON_MS),
        status: 'active',
      })
      .onConflictDoUpdate({ target: seasons.number, set: { status: 'active' } });
    return { placed };
  });
}
