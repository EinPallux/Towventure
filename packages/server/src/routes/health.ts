/**
 * Liveness + minimal metrics (OPERATIONS §7). `/healthz` is what Caddy/Uptime-Kuma
 * ping; `/metrics` is a placeholder text exposition (prom-client wiring is Phase 5).
 */

import type { FastifyInstance } from 'fastify';
import { ipAllowlisted, type AppContext } from './helpers.js';

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

    // /metrics is operator-only: gated by the same IP allowlist as /admin (a Prometheus
    // scraper has no session), 404 off-list so it isn't discoverable. Empty allowlist = dev.
    fastify.get('/metrics', async (req, reply) => {
      if (!ipAllowlisted(req, ctx.env)) return reply.code(404).send({ error: 'not found' });
      reply.header('content-type', 'text/plain; version=0.0.4');
      return reply.send('# Towventure metrics placeholder — prom-client lands in Phase 5\n');
    });
  };
}
