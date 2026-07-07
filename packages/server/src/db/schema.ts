/**
 * Drizzle schema — Phase 1 launch tables (ARCHITECTURE.md §6). Honor is never a
 * mutable column: it is always SUM(honor_ledger.delta) per season. JSONB holds the
 * evolving run/build shapes; the ledger tables around them are strictly relational
 * and transactional. Echoes/Skirmishes/Gauntlet/friends tables land in Phase 3.
 */

import type { HeroBuild, RunState } from '@towventure/shared/run';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    passHash: text('pass_hash').notNull(),
    email: text('email'),
    isGuest: boolean('is_guest').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    flags: jsonb('flags')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** The War Chest boon armed at the Merchant, consumed at the next run's start (GDD §10.2). */
    armedBoon: text('armed_boon'),
  },
  (t) => [uniqueIndex('accounts_name_lower_uq').on(sql`lower(${t.name})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_account_idx').on(t.accountId)],
);

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    class: text('class').notNull(),
    vows: jsonb('vows')
      .notNull()
      .default(sql`'[]'::jsonb`),
    // uint32 seed — bigint so values above 2^31 don't overflow int4.
    seed: bigint('seed', { mode: 'number' }).notNull(),
    state: jsonb('state').$type<RunState>().notNull(),
    stateVersion: integer('state_version').notNull().default(0),
    floor: integer('floor').notNull().default(1),
    status: text('status').notNull().default('active'),
    /** The UTC day number when this is a Daily Gauntlet run (shared seed); null otherwise (GDD §10). */
    gauntletDay: integer('gauntlet_day'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    // At most one active run per account (ARCHITECTURE §6).
    uniqueIndex('runs_one_active_per_account')
      .on(t.accountId)
      .where(sql`${t.status} = 'active'`),
    index('runs_account_idx').on(t.accountId),
  ],
);

export const runEvents = pgTable(
  'run_events',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    command: jsonb('command').notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.seq] })],
);

export const fights = pgTable(
  'fights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    floor: integer('floor').notNull(),
    kind: text('kind').notNull(),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    result: jsonb('result').notNull(),
    // uint32 FNV digest — bigint to hold the full range.
    logHash: bigint('log_hash', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('fights_run_idx').on(t.runId)],
);

/**
 * The honor ledger — the single source of Honor truth. Every grant is a row in the
 * same transaction as its cause; season Honor is SUM(delta) (ARCHITECTURE §6, §8).
 */
export const honorLedger = pgTable(
  'honor_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('honor_ledger_season_account_idx').on(t.season, t.accountId)],
);

/**
 * The Valor Marks ledger — the soft-currency twin of the honor ledger (GDD §10.2).
 * Marks are spent at the Honor Merchant; like Honor they are never a mutable column,
 * only SUM(delta). Positive rows are earnings (Echo/Skirmish/climb), negative rows are
 * Merchant purchases, all in the same transaction as their cause.
 */
export const marksLedger = pgTable(
  'marks_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('marks_ledger_season_account_idx').on(t.season, t.accountId)],
);

/**
 * Lifetime Codex discovery per account (CONTENT §7). `progress` is the highest ★ seen
 * for items and cumulative kills for enemies; banked once per run at its end so kills
 * don't double-count. Not seasonal — discovery is forever.
 */
export const codex = pgTable(
  'codex',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'item' | 'enemy'
    entryId: text('entry_id').notNull(),
    progress: integer('progress').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.kind, t.entryId] })],
);

/**
 * Echoes — a dead player's build, placed on their death floor (GDD §8). One row per
 * account (a new death replaces the old Echo); `build` is the HeroBuild snapshot the
 * duel sim fights. `defeats`/`kills` drive the 3-defeat lifecycle and profile display.
 */
export const echoes = pgTable(
  'echoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    ownerName: text('owner_name').notNull(),
    class: text('class').notNull(),
    floor: integer('floor').notNull(),
    // The owner's season Honor at death — scores a hunter's punch-up bounty.
    honor: integer('honor').notNull(),
    build: jsonb('build').$type<HeroBuild>().notNull(),
    defeats: integer('defeats').notNull().default(0),
    kills: integer('kills').notNull().default(0),
    expired: boolean('expired').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One Echo per account — a new death upserts over the old one.
    uniqueIndex('echoes_account_uq').on(t.accountId),
    // Placement scan: live Echoes near a floor.
    index('echoes_live_floor_idx').on(t.floor).where(sql`${t.expired} = false`),
  ],
);

/**
 * In-game inbox notifications (GDD §11) — Echo defense wins for now; Skirmish results
 * and friend milestones join later. Live WS toasts read the unread tail of this table.
 */
export const inbox = pgTable(
  'inbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    body: text('body').notNull(),
    refId: uuid('ref_id'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('inbox_account_idx').on(t.accountId, t.read)],
);

/**
 * Skirmish defense snapshot (GDD §9) — one per account, the build others attack.
 * Auto-updated on run start + boss kills, or pinned manually. `honor` is a display
 * cache; the Elo fight reads live season Honor.
 */
export const defenses = pgTable('defenses', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  season: integer('season').notNull(),
  ownerName: text('owner_name').notNull(),
  class: text('class').notNull(),
  floor: integer('floor').notNull(),
  honor: integer('honor').notNull(),
  build: jsonb('build').$type<HeroBuild>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The Skirmish attack ledger (GDD §9) — one row per attack. Backs the daily-ticket
 * count, the same-defender-once/day guard, the rolling-week anti-farm decay, and the
 * Champion's Key tally. Honor/Marks movements it causes live in their own ledgers.
 */
export const skirmishes = pgTable(
  'skirmishes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season: integer('season').notNull(),
    attackerId: uuid('attacker_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    defenderId: uuid('defender_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    attackerWon: boolean('attacker_won').notNull(),
    honorDelta: integer('honor_delta').notNull(),
    keyAwarded: boolean('key_awarded').notNull().default(false),
    keySpent: boolean('key_spent').notNull().default(false),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('skirmishes_attacker_at_idx').on(t.attackerId, t.at),
    index('skirmishes_pair_at_idx').on(t.attackerId, t.defenderId, t.at),
  ],
);

/**
 * Cosmetic unlocks owned at the Honor Merchant / Vault (GDD §10.2) — one row per
 * owned item, permanent (not seasonal). Prestige flags until the Phase 4 art pass.
 */
export const unlocks = pgTable(
  'unlocks',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.itemId] })],
);

/**
 * Friendships (GDD §10) — a request/accept edge. Stored once per pair (requester →
 * addressee); an accepted edge counts in both directions. The unique index makes a
 * duplicate request a no-op rather than a second row.
 */
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('friendships_pair_uq').on(t.requesterId, t.addresseeId),
    index('friendships_addressee_idx').on(t.addresseeId, t.status),
    index('friendships_requester_idx').on(t.requesterId, t.status),
  ],
);

/**
 * Feed events (GDD §10) — the bragging infrastructure. Each row is one account's
 * milestone (floor reached, Zenith forged, Echo kill); friends read the union of each
 * other's rows. Also the source for live toasts (pushed over the SSE stream).
 */
export const feed = pgTable(
  'feed',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    body: text('body').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('feed_account_at_idx').on(t.accountId, t.at)],
);

/** Per-account, per-season climb frontier — the deepest floor banked this season. */
export const climbFrontier = pgTable(
  'climb_frontier',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    bestFloor: integer('best_floor').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.season] })],
);
