/**
 * Admin service helpers (OPERATIONS §6): the audit trail every admin act writes, and
 * the live broadcast-banner read (shared by the public banner endpoint). Route-level
 * authorization lives in the admin routes + requireAdmin; this is just the data layer.
 */

import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { adminActions, broadcasts } from '../db/schema.js';

/** Append an admin-action audit row — every admin act is logged (OPERATIONS §6). */
export async function logAdmin(
  db: Db,
  adminId: string,
  action: string,
  target: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(adminActions).values({ adminId, action, target, detail });
}

export interface LiveBroadcast {
  id: string;
  message: string;
  createdAt: Date;
  expiresAt: Date | null;
}

/** The live banner: the newest active, non-expired broadcast, or null. */
export async function activeBroadcast(db: Db, now: Date): Promise<LiveBroadcast | null> {
  const rows = await db
    .select({
      id: broadcasts.id,
      message: broadcasts.message,
      createdAt: broadcasts.createdAt,
      expiresAt: broadcasts.expiresAt,
    })
    .from(broadcasts)
    .where(
      and(
        eq(broadcasts.active, true),
        or(isNull(broadcasts.expiresAt), gt(broadcasts.expiresAt, now)),
      ),
    )
    .orderBy(desc(broadcasts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
