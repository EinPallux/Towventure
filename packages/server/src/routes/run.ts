/**
 * Run routes (ARCHITECTURE §3, §5). The server is authoritative: it draws the
 * seed, runs every command through the same shared reducers the client uses, bumps
 * stateVersion, persists, and appends to the run_events audit log. Fights are drawn
 * and simulated server-side; only seed + summary + hash ship back (never the event
 * log — the client re-sims to render).
 */

import { randomInt } from 'node:crypto';
import { getClass } from '@towventure/shared/content';
import { commandRequestSchema, runStartSchema } from '@towventure/shared/protocol';
import {
  applyBoon,
  applyCommand,
  honorTierRank,
  makeSummary,
  prepareFight,
  resolveFight,
  startRun,
  type RunState,
} from '@towventure/shared/run';
import { simulate } from '@towventure/shared/sim';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.js';
import { fights, runEvents, runs } from '../db/schema.js';
import { bankRunCodex } from '../services/codex.js';
import {
  bankEcho,
  pickEchoForFloor,
  recordEchoDefense,
  recordEchoKill,
} from '../services/echoes.js';
import { publish } from '../services/bus.js';
import { awardClimbHonor, seasonHonor } from '../services/honor.js';
import { consumeArmedBoon } from '../services/merchant.js';
import { upsertDefense } from '../services/skirmish.js';
import { emitFeed, pushFeedLive } from '../services/social.js';
import { parseBody, requireAccount, type AppContext } from './helpers.js';

/** Thrown inside a run transaction when the optimistic version guard loses a race. */
class StaleRunError extends Error {}

interface RunRow {
  id: string;
  seed: number;
  state: RunState;
  stateVersion: number;
  floor: number;
  status: string;
}

async function activeRun(db: Db, accountId: string): Promise<RunRow | null> {
  const rows = await db
    .select({
      id: runs.id,
      seed: runs.seed,
      state: runs.state,
      stateVersion: runs.stateVersion,
      floor: runs.floor,
      status: runs.status,
    })
    .from(runs)
    .where(and(eq(runs.accountId, accountId), eq(runs.status, 'active')))
    .limit(1);
  return rows[0] ?? null;
}

const ECHO_MIN_FLOOR = 3;
const ECHO_FLOOR_SPACING = 5;

/** Count ★5 (Zenith) items across a run's equipment + backpack — for the feed milestone. */
function zenithCount(state: RunState): number {
  let n = 0;
  for (const inst of Object.values(state.equipment)) if (inst && inst.star >= 5) n++;
  for (const inst of state.backpack) if (inst.star >= 5) n++;
  return n;
}

/**
 * After a floor advance lands on a doors phase, maybe replace one battle door with a
 * real player's Echo (GDD §8): at most one per 5 floors, never the sole path. Mutates
 * `state` in place (its doors + lastEchoFloor); the caller persists it. Non-deterministic
 * (it reads live DB state), so this is server-only — the client just renders the result.
 */
async function maybeInjectEcho(
  db: Db,
  accountId: string,
  state: RunState,
  season: number,
): Promise<void> {
  if (state.phase !== 'doors' || !state.doors || state.doors.length < 2) return;
  if (state.floor < ECHO_MIN_FLOOR) return;
  if (state.lastEchoFloor != null && state.floor - state.lastEchoFloor < ECHO_FLOOR_SPACING) return;
  if (state.doors.some((d) => d.kind === 'echo')) return;
  const battleIdx = state.doors.findIndex((d) => d.kind === 'battle');
  // Keep a non-Echo path: only replace a battle door if another door remains.
  if (battleIdx < 0 || state.doors.length < 2) return;
  const echo = await pickEchoForFloor(db, accountId, state.floor, season);
  if (!echo) return;
  state.doors[battleIdx] = {
    kind: 'echo',
    enemyIds: [],
    echo,
    preview: `Here fell ${echo.ownerName}, ${echo.tier}`,
  };
  state.lastEchoFloor = state.floor;
}

/** Compact fight summary shipped to the client (it re-sims from the seed to render). */
function fightSummary(seed: number, result: ReturnType<typeof simulate>) {
  return {
    seed,
    winner: result.winner,
    endTick: result.endTick,
    heroHpRemaining: result.heroHpRemaining,
    heroMaxHp: result.heroMaxHp,
    enemyHpRemaining: result.enemyHpRemaining,
    logHash: result.logHash,
  };
}

