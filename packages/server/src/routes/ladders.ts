/**
 * Ladder routes (ARCHITECTURE §5). Global season Honor, the Unnumbered top-100, the
 * weekly climb (best floor this week), and Echo kills. Friends/Gauntlet boards live in
 * their own routes. Self-row is pinned by the service even when off-page.
 */

import { laddersQuerySchema } from '@towventure/shared/protocol';
import type { FastifyInstance } from 'fastify';
import {
  echoKillsLadder,
  globalLadder,
  unnumberedLadder,
  weeklyLadder,
} from '../services/ladder.js';
import { type AppContext } from './helpers.js';

/** Monday 00:00 UTC of the current week (the weekly-climb window start). */
function startOfUtcWeek(nowMs: number): Date {
  const day = new Date(nowMs);
  const dow = (day.getUTCDay() + 6) % 7; // 0 = Monday
  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return new Date(midnight - dow * 86_400_000);
}

export function ladderRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    const page = (req: { query: unknown }): number => {
      const q = laddersQuerySchema.safeParse(req.query);
      return q.success ? q.data.page : 0;
    };

    fastify.get('/global', async (req, reply) =>
      reply.send(await globalLadder(ctx.db, season, page(req), req.account?.id ?? null)),
    );

    fastify.get('/unnumbered', async (req, reply) =>
      reply.send(await unnumberedLadder(ctx.db, season, page(req), req.account?.id ?? null)),
    );

    fastify.get('/echo-kills', async (req, reply) =>
      reply.send(await echoKillsLadder(ctx.db, season, page(req), req.account?.id ?? null)),
    );

    fastify.get('/weekly', async (req, reply) =>
      reply.send(
        await weeklyLadder(ctx.db, season, page(req), req.account?.id ?? null, startOfUtcWeek(Date.now())),
      ),
    );
  };
}
