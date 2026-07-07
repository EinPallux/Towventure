/**
 * Honor Merchant routes (GDD §10.2). The catalogue with owned/affordable/armed flags,
 * and the purchase endpoint (Marks or Champion's Keys, moved transactionally in the
 * service). Boons arm for the next run; cosmetics are owned forever.
 */

import { MERCHANT_ITEMS } from '@towventure/shared/content';
import { merchantBuySchema } from '@towventure/shared/protocol';
import type { FastifyInstance } from 'fastify';
import { seasonMarks } from '../services/marks.js';
import { buyMerchantItem, getArmedBoon, getOwnedIds } from '../services/merchant.js';
import { keyCount, KEYS_FOR_VAULT } from '../services/skirmish.js';
import { requireAccount, parseBody, type AppContext } from './helpers.js';

const BUY_ERROR: Record<string, { code: number; msg: string }> = {
  no_such_item: { code: 404, msg: 'no such item' },
  already_owned: { code: 409, msg: 'already owned' },
  not_enough_marks: { code: 402, msg: 'not enough Marks' },
  not_enough_keys: { code: 402, msg: 'not enough Champion’s Keys' },
};

export function merchantRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    // GET /api/merchant — the catalogue + this account's Marks/Keys/owned/armed.
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const [marks, keys, owned, armed] = await Promise.all([
        seasonMarks(ctx.db, account.id, season),
        keyCount(ctx.db, account.id, season),
        getOwnedIds(ctx.db, account.id),
        getArmedBoon(ctx.db, account.id),
      ]);
      const items = MERCHANT_ITEMS.map((m) => ({
        ...m,
        owned: owned.has(m.id),
        armed: m.boon != null && armed === m.boon,
        affordable: m.vault ? keys >= KEYS_FOR_VAULT : marks >= m.price,
      }));
      return reply.send({ items, marks, keys, keysForVault: KEYS_FOR_VAULT, armedBoon: armed });
    });

    // POST /api/merchant/buy — purchase with Marks (or Keys for a Vault item).
    fastify.post('/buy', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(merchantBuySchema, req, reply);
      if (!body) return;
      const res = await buyMerchantItem(ctx.db, account.id, season, body.itemId);
      if (!res.ok) {
        const e = BUY_ERROR[res.error] ?? { code: 400, msg: res.error };
        return reply.code(e.code).send({ error: e.msg });
      }
      const [marks, keys] = await Promise.all([
        seasonMarks(ctx.db, account.id, season),
        keyCount(ctx.db, account.id, season),
      ]);
      return reply.send({ bought: res.result, marks, keys });
    });
  };
}