export function runRoutes(ctx: AppContext) {
  const season = ctx.env.HONOR_SEASON;

  return async (fastify: FastifyInstance): Promise<void> => {
    // POST /api/run/start — begin a run (409 if one is active).
    fastify.post('/start', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(runStartSchema, req, reply);
      if (!body) return;
      // Honor-tier unlock gate (GDD §7): a class is locked until the account's season
      // tier rank reaches its unlockTier. Vanguard is rank 0 → always available.
      const honor = await seasonHonor(ctx.db, account.id, season);
      const requiredTier = getClass(body.classId).unlockTier;
      if (requiredTier > 0 && honorTierRank(honor) < requiredTier) {
        return reply
          .code(403)
          .send({ error: 'class locked', requiredTier, tierRank: honorTierRank(honor) });
      }
      if (await activeRun(ctx.db, account.id)) {
        return reply.code(409).send({ error: 'you already have an active run' });
      }
      const seed = randomInt(0, 0x100000000);
      const state = startRun(body.classId, body.vows, seed);

      const created = await ctx.db.transaction(async (tx) => {
        // Consume the armed War Chest boon (if any) before the run is persisted (GDD §10.2).
        const boon = await consumeArmedBoon(tx, account.id);
        if (boon) applyBoon(state, boon);
        const [row] = await tx
          .insert(runs)
          .values({
            accountId: account.id,
            class: body.classId,
            vows: body.vows,
            seed,
            state,
            stateVersion: 0,
            floor: state.floor,
            status: 'active',
          })
          .returning({ id: runs.id });
        await awardClimbHonor(tx, account.id, season, state.floor, body.vows.length, row!.id);
        // Seed a Skirmish defense snapshot so the account is attackable (GDD §9);
        // boss kills upgrade it to the stronger build.
        await upsertDefense(tx, account.id, account.name, season, state, honor);
        return row!;
      });
      return reply.code(201).send({ runId: created.id, state, stateVersion: 0 });
    });

    // GET /api/run — resume: the current run state (or null).
    fastify.get('/', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const run = await activeRun(ctx.db, account.id);
      if (!run) return reply.send({ run: null });
      return reply.send({ runId: run.id, state: run.state, stateVersion: run.stateVersion });
    });

    // POST /api/run/command — the one gameplay mutation route.
    fastify.post('/command', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(commandRequestSchema, req, reply);
      if (!body) return;
      const run = await activeRun(ctx.db, account.id);
      if (!run) return reply.code(404).send({ error: 'no active run' });
      if (body.expectedStateVersion !== run.stateVersion) {
        return reply
          .code(409)
          .send({ error: 'stale', state: run.state, stateVersion: run.stateVersion });
      }
      const result = applyCommand(run.state, body.command);
      if (!result.ok) return reply.code(400).send({ error: result.error });

      const next = result.state;
      const newVersion = run.stateVersion + 1;
      const vowCount = next.vows.length;
      const floorAdvanced = next.floor > run.floor;

      // A floor advance that lands on a doors phase may surface an Echo door (GDD §8).
      if (floorAdvanced && next.phase === 'doors') {
        await maybeInjectEcho(ctx.db, account.id, next, season);
      }

      // Feed milestones friends can see (GDD §10): every 10th floor, and forging a Zenith.
      const feedEvents: { kind: string; body: string }[] = [];
      if (floorAdvanced && next.floor % 10 === 0) {
        feedEvents.push({ kind: 'floor', body: `reached Floor ${next.floor}` });
      }
      if (body.command.type === 'fuse' && zenithCount(next) > zenithCount(run.state)) {
        feedEvents.push({ kind: 'zenith', body: 'forged a Zenith (★5)' });
      }

      try {
        await ctx.db.transaction(async (tx) => {
          // Optimistic lock at the row: only advance if the version is still what we
          // read. A concurrent command loses this race → 0 rows → clean 409, never a
          // partial write (the run_events PK also backstops double-apply).
          const upd = await tx
            .update(runs)
            .set({
              state: next,
              stateVersion: newVersion,
              floor: next.floor,
              status: next.status,
              endedAt: next.status === 'active' ? null : new Date(),
            })
            .where(and(eq(runs.id, run.id), eq(runs.stateVersion, run.stateVersion)))
            .returning({ id: runs.id });
          if (upd.length === 0) throw new StaleRunError();
          await tx
            .insert(runEvents)
            .values({ runId: run.id, seq: newVersion, command: body.command });
          if (floorAdvanced) {
            await awardClimbHonor(tx, account.id, season, next.floor, vowCount, run.id);
          }
          // Abandoning (or otherwise ending) a run banks its Codex discovery.
          if (next.status !== 'active') await bankRunCodex(tx, account.id, next.codex);
          for (const ev of feedEvents) await emitFeed(tx, account.id, ev.kind, ev.body);
        });
      } catch (err) {
        if (err instanceof StaleRunError) {
          const fresh = await activeRun(ctx.db, account.id);
          return reply.code(409).send({
            error: 'stale',
            state: fresh?.state ?? run.state,
            stateVersion: fresh?.stateVersion ?? run.stateVersion,
          });
        }
        throw err;
      }
      // Post-commit: fan feed milestones out as live toasts to self + friends (GDD §10).
      for (const ev of feedEvents) await pushFeedLive(ctx.db, account.id, ev.kind, ev.body);
      return reply.send({ state: next, stateVersion: newVersion });
    });

    // POST /api/run/fight/start — draw + simulate the pending fight (server-authoritative).
    fastify.post('/fight/start', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;
      const body = parseBody(commandRequestSchema.pick({ expectedStateVersion: true }), req, reply);
      if (!body) return;
      const run = await activeRun(ctx.db, account.id);
      if (!run) return reply.code(404).send({ error: 'no active run' });
      if (body.expectedStateVersion !== run.stateVersion) {
        return reply
          .code(409)
          .send({ error: 'stale', state: run.state, stateVersion: run.stateVersion });
      }
      const prepared = prepareFight(run.state);
      if (!prepared) return reply.code(409).send({ error: 'no fight to start' });

      const result = simulate(prepared.spec, prepared.seed);
      const next = resolveFight(run.state, result);
      const newVersion = run.stateVersion + 1;
      const kind = run.state.pendingFight?.kind ?? 'battle';
      const echo = run.state.pendingFight?.echo ?? null;
      const heroWon = result.winner === 'hero';
      const died = next.status === 'dead';
      const bossWin = kind === 'boss' && heroWon;

      // Echo bounty math, the dead player's new Echo, and the boss-kill defense refresh
      // all need this account's season Honor; fetch once when any of them is in play.
      const needHonor = echo != null || died || bossWin;
      const myHonor = needHonor ? await seasonHonor(ctx.db, account.id, season) : 0;
      let echoReward: { bounty: number; marks: number } | null = null;
      let defenseToast: { ownerId: string; body: string } | null = null;

      try {
        const settled = await ctx.db.transaction(async (tx) => {
          const upd = await tx
            .update(runs)
            .set({
              state: next,
              stateVersion: newVersion,
              floor: next.floor,
              status: next.status,
              endedAt: next.status === 'active' ? null : new Date(),
            })
            .where(and(eq(runs.id, run.id), eq(runs.stateVersion, run.stateVersion)))
            .returning({ id: runs.id });
          if (upd.length === 0) throw new StaleRunError();
          await tx.insert(fights).values({
            runId: run.id,
            floor: run.state.floor,
            kind,
            seed: prepared.seed,
            result: fightSummary(prepared.seed, result),
            logHash: result.logHash,
          });
          // A run that just died banks its Codex discovery for good (CONTENT §7).
          if (next.status !== 'active') await bankRunCodex(tx, account.id, next.codex);
          // Echo settlement (GDD §8): a win pays the hunter a bounty + Marks; a loss to
          // an Echo credits its dead owner. Any death leaves behind this hero's Echo.
          let reward: { bounty: number; marks: number } | null = null;
          let toast: { ownerId: string; body: string } | null = null;
          if (echo && heroWon) {
            reward = await recordEchoKill(tx, echo, account.id, myHonor, season);
          }
          if (died) {
            if (echo) toast = await recordEchoDefense(tx, echo, account.name, season);
            await bankEcho(tx, account.id, account.name, season, next, myHonor);
          }
          // A boss kill refreshes the Skirmish defense to this stronger build (GDD §9).
          if (bossWin) await upsertDefense(tx, account.id, account.name, season, next, myHonor);
          return { reward, toast };
        });
        echoReward = settled.reward;
        defenseToast = settled.toast;
      } catch (err) {
        if (err instanceof StaleRunError) {
          const fresh = await activeRun(ctx.db, account.id);
          return reply.code(409).send({
            error: 'stale',
            state: fresh?.state ?? run.state,
            stateVersion: fresh?.stateVersion ?? run.stateVersion,
          });
        }
        throw err;
      }

      // Post-commit live toast: the Echo's owner learns their corpse just won (GDD §10).
      if (defenseToast) publish(defenseToast.ownerId, { kind: 'echo_kill', body: defenseToast.body });

      const dead = next.status === 'dead';
      return reply.send({
        result: fightSummary(prepared.seed, result),
        state: next,
        stateVersion: newVersion,
        summary: dead ? makeSummary(next) : null,
        echoReward,
      });
    });
  };
}
