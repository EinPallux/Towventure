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
import { createDatabase, type Database } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { accounts, honorLedger, inbox, marksLedger } from './db/schema.js';
import { loadEnv } from './env.js';
import {
  bankEcho,
  getOwnEcho,
  pickEchoForFloor,
  recordEchoDefense,
  recordEchoKill,
} from './services/echoes.js';

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
          payload: { expectedStateVersion: version, command: { type: 'resolveEvent', optionIndex: 1 } },
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
    expect(page.self.honor).toBeGreaterThan(0);
    expect(page.rows.some((r: { name: string }) => r.name === name)).toBe(true);

    // /api/me now reflects the banked honor and a non-Ashbound-or-Ashbound tier.
    const me2 = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me2.json().honor).toBe(page.self.honor);

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
    await database.db.transaction((tx) => bankEcho(tx, aId, 'Aowner', season, deadRunOn('duelist', 8), 250));
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
          payload: { expectedStateVersion: version, command: { type: 'chooseDoor', doorIndex: idx } },
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
          payload: { expectedStateVersion: version, command: { type: 'resolveEvent', optionIndex: 1 } },
        });
        state = r.json().state;
        version = r.json().stateVersion;
      } else break;
    }
    // The core plumbing claim: the server offered and resolved a real player's Echo.
    expect(foughtEcho).toBe(true);
  });

  it('rejects unauthenticated run access with 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/run' });
    expect(r.statusCode).toBe(401);
  });
});
