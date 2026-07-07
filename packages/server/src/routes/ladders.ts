/**
 * Ladder routes (ARCHITECTURE §5). Phase 1 ships the global season ladder; weekly/
 * friends/gauntlet/echoes land in Phase 3. Self-row is pinned by globalLadder.
 */

import { laddersQuerySchema } from '@towventure/shared/protocol';
import type { FastifyInstance } from 'fastify';
import { globalLadder } from '../services/ladder.js';
import { type AppContext } from './helpers.js';

export function ladderRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/global', async (req, reply) => {
      const q = laddersQuerySchema.safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: 'invalid query' });
      const selfId = req.account?.id ?? null;
      const page = await globalLadder(ctx.db, ctx.env.HONOR_SEASON, q.data.page, selfId);
      return reply.send(page);
    });
  };
}
