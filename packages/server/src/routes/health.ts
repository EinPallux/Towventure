/**
 * Liveness + minimal metrics (OPERATIONS §7). `/healthz` is what Caddy/Uptime-Kuma
 * ping; `/metrics` is a placeholder text exposition (prom-client wiring is Phase 5).
 */

import type { FastifyInstance } from 'fastify';
import { type AppContext } from './helpers.js';

export function healthRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/healthz', async (_req, reply) => {
      try {
        await ctx.db.execute('select 1');
        return reply.send({ ok: true, db: 'up' });
      } catch {
        return reply.code(503).send({ ok: false, db: 'down' });
      }
    });

    fastify.get('/metrics', async (_req, reply) => {
      reply.header('content-type', 'text/plain; version=0.0.4');
      return reply.send('# Towventure metrics placeholder — prom-client lands in Phase 5\n');
    });
  };
}
