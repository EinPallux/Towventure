/**
 * Sessions in DB, not JWT (ARCHITECTURE §9 decision 9): instant logout/ban beats
 * saving one DB read. The httpOnly signed cookie carries only the session id.
 */

import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.js';
import { accounts, sessions } from '../db/schema.js';

export const SESSION_COOKIE = 'tv_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthedAccount {
  id: string;
  name: string;
  isGuest: boolean;
}

export async function createSession(db: Db, accountId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(sessions)
    .values({ accountId, expiresAt })
    .returning({ id: sessions.id });
  return row!.id;
}

export async function destroySession(db: Db, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Resolve the account behind a session id, or null if missing/expired. */
export async function accountForSession(db: Db, sessionId: string): Promise<AuthedAccount | null> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      isGuest: accounts.isGuest,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await destroySession(db, sessionId);
    return null;
  }
  return { id: row.id, name: row.name, isGuest: row.isGuest };
}

export function setSessionCookie(reply: FastifyReply, sessionId: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    signed: true,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Read + verify the signed session cookie from a request. */
export function readSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}
