/**
 * Season route (GDD §11) — the current season window + your standing, plus the
 * compressed placement you'd carry into next season and your never-resetting Lifetime
 * Honor. The rollover job itself (services/season.ts) runs from ops in Phase 5.
 */

import type { FastifyInstance } from 'fastify';
import { seasonHonor } from '../services/honor.js';
import { ensureSeason, lifetimeHonor, placementHonor } from '../services/season.js';
import { type AppContext } from './helpers.js';

export function seasonRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/', async (req, reply) => {
      const meta = await ensureSeason(ctx.db, season);
      const account = req.account;
      if (!account) return reply.send({ season: meta });
      const honor = await seasonHonor(ctx.db, account.id, season);
      const lifetime = await lifetimeHonor(ctx.db, account.id);
      return reply.send({
        season: meta,
        honor,
        lifetime,
        nextPlacement: placementHonor(honor),
      });
    });
  };
}
