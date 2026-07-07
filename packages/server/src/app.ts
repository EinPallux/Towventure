/**
 * Fastify app assembly (ARCHITECTURE §1, §5; OPERATIONS §5). Same-origin in prod
 * (Caddy serves client + proxies /api), so no CORS. Sessions resolve on every
 * request via a signed cookie; routes opt into auth with requireAccount.
 */

import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { accountForSession, readSessionId, type AuthedAccount } from './auth/session.js';
import type { Database } from './db/client.js';
import type { Env } from './env.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import type { AppContext } from './routes/helpers.js';
import { ladderRoutes } from './routes/ladders.js';
import { meRoutes } from './routes/me.js';
import { runRoutes } from './routes/run.js';
import { skirmishRoutes } from './routes/skirmish.js';

declare module 'fastify' {
  interface FastifyRequest {
    account: AuthedAccount | null;
  }
}

export async function buildApp(database: Database, env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: true,
  });
  const ctx: AppContext = { db: database.db, env };

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });

  // Resolve the session → account on every request (null if unauthenticated).
  app.decorateRequest('account', null);
  app.addHook('onRequest', async (req) => {
    const sid = readSessionId(req);
    req.account = sid ? await accountForSession(database.db, sid) : null;
  });

  await app.register(healthRoutes(ctx));
  await app.register(authRoutes(ctx), { prefix: '/api/auth' });
  await app.register(meRoutes(ctx), { prefix: '/api/me' });
  await app.register(runRoutes(ctx), { prefix: '/api/run' });
  await app.register(ladderRoutes(ctx), { prefix: '/api/ladders' });
  await app.register(skirmishRoutes(ctx), { prefix: '/api/skirmish' });

  return app;
}
