/**
 * Echo service (GDD §8) — snapshot on death, placement into live runs, and the
 * two-sided reward loop. An Echo is a dead player's build; a duel against it reuses
 * the shared sim (`buildDuelSpec`). Honor + Marks move only via ledger rows, in the
 * same transaction as the fight that caused them (invariant §4).
 *
 * Trust model: the EchoRef the hunter fights is embedded in the server-persisted
 * RunState (the server injected it), so its floor/honor are server-trusted for
 * paying the hunter. Crediting the *dead owner* re-reads the row by id — we need the
 * owner's account, and never leak it to the client.
 */

import {
  ECHO_DEFENSE_HONOR,
  ECHO_DEFENSE_MARKS,
  ECHO_MAX_DEFEATS,
  echoAiBonusPct,
  echoBounty,
  echoMarks,
  honorTier,
  snapshotOf,
  startRun,
  type EchoRef,
  type RunState,
} from '@towventure/shared/run';
import type { ClassId } from '@towventure/shared/content';
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { echoes, feed, inbox } from '../db/schema.js';
import { awardHonor, type Tx } from './honor.js';
import { awardMarks } from './marks.js';

/** How far from the hunter's floor an Echo may be placed (GDD §8 "near floor n"). */
const PLACEMENT_BAND = 5;
/** House Echoes seed onboarding around the first Echo door (GDD §12). */
const HOUSE_FLOOR_LO = 6;
const HOUSE_FLOOR_HI = 12;
const DAY_MS = 86_400_000;

const isHouse = (echoId: string): boolean => echoId.startsWith('house:');

/**
 * Snapshot the just-died run as this account's Echo (GDD §8). Upserts — a new death
 * replaces the old Echo (kills/defeats reset; it is a fresh corpse). No-op unless the
 * run actually died on a floor.
 */
export async function bankEcho(
  tx: Tx,
  accountId: string,
  ownerName: string,
  season: number,
  state: RunState,
  ownerHonor: number,
): Promise<void> {
  const floor = state.deathInfo?.floor ?? state.bestFloor;
  if (state.status !== 'dead' || floor <= 0) return;
  const build = snapshotOf(state);
  await tx
    .insert(echoes)
    .values({
      accountId,
      season,
      ownerName,
      class: state.classId,
      floor,
      honor: ownerHonor,
      build,
    })
    .onConflictDoUpdate({
      target: echoes.accountId,
      set: {
        season,
        ownerName,
        class: state.classId,
        floor,
        honor: ownerHonor,
        build,
        defeats: 0,
        kills: 0,
        expired: false,
        createdAt: sql`now()`,
      },
    });
}

function toRef(
  row: {
    id: string;
    ownerName: string;
    class: string;
    floor: number;
    honor: number;
    build: unknown;
    createdAt: Date;
  },
  nowMs: number,
): EchoRef {
  const ageDays = Math.max(0, Math.floor((nowMs - row.createdAt.getTime()) / DAY_MS));
  return {
    echoId: row.id,
    ownerName: row.ownerName,
    tier: honorTier(row.honor).name,
    classId: row.class as ClassId,
    floor: row.floor,
    ageDays,
    ownerHonor: row.honor,
    bonusPct: echoAiBonusPct(ageDays),
    build: row.build as EchoRef['build'],
  };
}

/** A deterministic soft-target Echo for onboarding when no real corpse fits (GDD §12). */
function houseEcho(floor: number): EchoRef {
  const build = snapshotOf(startRun('duelist', [], 1337));
  return {
    echoId: `house:${floor}`,
    ownerName: 'The Sleepwalker',
    tier: honorTier(0).name,
    classId: 'duelist',
    floor,
    ageDays: 99,
    ownerHonor: 0,
    bonusPct: 0,
    build,
  };
}

/**
 * Pick an Echo to offer a hunter near `floor` (GDD §8). Real corpses first (freshest
 * near the floor, someone else's, still live), then a house Echo in the onboarding
 * band. Friends-first / honor-proximity ordering is a Phase-3 follow-up.
 */
