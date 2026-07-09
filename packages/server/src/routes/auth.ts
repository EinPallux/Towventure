/**
 * Auth routes (ARCHITECTURE §5): register / login / logout / guest. Name + password
 * only; guests upgrade later (GDD §12). Sessions are DB rows behind a signed cookie.
 */

import { randomBytes } from 'node:crypto';
import { guestSchema, loginSchema, registerSchema } from '@towventure/shared/protocol';
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  readSessionId,
  setSessionCookie,
} from '../auth/session.js';
import { accounts } from '../db/schema.js';
import { parseBody, type AppContext } from './helpers.js';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export function authRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    const secure = ctx.env.NODE_ENV === 'production';

    fastify.post(
      '/register',
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const body = parseBody(registerSchema, req, reply);
        if (!body) return;
        const passHash = await hashPassword(body.password);
        try {
          const [acc] = await ctx.db
            .insert(accounts)
            .values({ name: body.name, passHash, email: body.email ?? null })
            .returning({ id: accounts.id, name: accounts.name, isGuest: accounts.isGuest });
          const sid = await createSession(ctx.db, acc!.id);
          setSessionCookie(reply, sid, secure);
          return reply.code(201).send({ account: acc });
        } catch (err) {
          if (isUniqueViolation(err)) return reply.code(409).send({ error: 'that name is taken' });
          throw err;
        }
      },
    );

    fastify.post(
      '/login',
      { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const body = parseBody(loginSchema, req, reply);
        if (!body) return;
        const rows = await ctx.db
          .select({
            id: accounts.id,
            name: accounts.name,
            passHash: accounts.passHash,
            isGuest: accounts.isGuest,
          })
          .from(accounts)
          .where(eq(sql`lower(${accounts.name})`, body.name.toLowerCase()))
          .limit(1);
        const acc = rows[0];
        if (!acc || !(await verifyPassword(acc.passHash, body.password))) {
          return reply.code(401).send({ error: 'wrong name or password' });
        }
        const sid = await createSession(ctx.db, acc.id);
        setSessionCookie(reply, sid, secure);
        return reply.send({ account: { id: acc.id, name: acc.name, isGuest: acc.isGuest } });
      },
    );

    fastify.post(
      '/guest',
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
      async (req, reply) => {
        parseBody(guestSchema, req, reply); // shape-only; guests take no input
        const name = `guest-${randomBytes(4).toString('hex')}`;
        const passHash = await hashPassword(randomBytes(24).toString('hex'));
        const [acc] = await ctx.db
          .insert(accounts)
          .values({ name, passHash, isGuest: true })
          .returning({ id: accounts.id, name: accounts.name, isGuest: accounts.isGuest });
        const sid = await createSession(ctx.db, acc!.id);
        setSessionCookie(reply, sid, secure);
        return reply.code(201).send({ account: acc });
      },
    );

    fastify.post('/logout', async (req, reply) => {
      const sid = readSessionId(req);
      if (sid) await destroySession(ctx.db, sid);
      clearSessionCookie(reply);
      return reply.send({ ok: true });
    });
  };
}
