# Towventure — Operations & Deployment (Ubuntu VPS)

> Companion to [ARCHITECTURE.md](ARCHITECTURE.md). This is the production runbook skeleton; it becomes the literal runbook during Phase 5.

---

## 1. Target topology (single VPS)

```
Ubuntu 22.04/24.04 LTS VPS (recommended: 4 vCPU · 8 GB RAM · 80 GB NVMe)
└─ Docker Compose
   ├─ caddy      (:80/:443 — TLS via Let's Encrypt, HTTP/2, serves client static build, reverse-proxies /api + /ws)
   ├─ app        (Node 22, Fastify server; 2 instances via compose scale, Caddy load-balances; jobs leader-elected via pg advisory lock)
   └─ postgres   (PostgreSQL 16, volume-mounted, host-port CLOSED — reachable only on the compose network)
```

- Client is a static bundle (Vite build) served by Caddy with long-cache hashed assets — no Node in the static path.
- Everything async → no sticky sessions needed; WS reconnects land anywhere (pg NOTIFY fans out to all app instances).
- DNS: `towventure.example` → VPS. Caddy config is ~10 lines; TLS is automatic.

## 2. Environments

| Env | Where | Purpose |
|---|---|---|
| `dev` | developer machine (`pnpm dev`: vite + server + dockerized PG) | daily work |
| `staging` | same VPS, `staging.` subdomain, own compose project + DB, `HONOR_SEASON=staging` | pre-release soak, migration rehearsal |
| `prod` | VPS | the game |

Config via env vars only (`.env` never committed; `.env.example` always current): `DATABASE_URL, SESSION_SECRET, PUBLIC_ORIGIN, NODE_ENV, LOG_LEVEL, SEASON_OVERRIDE?`.

## 3. CI/CD (GitHub Actions)

1. **CI on every PR:** typecheck → lint → unit tests → **golden replay tests** → **balance-harness gates** ([BALANCE.md](BALANCE.md) §9) → client+server build. Any gate red = no merge.
2. **Deploy on tag `v*`:** build client bundle + server image → push image to GHCR → SSH to VPS → `docker compose pull && docker compose up -d --wait` → run Drizzle migrations (expand-migrate-contract discipline; migrations must be backward-compatible one release back) → smoke test `/healthz` + one scripted login/run-start against prod → announce in ops channel. Rollback = redeploy previous tag (DB migrations are additive within a release window, so previous images stay runnable).

## 4. Backups & data safety (non-negotiable, set up in Phase 1, drilled in Phase 5)

- `pg_dump --format=custom` nightly via cron container → local `/backups` (7 daily, 4 weekly retained) → **rclone to off-VPS object storage** (owner supplies a B2/S3 bucket; off-box or it isn't a backup).
- WAL archiving deferred unless DAU demands point-in-time recovery; nightly is proportionate at launch.
- **Restore drill is a Phase 5 exit criterion:** restore latest dump into staging, boot, log in, resume a run. Documented step-by-step here when performed.
- `runs.state` + `run_events` + `honor_ledger` make player-support repairs surgical (replay/adjust with an audit trail).

## 5. Security posture

- VPS: ufw (22/80/443 only), SSH keys only + fail2ban, unattended-upgrades on.
- App: argon2id; httpOnly/SameSite=Lax/Secure cookies; zod on every input; fastify-rate-limit per route class (auth: tight; commands: generous-but-bounded); no CORS (same origin serves client and API).
- Postgres: no public port, distinct app user with least privilege, scram auth.
- Anti-cheat is architectural (server-authoritative, [ARCHITECTURE.md](ARCHITECTURE.md) §3); ops side adds: anomaly report (job flags impossible honor-velocity accounts for human review) + admin tools (§6). No client trust anywhere.
- Secrets: in VPS env files with 0600 perms; never in git, never in images.

## 6. Live-ops admin (Phase 5 deliverable)

`/admin` (separate credential + IP allowlist): account lookup (runs, ledger, fights), ban/unban with reason log, Echo takedown, run-repair (replay event log with a patched command), broadcast banner ("Season ends in 24h"), content kill-switch (disable a broken item's drop without deploy — content flags table read by drop tables), season controls, Gauntlet seed preview.

## 7. Observability

- **Logs:** pino JSON → docker json-file with rotation; `docker compose logs` is the launch-scale log stack. Every request logged with account id + route + ms.
- **Metrics:** `/metrics` (prom-client): request latencies, fight-sim ms, DB pool, WS connections, runs started/deaths/hour, honor minted/hour (economy canary), replay-hash mismatches (**page-someone alert — determinism drift**).
- Node exporter + a hosted Grafana Cloud free-tier dashboard (or self-host later); Uptime Kuma container pinging `/healthz` with email/Discord webhook alerts.
- **Golden alarm list:** disk >80% · backup job failed · hash mismatch >0 · p95 >200ms sustained · honor minted/hour >5× 7-day median.

## 8. Capacity & scale path

Launch target 2–3k DAU on the single VPS with headroom (async games are API-cheap; fights are ~ms of integer math). If it outgrows: 1) move PG to a managed/bigger box, 2) scale `app` replicas, 3) CDN the static bundle. Nothing in the architecture requires rewriting to do any of those. This section exists so nobody "pre-scales" — **we ship on one box.**

## 9. Launch checklist (Phase 5 working list)

Domain + TLS live · staging soak 1 week with the harness bots hammering API · restore drill passed · rate limits verified with a load script (k6, 1k virtual users) · admin panel exercised (ban, repair, kill-switch) · legal pages (impressum/privacy — EU host) · error pages that don't leak · season 1 configured with end date · Gauntlet seed for day 1 minted · share-card rendering verified on Discord/Twitter unfurl · on-call: owner has the runbook and has executed every play in it once.
