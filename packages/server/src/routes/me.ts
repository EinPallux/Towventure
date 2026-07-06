/**
 * GET /api/me — the account's profile header: identity, season Honor + tier, and
 * whether a run is in progress (ARCHITECTURE §5). Inbox/tickets land in Phase 3.
 */

import { honorTier } from '@towventure/shared/run';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { runs } from '../db/schema.js';
import { seasonHonor } from '../services/honor.js';
import { requireAccount, type AppContext } from './helpers.js';

export function meRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const honor = await seasonHonor(ctx.db, account.id, ctx.env.HONOR_SEASON);
      const active = await ctx.db
        .select({ floor: runs.floor })
        .from(runs)
        .where(and(eq(runs.accountId, account.id), eq(runs.status, 'active')))
        .limit(1);
      return reply.send({
        account: { id: account.id, name: account.name, isGuest: account.isGuest },
        season: ctx.env.HONOR_SEASON,
        honor,
        tier: honorTier(honor).name,
        activeRunFloor: active[0]?.floor ?? null,
      });
    });
  };
}
