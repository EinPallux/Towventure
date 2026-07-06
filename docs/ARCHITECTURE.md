# Towventure — Technical Architecture

> Companion to [GDD.md](GDD.md). Deployment & runbook: [OPERATIONS.md](OPERATIONS.md).

---

## 1. Stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** (strict) | one language client+server+shared sim; the deterministic sim MUST be shared code |
| Runtime | **Node.js 22 LTS** | LTS through launch window; native `fetch`, stable perf |
| Monorepo | **pnpm workspaces** | light, fast, no build-system ceremony |
| Server HTTP | **Fastify 4** + **zod** validation on every route | fast, schema-first, tiny footprint on a VPS |
| Realtime | **ws** (WebSocket) for notifications/feed only | the game is async — WS pushes toasts & feed events; ALL gameplay is request/response |
| Database | **PostgreSQL 16** — the only datastore | transactional economy, JSONB for build snapshots, materialized ladders, `LISTEN/NOTIFY` for WS fan-out. **No Redis at launch**: our scale (thousands of DAU on one VPS) doesn't need a second stateful service to operate, back up, and break. Revisit only if measured. |
| ORM | **Drizzle** | SQL-transparent, TS-native, no codegen daemon; migrations checked in |
| Auth | **argon2id** + httpOnly signed session cookie (server-side session rows) | boring and correct; guest accounts upgradeable; Discord OAuth post-launch |
| Client build | **Vite** | instant dev loop |
| 3D | **Three.js** (WebGL2) | per product requirement; all assets procedural (see [ART_DIRECTION.md](ART_DIRECTION.md)) |
| UI | **React 18 + Zustand** for menus/inventory/ladders; Three.js scene is imperative, outside React, bridged by a thin event bus | complex drag-drop/tooltip UI wants a real UI framework; the scene must never re-render through React |
| Animation/tweens | custom tween lib in `client/engine` (tiny, deterministic-friendly) + WebAudio synth for SFX | zero binary assets policy (§ART 2) |
| Testing | **Vitest** + golden replay tests + the balance harness ([BALANCE.md](BALANCE.md) §9) | determinism is testable — exploit that |
| Lint/format | ESLint + Prettier, CI-enforced | agents keep style wars at zero |

## 2. Monorepo layout

```
towventure/
├─ packages/
│  ├─ shared/            # THE HEART. Zero-dependency, isomorphic.
│  │  ├─ src/sim/        # deterministic combat sim (integer math, seeded RNG)
│  │  ├─ src/content/    # all authored content as typed data (items, enemies, …)
│  │  ├─ src/run/        # run-state machine: doors, shops, loot, fusion (pure reducers)
│  │  └─ src/protocol/   # zod schemas for every API request/response & WS message
│  ├─ server/            # Fastify app: auth, run commands, echoes, skirmishes, ladders
│  │  ├─ src/db/         # drizzle schema + migrations
│  │  └─ src/jobs/       # cron-ish loops: season roll, echo expiry, ladder refresh
│  ├─ client/            # Vite + React + Three.js
│  │  ├─ src/engine/     # scene, procedural asset builders, VFX, tweens, audio synth
│  │  ├─ src/playback/   # renders a sim event log as a cinematic fight
│  │  └─ src/ui/         # React app: hero screen, shops, ladders, profiles
│  └─ harness/           # headless balance CLI over shared/
├─ docs/                 # these documents (source of truth)
├─ docker-compose.yml    # postgres + app + caddy (see OPERATIONS.md)
└─ .github/workflows/    # ci: typecheck, test, harness gates, build
```

**Dependency law:** `shared` imports nothing from anywhere. `server` and `client` import `shared`. `client` never imports `server`. Content data lives in `shared/src/content` as plain typed objects — authored in [CONTENT.md](CONTENT.md) first, transcribed second.

## 3. The server-authoritative model (anti-cheat by construction)

The client is a **renderer and command sender**. It never computes an outcome that matters.

