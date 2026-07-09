# AGENTS.md — Working Agreement for Towventure

This file is the operating manual for any AI agent (or human) writing code in this repository. [CLAUDE.md](CLAUDE.md) points here. Read this fully before your first change in a session.

## 1. What this project is

Towventure: an online, async-multiplayer auto-battler tower-climb roguelite, shipped as a web game on a single Ubuntu VPS. The design is **finished and authoritative** — you are implementing, not re-designing.

**Document hierarchy (highest wins):**
1. [docs/GDD.md](docs/GDD.md) — what the game is
2. [docs/BALANCE.md](docs/BALANCE.md) — every number · [docs/CONTENT.md](docs/CONTENT.md) — every authored thing
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it's built · [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) — how it looks/sounds · [docs/OPERATIONS.md](docs/OPERATIONS.md) — how it runs
4. [ROADMAP.md](ROADMAP.md) — what to build now, with exit criteria

If a task conflicts with these docs, stop and surface the conflict; don't silently improvise design. If the docs are ambiguous, choose the smallest interpretation consistent with the GDD's pillars (§1.1) and note the choice in your PR/commit body.

## 2. Where work happens

- Stack: TypeScript strict everywhere · pnpm workspaces (`packages/shared|server|client|harness`) · Fastify + Drizzle + Postgres 16 · Vite + React 18 + Zustand + Three.js · Vitest.
- Planned dev commands (Phase 1 establishes them; keep this list true): `pnpm dev` (client+server+PG) · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm goldens:update` · `pnpm harness` · `pnpm build`.
- Current phase: check [ROADMAP.md](ROADMAP.md) and [CHANGELOG.md](CHANGELOG.md) to see what's done. Work only on the current phase unless told otherwise.

## 3. Non-negotiable invariants (violating these = broken game, not style debt)

1. **Determinism:** `packages/shared` sim/run code uses integer math only — no floats in state, no `Math.random`, no `Date.now`, no object-key iteration order. All randomness via the seeded RNG in `shared/sim/rng.ts`. Any change that alters a golden hash must regenerate goldens *explicitly* and explain why.
2. **Server authority:** the client never computes an outcome that persists. New gameplay features = command through `POST /api/run/command` + pure reducer in `shared/run`. Never add a "trust the client" shortcut, even temporarily.
3. **`shared` imports nothing.** No dependency creeps into `packages/shared`, ever. `client` never imports `server`.
4. **Ledger economy:** Honor and Valor Marks only move via `honor_ledger` rows in the same DB transaction as their cause. No direct rank-column writes.
5. **Docs–code lockstep:** constants match [docs/BALANCE.md](docs/BALANCE.md); content matches [docs/CONTENT.md](docs/CONTENT.md). If you change one side, change the other in the same PR. New content is authored in CONTENT.md **before** it is coded.
6. **Zero binary assets.** Meshes, icons, audio are procedural (see [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) §2). Do not commit images/models/audio files.
7. **Validation at the edge:** every route body/query parses through the zod schemas in `shared/protocol`. No unvalidated input touches a reducer or the DB.

## 4. How to work

- **Session shape:** prefer completing one meaningful vertical unit (a system, a biome, a boss, a screen) over scattering small edits. Leave the tree green: typecheck, lint, **`format:check`** (CI runs it and fail-fasts the rest on a Prettier miss), tests, and (once it exists) the harness must pass before you stop.
- **Testing bar:** sim/run logic → unit + golden tests; routes → integration tests against a real PG (compose); content → harness gates. UI gets tested by running it — when you touch playback/UI, actually launch and watch a fight before declaring done.
- **Commits:** imperative, scoped (`sim: add Shock consumption on hit resolution`), body explains *why* when non-obvious. Never mention AI models/tools in commits, code, or comments.
- **Changelog:** every completed phase or notable player-facing change adds a [CHANGELOG.md](CHANGELOG.md) entry under `[Unreleased]` (Keep-a-Changelog format).
- **Dependencies:** adding one is a decision, not a reflex — justify in the PR body; nothing heavier than what's in ARCHITECTURE §1 without explicit owner approval.
- **Migrations:** additive/expand-contract only within a release window; never edit an applied migration.
- **When stuck between two designs:** pick the one with less state, fewer systems, and better legibility to players — the GDD's "bounded complexity" pillar outranks cleverness.

## 5. Definition of done (any task)

Code + tests green · invariants above intact · docs updated in lockstep · runs on staging-shaped compose (not just vite dev) if it touches server/DB · relevant ROADMAP exit-criterion checkbox honestly evaluable · CHANGELOG updated when player-facing.
