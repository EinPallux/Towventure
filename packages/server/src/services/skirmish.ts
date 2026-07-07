/**
 * Skirmish service (GDD §9) — free async PvP off the main menu. A duel of two defense
 * snapshots through the shared sim (`buildDuelSpec`); the attacker's Honor moves
 * Elo-style, the defender only ever gains. Elo uses floats (a one-shot server economy
 * calc, never replayed or hashed — so it lives here, not in the deterministic run
 * layer). Honor + Marks move only via ledger rows in the fight transaction (§4).
 */

import { snapshotOf, type HeroBuild, type RunState } from '@towventure/shared/run';
import { and, desc, eq, gt, gte, lt, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { defenses, skirmishes } from '../db/schema.js';
import { awardHonor, type Tx } from './honor.js';
import { awardMarks } from './marks.js';

// ─── Balance constants (BALANCE §6) ───────────────────────────────────────────
export const SKIRMISH_K = 24; // Elo K-factor
export const SKIRMISH_DEF_HONOR = 8; // defender's Honor on a successful defense
export const SKIRMISH_DEF_MARKS = 10; // defender's Marks on a successful defense
export const KEY_MARGIN = 50; // Key drops on a win vs H_def ≥ H_att − 50
export const KEYS_FOR_VAULT = 3; // 3 Keys open the Vault of Champions
export const TICKETS_BASE = 5; // +1 at tier rank 4, +1 more at rank 6 (GDD §7)
/** Rolling-week anti-farm: the Nth prior win vs the same account scales the gain. */
const DECAY_PCT = [100, 50, 25, 0];
const DAY_MS = 86_400_000;

const startOfUtcDay = (nowMs: number): number => Math.floor(nowMs / DAY_MS) * DAY_MS;

/** Attacker Elo delta: `round(K × (S − E))`, `E = 1/(1+10^((H_def−H_att)/400))`. */
export function eloDelta(hAtt: number, hDef: number, attackerWon: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (hDef - hAtt) / 400));
  const score = attackerWon ? 1 : 0;
  return Math.round(SKIRMISH_K * (score - expected));
}

/** Daily ticket cap: 5, +1 at Honor tier rank ≥4, +1 more at ≥6 (GDD §7). */
export function ticketCap(tierRank: number): number {
  return TICKETS_BASE + (tierRank >= 4 ? 1 : 0) + (tierRank >= 6 ? 1 : 0);
}

/** Anti-farm multiplier (%) for the Nth prior win vs a defender this week. */
export function decayPct(priorWins: number): number {
  return DECAY_PCT[Math.min(priorWins, DECAY_PCT.length - 1)] ?? 0;
}

type Exec = Db | Tx;

/** Create or refresh an account's defense snapshot from a run state (GDD §9). */
export async function upsertDefense(
  exec: Exec,
  accountId: string,
  ownerName: string,
  season: number,
  state: RunState,
  honor: number,
): Promise<void> {
  const build: HeroBuild = snapshotOf(state);
  await exec
    .insert(defenses)
    .values({
      accountId,
      season,
      ownerName,
      class: state.classId,
      floor: state.floor,
      honor,
      build,
    })
    .onConflictDoUpdate({
      target: defenses.accountId,
      set: {
        season,
        ownerName,
        class: state.classId,
        floor: state.floor,
        honor,
        build,
        updatedAt: sql`now()`,
      },
    });
}

export interface DefenseRow {
  accountId: string;
  ownerName: string;
  class: string;
  floor: number;
  honor: number;
  build: HeroBuild;
}

export async function getDefense(db: Db, accountId: string): Promise<DefenseRow | null> {
  const rows = await db
    .select({
      accountId: defenses.accountId,
      ownerName: defenses.ownerName,
      class: defenses.class,
      floor: defenses.floor,
      honor: defenses.honor,
      build: defenses.build,
    })
    .from(defenses)
    .where(eq(defenses.accountId, accountId))
    .limit(1);
  return rows[0] ?? null;
}

/** Champion's Keys held (awarded − spent), for the Vault gate (GDD §9). */
export async function keyCount(db: Db, accountId: string, season: number): Promise<number> {
  const rows = await db
    .select({
      keys: sql<number>`coalesce(sum((${skirmishes.keyAwarded})::int) - sum((${skirmishes.keySpent})::int), 0)::int`,
    })
    .from(skirmishes)
    .where(and(eq(skirmishes.attackerId, accountId), eq(skirmishes.season, season)));
  return rows[0]?.keys ?? 0;
}

async function ticketsUsedToday(db: Db, accountId: string, nowMs: number): Promise<number> {
  const dayStart = new Date(startOfUtcDay(nowMs));
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(skirmishes)
    .where(and(eq(skirmishes.attackerId, accountId), gte(skirmishes.at, dayStart)));
  return rows[0]?.n ?? 0;
}

async function attackedTodayVs(
  db: Db,
  attackerId: string,
  defenderId: string,
  nowMs: number,
): Promise<boolean> {
  const dayStart = new Date(startOfUtcDay(nowMs));
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(skirmishes)
    .where(
      and(
        eq(skirmishes.attackerId, attackerId),
        eq(skirmishes.defenderId, defenderId),
        gte(skirmishes.at, dayStart),
      ),
    );
  return (rows[0]?.n ?? 0) > 0;
}

async function priorWinsVsThisWeek(
  db: Db,
  attackerId: string,
  defenderId: string,
  nowMs: number,
): Promise<number> {
  const weekAgo = new Date(nowMs - 7 * DAY_MS);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(skirmishes)
    .where(
      and(
        eq(skirmishes.attackerId, attackerId),
        eq(skirmishes.defenderId, defenderId),
        eq(skirmishes.attackerWon, true),
        gt(skirmishes.at, weekAgo),
      ),
    );
  return rows[0]?.n ?? 0;
}

