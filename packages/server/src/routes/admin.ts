/**
 * Live-ops admin (OPERATIONS §6). Every route is gated by requireAdmin (accounts.flags
 * .admin + the ADMIN_IP_ALLOWLIST) and writes an audit row. Reads are for support
 * (account lookup); writes are the moderation + comms levers: ban/unban, broadcast
 * banner, Echo takedown, and the content kill-switch (its drop-exclusion enforcement is
 * a follow-up — the flags are stored + served here). Run-repair + season controls are
 * the next admin slice.
 */

import { getItem } from '@towventure/shared/content';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { accounts, bans, broadcasts, contentFlags, echoes, runs, sessions } from '../db/schema.js';
import { seasonHonor } from '../services/honor.js';
import { seasonMarks } from '../services/marks.js';
import { lifetimeHonor } from '../services/season.js';
import { getOwnEcho } from '../services/echoes.js';
import { activeBroadcast, logAdmin } from '../services/admin.js';
import { parseBody, requireAdmin, type AppContext } from './helpers.js';

interface AdminAccount {
  id: string;
  name: string;
  isGuest: boolean;
  createdAt: Date;
  flags: unknown;
}

/** Resolve an account by case-insensitive name (never returns the password hash). */
async function findAccount(db: Db, name: string): Promise<AdminAccount | null> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      isGuest: accounts.isGuest,
      createdAt: accounts.createdAt,
      flags: accounts.flags,
    })
    .from(accounts)
    .where(sql`lower(${accounts.name}) = ${name.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

async function activeBan(db: Db, accountId: string) {
  const rows = await db
    .select({
      id: bans.id,
      reason: bans.reason,
      createdAt: bans.createdAt,
      bannedBy: bans.bannedBy,
    })
    .from(bans)
    .where(and(eq(bans.accountId, accountId), isNull(bans.liftedAt)))
    .limit(1);
  return rows[0] ?? null;
}

const banSchema = z.object({ name: z.string().min(1), reason: z.string().min(1).max(500) });
const unbanSchema = z.object({ name: z.string().min(1) });
const broadcastSchema = z.object({
  message: z.string().min(1).max(280),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});
const contentFlagSchema = z.object({
  itemId: z.string().min(1),
  disabled: z.boolean(),
  reason: z.string().max(500).optional(),
});
const echoTakedownSchema = z.object({ name: z.string().min(1) });

export function adminRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    // GET /api/admin/account/:name — support lookup: identity, economy, echo, recent runs.
    fastify.get('/account/:name', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const name = (req.params as { name: string }).name;
      const acct = await findAccount(ctx.db, name);
      if (!acct) return reply.code(404).send({ error: 'no such account' });
      const season = ctx.env.HONOR_SEASON;
      const [honor, marks, lifetime, echo, ban] = await Promise.all([
        seasonHonor(ctx.db, acct.id, season),
        seasonMarks(ctx.db, acct.id, season),
        lifetimeHonor(ctx.db, acct.id),
        getOwnEcho(ctx.db, acct.id),
        activeBan(ctx.db, acct.id),
      ]);
      const recentRuns = await ctx.db
        .select({
          id: runs.id,
          class: runs.class,
          floor: runs.floor,
          status: runs.status,
          startedAt: runs.startedAt,
          endedAt: runs.endedAt,
        })
        .from(runs)
        .where(eq(runs.accountId, acct.id))
        .orderBy(desc(runs.startedAt))
        .limit(10);
      return reply.send({
        account: {
          id: acct.id,
          name: acct.name,
          isGuest: acct.isGuest,
          isAdmin: (acct.flags as Record<string, unknown> | null)?.admin === true,
          createdAt: acct.createdAt,
        },
        ban,
        season,
        honor,
        marks,
        lifetime,
        echo,
        recentRuns,
      });
    });

    // POST /api/admin/ban — suspend an account (reason logged), and kill its sessions now.
    fastify.post('/ban', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const body = parseBody(banSchema, req, reply);
      if (!body) return;
      const acct = await findAccount(ctx.db, body.name);
      if (!acct) return reply.code(404).send({ error: 'no such account' });
      if (acct.id === admin.id) return reply.code(400).send({ error: 'cannot ban yourself' });
      if (await activeBan(ctx.db, acct.id)) {
        return reply.code(409).send({ error: 'already banned' });
      }
      await ctx.db
        .insert(bans)
        .values({ accountId: acct.id, reason: body.reason, bannedBy: admin.id });
      await ctx.db.delete(sessions).where(eq(sessions.accountId, acct.id));
      await logAdmin(ctx.db, admin.id, 'ban', acct.name, { reason: body.reason });
      return reply.send({ ok: true });
    });

    // POST /api/admin/unban — lift the active ban.
    fastify.post('/unban', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const body = parseBody(unbanSchema, req, reply);
      if (!body) return;
      const acct = await findAccount(ctx.db, body.name);
      if (!acct) return reply.code(404).send({ error: 'no such account' });
      const lifted = await ctx.db
        .update(bans)
        .set({ liftedAt: new Date(), liftedBy: admin.id })
        .where(and(eq(bans.accountId, acct.id), isNull(bans.liftedAt)))
        .returning({ id: bans.id });
      if (lifted.length === 0) return reply.code(404).send({ error: 'not banned' });
      await logAdmin(ctx.db, admin.id, 'unban', acct.name, {});
      return reply.send({ ok: true });
    });

    // GET /api/admin/broadcast — the current live banner (admin view).
    fastify.get('/broadcast', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      return reply.send({ broadcast: await activeBroadcast(ctx.db, new Date()) });
    });

    // POST /api/admin/broadcast — set the live banner (supersedes any current one).
    fastify.post('/broadcast', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const body = parseBody(broadcastSchema, req, reply);
      if (!body) return;
      const expiresAt = body.expiresInHours
        ? new Date(Date.now() + body.expiresInHours * 3600 * 1000)
        : null;
      await ctx.db.update(broadcasts).set({ active: false }).where(eq(broadcasts.active, true));
      await ctx.db
        .insert(broadcasts)
        .values({ message: body.message, createdBy: admin.id, expiresAt });
      await logAdmin(ctx.db, admin.id, 'broadcast', null, { message: body.message });
      return reply.send({ ok: true });
    });

    // POST /api/admin/broadcast/clear — take the banner down.
    fastify.post('/broadcast/clear', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      await ctx.db.update(broadcasts).set({ active: false }).where(eq(broadcasts.active, true));
      await logAdmin(ctx.db, admin.id, 'broadcast_clear', null, {});
      return reply.send({ ok: true });
    });

    // GET /api/admin/content-flags — the content kill-switch table.
    fastify.get('/content-flags', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const flags = await ctx.db
        .select({
          itemId: contentFlags.itemId,
          disabled: contentFlags.disabled,
          reason: contentFlags.reason,
          updatedAt: contentFlags.updatedAt,
        })
        .from(contentFlags)
        .orderBy(desc(contentFlags.updatedAt));
      return reply.send({ flags });
    });

    // POST /api/admin/content-flags — flip a known item's kill-switch (drop-exclusion is a follow-up).
    fastify.post('/content-flags', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const body = parseBody(contentFlagSchema, req, reply);
      if (!body) return;
      try {
        getItem(body.itemId); // reject typos — only real items are flaggable
      } catch {
        return reply.code(400).send({ error: 'unknown item' });
      }
      await ctx.db
        .insert(contentFlags)
        .values({
          itemId: body.itemId,
          disabled: body.disabled,
          reason: body.reason ?? null,
          updatedBy: admin.id,
        })
        .onConflictDoUpdate({
          target: contentFlags.itemId,
          set: {
            disabled: body.disabled,
            reason: body.reason ?? null,
            updatedBy: admin.id,
            updatedAt: new Date(),
          },
        });
      await logAdmin(ctx.db, admin.id, 'content_flag', body.itemId, { disabled: body.disabled });
      return reply.send({ ok: true });
    });

    // POST /api/admin/echo-takedown — remove an account's Echo from circulation.
    fastify.post('/echo-takedown', async (req, reply) => {
      const admin = requireAdmin(req, reply, ctx.env);
      if (!admin) return;
      const body = parseBody(echoTakedownSchema, req, reply);
      if (!body) return;
      const acct = await findAccount(ctx.db, body.name);
      if (!acct) return reply.code(404).send({ error: 'no such account' });
      const removed = await ctx.db
        .delete(echoes)
        .where(eq(echoes.accountId, acct.id))
        .returning({ id: echoes.id });
      await logAdmin(ctx.db, admin.id, 'echo_takedown', acct.name, { removed: removed.length });
      return reply.send({ ok: true, removed: removed.length });
    });
  };
}

/** Public — the live broadcast banner the client polls (no auth; empty when none). */
export function broadcastRoutes(ctx: AppContext) {
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/broadcast', async (_req, reply) => {
      const b = await activeBroadcast(ctx.db, new Date());
      return reply.send({ broadcast: b ? { message: b.message, expiresAt: b.expiresAt } : null });
    });
  };
}
