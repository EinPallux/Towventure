/**
 * Social routes (GDD §10) — friends (request/accept/list), the feed, and public
 * profiles. Requests auto-accept when the target already asked you. Feed reads the
 * union of your and your friends' milestones.
 */

import {
  friendAcceptSchema,
  friendRequestSchema,
  profileParamsSchema,
} from '@towventure/shared/protocol';
import type { FastifyInstance } from 'fastify';
import {
  acceptFriend,
  getProfile,
  listFriends,
  readFeed,
  requestFriend,
} from '../services/social.js';
import { parseBody, requireAccount, type AppContext } from './helpers.js';

const REQ_ERROR: Record<string, { code: number; msg: string }> = {
  no_such_account: { code: 404, msg: 'no climber by that name' },
  self: { code: 400, msg: 'you cannot friend yourself' },
};

export function socialRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/friends', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      return reply.send(await listFriends(ctx.db, account.id, season));
    });

    fastify.post('/friends/request', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(friendRequestSchema, req, reply);
      if (!body) return;
      const res = await requestFriend(ctx.db, account.id, body.name);
      if (!res.ok) {
        const e = REQ_ERROR[res.error] ?? { code: 400, msg: res.error };
        return reply.code(e.code).send({ error: e.msg });
      }
      return reply.send({ status: res.status });
    });

    fastify.post('/friends/accept', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(friendAcceptSchema, req, reply);
      if (!body) return;
      const ok = await acceptFriend(ctx.db, account.id, body.requesterId);
      if (!ok) return reply.code(404).send({ error: 'no such pending request' });
      return reply.send({ ok: true });
    });

    fastify.get('/feed', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      return reply.send({ feed: await readFeed(ctx.db, account.id) });
    });

    fastify.get('/profile/:name', async (req, reply) => {
      const params = profileParamsSchema.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: 'bad name' });
      const profile = await getProfile(ctx.db, params.data.name, season);
      if (!profile) return reply.code(404).send({ error: 'no such profile' });
      return reply.send(profile);
    });
  };
}
