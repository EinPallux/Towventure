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

/** Require an authenticated, non-banned account; replies 401/403 and returns null otherwise. */
export function requireAccount(request: FastifyRequest, reply: FastifyReply): AuthedAccount | null {
  if (!request.account) {
    reply.code(401).send({ error: 'not signed in' });
    return null;
  }
  if (request.account.banned) {
    reply.code(403).send({ error: 'account suspended' });
    return null;
  }
  return request.account;
}

/** True when the request IP is permitted for the admin surface (empty allowlist = any). */
function adminIpAllowed(request: FastifyRequest, env: Env): boolean {
  const list = env.ADMIN_IP_ALLOWLIST.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 0 || list.includes(request.ip);
}

/**
 * Require an admin (accounts.flags.admin) from an allowlisted IP (OPERATIONS §6). Replies
 * 404 — not 403 — for anyone who isn't both, so the admin surface is invisible to probes.
 */
export function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  env: Env,
): AuthedAccount | null {
  const account = request.account;
  if (!account || account.banned || !account.isAdmin || !adminIpAllowed(request, env)) {
    reply.code(404).send({ error: 'not found' });
    return null;
  }
  return account;
}
