/**
 * Run routes (ARCHITECTURE §3, §5). The server is authoritative: it draws the
 * seed, runs every command through the same shared reducers the client uses, bumps
 * stateVersion, persists, and appends to the run_events audit log. Fights are drawn
 * and simulated server-side; only seed + summary + hash ship back (never the event
 * log — the client re-sims to render).
 */

import { randomInt } from 'node:crypto';
import { getClass } from '@towventure/shared/content';
import { commandRequestSchema, runStartSchema } from '@towventure/shared/protocol';
import {
  applyCommand,
  honorTierRank,
  makeSummary,
  prepareFight,
  resolveFight,
  startRun,
  type RunState,
} from '@towventure/shared/run';
import { simulate } from '@towventure/shared/sim';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.js';
import { fights, runEvents, runs } from '../db/schema.js';
import { bankRunCodex } from '../services/codex.js';
import { awardClimbHonor, seasonHonor } from '../services/honor.js';
import { parseBody, requireAccount, type AppContext } from './helpers.js';

/** Thrown inside a run transaction when the optimistic version guard loses a race. */
class StaleRunError extends Error {}

interface RunRow {
  id: string;
  seed: number;
  state: RunState;
  stateVersion: number;
  floor: number;
  status: string;
}

async function activeRun(db: Db, accountId: string): Promise<RunRow | null> {
  const rows = await db
    .select({
      id: runs.id,
      seed: runs.seed,
      state: runs.state,
      stateVersion: runs.stateVersion,
      floor: runs.floor,
      status: runs.status,
    })
    .from(runs)
    .where(and(eq(runs.accountId, accountId), eq(runs.status, 'active')))
    .limit(1);
  return rows[0] ?? null;
}

/** Compact fight summary shipped to the client (it re-sims from the seed to render). */
function fightSummary(seed: number, result: ReturnType<typeof simulate>) {
  return {
    seed,
    winner: result.winner,
    endTick: result.endTick,
    heroHpRemaining: result.heroHpRemaining,
    heroMaxHp: result.heroMaxHp,
    enemyHpRemaining: result.enemyHpRemaining,
    logHash: result.logHash,
  };
}

