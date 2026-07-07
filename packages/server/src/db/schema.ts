/**
 * Drizzle schema — Phase 1 launch tables (ARCHITECTURE.md §6). Honor is never a
 * mutable column: it is always SUM(honor_ledger.delta) per season. JSONB holds the
 * evolving run/build shapes; the ledger tables around them are strictly relational
 * and transactional. Echoes/Skirmishes/Gauntlet/friends tables land in Phase 3.
 */

import type { RunState } from '@towventure/shared/run';
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
