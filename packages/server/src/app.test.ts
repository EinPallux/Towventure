/**
 * Server integration test against a real Postgres (ARCHITECTURE §3; ROADMAP Phase 1
 * exit criteria). Drives register → run → fight → ladder end-to-end via inject, and
 * verifies the replay-from-seed contract: re-simulating the pre-fight state from the
 * server's seed reproduces the server's log hash bit-for-bit.
 *
 * Skips when DATABASE_URL is unset (unit-only CI); the CI job provides Postgres.
 */

import {
  echoBounty,
  echoMarks,
  prepareFight,
  startRun,
  type RunState,
} from '@towventure/shared/run';
import { simulate as simFn } from '@towventure/shared/sim';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createSession, SESSION_COOKIE } from './auth/session.js';
import { createDatabase, type Database } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { accounts, honorLedger, inbox, marksLedger, skirmishes, unlocks } from './db/schema.js';
import { loadEnv } from './env.js';
import {
  bankEcho,
  getOwnEcho,
  pickEchoForFloor,
  recordEchoDefense,
  recordEchoKill,
} from './services/echoes.js';
import { decayPct, eloDelta, ticketCap, upsertDefense } from './services/skirmish.js';
import { publish, subscribe, subscriberCount } from './services/bus.js';
import { emitFeed } from './services/social.js';
import { lifetimeHonor, placementHonor, runSeasonRollover } from './services/season.js';

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const line = Array.isArray(raw) ? raw[0] : (raw as string);
  return line.split(';')[0]!;
}