export function runRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    // POST /api/run/start — begin a run (409 if one is active).
    fastify.post('/start', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(runStartSchema, req, reply);
      if (!body) return;
      // Honor-tier unlock gate (GDD §7): a class is locked until the account's season
      // tier rank reaches its unlockTier. Vanguard is rank 0 → always available.
      const requiredTier = getClass(body.classId).unlockTier;
      if (requiredTier > 0) {
        const rank = honorTierRank(await seasonHonor(ctx.db, account.id, season));
        if (rank < requiredTier) {
          return reply
            .code(403)
            .send({ error: 'class locked', requiredTier, tierRank: rank });
        }
      }
      if (await activeRun(ctx.db, account.id)) {
        return reply.code(409).send({ error: 'you already have an active run' });
      }
      const seed = randomInt(0, 0x100000000);
      const state = startRun(body.classId, body.vows, seed);

      const created = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(runs)
          .values({
            accountId: account.id,
            class: body.classId,
            vows: body.vows,
            seed,
            state,
            stateVersion: 0,
            floor: state.floor,
            status: 'active',
          })
          .returning({ id: runs.id });
        await awardClimbHonor(tx, account.id, season, state.floor, body.vows.length, row!.id);
        return row!;
      });
      return reply.code(201).send({ runId: created.id, state, stateVersion: 0 });
    });

    // GET /api/run — resume: the current run state (or null).
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const run = await activeRun(ctx.db, account.id);
      if (!run) return reply.send({ run: null });
      return reply.send({ runId: run.id, state: run.state, stateVersion: run.stateVersion });
    });

    // POST /api/run/command — the one gameplay mutation route.
    fastify.post('/command', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(commandRequestSchema, req, reply);
      if (!body) return;
      const run = await activeRun(ctx.db, account.id);
      if (!run) return reply.code(404).send({ error: 'no active run' });
      if (body.expectedStateVersion !== run.stateVersion) {
        return reply
          .code(409)
          .send({ error: 'stale', state: run.state, stateVersion: run.stateVersion });
      }
      const result = applyCommand(run.state, body.command);
      if (!result.ok) return reply.code(400).send({ error: result.error });

      const next = result.state;
      const newVersion = run.stateVersion + 1;
      const vowCount = next.vows.length;
      const floorAdvanced = next.floor > run.floor;

      try {
        await ctx.db.transaction(async (tx) => {
          // Optimistic lock at the row: only advance if the version is still what we
          // read. A concurrent command loses this race → 0 rows → clean 409, never a
          // partial write (the run_events PK also backstops double-apply).
          const upd = await tx
            .update(runs)
            .set({
              state: next,
              stateVersion: newVersion,
              floor: next.floor,
              status: next.status,
              endedAt: next.status === 'active' ? null : new Date(),
            })
            .where(and(eq(runs.id, run.id), eq(runs.stateVersion, run.stateVersion)))
            .returning({ id: runs.id });
          if (upd.length === 0) throw new StaleRunError();
          await tx
            .insert(runEvents)
            .values({ runId: run.id, seq: newVersion, command: body.command });
          if (floorAdvanced) {
            await awardClimbHonor(tx, account.id, season, next.floor, vowCount, run.id);
          }
          // Abandoning (or otherwise ending) a run banks its Codex discovery.
          if (next.status !== 'active') await bankRunCodex(tx, account.id, next.codex);
        });
      } catch (err) {
        if (err instanceof StaleRunError) {
          const fresh = await activeRun(ctx.db, account.id);
          return reply.code(409).send({
            error: 'stale',
            state: fresh?.state ?? run.state,
            stateVersion: fresh?.stateVersion ?? run.stateVersion,
          });
        }
        throw err;
      }
      return reply.send({ state: next, stateVersion: newVersion });
    });

    // POST /api/run/fight/start — draw + simulate the pending fight (server-authoritative).
    fastify.post('/fight/start', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(commandRequestSchema.pick({ expectedStateVersion: true }), req, reply);
      if (!body) return;
      const run = await activeRun(ctx.db, account.id);
      if (!run) return reply.code(404).send({ error: 'no active run' });
      if (body.expectedStateVersion !== run.stateVersion) {
        return reply
          .code(409)
          .send({ error: 'stale', state: run.state, stateVersion: run.stateVersion });
      }
      const prepared = prepareFight(run.state);
      if (!prepared) return reply.code(409).send({ error: 'no fight to start' });

      const result = simulate(prepared.spec, prepared.seed);
      const next = resolveFight(run.state, result);
      const newVersion = run.stateVersion + 1;
      const kind = run.state.pendingFight?.kind ?? 'battle';

      try {
        await ctx.db.transaction(async (tx) => {
          const upd = await tx
            .update(runs)
            .set({
              state: next,
              stateVersion: newVersion,
              floor: next.floor,
              status: next.status,
              endedAt: next.status === 'active' ? null : new Date(),
            })
            .where(and(eq(runs.id, run.id), eq(runs.stateVersion, run.stateVersion)))
            .returning({ id: runs.id });
          if (upd.length === 0) throw new StaleRunError();
          await tx.insert(fights).values({
            runId: run.id,
            floor: run.state.floor,
            kind,
            seed: prepared.seed,
            result: fightSummary(prepared.seed, result),
            logHash: result.logHash,
          });
          // A run that just died banks its Codex discovery for good (CONTENT §7).
          if (next.status !== 'active') await bankRunCodex(tx, account.id, next.codex);
        });
      } catch (err) {
        if (err instanceof StaleRunError) {
          const fresh = await activeRun(ctx.db, account.id);
          return reply.code(409).send({
            error: 'stale',
            state: fresh?.state ?? run.state,
            stateVersion: fresh?.stateVersion ?? run.stateVersion,
          });
        }
        throw err;
      }

      const dead = next.status === 'dead';
      return reply.send({
        result: fightSummary(prepared.seed, result),
        state: next,
        stateVersion: newVersion,
        summary: dead ? makeSummary(next) : null,
      });
    });
  };
}