- Every gameplay action is a **command**: `POST /api/run/command` with `{runId, expectedStateVersion, command}` where command ∈ `chooseDoor · buy · sell · reroll · equip · unequip · fuse · infuse · useConsumableSetting · takeLoot · abandonRun`, all zod-validated against `shared/protocol`.
- The server applies commands through the **same pure reducers in `shared/run`** the client uses for optimistic UI, bumps `stateVersion`, persists, and returns the new state. Version mismatch → client refetches (no merge logic, ever).
- **Fights:** server draws a fight seed, runs `shared/sim`, stores `{seed, result, eventLogHash}`, returns seed + result summary. The client **re-simulates locally from the seed** to render the fight — the event log is never shipped, only replayed (tiny payloads, perfect fidelity). If a client's local replay hash mismatches the server's, the client shows the server result and files a telemetry report (that's a sim-determinism bug, our highest-severity class).
- Shop stock, drops, doors, events: all derived server-side from `runSeed + floor + counters`. The client cannot see undrawn futures (no peeking at next floor's doors in traffic).
- Rate limits per account+IP on all mutating routes; command idempotency via `expectedStateVersion`.

## 4. The determinism contract (the load-bearing wall)

The sim MUST produce identical results on server (Node) and every client browser. Rules, enforced by review + CI:

1. **Integer math only** in sim state: HP, damage, ticks, stack counts. Percentages are applied as `Math.trunc(x * num / den)` fixed-point — **no floats in state, no `Math.random`, no `Date`, no iteration over object keys** (Maps with insertion order or sorted arrays only).
2. RNG: **xoshiro128\*\*** implementation in `shared/sim/rng.ts`, seeded per fight; every random draw goes through it; draw order is defined by the resolution order in [BALANCE.md](BALANCE.md) §1.
3. The sim consumes `(heroBuild, enemyComp, seed, constants)` and emits `(result, eventLog)`; `hash(eventLog)` (xxhash-style, in shared) is the cross-check.
4. **Golden tests:** `shared/sim/__golden__/` holds seeds + expected hashes for scripted fights covering every trigger, status, and boss mechanic. Any sim PR that changes a hash must say why in the PR body and regenerate goldens explicitly (`pnpm goldens:update`). CI fails on silent drift.
5. Content constants live in one file mirrored to [BALANCE.md](BALANCE.md); the harness gates in CI (§BALANCE 9).

## 5. API surface (summary; full zod contracts live in `shared/protocol`)

```
POST /api/auth/register|login|logout|guest       # session cookie
GET  /api/me                                     # profile, honor, tickets, inbox count
POST /api/run/start {class, vows[]}              # 409 if active run exists
GET  /api/run                                    # current run state (resume anywhere)
POST /api/run/command {…}                        # the one gameplay mutation route
POST /api/run/fight/start                        # → {seed, result, rewards}
GET  /api/echoes/offer?floor=n                   # echo doors for door-gen (server internal)
POST /api/skirmish/board | /attack {defenderId}  # rival board; run duel → {seed, result}
GET  /api/ladders/{global|weekly|friends|gauntlet|echoes}?page=
GET  /api/profile/:name  ·  GET /api/codex
POST /api/friends/request|accept|remove
GET  /api/gauntlet/today  ·  POST /api/gauntlet/start
WS   /ws                                         # server→client only: toasts, feed, inbox
```

## 6. Data model (Drizzle/Postgres — launch schema)

```
accounts(id, name citext UNIQUE, pass_hash, email NULL, created_at, flags)
sessions(id, account_id, expires_at)                       -- httpOnly cookie → row
runs(id, account_id UNIQUE-active, class, vows[], seed, state JSONB,
     state_version, floor, status[active|dead|abandoned], started_at, ended_at)
run_events(run_id, seq, at, command JSONB)                 -- append-only audit/replay
fights(id, run_id, floor, kind, seed, result JSONB, log_hash, created_at)
echoes(id, account_id UNIQUE, floor, build JSONB, honor_tier, kills, defeats,
       created_at, expires_at, replaced_by NULL)
echo_fights(id, echo_id, hunter_account_id, seed, result, bounty, created_at)
snapshots(id, account_id, build JSONB, label, pinned bool, created_at)  -- skirmish defense
skirmishes(id, attacker_id, defender_snapshot_id, seed, result, honor_delta, created_at)
honor_ledger(id, account_id, season, delta, reason enum, ref_id, created_at)
   -- Honor is ALWAYS derived: SUM(ledger) per season. Never a mutable column.
seasons(id, starts_at, ends_at)  ·  gauntlets(date, seed, class)
gauntlet_results(date, account_id, floor, honor_awarded)
friends(a, b, status)  ·  inbox(id, account_id, kind, payload JSONB, read, created_at)
codex_unlocks(account_id, entry_id, level, at)
mv_ladder_* (materialized views, refreshed by jobs every 60s; user row lookups indexed)
```

JSONB for `runs.state` / builds is deliberate: build shapes evolve with content patches; the *ledger tables* around them are strictly relational and transactional. Every Honor/Mark grant is a ledger row inside the same transaction as its cause — the economy is auditable and replayable by construction.

## 7. Background jobs (in-process, `server/src/jobs`, leader-elected via pg advisory lock)

Ladder refresh (60s) · Echo expiry sweep (5min) · Season rollover (checks hourly; runs the reset in one transaction) · Gauntlet daily seed mint (00:00 UTC) · Ticket refill (00:00 UTC) · Inbox pruning (daily) · pg-notify → WS fan-out (continuous).

## 8. Performance & capacity targets (single VPS, see OPERATIONS.md for sizing)

- API p95 < 60ms (commands), fight sim < 30ms server CPU per fight (10 ticks/s × 60s worst case is trivial for integer math).
- Client: 60fps fight playback on a 2019 laptop iGPU; first meaningful paint < 3s on 20Mbps; total JS < 900KB gz (no binary assets helps enormously).
- One VPS (4 vCPU/8GB) comfortably serves ~2–3k DAU of an async game; the design has no realtime fan-out to melt.

## 9. Decision log (ADR-style, one-liners)

| # | Decision | Alternatives rejected — why |
|---|---|---|
| 1 | Web client, no engine | Unity/Godot: distribution friction, asset pipeline, and the VPS-hosted-website requirement |
| 2 | TS monorepo w/ shared sim | separate sim implementations (drift = cheating vector); WASM/Rust sim (build complexity unearned at this scale) |
| 3 | Postgres only | +Redis (ops cost > benefit at launch scale); SQLite (concurrent writers + ladders want PG); Mongo (economy wants transactions) |
| 4 | Replay-from-seed, not log shipping | shipping event logs: 100× payload for zero fidelity gain |
| 5 | Async-only multiplayer, WS for toasts only | realtime PvP: netcode class of problems the design explicitly avoids |
| 6 | React for UI, imperative Three.js scene | react-three-fiber: reconciler overhead + two mental models in the hot path |
| 7 | All assets procedural/generated in-repo | asset store/AI-image pipelines: license mess, inconsistent style, binary bloat in git |
| 8 | Honor as ledger-derived value | mutable rank column (unauditable, race-prone) |
| 9 | Sessions in DB, not JWT-stateless | instant bans/logout matter more than one DB read per request |
