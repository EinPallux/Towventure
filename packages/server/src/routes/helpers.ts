/**
 * Route helpers: zod body validation at the edge (invariant §7) and the auth
 * guard. Kept tiny so every route reads the same way.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import type { Db } from '../db/client.js';
import type { Env } from '../env.js';
import type { AuthedAccount } from '../auth/session.js';

export interface AppContext {
  db: Db;
  env: Env;
}

/** Parse a request body against a zod schema; replies 400 and returns null on failure. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  request: FastifyRequest,
  reply: FastifyReply,
): z.infer<T> | null {
  const result = schema.safeParse(request.body ?? {});
  if (!result.success) {
    reply.code(400).send({ error: 'invalid request', issues: result.error.flatten() });
    return null;
  }
  return result.data;
}

/** Require an authenticated account; replies 401 and returns null if absent. */
export function requireAccount(request: FastifyRequest, reply: FastifyReply): AuthedAccount | null {
  if (!request.account) {
    reply.code(401).send({ error: 'not signed in' });
    return null;
  }
  return request.account;
}