export async function pickEchoForFloor(
  db: Db,
  hunterId: string,
  floor: number,
  season: number,
  nowMs = Date.now(),
): Promise<EchoRef | null> {
  const rows = await db
    .select({
      id: echoes.id,
      ownerName: echoes.ownerName,
      class: echoes.class,
      floor: echoes.floor,
      honor: echoes.honor,
      build: echoes.build,
      createdAt: echoes.createdAt,
    })
    .from(echoes)
    .where(
      and(
        eq(echoes.season, season),
        eq(echoes.expired, false),
        ne(echoes.accountId, hunterId),
        gte(echoes.floor, floor - PLACEMENT_BAND),
        lte(echoes.floor, floor + PLACEMENT_BAND),
      ),
    )
    .orderBy(sql`${echoes.createdAt} desc`)
    .limit(1);
  if (rows[0]) return toRef(rows[0], nowMs);
  if (floor >= HOUSE_FLOOR_LO && floor <= HOUSE_FLOOR_HI) return houseEcho(floor);
  return null;
}

/**
 * Credit the hunter for killing an Echo: a large Honor bounty + Marks (the Grave-Copy
 * is handled in run state). Best-effort marks the Echo's defeat on its row (the ref is
 * server-trusted, so payment doesn't wait on the row). Returns the amounts paid.
 */
export async function recordEchoKill(
  tx: Tx,
  echo: EchoRef,
  hunterId: string,
  hunterHonor: number,
  season: number,
): Promise<{ bounty: number; marks: number }> {
  const bounty = echoBounty(echo.floor, echo.ownerHonor, hunterHonor);
  const marks = echoMarks(echo.floor);
  const refId = isHouse(echo.echoId) ? null : echo.echoId;
  await awardHonor(tx, hunterId, season, bounty, 'echo_bounty', refId);
  await awardMarks(tx, hunterId, season, marks, 'echo_bounty', refId ?? undefined);
  if (!isHouse(echo.echoId)) {
    // Increment defeats, expiring at the cap — guarded so a spent Echo can't over-count.
    await tx
      .update(echoes)
      .set({
        defeats: sql`${echoes.defeats} + 1`,
        expired: sql`${echoes.defeats} + 1 >= ${ECHO_MAX_DEFEATS}`,
      })
      .where(and(eq(echoes.id, echo.echoId), eq(echoes.expired, false)));
  }
  return { bounty, marks };
}

/**
 * Credit the *dead owner* when their Echo defeats a challenger (GDD §8): a small Honor
 * trickle + Marks, an inbox notification, and a kill tally. Re-reads the row by id to
 * find the owner (never trusts a client-side value); no-op for house Echoes.
 */
export async function recordEchoDefense(
  tx: Tx,
  echo: EchoRef,
  slainName: string,
  season: number,
): Promise<{ ownerId: string; body: string } | null> {
  if (isHouse(echo.echoId)) return null;
  const rows = await tx
    .select({ accountId: echoes.accountId, floor: echoes.floor })
    .from(echoes)
    .where(eq(echoes.id, echo.echoId))
    .limit(1);
  const owner = rows[0];
  if (!owner) return null;
  const body = `Your Echo on Floor ${owner.floor} has slain ${slainName}.`;
  await tx.update(echoes).set({ kills: sql`${echoes.kills} + 1` }).where(eq(echoes.id, echo.echoId));
  await awardHonor(tx, owner.accountId, season, ECHO_DEFENSE_HONOR, 'echo_defense', echo.echoId);
  await awardMarks(tx, owner.accountId, season, ECHO_DEFENSE_MARKS, 'echo_defense', echo.echoId);
  await tx.insert(inbox).values({ accountId: owner.accountId, kind: 'echo_defense', body, refId: echo.echoId });
  // A feed milestone friends can see ("Your Echo slew Bram").
  await tx.insert(feed).values({ accountId: owner.accountId, kind: 'echo_kill', body });
  return { ownerId: owner.accountId, body };
}

/** The account's own Echo (for the profile header / death ritual placement line). */
export async function getOwnEcho(
  db: Db,
  accountId: string,
): Promise<{ floor: number; kills: number; defeats: number; expired: boolean } | null> {
  const rows = await db
    .select({
      floor: echoes.floor,
      kills: echoes.kills,
      defeats: echoes.defeats,
      expired: echoes.expired,
    })
    .from(echoes)
    .where(eq(echoes.accountId, accountId))
    .limit(1);
  return rows[0] ?? null;
}