export interface Rival {
  accountId: string;
  name: string;
  class: string;
  floor: number;
  honor: number;
  band: 'below' | 'even' | 'above';
}

/** Pick one rival below, one near, one above the attacker's Honor (GDD §9). */
async function pickRival(
  db: Db,
  meId: string,
  season: number,
  myHonor: number,
  band: 'below' | 'even' | 'above',
  excludeIds: string[],
  nowMs: number,
): Promise<Rival | null> {
  const notMe = ne(defenses.accountId, meId);
  const excl = excludeIds.length
    ? sql`${defenses.accountId} not in (${sql.join(
        excludeIds.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql`true`;
  const base = and(eq(defenses.season, season), notMe, excl);
  const q = db
    .select({
      accountId: defenses.accountId,
      name: defenses.ownerName,
      class: defenses.class,
      floor: defenses.floor,
      honor: defenses.honor,
    })
    .from(defenses);
  let rows;
  if (band === 'below') {
    rows = await q.where(and(base, lt(defenses.honor, myHonor))).orderBy(desc(defenses.honor)).limit(1);
  } else if (band === 'above') {
    rows = await q.where(and(base, gt(defenses.honor, myHonor))).orderBy(defenses.honor).limit(1);
  } else {
    // Even: closest by |Δhonor|.
    rows = await q
      .where(base)
      .orderBy(sql`abs(${defenses.honor} - ${myHonor})`)
      .limit(1);
  }
  const r = rows[0];
  void nowMs;
  return r ? { ...r, band } : null;
}

/** The Rival Board: up to 3 opponents around the attacker's Honor, distinct. */
export async function getBoard(
  db: Db,
  meId: string,
  season: number,
  myHonor: number,
  nowMs = Date.now(),
): Promise<Rival[]> {
  const out: Rival[] = [];
  const taken: string[] = [];
  for (const band of ['above', 'even', 'below'] as const) {
    const r = await pickRival(db, meId, season, myHonor, band, taken, nowMs);
    if (r) {
      out.push(r);
      taken.push(r.accountId);
    }
  }
  return out;
}

export interface TicketState {
  used: number;
  cap: number;
  remaining: number;
}

export async function ticketState(
  db: Db,
  accountId: string,
  tierRank: number,
  nowMs = Date.now(),
): Promise<TicketState> {
  const used = await ticketsUsedToday(db, accountId, nowMs);
  const cap = ticketCap(tierRank);
  return { used, cap, remaining: Math.max(0, cap - used) };
}

export type SkirmishError =
  | 'no_defense'
  | 'no_such_defender'
  | 'out_of_tickets'
  | 'already_today';

export interface SkirmishOutcome {
  attackerWon: boolean;
  honorDelta: number; // applied to the attacker (clamped so season Honor ≥ 0)
  keyAwarded: boolean;
  defenderReward: { honor: number; marks: number } | null;
}

/**
 * Settle a validated Skirmish inside the caller's transaction (GDD §9). Records the
 * ledger + attack row and returns the outcome. Validation (tickets, once/day, defenses)
 * happens in the route before this is called; `precheck` gathers the counts it needs.
 */
export async function settleSkirmish(
  tx: Tx,
  params: {
    season: number;
    attackerId: string;
    defenderId: string;
    attackerWon: boolean;
    hAtt: number;
    hDef: number;
    priorWins: number;
    seed: number;
  },
): Promise<SkirmishOutcome> {
  const { season, attackerId, defenderId, attackerWon, hAtt, hDef, priorWins, seed } = params;
  let delta = eloDelta(hAtt, hDef, attackerWon);
  if (attackerWon && delta > 0) delta = Math.trunc((delta * decayPct(priorWins)) / 100);
  // Season Honor is a SUM of ledger deltas — never let a loss push it below 0 (floor 0).
  if (delta < 0 && hAtt + delta < 0) delta = -hAtt;
  const keyAwarded = attackerWon && hDef >= hAtt - KEY_MARGIN;

  await tx.insert(skirmishes).values({
    season,
    attackerId,
    defenderId,
    attackerWon,
    honorDelta: delta,
    keyAwarded,
    seed,
  });
  await awardHonor(tx, attackerId, season, delta, 'skirmish', null);

  let defenderReward: SkirmishOutcome['defenderReward'] = null;
  if (!attackerWon) {
    // A successful defense (attacker lost) pays the defender (GDD §9).
    await awardHonor(tx, defenderId, season, SKIRMISH_DEF_HONOR, 'skirmish_def', null);
    await awardMarks(tx, defenderId, season, SKIRMISH_DEF_MARKS, 'skirmish_def');
    defenderReward = { honor: SKIRMISH_DEF_HONOR, marks: SKIRMISH_DEF_MARKS };
  }
  return { attackerWon, honorDelta: delta, keyAwarded, defenderReward };
}

/** Read-only pre-checks the attack route runs before opening the transaction. */
export async function precheck(
  db: Db,
  attackerId: string,
  defenderId: string,
  nowMs = Date.now(),
): Promise<{ attackedToday: boolean; priorWins: number }> {
  const [attackedToday, priorWins] = await Promise.all([
    attackedTodayVs(db, attackerId, defenderId, nowMs),
    priorWinsVsThisWeek(db, attackerId, defenderId, nowMs),
  ]);
  return { attackedToday, priorWins };
}
