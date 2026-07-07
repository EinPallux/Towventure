/**
 * Social graph (GDD §10) — friends (request/accept), the feed (per-account milestones
 * friends read), and profiles. Feed emission also fans out live toasts over the bus to
 * the emitter's friends. All name lookups are case-insensitive; a friendship is one
 * edge per pair (accepted counts both ways).
 */

import { honorTier } from '@towventure/shared/run';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { accounts, echoes, feed, friendships } from '../db/schema.js';
import { publish } from './bus.js';
import { seasonHonor } from './honor.js';
import { type Tx } from './honor.js';

type Exec = Db | Tx;

/** Accepted-friend account ids (both directions). */
export async function friendIds(db: Db, accountId: string): Promise<string[]> {
  const rows = await db
    .select({ a: friendships.requesterId, b: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requesterId, accountId), eq(friendships.addresseeId, accountId)),
      ),
    );
  return rows.map((r) => (r.a === accountId ? r.b : r.a));
}

export interface FriendSummary {
  id: string;
  name: string;
  tier: string;
  honor: number;
}

/** The friends list + incoming/outgoing pending requests. */
export async function listFriends(
  db: Db,
  accountId: string,
  season: number,
): Promise<{
  friends: FriendSummary[];
  incoming: { id: string; name: string }[];
  outgoing: { id: string; name: string }[];
}> {
  const ids = await friendIds(db, accountId);
  const friends: FriendSummary[] = [];
  for (const id of ids) {
    const [acc] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, id)).limit(1);
    if (!acc) continue;
    const honor = await seasonHonor(db, id, season);
    friends.push({ id, name: acc.name, tier: honorTier(honor).name, honor });
  }
  const incoming = await db
    .select({ id: friendships.requesterId, name: accounts.name })
    .from(friendships)
    .innerJoin(accounts, eq(accounts.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, accountId), eq(friendships.status, 'pending')));
  const outgoing = await db
    .select({ id: friendships.addresseeId, name: accounts.name })
    .from(friendships)
    .innerJoin(accounts, eq(accounts.id, friendships.addresseeId))
    .where(and(eq(friendships.requesterId, accountId), eq(friendships.status, 'pending')));
  return { friends, incoming, outgoing };
}

export type FriendError = 'no_such_account' | 'self' | 'already';

/** Send (or auto-accept) a friend request by name. */
export async function requestFriend(
  db: Db,
  requesterId: string,
  name: string,
): Promise<{ ok: true; status: 'pending' | 'accepted' } | { ok: false; error: FriendError }> {
  const [target] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(sql`lower(${accounts.name}) = lower(${name})`)
    .limit(1);
  if (!target) return { ok: false, error: 'no_such_account' };
  if (target.id === requesterId) return { ok: false, error: 'self' };

  // If they already asked us, accept that edge instead of making a new one.
  const reverse = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, requesterId)))
    .limit(1);
  if (reverse[0]) {
    await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, reverse[0].id));
    return { ok: true, status: 'accepted' };
  }
  // Already have an edge we created? No-op.
  const existing = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, target.id)))
    .limit(1);
  if (existing[0]) return { ok: true, status: existing[0].status as 'pending' | 'accepted' };

  await db.insert(friendships).values({ requesterId, addresseeId: target.id, status: 'pending' });
  return { ok: true, status: 'pending' };
}

/** Accept a pending request from `requesterId`. */
export async function acceptFriend(db: Db, accepterId: string, requesterId: string): Promise<boolean> {
  const res = await db
    .update(friendships)
    .set({ status: 'accepted' })
    .where(
      and(
        eq(friendships.requesterId, requesterId),
        eq(friendships.addresseeId, accepterId),
        eq(friendships.status, 'pending'),
      ),
    )
    .returning({ id: friendships.id });
  return res.length > 0;
}

/** Insert a feed row (in the caller's tx or standalone). Live fan-out is separate. */
export async function emitFeed(exec: Exec, accountId: string, kind: string, body: string): Promise<void> {
  await exec.insert(feed).values({ accountId, kind, body });
}

/** Fan a feed event out as a live toast to the emitter's friends + self (post-commit). */
export async function pushFeedLive(db: Db, accountId: string, kind: string, body: string): Promise<void> {
  publish(accountId, { kind, body });
  for (const fid of await friendIds(db, accountId)) publish(fid, { kind, body });
}

export interface FeedItem {
  name: string;
  kind: string;
  body: string;
  at: string;
}

/** The account's feed: its own + its friends' recent milestones, newest first. */
export async function readFeed(db: Db, accountId: string, limit = 40): Promise<FeedItem[]> {
  const ids = [accountId, ...(await friendIds(db, accountId))];
  const rows = await db
    .select({ name: accounts.name, kind: feed.kind, body: feed.body, at: feed.at })
    .from(feed)
    .innerJoin(accounts, eq(accounts.id, feed.accountId))
    .where(inArray(feed.accountId, ids))
    .orderBy(desc(feed.at))
    .limit(limit);
  return rows.map((r) => ({ name: r.name, kind: r.kind, body: r.body, at: r.at.toISOString() }));
}

/** A public profile — the Hall of Echoes header (GDD §10.4). */
export async function getProfile(
  db: Db,
  name: string,
  season: number,
): Promise<{
  name: string;
  tier: string;
  honor: number;
  echo: { floor: number; kills: number } | null;
} | null> {
  const [acc] = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(sql`lower(${accounts.name}) = lower(${name})`)
    .limit(1);
  if (!acc) return null;
  const honor = await seasonHonor(db, acc.id, season);
  const [ech] = await db
    .select({ floor: echoes.floor, kills: echoes.kills })
    .from(echoes)
    .where(eq(echoes.accountId, acc.id))
    .limit(1);
  return {
    name: acc.name,
    tier: honorTier(honor).name,
    honor,
    echo: ech ? { floor: ech.floor, kills: ech.kills } : null,
  };
}
