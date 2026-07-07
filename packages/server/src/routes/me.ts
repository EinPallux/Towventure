/**
 * GET /api/me — the account's profile header: identity, season Honor + tier, and
 * whether a run is in progress (ARCHITECTURE §5). Inbox/tickets land in Phase 3.
 */

import { honorTier, honorTierRank } from '@towventure/shared/run';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { runs } from '../db/schema.js';
import { getCodex } from '../services/codex.js';
import { seasonHonor } from '../services/honor.js';
import { seasonMarks } from '../services/marks.js';
import { requireAccount, type AppContext } from './helpers.js';

export function meRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const season = ctx.env.HONOR_SEASON;
      const honor = await seasonHonor(ctx.db, account.id, season);
      const marks = await seasonMarks(ctx.db, account.id, season);
      const active = await ctx.db
        .select({ floor: runs.floor })
        .from(runs)
        .where(and(eq(runs.accountId, account.id), eq(runs.status, 'active')))
        .limit(1);
      return reply.send({
        account: { id: account.id, name: account.name, isGuest: account.isGuest },
        season,
        honor,
        marks,
        tier: honorTier(honor).name,
        tierRank: honorTierRank(honor),
        activeRunFloor: active[0]?.floor ?? null,
      });
    });

    // GET /api/me/codex — the account's lifetime discovery progress (CONTENT §7).
    fastify.get('/codex', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      return reply.send({ codex: await getCodex(ctx.db, account.id) });
    });
  };
}
