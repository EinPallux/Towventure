/**
 * Skirmish routes (GDD §9) — the Rival Board + the attack. The server draws the seed,
 * duels two defense snapshots through the shared sim, moves Honor Elo-style, and pays
 * the defender on a successful defense. The client re-sims from the two builds + seed
 * to render the duel (same determinism contract as run fights, ARCHITECTURE §3).
 */

import { randomInt } from 'node:crypto';
import { skirmishAttackSchema } from '@towventure/shared/protocol';
import { buildDuelSpec, honorTierRank } from '@towventure/shared/run';
import { simulate } from '@towventure/shared/sim';
import type { FastifyInstance } from 'fastify';
import { seasonHonor } from '../services/honor.js';
import {
  getBoard,
  getDefense,
  keyCount,
  precheck,
  settleSkirmish,
  SkirmishGuardError,
  ticketState,
  KEYS_FOR_VAULT,
} from '../services/skirmish.js';
import { parseBody, requireAccount, type AppContext } from './helpers.js';

export function skirmishRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    // GET /api/skirmish — the Rival Board, ticket state, and Key tally.
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const honor = await seasonHonor(ctx.db, account.id, season);
      const rank = honorTierRank(honor);
      const [board, tickets, keys, mine] = await Promise.all([
        getBoard(ctx.db, account.id, season, honor),
        ticketState(ctx.db, account.id, rank),
        keyCount(ctx.db, account.id, season),
        getDefense(ctx.db, account.id),
      ]);
      return reply.send({
        board,
        tickets,
        keys,
        keysForVault: KEYS_FOR_VAULT,
        defense: mine ? { class: mine.class, floor: mine.floor, honor: mine.honor } : null,
      });
    });

    // POST /api/skirmish/attack — duel a rival's defense (spends a ticket).
    fastify.post('/attack', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(skirmishAttackSchema, req, reply);
      if (!body) return;
      if (body.defenderId === account.id) {
        return reply.code(400).send({ error: 'you cannot skirmish yourself' });
      }

      const mine = await getDefense(ctx.db, account.id);
      if (!mine) {
        return reply.code(403).send({ error: 'forge a defense first — start a run' });
      }
      const foe = await getDefense(ctx.db, body.defenderId);
      if (!foe) return reply.code(404).send({ error: 'no such defender' });

      const nowMs = Date.now();
      const hAtt = await seasonHonor(ctx.db, account.id, season);
      const rank = honorTierRank(hAtt);
      // Advisory fast-path checks (reject the common case without a transaction/sim);
      // settleSkirmish re-validates both under the account row lock — that is the boundary.
      const tickets = await ticketState(ctx.db, account.id, rank, nowMs);
      if (tickets.remaining <= 0) {
        return reply.code(429).send({ error: 'out of Skirmish tickets today' });
      }
      const { attackedToday } = await precheck(ctx.db, account.id, body.defenderId, nowMs);
      if (attackedToday) {
        return reply.code(409).send({ error: 'you already skirmished them today' });
      }

      const seed = randomInt(0, 0x100000000);
      const spec = buildDuelSpec(mine.build, foe.build, 0);
      const result = simulate(spec, seed);
      const attackerWon = result.winner === 'hero';
      const hDef = await seasonHonor(ctx.db, body.defenderId, season);

      let outcome;
      try {
        outcome = await ctx.db.transaction((tx) =>
          settleSkirmish(tx, {
            season,
            attackerId: account.id,
            defenderId: body.defenderId,
            attackerWon,
            hAtt,
            hDef,
            tierRank: rank,
            seed,
            nowMs,
          }),
        );
      } catch (e) {
        // Lost the race to a concurrent attack — the in-transaction guard rejected it.
        if (e instanceof SkirmishGuardError) {
          return reply.code(e.code === 'out_of_tickets' ? 429 : 409).send({ error: e.code });
        }
        throw e;
      }

      const keys = await keyCount(ctx.db, account.id, season);
      return reply.send({
        seed,
        result: {
          winner: result.winner,
          endTick: result.endTick,
          heroHpRemaining: result.heroHpRemaining,
          heroMaxHp: result.heroMaxHp,
          enemyHpRemaining: result.enemyHpRemaining,
          logHash: result.logHash,
        },
        attacker: { name: account.name, class: mine.class, floor: mine.floor, build: mine.build },
        defender: { name: foe.ownerName, class: foe.class, floor: foe.floor, build: foe.build },
        outcome,
        keys,
      });
    });
  };
}
