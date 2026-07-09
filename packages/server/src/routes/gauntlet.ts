/**
 * Daily Gauntlet routes (GDD §10). `GET /api/gauntlet` reports today's shared seed +
 * forced class + the daily ladder; `POST /api/gauntlet/start` begins the day's run
 * (shared seed, rotated class, no boons — so two accounts get identical doors/shops/
 * loot). It is a normal run thereafter, played through the run routes, tagged for the
 * separate daily board. The UTC-close Honor-pot payout is a rollover job (Slice G).
 */

import { getClass } from '@towventure/shared/content';
import { startRun } from '@towventure/shared/run';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { runs } from '../db/schema.js';
import { awardClimbHonor } from '../services/honor.js';
import { gauntletClass, gauntletDay, gauntletLadder, gauntletSeed } from '../services/gauntlet.js';
import { isUniqueViolation, requireAccount, type AppContext } from './helpers.js';

export function gauntletRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    // GET /api/gauntlet — today's seed/class, the daily ladder, and whether you've entered.
    fastify.get('/', async (req, reply) => {
      const day = gauntletDay();
      const classId = gauntletClass(day);
      const selfId = req.account?.id ?? null;
      const board = await gauntletLadder(ctx.db, season, day, 0, selfId);
      let entered = false;
      if (selfId) {
        const mine = await ctx.db
          .select({ id: runs.id })
          .from(runs)
          .where(and(eq(runs.accountId, selfId), eq(runs.gauntletDay, day)))
          .limit(1);
        entered = mine.length > 0;
      }
      return reply.send({
        day,
        seed: gauntletSeed(day),
        classId,
        className: getClass(classId).name,
        entered,
        board,
      });
    });

    // POST /api/gauntlet/start — begin today's Gauntlet run (409 if a run is active).
    fastify.post('/start', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const day = gauntletDay();

      const active = await ctx.db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.accountId, account.id), eq(runs.status, 'active')))
        .limit(1);
      if (active.length > 0) {
        return reply
          .code(409)
          .send({ error: 'finish your active run before entering the Gauntlet' });
      }
      const already = await ctx.db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.accountId, account.id), eq(runs.gauntletDay, day)))
        .limit(1);
      if (already.length > 0) {
        return reply.code(409).send({ error: "you've already run today's Gauntlet" });
      }

      const seed = gauntletSeed(day);
      const classId = gauntletClass(day);
      // No boons, no vows — every entrant gets the identical shared run (GDD §10).
      const state = startRun(classId, [], seed);

      let created;
      try {
        created = await ctx.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(runs)
            .values({
              accountId: account.id,
              class: classId,
              vows: [],
              seed,
              state,
              stateVersion: 0,
              floor: state.floor,
              status: 'active',
              gauntletDay: day,
            })
            .returning({ id: runs.id });
          await awardClimbHonor(tx, account.id, season, state.floor, 0, row!.id);
          return row!;
        });
      } catch (err) {
        // Concurrent start (active run or a second Gauntlet today) — a unique index fired.
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ error: 'you already have an active run' });
        }
        throw err;
      }
      return reply.code(201).send({ runId: created.id, state, stateVersion: 0, day, classId });
    });
  };
}