d('server API — the Heartbeat loop', () => {
  let app: FastifyInstance;
  let database: Database;
  let season: number;

  beforeAll(async () => {
    const env = loadEnv({
      ...process.env,
      SESSION_SECRET: 'test-secret-at-least-16-chars-long-000',
    });
    season = env.HONOR_SEASON;
    await runMigrations(env.DATABASE_URL);
    database = createDatabase(env.DATABASE_URL);
    // Clean slate for this account name (cascades to runs/fights/ledger).
    await database.sql`DELETE FROM accounts WHERE lower(name) LIKE 'hb%'`;
    app = await buildApp(database, env);
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it('registers, runs, fights deterministically, dies, and ranks on the ladder', async () => {
    const name = `hb_${Date.now().toString(36)}`;

    // Register → session cookie.
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    expect(reg.statusCode).toBe(201);
    const cookie = cookieFrom(reg);

    // /api/me: fresh account, Ashbound, no honor, no marks, tier rank 0.
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().tier).toBe('Ashbound');
    expect(me.json().marks).toBe(0);
    expect(me.json().tierRank).toBe(0);

    // Start a run.
    const start = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    expect(start.statusCode).toBe(201);
    let state = start.json().state as RunState;
    let version = start.json().stateVersion as number;
    expect(state.phase).toBe('doors');

    // A second start is rejected (one active run per account).
    const dup = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    expect(dup.statusCode).toBe(409);

    // Play until death (or a floor cap), verifying the replay-from-seed hash each fight.
    let hashesChecked = 0;
    let died = false;
    for (let guard = 0; guard < 400 && !died; guard++) {
      if (state.phase === 'doors') {
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: { expectedStateVersion: version, command: { type: 'chooseDoor', doorIndex: 0 } },
        });
        expect(r.statusCode).toBe(200);
        state = r.json().state;
        version = r.json().stateVersion;
      } else if (state.phase === 'fight') {
        // Client-side replay contract: derive the same seed + hash from the pre-fight state.
        const prepared = prepareFight(state);
        expect(prepared).not.toBeNull();
        const localHash = simFn(prepared!.spec, prepared!.seed).logHash;

        const f = await app.inject({
          method: 'POST',
          url: '/api/run/fight/start',
          headers: { cookie },
          payload: { expectedStateVersion: version },
        });
        expect(f.statusCode).toBe(200);
        const body = f.json();
        expect(body.result.seed).toBe(prepared!.seed);
        expect(body.result.logHash).toBe(localHash); // server hash === client re-sim hash
        hashesChecked++;
        state = body.state;
        version = body.stateVersion;
        if (state.status === 'dead') died = true;
      } else if (state.phase === 'reward') {
        const cmd = state.pendingItem
          ? { type: 'takeLoot' as const, take: false }
          : { type: 'proceed' as const };
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: { expectedStateVersion: version, command: cmd },
        });
        expect(r.statusCode).toBe(200);
        state = r.json().state;
        version = r.json().stateVersion;
      } else if (state.phase === 'shop') {
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: { expectedStateVersion: version, command: { type: 'leaveShop' } },
        });
        expect(r.statusCode).toBe(200);
        state = r.json().state;
        version = r.json().stateVersion;
      } else if (state.phase === 'event') {
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: {
            expectedStateVersion: version,
            command: { type: 'resolveEvent', optionIndex: 1 },
          },
        });
        expect(r.statusCode).toBe(200);
        state = r.json().state;
        version = r.json().stateVersion;
      } else {
        break;
      }
    }

    expect(hashesChecked).toBeGreaterThan(0);
    expect(died).toBe(true);
    expect(state.status).toBe('dead');
    expect(state.bestFloor).toBeGreaterThanOrEqual(2);

    // Honor was banked from climbing → account appears on the global ladder.
    const ladder = await app.inject({
      method: 'GET',
      url: '/api/ladders/global',
      headers: { cookie },
    });
    expect(ladder.statusCode).toBe(200);
    const page = ladder.json();
    expect(page.self).not.toBeNull();
    expect(page.self.value).toBeGreaterThan(0); // the ladder metric is season Honor
    expect(page.rows.some((r: { name: string }) => r.name === name)).toBe(true);

    // /api/me now reflects the banked honor and a non-Ashbound-or-Ashbound tier.
    const me2 = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me2.json().honor).toBe(page.self.value);

    // The dead run banked its Codex discovery into the account (CONTENT §7).
    const codexRes = await app.inject({ method: 'GET', url: '/api/me/codex', headers: { cookie } });
    expect(codexRes.statusCode).toBe(200);
    const codex = codexRes.json().codex;
    expect(codex.items.bulwark_sigil).toBe(1); // the Vanguard relic was discovered
    expect(Object.keys(codex.enemies).length).toBeGreaterThan(0); // and something was killed
  });

  it('resumes an active run on another device (GET /api/run)', async () => {
    const name = `hb_resume_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    expect(reg.statusCode, JSON.stringify(reg.json())).toBe(201);
    const cookie = cookieFrom(reg);
    const start = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    const startVersion = start.json().stateVersion as number;
    // A "second device" with the same cookie resumes the same run + version.
    const resume = await app.inject({ method: 'GET', url: '/api/run', headers: { cookie } });
    expect(resume.statusCode).toBe(200);
    expect(resume.json().stateVersion).toBe(startVersion);
    expect((resume.json().state as RunState).phase).toBe('doors');
  });

  it('rejects a stale command version with 409', async () => {
    const name = `hb_stale_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const cookie = cookieFrom(reg);
    await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    const stale = await app.inject({
      method: 'POST',
      url: '/api/run/command',
      headers: { cookie },
      payload: { expectedStateVersion: 999, command: { type: 'chooseDoor', doorIndex: 0 } },
    });
    expect(stale.statusCode).toBe(409);
  });

  it('serializes concurrent commands at the same version (one 200, one clean 409)', async () => {
    const name = `hb_race_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const cookie = cookieFrom(reg);
    const start = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    const version = start.json().stateVersion as number;

    // Fire two commands with the SAME expected version, racing.
    const [a, b] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/run/command',
        headers: { cookie },
        payload: { expectedStateVersion: version, command: { type: 'chooseDoor', doorIndex: 0 } },
      }),
      app.inject({
        method: 'POST',
        url: '/api/run/command',
        headers: { cookie },
        payload: { expectedStateVersion: version, command: { type: 'chooseDoor', doorIndex: 0 } },
      }),
    ]);
    const codes = [a.statusCode, b.statusCode].sort();
    // Exactly one applies (200); the loser gets a clean 409, never a 500.
    expect(codes).toEqual([200, 409]);
    expect(codes).not.toContain(500);
  });

  it('accepts known vows but rejects unknown or duplicate ones (no free Honor)', async () => {
    const name = `hb_vow_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const cookie = cookieFrom(reg);
    // Unknown id + duplicate → 400.
    const bad = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: ['vow_of_haste', 'made_up', 'made_up'] },
    });
    expect(bad.statusCode).toBe(400);
    // A valid, unique vow set → 200, and the run carries the vows.
    const ok = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: ['vow_of_haste', 'vow_of_glass'] },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().state.vows).toEqual(['vow_of_haste', 'vow_of_glass']);
  });

  it('gates locked classes behind Honor tier (GDD §7): fresh account can only take Vanguard', async () => {
    const name = `hb_lock_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const cookie = cookieFrom(reg);
    // Duelist (unlockTier 2) is locked at rank 0 → 403, no run created.
    const locked = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'duelist', vows: [] },
    });
    expect(locked.statusCode).toBe(403);
    expect(locked.json().requiredTier).toBe(2);
    expect(locked.json().tierRank).toBe(0);
    // Vanguard (unlockTier 0) is always available → 201.
    const ok = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    expect(ok.statusCode).toBe(201);
  });

  // Insert an account directly and return its id (skips the auth flow for Echo owners).
  async function makeAccount(name: string): Promise<string> {
    const [row] = await database.db
      .insert(accounts)
      .values({ name, passHash: 'x' })
      .returning({ id: accounts.id });
    return row!.id;
  }

  // A dead run for `classId` that fell on `floor` — the input to bankEcho.
  function deadRunOn(classId: 'vanguard' | 'duelist' | 'arcanist', floor: number): RunState {
    const run = startRun(classId, [], 4242);
    run.status = 'dead';
    run.floorsCleared = floor - 1;
    run.deathInfo = { floor, killerEnemyId: 'doomfall', endTick: 100 };
    return run;
  }

  it('Echo economy: kill pays the hunter a bounty + Marks; defense credits the dead owner (GDD §8)', async () => {
    const aId = await makeAccount(`hb_echoA_${Date.now().toString(36)}`);
    const bId = await makeAccount(`hb_echoB_${Date.now().toString(36)}`);

    // A dies on floor 8 with 250 season Honor → banks an Echo.
    await database.db.transaction((tx) =>
      bankEcho(tx, aId, 'Aowner', season, deadRunOn('duelist', 8), 250),
    );
    const own = await getOwnEcho(database.db, aId);
    expect(own).toEqual({ floor: 8, kills: 0, defeats: 0, expired: false });

    // B, near floor 8, is offered A's Echo (not its own).
    const ref = await pickEchoForFloor(database.db, bId, 8, season);
    expect(ref).not.toBeNull();
    expect(ref!.ownerName).toBe('Aowner');
    expect(ref!.floor).toBe(8);

    // B kills the Echo → bounty Honor + Marks land as ledger rows; A's Echo takes a defeat.
    const expectBounty = echoBounty(8, 250, 0); // B has 0 Honor
    const expectMarks = echoMarks(8);
    const paid = await database.db.transaction((tx) => recordEchoKill(tx, ref!, bId, 0, season));
    expect(paid).toEqual({ bounty: expectBounty, marks: expectMarks });

    const bHonor = await database.db
      .select()
      .from(honorLedger)
      .where(and(eq(honorLedger.accountId, bId), eq(honorLedger.reason, 'echo_bounty')));
    expect(bHonor).toHaveLength(1);
    expect(bHonor[0]!.delta).toBe(expectBounty);
    const bMarks = await database.db
      .select()
      .from(marksLedger)
      .where(and(eq(marksLedger.accountId, bId), eq(marksLedger.reason, 'echo_bounty')));
    expect(bMarks[0]!.delta).toBe(expectMarks);
    expect((await getOwnEcho(database.db, aId))!.defeats).toBe(1);

    // The Echo defeats a challenger → A gets Honor trickle + Marks + an inbox notice.
    await database.db.transaction((tx) => recordEchoDefense(tx, ref!, 'Kess', season));
    const aHonor = await database.db
      .select()
      .from(honorLedger)
      .where(and(eq(honorLedger.accountId, aId), eq(honorLedger.reason, 'echo_defense')));
    expect(aHonor[0]!.delta).toBe(3);
    const aMarks = await database.db
      .select()
      .from(marksLedger)
      .where(and(eq(marksLedger.accountId, aId), eq(marksLedger.reason, 'echo_defense')));
    expect(aMarks[0]!.delta).toBe(6);
    const notes = await database.db.select().from(inbox).where(eq(inbox.accountId, aId));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.body).toContain('has slain Kess');
    expect((await getOwnEcho(database.db, aId))!.kills).toBe(1);
  });

  it('an Echo door is injected near a live corpse, and killing it duels the same sim end-to-end', async () => {
    // A weak corpse on floor 4 (freshly-started duelist, no climb) — a soft target.
    const aId = await makeAccount(`hb_echoC_${Date.now().toString(36)}`);
    const weak = startRun('duelist', [], 1);
    weak.status = 'dead';
    weak.floorsCleared = 0;
    weak.deathInfo = { floor: 4, killerEnemyId: 'doomfall', endTick: 50 };
    await database.db.transaction((tx) => bankEcho(tx, aId, 'Corpse', season, weak, 0));

    // B climbs; the server should surface the Echo door around floors 3–9.
    const name = `hb_hunter_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const cookie = cookieFrom(reg);
    const start = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    let state = start.json().state as RunState;
    let version = start.json().stateVersion as number;

    let foughtEcho = false;
    let ended = false;
    for (let guard = 0; guard < 80 && !foughtEcho && !ended; guard++) {
      if (state.phase === 'doors') {
        const echoIdx = state.doors!.findIndex((dd) => dd.kind === 'echo');
        const idx =
          echoIdx >= 0
            ? echoIdx
            : state.doors!.findIndex((dd) => dd.kind === 'battle' || dd.kind === 'elite');
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: {
            expectedStateVersion: version,
            command: { type: 'chooseDoor', doorIndex: idx },
          },
        });
        expect(r.statusCode).toBe(200);
        state = r.json().state;
        version = r.json().stateVersion;
      } else if (state.phase === 'fight') {
        const wasEcho = state.pendingFight?.kind === 'echo';
        const f = await app.inject({
          method: 'POST',
          url: '/api/run/fight/start',
          headers: { cookie },
          payload: { expectedStateVersion: version },
        });
        expect(f.statusCode).toBe(200);
        state = f.json().state;
        version = f.json().stateVersion;
        if (wasEcho) {
          foughtEcho = true;
          // A won Echo fight offers a Grave-Copy (1 of 3) instead of gold loot.
          if (state.status === 'active') {
            expect(state.phase).toBe('reward');
            expect(state.pendingGraveCopy).not.toBeNull();
            expect(f.json().echoReward).not.toBeNull();
            expect(f.json().echoReward.bounty).toBeGreaterThan(0);
          } else {
            // Lost to the Echo → death names the owner; the corpse tallies a kill.
            expect(state.deathInfo?.killerEnemyId).toBe('echo');
            expect((await getOwnEcho(database.db, aId))!.kills).toBe(1);
          }
        }
        if (state.status !== 'active') ended = true;
      } else if (state.phase === 'reward') {
        const cmd = state.pendingGraveCopy
          ? { type: 'chooseGraveCopy' as const, index: 0 }
          : state.pendingItem
            ? { type: 'takeLoot' as const, take: false }
            : { type: 'proceed' as const };
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: { expectedStateVersion: version, command: cmd },
        });
        expect(r.statusCode).toBe(200);
        state = r.json().state;
        version = r.json().stateVersion;
      } else if (state.phase === 'shop') {
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: { expectedStateVersion: version, command: { type: 'leaveShop' } },
        });
        state = r.json().state;
        version = r.json().stateVersion;
      } else if (state.phase === 'event') {
        const r = await app.inject({
          method: 'POST',
          url: '/api/run/command',
          headers: { cookie },
          payload: {
            expectedStateVersion: version,
            command: { type: 'resolveEvent', optionIndex: 1 },
          },
        });
        state = r.json().state;
        version = r.json().stateVersion;
      } else break;
    }
    // The core plumbing claim: the server offered and resolved a real player's Echo.
    expect(foughtEcho).toBe(true);
  });

  // A strong build (deep, so high HP) or a weak one (floor 1) — to rig duel outcomes.
  function buildFor(classId: 'vanguard' | 'duelist' | 'arcanist', floorsCleared: number): RunState {
    const run = startRun(classId, [], 77);
    run.floorsCleared = floorsCleared;
    run.floor = floorsCleared + 1;
    return run;
  }

  it('Skirmish math (BALANCE §6): Elo delta, ticket cap, anti-farm decay', () => {
    // Even Honor → E=0.5 → ±12 at K=24.
    expect(eloDelta(500, 500, true)).toBe(12);
    expect(eloDelta(500, 500, false)).toBe(-12);
    // Punching up pays more; stomping down pays less.
    expect(eloDelta(200, 600, true)).toBeGreaterThan(12);
    expect(eloDelta(600, 200, true)).toBeLessThan(12);
    // Tickets: 5 base, +1 at rank 4, +1 more at rank 6.
    expect(ticketCap(0)).toBe(5);
    expect(ticketCap(4)).toBe(6);
    expect(ticketCap(6)).toBe(7);
    // Decay: ×1 → ×0.5 → ×0.25 → 0 for repeat wins this week.
    expect(decayPct(0)).toBe(100);
    expect(decayPct(1)).toBe(50);
    expect(decayPct(2)).toBe(25);
    expect(decayPct(3)).toBe(0);
    expect(decayPct(9)).toBe(0);
  });

  it('Skirmish loop: beating a weak rival wins Honor + a Key; a repeat same day is blocked (GDD §9)', async () => {
    const defId = await makeAccount(`hb_skDef_${Date.now().toString(36)}`);
    await upsertDefense(database.db, defId, 'Softy', season, buildFor('duelist', 0), 0);

    // The attacker is a registered account (needs a session) with a strong defense.
    const name = `hb_skAtk_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const attId = reg.json().account.id as string;
    const cookie = cookieFrom(reg);
    await upsertDefense(database.db, attId, name, season, buildFor('vanguard', 50), 0);

    // The board returns rivals + a full ticket allotment (specific opponents depend on
    // Honor proximity; the attack below targets by id regardless).
    const board = await app.inject({ method: 'GET', url: '/api/skirmish', headers: { cookie } });
    expect(board.statusCode).toBe(200);
    expect(board.json().tickets.cap).toBe(5);
    expect(Array.isArray(board.json().board)).toBe(true);

    const atk = await app.inject({
      method: 'POST',
      url: '/api/skirmish/attack',
      headers: { cookie },
      payload: { defenderId: defId },
    });
    expect(atk.statusCode).toBe(200);
    const body = atk.json();
    expect(body.outcome.attackerWon).toBe(true);
    expect(body.outcome.honorDelta).toBeGreaterThan(0);
    expect(body.outcome.keyAwarded).toBe(true); // won vs equal/higher Honor (both at 0)
    expect(body.keys).toBe(1);
    // The client can re-sim the duel from the two builds + seed.
    expect(body.attacker.build).toBeTruthy();
    expect(body.defender.build).toBeTruthy();

    // Attacker Honor ledger row exists; a repeat vs the same rival today is blocked.
    const atkHonor = await database.db
      .select()
      .from(honorLedger)
      .where(and(eq(honorLedger.accountId, attId), eq(honorLedger.reason, 'skirmish')));
    expect(atkHonor[0]!.delta).toBe(body.outcome.honorDelta);
    const skRows = await database.db
      .select()
      .from(skirmishes)
      .where(eq(skirmishes.attackerId, attId));
    expect(skRows).toHaveLength(1);

    const again = await app.inject({
      method: 'POST',
      url: '/api/skirmish/attack',
      headers: { cookie },
      payload: { defenderId: defId },
    });
    expect(again.statusCode).toBe(409); // same defender ≤1/day
  });

  it('Skirmish: losing to a strong defense pays the risk-free defender (GDD §9)', async () => {
    const defId = await makeAccount(`hb_skWall_${Date.now().toString(36)}`);
    await upsertDefense(database.db, defId, 'Wall', season, buildFor('vanguard', 50), 0);

    const name = `hb_skWeak_${Date.now().toString(36)}`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name, password: 'hunter2hunter2' },
    });
    const cookie = cookieFrom(reg);
    const attId = reg.json().account.id as string;
    await upsertDefense(database.db, attId, name, season, buildFor('duelist', 0), 0);

    const atk = await app.inject({
      method: 'POST',
      url: '/api/skirmish/attack',
      headers: { cookie },
      payload: { defenderId: defId },
    });
    expect(atk.statusCode).toBe(200);
    const body = atk.json();
    expect(body.outcome.attackerWon).toBe(false);
    expect(body.outcome.defenderReward).toEqual({ honor: 8, marks: 10 });
    expect(body.outcome.keyAwarded).toBe(false);

    // The defender — who did nothing — gains Honor + Marks; the attacker risked it.
    const defHonor = await database.db
      .select()
      .from(honorLedger)
      .where(and(eq(honorLedger.accountId, defId), eq(honorLedger.reason, 'skirmish_def')));
    expect(defHonor[0]!.delta).toBe(8);
    const defMarks = await database.db
      .select()
      .from(marksLedger)
      .where(and(eq(marksLedger.accountId, defId), eq(marksLedger.reason, 'skirmish_def')));
    expect(defMarks[0]!.delta).toBe(10);
  });

  // Create an account + a forged session cookie (avoids the register rate limit).
  async function makeSession(name: string): Promise<{ id: string; cookie: string }> {
    const id = await makeAccount(name);
    const sid = await createSession(database.db, id);
    return {
      id,
      cookie: `${SESSION_COOKIE}=${(app as unknown as { signCookie(v: string): string }).signCookie(sid)}`,
    };
  }

  it('Honor Merchant: buy a cosmetic + arm a boon with Marks; the boon fires at run start (GDD §10.2)', async () => {
    const me = await makeSession(`hb_shop_${Date.now().toString(36)}`);
    // Grant 200 Marks via a ledger row.
    await database.db
      .insert(marksLedger)
      .values({ accountId: me.id, season, delta: 200, reason: 'test', refId: null });

    const shop = await app.inject({
      method: 'GET',
      url: '/api/merchant',
      headers: { cookie: me.cookie },
    });
    expect(shop.statusCode).toBe(200);
    expect(shop.json().marks).toBe(200);
    expect(shop.json().items.length).toBeGreaterThan(0);

    // Arm the Heavy Purse boon (40 Marks) → +50 gold next run.
    const buyBoon = await app.inject({
      method: 'POST',
      url: '/api/merchant/buy',
      headers: { cookie: me.cookie },
      payload: { itemId: 'boon_purse' },
    });
    expect(buyBoon.statusCode).toBe(200);
    expect(buyBoon.json().marks).toBe(160);
    expect(buyBoon.json().bought.armedBoon).toBe('boon_purse');

    // Buy a cosmetic (60 Marks) → owned; a repeat is rejected.
    const buyTrail = await app.inject({
      method: 'POST',
      url: '/api/merchant/buy',
      headers: { cookie: me.cookie },
      payload: { itemId: 'trail_emberwake' },
    });
    expect(buyTrail.statusCode).toBe(200);
    expect(buyTrail.json().marks).toBe(100);
    const owned = await database.db.select().from(unlocks).where(eq(unlocks.accountId, me.id));
    expect(owned.map((u) => u.itemId)).toContain('trail_emberwake');
    const dup = await app.inject({
      method: 'POST',
      url: '/api/merchant/buy',
      headers: { cookie: me.cookie },
      payload: { itemId: 'trail_emberwake' },
    });
    expect(dup.statusCode).toBe(409);

    // Start a run → the armed boon fires (+50 gold) and is consumed.
    const start = await app.inject({
      method: 'POST',
      url: '/api/run/start',
      headers: { cookie: me.cookie },
      payload: { classId: 'vanguard', vows: [] },
    });
    expect(start.statusCode).toBe(201);
    expect((start.json().state as RunState).gold).toBe(50);
    const shop2 = await app.inject({
      method: 'GET',
      url: '/api/merchant',
      headers: { cookie: me.cookie },
    });
    expect(shop2.json().armedBoon).toBeNull(); // consumed
  });

  it('Vault of Champions: 3 Keys buy a Vault item; a fourth attempt is blocked (GDD §9)', async () => {
    const me = await makeSession(`hb_vault_${Date.now().toString(36)}`);
    const foe = await makeAccount(`hb_vfoe_${Date.now().toString(36)}`);
    // Grant 3 Champion's Keys via winning skirmish rows.
    for (let i = 0; i < 3; i++) {
      await database.db.insert(skirmishes).values({
        season,
        attackerId: me.id,
        defenderId: foe,
        attackerWon: true,
        honorDelta: 5,
        keyAwarded: true,
        seed: i + 1,
      });
    }
    const shop = await app.inject({
      method: 'GET',
      url: '/api/merchant',
      headers: { cookie: me.cookie },
    });
    expect(shop.json().keys).toBe(3);

    const buy = await app.inject({
      method: 'POST',
      url: '/api/merchant/buy',
      headers: { cookie: me.cookie },
      payload: { itemId: 'boon_prime' },
    });
    expect(buy.statusCode).toBe(200);
    expect(buy.json().keys).toBe(0); // all 3 spent
    expect(buy.json().bought.armedBoon).toBe('boon_prime');

    // No Keys left → a second Vault purchase is refused.
    const buy2 = await app.inject({
      method: 'POST',
      url: '/api/merchant/buy',
      headers: { cookie: me.cookie },
      payload: { itemId: 'vault_aura_gilded' },
    });
    expect(buy2.statusCode).toBe(402);
  });

  it('Daily Gauntlet: two accounts, same day → identical shared seed + class + doors (GDD §10)', async () => {
    const a = await makeSession(`hb_gaunt_a_${Date.now().toString(36)}`);
    const b = await makeSession(`hb_gaunt_b_${Date.now().toString(36)}`);

    const infoA = await app.inject({
      method: 'GET',
      url: '/api/gauntlet',
      headers: { cookie: a.cookie },
    });
    expect(infoA.statusCode).toBe(200);
    const { seed, classId, day } = infoA.json();
    expect(typeof seed).toBe('number');

    const startA = await app.inject({
      method: 'POST',
      url: '/api/gauntlet/start',
      headers: { cookie: a.cookie },
      payload: {},
    });
    expect(startA.statusCode).toBe(201);
    const startB = await app.inject({
      method: 'POST',
      url: '/api/gauntlet/start',
      headers: { cookie: b.cookie },
      payload: {},
    });
    expect(startB.statusCode).toBe(201);

    const stateA = startA.json().state as RunState;
    const stateB = startB.json().state as RunState;
    // Shared seed + forced class ⇒ identical starting doors/shops/build.
    expect(stateA.seed).toBe(seed);
    expect(stateA.classId).toBe(classId);
    expect(stateB.seed).toBe(stateA.seed);
    expect(stateA.doors).toEqual(stateB.doors);

    // A second entry the same day is refused.
    const dupA = await app.inject({
      method: 'POST',
      url: '/api/gauntlet/start',
      headers: { cookie: a.cookie },
      payload: {},
    });
    expect(dupA.statusCode).toBe(409);

    // The Gauntlet ladder now lists both entrants (best floor = 1 so far).
    const info2 = await app.inject({
      method: 'GET',
      url: '/api/gauntlet',
      headers: { cookie: a.cookie },
    });
    expect(info2.json().entered).toBe(true);
    expect(info2.json().board.total).toBeGreaterThanOrEqual(2);
    expect(info2.json().day).toBe(day);
  });

  it('ladder variety: weekly (floor), echo-kills, and Unnumbered boards respond', async () => {
    const me = await makeSession(`hb_ladv_${Date.now().toString(36)}`);
    for (const board of ['weekly', 'echo-kills', 'unnumbered', 'global']) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/ladders/${board}`,
        headers: { cookie: me.cookie },
      });
      expect(r.statusCode, board).toBe(200);
      expect(r.json().board).toBe(board);
      expect(Array.isArray(r.json().rows)).toBe(true);
    }
    // Weekly + gauntlet-day metrics are floors (no tier badge).
    const weekly = await app.inject({ method: 'GET', url: '/api/ladders/weekly' });
    expect(weekly.json().metric).toBe('floor');
    // Unnumbered is capped at 100.
    const un = await app.inject({ method: 'GET', url: '/api/ladders/unnumbered' });
    expect(un.json().total).toBeLessThanOrEqual(100);
  });

  it('Friends + feed (GDD §10): request → accept → friends see each others’ feed', async () => {
    const aName = `hb_frA_${Date.now().toString(36)}`;
    const bName = `hb_frB_${Date.now().toString(36)}`;
    const a = await makeSession(aName);
    const b = await makeSession(bName);

    // A asks to friend B → pending; a bad name 404s.
    const bad = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { cookie: a.cookie },
      payload: { name: 'nobody_here_xyz' },
    });
    expect(bad.statusCode).toBe(404);
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { cookie: a.cookie },
      payload: { name: bName },
    });
    expect(reqRes.statusCode).toBe(200);
    expect(reqRes.json().status).toBe('pending');

    // B sees an incoming request and accepts it.
    const bFriends = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: { cookie: b.cookie },
    });
    expect(bFriends.json().incoming.some((r: { id: string }) => r.id === a.id)).toBe(true);
    const acc = await app.inject({
      method: 'POST',
      url: '/api/friends/accept',
      headers: { cookie: b.cookie },
      payload: { requesterId: a.id },
    });
    expect(acc.statusCode).toBe(200);

    // Now each lists the other as a friend.
    const aFriends = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: { cookie: a.cookie },
    });
    expect(aFriends.json().friends.some((f: { name: string }) => f.name === bName)).toBe(true);

    // B hits a milestone → A's feed shows it (friends' union).
    await emitFeed(database.db, b.id, 'floor', 'reached Floor 30');
    const aFeed = await app.inject({
      method: 'GET',
      url: '/api/feed',
      headers: { cookie: a.cookie },
    });
    expect(
      aFeed
        .json()
        .feed.some(
          (f: { name: string; body: string }) => f.name === bName && f.body.includes('Floor 30'),
        ),
    ).toBe(true);

    // Public profile resolves by name.
    const prof = await app.inject({
      method: 'GET',
      url: `/api/profile/${bName}`,
      headers: { cookie: a.cookie },
    });
    expect(prof.statusCode).toBe(200);
    expect(prof.json().name).toBe(bName);
  });

  it('Inbox: unread count + mark-read (GDD §11)', async () => {
    const me = await makeSession(`hb_inbox_${Date.now().toString(36)}`);
    await database.db.insert(inbox).values({
      accountId: me.id,
      kind: 'echo_defense',
      body: 'Your Echo slew someone.',
      refId: null,
    });
    const before = await app.inject({
      method: 'GET',
      url: '/api/me/inbox',
      headers: { cookie: me.cookie },
    });
    expect(before.json().unread).toBe(1);
    const read = await app.inject({
      method: 'POST',
      url: '/api/me/inbox/read',
      headers: { cookie: me.cookie },
    });
    expect(read.statusCode).toBe(200);
    const after = await app.inject({
      method: 'GET',
      url: '/api/me/inbox',
      headers: { cookie: me.cookie },
    });
    expect(after.json().unread).toBe(0);
  });

  it('live bus: subscribers receive published toasts and clean up on unsubscribe', () => {
    const acc = 'bus-test-account';
    const got: string[] = [];
    expect(subscriberCount(acc)).toBe(0);
    const off = subscribe(acc, (e) => got.push(e.body));
    expect(subscriberCount(acc)).toBe(1);
    publish(acc, { kind: 'floor', body: 'reached Floor 40' });
    publish('someone-else', { kind: 'floor', body: 'not for us' });
    expect(got).toEqual(['reached Floor 40']);
    off();
    expect(subscriberCount(acc)).toBe(0);
    publish(acc, { kind: 'floor', body: 'after unsubscribe' });
    expect(got).toEqual(['reached Floor 40']); // no delivery after unsubscribe
  });

  it('Season placement math (BALANCE §7): new Honor = round(√old × 12)', () => {
    expect(placementHonor(5000)).toBe(849); // Crownseeker → ~Gatekeeper+
    expect(placementHonor(200)).toBe(170);
    expect(placementHonor(0)).toBe(0);
  });

  it('Season rollover: compresses last season into a placement seed; lifetime excludes it (GDD §11)', async () => {
    const from = 900;
    const to = 901;
    const a = await makeAccount(`hb_seasA_${Date.now().toString(36)}`);
    const b = await makeAccount(`hb_seasB_${Date.now().toString(36)}`);
    await database.db.insert(honorLedger).values([
      { accountId: a, season: from, delta: 5000, reason: 'climb', refId: null },
      { accountId: b, season: from, delta: 200, reason: 'climb', refId: null },
    ]);

    const res = await runSeasonRollover(database.db, from, to);
    expect(res.placed).toBe(2);

    // New-season placement rows are the compressed seeds.
    const aPlace = await database.db
      .select()
      .from(honorLedger)
      .where(
        and(
          eq(honorLedger.accountId, a),
          eq(honorLedger.season, to),
          eq(honorLedger.reason, 'placement'),
        ),
      );
    expect(aPlace[0]!.delta).toBe(placementHonor(5000));

    // Lifetime Honor counts the earned 5000, not the placement carry-over.
    expect(await lifetimeHonor(database.db, a)).toBe(5000);

    // Idempotent: a second rollover into the same season places nobody.
    const again = await runSeasonRollover(database.db, from, to);
    expect(again.placed).toBe(0);
  });

  it('GET /api/season reports the window + your standing + projected placement', async () => {
    const me = await makeSession(`hb_seasE_${Date.now().toString(36)}`);
    await database.db
      .insert(honorLedger)
      .values({ accountId: me.id, season, delta: 900, reason: 'climb', refId: null });
    const r = await app.inject({
      method: 'GET',
      url: '/api/season',
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().season.number).toBe(season);
    expect(typeof r.json().season.endsAt).toBe('string');
    expect(r.json().honor).toBe(900);
    expect(r.json().nextPlacement).toBe(placementHonor(900));
    expect(r.json().lifetime).toBe(900);
  });

  it('rejects unauthenticated run access with 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/run' });
    expect(r.statusCode).toBe(401);
  });
});
