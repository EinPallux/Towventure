/**
 * GET /api/me — the account's profile header: identity, season Honor + tier, and
 * whether a run is in progress (ARCHITECTURE §5). Inbox/tickets land in Phase 3.
 */

import { honorTier, honorTierRank } from '@towventure/shared/run';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { inbox, runs } from '../db/schema.js';
import { getCodex } from '../services/codex.js';
import { getOwnEcho } from '../services/echoes.js';
import { seasonHonor } from '../services/honor.js';
import { seasonMarks } from '../services/marks.js';
import { lifetimeHonor } from '../services/season.js';
import { requireAccount, type AppContext } from './helpers.js';

export function meRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const season = ctx.env.HONOR_SEASON;
      const honor = await seasonHonor(ctx.db, account.id, season);
      const marks = await seasonMarks(ctx.db, account.id, season);
      const lifetime = await lifetimeHonor(ctx.db, account.id);
      const echo = await getOwnEcho(ctx.db, account.id);
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
        lifetime,
        tier: honorTier(honor).name,
        tierRank: honorTierRank(honor),
        echo,
        activeRunFloor: active[0]?.floor ?? null,
      });
    });

    // GET /api/me/inbox — the account's notifications, newest first (GDD §11).
    fastify.get('/inbox', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const rows = await ctx.db
        .select({
          id: inbox.id,
          kind: inbox.kind,
          body: inbox.body,
          read: inbox.read,
          createdAt: inbox.createdAt,
        })
        .from(inbox)
        .where(eq(inbox.accountId, account.id))
        .orderBy(desc(inbox.createdAt))
        .limit(50);
      const unread = rows.filter((r) => !r.read).length;
      return reply.send({ inbox: rows, unread });
    });

    // POST /api/me/inbox/read — mark all of the account's notifications read.
    fastify.post('/inbox/read', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      await ctx.db
        .update(inbox)
        .set({ read: true })
        .where(and(eq(inbox.accountId, account.id), eq(inbox.read, false)));
      return reply.send({ ok: true });
    });

    // GET /api/me/codex — the account's lifetime discovery progress (CONTENT §7).
    fastify.get('/codex', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      return reply.send({ codex: await getCodex(ctx.db, account.id) });
    });
  };
}
