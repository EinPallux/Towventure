# Towventure

**An online, async-multiplayer auto-battler tower climb.** Build a hero out of fused weapons, climb an endless tower, die — and leave your Echo behind for every other climber to hunt.

- Climb floor by floor through authored biomes; combat is a deterministic auto-battle — every decision happens *between* fights: what to buy, fuse, infuse, equip.
- **Death is content:** your death build becomes an **Echo** on that floor. Other players fight it for Honor and loot; it fights back for you.
- **Honor** is the seasonal rank — climb milestones, Echo bounties, and async **Skirmishes** (duels vs. other players' snapshots, no consent needed, defenders risk nothing).
- Daily shared-seed **Gauntlet**, friend ladders, and shareable death/duel cards for the Discord bragging economy.
- Web client (Three.js, fully procedural 3D — zero binary assets), TypeScript monorepo, single Ubuntu VPS, PostgreSQL. Server-authoritative everything.

## Status

**Phase 1 — The Heartbeat: code complete.** The online vertical slice is built and
green end-to-end on a local stack — register, climb the Gatehouse, watch deterministic
seed-replayed fights, fuse gear, die, and rank on the global ladder. What remains for
the Phase 1 exit contract is the parts that only a live VPS can prove: the staging
deploy, the 200-VU k6 smoke, the restore-from-backup drill, and cross-device play.

Quick start (local): `pnpm install`, point `DATABASE_URL` at a Postgres 16, then
`pnpm dev` (server + client). `pnpm test` runs the unit + golden + integration suites;
`pnpm harness` prints death-floor distributions.

## The documents

| Doc | What it holds |
|---|---|
| [docs/GDD.md](docs/GDD.md) | The game: pillars, loops, systems (Echoes, Skirmishes, Honor, seasons) |
| [docs/CONTENT.md](docs/CONTENT.md) | Authored catalog: classes, tags, ~120 items, enemies, 10 bosses, events, Vows |
| [docs/BALANCE.md](docs/BALANCE.md) | Every number: sim constants, statuses, scaling, economy, Elo, harness gates |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, monorepo, determinism contract, API, schema, decision log |
| [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) | "Lanternlight Gloom": procedural meshes, Icon Baker, juice constitution, audio synth |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | VPS topology, CI/CD, backups, security, monitoring, launch checklist |
| [ROADMAP.md](ROADMAP.md) | Five phases with hard exit criteria, Phase 0 → v1.0.0 |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | Working agreement & invariants for every coding session |
| [CHANGELOG.md](CHANGELOG.md) | Keep-a-Changelog history |
